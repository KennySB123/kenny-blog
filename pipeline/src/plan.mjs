// Decide what the distribute workflow should do. Pure function, so it is easy to test.
import { PLATFORMS, MIRRORS, ANNOUNCERS, effectiveOptions } from './lib/config.mjs';
import { contentHash } from './lib/posts.mjs';

/**
 * @param {object} p
 * @param {'push'|'dispatch'} p.event
 * @param {{slug:string, deleted?:boolean}[]} [p.changed]  posts touched by the push
 * @param {{slug:string, action:'distribute'|'remove'|'regenerate-script', platforms:string[]}} [p.input]
 * @param {object} p.settings
 * @param {object} p.ledger
 * @param {(slug:string)=>object|null} p.readPost
 * @param {(slug:string)=>{job:object|null}} p.readJob
 * @returns {{tasks:{slug:string, platform:string, op:string}[], notes:string[]}}
 */
export function plan({ event, changed = [], input, settings, ledger, readPost, readJob }) {
  const tasks = [];
  const notes = [];
  const entryOf = (slug, p) => ledger.posts?.[slug]?.[p] ?? {};
  const live = (e) => e.id && !e.removed;

  if (event === 'dispatch' && input?.action === 'remove') {
    const targets = input.platforms.length ? input.platforms : PLATFORMS;
    for (const p of targets) {
      if (live(entryOf(input.slug, p))) tasks.push({ slug: input.slug, platform: p, op: 'remove' });
      else notes.push(`${input.slug}: nothing to remove on ${p}`);
    }
    return { tasks, notes };
  }

  if (event === 'dispatch' && input?.action === 'regenerate-script') {
    const post = readPost(input.slug);
    if (!post) notes.push(`${input.slug}: post not found`);
    else tasks.push({ slug: input.slug, platform: 'youtube', op: 'script' });
    return { tasks, notes };
  }

  const explicit = event === 'dispatch';
  const slugs = explicit ? [input.slug] : [...new Set(changed.filter((c) => !c.deleted).map((c) => c.slug))];
  const auto = explicit || settings.trigger !== 'manual';

  for (const slug of slugs) {
    const post = readPost(slug);
    if (!post) {
      notes.push(`${slug}: post not found`);
      continue;
    }
    if (post.data.draft) {
      notes.push(`${slug}: draft, skipped`);
      continue;
    }
    const only = explicit && input.platforms.length ? new Set(input.platforms) : null;
    // Older essays (e.g. the starter posts) never go out automatically; "Distribute now" still works.
    const tooOld = !explicit && settings.autoSince && post.data.pubDate && String(post.data.pubDate) < settings.autoSince;
    if (tooOld) notes.push(`${slug}: dated before ${settings.autoSince}, so only existing mirrors are updated`);
    const autoNew = auto && !tooOld;

    for (const p of PLATFORMS) {
      if (only && !only.has(p)) continue;
      const opts = effectiveOptions(settings, post, p);
      if (!only && opts.enabled === false) continue;
      const entry = entryOf(slug, p);

      if (MIRRORS.includes(p)) {
        if (live(entry)) {
          const changedContent = entry.hash !== contentHash(post);
          if (changedContent && (explicit || settings.updateMirrorsOnEdit)) tasks.push({ slug, platform: p, op: 'update' });
        } else if (autoNew) {
          tasks.push({ slug, platform: p, op: 'publish' });
        }
      } else if (ANNOUNCERS.includes(p)) {
        if (!live(entry) && autoNew) tasks.push({ slug, platform: p, op: 'publish' });
      } else if (p === 'youtube') {
        if (live(entry) || !autoNew) continue;
        const job = readJob(slug).job;
        if (!job || (explicit && job.status === 'failed' && only)) tasks.push({ slug, platform: p, op: 'script' });
        else notes.push(`${slug}: video job already exists (${job.status})`);
      }
    }
    if (!auto) notes.push(`${slug}: distribution is manual; only existing mirrors were considered`);
  }
  return { tasks, notes };
}
