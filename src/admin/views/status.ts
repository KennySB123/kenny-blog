// Shared helpers that describe where a post stands on each platform.
import { h } from '../dom';
import { store, type LedgerEntry, type Job } from '../state';
import { PLATFORMS, PLATFORM_INFO, effective, type Platform } from '../platforms';

export type StatusKind = 'done' | 'error' | 'pending' | 'off' | 'skipped' | 'action';

export interface PlatformStatus {
  kind: StatusKind;
  text: string;
  url?: string;
}

export function platformStatus(slug: string, p: Platform, enabled: boolean): PlatformStatus {
  const entry: LedgerEntry | undefined = store.ledger.posts[slug]?.[p];
  if (p === 'youtube') return videoStatus(slug, enabled, entry);
  if (entry?.removed) return { kind: 'off', text: 'Removed' };
  if (entry?.url) return { kind: 'done', text: 'Live', url: entry.url };
  if (entry?.error) return { kind: 'error', text: `Failed: ${entry.error}` };
  if (!enabled) return { kind: 'off', text: 'Off' };
  if (entry?.skipped) return { kind: 'skipped', text: entry.skipped };
  return { kind: 'pending', text: 'Not sent yet' };
}

function videoStatus(slug: string, enabled: boolean, entry?: LedgerEntry): PlatformStatus {
  if (entry?.url && !entry.removed) return { kind: 'done', text: entry.privacy ? `Uploaded (${entry.privacy})` : 'Uploaded', url: entry.url };
  const job: Job | undefined = store.jobs.get(slug);
  const s = job?.job?.status;
  switch (s) {
    case 'generating':
      return { kind: 'pending', text: 'Writing the script…' };
    case 'review':
      return { kind: 'action', text: 'Script ready for your review' };
    case 'approved':
    case 'rendering':
      return { kind: 'pending', text: 'Rendering the video…' };
    case 'failed':
      return { kind: 'error', text: `Failed: ${job?.job?.error ?? 'unknown error'}` };
    case 'cancelled':
      return { kind: 'off', text: 'Video skipped' };
  }
  if (entry?.error) return { kind: 'error', text: `Failed: ${entry.error}` };
  if (!enabled) return { kind: 'off', text: 'Off' };
  if (entry?.skipped) return { kind: 'skipped', text: entry.skipped };
  return { kind: 'pending', text: 'No script yet' };
}

/** Row of small dots for the post list. */
export function statusDots(slug: string, overrides: Record<string, any> | undefined) {
  return h(
    'span',
    { class: 'dots' },
    PLATFORMS.map((p) => {
      const on = effective(store.settings, overrides, p).enabled !== false;
      const st = platformStatus(slug, p, on);
      return h('span', { class: `dot dot-${st.kind}`, title: `${PLATFORM_INFO[p].label}: ${st.text}` }, PLATFORM_INFO[p].label.slice(0, 1));
    })
  );
}
