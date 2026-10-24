// The video script is a small Markdown file you can read and edit in the studio:
//
//   ---
//   title: YouTube title
//   description: |
//     YouTube description
//   tags: [one, two]
//   thumbnailText: Short punchy text
//   ---
//
//   # Chapter heading         → chapter card (spoken)
//   A paragraph.               → read-along, spoken
//   > A memorable line.        → quote card (spoken)
import YAML from 'yaml';
import { parseFrontmatter } from '../lib/posts.mjs';

export function serializeScript(meta, segments) {
  const head = YAML.stringify(
    { title: meta.title, description: meta.description, tags: meta.tags ?? [], thumbnailText: meta.thumbnailText ?? '' },
    { lineWidth: 0 }
  );
  const body = segments
    .map((s) => (s.kind === 'chapter' ? `# ${s.text}` : s.kind === 'quote' ? `> ${s.text}` : s.text))
    .join('\n\n');
  return `---\n${head}---\n\n${body}\n`;
}

export function parseScript(source) {
  const { data, body } = parseFrontmatter(source);
  const segments = [];
  for (const block of body.replace(/\r\n/g, '\n').split(/\n\s*\n/)) {
    const text = block.trim();
    if (!text) continue;
    if (text.startsWith('#')) segments.push({ kind: 'chapter', text: text.replace(/^#+\s*/, '').trim() });
    else if (text.startsWith('>')) segments.push({ kind: 'quote', text: text.replace(/^>\s?/gm, '').replace(/\s+/g, ' ').trim() });
    else segments.push({ kind: 'paragraph', text: text.replace(/\s+/g, ' ') });
  }
  return {
    meta: {
      title: String(data.title ?? '').trim(),
      description: String(data.description ?? '').trim(),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      thumbnailText: String(data.thumbnailText ?? '').trim(),
    },
    segments: segments.filter((s) => s.text),
  };
}
