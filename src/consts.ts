// ─────────────────────────────────────────────────────────────
// Everything you'll want to personalise lives in this one file.
// ─────────────────────────────────────────────────────────────

export const SITE = {
  title: "Kenny's Blog",
  // Shown in the header, under the title
  tagline: 'Notes, half-thoughts, and things I figured out the hard way.',
  // Used for <meta description> and the RSS feed
  description:
    'A personal blog about whatever currently has my attention.',
  author: 'Kenny',
  // Used for the RSS feed and og: tags
  lang: 'en',
};

export const NAV = [
  { href: '/', label: 'Home' },
  { href: '/blog', label: 'Writing' },
  { href: '/tags', label: 'Tags' },
  { href: '/archive', label: 'Archive' },
  { href: '/search', label: 'Search' },
  { href: '/about', label: 'About' },
];

export const SOCIALS = [
  // Delete any you don't want; add your own.
  { href: 'https://github.com/KennySB123', label: 'GitHub' },
  { href: 'mailto:kennysweeneybaird1@gmail.com', label: 'Email' },
];

// ── Giscus comments ──────────────────────────────────────────
// Comments are OFF until you fill these in.
// Get the values from https://giscus.app (see DEPLOY.md step 6).
export const GISCUS = {
  enabled: false, // ← flip to true once the values below are filled in
  repo: 'YOUR-USERNAME/YOUR-REPO',
  repoId: '',
  category: 'Announcements',
  categoryId: '',
};
