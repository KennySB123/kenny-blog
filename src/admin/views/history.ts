// A list of local versions with preview, restore and download.
import { h, clear, timeAgo, errorMessage } from '../dom';
import { listVersions, downloadText, stamp, REASON_TEXT, type Version } from '../backup';
import { serializePost } from '../frontmatter';

interface Options {
  key: () => string;
  fileBase: () => string;
  restoreLabel: string;
  onRestore: (v: Version) => void;
  empty?: string;
}

export function versionText(v: Version) {
  return serializePost({ ...v.data, title: v.title.replace(/\s*\n\s*/g, ' ').trim() }, v.body);
}

function when(at: number) {
  const d = new Date(at);
  const today = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return today ? `Today ${time}` : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} ${time}`;
}

export function historyPanel(opts: Options) {
  const root = h('div', { class: 'stack-sm history' });
  let shown = 40;
  let open: number | null = null;

  async function render() {
    let versions: Version[];
    try {
      versions = await listVersions(opts.key());
    } catch (e) {
      clear(root, h('p', { class: 'notice notice-error' }, `Backups are not available in this browser: ${errorMessage(e)}`));
      return;
    }
    if (!versions.length) {
      clear(root, h('p', { class: 'hint' }, opts.empty ?? 'No versions yet. They appear here as you write.'));
      return;
    }
    clear(
      root,
      h('p', { class: 'hint' }, `${versions.length} version${versions.length === 1 ? '' : 's'} kept in this browser. Newest first.`),
      h(
        'ol',
        { class: 'version-list' },
        versions.slice(0, shown).map((v, i) => {
          const prev = versions[i + 1];
          const delta = prev ? v.words - prev.words : v.words;
          const isOpen = open === v.id;
          return h(
            'li',
            { class: `version ${isOpen ? 'version-open' : ''}` },
            h(
              'button',
              {
                class: 'version-row',
                type: 'button',
                'aria-expanded': String(isOpen),
                onclick: () => {
                  open = isOpen ? null : v.id!;
                  render();
                },
              },
              h('span', { class: 'version-when' }, when(v.at)),
              h('span', { class: 'version-meta' }, `${REASON_TEXT[v.reason] ?? v.reason} · ${v.words.toLocaleString('en-GB')} words`, delta ? ` (${delta > 0 ? '+' : ''}${delta})` : '')
            ),
            isOpen
              ? h(
                  'div',
                  { class: 'version-preview' },
                  h('strong', {}, v.title || 'Untitled'),
                  h('pre', {}, v.body.length > 1500 ? v.body.slice(0, 1500) + '\n…' : v.body || '(empty)'),
                  h(
                    'div',
                    { class: 'input-row' },
                    h('button', { class: 'btn btn-small btn-primary', type: 'button', onclick: () => opts.onRestore(v) }, opts.restoreLabel),
                    h(
                      'button',
                      { class: 'btn btn-small', type: 'button', onclick: () => downloadText(`${opts.fileBase()}-${stamp(v.at)}.md`, versionText(v)) },
                      'Download .md'
                    ),
                    h('span', { class: 'hint' }, timeAgo(v.at))
                  )
                )
              : null
          );
        })
      ),
      versions.length > shown
        ? h(
            'button',
            {
              class: 'btn btn-small',
              type: 'button',
              onclick: () => {
                shown += 60;
                render();
              },
            },
            `Show older (${versions.length - shown} more)`
          )
        : null
    );
  }

  render();
  return { el: root, render };
}
