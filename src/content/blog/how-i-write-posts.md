---
title: "Every knob you can turn on this site"
description: "A short reference for changing the design, the navigation, and the bits that need your details filled in."
pubDate: 2026-07-19
tags: ["meta"]
draft: false
---

Keeping this one as a cheat sheet. Delete it once the site feels like yours.

## Change the words in the header and footer

Everything personal lives in `src/consts.ts` — site title, tagline, your name, the nav
links, and your social links. It's the first file to edit.

## Change the colours

Open `src/styles/global.css`. The top of the file is a block of CSS variables:

```css
:root {
  --accent: #E1552F;  /* coral — links, buttons */
  --mint:   #1E8F72;  /* second accent — tags */
  --sun:    #F5B72E;  /* third accent — highlights */
}
```

Change those three and the whole site shifts. The `[data-theme='dark']` block below does
the same job for dark mode.

## Change the fonts

Headings use **Fraunces**, which has `SOFT` and `WONK` variable axes — that's where the
slightly-wobbly, hand-set feel comes from. Body text is **Nunito**. Both load from Google
Fonts in `src/layouts/BaseLayout.astro`. Swap the `<link>` and update `--font-display` /
`--font-body` in the CSS.

## Add a page

Any `.astro` file in `src/pages/` becomes a URL. `src/pages/now.astro` → `/now`. Copy
`about.astro` as a starting point and add it to the `NAV` array in `consts.ts`.

## Things that need your details

Three places have placeholders:

- `astro.config.mjs` — set `SITE_URL` to your real domain after the first deploy
- `src/consts.ts` — the `GISCUS` block, for comments
- `public/admin/config.yml` — your GitHub repo, for the browser editor

`DEPLOY.md` in the project root walks through each one.
