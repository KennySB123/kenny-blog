// Paths, site facts and settings. The site's own files are the source of truth:
// SITE_URL comes from astro.config.mjs, the title from src/consts.ts, colours from global.css.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = process.env.REPO_ROOT ?? path.resolve(here, '../../..');
export const PIPELINE_ROOT = path.resolve(here, '../..');

export const PATHS = {
  posts: path.join(REPO_ROOT, 'src/content/blog'),
  settings: path.join(REPO_ROOT, 'src/data/distribution.json'),
  ledger: path.join(REPO_ROOT, 'src/data/syndication.json'),
  jobs: path.join(REPO_ROOT, 'pipeline/jobs'),
  css: path.join(REPO_ROOT, 'src/styles/global.css'),
  out: path.join(PIPELINE_ROOT, 'out'),
};

export const PLATFORMS = ['devto', 'hashnode', 'bluesky', 'mastodon', 'x', 'youtube'];
export const MIRRORS = ['devto', 'hashnode'];
export const ANNOUNCERS = ['bluesky', 'mastodon', 'x'];

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

export function siteInfo() {
  const astro = read(path.join(REPO_ROOT, 'astro.config.mjs'));
  const consts = read(path.join(REPO_ROOT, 'src/consts.ts'));
  const url = (process.env.SITE_URL ?? astro.match(/SITE_URL\s*=\s*['"]([^'"]+)['"]/)?.[1] ?? '').replace(/\/+$/, '');
  const pick = (key) => consts.match(new RegExp(`${key}:\\s*(["'\`])(.*?)\\1`))?.[2];
  return {
    url,
    host: url.replace(/^https?:\/\//, ''),
    title: pick('title') ?? 'Blog',
    author: pick('author') ?? '',
  };
}

export function postUrl(slug) {
  return `${siteInfo().url}/blog/${slug}/`;
}

/** Light-theme colour tokens from global.css, so videos and cards match the site. */
export function themeTokens() {
  const css = read(PATHS.css);
  const root = css.match(/:root\s*{([\s\S]*?)}/)?.[1] ?? '';
  const tokens = {};
  for (const m of root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})/g)) tokens[m[1]] = m[2];
  return {
    bg: tokens.bg ?? '#FFFBF3',
    raised: tokens['bg-raised'] ?? '#FFFFFF',
    sunken: tokens['bg-sunken'] ?? '#F6EFE3',
    text: tokens.text ?? '#241D18',
    muted: tokens['text-muted'] ?? '#6B5D51',
    border: tokens.border ?? '#E4D8C6',
    accent: tokens.accent ?? '#E1552F',
    accentSoft: tokens['accent-soft'] ?? '#FDE3D9',
    mint: tokens.mint ?? '#1E8F72',
    sun: tokens.sun ?? '#F5B72E',
    sunSoft: tokens['sun-soft'] ?? '#FDEFCD',
  };
}

export function loadSettings() {
  const s = JSON.parse(read(PATHS.settings));
  return { trigger: 'on-publish', updateMirrorsOnEdit: true, ...s, platforms: { ...s.platforms } };
}

/** Global defaults for one platform, overlaid with the post's own `distribute` overrides. */
export function effectiveOptions(settings, post, platform) {
  return { enabled: true, ...(settings.platforms?.[platform] ?? {}), ...(post?.data?.distribute?.[platform] ?? {}) };
}

/** Secrets each platform needs, read from the environment (GitHub Actions secrets). */
export const SECRETS = {
  devto: ['DEVTO_API_KEY'],
  hashnode: ['HASHNODE_TOKEN', 'HASHNODE_PUBLICATION_ID'],
  bluesky: ['BLUESKY_HANDLE', 'BLUESKY_APP_PASSWORD'],
  mastodon: ['MASTODON_INSTANCE', 'MASTODON_TOKEN'],
  x: ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'],
  youtube: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'],
  claude: ['ANTHROPIC_API_KEY'],
};

export function missingSecrets(key) {
  return (SECRETS[key] ?? []).filter((name) => !process.env[name]);
}

export const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
