import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import YAML from 'yaml';
import { PATHS } from './config.mjs';

export function parseFrontmatter(source) {
  const m = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: source };
  return { data: YAML.parse(m[1]) ?? {}, body: m[2].replace(/^\r?\n/, '') };
}

export function readPost(slug) {
  for (const ext of ['.md', '.mdx']) {
    const file = path.join(PATHS.posts, slug + ext);
    if (fs.existsSync(file)) {
      const { data, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
      return {
        slug,
        file,
        body,
        data: {
          ...data,
          title: String(data.title ?? slug),
          description: String(data.description ?? ''),
          tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
          draft: data.draft === true,
          pubDate: data.pubDate instanceof Date ? data.pubDate.toISOString().slice(0, 10) : String(data.pubDate ?? ''),
        },
      };
    }
  }
  return null;
}

export function slugFromFile(file) {
  const m = file.match(/src\/content\/blog\/(.+)\.mdx?$/);
  return m ? m[1] : null;
}

/** Fingerprint of everything a mirror shows, so unchanged posts aren't re-sent. */
export function contentHash(post) {
  const d = post.data;
  return crypto
    .createHash('sha256')
    .update(JSON.stringify([d.title, d.description, d.tags, d.heroImage ?? '', post.body]))
    .digest('hex')
    .slice(0, 16);
}
