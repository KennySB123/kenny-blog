import YAML from 'yaml';

export interface PostData {
  title: string;
  description: string;
  pubDate: string;
  updatedDate?: string;
  heroImage?: string;
  tags: string[];
  draft: boolean;
  distribute?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

const ORDER = ['title', 'description', 'pubDate', 'updatedDate', 'heroImage', 'tags', 'draft', 'distribute'];

export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parsePost(source: string): { data: PostData; body: string } {
  const m = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const raw = m ? (YAML.parse(m[1]) ?? {}) : {};
  const body = (m ? m[2] : source).replace(/^\r?\n/, '');
  const asDate = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v) : undefined);
  const data: PostData = {
    ...raw,
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    pubDate: asDate(raw.pubDate) ?? today(),
    updatedDate: asDate(raw.updatedDate),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    draft: raw.draft === true,
  };
  if (!data.updatedDate) delete data.updatedDate;
  return { data, body };
}

export function serializePost(data: PostData, body: string): string {
  const clean: Record<string, unknown> = {};
  const keys = [...ORDER, ...Object.keys(data).filter((k) => !ORDER.includes(k))];
  for (const k of keys) {
    const v = data[k];
    if (v === undefined || v === '' || v === null) continue;
    if (k === 'distribute' && (typeof v !== 'object' || Object.keys(v as object).length === 0)) continue;
    clean[k] = v;
  }
  const yaml = YAML.stringify(clean, { lineWidth: 0 });
  return `---\n${yaml}---\n\n${body.trim()}\n`;
}

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/, '') || 'untitled'
  );
}
