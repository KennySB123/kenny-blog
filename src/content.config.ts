import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    // Optional so drafts can be saved before they have one; the Studio asks for it on publish.
    description: z.string().default(''),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    // Per-post overrides for where and how this essay is distributed.
    // Keys are platform ids (devto, hashnode, bluesky, mastodon, youtube).
    // Anything not set here falls back to src/data/distribution.json.
    // Written by the /admin editor; safe to edit by hand.
    distribute: z.record(z.string(), z.record(z.string(), z.any())).optional(),
  }),
});

export const collections = { blog };
