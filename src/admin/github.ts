// Minimal GitHub client for the studio. Every write is a real commit on the
// branch, so Cloudflare Pages rebuilds and the pipeline workflows run.
import { OWNER, NAME, BRANCH, PATHS, WORKFLOWS } from './config';

const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let token = '';
export function setToken(t: string) {
  token = t;
}

async function request<T = any>(path: string, init: { method?: string; body?: unknown; accept?: string } = {}): Promise<T> {
  const res = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: init.accept ?? 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = data.message || message;
    } catch {}
    throw new GitHubError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  const type = res.headers.get('content-type') || '';
  return (type.includes('json') ? res.json() : res.text()) as Promise<T>;
}

const repo = `/repos/${OWNER}/${NAME}`;

export interface Viewer {
  login: string;
  avatar_url: string;
  name: string | null;
}

export async function getViewer(): Promise<Viewer> {
  return request('/user');
}

/** True when the token can push to the repo. */
export async function canPush(): Promise<boolean> {
  const r = await request<{ permissions?: { push?: boolean } }>(repo);
  return r.permissions?.push !== false;
}

export interface RepoFile {
  path: string;
  sha: string;
  text: string;
}

export interface Snapshot {
  head: string;
  posts: RepoFile[];
  settings: RepoFile | null;
  ledger: RepoFile | null;
  jobs: Record<string, { job?: RepoFile; script?: RepoFile }>;
}

/** Load every post, the settings, the ledger and video jobs in one request. */
export async function loadSnapshot(): Promise<Snapshot> {
  const query = `query($owner:String!,$name:String!,$ref:String!,$posts:String!,$settings:String!,$ledger:String!,$jobs:String!){
    repository(owner:$owner,name:$name){
      ref(qualifiedName:$ref){ target { oid } }
      posts: object(expression:$posts){ ... on Tree { entries { name type object { ... on Blob { oid text } } } } }
      settings: object(expression:$settings){ ... on Blob { oid text } }
      ledger: object(expression:$ledger){ ... on Blob { oid text } }
      jobs: object(expression:$jobs){ ... on Tree { entries { name type object { ... on Tree { entries { name object { ... on Blob { oid text } } } } } } } }
    }
  }`;
  const at = (p: string) => `${BRANCH}:${p}`;
  const data = await request<any>('/graphql', {
    method: 'POST',
    body: {
      query,
      variables: {
        owner: OWNER,
        name: NAME,
        ref: `refs/heads/${BRANCH}`,
        posts: at(PATHS.posts),
        settings: at(PATHS.settings),
        ledger: at(PATHS.ledger),
        jobs: at(PATHS.jobs),
      },
    },
  });
  if (data.errors?.length) throw new GitHubError(400, data.errors[0].message);
  const r = data.data.repository;
  const blob = (path: string, o: any): RepoFile | null => (o && typeof o.text === 'string' ? { path, sha: o.oid, text: o.text } : null);

  const posts: RepoFile[] = (r.posts?.entries ?? [])
    .filter((e: any) => e.type === 'blob' && /\.mdx?$/.test(e.name))
    .map((e: any) => blob(`${PATHS.posts}/${e.name}`, e.object))
    .filter(Boolean);

  const jobs: Snapshot['jobs'] = {};
  for (const dir of r.jobs?.entries ?? []) {
    if (dir.type !== 'tree') continue;
    const files: Record<string, RepoFile | undefined> = {};
    for (const f of dir.object?.entries ?? []) {
      const file = blob(`${PATHS.jobs}/${dir.name}/${f.name}`, f.object);
      if (file) files[f.name] = file;
    }
    jobs[dir.name] = { job: files['job.json'], script: files['script.md'] };
  }

  return {
    head: r.ref?.target?.oid ?? '',
    posts,
    settings: blob(PATHS.settings, r.settings),
    ledger: blob(PATHS.ledger, r.ledger),
    jobs,
  };
}

/** Current text of a file on the branch, or null if it doesn't exist. */
export async function readFile(path: string, ref = BRANCH): Promise<string | null> {
  try {
    return await request<string>(`${repo}/contents/${encodePath(path)}?ref=${ref}`, { accept: 'application/vnd.github.raw+json' });
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}

/** Blob sha of a file on the branch, or null. */
export async function fileSha(path: string): Promise<string | null> {
  try {
    const r = await request<{ sha: string }>(`${repo}/contents/${encodePath(path)}?ref=${BRANCH}`);
    return r.sha;
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}

export type Change =
  | { path: string; text: string }
  | { path: string; base64: string }
  | { path: string; delete: true }
  /** Read-modify-write against the latest commit; return null to skip. */
  | { path: string; update: (current: string | null) => string | null };

/**
 * Commit several file changes as one commit on the branch.
 * Retries when someone else (the pipeline) pushed in between.
 */
export async function commit(changes: Change[], message: string): Promise<string> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const ref = await request<{ object: { sha: string } }>(`${repo}/git/ref/heads/${BRANCH}`);
    const parent = ref.object.sha;
    const parentCommit = await request<{ tree: { sha: string } }>(`${repo}/git/commits/${parent}`);

    const tree: any[] = [];
    for (const c of changes) {
      if ('text' in c) {
        tree.push({ path: c.path, mode: '100644', type: 'blob', content: c.text });
      } else if ('base64' in c) {
        const blob = await request<{ sha: string }>(`${repo}/git/blobs`, {
          method: 'POST',
          body: { content: c.base64, encoding: 'base64' },
        });
        tree.push({ path: c.path, mode: '100644', type: 'blob', sha: blob.sha });
      } else if ('delete' in c) {
        tree.push({ path: c.path, mode: '100644', type: 'blob', sha: null });
      } else {
        const next = c.update(await readFile(c.path, parent));
        if (next !== null) tree.push({ path: c.path, mode: '100644', type: 'blob', content: next });
      }
    }
    if (tree.length === 0) return parent;

    const newTree = await request<{ sha: string }>(`${repo}/git/trees`, {
      method: 'POST',
      body: { base_tree: parentCommit.tree.sha, tree },
    });
    const newCommit = await request<{ sha: string }>(`${repo}/git/commits`, {
      method: 'POST',
      body: { message, tree: newTree.sha, parents: [parent] },
    });
    try {
      await request(`${repo}/git/refs/heads/${BRANCH}`, {
        method: 'PATCH',
        body: { sha: newCommit.sha, force: false },
      });
      return newCommit.sha;
    } catch (e) {
      // 422 = not a fast-forward: the branch moved. Rebuild on the new head.
      if (e instanceof GitHubError && e.status === 422 && attempt < 3) continue;
      throw e;
    }
  }
  throw new GitHubError(409, 'The branch kept moving. Try again in a moment.');
}

/** Read-modify-write a JSON file in one commit. */
export function updateJson<T>(path: string, mutate: (data: T) => T | void, message: string, fallback: T) {
  return commit(
    [
      {
        path,
        update: (current) => {
          const data = current ? (JSON.parse(current) as T) : structuredClone(fallback);
          const result = mutate(data) ?? data;
          return JSON.stringify(result, null, 2) + '\n';
        },
      },
    ],
    message
  );
}

/** Start the distribute workflow for one post. */
export async function dispatchDistribute(inputs: { slug: string; action: 'distribute' | 'remove' | 'regenerate-script'; platforms?: string }) {
  await request(`${repo}/actions/workflows/${WORKFLOWS.distribute}/dispatches`, {
    method: 'POST',
    body: { ref: BRANCH, inputs: { slug: inputs.slug, action: inputs.action, platforms: inputs.platforms ?? '' } },
  });
}

export interface Run {
  id: number;
  name: string;
  display_title: string;
  event: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export async function listRuns(): Promise<Run[]> {
  const r = await request<{ workflow_runs: Run[] }>(`${repo}/actions/runs?per_page=25`);
  return r.workflow_runs;
}

/** Names of the repo's Actions secrets, or null if the token can't see them. */
export async function listSecretNames(): Promise<string[] | null> {
  try {
    const r = await request<{ secrets: { name: string }[] }>(`${repo}/actions/secrets?per_page=100`);
    return r.secrets.map((s) => s.name);
  } catch {
    return null;
  }
}

function encodePath(p: string) {
  return p.split('/').map(encodeURIComponent).join('/');
}

/** Git blob sha of a UTF-8 string (lets us track file versions without a refetch). */
export async function blobSha(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const all = new Uint8Array(header.length + bytes.length);
  all.set(header);
  all.set(bytes, header.length);
  const digest = await crypto.subtle.digest('SHA-1', all);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
