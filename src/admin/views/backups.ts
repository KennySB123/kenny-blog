// Backups: where your writing is kept, folder backup setup, and recovery of any
// essay with local history, including deleted or never-saved ones.
import { h, clear, toast, timeAgo, errorMessage } from '../dom';
import { summaries, snapshot, isPersisted, persistStorage, type Version } from '../backup';
import { folderStatus, folderName, chooseFolder, resumeFolder, forgetFolder, onFolderChange } from '../folder';
import { store } from '../state';
import { topbar } from './shell';
import { historyPanel } from './history';

export const AUTORESTORE_KEY = 'studio:autorestore';

/** Put a version into the "new essay" slot and open the editor on it. */
export async function recoverAsNew(v: Version) {
  const slot = 'studio:draft:__new__';
  try {
    const existing = localStorage.getItem(slot);
    if (existing) {
      const d = JSON.parse(existing);
      await snapshot('__new__', { title: d.title ?? '', body: d.body ?? '', data: d.data }, 'before-restore');
    }
    localStorage.setItem(slot, JSON.stringify({ title: v.title, body: v.body, data: { ...v.data, draft: true }, savedAt: Date.now(), baseSha: null }));
    sessionStorage.setItem(AUTORESTORE_KEY, '1');
  } catch (e) {
    toast(errorMessage(e), 'error');
    return;
  }
  location.hash = '#/new';
}

export function backupsView(root: HTMLElement): () => void {
  const folderBox = h('div', { class: 'stack-sm' });
  const persistBox = h('p', { class: 'hint' });
  const list = h('div', { class: 'stack-sm' }, h('p', { class: 'hint' }, 'Loading…'));

  function renderFolder() {
    const st = folderStatus();
    const name = folderName();
    const body =
      st === 'unsupported'
        ? [
            h('p', {}, 'This browser cannot write to a folder automatically. Chrome and Edge on a computer can.'),
            h('p', { class: 'hint' }, 'Your versions are still kept in this browser, and you can download any of them as a .md file.'),
          ]
        : st === 'granted'
          ? [
              h('p', { class: 'status status-done' }, name ? `Backing up to the folder "${name}"` : 'Backing up to your chosen folder'),
              h('p', { class: 'hint' }, 'Each essay is written there as <slug>.md while you type, with timestamped copies in history/. The files use the same format as the repository.'),
              h(
                'div',
                { class: 'input-row' },
                h('button', { class: 'btn btn-small', type: 'button', onclick: async () => (await chooseFolder()) && toast('Backup folder changed.', 'ok') }, 'Change folder'),
                h('button', { class: 'btn btn-small', type: 'button', onclick: () => forgetFolder() }, 'Stop folder backup')
              ),
            ]
          : st === 'prompt' || st === 'denied'
            ? [
                h('p', { class: 'status status-action' }, name ? `Folder backup to "${name}" is paused` : 'Folder backup is paused'),
                h('p', { class: 'hint' }, 'Browsers ask again after a restart. One click turns it back on.'),
                h(
                  'div',
                  { class: 'input-row' },
                  h('button', { class: 'btn btn-small btn-primary', type: 'button', onclick: async () => (await resumeFolder()) && toast('Folder backup is on again.', 'ok') }, 'Resume folder backup'),
                  h('button', { class: 'btn btn-small', type: 'button', onclick: () => forgetFolder() }, 'Stop folder backup')
                ),
              ]
            : [
                h('p', {}, 'Keep a live copy of every essay in a folder on this computer, for example in Dropbox, iCloud Drive or OneDrive so it is copied off the machine too.'),
                h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => (await chooseFolder()) && toast('Folder backup is on.', 'ok') }, 'Choose a backup folder'),
              ];
    clear(folderBox, ...body);
  }

  async function renderPersist() {
    const ok = (await isPersisted()) || (await persistStorage());
    persistBox.textContent = ok
      ? 'This browser has agreed to keep the Studio\'s backups even when disk space runs low.'
      : 'This browser may clear the Studio\'s backups if disk space runs low, or if you clear site data. A backup folder protects against that.';
  }

  async function renderList() {
    let rows;
    try {
      rows = await summaries();
    } catch (e) {
      clear(list, h('p', { class: 'notice notice-error' }, `Backups are not available in this browser: ${errorMessage(e)}`));
      return;
    }
    if (!rows.length) {
      clear(list, h('p', { class: 'hint' }, 'Nothing backed up yet. Versions appear here as soon as you start writing.'));
      return;
    }
    clear(
      list,
      rows.map((r) => {
        const post = store.posts.get(r.key);
        const state = r.key === '__new__' ? 'Unsaved new essay' : post ? (post.data.draft ? 'Draft on GitHub' : 'Live') : 'Not on GitHub (deleted or never saved)';
        const panel = historyPanel({
          key: () => r.key,
          fileBase: () => (r.key === '__new__' ? 'new-essay' : r.key),
          restoreLabel: 'Recover as a new essay',
          onRestore: (v) => recoverAsNew(v),
        });
        return h(
          'details',
          { class: 'card-plain backup-item' },
          h(
            'summary',
            {},
            h('strong', {}, r.title || 'Untitled'),
            h('span', { class: 'hint' }, ` · ${state} · ${r.count} version${r.count === 1 ? '' : 's'} · last ${timeAgo(r.latest)}`)
          ),
          post ? h('p', {}, h('a', { href: `#/edit/${encodeURIComponent(r.key)}` }, 'Open in the editor'), h('span', { class: 'hint' }, ' to restore a version in place, from Settings → History.')) : null,
          panel.el
        );
      })
    );
  }

  clear(
    root,
    topbar('backups'),
    h(
      'main',
      { class: 'studio-main' },
      h('div', { class: 'studio-head' }, h('h1', {}, 'Backups')),
      h(
        'section',
        { class: 'card-plain stack-sm' },
        h('h2', {}, 'How your writing is kept safe'),
        h(
          'ul',
          { class: 'plain-list' },
          h('li', {}, h('strong', {}, 'Every few seconds'), ' while you type, a version is saved in this browser.'),
          h('li', {}, h('strong', {}, 'Every save, publish, discard and delete'), ' also keeps a version, so nothing you throw away is gone.'),
          h('li', {}, h('strong', {}, 'With a backup folder'), ', the essay is also written to a file on your computer as you type.'),
          h('li', {}, h('strong', {}, 'Saved and published essays'), ' are also in Git on GitHub, with their full history.')
        ),
        persistBox
      ),
      h('section', { class: 'card-plain stack-sm' }, h('h2', {}, 'Backup folder'), folderBox),
      h('h2', {}, 'Essays with local history'),
      list
    )
  );

  renderFolder();
  renderPersist();
  renderList();
  const off = onFolderChange(renderFolder);
  return () => off();
}
