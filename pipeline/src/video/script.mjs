// Turn an essay into a narration script.
// "adapted": Claude rewrites it for the ear (needs ANTHROPIC_API_KEY).
// "verbatim": the essay is read as written; no API key needed.
import Anthropic from '@anthropic-ai/sdk';
import { essaySegments } from '../lib/markdown.mjs';
import { serializeScript } from './scriptfile.mjs';

export const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['youtubeTitle', 'youtubeDescription', 'tags', 'thumbnailText', 'segments'],
  properties: {
    youtubeTitle: { type: 'string' },
    youtubeDescription: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    thumbnailText: { type: 'string' },
    segments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'text'],
        properties: {
          kind: { type: 'string', enum: ['chapter', 'paragraph', 'quote'] },
          text: { type: 'string' },
        },
      },
    },
  },
};

const SYSTEM = `You adapt personal essays into narration scripts for read-along YouTube videos.

How the video works: a synthetic voice reads the script aloud while the same words appear on screen, one paragraph per screen, with the current sentence highlighted. Chapter segments become full-screen title cards and are read aloud. Quote segments become full-screen pull-quote cards and are read aloud. There is no other footage, so the words carry everything.

Your job is to make the essay work for a listener while keeping it unmistakably the author's piece.

Keep:
- The author's argument, structure, examples, voice and tone. A reader of the essay should recognise every point.
- The author's own phrasing wherever it already reads well aloud.

Change only what the ear needs:
- Split long sentences. Each paragraph segment is one screen, so keep it to one to four sentences and under about 60 words.
- Write numbers, symbols, units, dates and abbreviations the way they are spoken, for example "five pounds" rather than "£5", "twenty twenty-six" rather than "2026".
- Spell out names the voice might misread, or rephrase around them.
- Drop footnote markers, URLs, image references and code. If code or a table matters to the argument, say in one plain sentence what it shows.

Shape:
- Start with one or two paragraph segments that pose the essay's central question or tension, in the author's voice. Do not say "in this video" or greet the viewer.
- Use one chapter segment per major section of the essay, with a heading of six words or fewer. Short essays may have none.
- Use at most three quote segments, each an exact line from the essay that stands on its own.
- End with a short closing paragraph that lands the essay's point. Do not ask viewers to like, subscribe or comment.
- Aim for about the same length as the essay. Never more than ten percent longer.

Never add facts, claims, opinions, jokes or examples that are not in the essay.

Metadata:
- youtubeTitle: under 90 characters, honest, specific, no clickbait, no ALL CAPS, no angle brackets.
- youtubeDescription: two to four sentences in plain text that say what the essay argues. No links, hashtags or timestamps; those are added later.
- tags: five to twelve short search terms.
- thumbnailText: two to five punchy words drawn from the essay's idea.`;

function userPrompt(post, opts, siteName) {
  const notes = String(opts.notes ?? '').trim();
  return [
    `Essay title: ${post.data.title}`,
    `Essay description: ${post.data.description}`,
    `Tags: ${post.data.tags.join(', ') || 'none'}`,
    `Published on: ${siteName}`,
    notes ? `Notes from the author for this script:\n${notes}` : null,
    '',
    '<essay>',
    post.body.trim(),
    '</essay>',
  ]
    .filter((l) => l !== null)
    .join('\n');
}

function validate(out) {
  if (!out || typeof out !== 'object') throw new Error('Claude returned no script.');
  const segments = (out.segments ?? []).filter((s) => s && typeof s.text === 'string' && s.text.trim() && ['chapter', 'paragraph', 'quote'].includes(s.kind));
  if (segments.filter((s) => s.kind === 'paragraph').length === 0) throw new Error('The script has no spoken paragraphs.');
  return {
    meta: {
      title: String(out.youtubeTitle ?? '').replace(/[<>]/g, '').slice(0, 100).trim(),
      description: String(out.youtubeDescription ?? '').replace(/[<>]/g, '').trim(),
      tags: (out.tags ?? []).map(String).filter(Boolean).slice(0, 15),
      thumbnailText: String(out.thumbnailText ?? '').trim(),
    },
    segments: segments.map((s) => ({ kind: s.kind, text: s.text.replace(/\s+/g, ' ').trim() })),
  };
}

async function adapted(post, opts, siteName) {
  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: 'user', content: userPrompt(post, opts, siteName) }],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') {
    throw new Error(`Claude declined to adapt this essay${message.stop_details?.explanation ? `: ${message.stop_details.explanation}` : ''}. Try the verbatim script style.`);
  }
  if (message.stop_reason === 'max_tokens') throw new Error('The script was cut off (too long). Try the verbatim script style.');
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Claude returned a script that was not valid JSON.');
  }
  return validate(parsed);
}

function verbatim(post) {
  return {
    meta: { title: post.data.title.slice(0, 100), description: post.data.description, tags: post.data.tags, thumbnailText: post.data.title.split(/\s+/).slice(0, 5).join(' ') },
    segments: essaySegments(post.body),
  };
}

/** Returns { text: script.md contents, style, model? } */
export async function writeScript(post, opts, siteName) {
  const wantAdapted = (opts.scriptStyle ?? 'adapted') === 'adapted';
  if (wantAdapted && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it as a GitHub secret, or switch the script style to verbatim.');
  }
  const { meta, segments } = wantAdapted ? await adapted(post, opts, siteName) : verbatim(post);
  return { text: serializeScript(meta, segments), style: wantAdapted ? 'adapted' : 'verbatim', model: wantAdapted ? MODEL : undefined };
}
