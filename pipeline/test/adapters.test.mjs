import test from 'node:test';
import assert from 'node:assert/strict';
import * as devto from '../src/platforms/devto.mjs';
import * as hashnode from '../src/platforms/hashnode.mjs';
import * as mastodon from '../src/platforms/mastodon.mjs';
import { fakePost, ctx, mockFetch } from './helpers.mjs';

process.env.DEVTO_API_KEY = 'dk';
process.env.HASHNODE_TOKEN = 'hk';
process.env.HASHNODE_PUBLICATION_ID = 'pub1';
process.env.MASTODON_INSTANCE = 'mastodon.social';
process.env.MASTODON_TOKEN = 'mk';

test('DEV publish sends canonical URL, absolute images, max 4 tags', async () => {
  const calls = mockFetch(() => ({ id: 42, url: 'https://dev.to/k/on-walking' }));
  const res = await devto.publish(fakePost({ heroImage: '/images/hero.jpg' }), { publishAs: 'published', series: '' }, ctx);
  calls.restore();
  assert.deepEqual(res, { id: 42, url: 'https://dev.to/k/on-walking', draft: undefined });
  const a = calls[0].body.article;
  assert.equal(calls[0].init.headers['api-key'], 'dk');
  assert.equal(a.canonical_url, ctx.url);
  assert.equal(a.main_image, 'https://blog.example/images/hero.jpg');
  assert.ok(a.body_markdown.includes('](https://blog.example/images/street.jpg)'));
  assert.ok(a.body_markdown.includes('Originally published at [blog.example]'));
  assert.deepEqual(a.tags, ['essays', 'slowliving']);
  assert.equal(a.published, true);
});

test('DEV update keeps published state and errors are readable', async () => {
  let calls = mockFetch(() => ({ id: 42, url: 'u' }));
  await devto.update(fakePost(), { publishAs: 'draft' }, ctx, { id: 42 });
  calls.restore();
  assert.equal(calls[0].init.method, 'PUT');
  assert.equal('published' in calls[0].body.article, false);
  calls = mockFetch(() => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }));
  await assert.rejects(devto.publish(fakePost(), {}, ctx), /DEV publish failed \(401\): unauthorized/);
  calls.restore();
});

test('Hashnode publish uses originalArticleURL and surfaces GraphQL errors', async () => {
  let calls = mockFetch(() => ({ data: { publishPost: { post: { id: 'p1', url: 'https://k.hashnode.dev/on-walking' } } } }));
  const res = await hashnode.publish(fakePost(), { publishAs: 'published' }, ctx);
  calls.restore();
  assert.equal(res.url, 'https://k.hashnode.dev/on-walking');
  const v = calls[0].body.variables.input;
  assert.equal(v.publicationId, 'pub1');
  assert.equal(v.originalArticleURL, ctx.url);
  assert.deepEqual(v.tags, [{ slug: 'essays', name: 'essays' }, { slug: 'slow-living', name: 'slow-living' }]);
  assert.equal(calls[0].init.headers.Authorization, 'hk');
  calls = mockFetch(() => ({ errors: [{ message: 'Invalid tag' }] }));
  await assert.rejects(hashnode.publish(fakePost(), {}, ctx), /Invalid tag/);
  calls.restore();
});

test('Mastodon posts with visibility and idempotency key', async () => {
  const calls = mockFetch(() => ({ id: '77', url: 'https://mastodon.social/@k/77' }));
  const res = await mastodon.publish(fakePost(), { template: '{title} {url}', visibility: 'unlisted' }, ctx);
  calls.restore();
  assert.equal(res.id, '77');
  assert.equal(calls[0].url, 'https://mastodon.social/api/v1/statuses');
  assert.equal(calls[0].body.visibility, 'unlisted');
  assert.equal(calls[0].init.headers['Idempotency-Key'], 'blog-on-walking');
});
