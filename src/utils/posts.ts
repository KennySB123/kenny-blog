import { getCollection, type CollectionEntry } from 'astro:content';

const isProd = import.meta.env.PROD;

/**
 * All published posts, newest first.
 * Drafts are visible while running `npm run dev`, hidden in the built site.
 */
export async function getPosts(): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getCollection('blog', ({ data }) => !isProd || !data.draft);
  return posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );
}

/** Every tag used across published posts, with a count, sorted by popularity. */
export async function getTags(): Promise<{ tag: string; count: number }[]> {
  const posts = await getPosts();
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Group posts by year, newest year first. */
export function groupByYear(posts: CollectionEntry<'blog'>[]) {
  const groups = new Map<number, CollectionEntry<'blog'>[]>();
  for (const post of posts) {
    const year = post.data.pubDate.getFullYear();
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year)!.push(post);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]);
}
