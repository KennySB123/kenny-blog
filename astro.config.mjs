import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// ⚠️ CHANGE THIS after your first deploy.
// Use your Cloudflare Pages URL (e.g. https://kenny-blog.pages.dev)
// or your custom domain (e.g. https://kennywrites.com).
// RSS and sitemap.xml need it to generate correct absolute links.
const SITE_URL = 'https://kenny-blog-39e.pages.dev';

export default defineConfig({
  site: SITE_URL,
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      wrap: true,
    },
  },
});
