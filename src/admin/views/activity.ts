import { h, clear, timeAgo, errorMessage } from '../dom';
import { listRuns, type Run } from '../github';
import { refresh } from '../state';
import { topbar } from './shell';

export function activityView(root: HTMLElement): () => void {
  const list = h('ul', { class: 'run-list' }, h('li', { class: 'empty' }, 'Loading…'));
  let timer: number | undefined;
  let stopped = false;

  function badge(r: Run) {
    if (r.status !== 'completed') return h('span', { class: 'pill pill-sun' }, r.status === 'queued' ? 'queued' : 'running');
    const ok = r.conclusion === 'success';
    return h('span', { class: `pill ${ok ? 'pill-mint' : r.conclusion === 'skipped' || r.conclusion === 'cancelled' ? '' : 'pill-accent'}` }, r.conclusion ?? 'done');
  }

  async function load() {
    try {
      const runs = await listRuns();
      clear(
        list,
        runs.length === 0
          ? h('li', { class: 'empty' }, 'Nothing has run yet.')
          : runs.map((r) =>
              h(
                'li',
                {},
                h(
                  'a',
                  { class: 'run-row', href: r.html_url, target: '_blank', rel: 'noopener' },
                  badge(r),
                  h('span', { class: 'run-main' }, h('strong', {}, r.name), h('span', { class: 'hint' }, ` · ${r.display_title}`)),
                  h('span', { class: 'hint' }, `${r.event === 'workflow_dispatch' ? 'manual' : r.event} · ${timeAgo(r.created_at)}`)
                )
              )
            )
      );
      if (!stopped && runs.some((r) => r.status !== 'completed')) timer = window.setTimeout(load, 10000);
    } catch (e) {
      clear(list, h('li', { class: 'empty' }, `Could not load runs: ${errorMessage(e)}`));
    }
  }

  clear(
    root,
    topbar('activity'),
    h(
      'main',
      { class: 'studio-main' },
      h(
        'div',
        { class: 'studio-head' },
        h('h1', {}, 'Activity'),
        h(
          'button',
          {
            class: 'btn',
            type: 'button',
            onclick: async () => {
              await refresh().catch(() => {});
              load();
            },
          },
          'Refresh'
        )
      ),
      h('p', { class: 'muted' }, 'Site builds run on Cloudflare. Distribution and video jobs run on GitHub Actions and show up here. Click a run to see its log.'),
      list
    )
  );
  load();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
