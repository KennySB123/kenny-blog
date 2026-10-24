// Image cards drawn with satori (HTML/CSS-like layout → SVG) and resvg (SVG → PNG).
// Used for video frames, the YouTube thumbnail and the Bluesky link card.
// Colours and fonts match the site: tokens come from src/styles/global.css.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { themeTokens, siteInfo } from './lib/config.mjs';

const require = createRequire(import.meta.url);
const font = (pkg, file) => fs.readFileSync(require.resolve(`@fontsource/${pkg}/files/${file}`));

let fontsCache;
function fonts() {
  fontsCache ??= [
    { name: 'Fraunces', data: font('fraunces', 'fraunces-latin-600-normal.woff'), weight: 600, style: 'normal' },
    { name: 'Fraunces', data: font('fraunces', 'fraunces-latin-800-normal.woff'), weight: 800, style: 'normal' },
    { name: 'Fraunces', data: font('fraunces', 'fraunces-latin-600-italic.woff'), weight: 600, style: 'italic' },
    { name: 'Nunito', data: font('nunito', 'nunito-latin-600-normal.woff'), weight: 600, style: 'normal' },
    { name: 'Nunito', data: font('nunito', 'nunito-latin-800-normal.woff'), weight: 800, style: 'normal' },
  ];
  return fontsCache;
}

/** Element helper: el('div', { color: 'red' }, 'text', el(...)) */
export function el(type, style = {}, ...children) {
  const kids = children.flat().filter((c) => c !== null && c !== undefined && c !== false);
  return { type, props: { style: { display: 'flex', boxSizing: 'border-box', ...style }, children: kids.length === 1 ? kids[0] : kids } };
}

export async function renderPng(node, width, height) {
  const svg = await satori(node, { width, height, fonts: fonts() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
}

const T = () => themeTokens();

function brand(t, size = 30) {
  return el(
    'div',
    { alignItems: 'center', gap: size * 0.45, fontFamily: 'Fraunces', fontWeight: 800, fontSize: size, color: t.text },
    el('div', { width: size * 0.8, height: size * 0.8, borderRadius: size, background: t.accent, border: `${Math.max(2, size / 12)}px solid ${t.text}` }),
    siteInfo().title
  );
}

function frame(t, inner, { progress = null, footer = null } = {}) {
  return el(
    'div',
    { width: '100%', height: '100%', flexDirection: 'column', background: t.bg, padding: '64px 110px', fontFamily: 'Nunito', color: t.text, position: 'relative' },
    el(
      'div',
      { justifyContent: 'space-between', alignItems: 'center', gap: 40 },
      brand(t),
      footer ? el('div', { fontSize: 26, color: t.muted, fontWeight: 600, maxWidth: 1000, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }, footer) : null
    ),
    el('div', { flex: 1, flexDirection: 'column', justifyContent: 'center' }, inner),
    progress === null
      ? null
      : el(
          'div',
          { position: 'absolute', left: 0, bottom: 0, width: '100%', height: 10, background: t.sunken },
          el('div', { width: `${Math.max(0, Math.min(1, progress)) * 100}%`, height: '100%', background: t.accent })
        )
  );
}

// ── Video frames (1920×1080) ───────────────────────────────

export function titleCard({ title, subtitle }) {
  const t = T();
  return frame(
    t,
    el(
      'div',
      { flexDirection: 'column', gap: 36 },
      el('div', { fontSize: 34, fontWeight: 800, color: t.accent, letterSpacing: 2 }, 'AN ESSAY'),
      el('div', { fontFamily: 'Fraunces', fontWeight: 800, fontSize: title.length > 60 ? 88 : 112, lineHeight: 1.08, maxWidth: 1550 }, title),
      subtitle ? el('div', { fontSize: 40, color: t.muted, maxWidth: 1400, lineHeight: 1.4 }, subtitle) : null
    ),
    { progress: 0 }
  );
}

export function chapterCard({ heading, number, progress, essayTitle }) {
  const t = T();
  return frame(
    t,
    el(
      'div',
      { flexDirection: 'column', gap: 28 },
      el('div', { fontSize: 32, fontWeight: 800, color: t.mint, letterSpacing: 2 }, `PART ${number}`),
      el('div', { fontFamily: 'Fraunces', fontWeight: 800, fontSize: 104, lineHeight: 1.08, maxWidth: 1500 }, heading),
      el('div', { width: 180, height: 14, borderRadius: 14, background: t.sun, marginTop: 8 })
    ),
    { progress, footer: essayTitle }
  );
}

/**
 * Read-along page: every word is its own flex item so text wraps naturally.
 * Sentences before `active` are full colour, the active one is highlighted,
 * later ones are faded.
 */
export function readCard({ sentences, active, progress, essayTitle }) {
  const t = T();
  const words = [];
  sentences.forEach((s, i) => {
    const color = i === active ? t.text : i < active ? t.muted : t.border;
    for (const w of s.split(/\s+/).filter(Boolean)) {
      words.push(
        el(
          'span',
          {
            color,
            paddingRight: 16,
            marginBottom: 6,
            ...(i === active ? { backgroundImage: `linear-gradient(transparent 62%, ${t.sunSoft} 62%)` } : {}),
          },
          w
        )
      );
    }
  });
  const totalChars = sentences.join(' ').length;
  const size = totalChars > 300 ? 50 : totalChars > 200 ? 56 : 62;
  return frame(t, el('div', { flexWrap: 'wrap', fontSize: size, fontWeight: 600, lineHeight: 1.45, maxWidth: 1640 }, words), { progress, footer: essayTitle });
}

export function quoteCard({ text, progress, essayTitle }) {
  const t = T();
  return frame(
    t,
    el(
      'div',
      { flexDirection: 'column', gap: 10, paddingLeft: 40, borderLeft: `14px solid ${t.accent}` },
      el('div', { fontFamily: 'Fraunces', fontWeight: 800, fontSize: 160, lineHeight: 0.8, color: t.accent }, '“'),
      el('div', { fontFamily: 'Fraunces', fontStyle: 'italic', fontWeight: 600, fontSize: text.length > 160 ? 62 : 76, lineHeight: 1.3, maxWidth: 1500 }, text)
    ),
    { progress, footer: essayTitle }
  );
}

export function endCard({ url }) {
  const t = T();
  return frame(
    t,
    el(
      'div',
      { flexDirection: 'column', gap: 34, alignItems: 'flex-start' },
      el('div', { fontFamily: 'Fraunces', fontWeight: 800, fontSize: 104, lineHeight: 1.08 }, 'Read the full essay'),
      el(
        'div',
        { fontSize: 50, fontWeight: 800, color: t.raised, background: t.accent, padding: '18px 36px', borderRadius: 999, border: `5px solid ${t.text}`, boxShadow: `10px 10px 0 ${t.text}` },
        url.replace(/^https?:\/\//, '').replace(/\/$/, '')
      )
    ),
    { progress: 1 }
  );
}

// ── Thumbnail (1280×720) and link card (1200×630) ──────────

export function thumbnailCard({ text }) {
  const t = T();
  return el(
    'div',
    { width: '100%', height: '100%', flexDirection: 'column', justifyContent: 'space-between', background: t.sun, padding: 64, fontFamily: 'Nunito', color: t.text },
    brand(t, 40),
    el(
      'div',
      { background: t.bg, border: `8px solid ${t.text}`, borderRadius: 36, boxShadow: `16px 16px 0 ${t.text}`, padding: '36px 48px', maxWidth: 1100 },
      el('div', { fontFamily: 'Fraunces', fontWeight: 800, fontSize: text.length > 24 ? 84 : text.length > 14 ? 100 : 124, lineHeight: 1.04 }, text)
    )
  );
}

export function linkCard({ title, description }) {
  const t = T();
  return el(
    'div',
    { width: '100%', height: '100%', flexDirection: 'column', justifyContent: 'space-between', background: t.bg, padding: 60, fontFamily: 'Nunito', color: t.text, borderBottom: `18px solid ${t.accent}` },
    brand(t, 34),
    el(
      'div',
      { flexDirection: 'column', gap: 20 },
      el('div', { fontFamily: 'Fraunces', fontWeight: 800, fontSize: title.length > 60 ? 54 : 68, lineHeight: 1.1 }, title),
      description ? el('div', { fontSize: 30, color: t.muted, lineHeight: 1.4 }, description.length > 150 ? description.slice(0, 147) + '…' : description) : null
    )
  );
}
