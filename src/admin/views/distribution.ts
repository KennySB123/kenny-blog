// The "Distribution" tab of the editor drawer: per-essay overrides + live status.
import { h, clear, toast, errorMessage } from '../dom';
import { store } from '../state';
import { PLATFORMS, PLATFORM_INFO, effective, type Platform, type PlatformSettings } from '../platforms';
import { renderField, toggle } from './fields';
import { platformStatus } from './status';
import { dispatchDistribute, updateJson } from '../github';
import { PATHS } from '../config';
import { essayUrl, essayHtml, copyRich, copyText, substackEditorUrl, MEDIUM_IMPORT_URL, markPosted } from '../manual';

interface Ctx {
  slug: () => string | null;
  isLive: () => boolean;
  isDirty: () => boolean;
  overrides: () => Record<string, PlatformSettings>;
  setOverrides: (o: Record<string, PlatformSettings>) => void;
}

export function distributionPanel(ctx: Ctx) {
  const root = h('div', { class: 'stack' });
  const openOptions = new Set<Platform>();

  function setValue(p: Platform, key: string, value: unknown) {
    const o = structuredClone(ctx.overrides());
    const globalValue = store.settings.platforms[p]?.[key];
    const mine = { ...(o[p] ?? {}) };
    if (JSON.stringify(globalValue) === JSON.stringify(value)) delete mine[key];
    else mine[key] = value;
    if (Object.keys(mine).length) o[p] = mine;
    else delete o[p];
    ctx.setOverrides(o);
    render();
  }

  function render() {
    const slug = ctx.slug();
    const overrides = ctx.overrides();
    const manual = store.settings.trigger === 'manual';

    clear(
      root,
      h(
        'p',
        { class: 'muted small' },
        manual
          ? 'Distribution is manual. Nothing goes out until you press "Distribute now".'
          : 'Everything switched on goes out automatically when you publish.',
        ' Defaults live in ',
        h('a', { href: '#/settings' }, 'Distribution settings'),
        '. Changes here apply to this essay only and are saved with it.'
      ),
      PLATFORMS.map((p) => {
        const info = PLATFORM_INFO[p];
        const eff = effective(store.settings, overrides, p);
        const enabled = eff.enabled !== false;
        const st = slug ? platformStatus(slug, p, enabled) : { kind: 'pending', text: 'Not published yet' as string, url: undefined as string | undefined };
        const mine = overrides[p] ?? {};
        const job = slug ? store.jobs.get(slug)?.job : null;

        const options = h(
          'details',
          {
            class: 'platform-options',
            open: openOptions.has(p),
            ontoggle: (e: Event) => ((e.target as HTMLDetailsElement).open ? openOptions.add(p) : openOptions.delete(p)),
          },
          h('summary', {}, Object.keys(mine).some((k) => k !== 'enabled') ? 'Options (customised)' : 'Options'),
          info.fields.map((f) =>
            renderField(f, eff[f.key], (v) => setValue(p, f.key, v), {
              overridden: f.key in mine,
              onReset: () => setValue(p, f.key, store.settings.platforms[p]?.[f.key]),
            })
          )
        );

        return h(
          'section',
          { class: `platform ${enabled ? '' : 'platform-off'}` },
          h(
            'div',
            { class: 'platform-head' },
            toggle(info.label, enabled, (v) => setValue(p, 'enabled', v)),
            'enabled' in mine ? h('span', { class: 'override small' }, 'this essay only') : null
          ),
          h('p', { class: 'hint' }, info.blurb),
          h(
            'p',
            { class: `status status-${st.kind}` },
            st.url ? h('a', { href: st.url, target: '_blank', rel: 'noopener' }, st.text + ' ↗') : st.text,
            p === 'youtube' && slug && job && ['review', 'failed'].includes(job.status)
              ? h('a', { class: 'btn btn-small', href: `#/video/${encodeURIComponent(slug)}` }, job.status === 'review' ? 'Review script' : 'Open script')
              : null,
            st.kind === 'error' && slug && p !== 'youtube'
              ? h('button', { class: 'btn btn-small', type: 'button', onclick: () => send(p) }, 'Retry')
              : null
          ),
          p === 'youtube' && slug ? videoExtras(slug) : null,
          info.kind === 'manual' && enabled ? manualExtras(p, slug) : null,
          info.fields.length ? options : null
        );
      }),
      h(
        'div',
        { class: 'stack-sm' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => send() }, 'Distribute now'),
        h('p', { class: 'hint' }, 'Sends this essay to every platform that is switched on and has not had it yet. Mirrors that already exist get updated.')
      )
    );
  }

  function videoExtras(slug: string) {
    const entry = store.ledger.posts[slug]?.youtube;
    if (!entry?.url || entry.removed) return null;
    const shown = entry.showOnSite ?? (effective(store.settings, ctx.overrides(), 'youtube').showOnSite !== false && entry.privacy !== 'private');
    return h(
      'div',
      { class: 'stack-sm' },
      toggle('Show the video on the essay page', !!shown, async (v) => {
        try {
          await updateJson<any>(
            PATHS.ledger,
            (l) => {
              l.posts ??= {};
              l.posts[slug] ??= {};
              l.posts[slug].youtube = { ...(l.posts[slug].youtube ?? {}), showOnSite: v };
            },
            `${v ? 'Show' : 'Hide'} video on site: ${slug}`,
            { posts: {} }
          );
          store.ledger.posts[slug]!.youtube = { ...entry, showOnSite: v };
          toast(v ? 'The video will appear on the essay after the next build.' : 'The video will be hidden after the next build.', 'ok');
        } catch (e) {
          toast(errorMessage(e), 'error');
        }
      }),
      entry.privacy === 'private' ? h('p', { class: 'hint' }, 'The video is private. Make it public in YouTube Studio before showing it here.') : null
    );
  }

  // Medium and Substack: no posting API, so prepare everything and let you post it.
  function manualExtras(p: Platform, slug: string | null) {
    if (!slug || !ctx.isLive()) return h('p', { class: 'hint' }, 'Publish the essay first. Then the buttons to post it here appear.');
    const posted = store.ledger.posts[slug]?.[p]?.url;
    const urlInput = h('input', { class: 'input', type: 'url', placeholder: p === 'medium' ? 'https://medium.com/@you/…' : 'https://you.substack.com/p/…', 'aria-label': `${PLATFORM_INFO[p].label} address` });
    const save = async () => {
      const url = urlInput.value.trim();
      if (!/^https?:\/\//.test(url)) return toast('Paste the full address of the post, starting with https://', 'error');
      try {
        await markPosted(slug, p, url);
        toast(`Saved. "Also published on" will list ${PLATFORM_INFO[p].label} after the next build.`, 'ok');
        render();
      } catch (e) {
        toast(errorMessage(e), 'error');
      }
    };
    if (posted)
      return h(
        'p',
        { class: 'hint' },
        h(
          'button',
          {
            class: 'linklike',
            type: 'button',
            onclick: async () => {
              try {
                await markPosted(slug, p, null);
                render();
              } catch (e) {
                toast(errorMessage(e), 'error');
              }
            },
          },
          'Clear this link'
        )
      );

    const steps =
      p === 'medium'
        ? h(
            'div',
            { class: 'stack-sm' },
            h('p', { class: 'hint' }, '1. Copy the essay link. 2. Open Medium\'s import page and paste it. 3. Check the story and publish it on Medium.'),
            h(
              'div',
              { class: 'input-row' },
              h('button', { class: 'btn btn-small', type: 'button', onclick: async () => toast((await copyText(essayUrl(slug))) ? 'Essay link copied.' : 'Could not copy. Select the link from your address bar instead.', 'ok') }, 'Copy essay link'),
              h('a', { class: 'btn btn-small btn-primary', href: MEDIUM_IMPORT_URL, target: '_blank', rel: 'noopener' }, 'Open Medium import ↗')
            )
          )
        : (() => {
            const editor = substackEditorUrl(effective(store.settings, ctx.overrides(), 'substack').publication);
            const pack = () => essayHtml(slug);
            return h(
              'div',
              { class: 'stack-sm' },
              h('p', { class: 'hint' }, '1. Open the editor. 2. Copy the title and paste it into the title box. 3. Copy the essay and paste it into the body. Images and formatting come with it. 4. Check it, then publish or send.'),
              ctx.isDirty() ? h('p', { class: 'hint' }, 'You have unsaved changes. The copy uses the last saved version.') : null,
              h(
                'div',
                { class: 'input-row' },
                editor
                  ? h('a', { class: 'btn btn-small btn-primary', href: editor, target: '_blank', rel: 'noopener' }, 'Open Substack editor ↗')
                  : h('span', { class: 'hint' }, 'Add your Substack address under Options, or in Distribution settings, to get an editor button.'),
                h('button', { class: 'btn btn-small', type: 'button', onclick: async () => toast((await copyText(pack()?.title ?? '')) ? 'Title copied.' : 'Could not copy the title.', 'ok') }, 'Copy title'),
                h(
                  'button',
                  {
                    class: 'btn btn-small',
                    type: 'button',
                    onclick: async () => {
                      const e = pack();
                      if (!e) return;
                      toast((await copyRich(e.html, e.text)) ? 'Essay copied with formatting. Paste it into the Substack body.' : 'Could not copy the essay.', 'ok');
                    },
                  },
                  'Copy essay'
                )
              )
            );
          })();

    return h(
      'div',
      { class: 'stack-sm manual-steps' },
      steps,
      h('label', { class: 'hint' }, `Posted it? Paste its ${PLATFORM_INFO[p].label} address so the essay can link to it:`),
      h('div', { class: 'input-row' }, urlInput, h('button', { class: 'btn btn-small', type: 'button', onclick: save }, 'Mark as posted'))
    );
  }

  async function send(only?: Platform) {
    const slug = ctx.slug();
    if (!slug || !ctx.isLive()) return toast('Publish the essay first.', 'error');
    if (ctx.isDirty()) return toast('Save your changes first, so the latest version goes out.', 'error');
    try {
      await dispatchDistribute({ slug, action: 'distribute', platforms: only ?? '' });
      toast(only ? `Retrying ${PLATFORM_INFO[only].label}. Watch progress under Activity.` : 'Distribution started. Watch progress under Activity.', 'ok');
    } catch (e) {
      toast(`Could not start the workflow: ${errorMessage(e)}`, 'error');
    }
  }

  render();
  return { el: root, render };
}
