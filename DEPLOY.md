# Deploy guide — from folder to live site

Goal: your blog live on the internet, for free, in about 20 minutes. You'll need a
[GitHub](https://github.com) account (free) and a [Cloudflare](https://dash.cloudflare.com/sign-up)
account (free). No credit card required for either.

The **minimum** to be live is Steps 1–3. Steps 4–6 add a custom domain, the browser editor,
and comments — do them whenever you like.

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

## Step 5 (optional) — Enable the browser editor (`/admin`)

This lets you write and publish posts from any browser without touching code. It uses
**Sveltia CMS**, which commits to your GitHub repo on your behalf.

### 5a. Point the CMS at your repo

Edit **`public/admin/config.yml`** and set:

```yaml
backend:
  name: github
  repo: YOUR-USERNAME/YOUR-REPO   # ← your repo
  branch: main
```

### 5b. Set up GitHub login (one-time auth worker)

Sveltia needs a tiny OAuth helper so GitHub login works. The maintained one-click option:

1. Follow the [Sveltia CMS auth setup](https://github.com/sveltia/sveltia-cms-auth#readme)
   — it deploys a small free Cloudflare Worker and walks you through creating a GitHub
   OAuth app (takes ~5 minutes).
2. It gives you a worker URL. Put it in `config.yml`:

   ```yaml
   backend:
     base_url: https://sveltia-cms-auth.YOUR-SUBDOMAIN.workers.dev
   ```

3. Commit and push. Now visit `https://your-domain/admin`, log in with GitHub, and write.

> Prefer zero setup? You can always skip `/admin` entirely and just write Markdown files in
> `src/content/blog/` and push. The CMS is a convenience, not a requirement.

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

## Writing your next post

**In the browser:** go to `/admin`, click **New Post**, fill in the fields, toggle Draft
off, publish. It commits to GitHub and the site rebuilds in ~30 seconds.

**In files:** create `src/content/blog/my-post.md` with this frontmatter, then push:

```markdown
---
title: "My post title"
description: "One or two sentences for cards, search, and RSS."
pubDate: 2026-07-22
tags: ["notes"]
draft: false
---

Write in Markdown here.
```

---

## Cost summary

| Item | Cost |
|---|---|
| Hosting (Cloudflare Pages) | **£0** — unlimited bandwidth |
| GitHub repo | **£0** |
| Browser editor (Sveltia + Worker) | **£0** |
| Comments (Giscus) | **£0** |
| Search, RSS, sitemap | **£0** |
| Custom domain *(optional)* | ~£8–10/year |

That's the whole bill. Everything except the optional domain is genuinely, permanently free.
