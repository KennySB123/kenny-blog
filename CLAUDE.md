# CLAUDE.md — context for AI assistants (and future you)

This file orients Claude Code (or any agent/editor) working on this repo. Read it before
making changes.

## What this project is

A personal essay blog built as a **static site** with **Astro 5**. No backend, no database.
Posts are Markdown files in `src/content/blog/`. The built site (`dist/`) is plain HTML/CSS/JS
deployed to Cloudflare Pages. Design goal: **playful / personal** — warm, hand-set feel,
not corporate.

Around the site:
- **Studio** (`/admin`): a blank.page-style editor that runs in the browser and commits to
  GitHub with the user's login. Source in `src/admin/`.
- **Login functions** (`functions/api/auth/`): two Cloudflare Pages Functions that do the
  GitHub OAuth code exchange. The only server code; the Astro build stays static.
- **Pipeline** (`pipeline/`): its own Node package, run by GitHub Actions. Syndicates essays
  (DEV, Hashnode, Bluesky, Mastodon, X) and turns them into narrated YouTube videos.
  Medium and Substack are `manual` platforms: no API, so the Studio prepares a copy
  (`src/admin/manual.ts`) and the user posts it and records the address in the ledger.

## Golden rules

1. **Keep it static.** Do not add SSR, server endpoints, or an adapter unless the user
   explicitly asks. The whole value proposition is a free, portable, static site. The two
   login functions in `functions/` are the agreed exception; keep anything else out of there.
2. **Theme via CSS variables only.** All colours, fonts, radii, shadows are tokens at the
   top of `src/styles/global.css`, with a `[data-theme='dark']` override block. Never
   hard-code a hex value in a component — add or reuse a token.
3. **Content is data.** Post frontmatter is validated by the Zod schema in
   `src/content.config.ts`. If you add a frontmatter field, update that schema AND the
   Studio (`src/admin/frontmatter.ts` for order/parsing, `src/admin/views/editor.ts` for the
   form) so both editing paths stay in sync. Per-essay distribution settings live in the
   `distribute` field; global defaults in `src/data/distribution.json`.
4. **Respect drafts.** `src/utils/posts.ts` filters `draft: true` out of production builds
   (`import.meta.env.PROD`). Always source posts through `getPosts()`, never call
   `getCollection('blog')` directly in a page (except `rss.xml.js`, which filters inline).
5. **Two ways to edit must both keep working:** raw Markdown files, and the Studio at
   `/admin`. Don't break either.
6. **The pipeline writes, people write.** Workflows only commit `src/data/syndication.json`
   (the ledger) and `pipeline/jobs/**`. They never rewrite posts, so the Studio and the bot
   can't fight over the same file. Keep it that way.

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
- **Essay extras:** `PostLayout` shows reading time, a contents list for long essays (1,200+
  words with 3+ `##` headings), a drop cap, the YouTube embed and "Also published on" links.
  The last two read the ledger via `src/utils/distribution.ts`.

## Studio (`src/admin/`, page at `src/pages/admin/index.astro`)

- Vanilla TypeScript, no framework. `main.ts` routes by hash (`#/`, `#/new`, `#/edit/<slug>`,
  `#/video/<slug>`, `#/settings`, `#/activity`). Views are in `views/`.
- `github.ts` is the only network layer: one GraphQL query loads posts, settings, ledger and
  video jobs; writes go through `commit()` (Git Data API, one commit per save, retries when
  the branch moved). `updateJson()` does read-modify-write for shared JSON files.
- Login: `/api/auth/login` → GitHub → `/api/auth/callback` → `/admin/#token=…`. The token is
  kept in `localStorage`. A fine-grained PAT works too (local dev, previews).
- Unsaved text is autosaved to `localStorage` under `studio:draft:<slug>` (the working copy).
- Backups (`backup.ts`, `folder.ts`, `views/history.ts`, `views/backups.ts`): IndexedDB keeps a
  version every 8 s while typing and on every save/publish/discard/restore/delete (keyed by
  slug, `__new__` before the first save, re-keyed after). Optional folder backup via the File
  System Access API writes `<slug>.md` live and `history/<slug>/<stamp>.md` copies. Never
  delete versions on behalf of the user except the pruning of old typing snapshots.

## Pipeline (`pipeline/`)

- Separate `package.json`, NOT an npm workspace, so Cloudflare never installs it.
- `src/distribute.mjs` (workflow `distribute.yml`): on a push that changes posts, or on
  "Distribute now", `src/plan.mjs` decides tasks; adapters in `src/platforms/` run them;
  results go to the ledger via `src/lib/store.mjs` (`persist()` commits and pushes in CI only).
- Video: `src/video/script.mjs` asks Claude (`claude-opus-5-5`, structured JSON output) for a
  narration script → `pipeline/jobs/<slug>/script.md` with `job.json` status `review`. The
  user approves in the Studio (status `approved`), which triggers `video-render.yml` →
  `src/video/render.mjs`: Kokoro TTS (`tts.mjs`), satori frames (`src/card.mjs`), ffmpeg
  (`compose.mjs`), YouTube upload (`youtube.mjs`).
- Commits made with `GITHUB_TOKEN` don't trigger workflows, so bot write-backs can't loop.
- Tests: `cd pipeline && npm test` (no network; fetch is mocked). `DRY_RUN=1` and
  `TTS_ENGINE=silent` let you run the entry points locally without keys or the voice model.
- Settings `autoSince`: essays dated before it never go out automatically.

## Placeholders that need real values (grep for these)

- `astro.config.mjs` → `SITE_URL` (the live domain; affects RSS + sitemap absolute URLs)
- `src/consts.ts` → `SOCIALS` links, and the `GISCUS` block
- `src/consts.ts` → `REPO` (owner/name used by the Studio)
- Cloudflare Pages env: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ALLOWED_USERS`
- GitHub Actions secrets for each platform (see DEPLOY.md step 7)
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
npm run preview # click through: home, a post, /tags, /archive, /search, dark toggle, /admin
cd pipeline && npm test   # pipeline unit tests
```

Astro is strict about content schema — a bad date or missing `title` in frontmatter will
fail the build with a clear message. That's a feature; fix the frontmatter.

Note: on some sandboxed/mounted filesystems the build prints an `EPERM ... unlink` at the
very end while cleaning temp files. The site still builds correctly (all routes emit).
This does not happen on a normal machine or on Cloudflare Pages.

## Good next tasks (if the user wants more)

- Open Graph images per post (reuse `pipeline/src/card.mjs` `linkCard`, generated at build).
- A vertical YouTube Shorts cut from the same frames.
- A newsletter (e.g. Buttondown) fed from the RSS feed.
- A `/now` page; a projects page.
- Related posts by shared tags at the bottom of `PostLayout`.
- Pagination on `/blog` once there are many posts.
- Swap Pagefind's Default UI for its newer Component UI (see build output note).

Keep changes small, keep it static, keep the design playful.
