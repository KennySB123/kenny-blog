import test from 'node:test';
import assert from 'node:assert/strict';
import { oauthHeader, xText, xLength, publish, remove } from '../src/platforms/x.mjs';
import { fakePost, ctx, mockFetch } from './helpers.mjs';

test('OAuth 1.0a signature matches the example in X documentation', () => {
  const header = oauthHeader({
    method: 'POST',
    url: 'https://api.twitter.com/1.1/statuses/update.json',
    params: { include_entities: 'true', status: 'Hello Ladies + Gentlemen, a signed OAuth request!' },
    consumerKey: 'xvz1evFS4wEEPTGEFPHBog',
    consumerSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw',
    token: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
    tokenSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE',
    nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg',
    timestamp: 1318622958,
  });
  assert.match(header, /oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"/);
});

test('post text fits 280 and can drop the link', () => {
  const long = fakePost({ description: 'many words '.repeat(60) });
  const t = xText(long, { template: '{title}\n\n{description}\n\n{url}\n\n{tags}' }, ctx);
  assert.ok(xLength(t) <= 280);
  assert.ok(t.includes(ctx.url));
  const noLink = xText(fakePost(), { includeLink: false }, ctx);
  assert.ok(!noLink.includes('http'));
});

test('publish and delete call the v2 endpoints with OAuth', async () => {
  Object.assign(process.env, { X_API_KEY: 'k', X_API_SECRET: 's', X_ACCESS_TOKEN: 't', X_ACCESS_TOKEN_SECRET: 'ts' });
  let calls = mockFetch(() => ({ data: { id: '1850000000000000000', text: 'x' } }));
  const res = await publish(fakePost(), {}, ctx);
  calls.restore();
  assert.deepEqual(res, { id: '1850000000000000000', url: 'https://x.com/i/web/status/1850000000000000000' });
  assert.equal(calls[0].url, 'https://api.x.com/2/tweets');
  assert.match(calls[0].init.headers.Authorization, /^OAuth oauth_consumer_key="k"/);
  assert.ok(calls[0].body.text.includes(ctx.url));
  calls = mockFetch(() => ({ data: { deleted: true } }));
  await remove({ id: '1850000000000000000' });
  calls.restore();
  assert.equal(calls[0].init.method, 'DELETE');
  assert.equal(calls[0].url, 'https://api.x.com/2/tweets/1850000000000000000');
});
