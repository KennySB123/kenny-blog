// A small block-level Markdown splitter. Enough to find headings, paragraphs,
// quotes and lists without pulling a full parser into the pipeline.

export function marked(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  const isBlank = (l) => /^\s*$/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) {
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) i++;
      i++;
      blocks.push({ type: 'code' });
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      blocks.push({ type: 'heading', depth: heading[1].length, text: heading[2] });
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      blocks.push({ type: 'quote', text: buf.join(' ') });
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const items = [];
      while (i < lines.length && !isBlank(lines[i])) {
        if (/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ''));
        else if (items.length) items[items.length - 1] += ' ' + lines[i].trim();
        i++;
      }
      blocks.push({ type: 'list', items });
      continue;
    }
    if (/^\s*\|/.test(line)) {
      while (i < lines.length && /^\s*\|/.test(lines[i])) i++;
      blocks.push({ type: 'table' });
      continue;
    }
    if (/^\s*<[^>]+>\s*$/.test(line)) {
      while (i < lines.length && !isBlank(lines[i])) i++;
      blocks.push({ type: 'html' });
      continue;
    }
    const buf = [];
    while (i < lines.length && !isBlank(lines[i]) && !/^(#{1,6}\s|```|~~~|\s*>)/.test(lines[i])) buf.push(lines[i++].trim());
    const text = buf.join(' ');
    if (/^!\[[^\]]*\]\([^)]*\)$/.test(text)) blocks.push({ type: 'image' });
    else blocks.push({ type: 'paragraph', text });
  }
  return blocks;
}
