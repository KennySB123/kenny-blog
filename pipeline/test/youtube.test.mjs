import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { uploadVideo, uploadCaptions } from '../src/video/youtube.mjs';
import { mockFetch } from './helpers.mjs';

process.env.YOUTUBE_CLIENT_ID = 'cid';
process.env.YOUTUBE_CLIENT_SECRET = 'cs';
process.env.YOUTUBE_REFRESH_TOKEN = 'rt';

test('resumable upload: refresh token, start session, send bytes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-'));
  const file = path.join(dir, 'v.mp4');
  fs.writeFileSync(file, Buffer.alloc(1234));
  const calls = mockFetch((url, init) => {
    if (url.includes('oauth2.googleapis.com')) return { access_token: 'at' };
    if (url.includes('uploadType=resumable')) return new Response('', { status: 200, headers: { location: 'https://upload.example/session1' } });
    if (url === 'https://upload.example/session1') return { id: 'vid123', status: { privacyStatus: 'private' } };
    throw new Error('unexpected ' + url);
  });
  const res = await uploadVideo({ file, title: 'A <title>', description: 'Desc', tags: ['a', 'b'], privacy: 'public', declareSynthetic: true });
  calls.restore();
  assert.equal(res.id, 'vid123');
  assert.equal(res.privacy, 'private', 'reports what YouTube actually set');
  assert.equal(calls[0].init.body.get('grant_type'), 'refresh_token');
  const meta = calls[1].body;
  assert.equal(meta.snippet.title, 'A title');
  assert.equal(meta.status.privacyStatus, 'public');
  assert.equal(meta.status.containsSyntheticMedia, true);
  assert.equal(meta.status.selfDeclaredMadeForKids, false);
  assert.equal(calls[1].init.headers['X-Upload-Content-Length'], '1234');
  assert.equal(calls[2].init.method, 'PUT');
});

test('captions go up as multipart/related', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-'));
  const srt = path.join(dir, 'c.srt');
  fs.writeFileSync(srt, '1\n00:00:00,000 --> 00:00:01,000\nHi\n');
  const calls = mockFetch(() => ({ id: 'cap' }));
  await uploadCaptions('at', 'vid123', srt);
  calls.restore();
  assert.match(calls[0].init.headers['Content-Type'], /^multipart\/related; boundary=/);
  const body = calls[0].init.body.toString();
  assert.match(body, /"videoId":"vid123"/);
  assert.match(body, /00:00:00,000 --> 00:00:01,000/);
});
