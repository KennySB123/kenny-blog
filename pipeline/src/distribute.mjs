// Entry point for .github/workflows/distribute.yml
//   push to main (posts changed)  → send newly published essays out, update mirrors
//   workflow_dispatch             → distribute / remove / regenerate-script for one essay
import { execFileSync } from 'node:child_process';
import { REPO_ROOT, loadSettings, effectiveOptions, siteInfo, postUrl, missingSecrets, DRY_RUN } from './lib/config.mjs';
import { readPost, slugFromFile, contentHash } from './lib/posts.mjs';
import { readLedger, readJob, jobPaths, persist, setLedgerEntry, summary } from './lib/store.mjs';
import { plan } from './plan.mjs';
import { writeScript } from './video/script.mjs';
import * as devto from './platforms/devto.mjs';
import * as hashnode from './platforms/hashnode.mjs';
import * as bluesky from './platforms/bluesky.mjs';
import * as mastodon from './platforms/mastodon.mjs';
import { deleteVideo } from './video/youtube.mjs';

const ADAPTERS = { devto, hashnode, bluesky, mastodon };
const LABELS = { devto: 'DEV', hashnode: 'Hashnode', bluesky: 'Bluesky', mastodon: 'Mastodon', youtube: 'YouTube' };

function changedPosts() {
  const before = process.env.BEFORE_SHA;
  const after = process.env.AFTER_SHA || 'HEAD';
  const zero = !before || /^0+$/.test(before);
  const args = zero ? ['diff-tree', '--no-commit-id', '--name-status', '-r', '-M', after] : ['diff', '--name-status', '-M', before, after];
  let out = '';
  try {
    out = execFileSync('git', args, { cwd: REPO_ROOT }).toString();
  } catch (e) {
    console.warn(`Could not diff ${before}..${after}: ${e.message}`);
  }
  const changed = [];
  for (const line of out.split('\n').filter(Boolean)) {
    const [status, ...files] = line.split('\t');
    const file = files[files.length - 1];
    const slug = slugFromFile(file);
    if (slug) changed.push({ slug, deleted: status.startsWith('D') });
  }
  return changed;
}

async function main() {
  const settings = loadSettings();
  const ledger = readLedger();
  const site = siteInfo();
  const event = process.env.EVENT_NAME === 'workflow_dispatch' ? 'dispatch' : 'push';
  const input =
    event === 'dispatch'
      ? {
          slug: (process.env.INPUT_SLUG || '').trim(),
          action: process.env.INPUT_ACTION || 'distribute',
          platforms: (process.env.INPUT_PLATFORMS || '').split(',').map((s) => s.trim()).filter(Boolean),
        }
      : undefined;
  if (event === 'dispatch' && !input.slug) throw new Error('A slug is required.');

  const changed = event === 'push' ? changedPosts() : [];
  const { tasks, notes } = plan({ event, changed, input, settings, ledger, readPost, readJob });

  summary(`## Distribution${DRY_RUN ? ' (dry run)' : ''}\n`);
  if (event === 'push') summary(`Posts changed in this push: ${changed.map((c) => `\`${c.slug}\`${c.deleted ? ' (deleted)' : ''}`).join(', ') || 'none'}\n`);
  for (const n of notes) summary(`- ${n}`);
  if (!tasks.length) {
    summary('\nNothing to do.');
    return;
  }

  const ledgerOps = [];
  const files = {};
  const rows = [];
  let failures = 0;
  const now = new Date().toISOString();

  for (const task of tasks) {
    const { slug, platform, op } = task;
    const post = readPost(slug);
    const opts = effectiveOptions(settings, post, platform);
    const ctx = { site, url: postUrl(slug) };
    const existing = ledger.posts?.[slug]?.[platform] ?? {};
    const label = LABELS[platform];

    try {
      if (op === 'script') {
        const paths = jobPaths(slug);
        if (DRY_RUN) {
          rows.push([slug, label, 'script', 'would write a script']);
          continue;
        }
        const script = await writeScript(post, opts, site.title);
        files[paths.script] = script.text;
        files[paths.job] = JSON.stringify({ status: 'review', style: script.style, model: script.model, createdAt: now, updatedAt: now }, null, 2) + '\n';
        rows.push([slug, label, 'script', `ready for review (${script.style})`]);
        continue;
      }

      const missing = missingSecrets(platform);
      if (missing.length) {
        ledgerOps.push(setLedgerEntry(slug, platform, { skipped: `Missing secret ${missing.join(', ')}`, error: undefined }));
        rows.push([slug, label, op, `skipped: missing ${missing.join(', ')}`]);
        continue;
      }
      if (DRY_RUN) {
        rows.push([slug, label, op, 'would run']);
        continue;
      }

      if (op === 'remove') {
        const res = platform === 'youtube' ? (await deleteVideo(existing.id), {}) : await ADAPTERS[platform].remove(existing);
        ledgerOps.push(setLedgerEntry(slug, platform, { removed: true, removedAt: now, note: res.note, error: undefined }));
        rows.push([slug, label, 'remove', res.note ?? 'removed']);
      } else if (op === 'publish') {
        const res = await ADAPTERS[platform].publish(post, opts, ctx);
        ledgerOps.push(setLedgerEntry(slug, platform, { ...res, at: now, hash: contentHash(post), error: undefined, errorAt: undefined, skipped: undefined, removed: undefined }, { merge: false }));
        rows.push([slug, label, 'publish', res.url ?? 'done']);
      } else if (op === 'update') {
        const res = await ADAPTERS[platform].update(post, opts, ctx, existing);
        ledgerOps.push(setLedgerEntry(slug, platform, { ...res, updatedAt: now, hash: contentHash(post), error: undefined, errorAt: undefined }));
        rows.push([slug, label, 'update', res.note ?? res.url ?? 'done']);
      }
    } catch (e) {
      failures++;
      const message = String(e.message ?? e).slice(0, 300);
      console.error(`${slug} → ${platform} (${op}) failed:`, e);
      if (op === 'script') {
        const paths = jobPaths(slug);
        files[paths.job] = JSON.stringify({ status: 'failed', error: message, updatedAt: now }, null, 2) + '\n';
      } else {
        ledgerOps.push(setLedgerEntry(slug, platform, { error: message, errorAt: now }));
      }
      rows.push([slug, label, op, `failed: ${message}`]);
    }
  }

  summary('\n| Essay | Platform | Action | Result |\n|---|---|---|---|');
  for (const r of rows) summary(`| ${r.map((c) => String(c).replace(/\|/g, '\\|')).join(' | ')} |`);

  const pushed = persist({ ledger: ledgerOps, files }, `Distribute: ${[...new Set(tasks.map((t) => t.slug))].join(', ')}`);
  summary(pushed ? '\nResults committed to the repository.' : '\nNo commit made (local run, dry run, or nothing changed).');
  if (failures) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  summary(`\n**Error:** ${e.message}`);
  process.exit(1);
});
