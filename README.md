# Kenny's Blog

A fast, free, fully-owned personal blog. Static site built with
[Astro](https://astro.build), written in Markdown, hosted on
[Cloudflare Pages](https://pages.cloudflare.com) for **£0/month** with unlimited
bandwidth. Write posts either in a browser (Sveltia CMS at `/admin`) or as plain
Markdown files.

## What's included

- **Playful, personal design** — warm paper palette, Fraunces + Nunito type, wavy
  underlines, sticker-style cards. All theming lives in CSS variables.
- **Dark mode** — respects the OS setting, with a manual toggle that's remembered.
- **Writing** list, **single post** pages with prev/next, **tags**, **archive by year**.
- **Full-text search** — [Pagefind](https://pagefind.app), client-side, free, zero config.
- **RSS feed** (`/rss.xml`) and **sitemap** (`/sitemap-index.xml`).
- **Comments** — [Giscus](https://giscus.app) (GitHub Discussions), off until you enable it.
- **Browser-based editor** — Sveltia CMS at `/admin`, commits to GitHub for you.
- **Drafts** — `draft: true` hides a post from the live site but shows it in dev.

## Quick start (local)

Requires [Node.js](https://nodejs.org) 18.20+ (built and tested on Node 22).

```bash
npm install
npm run dev      # http://localhost:4321  — live preview while you edit
```

Search only works in a real build, so to test that:

```bash
npm run preview  # builds (incl. the Pagefind index) then serves it
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload. Shows drafts. |
| `npm run build` | Production build into `dist/` + generates the Pagefind search index. |
| `npm run preview` | Build, then serve `dist/` locally. Search works here. |

## Where things live

```
src/
  consts.ts              ← site title, nav, socials, comments config (EDIT THIS FIRST)
  content/blog/*.md      ← your posts (one Markdown file each)
  content.config.ts      ← frontmatter schema (title, description, pubDate, tags, …)
  styles/global.css      ← all design tokens + styling (colours at the top)
  layouts/               ← BaseLayout (every page) + PostLayout (single post)
  components/            ← Header, Footer, PostCard, ThemeToggle, Comments, FormattedDate
  utils/posts.ts        ← helpers: getPosts(), getTags(), groupByYear()
  pages/                ← routes; each .astro / .md file becomes a URL
public/
  admin/                ← Sveltia CMS (browser editor) — set your repo in config.yml
  images/               ← image uploads land here
  favicon.svg
astro.config.mjs        ← set your live SITE_URL here after first deploy
```

## Going live

See **[DEPLOY.md](./DEPLOY.md)** — a step-by-step walkthrough (GitHub → Cloudflare Pages
→ optional custom domain → optional browser editor and comments). About 20 minutes.

## Continuing to build this

See **[CLAUDE.md](./CLAUDE.md)** — conventions and context for extending the site,
whether you're doing it by hand or with an AI assistant like Claude Code.
