// Local version history for essays, kept in the browser's IndexedDB.
// Snapshots are taken while you type, and on every save, discard, restore and delete,
// so any earlier state of an essay can be brought back, even after it was deleted.
import type { PostData } from './frontmatter';

export interface Version {
  id?: number;
  /** Post slug, or "__new__" for an essay that has not been saved yet. */
  key: string;
  title: string;
  body: string;
  data: PostData;
  at: number;
  reason: VersionReason;
  words: number;
}

export type VersionReason = 'typing' | 'opened' | 'saved' | 'published' | 'closed' | 'discarded' | 'before-restore' | 'deleted' | 'recovered';

export const REASON_TEXT: Record<VersionReason, string> = {
  typing: 'While writing',
  opened: 'Version on GitHub when opened',
  saved: 'Saved',
  published: 'Published',
  closed: 'Left the editor',
  discarded: 'Discarded changes',
  'before-restore': 'Before a restore',
  deleted: 'Before deleting',
  recovered: 'Recovered',
};

const DB_NAME = 'studio-backup';
const MAX_TYPING_VERSIONS = 300;
let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      const versions = d.createObjectStore('versions', { keyPath: 'id', autoIncrement: true });
      versions.createIndex('key', 'key');
      d.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name: 'versions' | 'kv', mode: IDBTransactionMode = 'readonly') {
  return (await db()).transaction(name, mode).objectStore(name);
}

const countWords = (s: string) => (s.match(/[\p{L}\p{N}’']+/gu) ?? []).length;
const sameContent = (a: Pick<Version, 'title' | 'body' | 'data'>, b: Pick<Version, 'title' | 'body' | 'data'>) =>
  a.title === b.title && a.body === b.body && JSON.stringify(a.data) === JSON.stringify(b.data);

/** All versions for one essay, newest first. */
export async function listVersions(key: string): Promise<Version[]> {
  const all = await done((await store('versions')).index('key').getAll(key));
  return (all as Version[]).sort((a, b) => b.at - a.at);
}

/**
 * Save a snapshot. Skips it when nothing changed since the last one,
 * unless the reason is a milestone (saved, published, deleted…).
 * Returns true when a new version was written.
 */
export async function snapshot(key: string, content: { title: string; body: string; data: PostData }, reason: VersionReason): Promise<boolean> {
  if (!content.title.trim() && !content.body.trim()) return false;
  const versions = await listVersions(key);
  const last = versions[0];
  const milestone = reason !== 'typing' && reason !== 'closed' && reason !== 'opened';
  if (last && sameContent(last, content) && (!milestone || last.reason === reason)) return false;

  const v: Version = {
    key,
    title: content.title,
    body: content.body,
    data: JSON.parse(JSON.stringify(content.data)),
    at: Date.now(),
    reason,
    words: countWords(content.body),
  };
  await done((await store('versions', 'readwrite')).add(v));

  // Prune old typing snapshots; milestones are kept.
  const typing = versions.filter((x) => x.reason === 'typing' || x.reason === 'closed');
  if (typing.length >= MAX_TYPING_VERSIONS) {
    const s = await store('versions', 'readwrite');
    for (const old of typing.slice(MAX_TYPING_VERSIONS - 1)) s.delete(old.id!);
  }
  return true;
}

/** Move the history of an unsaved essay to its slug after the first save. */
export async function rekey(from: string, to: string) {
  const versions = await listVersions(from);
  const s = await store('versions', 'readwrite');
  for (const v of versions) s.put({ ...v, key: to });
}

export interface BackupSummary {
  key: string;
  title: string;
  count: number;
  latest: number;
}

/** One line per essay that has local history (including deleted essays). */
export async function summaries(): Promise<BackupSummary[]> {
  const all = (await done((await store('versions')).getAll())) as Version[];
  const map = new Map<string, BackupSummary>();
  for (const v of all) {
    const s = map.get(v.key);
    if (!s) map.set(v.key, { key: v.key, title: v.title, count: 1, latest: v.at });
    else {
      s.count++;
      if (v.at > s.latest) {
        s.latest = v.at;
        s.title = v.title;
      }
    }
  }
  return [...map.values()].sort((a, b) => b.latest - a.latest);
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return done((await store('kv')).get(key)) as Promise<T | undefined>;
}

export async function kvSet(key: string, value: unknown) {
  await done((await store('kv', 'readwrite')).put(value, key));
}

export async function kvDelete(key: string) {
  await done((await store('kv', 'readwrite')).delete(key));
}

/** Ask the browser not to clear our storage when space runs low. */
export async function persistStorage(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function isPersisted(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}

/** Offer a .md file for download. */
export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function stamp(at: number) {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}
