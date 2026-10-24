// Reading and writing the ledger (src/data/syndication.json) and video jobs.
// In GitHub Actions, changes are committed and pushed straight away; locally they are
// only written to disk, never committed.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PATHS, REPO_ROOT, DRY_RUN } from './config.mjs';

const BRANCH = process.env.TARGET_BRANCH ?? 'main';
const IN_CI = process.env.GITHUB_ACTIONS === 'true';

export function readLedger() {
  try {
    const l = JSON.parse(fs.readFileSync(PATHS.ledger, 'utf8'));
    l.posts ??= {};
    return l;
  } catch {
    return { posts: {} };
  }
}

export function readJob(slug) {
  const dir = path.join(PATHS.jobs, slug);
  const jobFile = path.join(dir, 'job.json');
  const scriptFile = path.join(dir, 'script.md');
  return {
    job: fs.existsSync(jobFile) ? JSON.parse(fs.readFileSync(jobFile, 'utf8')) : null,
    script: fs.existsSync(scriptFile) ? fs.readFileSync(scriptFile, 'utf8') : null,
  };
}

export function listJobs() {
  if (!fs.existsSync(PATHS.jobs)) return [];
  return fs
    .readdirSync(PATHS.jobs, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({ slug: d.name, ...readJob(d.name) }));
}

export function jobPaths(slug) {
  return {
    job: path.relative(REPO_ROOT, path.join(PATHS.jobs, slug, 'job.json')),
    script: path.relative(REPO_ROOT, path.join(PATHS.jobs, slug, 'script.md')),
  };
}

function git(...args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function apply(change) {
  if (change.ledger?.length) {
    const ledger = readLedger();
    for (const op of change.ledger) op(ledger);
    fs.writeFileSync(PATHS.ledger, JSON.stringify(ledger, null, 2) + '\n');
  }
  for (const [rel, content] of Object.entries(change.files ?? {})) {
    const abs = path.join(REPO_ROOT, rel);
    if (content === null) fs.rmSync(abs, { force: true });
    else {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
    }
  }
}

/**
 * Apply ledger operations and file writes, then commit and push (CI only).
 * On a push race, re-fetches the branch and re-applies the same operations.
 * @param {{ ledger?: ((l:any)=>void)[], files?: Record<string,string|null> }} change
 */
export function persist(change, message) {
  if (!IN_CI || DRY_RUN) {
    apply(change);
    return false;
  }
  for (let attempt = 1; attempt <= 5; attempt++) {
    git('fetch', '--quiet', 'origin', BRANCH);
    git('reset', '--quiet', '--hard', `origin/${BRANCH}`);
    apply(change);
    git('add', '-A', '--', path.relative(REPO_ROOT, PATHS.ledger), path.relative(REPO_ROOT, PATHS.jobs));
    const staged = git('diff', '--cached', '--name-only');
    if (!staged) return false;
    git('-c', 'user.name=blog-pipeline[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com', 'commit', '--quiet', '-m', message);
    try {
      git('push', '--quiet', 'origin', `HEAD:${BRANCH}`);
      return true;
    } catch (e) {
      console.warn(`Push attempt ${attempt} failed, retrying: ${String(e.stderr ?? e).trim()}`);
    }
  }
  throw new Error('Could not push pipeline results after 5 attempts.');
}

export function setLedgerEntry(slug, platform, entry, { merge = true } = {}) {
  return (ledger) => {
    ledger.posts[slug] ??= {};
    ledger.posts[slug][platform] = merge ? { ...(ledger.posts[slug][platform] ?? {}), ...entry } : entry;
    for (const [k, v] of Object.entries(ledger.posts[slug][platform])) if (v === undefined) delete ledger.posts[slug][platform][k];
  };
}

/** Append a line to the GitHub Actions run summary, and to the console. */
export function summary(markdown) {
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n');
}
