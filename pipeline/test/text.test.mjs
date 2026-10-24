import test from 'node:test';
import assert from 'node:assert/strict';
import { absolutize, essaySegments, sentences, hashtag, fillTemplate } from '../src/lib/markdown.mjs';
import { serializeScript, parseScript } from '../src/video/scriptfile.mjs';
import { paginate, planShots, chapterLines } from '../src/video/compose.mjs';
import { chunkForSpeech, encodeWav } from '../src/video/tts.mjs';
import { blueskyText } from '../src/platforms/bluesky.mjs';
import { mastodonText, mastodonLength } from '../src/platforms/mastodon.mjs';
import { devtoTags } from '../src/platforms/devto.mjs';
import { cleanText, cleanTags } from '../src/video/youtube.mjs';
import { fakePost, ctx } from './helpers.mjs';

test('absolutize rewrites root-relative links and images only', () => {
  const md = '![a](/images/x.jpg) [b](/blog/y/) [c](https://other.com/z) <img src="/images/q.png"> [d](//cdn.x/y)';
  assert.equal(absolutize(md, 'https://s.dev'), '![a](https://s.dev/images/x.jpg) [b](https://s.dev/blog/y/) [c](https://other.com/z) <img src="https://s.dev/images/q.png"> [d](//cdn.x/y)');
});

test('essaySegments keeps prose, drops code and images', () => {
  const segs = essaySegments('Intro **bold** [link](/x).\n\n```js\ncode()\n```\n\n![img](/a.png)\n\n## Part two\n\n> A quote\n\n- one\n- two\n\nEnd.[^1]\n\n[^1]: A footnote.');
  assert.deepEqual(segs, [
    { kind: 'paragraph', text: 'Intro bold link.' },
    { kind: 'chapter', text: 'Part two' },
    { kind: 'quote', text: 'A quote' },
    { kind: 'paragraph', text: 'one' },
    { kind: 'paragraph', text: 'two' },
    { kind: 'paragraph', text: 'End.' },
  ]);
});

test('sentences splits on sentence boundaries', () => {
  assert.deepEqual(sentences('One. Two? Three!'), ['One.', 'Two?', 'Three!']);
});

test('hashtags and templates', () => {
  assert.equal(hashtag('slow-living'), '#slowliving');
  assert.equal(fillTemplate('{title}\n\n\n\n{nope}', { title: 'T' }), 'T\n\n{nope}');
});

test('script file round-trips', () => {
  const meta = { title: 'T', description: 'Line one.\nLine two.', tags: ['a', 'b'], thumbnailText: 'Big idea' };
  const segs = [{ kind: 'paragraph', text: 'Hello there.' }, { kind: 'chapter', text: 'Part' }, { kind: 'quote', text: 'Quote me.' }];
  const parsed = parseScript(serializeScript(meta, segs));
  assert.deepEqual(parsed.meta, meta);
  assert.deepEqual(parsed.segments, segs);
});

test('pagination and shot plan', () => {
  assert.deepEqual(paginate(['a'.repeat(200), 'b'.repeat(200), 'c'], 330), [['a'.repeat(200)], ['b'.repeat(200), 'c']]);
  const shots = planShots({ meta: {}, segments: [{ kind: 'chapter', text: 'Start' }, { kind: 'paragraph', text: 'One. Two.' }, { kind: 'quote', text: 'Q.' }] }, { essayTitle: 'E', url: 'u' });
  assert.deepEqual(shots.map((s) => s.card), ['title', 'chapter', 'read', 'read', 'quote', 'end']);
  assert.equal(shots[3].data.active, 1);
});

test('chapters need 3+ and 10 s each', () => {
  assert.equal(chapterLines([{ title: 'Intro', start: 0 }, { title: 'A', start: 20 }], 60), '');
  assert.equal(chapterLines([{ title: 'Intro', start: 0 }, { title: 'A', start: 20 }, { title: 'B', start: 75 }], 100), '0:00 Intro\n0:20 A\n1:15 B');
});

test('long sentences are chunked for speech', () => {
  const s = Array.from({ length: 30 }, (_, i) => `clause number ${i}`).join(', ') + '.';
  const parts = chunkForSpeech(s, 120);
  assert.ok(parts.every((p) => p.length <= 120));
  assert.equal(parts.join(' ').replace(/\s+/g, ' '), s);
});

test('wav header is valid', () => {
  const wav = encodeWav(new Float32Array(2400));
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.length, 44 + 4800);
});

test('bluesky text fits 300 graphemes', () => {
  const post = fakePost({ description: 'word '.repeat(120).trim() });
  const text = blueskyText(post, { template: '{title}\n\n{description}\n\n{tags}' }, ctx);
  assert.ok([...new Intl.Segmenter().segment(text)].length <= 300);
  assert.ok(text.startsWith('On Walking'));
  assert.ok(text.endsWith('#essays #slowliving'));
});

test('mastodon text fits 500 and always has the link', () => {
  const post = fakePost({ description: 'long '.repeat(200) });
  const text = mastodonText(post, { template: '{title}\n\n{description}' }, ctx);
  assert.ok(mastodonLength(text) <= 500 + 25);
  assert.ok(text.includes(ctx.url));
});

test('platform tag and text cleaning', () => {
  assert.deepEqual(devtoTags(['Slow-Living', 'essays', 'a', 'b', 'c']), ['slowliving', 'essays', 'a', 'b']);
  assert.equal(cleanText('a <b> c', 100), 'a b c');
  assert.ok(Buffer.byteLength(cleanText('é'.repeat(100), 50)) <= 50);
  assert.ok(cleanTags(Array.from({ length: 100 }, (_, i) => `tag number ${i}`)).join(',').length < 500);
});
