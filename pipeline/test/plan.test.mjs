import test from 'node:test';
import assert from 'node:assert/strict';
import { plan } from '../src/plan.mjs';
import { contentHash } from '../src/lib/posts.mjs';
import { fakePost } from './helpers.mjs';

const settings = (over = {}) => ({
  trigger: 'on-publish',
  updateMirrorsOnEdit: true,
  platforms: { devto: { enabled: true }, hashnode: { enabled: true }, bluesky: { enabled: true }, mastodon: { enabled: true }, x: { enabled: true }, youtube: { enabled: true } },
  ...over,
});
const noJob = () => ({ job: null });
const ops = (r) => r.tasks.map((t) => `${t.platform}:${t.op}`).sort();

test('new published post goes everywhere that is on', () => {
  const r = plan({ event: 'push', changed: [{ slug: 'on-walking' }], settings: settings(), ledger: { posts: {} }, readPost: () => fakePost(), readJob: noJob });
  assert.deepEqual(ops(r), ['bluesky:publish', 'devto:publish', 'hashnode:publish', 'mastodon:publish', 'x:publish', 'youtube:script']);
});

test('drafts are skipped', () => {
  const r = plan({ event: 'push', changed: [{ slug: 'on-walking' }], settings: settings(), ledger: { posts: {} }, readPost: () => fakePost({ draft: true }), readJob: noJob });
  assert.equal(r.tasks.length, 0);
});

test('per-post override switches a platform off', () => {
  const post = fakePost({ distribute: { mastodon: { enabled: false }, x: { enabled: false }, youtube: { enabled: false } } });
  const r = plan({ event: 'push', changed: [{ slug: 'on-walking' }], settings: settings(), ledger: { posts: {} }, readPost: () => post, readJob: noJob });
  assert.deepEqual(ops(r), ['bluesky:publish', 'devto:publish', 'hashnode:publish']);
});

test('edits update mirrors only when content changed, never re-announce', () => {
  const post = fakePost();
  const ledger = { posts: { 'on-walking': { devto: { id: 1, hash: 'old' }, hashnode: { id: 'h', hash: contentHash(post) }, bluesky: { id: 'at://x' }, mastodon: { id: '9' }, x: { id: '1' }, youtube: { id: 'yt' } } } };
  const r = plan({ event: 'push', changed: [{ slug: 'on-walking' }], settings: settings(), ledger, readPost: () => post, readJob: noJob });
  assert.deepEqual(ops(r), ['devto:update']);
});

test('updateMirrorsOnEdit=false leaves mirrors alone on push', () => {
  const ledger = { posts: { 'on-walking': { devto: { id: 1, hash: 'old' } } } };
  const r = plan({ event: 'push', changed: [{ slug: 'on-walking' }], settings: settings({ updateMirrorsOnEdit: false }), ledger, readPost: () => fakePost(), readJob: noJob });
  assert.ok(!ops(r).includes('devto:update'));
});

test('manual trigger: push does nothing new, dispatch sends it', () => {
  const s = settings({ trigger: 'manual' });
  const push = plan({ event: 'push', changed: [{ slug: 'on-walking' }], settings: s, ledger: { posts: {} }, readPost: () => fakePost(), readJob: noJob });
  assert.equal(push.tasks.length, 0);
  const dispatch = plan({ event: 'dispatch', input: { slug: 'on-walking', action: 'distribute', platforms: [] }, settings: s, ledger: { posts: {} }, readPost: () => fakePost(), readJob: noJob });
  assert.equal(dispatch.tasks.length, 6);
});

test('dispatch with platforms retries just those', () => {
  const ledger = { posts: { 'on-walking': { bluesky: { error: 'bad password' } } } };
  const r = plan({ event: 'dispatch', input: { slug: 'on-walking', action: 'distribute', platforms: ['bluesky'] }, settings: settings(), ledger, readPost: () => fakePost(), readJob: noJob });
  assert.deepEqual(ops(r), ['bluesky:publish']);
});

test('existing video job is not replaced by distribute', () => {
  const r = plan({ event: 'push', changed: [{ slug: 'on-walking' }], settings: settings(), ledger: { posts: {} }, readPost: () => fakePost(), readJob: () => ({ job: { status: 'review' } }) });
  assert.ok(!ops(r).includes('youtube:script'));
});

test('remove only touches live copies', () => {
  const ledger = { posts: { 'on-walking': { devto: { id: 1 }, mastodon: { id: '2', removed: true } } } };
  const r = plan({ event: 'dispatch', input: { slug: 'on-walking', action: 'remove', platforms: ['devto', 'mastodon'] }, settings: settings(), ledger, readPost: () => null, readJob: noJob });
  assert.deepEqual(ops(r), ['devto:remove']);
});

test('deleted files in a push are ignored', () => {
  const r = plan({ event: 'push', changed: [{ slug: 'gone', deleted: true }], settings: settings(), ledger: { posts: {} }, readPost: () => null, readJob: noJob });
  assert.equal(r.tasks.length, 0);
});

test('autoSince protects older essays from automatic sends', () => {
  const s = settings({ autoSince: '2026-10-24' });
  const old = fakePost({ pubDate: '2026-07-19' });
  const push = plan({ event: 'push', changed: [{ slug: 'on-walking' }], settings: s, ledger: { posts: {} }, readPost: () => old, readJob: noJob });
  assert.equal(push.tasks.length, 0);
  const fresh = plan({ event: 'push', changed: [{ slug: 'on-walking' }], settings: s, ledger: { posts: {} }, readPost: () => fakePost({ pubDate: '2026-10-25' }), readJob: noJob });
  assert.equal(fresh.tasks.length, 6);
  const manual = plan({ event: 'dispatch', input: { slug: 'on-walking', action: 'distribute', platforms: [] }, settings: s, ledger: { posts: {} }, readPost: () => old, readJob: noJob });
  assert.equal(manual.tasks.length, 6);
});
