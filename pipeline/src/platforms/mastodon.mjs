// Mastodon: one announcement toot. Mastodon builds the link card from the page's
// Open Graph tags.
import { http } from './http.mjs';
import { fillTemplate, hashtag } from '../lib/markdown.mjs';

const LIMIT = 500;
const URL_COST = 23; // Mastodon counts every link as 23 characters

function instance() {
  const raw = process.env.MASTODON_INSTANCE || '';
  return (raw.startsWith('http') ? raw : `https://${raw}`).replace(/\/+$/, '');
}

export function mastodonLength(text) {
  return [...text.replace(/https?:\/\/\S+/g, 'x'.repeat(URL_COST))].length;
}

export function mastodonText(post, opts, ctx) {
  const template = opts.template || '{title}\n\n{description}\n\n{url}';
  const vars = (description) => ({
    title: post.data.title,
    description,
    url: ctx.url,
    tags: post.data.tags.map(hashtag).filter(Boolean).join(' '),
  });
  let desc = post.data.description;
  let text = fillTemplate(template, vars(desc));
  while (mastodonLength(text) > LIMIT && desc.length > 0) {
    desc = desc.slice(0, Math.max(0, desc.length - 30)).replace(/\s+\S*$/, '') + '…';
    if (desc === '…') desc = '';
    text = fillTemplate(template, vars(desc));
  }
  if (!template.includes('{url}')) text += `\n\n${ctx.url}`;
  return text;
}

export async function publish(post, opts, ctx) {
  const res = await http(
    `${instance()}/api/v1/statuses`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MASTODON_TOKEN}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `blog-${post.slug}`,
      },
      body: JSON.stringify({ status: mastodonText(post, opts, ctx), visibility: opts.visibility || 'public', language: 'en' }),
    },
    'Mastodon post'
  );
  return { id: res.id, url: res.url };
}

export async function remove(existing) {
  await http(`${instance()}/api/v1/statuses/${existing.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${process.env.MASTODON_TOKEN}` } }, 'Mastodon delete');
  return {};
}
