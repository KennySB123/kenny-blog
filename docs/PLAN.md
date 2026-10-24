# Plan: essay blog + syndication + automatic YouTube videos

Status: proposal, not yet built. Written 2026-10-24.

## 0. Where we start

The blog exists. `KennySB123/kenny-blog` is an Astro 5 static site, deployed to
Cloudflare Pages at `https://kenny-blog-39e.pages.dev`. It has:

- Markdown posts in `src/content/blog/`, validated by a Zod schema
- A browser editor (Sveltia CMS) at `/admin`, not yet connected to an auth worker
- Search (Pagefind), RSS, sitemap, dark mode, tags, archive
- No GitHub Actions, no syndication, no video

**Decision 1: reuse this repo.** It already builds and deploys on every push. A new
repo would mean redoing the Cloudflare connection for no gain. If you want a fresh
name (for example `kenny-essays`), rename the repo in GitHub settings. Redirects follow.

## 1. Target architecture

One push to `main` drives everything.

```
you write an essay (CMS, editor, or `npm run new`)
        |
        v
   git push main
        |
        +--> Cloudflare Pages      builds the site         (exists today)
        |
        +--> GitHub Action: syndicate
        |       posts the essay to Dev.to, Hashnode
        |       announces it on Bluesky, Mastodon
        |       writes platform URLs back into the essay frontmatter
        |
        +--> GitHub Action: video (only when frontmatter says `video: true`)
                1. Claude turns the essay into a narration script + title + description
                2. opens a PR with the script for you to read (gate)
                3. on merge: TTS -> Remotion render -> captions -> thumbnail
                4. uploads to YouTube as unlisted, writes `youtube: <id>` back
                5. the site rebuilds and embeds the video at the top of the essay
```

Everything stays static. The pipeline lives in GitHub Actions, not in the site.

### Repo layout after the work

```
kenny-blog/
  src/ public/ astro.config.mjs ...     site, unchanged in spirit
  scripts/new-essay.mjs                 `npm run new "Title"` scaffolder
  pipeline/                             separate package.json, NOT an npm workspace,
    package.json                        so Cloudflare Pages never installs it
    syndicate/                          dev.to, hashnode, bluesky, mastodon adapters
    video/                              script generation, TTS, Remotion project, upload
    lib/                                markdown -> plain text, frontmatter read/write
  data/syndication.json                 slug -> platform IDs (idempotency ledger)
  .github/workflows/
    syndicate.yml
    video-script.yml
    video-render.yml
  docs/PLAN.md                          this file
```

## 2. Make writing essays easy

Three entry points, all end in a Markdown file in `src/content/blog/`.

1. **Browser.** Finish the Sveltia setup (DEPLOY.md step 5b, about 5 minutes). Then
   `/admin` works from a phone or any laptop. Drafts save to GitHub.
2. **Terminal.** `npm run new "Why I stopped reading the news"` creates
   `src/content/blog/why-i-stopped-reading-the-news.md` with today's date, the
   frontmatter filled in, and `draft: true`.
3. **Any Markdown editor.** Obsidian, iA Writer, VS Code. Point it at the folder.
   Commit with the GitHub Desktop app or `git`.

### Frontmatter additions

Extend the Zod schema in `src/content.config.ts` and the CMS form in
`public/admin/config.yml` together (golden rule 3).

```yaml
title: "..."
description: "..."
pubDate: 2026-10-24
tags: ["essays"]
draft: false
# new
syndicate: ["devto", "hashnode", "bluesky", "mastodon"]   # default: all; [] opts out
video: true                                               # default: false
# written back by the pipeline, never typed by hand
syndicated:
  devto: https://dev.to/kenny/why-i-stopped-...
  hashnode: https://...
youtube: dQw4w9WgXcQ
```

### Essay-grade reading experience (small site changes)

- Reading time in the post header (word count / 230)
- Table of contents for essays over about 1,500 words, from the h2 headings
- Footnotes (`remark-footnotes` style via Astro markdown config)
- Wider measure and a drop cap on the first paragraph, essays only
- "Also published on" footer, rendered from `syndicated`
- YouTube embed at the top when `youtube` is set (lite embed, no tracking until click)
- Per-essay Open Graph image, generated at build with Satori. The video thumbnail
  reuses the same template, so the two look like one family.

## 3. Syndication pipeline

Pattern: POSSE. Publish on your own site, syndicate elsewhere, every copy points
back with a canonical URL.

### What is automatable, honestly

| Platform | Method | Effort | Notes |
|---|---|---|---|
| Dev.to | REST API, `canonical_url` supported | low | Full essay mirror. Best SEO behaviour. |
| Hashnode | GraphQL API, canonical supported | low | Full essay mirror. Free custom domain. |
| Bluesky | AT Protocol, no approval needed | low | Link post with title + description + image card. |
| Mastodon | REST API, any instance | low | Same link post. |
| Medium | No new API tokens issued since 2023 | manual | Use Medium's "Import a story" by URL. Keeps canonical. |
| Substack | No public API | manual or swap | Paste, or use Buttondown (has API + RSS automation). |
| LinkedIn | API needs partner approval | via tool | Zapier / IFTTT / Make: RSS -> LinkedIn post. |
| X / Twitter | API write access is paid and unstable | via tool | Same RSS -> tool route, or skip. |
| Threads | Meta API, needs app review | via tool | Same. |

Recommendation: automate the top four with our own code. Point an RSS automation
tool at `/rss.xml` for LinkedIn and X. Do Medium by hand when an essay deserves it.
The RSS feed is the universal adapter; it already exists.

### How the Action works

Trigger: push to `main` that changes `src/content/blog/**`.

1. Diff the push to find changed, non-draft posts.
2. For each post and each platform in `syndicate`:
   - Convert Markdown to the platform's dialect. Make image URLs absolute
     (`/images/x.jpg` -> `https://<site>/images/x.jpg`). Strip Astro-only syntax.
   - Append "Originally published at <canonical URL>".
   - Look up `data/syndication.json`. If an ID exists, **update** that article.
     If not, create it and record the ID. This makes re-runs safe.
3. Write the platform URLs into the post's `syndicated` frontmatter.
4. Commit `data/syndication.json` and the frontmatter change with `[skip ci]`
   so Cloudflare still rebuilds (it ignores that tag) but the Action does not loop.
   Guard the workflow with `if: github.actor != 'github-actions[bot]'` as a second lock.

Announcement posts (Bluesky, Mastodon) fire once per essay, never on edits.

Secrets needed: `DEVTO_API_KEY`, `HASHNODE_TOKEN`, `HASHNODE_PUBLICATION_ID`,
`BSKY_HANDLE`, `BSKY_APP_PASSWORD`, `MASTODON_URL`, `MASTODON_TOKEN`.

## 4. YouTube video pipeline

Goal: a watchable, on-brand video of each essay, with no manual video editing.
Style: read-along. Your words appear on screen in the blog's typography and colours
as the narrator says them. Section titles become chapter cards. Pull quotes get
their own frames. This style suits essays. Stock footage and AI b-roll do not; they
look generic and date fast. Optional later: Pexels API clips for chapter cards only.

### Stage A: script (automatic, then gated by you)

Trigger: push to `main` where a post has `video: true` and no `youtube` ID.

1. Claude (Sonnet 5.5, or Haiku 5.5 to save pennies) reads the essay and produces:
   - `script.md`: a spoken-word adaptation. Same argument, tightened for the ear.
     Written numbers, expanded abbreviations, a 10-second cold open, a 15-second close.
   - `meta.json`: YouTube title (under 60 chars), description with the essay link and
     chapter timestamps placeholder, 10 tags, and a one-line thumbnail headline.
   - Optional: pronunciation hints for names the TTS would mangle.
   Alternative: skip adaptation and narrate the essay verbatim. Cheaper, zero drift,
   but essays written for the eye run long out loud. Make this a per-post switch:
   `video: verbatim`.
2. The Action commits `pipeline/video/jobs/<slug>/script.md` and `meta.json` to a
   branch and opens a PR titled "Video: <essay title>".
3. You read the script on your phone. Edit in the GitHub UI if needed. Merge.

This gate is the one place a human looks. It costs you two minutes and prevents
publishing a mispronounced name or a flattened argument.

### Stage B: render and upload (automatic, on PR merge)

1. **TTS.** Two options, pick one:
   - **ElevenLabs with a clone of your voice.** A personal essay in your own voice is
     the whole point of a personal channel. Creator plan, about $22/month for 100
     minutes. Returns word timestamps directly.
   - **Kokoro (open source, free).** Runs on the Actions CPU runner at about 5x
     real time. Good natural voices, not yours. Timestamps via WhisperX pass.
   Start with Kokoro to prove the pipeline, switch to ElevenLabs when you like it.
2. **Timestamps** align every word to the audio. Remotion uses them to light up text.
3. **Remotion** (React, renders in Node, free for individuals) composes:
   - 1920x1080 at 30fps, plus an optional 1080x1920 vertical cut for Shorts
   - Blog design tokens pulled from `global.css` so colours and fonts match the site
   - Scenes: title card, chapter cards from h2s, read-along body, end card with URL
   - Low-volume royalty-free bed music, ducked under speech, bundled in the repo
4. **Captions.** SRT from the timestamps. Uploaded as a caption track.
5. **Thumbnail.** Same Satori template as the OG image, with the Claude headline.
6. **Upload** via YouTube Data API v3 (`videos.insert`, then `thumbnails.set`,
   `captions.insert`). Visibility `unlisted`. Playlist: "Essays".
7. **Write back** `youtube: <id>` to the post frontmatter and commit. The site
   rebuilds and the essay page now embeds its video.
8. You watch it, then flip it to public in YouTube Studio. One click.

YouTube API facts that shape the plan:
- Quota is 10,000 units/day. One upload costs about 1,600. Plenty.
- Uploads from a Google Cloud project that has not passed the YouTube API audit are
  forced to private. Request the audit once the pipeline works; until then,
  step 8 is a required click, not an optional one.
- Auth is OAuth with a long-lived refresh token stored as a secret. One-time
  browser dance to obtain it; a small script in `pipeline/video/auth.mjs` does it.

Render time on a free 2-core GitHub runner: about 1 to 2 minutes per minute of
video. A 12-minute essay renders in roughly 20 minutes. Free tier gives 2,000
minutes/month on a private repo, unlimited on a public one.

Secrets needed: `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY` (optional),
`YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`.

## 5. Phased rollout

Each phase ships on its own and is useful alone.

**Phase 0: finish the site setup** (1 hour, mostly clicking)
- Sveltia auth worker so `/admin` works
- Custom domain if you want one; update `SITE_URL` and `robots.txt`
- Delete the sample posts, write the About page

**Phase 1: essay authoring** (half a day)
- `npm run new` scaffolder
- Schema and CMS fields: `syndicate`, `video`, `syndicated`, `youtube`
- Reading time, TOC, footnotes, drop cap, "also published on" footer, video embed
- Satori OG images

**Phase 2: syndication** (one day)
- `pipeline/` package, four adapters, idempotency ledger, write-back commit
- `syndicate.yml` workflow, dry-run mode first
- RSS automation tool for LinkedIn, if wanted

**Phase 3: video** (two to three days)
- Script generation + PR gate (`video-script.yml`)
- Remotion project, styled from the blog tokens, previewable locally with
  `npm run studio` in `pipeline/`
- Kokoro TTS + WhisperX alignment
- YouTube OAuth, upload, write-back (`video-render.yml`)
- Then: ElevenLabs voice clone, Shorts cut, audit request

**Phase 4: polish** (ongoing)
- Newsletter via Buttondown RSS automation
- Related essays by tag
- Pagination once there are 20+ essays

## 6. Running costs

| Item | Monthly |
|---|---|
| Hosting, GitHub, Actions (public repo) | $0 |
| Dev.to, Hashnode, Bluesky, Mastodon | $0 |
| Claude API for scripts and metadata | cents per essay |
| Kokoro TTS | $0 |
| ElevenLabs voice clone (optional) | ~$22 |
| RSS automation tool for LinkedIn (optional) | $0 to $20 |
| Custom domain | ~$1 |

## 7. Decisions needed from you

1. Reuse `kenny-blog` (recommended) or start a fresh repo?
2. Public repo? Public gives unlimited Actions minutes and enables Giscus comments.
   Your drafts would be visible in the repo, though not on the site.
3. Which platforms matter? Default set: Dev.to, Hashnode, Bluesky, Mastodon, plus
   LinkedIn through an RSS tool.
4. Voice: your own cloned voice (ElevenLabs, paid) or a free synthetic voice (Kokoro)?
5. Narration: Claude-adapted script with a PR gate (recommended), or verbatim essay
   with no gate?
6. Do you already have a YouTube channel for this, or do we create one?

## 8. Risks and how the plan handles them

- **Duplicate posts on re-run.** The ledger in `data/syndication.json` makes every
  run an upsert.
- **Workflow loops from write-back commits.** `[skip ci]` plus an actor guard.
- **TTS mangles a name.** The script PR gate; pronunciation hints in `meta.json`.
- **Video is private after upload.** Expected until the Google audit passes. One
  click to publish, and you wanted to watch it first anyway.
- **Platform APIs change.** Each adapter is one small file with one job. Dropping a
  platform is deleting a file and a secret.
- **Cloudflare build slows down.** `pipeline/` has its own `package.json` and is not
  a workspace, so Pages never installs Remotion or Chromium.
