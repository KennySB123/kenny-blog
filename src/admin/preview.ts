import { marked } from 'marked';

/** Session-only map of freshly uploaded images, so previews work before the site rebuilds. */
export const localImages = new Map<string, string>();

const BLOCKED = 'script,iframe,object,embed,link,meta,style,base,form';

/** Render Markdown to safe HTML for the preview pane. */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { gfm: true, async: false }) as string;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  doc.querySelectorAll(BLOCKED).forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith('on') || ((name === 'href' || name === 'src') && value.startsWith('javascript:'))) el.removeAttribute(attr.name);
    }
    if (el.tagName === 'IMG') {
      const src = el.getAttribute('src') ?? '';
      if (localImages.has(src)) el.setAttribute('src', localImages.get(src)!);
    }
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener');
    }
  });
  return doc.body.firstElementChild!.innerHTML;
}
