# CLAUDE.md — context for AI assistants (and future you)

This file orients Claude Code (or any agent/editor) working on this repo. Read it before
making changes.

## What this project is

A personal blog built as a **static site** with **Astro 5**. No backend, no database.
Posts are Markdown files in `src/content/blog/`. The built site (`dist/`) is plain HTML/CSS/JS
deployed to Cloudflare Pages. Design goal: **playful / personal** — warm, hand-set feel,
not corporate.

## Golden rules

1. **Keep it static.** Do not add SSR, server endpoints, or an adapter unless the user
   explicitly asks. The whole value proposition is a free, portable, static site.
2. **Theme via CSS variables only.** All colours, fonts, radii, shadows are tokens at the
   top of `src/styles/global.css`, with a `[data-theme='dark']` override block. Never
   hard-code a hex value in a component — add or reuse a token.
3. **Content is data.** Post frontmatter is validated by the Zod schema in
   `src/content.config.ts`. If you add a frontmatter field, update that schema AND the
   Sveltia CMS form in `public/admin/config.yml` so both editing paths stay in sync.
4. **Respect drafts.** `src/utils/posts.ts` filters `draft: true` out of production builds
   (`import.meta.env.PROD`). Always source posts through `getPosts()`, never call
   `getCollection('blog')` directly in a page (except `rss.xml.js`, which filters inline).
5. **Two ways to edit must both keep working:** raw Markdown files, and the browser CMS at
   `/admin`. Don't break either.

## Architecture at a glance

- **Routing:** file-based in `src/pages/`. `[...slug].astro` renders posts;
  `getStaticPaths()` also wires prev/next. `[tag].astro` generates one page per tag.
- **Layouts:** `BaseLayout.astro` (html shell, head/SEO, fonts, no-flash theme script,
  header/footer) → `PostLayout.astro` wraps it for articles.
- **Search:** Pagefind runs as a post-build step (`astro build && pagefind --site dist`,
  see `package.json`). It indexes elements with `data-pagefind-body`. `BaseLayout` sets
  that attribute on `<main>` unless a page passes `noSearch`. Listing pages
  (home, blog index, tags, archive) pass `noSearch` so only real content is indexed.
  Search therefore does NOT work in `npm run dev` — only after a build. `search.astro`
  shows a friendly fallback in that case.
- **Comments:** `Comments.astro` renders the Giscus embed only when `GISCUS.enabled` is
  true in `src/consts.ts`. `ThemeToggle.astro` also postMessages the Giscus iframe to keep
  its theme in sync.
- **Dark mode:** an inline script in `BaseLayout` sets `data-theme` before first paint
  (no flash). `ThemeToggle.astro` flips it and persists to `localStorage`.

## Placeholders that need real values (grep for these)

- `astro.config.mjs` → `SITE_URL` (the live domain; affects RSS + sitemap absolute URLs)
- `src/consts.ts` → `SOCIALS` links, and the `GISCUS` block
- `public/admin/config.yml` → `repo:` and `base_url:` (GitHub repo + auth worker)
- `public/robots.txt` → sitemap hostname
- `src/pages/about.astro` → real bio copy

## Conventions

- **Dates:** `pubDate` is `YYYY-MM-DD`. Displayed via `FormattedDate.astro` (en-GB).
- **Tags:** lowercase, no spaces (e.g. `web`, `notes`). They generate `/tags/<tag>/`.
- **Slugs:** derived from the filename. `src/content/blog/my-post.md` → `/blog/my-post/`.
- **Images:** put in `public/images/`, reference as `/images/name.jpg` (CMS does this).
- **New page:** add `src/pages/<name>.astro`, then add it to `NAV` in `src/consts.ts`.

## Verifying a change

```bash
npm run build   # must exit 0; watch for schema/type errors
npm run preview # click through: home, a post, /tags, /archive, /search, dark toggle
```

Astro is strict about content schema — a bad date or missing `title` in frontmatter will
fail the build with a clear message. That's a feature; fix the frontmatter.

Note: on some sandboxed/mounted filesystems the build prints an `EPERM ... unlink` at the
very end while cleaning temp files. The site still builds correctly (all routes emit).
This does not happen on a normal machine or on Cloudflare Pages.

## Good next tasks (if the user wants more)

- Per-post reading time (compute from `render()` body or word count).
- Open Graph images per post (e.g. `@vercel/og` via an Astro endpoint, or static images).
- A `/now` page; a projects page.
- Related posts by shared tags at the bottom of `PostLayout`.
- Pagination on `/blog` once there are many posts.
- Swap Pagefind's Default UI for its newer Component UI (see build output note).

Keep changes small, keep it static, keep the design playful.
