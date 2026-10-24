import { h, clear, toast, errorMessage } from '../dom';
import { store, DEFAULT_SETTINGS } from '../state';
import { updateJson, listSecretNames } from '../github';
import { PATHS } from '../config';
import { PLATFORMS, PLATFORM_INFO, type DistributionSettings } from '../platforms';
import { renderField, toggle } from './fields';
import { topbar } from './shell';

export function settingsView(root: HTMLElement) {
  const draft: DistributionSettings = structuredClone(store.settings);
  const secretsBox = h('div', {});
  const saveBtn = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => save() }, 'Save settings');

  async function save() {
    saveBtn.disabled = true;
    try {
      await updateJson<DistributionSettings>(PATHS.settings, () => draft, 'Update distribution settings', DEFAULT_SETTINGS);
      store.settings = structuredClone(draft);
      toast('Settings saved. They apply to the next essay you publish.', 'ok');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      saveBtn.disabled = false;
    }
  }

  const radio = (value: DistributionSettings['trigger'], label: string, hint: string) =>
    h(
      'label',
      { class: 'radio' },
      h('input', {
        type: 'radio',
        name: 'trigger',
        value,
        checked: draft.trigger === value,
        onchange: () => (draft.trigger = value),
      }),
      h('span', {}, h('strong', {}, label), h('br'), h('span', { class: 'hint' }, hint))
    );

  clear(
    root,
    topbar('settings'),
    h(
      'main',
      { class: 'studio-main' },
      h('div', { class: 'studio-head' }, h('h1', {}, 'Distribution'), saveBtn),
      h('p', { class: 'muted' }, 'These are the defaults for every essay. Any essay can override them in its own Settings → Distribution tab.'),
      h(
        'section',
        { class: 'card-plain stack' },
        h('h2', {}, 'When'),
        radio('on-publish', 'Automatically when I publish', 'Each switched-on platform gets the essay as soon as it goes live.'),
        radio('manual', 'Only when I press "Distribute now"', 'Publishing only updates the site. You decide when to send it out.'),
        h(
          'div',
          { class: 'field' },
          h('label', { for: 'auto-since' }, 'Only send essays dated on or after'),
          h('input', {
            id: 'auto-since',
            class: 'input input-narrow',
            type: 'date',
            value: draft.autoSince ?? '',
            style: 'max-width: 12rem',
            onchange: (e: Event) => (draft.autoSince = (e.target as HTMLInputElement).value || undefined),
          }),
          h('p', { class: 'hint' }, 'Older essays are never sent automatically, so editing an old post will not announce it. "Distribute now" still works for any essay.')
        ),
        renderField(
          { key: 'updateMirrorsOnEdit', label: 'Update the DEV and Hashnode copies when I edit a published essay', type: 'checkbox' },
          draft.updateMirrorsOnEdit,
          (v) => (draft.updateMirrorsOnEdit = v as boolean)
        )
      ),
      PLATFORMS.map((p) => {
        const info = PLATFORM_INFO[p];
        const s = draft.platforms[p];
        return h(
          'section',
          { class: 'card-plain stack' },
          h('div', { class: 'platform-head' }, h('h2', {}, info.label), toggle('On by default', s.enabled !== false, (v) => (s.enabled = v))),
          h('p', { class: 'hint' }, info.blurb),
          info.fields.map((f) => renderField(f, s[f.key], (v) => (s[f.key] = v)))
        );
      }),
      h('section', { class: 'card-plain stack' }, h('h2', {}, 'Secrets'), secretsBox),
      h('p', {}, h('button', { class: 'btn btn-primary', type: 'button', onclick: () => save() }, 'Save settings'))
    )
  );

  listSecretNames().then((names) => {
    clear(
      secretsBox,
      h(
        'p',
        { class: 'hint' },
        'Platforms need API keys stored as GitHub Actions secrets (repo Settings → Secrets and variables → Actions). A platform without its secrets is skipped, not failed. See DEPLOY.md for where to get each one.'
      ),
      h(
        'ul',
        { class: 'secret-list' },
        PLATFORMS.flatMap((p) =>
          PLATFORM_INFO[p].secrets.map((s) =>
            h(
              'li',
              {},
              h('code', {}, s),
              ' ',
              h('span', { class: 'hint' }, `(${PLATFORM_INFO[p].label})`),
              names ? h('span', { class: `pill ${names.includes(s) ? 'pill-mint' : 'pill-sun'}` }, names.includes(s) ? 'set' : 'missing') : null
            )
          )
        )
      ),
      names ? null : h('p', { class: 'hint' }, 'Your login cannot read the secret list, so their status is not shown.')
    );
  });
}
