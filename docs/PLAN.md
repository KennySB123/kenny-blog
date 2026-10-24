# Plan: essay blog, Studio, syndication and videos

Status: **built** (October 2026). This file records the decisions and why they were made.
Setup steps are in [DEPLOY.md](../DEPLOY.md). Code orientation is in [CLAUDE.md](../CLAUDE.md).

## Decisions

| Question | Decision |
|---|---|
| Repository | Reuse `KennySB123/kenny-blog`. It already deploys to Cloudflare Pages. |
| Repo visibility | Already public, so GitHub Actions minutes are unlimited. No change needed. |
| Editing | A Studio at `/admin`, modelled on blank.page, with GitHub login. Replaces Sveltia CMS. |
| Platforms | DEV, Hashnode, Bluesky, Mastodon, YouTube. LinkedIn removed. |
| Control | Global defaults in the Studio, per-essay overrides saved in the essay's frontmatter. |
| Voice | Kokoro (open-weight, free, runs on the Actions CPU). |
| Narration | Claude adapts the essay; the user reviews and approves the script in the Studio. |
| YouTube | A new channel, created by the user (DEPLOY.md step 8). |

## Architecture

```
Studio (/admin, static page)  ──commits──▶  GitHub repo (main)
   │  GitHub login via 2 Cloudflare            │
   │  Pages Functions (code exchange only)     ├──▶ Cloudflare Pages builds the static site
   │                                           │
   │                                           ├──▶ Action "Distribute" (posts changed, or
   │                                           │      "Distribute now" from the Studio)
   │                                           │      ├─ DEV, Hashnode: full mirror, canonical link
   │                                           │      ├─ Bluesky, Mastodon: one announcement
   │                                           │      └─ YouTube on: Claude writes script.md
   │                                           │           → pipeline/jobs/<slug>/ (status: review)
   │  "Approve & render" ──commits job.json───▶│
   │                                           └──▶ Action "Video render"
   │                                                  Kokoro voice → satori frames → ffmpeg
   │                                                  → YouTube (+ thumbnail, captions, playlist)
   ◀──── results in src/data/syndication.json (ledger) ── Studio shows status; site embeds video
```

## Why these choices

- **Studio, not a CMS product.** The ask was "based on blank.page": a quiet page and nothing
  else. A small vanilla-TS app gives exactly that, plus the distribution controls no CMS has.
  It writes plain Markdown, so editing files by hand keeps working.
- **Login through a GitHub App.** The token is limited to this one repo and expires after 8
  hours. A Cloudflare Pages Function holds the client secret. The site itself stays static.
- **A ledger instead of writing back into posts.** The pipeline records links and status in
  `src/data/syndication.json` and never edits essays. The Studio and the bot never fight over the
  same file.
- **Review gate in the Studio, not a pull request.** Approving is one button on the phone, and
  it needs no extra repo setting for Actions to open PRs.
- **satori + ffmpeg instead of Remotion.** The read-along style only changes on sentence
  boundaries, so one still image per sentence is enough. This renders in seconds, needs no
  headless browser, and reuses the site's colours and fonts.
- **Sentence timing from the TTS itself.** Each sentence is spoken separately, so its audio length
  gives exact timing for highlights, captions and chapters, with no alignment model.
- **Safe defaults.** Essays dated before `autoSince` never go out automatically. Platforms
  without keys are skipped, not failed. YouTube uploads default to private.

## What is automatable, and what is not

| Platform | How |
|---|---|
| DEV | REST API with `canonical_url`. No delete API, so "remove" unpublishes. |
| Hashnode | GraphQL API with `originalArticleURL`. |
| Bluesky | AT Protocol with an app password; link card image drawn by the pipeline. |
| Mastodon | REST API; the instance builds the link card from the page. |
| YouTube | Data API v3. Uploads stay private until Google audits the API project. |
| Medium, Substack, X | Not automated (no usable API). Import by URL by hand if wanted. |

## Running costs

Everything is free except the Claude API for adapted scripts (roughly 10p to 30p per essay) and
an optional custom domain. "Word for word" scripts need no API key at all.

## Possible next steps

- Open Graph images per essay, reusing the pipeline's card design.
- A vertical cut for YouTube Shorts.
- A newsletter fed from the RSS feed.
- Pagination on `/blog` once there are many essays.
