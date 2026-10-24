# Deploy guide — from folder to live site

Goal: your blog live on the internet, for free, in about 20 minutes. You'll need a
[GitHub](https://github.com) account (free) and a [Cloudflare](https://dash.cloudflare.com/sign-up)
account (free). No credit card required for either.

The **minimum** to be live is Steps 1–3. Step 5 turns on the Studio (the browser editor).
Steps 7–8 connect the other platforms and YouTube. The rest are optional.

---

## Step 1 — Put the code on GitHub

1. Create a new repository at <https://github.com/new>. Name it anything (e.g. `blog`).
   Leave it **empty** (no README/gitignore — this project already has them). Private is fine.
2. In a terminal, from inside this `blog/` folder:

   ```bash
   git init
   git add .
   git commit -m "Initial blog"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
   git push -u origin main
   ```

   Replace `YOUR-USERNAME/YOUR-REPO` with your actual repo. `node_modules/` and `dist/`
   are gitignored, so they won't upload — that's correct.

> No terminal? You can upload the folder via GitHub's web "uploading an existing file"
> flow, but the CLI above is the smoother path.

---

## Step 2 — Connect Cloudflare Pages

1. Go to the [Cloudflare dashboard](https://dash.cloudflare.com) →
   **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorise GitHub and pick your repo.
3. Set the build settings:

   | Field | Value |
   |---|---|
   | Framework preset | **Astro** |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

4. Click **Save and Deploy**. First build takes ~1–2 minutes.

When it finishes you'll get a URL like `https://your-repo.pages.dev`. **Your blog is live.**

Every time you `git push` to `main` from now on, Cloudflare rebuilds and redeploys
automatically. No further action needed to publish.

---

## Step 3 — Set your real site URL

RSS and the sitemap need the absolute URL. Edit **`astro.config.mjs`**:

```js
const SITE_URL = 'https://your-repo.pages.dev'; // ← your actual Pages URL (or custom domain)
```

Also update the hostname in **`public/robots.txt`**. Commit and push:

```bash
git commit -am "Set site URL" && git push
```

---

## Step 4 (optional) — Custom domain

The site is 100% free on the `.pages.dev` subdomain forever. A custom domain is the only
thing that costs money (~£8–10/year).

1. **Buy a domain.** Cheapest reputable options: [Spaceship](https://www.spaceship.com),
   [Porkbun](https://porkbun.com), or [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/)
   (at-cost, ~$9.77/yr for `.com`, no markup ever — but you register elsewhere and transfer in).
2. In Cloudflare Pages → your project → **Custom domains** → **Set up a domain**. Enter your
   domain and follow the DNS prompts. If the domain is already on Cloudflare, it's basically
   one click.
3. Update `SITE_URL` in `astro.config.mjs` and the hostname in `robots.txt` to the new domain,
   then push.

---

## Step 5 — Turn on the Studio (`/admin`)

The Studio is your writing room: a quiet editor in the style of blank.page, plus controls
for where each essay goes. You log in with GitHub. Every save is a real commit to the repo.

It needs a small **GitHub App** (so GitHub knows the Studio may edit this one repo) and two
settings in Cloudflare. About 10 minutes, once.

### 5a. Create the GitHub App

1. Open <https://github.com/settings/apps/new>.
2. Fill in:

   | Field | Value |
   |---|---|
   | GitHub App name | anything unique, e.g. `kenny-blog-studio` |
   | Homepage URL | your site, e.g. `https://kenny-blog-39e.pages.dev` |
   | Callback URL | `https://kenny-blog-39e.pages.dev/api/auth/callback` |
   | Expire user authorization tokens | leave **on** (you log in again after 8 hours) |
   | Request user authorization during installation | off |
   | Webhook → Active | **off** |

3. Under **Repository permissions** set:
   - **Contents**: Read and write (save essays, images, settings)
   - **Actions**: Read and write ("Distribute now", the Activity page)
   - **Secrets**: Read-only (optional; lets the Studio show which keys are set, never their values)
4. **Where can this GitHub App be installed?** Only on this account. Click **Create GitHub App**.
5. On the app page, note the **Client ID**, then click **Generate a new client secret** and copy it.
6. In the app's left menu, click **Install App** → your account → **Only select repositories** →
   `kenny-blog` → **Install**.

> Using a custom domain? Add a second callback URL for it on the same app page.

### 5b. Give Cloudflare the app's keys

Cloudflare dashboard → **Workers & Pages** → your project → **Settings** → **Variables and Secrets**
→ add these for **Production**:

| Name | Type | Value |
|---|---|---|
| `GITHUB_CLIENT_ID` | Text | the Client ID |
| `GITHUB_CLIENT_SECRET` | Secret | the client secret |
| `ALLOWED_USERS` | Text | `KennySB123` (comma-separate more logins if you ever want) |

Then **Deployments** → latest → **Retry deployment**, so the login functions see the new values.

### 5c. Log in

Visit `https://your-site/admin/` → **Log in with GitHub**. That's it.

> **Local or preview builds:** the login button only works on the domain in your callback
> URL. Anywhere else (e.g. `npm run dev`), use **"Use a personal access token instead"** with a
> [fine-grained token](https://github.com/settings/personal-access-tokens/new) limited to this
> repo, with Contents and Actions set to read and write.

> Prefer files? You can always skip the Studio and write Markdown in `src/content/blog/`.
> Both paths produce the same files.

---

## Step 6 (optional) — Turn on comments

Comments use **Giscus**, which stores them in your repo's GitHub Discussions. Free, no ads.

1. Make the repo **public** (Giscus requires it) and enable **Discussions** in the repo's
   Settings → General → Features.
2. Install the [Giscus GitHub app](https://github.com/apps/giscus) on the repo.
3. Go to <https://giscus.app>, enter your repo, choose the **Discussions** mapping =
   `pathname` and a category (e.g. **Announcements**). It generates a snippet containing
   `data-repo-id` and `data-category-id`.
4. Copy those values into the `GISCUS` block in **`src/consts.ts`** and set `enabled: true`:

   ```ts
   export const GISCUS = {
     enabled: true,
     repo: 'YOUR-USERNAME/YOUR-REPO',
     repoId: 'R_xxx',
     category: 'Announcements',
     categoryId: 'DIC_xxx',
   };
   ```

5. Commit and push. Comments now appear at the bottom of every post.

---

## Step 7 — Connect the platforms

Distribution runs in GitHub Actions (free for public repos). It reads API keys from **GitHub
secrets**: repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

Add only the platforms you want. A platform without its keys is **skipped**, not failed, and the
Studio shows "Missing secret …" next to it.

| Platform | Secrets | Where to get them |
|---|---|---|
| DEV | `DEVTO_API_KEY` | <https://dev.to/settings/extensions> → DEV Community API Keys → Generate |
| Hashnode | `HASHNODE_TOKEN`, `HASHNODE_PUBLICATION_ID` | Token: <https://hashnode.com/settings/developer>. Publication ID: open your blog dashboard; it is the id in the URL `hashnode.com/<id>/dashboard` |
| Bluesky | `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD` | Handle like `kenny.bsky.social`. App password: Bluesky → Settings → Privacy and security → App passwords |
| Mastodon | `MASTODON_INSTANCE`, `MASTODON_TOKEN` | Instance like `mastodon.social`. Token: your instance → Preferences → Development → New application, scope `write:statuses` → copy "Your access token" |
| Video scripts | `ANTHROPIC_API_KEY` | <https://console.anthropic.com> → API keys. Not needed if you choose the "word for word" script style |
| YouTube | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN` | See Step 8 |

Then choose the defaults in the Studio under **Distribution**: what is on, when it happens, the
text of social posts, the voice and privacy of videos.

> **Before you add keys, delete the three starter posts** (or leave the "Only send essays dated on
> or after" setting as it is). Essays dated before that day never go out automatically.

---

## Step 8 — YouTube channel and upload access

About 20 minutes, once. You need a Google account.

**1. Create the channel.** Go to <https://www.youtube.com> → your avatar → **Create a channel**.
For a channel with its own name (not your personal name), pick the option to use a custom name,
which creates a Brand Account. Then verify the channel at <https://www.youtube.com/verify>. This
unlocks custom thumbnails and videos over 15 minutes.

**2. Create a Google Cloud project.** At <https://console.cloud.google.com>, create a project
(e.g. `kenny-blog-videos`). Then **APIs & Services → Library** → search **YouTube Data API v3** →
**Enable**.

**3. Set up the consent screen.** **APIs & Services → OAuth consent screen** (also called Google
Auth Platform): User type **External**, app name, your email. Add yourself as a test user. Then
**Publish app** so it is "In production". This matters: in "Testing" mode Google expires the
login after 7 days and uploads stop. You will see an "unverified app" warning when you log in
below; that is expected for a personal app. Click **Advanced → Go to …**.

**4. Create the OAuth client.** **APIs & Services → Credentials → Create credentials → OAuth
client ID → Desktop app**. Copy the client ID and client secret.

**5. Get the refresh token.** On your computer (Node.js 22+):

```bash
cd pipeline
npm install
YOUTUBE_CLIENT_ID=... YOUTUBE_CLIENT_SECRET=... npm run youtube-auth
```

Open the link it prints, **choose the new channel** (not your personal one), and allow access.
The terminal prints the refresh token.

**6. Add the three secrets** `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`
to GitHub (see Step 7).

**About privacy:** Google locks every video uploaded through an unaudited API project to
**private**. Leave "Upload as" on Private, watch each video, then publish it in YouTube Studio.
When you want uploads to go public directly, request the free audit at
<https://support.google.com/youtube/contact/yt_api_form>.

---

## Writing and publishing

**In the Studio** (`/admin`):

1. **+ New essay**. Type a title, press Enter, write. The bars fade while you type; move the
   mouse to bring them back. Your words are kept in the browser as you go.
2. **Settings** (top right): description, date, tags, hero image. Paste or drop images straight
   into the text.
3. **Distribution** tab: switch platforms on or off for this essay, or change their options.
   Changes here apply only to this essay.
4. **Publish**. The site updates in about a minute. With automatic distribution on, the essay
   then goes to every switched-on platform.
5. **Video:** Claude writes a narration script within a couple of minutes. The Studio shows
   "script to review". Open it, edit anything, then **Approve & render**. The video renders on
   GitHub Actions (about 10 to 20 minutes) and uploads to YouTube. Once it is public, it is
   embedded at the top of the essay.

**You can't lose your writing.** While you type, the Studio keeps a version every few
seconds in the browser, plus one on every save, publish, discard and delete. Open
**Settings → History** to see, restore or download any version. The **Backups** tab lists every
essay with history, including deleted and never-saved ones, and can recover them. In Chrome or
Edge on a computer, choose a **backup folder** there (put it in Dropbox, iCloud Drive or
OneDrive to copy it off the machine): each essay is then written to a `.md` file as you type,
with timestamped copies in `history/`. After a browser restart, click **Resume folder backup**
once.

Shortcuts: **Ctrl/Cmd+S** save, **Ctrl/Cmd+Shift+P** preview, **Ctrl/Cmd+B / I / K** bold,
italic, link, **Esc** close panels.

**In files:** create `src/content/blog/my-essay.md` with this frontmatter, then push:

```markdown
---
title: "My essay title"
description: "One or two sentences for cards, search, RSS and social posts."
pubDate: 2026-10-24
tags: ["essays"]
draft: false
# optional, per essay:
distribute:
  mastodon: { enabled: false }
  youtube: { privacy: unlisted, voice: bm_george }
---

Write in Markdown here.
```

Pushing a published essay runs the same distribution as the Studio.

### What goes where

| Platform | What it gets | On later edits |
|---|---|---|
| DEV, Hashnode | The full essay, with a canonical link back to your site | Updated (you can turn this off) |
| Bluesky, Mastodon | One announcement post with a link | Never posted again |
| YouTube | A narrated read-along video, after you approve the script | Not changed |

Every result (links, errors, skips) is written to `src/data/syndication.json` and shown in the
Studio. The **Activity** tab links to each GitHub Actions run and its log.

---

## Troubleshooting

- **"Login is not set up yet"**: the Cloudflare variables are missing, or the site was not
  redeployed after adding them (Step 5b).
- **"Cannot see KennySB123/kenny-blog"**: the GitHub App is not installed on the repo (Step 5a.6).
- **A platform says "Missing secret"**: add that GitHub secret, then press **Retry** or
  **Distribute now** on the essay.
- **YouTube "invalid_grant"**: the refresh token expired, usually because the consent screen is
  still in Testing. Publish the app (Step 8.3) and run `npm run youtube-auth` again.
- **Video uploaded as private although you chose public**: expected until the API audit passes.
- **A video failed after rendering**: the video is attached to the GitHub Actions run as a
  download for 14 days.

---

## Cost summary

| Item | Cost |
|---|---|
| Hosting (Cloudflare Pages + login functions) | **£0** |
| GitHub repo and Actions (public repo) | **£0** |
| DEV, Hashnode, Bluesky, Mastodon | **£0** |
| Voice (Kokoro, runs on GitHub's machines) | **£0** |
| YouTube | **£0** |
| Video scripts (Claude API) | roughly 10p to 30p per essay; £0 with "word for word" scripts |
| Custom domain *(optional)* | ~£8–10/year |
