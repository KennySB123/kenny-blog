// Platform metadata and the option fields the editor and settings page render.

export const PLATFORMS = ['devto', 'hashnode', 'medium', 'substack', 'bluesky', 'mastodon', 'x', 'youtube'] as const;
export type Platform = (typeof PLATFORMS)[number];

export type FieldType = 'select' | 'text' | 'textarea' | 'number' | 'checkbox';

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
  options?: [string, string][];
  min?: number;
  max?: number;
  step?: number;
}

export interface PlatformInfo {
  label: string;
  /** One or two letters for the status dots in the essay list. */
  short: string;
  /** manual: no API allows it, so the Studio prepares it and you post it in one or two clicks. */
  kind: 'mirror' | 'announce' | 'video' | 'manual';
  blurb: string;
  secrets: string[];
  fields: Field[];
}

const TEMPLATE_HINT = 'Placeholders: {title} {description} {url} {tags}';

export const VOICES: [string, string][] = [
  ['af_heart', 'Heart (US, warm, best quality)'],
  ['af_bella', 'Bella (US)'],
  ['af_nicole', 'Nicole (US, soft)'],
  ['am_michael', 'Michael (US)'],
  ['am_fenrir', 'Fenrir (US)'],
  ['bf_emma', 'Emma (UK)'],
  ['bf_isabella', 'Isabella (UK)'],
  ['bm_george', 'George (UK)'],
  ['bm_fable', 'Fable (UK)'],
  ['bm_lewis', 'Lewis (UK)'],
];

export const PLATFORM_INFO: Record<Platform, PlatformInfo> = {
  devto: {
    label: 'DEV',
    short: 'D',
    kind: 'mirror',
    blurb: 'Full copy of the essay on dev.to, with a canonical link back here.',
    secrets: ['DEVTO_API_KEY'],
    fields: [
      {
        key: 'publishAs',
        label: 'Publish as',
        type: 'select',
        options: [
          ['published', 'Published'],
          ['draft', 'Draft on DEV (publish it there yourself)'],
        ],
      },
      { key: 'series', label: 'Series name', type: 'text', hint: 'Optional. Groups posts into a series on DEV.' },
    ],
  },
  hashnode: {
    label: 'Hashnode',
    short: 'H',
    kind: 'mirror',
    blurb: 'Full copy on your Hashnode blog, with a canonical link back here.',
    secrets: ['HASHNODE_TOKEN', 'HASHNODE_PUBLICATION_ID'],
    fields: [
      {
        key: 'publishAs',
        label: 'Publish as',
        type: 'select',
        options: [
          ['published', 'Published'],
          ['draft', 'Draft on Hashnode'],
        ],
      },
    ],
  },
  medium: {
    label: 'Medium',
    short: 'Me',
    kind: 'manual',
    blurb: 'Medium no longer lets new apps post. The Studio copies the essay link and opens Medium\'s own import tool, which keeps the link back to your site. Then you mark it as posted.',
    secrets: [],
    fields: [],
  },
  substack: {
    label: 'Substack',
    short: 'S',
    kind: 'manual',
    blurb: 'Substack has no way to post automatically. The Studio copies the title and the formatted essay and opens your Substack editor. Paste, check, send.',
    secrets: [],
    fields: [{ key: 'publication', label: 'Your Substack address', type: 'text', hint: 'For example kenny.substack.com, or your custom domain.' }],
  },
  bluesky: {
    label: 'Bluesky',
    short: 'B',
    kind: 'announce',
    blurb: 'One post announcing the essay, with a link card. Never repeated on edits.',
    secrets: ['BLUESKY_HANDLE', 'BLUESKY_APP_PASSWORD'],
    fields: [{ key: 'template', label: 'Post text', type: 'textarea', hint: `${TEMPLATE_HINT}. Max 300 characters; the link card is added for you.` }],
  },
  mastodon: {
    label: 'Mastodon',
    short: 'M',
    kind: 'announce',
    blurb: 'One toot announcing the essay. Never repeated on edits.',
    secrets: ['MASTODON_INSTANCE', 'MASTODON_TOKEN'],
    fields: [
      { key: 'template', label: 'Post text', type: 'textarea', hint: `${TEMPLATE_HINT}. Max 500 characters.` },
      {
        key: 'visibility',
        label: 'Visibility',
        type: 'select',
        options: [
          ['public', 'Public'],
          ['unlisted', 'Unlisted'],
          ['private', 'Followers only'],
        ],
      },
    ],
  },
  x: {
    label: 'X',
    short: 'X',
    kind: 'announce',
    blurb: 'One post announcing the essay, through X\'s official API. X charges per post from prepaid credits (a post with a link costs more). Never repeated on edits.',
    secrets: ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'],
    fields: [
      { key: 'template', label: 'Post text', type: 'textarea', hint: `${TEMPLATE_HINT}. Max 280 characters; links count as 23.` },
      { key: 'includeLink', label: 'Include the link (X charges more for posts with links)', type: 'checkbox' },
    ],
  },
  youtube: {
    label: 'YouTube',
    short: 'Y',
    kind: 'video',
    blurb: 'Claude writes a narration script, you approve it here, then a read-along video renders and uploads.',
    secrets: ['ANTHROPIC_API_KEY', 'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'],
    fields: [
      {
        key: 'scriptStyle',
        label: 'Script',
        type: 'select',
        options: [
          ['adapted', 'Adapted for listening by Claude (recommended)'],
          ['verbatim', 'Read the essay word for word'],
        ],
      },
      { key: 'notes', label: 'Notes for the scriptwriter', type: 'textarea', hint: 'Optional. Tone, names to pronounce, things to cut.' },
      { key: 'voice', label: 'Voice', type: 'select', options: VOICES },
      { key: 'speed', label: 'Speaking speed', type: 'number', min: 0.7, max: 1.3, step: 0.05 },
      {
        key: 'privacy',
        label: 'Upload as',
        type: 'select',
        options: [
          ['private', 'Private (check it, then publish in YouTube Studio)'],
          ['unlisted', 'Unlisted'],
          ['public', 'Public'],
        ],
      },
      { key: 'playlistId', label: 'Playlist ID', type: 'text', hint: 'Optional. Adds each video to this playlist.' },
      { key: 'declareSynthetic', label: 'Label as synthetic voice on YouTube', type: 'checkbox' },
      { key: 'showOnSite', label: 'Embed the video on the essay page', type: 'checkbox' },
    ],
  },
};

export type PlatformSettings = Record<string, unknown> & { enabled?: boolean };

export interface DistributionSettings {
  trigger: 'on-publish' | 'manual';
  autoSince?: string;
  updateMirrorsOnEdit: boolean;
  platforms: Record<Platform, PlatformSettings>;
}

/** Global defaults merged with one post's overrides. */
export function effective(
  settings: DistributionSettings,
  overrides: Record<string, PlatformSettings> | undefined,
  p: Platform
): PlatformSettings {
  return { ...(settings.platforms[p] ?? {}), ...(overrides?.[p] ?? {}) };
}
