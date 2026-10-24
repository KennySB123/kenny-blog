import ledger from '../data/syndication.json';
import settings from '../data/distribution.json';

/** Platform ids, in the order they appear in the UI. */
export const PLATFORMS = ['devto', 'hashnode', 'medium', 'substack', 'bluesky', 'mastodon', 'x', 'youtube'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  devto: 'DEV',
  hashnode: 'Hashnode',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  x: 'X',
  medium: 'Medium',
  substack: 'Substack',
  youtube: 'YouTube',
};

interface LedgerEntry {
  url?: string;
  id?: string | number;
  privacy?: string;
  showOnSite?: boolean;
  removed?: boolean;
}

type Ledger = { posts: Record<string, Partial<Record<Platform, LedgerEntry>>> };

/** Where a post has been published, as written back by the pipeline. */
export function getSyndication(slug: string) {
  const entry = (ledger as Ledger).posts[slug] ?? {};
  const links = PLATFORMS.filter((p) => p !== 'youtube')
    .map((p) => ({ platform: p, label: PLATFORM_LABELS[p], url: entry[p]?.url }))
    .filter((l): l is { platform: Platform; label: string; url: string } =>
      Boolean(l.url) && !entry[l.platform]?.removed
    );

  const yt = entry.youtube;
  const defaultShow = (settings.platforms.youtube as { showOnSite?: boolean }).showOnSite ?? true;
  const showVideo =
    !!yt?.id && !yt.removed && (yt.showOnSite ?? (defaultShow && yt.privacy !== 'private'));

  return {
    links,
    youtubeId: showVideo ? String(yt!.id) : null,
    youtubeUrl: yt?.url && !yt.removed ? yt.url : null,
  };
}
