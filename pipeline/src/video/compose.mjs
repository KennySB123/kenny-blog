// Script → narrated read-along video.
// 1. Plan "shots": a title card, chapter cards, one read-along shot per sentence,
//    quote cards and an end card.
// 2. Speak each shot with the TTS engine; the audio length sets the shot length.
// 3. Draw each shot as a PNG, then let ffmpeg join stills + audio into an MP4.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { sentences } from '../lib/markdown.mjs';
import { createTTS, silence, concat, encodeWav, SAMPLE_RATE } from './tts.mjs';
import { renderPng, titleCard, chapterCard, readCard, quoteCard, endCard, thumbnailCard } from '../card.mjs';

const PAUSE = { title: 0.9, chapter: 0.8, sentence: 0.22, paragraph: 0.55, quote: 0.9, end: 4 };
const PAGE_CHARS = 330;

/** Group a paragraph's sentences into screen-sized pages. */
export function paginate(list, max = PAGE_CHARS) {
  const pages = [];
  let page = [];
  let len = 0;
  for (const s of list) {
    if (page.length && len + s.length > max) {
      pages.push(page);
      page = [];
      len = 0;
    }
    page.push(s);
    len += s.length + 1;
  }
  if (page.length) pages.push(page);
  return pages;
}

export function planShots({ meta, segments }, { essayTitle, url }) {
  const shots = [{ card: 'title', speak: essayTitle, pause: PAUSE.title, data: { title: essayTitle, subtitle: '' } }];
  let chapter = 0;
  for (const seg of segments) {
    if (seg.kind === 'chapter') {
      chapter++;
      shots.push({ card: 'chapter', speak: seg.text, pause: PAUSE.chapter, data: { heading: seg.text, number: chapter }, chapter: seg.text });
    } else if (seg.kind === 'quote') {
      shots.push({ card: 'quote', speak: seg.text, pause: PAUSE.quote, data: { text: seg.text } });
    } else {
      const pages = paginate(sentences(seg.text));
      pages.forEach((page, pi) =>
        page.forEach((s, si) => {
          const lastOfParagraph = pi === pages.length - 1 && si === page.length - 1;
          shots.push({ card: 'read', speak: s, pause: lastOfParagraph ? PAUSE.paragraph : PAUSE.sentence, data: { sentences: page, active: si } });
        })
      );
    }
  }
  shots.push({ card: 'end', speak: null, pause: PAUSE.end, data: { url } });
  for (const s of shots) s.essayTitle = essayTitle;
  void meta;
  return shots;
}

const CARDS = { title: titleCard, chapter: chapterCard, read: readCard, quote: quoteCard, end: endCard };

function srtTime(t) {
  const ms = Math.round(t * 1000);
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}

function clock(t) {
  const s = Math.floor(t);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Render the video. Returns paths and the chapter list for the description.
 * @param {{meta:any, segments:any[]}} script
 */
export async function renderVideo(script, { essayTitle, url, voice, speed, outDir, log = console.log }) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'frames'), { recursive: true });

  const shots = planShots(script, { essayTitle, url });
  log(`Planned ${shots.length} shots. Loading voice "${voice}"…`);
  const tts = await createTTS({ voice, speed });

  const audio = [];
  let t = 0;
  for (const [i, shot] of shots.entries()) {
    const speech = shot.speak ? await tts.speak(shot.speak) : new Float32Array(0);
    const clip = concat([speech, silence(shot.pause)]);
    shot.start = t;
    shot.speechEnd = t + speech.length / SAMPLE_RATE;
    shot.duration = clip.length / SAMPLE_RATE;
    t += shot.duration;
    audio.push(clip);
    if ((i + 1) % 25 === 0) log(`  spoke ${i + 1}/${shots.length}`);
  }
  const total = t;
  fs.writeFileSync(path.join(outDir, 'audio.wav'), encodeWav(concat(audio)));
  log(`Narration: ${clock(total)}. Drawing frames…`);

  const list = [];
  for (const [i, shot] of shots.entries()) {
    const file = path.join(outDir, 'frames', `${String(i).padStart(4, '0')}.png`);
    const progress = shot.card === 'title' ? 0 : shot.card === 'end' ? 1 : shot.start / total;
    fs.writeFileSync(file, await renderPng(CARDS[shot.card]({ ...shot.data, progress, essayTitle }), 1920, 1080));
    list.push(`file '${file}'`, `duration ${shot.duration.toFixed(3)}`);
  }
  // The concat demuxer ignores the last duration unless the last file is repeated.
  list.push(`file '${path.join(outDir, 'frames', `${String(shots.length - 1).padStart(4, '0')}.png`)}'`);
  fs.writeFileSync(path.join(outDir, 'frames.txt'), list.join('\n') + '\n');

  const video = path.join(outDir, 'video.mp4');
  log('Encoding with ffmpeg…');
  execFileSync(
    'ffmpeg',
    ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(outDir, 'frames.txt'), '-i', path.join(outDir, 'audio.wav'),
      '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-tune', 'stillimage', '-crf', '20',
      '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', video],
    { stdio: 'inherit' }
  );

  // Captions, one cue per spoken shot.
  const cues = shots.filter((s) => s.speak);
  const srt = cues.map((s, i) => `${i + 1}\n${srtTime(s.start)} --> ${srtTime(s.speechEnd)}\n${s.speak}\n`).join('\n');
  fs.writeFileSync(path.join(outDir, 'captions.srt'), srt);

  const thumbText = script.meta.thumbnailText || essayTitle;
  fs.writeFileSync(path.join(outDir, 'thumbnail.png'), await renderPng(thumbnailCard({ text: thumbText }), 1280, 720));

  const chapters = [{ title: 'Introduction', start: 0 }, ...shots.filter((s) => s.card === 'chapter').map((s) => ({ title: s.chapter, start: s.start }))];

  return {
    video,
    captions: path.join(outDir, 'captions.srt'),
    thumbnail: path.join(outDir, 'thumbnail.png'),
    duration: total,
    chapters,
    engine: tts.engine,
  };
}

/** YouTube shows chapters only with 3+ entries, the first at 0:00, each at least 10 s long. */
export function chapterLines(chapters, total) {
  const ok = chapters.filter((c, i) => (chapters[i + 1]?.start ?? total) - c.start >= 10);
  if (ok.length < 3 || ok[0].start !== 0) return '';
  return ok.map((c) => `${clock(c.start)} ${c.title}`).join('\n');
}
