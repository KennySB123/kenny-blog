import { marked } from './marked-lite.mjs';

/** Make root-relative links and images absolute, so they work on other sites. */
export function absolutize(markdown, siteUrl) {
  return markdown
    .replace(/(\]\()\/(?!\/)/g, `$1${siteUrl}/`)
    .replace(/(\b(?:src|href)=["'])\/(?!\/)/g, `$1${siteUrl}/`)
    .replace(/^(\[[^\]]+\]:\s*)\/(?!\/)/gm, `$1${siteUrl}/`);
}

/** Absolute URL for a root-relative path ("/images/a.jpg"); leaves full URLs alone. */
export function absoluteUrl(p, siteUrl) {
  if (!p) return undefined;
  return /^https?:\/\//.test(p) ? p : `${siteUrl}/${p.replace(/^\/+/, '')}`;
}

/** Strip Markdown to readable plain text (for narration and summaries). */
export function stripInline(md) {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[\^[^\]]+\]/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split an essay into narration segments: chapters (## headings),
 * paragraphs and quotes. Code blocks, images, tables and footnotes are dropped.
 */
export function essaySegments(markdown) {
  const segments = [];
  for (const block of marked(markdown)) {
    if (block.type === 'heading' && block.depth <= 3) segments.push({ kind: 'chapter', text: stripInline(block.text) });
    else if (block.type === 'paragraph') {
      const text = stripInline(block.text);
      if (text && !/^\[\^[^\]]+\]:/.test(block.text)) segments.push({ kind: 'paragraph', text });
    } else if (block.type === 'quote') segments.push({ kind: 'quote', text: stripInline(block.text) });
    else if (block.type === 'list') for (const item of block.items) segments.push({ kind: 'paragraph', text: stripInline(item) });
  }
  return segments.filter((s) => s.text);
}

/** Split text into sentences using the platform's segmenter. */
export function sentences(text) {
  const seg = new Intl.Segmenter('en', { granularity: 'sentence' });
  return [...seg.segment(text)].map((s) => s.segment.trim()).filter(Boolean);
}

/** Hashtag-safe version of a tag: "slow-living" → "#slowliving". */
export function hashtag(tag) {
  const t = tag.replace(/[^\p{L}\p{N}]/gu, '');
  return t ? `#${t}` : '';
}

/** Fill {title} {description} {url} {tags} placeholders. */
export function fillTemplate(template, vars) {
  return template
    .replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
