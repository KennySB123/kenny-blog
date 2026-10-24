// Hashnode: full mirror via the GraphQL API, with originalArticleURL as canonical.
// API docs: https://apidocs.hashnode.com
import { http } from './http.mjs';
import { absolutize, absoluteUrl } from '../lib/markdown.mjs';

const API = 'https://gql.hashnode.com';

async function gql(query, variables, label) {
  const res = await http(
    API,
    { method: 'POST', headers: { Authorization: process.env.HASHNODE_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) },
    label
  );
  if (res?.errors?.length) throw new Error(`${label} failed: ${res.errors.map((e) => e.message).join('; ')}`);
  return res.data;
}

export function hashnodeTags(tags) {
  return tags
    .map((t) => ({ slug: t.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''), name: t }))
    .filter((t) => t.slug)
    .slice(0, 5);
}

function input(post, ctx) {
  const footer = `\n\n---\n\n*Originally published at [${ctx.site.host}](${ctx.url}).*\n`;
  return {
    title: post.data.title,
    subtitle: post.data.description ? post.data.description.slice(0, 250) : undefined,
    contentMarkdown: absolutize(post.body, ctx.site.url).trim() + footer,
    originalArticleURL: ctx.url,
    tags: hashnodeTags(post.data.tags),
    ...(post.data.heroImage ? { coverImageOptions: { coverImageURL: absoluteUrl(post.data.heroImage, ctx.site.url) } } : {}),
  };
}

export async function publish(post, opts, ctx) {
  const publicationId = process.env.HASHNODE_PUBLICATION_ID;
  if (opts.publishAs === 'draft') {
    const data = await gql(
      `mutation CreateDraft($input: CreateDraftInput!) { createDraft(input: $input) { draft { id slug } } }`,
      { input: { ...input(post, ctx), publicationId } },
      'Hashnode draft'
    );
    const id = data.createDraft.draft.id;
    return { id, url: `https://hashnode.com/draft/${id}`, draft: true };
  }
  const data = await gql(
    `mutation PublishPost($input: PublishPostInput!) { publishPost(input: $input) { post { id url } } }`,
    { input: { ...input(post, ctx), publicationId } },
    'Hashnode publish'
  );
  return { id: data.publishPost.post.id, url: data.publishPost.post.url };
}

export async function update(post, opts, ctx, existing) {
  if (existing.draft) return { ...existing, note: 'Hashnode drafts are edited on Hashnode.' };
  const data = await gql(
    `mutation UpdatePost($input: UpdatePostInput!) { updatePost(input: $input) { post { id url } } }`,
    { input: { id: existing.id, ...input(post, ctx) } },
    'Hashnode update'
  );
  return { id: data.updatePost.post.id, url: data.updatePost.post.url };
}

export async function remove(existing) {
  if (existing.draft) return { note: 'Draft left on Hashnode; delete it there.' };
  await gql(`mutation RemovePost($input: RemovePostInput!) { removePost(input: $input) { post { id } } }`, { input: { id: existing.id } }, 'Hashnode remove');
  return {};
}
