import { loadSnapshot, type Snapshot } from './github';
import { parsePost, type PostData } from './frontmatter';
import type { DistributionSettings, Platform } from './platforms';
import { PATHS } from './config';

export interface Post {
  slug: string;
  path: string;
  sha: string;
  source: string;
  data: PostData;
  body: string;
}

export interface LedgerEntry {
  id?: string | number;
  url?: string;
  at?: string;
  error?: string;
  errorAt?: string;
  removed?: boolean;
  privacy?: string;
  showOnSite?: boolean;
  skipped?: string;
}

export type Ledger = { posts: Record<string, Partial<Record<Platform, LedgerEntry>>> };

export interface VideoJob {
  status: 'generating' | 'review' | 'approved' | 'rendering' | 'done' | 'failed' | 'cancelled';
  error?: string;
  updatedAt?: string;
  youtubeId?: string;
  youtubeUrl?: string;
  runUrl?: string;
  [k: string]: unknown;
}

export interface Job {
  slug: string;
  job: VideoJob | null;
  script: string | null;
  scriptSha: string | null;
}

export const DEFAULT_SETTINGS: DistributionSettings = {
  trigger: 'on-publish',
  updateMirrorsOnEdit: true,
  platforms: {
    devto: { enabled: true },
    hashnode: { enabled: true },
    bluesky: { enabled: true },
    mastodon: { enabled: true },
    youtube: { enabled: true },
  },
};

export const store = {
  loaded: false,
  head: '',
  posts: new Map<string, Post>(),
  settings: DEFAULT_SETTINGS as DistributionSettings,
  ledger: { posts: {} } as Ledger,
  jobs: new Map<string, Job>(),
};

export function slugFromPath(path: string) {
  return path.slice(PATHS.posts.length + 1).replace(/\.mdx?$/, '');
}

export async function refresh(): Promise<void> {
  const snap: Snapshot = await loadSnapshot();
  store.head = snap.head;
  store.posts = new Map(
    snap.posts.map((f) => {
      const { data, body } = parsePost(f.text);
      const slug = slugFromPath(f.path);
      return [slug, { slug, path: f.path, sha: f.sha, source: f.text, data, body }];
    })
  );
  store.settings = snap.settings ? mergeSettings(JSON.parse(snap.settings.text)) : DEFAULT_SETTINGS;
  store.ledger = snap.ledger ? JSON.parse(snap.ledger.text) : { posts: {} };
  store.ledger.posts ??= {};
  store.jobs = new Map(
    Object.entries(snap.jobs).map(([slug, j]) => {
      let job: VideoJob | null = null;
      try {
        job = j.job ? JSON.parse(j.job.text) : null;
      } catch {}
      return [slug, { slug, job, script: j.script?.text ?? null, scriptSha: j.script?.sha ?? null }];
    })
  );
  store.loaded = true;
}

function mergeSettings(s: Partial<DistributionSettings>): DistributionSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    platforms: { ...DEFAULT_SETTINGS.platforms, ...(s.platforms ?? {}) } as DistributionSettings['platforms'],
  };
}

export function sortedPosts(): Post[] {
  return [...store.posts.values()].sort((a, b) => (b.data.pubDate || '').localeCompare(a.data.pubDate || '') || a.data.title.localeCompare(b.data.title));
}
