// Entry point for .github/workflows/video-render.yml
// Renders every approved video job (or the one named by INPUT_SLUG), uploads it to
// YouTube, and records the result in the ledger.
import path from 'node:path';
import { loadSettings, effectiveOptions, siteInfo, postUrl, missingSecrets, PATHS, DRY_RUN } from '../lib/config.mjs';
import { readPost } from '../lib/posts.mjs';
import { listJobs, readJob, jobPaths, persist, setLedgerEntry, summary } from '../lib/store.mjs';
import { parseScript } from './scriptfile.mjs';
import { renderVideo, chapterLines } from './compose.mjs';
import { uploadVideo, setThumbnail, uploadCaptions, addToPlaylist } from './youtube.mjs';

const runUrl = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined;

function jobJson(job, patch) {
  const next = { ...job, ...patch, updatedAt: new Date().toISOString() };
  for (const [k, v] of Object.entries(next)) if (v === undefined) delete next[k];
  return JSON.stringify(next, null, 2) + '\n';
}

async function renderOne(slug, settings, site) {
  const { job, script } = readJob(slug);
  const paths = jobPaths(slug);
  if (!job || !script) throw new Error(`No job or script for ${slug}`);
  const post = readPost(slug);
  const opts = effectiveOptions(settings, post, 'youtube');
  const parsed = parseScript(script);
  const essayTitle = post?.data.title ?? parsed.meta.title;
  const url = postUrl(slug);

  persist({ files: { [paths.job]: jobJson(job, { status: 'rendering', runUrl, error: undefined }) } }, `Render video: ${slug}`);

  try {
    const out = await renderVideo(parsed, {
      essayTitle,
      url,
      voice: opts.voice || 'af_heart',
      speed: Number(opts.speed) || 1,
      outDir: path.join(PATHS.out, slug),
      log: (m) => console.log(`[${slug}] ${m}`),
    });
    summary(`- \`${slug}\`: rendered ${Math.round(out.duration)} s of video with ${out.engine}`);

    const missing = missingSecrets('youtube');
    if (DRY_RUN || missing.length) {
      const reason = DRY_RUN ? 'Dry run: not uploaded.' : `Rendered, but not uploaded: missing ${missing.join(', ')}. Download the video from the workflow run.`;
      persist({ files: { [paths.job]: jobJson(job, { status: 'failed', error: reason, runUrl }) } }, `Video not uploaded: ${slug}`);
      summary(`  - ${reason}`);
      return;
    }

    const chapters = chapterLines(out.chapters, out.duration);
    const description = [
      parsed.meta.description,
      `Read the essay: ${url}`,
      chapters,
      opts.declareSynthetic !== false ? 'Narrated with a synthetic voice (Kokoro text to speech).' : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const up = await uploadVideo({
      file: out.video,
      title: parsed.meta.title || essayTitle,
      description,
      tags: parsed.meta.tags,
      categoryId: opts.categoryId || '27',
      privacy: opts.privacy || 'private',
      declareSynthetic: opts.declareSynthetic !== false,
    });
    const warnings = [];
    for (const [what, fn] of [
      ['thumbnail', () => setThumbnail(up.token, up.id, out.thumbnail)],
      ['captions', () => uploadCaptions(up.token, up.id, out.captions)],
      ...(opts.playlistId ? [['playlist', () => addToPlaylist(up.token, opts.playlistId, up.id)]] : []),
    ]) {
      try {
        await fn();
      } catch (e) {
        warnings.push(`${what}: ${e.message}`);
      }
    }

    persist(
      {
        ledger: [setLedgerEntry(slug, 'youtube', { id: up.id, url: up.url, privacy: up.privacy, at: new Date().toISOString(), error: undefined, skipped: undefined, removed: undefined })],
        files: { [paths.job]: jobJson(job, { status: 'done', youtubeId: up.id, youtubeUrl: up.url, warnings: warnings.length ? warnings : undefined, error: undefined, runUrl }) },
      },
      `Video uploaded: ${slug}`
    );
    summary(`  - uploaded as ${up.privacy}: ${up.url}`);
    for (const w of warnings) summary(`  - warning: ${w}`);
  } catch (e) {
    persist({ files: { [paths.job]: jobJson(job, { status: 'failed', error: String(e.message ?? e).slice(0, 300), runUrl }) } }, `Video failed: ${slug}`);
    throw e;
  }
}

async function main() {
  const settings = loadSettings();
  const site = siteInfo();
  const only = (process.env.INPUT_SLUG || process.argv[2] || '').trim();
  const slugs = only ? [only] : listJobs().filter((j) => j.job?.status === 'approved').map((j) => j.slug);
  summary(`## Video render${DRY_RUN ? ' (dry run)' : ''}\n`);
  if (!slugs.length) {
    summary('No approved video jobs.');
    return;
  }
  let failed = 0;
  for (const slug of slugs) {
    try {
      await renderOne(slug, settings, site);
    } catch (e) {
      failed++;
      console.error(e);
      summary(`- \`${slug}\`: **failed**: ${e.message}`);
    }
  }
  if (failed) process.exitCode = 1;
}

main();
