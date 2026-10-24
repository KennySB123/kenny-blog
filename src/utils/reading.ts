/** Rough word count of a Markdown body (ignores code fences and URLs). */
export function countWords(markdown = ''): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/<[^>]+>/g, ' ');
  return (text.match(/[\p{L}\p{N}’']+/gu) ?? []).length;
}

/** Minutes to read at ~230 words per minute, never less than 1. */
export function readingMinutes(markdown = ''): number {
  return Math.max(1, Math.round(countWords(markdown) / 230));
}
