// Bluesky: one announcement post with a link card (title, description, image).
import { AtpAgent, RichText } from '@atproto/api';
import { fillTemplate, hashtag } from '../lib/markdown.mjs';
import { renderPng, linkCard } from '../card.mjs';

const LIMIT = 300;

async function agent() {
  const a = new AtpAgent({ service: process.env.BLUESKY_SERVICE || 'https://bsky.social' });
  await a.login({ identifier: process.env.BLUESKY_HANDLE, password: process.env.BLUESKY_APP_PASSWORD });
  return a;
}

/** Fill the template and trim the description until it fits in 300 graphemes. */
export function blueskyText(post, opts, ctx) {
  const vars = (description) => ({
    title: post.data.title,
    description,
    url: ctx.url,
    tags: post.data.tags.map(hashtag).filter(Boolean).join(' '),
  });
  const template = opts.template || '{title}\n\n{description}';
  let desc = post.data.description;
  let text = fillTemplate(template, vars(desc));
  while (new RichText({ text }).graphemeLength > LIMIT && desc.length > 0) {
    desc = desc.slice(0, Math.max(0, desc.length - 20)).replace(/\s+\S*$/, '') + '…';
    if (desc === '…') desc = '';
    text = fillTemplate(template, vars(desc));
  }
  if (new RichText({ text }).graphemeLength > LIMIT) text = [...text].slice(0, LIMIT - 1).join('') + '…';
  return text;
}

export async function publish(post, opts, ctx) {
  const a = await agent();
  const rt = new RichText({ text: blueskyText(post, opts, ctx) });
  await rt.detectFacets(a);
  const png = await renderPng(linkCard({ title: post.data.title, description: post.data.description }), 1200, 630);
  const { data: blob } = await a.uploadBlob(png, { encoding: 'image/png' });
  const res = await a.post({
    text: rt.text,
    facets: rt.facets,
    langs: ['en'],
    embed: {
      $type: 'app.bsky.embed.external',
      external: { uri: ctx.url, title: post.data.title, description: post.data.description, thumb: blob.blob },
    },
    createdAt: new Date().toISOString(),
  });
  const rkey = res.uri.split('/').pop();
  return { id: res.uri, url: `https://bsky.app/profile/${a.session?.handle ?? process.env.BLUESKY_HANDLE}/post/${rkey}` };
}

export async function remove(existing) {
  const a = await agent();
  await a.deletePost(existing.id);
  return {};
}
