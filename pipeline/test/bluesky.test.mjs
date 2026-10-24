import test from 'node:test';
import assert from 'node:assert/strict';
import * as bluesky from '../src/platforms/bluesky.mjs';
import { fakePost, ctx, mockFetch } from './helpers.mjs';

process.env.BLUESKY_HANDLE = 'kenny.bsky.social';
process.env.BLUESKY_APP_PASSWORD = 'app-pass';

test('Bluesky: login, upload card image, post with link card', async () => {
  const calls = mockFetch((url, init) => {
    if (url.includes('com.atproto.server.createSession'))
      return { did: 'did:plc:abc', handle: 'kenny.bsky.social', accessJwt: 'a', refreshJwt: 'r', active: true };
    if (url.includes('com.atproto.repo.uploadBlob'))
      return { blob: { $type: 'blob', ref: { $link: 'bafkreibme22gw2h7y2h7tg2fhqotaqjucnbc24deqo72b6mkl2egezxhvy' }, mimeType: 'image/png', size: 1000 } };
    if (url.includes('com.atproto.repo.createRecord')) return { uri: 'at://did:plc:abc/app.bsky.feed.post/3kxyz', cid: 'bafyreie5737gdxlw5i64vzichcalba3z2v5n6icifvx5xytvske7mr3hpm' };
    throw new Error('unexpected ' + url);
  });
  const res = await bluesky.publish(fakePost(), { template: '{title}\n\n{description}\n\n{tags}' }, ctx);
  calls.restore();
  assert.equal(res.id, 'at://did:plc:abc/app.bsky.feed.post/3kxyz');
  assert.equal(res.url, 'https://bsky.app/profile/kenny.bsky.social/post/3kxyz');
  const record = calls.find((c) => c.url.includes('createRecord')).body.record;
  assert.equal(record.embed.external.uri, ctx.url);
  assert.equal(record.embed.external.title, 'On Walking');
  assert.ok(record.text.includes('#slowliving'));
  assert.ok(record.facets.some((f) => f.features[0].$type === 'app.bsky.richtext.facet#tag'));
  const upload = calls.find((c) => c.url.includes('uploadBlob'));
  assert.ok(upload.init.body.length > 1000, 'card PNG was uploaded');
});
