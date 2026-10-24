// Text to speech with Kokoro (open-weight, runs on the CPU, free).
// TTS_ENGINE=silent produces timed silence instead, for testing without the model.
import path from 'node:path';
import { PIPELINE_ROOT } from '../lib/config.mjs';

export const SAMPLE_RATE = 24000;

/** Kokoro handles a few hundred characters per call; split long sentences at punctuation. */
export function chunkForSpeech(text, max = 280) {
  if (text.length <= max) return [text];
  const parts = [];
  let rest = text;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    const cut = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '), window.lastIndexOf(': '), window.lastIndexOf(' – '), window.lastIndexOf(' — '));
    const at = cut > max * 0.4 ? cut + 1 : window.lastIndexOf(' ');
    parts.push(rest.slice(0, at > 0 ? at : max).trim());
    rest = rest.slice(at > 0 ? at : max).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

export async function createTTS({ engine = process.env.TTS_ENGINE || 'kokoro', voice = 'af_heart', speed = 1 } = {}) {
  if (engine === 'silent') {
    return {
      engine,
      async speak(text) {
        const words = text.split(/\s+/).filter(Boolean).length;
        return new Float32Array(Math.round(Math.max(0.5, words / (2.6 * speed)) * SAMPLE_RATE));
      },
    };
  }

  const { env } = await import('@huggingface/transformers');
  env.cacheDir = process.env.HF_CACHE_DIR || path.join(PIPELINE_ROOT, '.cache', 'huggingface');
  const { KokoroTTS } = await import('kokoro-js');
  const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: process.env.KOKORO_DTYPE || 'q8', device: 'cpu' });
  return {
    engine,
    async speak(text) {
      const pieces = [];
      for (const part of chunkForSpeech(text)) {
        const audio = await tts.generate(part, { voice, speed });
        if (audio.sampling_rate !== SAMPLE_RATE) throw new Error(`Unexpected sample rate ${audio.sampling_rate}`);
        pieces.push(audio.audio);
      }
      return concat(pieces, Math.round(0.08 * SAMPLE_RATE));
    },
  };
}

export function silence(seconds) {
  return new Float32Array(Math.round(seconds * SAMPLE_RATE));
}

export function concat(chunks, gap = 0) {
  const total = chunks.reduce((n, c) => n + c.length, 0) + gap * Math.max(0, chunks.length - 1);
  const out = new Float32Array(total);
  let o = 0;
  chunks.forEach((c, i) => {
    out.set(c, o);
    o += c.length + (i < chunks.length - 1 ? gap : 0);
  });
  return out;
}

/** 16-bit mono PCM WAV. */
export function encodeWav(samples, sampleRate = SAMPLE_RATE) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), 44 + i * 2);
  }
  return buf;
}
