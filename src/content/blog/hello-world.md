---
title: "Starting a blog in 2026, for free"
description: "Why I built this thing myself instead of paying someone $300 a year, and what it actually cost."
pubDate: 2026-07-21
tags: ["meta", "web"]
draft: false
---

This is a sample post. Delete it, or edit it into something real — either way, it's just a
Markdown file sitting in `src/content/blog/`.

## The thing about paying for a blog

Every hosted platform sells you the same trade: they handle the boring parts, you accept
their ceiling. That's a fine deal, right up until you want to move a sidebar three pixels
and find out it's a paid tier away.

> The best time to own your own content was ten years ago. The second best time is now.

So this site is a pile of Markdown files and some HTML. Cloudflare serves it for free.
If I ever want to leave, I copy a folder.

## What Markdown gives you

You get all the usual things without thinking about it:

- **Bold**, *italic*, ~~strikethrough~~, and [links](https://astro.build)
- Lists, obviously
- Footnotes, tables, block quotes

Code blocks get syntax highlighting automatically, in both light and dark mode:

```js
const posts = await getCollection('blog');
const recent = posts
  .sort((a, b) => b.data.pubDate - a.data.pubDate)
  .slice(0, 5);
```

And tables work fine:

| Platform | Year 1 | Creative control |
|---|---|---|
| This site | £0 | Total |
| WordPress.com Premium | ~£75 | Themed |
| Squarespace | ~£160 | Templated |

## Writing your next post

Two ways, both equally valid:

1. **In the browser** — go to `/admin`, click New Post, type, hit publish. It commits to
   GitHub for you and the site rebuilds in about 30 seconds.
2. **In a text editor** — drop a `.md` file in `src/content/blog/`, `git push`. Same result.

The frontmatter block at the top of this file is the only structure you need to keep:
`title`, `description`, `pubDate`, and optionally `tags`, `heroImage`, and `draft`.

Set `draft: true` and a post stays visible while you're running `npm run dev` but never
makes it into the built site. Handy for half-finished thoughts.
