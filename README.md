# Kenny's Blog

A fast, free, fully-owned essay blog. Static site built with
[Astro](https://astro.build), written in Markdown, hosted on
[Cloudflare Pages](https://pages.cloudflare.com) for **£0/month**. Write in a quiet
browser editor (the Studio at `/admin`) or as plain Markdown files. Each essay can go out
to DEV, Hashnode, Bluesky and Mastodon, and become a narrated YouTube video, from one
click.

## What's included

- **Playful, personal design** — warm paper palette, Fraunces + Nunito type, wavy
  underlines, sticker-style cards. All theming lives in CSS variables.
- **Dark mode** — respects the OS setting, with a manual toggle that's remembered.
- **Writing** list, **single post** pages with prev/next, **tags**, **archive by year**.
- **Full-text search** — [Pagefind](https://pagefind.app), client-side, free, zero config.
- **RSS feed** (`/rss.xml`) and **sitemap** (`/sitemap-index.xml`).
- **Comments** — [Giscus](https://giscus.app) (GitHub Discussions), off until you enable it.
- **Studio** at `/admin`: a distraction-free editor in the style of blank.page. Log in with
  GitHub; create, edit, preview, publish and delete essays; paste images; local autosave.
- **Distribution you control**: global defaults plus per-essay overrides for DEV, Hashnode,
  Bluesky, Mastodon and YouTube. Automatic on publish, or only when you press a button.
- **Essays become videos**: Claude adapts the essay into a narration script, you approve it in
  the Studio, then a read-along video (Kokoro voice, site styling, captions, chapters) renders
  on GitHub Actions and uploads to YouTube. The video is embedded on the essay.
- **Essay reading**: reading time, contents list, drop cap, footnotes, "Also published on".
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
| `cd pipeline && npm test` | Pipeline tests (no network needed). |

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
  admin/                 ← the Studio (browser editor), served at /admin
  data/distribution.json ← distribution defaults (edited from the Studio)
  data/syndication.json  ← where each essay went (written by the pipeline)
public/
  images/               ← image uploads land here
  favicon.svg
functions/api/auth/     ← GitHub login for the Studio (Cloudflare Pages Functions)
pipeline/               ← syndication + video pipeline (runs in GitHub Actions)
  jobs/<slug>/          ← video scripts waiting for review, and their status
.github/workflows/      ← distribute.yml, video-render.yml, checks.yml
astro.config.mjs        ← set your live SITE_URL here after first deploy
```

## Going live

See **[DEPLOY.md](./DEPLOY.md)** — a step-by-step walkthrough: Cloudflare Pages, the Studio
login, platform keys, and the YouTube channel. The plan behind the design is in
[docs/PLAN.md](./docs/PLAN.md).

## Continuing to build this

See **[CLAUDE.md](./CLAUDE.md)** — conventions and context for extending the site,
whether you're doing it by hand or with an AI assistant like Claude Code.
