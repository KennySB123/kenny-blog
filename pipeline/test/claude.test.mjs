// Checks the request we send to the Claude API and how the streamed reply is parsed,
// using a fake streaming response (no network, no API key needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeScript, MODEL } from '../src/video/script.mjs';
import { parseScript } from '../src/video/scriptfile.mjs';
import { fakePost, mockFetch } from './helpers.mjs';

function sse(message, text) {
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  const body =
    ev('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: MODEL, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } }) +
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }) +
    ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text } }) +
    ev('content_block_stop', { index: 0 }) +
    ev('message_delta', { delta: { stop_reason: message.stop_reason, stop_sequence: null, ...(message.stop_details ? { stop_details: message.stop_details } : {}) }, usage: { output_tokens: 50 } }) +
    ev('message_stop', {});
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

const reply = {
  youtubeTitle: 'Why walking slowly <works>',
  youtubeDescription: 'An essay about slowness.',
  tags: ['walking', 'attention'],
  thumbnailText: 'Slow down',
  segments: [
    { kind: 'paragraph', text: 'What do you miss when you rush?' },
    { kind: 'chapter', text: 'Why' },
    { kind: 'paragraph', text: 'Because you notice things.' },
  ],
};

test('adapted script: request shape and parsed result', async () => {
  process.env.ANTHROPIC_API_KEY = 'sk-test';
  const calls = mockFetch(() => sse({ stop_reason: 'end_turn' }, JSON.stringify(reply)));
  const out = await writeScript(fakePost(), { scriptStyle: 'adapted', notes: 'Say "Kenny" as KEN-ee.' }, "Kenny's Blog");
  calls.restore();

  const req = calls[0];
  assert.match(req.url, /\/v1\/messages/);
  assert.equal(req.body.model, 'claude-opus-5-5');
  assert.equal(req.body.stream, true);
  assert.equal(req.body.fallbacks, 'default');
  assert.equal(req.body.output_config.format.type, 'json_schema');
  assert.equal(req.body.output_config.effort, 'high');
  assert.equal('thinking' in req.body, false);
  assert.match(req.init.headers['anthropic-beta'] ?? req.init.headers.get?.('anthropic-beta') ?? '', /server-side-fallback-2026-07-01/);
  assert.match(req.body.messages[0].content, /<essay>[\s\S]*Walking slowly is underrated[\s\S]*<\/essay>/);
  assert.match(req.body.messages[0].content, /KEN-ee/);

  const parsed = parseScript(out.text);
  assert.equal(out.style, 'adapted');
  assert.equal(parsed.meta.title, 'Why walking slowly works');
  assert.deepEqual(parsed.segments.map((s) => s.kind), ['paragraph', 'chapter', 'paragraph']);
});

test('refusal becomes a clear error', async () => {
  const calls = mockFetch(() => sse({ stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: 'nope' } }, ''));
  await assert.rejects(writeScript(fakePost(), { scriptStyle: 'adapted' }, 'B'), /declined/);
  calls.restore();
});

test('verbatim needs no API key', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const out = await writeScript(fakePost(), { scriptStyle: 'verbatim' }, 'B');
  assert.equal(out.style, 'verbatim');
  assert.match(out.text, /# Why/);
  await assert.rejects(writeScript(fakePost(), { scriptStyle: 'adapted' }, 'B'), /ANTHROPIC_API_KEY/);
});
