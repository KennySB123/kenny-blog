// Helpers for platforms with no posting API (Medium, Substack): build what you
// need to paste, copy it, and record the address once you've posted it.
import { marked } from 'marked';
import { updateJson } from './github';
import { PATHS } from './config';
import { store } from './state';
import type { Platform } from './platforms';

export function essayUrl(slug: string) {
  return `${location.origin}/blog/${slug}/`;
}

/** Root-relative links and images → absolute, so they work on the other site. */
function absolutize(md: string) {
  const o = location.origin;
  return md
    .replace(/(\]\()\/(?!\/)/g, `$1${o}/`)
    .replace(/(\b(?:src|href)=["'])\/(?!\/)/g, `$1${o}/`);
}

export function essayHtml(slug: string): { title: string; subtitle: string; html: string; text: string } | null {
  const post = store.posts.get(slug);
  if (!post) return null;
  const url = essayUrl(slug);
  const md = absolutize(post.body.trim());
  const footer = `\n\n---\n\n*Originally published at [${location.host}](${url}).*\n`;
  const html = (marked.parse(md + footer, { gfm: true, async: false }) as string).replace(/<script[\s\S]*?<\/script>/gi, '');
  return { title: post.data.title, subtitle: post.data.description, html, text: md + footer };
}

/** Copy rich text (with a plain-text fallback). Returns false if the browser refused. */
export async function copyRich(html: string, text: string): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) }),
      ]);
      return true;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function substackEditorUrl(publication: unknown): string | null {
  const host = String(publication ?? '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  return host ? `https://${host}/publish/post?type=newsletter` : null;
}

export const MEDIUM_IMPORT_URL = 'https://medium.com/p/import';

/** Record (or clear) the address of a manual cross-post in the ledger. */
export async function markPosted(slug: string, platform: Platform, url: string | null) {
  const now = new Date().toISOString();
  await updateJson<any>(
    PATHS.ledger,
    (l) => {
      l.posts ??= {};
      l.posts[slug] ??= {};
      if (url) l.posts[slug][platform] = { url, at: now, manual: true };
      else delete l.posts[slug][platform];
    },
    url ? `Posted on ${platform}: ${slug}` : `Clear ${platform} link: ${slug}`,
    { posts: {} }
  );
  store.ledger.posts[slug] ??= {};
  if (url) store.ledger.posts[slug]![platform] = { url, at: now };
  else delete store.ledger.posts[slug]![platform];
}
