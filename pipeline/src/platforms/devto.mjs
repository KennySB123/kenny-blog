// DEV (dev.to): full mirror with canonical_url pointing home.
// API docs: https://developers.forem.com/api/v1
import { http } from './http.mjs';
import { absolutize, absoluteUrl } from '../lib/markdown.mjs';

const API = 'https://dev.to/api';

function headers() {
  return { 'api-key': process.env.DEVTO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/vnd.forem.api-v1+json' };
}

/** DEV allows at most 4 tags, lowercase letters and numbers only. */
export function devtoTags(tags) {
  return [...new Set(tags.map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean))].slice(0, 4);
}

export function devtoArticle(post, opts, ctx) {
  const footer = `\n\n---\n\n*Originally published at [${ctx.site.host}](${ctx.url}).*\n`;
  return {
    article: {
      title: post.data.title,
      body_markdown: absolutize(post.body, ctx.site.url).trim() + footer,
      published: opts.publishAs !== 'draft',
      description: post.data.description || undefined,
      tags: devtoTags(post.data.tags),
      canonical_url: ctx.url,
      main_image: absoluteUrl(post.data.heroImage, ctx.site.url),
      series: opts.series || undefined,
    },
  };
}

export async function publish(post, opts, ctx) {
  const res = await http(`${API}/articles`, { method: 'POST', headers: headers(), body: JSON.stringify(devtoArticle(post, opts, ctx)) }, 'DEV publish');
  return { id: res.id, url: res.url, draft: opts.publishAs === 'draft' || undefined };
}

export async function update(post, opts, ctx, existing) {
  const body = devtoArticle(post, opts, ctx);
  // Never flip a published DEV article back to draft by accident.
  if (!existing.draft) delete body.article.published;
  const res = await http(`${API}/articles/${existing.id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }, 'DEV update');
  return { id: res.id, url: res.url };
}

/** DEV has no delete endpoint, so removing means unpublishing. */
export async function remove(existing) {
  await http(`${API}/articles/${existing.id}`, { method: 'PUT', headers: headers(), body: JSON.stringify({ article: { published: false } }) }, 'DEV unpublish');
  return { note: 'Unpublished on DEV (DEV has no delete API).' };
}
