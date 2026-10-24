// The writing screen. Modelled on blank.page: a quiet page, your words, nothing else.
// Chrome fades out while you type and comes back when you move the mouse.
import { h, clear, toast, dialog, errorMessage, timeAgo, themeButton } from '../dom';
import { store, type Post } from '../state';
import { parsePost, serializePost, slugify, today, type PostData } from '../frontmatter';
import { commit, fileSha, blobSha, dispatchDistribute, GitHubError } from '../github';
import { PATHS } from '../config';
import { PLATFORMS, PLATFORM_INFO, type PlatformSettings } from '../platforms';
import { renderMarkdown } from '../preview';
import { uploadImage } from '../images';
import { distributionPanel } from './distribution';
import { countWords, readingMinutes } from '../../utils/reading';

const FONTS = ['serif', 'sans', 'mono'] as const;
type Font = (typeof FONTS)[number];

interface LocalDraft {
  title: string;
  body: string;
  data: PostData;
  savedAt: number;
  baseSha: string | null;
}

function readLocal(key: string): LocalDraft | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeLocal(key: string, d: LocalDraft) {
  try {
    localStorage.setItem(key, JSON.stringify(d));
  } catch {}
}
function dropLocal(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function editorView(root: HTMLElement, slug: string | null): () => void {
  const existing: Post | undefined = slug ? store.posts.get(slug) : undefined;
  if (slug && !existing) {
    clear(root, h('main', { class: 'studio-main' }, h('h1', {}, 'Essay not found'), h('p', {}, h('a', { href: '#/' }, '← Back to essays'))));
    return () => {};
  }

  const doc = {
    slug: existing?.slug ?? null,
    path: existing?.path ?? null,
    sha: existing?.sha ?? null,
    data: structuredClone(existing?.data ?? ({ title: '', description: '', pubDate: today(), tags: [], draft: true } as PostData)),
    body: existing?.body ?? '',
  };
  let committed: string | null = existing ? serializePost(existing.data, existing.body) : null;
  let localKey = `studio:draft:${slug ?? '__new__'}`;
  let saving = false;

  // ── Elements ────────────────────────────────────────────────
  const titleEl = h('textarea', { class: 'ed-title', rows: 1, placeholder: 'Title', 'aria-label': 'Title', spellcheck: true });
  const bodyEl = h('textarea', { class: 'ed-body', placeholder: 'Start writing…', 'aria-label': 'Essay', spellcheck: true });
  const previewEl = h('article', { class: 'ed-preview prose', hidden: true });
  const countEl = h('span', {});
  const stateEl = h('span', { class: 'ed-state' });
  const banner = h('div', { class: 'ed-banner', hidden: true });
  const saveBtn = h('button', { class: 'btn', type: 'button', onclick: () => save({}) }, 'Save');
  const publishBtn = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => save({ publish: true }) }, 'Publish');
  const previewBtn = h('button', { class: 'btn btn-ghost', type: 'button', 'aria-pressed': 'false', onclick: () => togglePreview() }, 'Preview');
  let font: Font = (localStorage.getItem('studio:font') as Font) || 'serif';
  const fontBtn = h('button', { class: 'btn btn-ghost', type: 'button', title: 'Change font', onclick: () => cycleFont() }, 'Aa');

  titleEl.value = doc.data.title;
  bodyEl.value = doc.body;

  // ── Drawer: details + distribution ─────────────────────────
  const drawerSave = h('button', { class: 'btn', type: 'button', onclick: () => save({}) }, 'Save');
  const drawerPublish = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => save({ publish: true }) }, 'Publish');
  const drawer = h('aside', { class: 'drawer', 'aria-label': 'Essay settings', hidden: true });
  const tabs = { details: h('div', { class: 'stack' }), distribution: h('div', {}) };
  let activeTab: keyof typeof tabs = 'details';
  const tabBtns = {
    details: h('button', { class: 'tab', type: 'button', onclick: () => showTab('details') }, 'Details'),
    distribution: h('button', { class: 'tab', type: 'button', onclick: () => showTab('distribution') }, 'Distribution'),
  };
  const dist = distributionPanel({
    slug: () => doc.slug,
    isLive: () => !doc.data.draft && !!doc.path,
    isDirty: () => isDirty(),
    overrides: () => (doc.data.distribute ?? {}) as Record<string, PlatformSettings>,
    setOverrides: (o) => {
      doc.data.distribute = o;
      changed();
    },
  });
  tabs.distribution.appendChild(dist.el);

  clear(
    drawer,
    h(
      'div',
      { class: 'drawer-head' },
      h('div', { class: 'tabs' }, tabBtns.details, tabBtns.distribution),
      h('button', { class: 'btn btn-ghost', type: 'button', 'aria-label': 'Close', onclick: () => closeDrawer() }, '✕')
    ),
    h('div', { class: 'drawer-body' }, tabs.details, tabs.distribution),
    h('div', { class: 'drawer-foot' }, drawerSave, drawerPublish)
  );

  function showTab(t: keyof typeof tabs) {
    activeTab = t;
    for (const k of Object.keys(tabs) as (keyof typeof tabs)[]) {
      tabs[k].hidden = k !== t;
      tabBtns[k].setAttribute('aria-current', k === t ? 'page' : 'false');
    }
    if (t === 'details') renderDetails();
    else dist.render();
  }
  function openDrawer(t: keyof typeof tabs = activeTab) {
    drawer.hidden = false;
    rootEl.classList.add('drawer-open');
    showTab(t);
  }
  function closeDrawer() {
    drawer.hidden = true;
    rootEl.classList.remove('drawer-open');
  }

  function renderDetails() {
    const d = doc.data;
    const input = (attrs: Record<string, any>) => h('input', { class: 'input', ...attrs });
    const desc = h('textarea', {
      class: 'input',
      rows: 3,
      maxlength: 300,
      oninput: (e: Event) => {
        d.description = (e.target as HTMLTextAreaElement).value;
        changed();
      },
    });
    desc.value = d.description;

    const heroInput = input({
      type: 'text',
      value: d.heroImage ?? '',
      placeholder: '/images/…',
      oninput: (e: Event) => {
        d.heroImage = (e.target as HTMLInputElement).value.trim() || undefined;
        changed();
      },
    });
    const heroFile = h('input', {
      type: 'file',
      accept: 'image/*',
      hidden: true,
      onchange: async () => {
        const f = heroFile.files?.[0];
        if (!f) return;
        try {
          toast('Uploading image…');
          const path = await uploadImage(f, doc.slug ?? slugify(titleEl.value));
          d.heroImage = path;
          heroInput.value = path;
          changed();
          toast('Image uploaded.', 'ok');
        } catch (e) {
          toast(errorMessage(e), 'error');
        }
      },
    });

    const slugField = doc.path
      ? h(
          'p',
          { class: 'small' },
          'Lives at ',
          d.draft ? h('code', {}, `/blog/${doc.slug}/`) : h('a', { href: `/blog/${doc.slug}/`, target: '_blank', rel: 'noopener' }, `/blog/${doc.slug}/ ↗`)
        )
      : h(
          'div',
          { class: 'field' },
          h('label', {}, 'URL'),
          h(
            'div',
            { class: 'input-prefix' },
            h('span', {}, '/blog/'),
            input({
              type: 'text',
              id: 'slug-input',
              value: pendingSlug ?? '',
              placeholder: slugify(titleEl.value || 'my-essay'),
              oninput: (e: Event) => {
                pendingSlug = slugify((e.target as HTMLInputElement).value) || null;
              },
            })
          ),
          h('p', { class: 'hint' }, 'Set once, when you first save. Leave blank to use the title.')
        );

    clear(
      tabs.details,
      h('div', { class: 'field' }, h('label', {}, 'Description'), desc, h('p', { class: 'hint' }, 'One or two sentences. Used on cards, RSS, search and social posts.')),
      h(
        'div',
        { class: 'field-row' },
        h(
          'div',
          { class: 'field' },
          h('label', {}, 'Publish date'),
          input({
            type: 'date',
            value: d.pubDate,
            onchange: (e: Event) => {
              d.pubDate = (e.target as HTMLInputElement).value || today();
              changed();
            },
          })
        ),
        h(
          'div',
          { class: 'field' },
          h('label', {}, 'Last updated'),
          input({
            type: 'date',
            value: d.updatedDate ?? '',
            onchange: (e: Event) => {
              d.updatedDate = (e.target as HTMLInputElement).value || undefined;
              changed();
            },
          })
        )
      ),
      h(
        'div',
        { class: 'field' },
        h('label', {}, 'Tags'),
        input({
          type: 'text',
          value: d.tags.join(', '),
          placeholder: 'essays, notes',
          onchange: (e: Event) => {
            d.tags = (e.target as HTMLInputElement).value
              .split(',')
              .map((t) => t.trim().toLowerCase().replace(/\s+/g, '-'))
              .filter(Boolean);
            (e.target as HTMLInputElement).value = d.tags.join(', ');
            changed();
          },
        }),
        h('p', { class: 'hint' }, 'Comma separated, lowercase.')
      ),
      h(
        'div',
        { class: 'field' },
        h('label', {}, 'Hero image'),
        h('div', { class: 'input-row' }, heroInput, h('button', { class: 'btn', type: 'button', onclick: () => heroFile.click() }, 'Upload'), heroFile)
      ),
      slugField,
      h(
        'div',
        { class: 'field' },
        h('label', {}, 'Status'),
        h(
          'p',
          { class: 'input-row' },
          h('span', { class: `pill ${d.draft ? '' : 'pill-mint'}` }, d.draft ? 'Draft: only you can see it' : 'Live on the site'),
          !d.draft && doc.path ? h('button', { class: 'btn btn-small', type: 'button', onclick: () => save({ unpublish: true }) }, 'Unpublish') : null
        )
      ),
      doc.path
        ? h(
            'div',
            { class: 'danger-zone' },
            h('h3', {}, 'Danger zone'),
            h('button', { class: 'btn btn-danger', type: 'button', onclick: () => remove() }, 'Delete this essay')
          )
        : null
    );
  }
  let pendingSlug: string | null = null;

  // ── Layout ──────────────────────────────────────────────────
  const rootEl = h(
    'div',
    { class: `ed font-${font}` },
    h(
      'header',
      { class: 'ed-bar ed-top' },
      h('a', { class: 'btn btn-ghost', href: '#/', 'aria-label': 'Back to essays' }, '←', h('span', { class: 'hide-sm' }, ' Essays')),
      h('span', { class: 'ed-spacer' }),
      h('span', { class: 'hide-sm' }, themeButton()),
      fontBtn,
      previewBtn,
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => (drawer.hidden ? openDrawer() : closeDrawer()) }, 'Settings'),
      saveBtn,
      publishBtn
    ),
    banner,
    h('main', { class: 'ed-page' }, titleEl, bodyEl, previewEl),
    h('footer', { class: 'ed-bar ed-bottom' }, countEl, h('span', { class: 'ed-spacer' }), stateEl),
    drawer
  );
  clear(root, rootEl);

  // ── Behaviour ───────────────────────────────────────────────
  function grow(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  function current(): string {
    doc.data.title = titleEl.value.replace(/\s*\n\s*/g, ' ').trim();
    doc.body = bodyEl.value;
    return serializePost(doc.data, doc.body);
  }
  function isDirty() {
    return current() !== committed;
  }

  let localTimer: number | undefined;
  function changed() {
    updateChrome();
    clearTimeout(localTimer);
    localTimer = window.setTimeout(() => {
      if (isDirty()) writeLocal(localKey, { title: titleEl.value, body: bodyEl.value, data: doc.data, savedAt: Date.now(), baseSha: doc.sha });
      else dropLocal(localKey);
      updateChrome();
    }, 400);
  }

  function updateChrome() {
    const words = countWords(bodyEl.value);
    countEl.textContent = `${words.toLocaleString('en-GB')} words · ${readingMinutes(bodyEl.value)} min read`;
    const dirty = isDirty();
    stateEl.textContent = saving ? 'Saving…' : dirty ? (doc.path ? 'Unsaved changes · kept in this browser' : 'Not saved yet · kept in this browser') : doc.data.draft ? 'Saved as draft' : 'Saved · live';
    stateEl.dataset.dirty = String(dirty);
    publishBtn.textContent = doc.data.draft || !doc.path ? 'Publish' : 'Update';
    saveBtn.hidden = !doc.data.draft && !!doc.path;
    publishBtn.disabled = saving || (!!doc.path && !doc.data.draft && !dirty);
    saveBtn.disabled = saving || (!!doc.path && !dirty);
    drawerPublish.textContent = publishBtn.textContent;
    drawerPublish.disabled = publishBtn.disabled;
    drawerSave.hidden = saveBtn.hidden;
    drawerSave.disabled = saveBtn.disabled;
    document.title = `${titleEl.value || 'Untitled'} · Studio`;
  }

  // Focus mode: hide chrome while typing.
  let idleTimer: number | undefined;
  function typing() {
    rootEl.classList.add('typing');
  }
  function awake() {
    rootEl.classList.remove('typing');
    clearTimeout(idleTimer);
  }

  function togglePreview(force?: boolean) {
    const on = force ?? previewEl.hidden;
    if (on) {
      current();
      previewEl.innerHTML = `<h1>${escapeHtml(doc.data.title || 'Untitled')}</h1>${renderMarkdown(doc.body)}`;
    }
    previewEl.hidden = !on;
    titleEl.hidden = on;
    bodyEl.hidden = on;
    previewBtn.setAttribute('aria-pressed', String(on));
    previewBtn.textContent = on ? 'Write' : 'Preview';
    if (!on) bodyEl.focus();
  }

  function cycleFont() {
    font = FONTS[(FONTS.indexOf(font) + 1) % FONTS.length];
    rootEl.classList.remove(...FONTS.map((f) => `font-${f}`));
    rootEl.classList.add(`font-${font}`);
    try {
      localStorage.setItem('studio:font', font);
    } catch {}
    grow(titleEl);
    grow(bodyEl);
  }

  function wrapSelection(before: string, after = before, placeholder = '') {
    const { selectionStart: s, selectionEnd: e, value } = bodyEl;
    const sel = value.slice(s, e) || placeholder;
    bodyEl.setRangeText(before + sel + after, s, e, 'end');
    if (!value.slice(s, e) && placeholder) bodyEl.setSelectionRange(s + before.length, s + before.length + placeholder.length);
    bodyEl.dispatchEvent(new Event('input'));
  }

  async function insertImages(files: File[]) {
    for (const f of files) {
      const marker = `![Uploading ${f.name}…]()`;
      bodyEl.setRangeText(`\n${marker}\n`, bodyEl.selectionStart, bodyEl.selectionEnd, 'end');
      changed();
      try {
        const path = await uploadImage(f, doc.slug ?? slugify(titleEl.value));
        bodyEl.value = bodyEl.value.replace(marker, `![](${path})`);
        toast('Image uploaded. Add alt text between the [ ].', 'ok');
      } catch (e) {
        bodyEl.value = bodyEl.value.replace(marker, '');
        toast(errorMessage(e), 'error');
      }
      grow(bodyEl);
      changed();
    }
  }

  async function save(opts: { publish?: boolean; unpublish?: boolean }) {
    if (saving) return;
    current();
    if (!doc.data.title) {
      toast('Give it a title first.', 'error');
      titleEl.focus();
      return;
    }
    const prevDraft = doc.data.draft;
    if (opts.publish) {
      if (!doc.data.description.trim()) {
        openDrawer('details');
        toast('Add a short description. It is used on cards, RSS and social posts.', 'error');
        return;
      }
      doc.data.draft = false;
    }
    if (opts.unpublish) doc.data.draft = true;

    if (opts.publish && prevDraft) {
      const enabled = PLATFORMS.filter((p) => ({ ...store.settings.platforms[p], ...(doc.data.distribute?.[p] ?? {}) }).enabled !== false);
      const since = store.settings.autoSince;
      const auto = store.settings.trigger === 'on-publish' && !(since && doc.data.pubDate < since);
      const ok = await dialog({
        title: 'Publish this essay?',
        body: auto && enabled.length
          ? `It goes live on the site in about a minute. Then it goes to: ${enabled.map((p) => PLATFORM_INFO[p].label).join(', ')}.${enabled.includes('youtube') ? ' The video waits for you to approve its script.' : ''}`
          : 'It goes live on the site in about a minute.' +
            (auto
              ? ''
              : store.settings.trigger === 'manual'
                ? ' Distribution is manual, so nothing else happens until you press "Distribute now".'
                : ` It is dated before ${since}, so it is not sent out automatically. Use "Distribute now" if you want it to go out.`),
        confirm: 'Publish',
      });
      if (!ok) {
        doc.data.draft = prevDraft;
        return;
      }
    }

    saving = true;
    updateChrome();
    try {
      let isNew = false;
      if (!doc.path) {
        isNew = true;
        let base = pendingSlug || slugify(doc.data.title);
        let s = base;
        for (let i = 2; store.posts.has(s); i++) s = `${base}-${i}`;
        doc.slug = s;
        doc.path = `${PATHS.posts}/${s}.md`;
      } else if (doc.sha) {
        const remote = await fileSha(doc.path);
        if (remote && remote !== doc.sha) {
          const ok = await dialog({
            title: 'This essay changed somewhere else',
            body: 'Someone (maybe you, in another tab or on GitHub) saved a newer version since you opened it. Saving now replaces that version with yours.',
            confirm: 'Replace it with mine',
            danger: true,
          });
          if (!ok) throw new Error('cancelled');
        }
      }

      const text = serializePost(doc.data, doc.body);
      const verb = opts.publish && prevDraft ? 'Publish' : opts.unpublish ? 'Unpublish' : doc.data.draft ? 'Draft' : 'Update';
      await commit([{ path: doc.path, text }], `${verb}: ${doc.data.title}`);

      doc.sha = await blobSha(text);
      committed = text;
      const { data, body } = parsePost(text);
      store.posts.set(doc.slug!, { slug: doc.slug!, path: doc.path, sha: doc.sha, source: text, data, body });
      dropLocal(localKey);
      if (isNew) {
        localKey = `studio:draft:${doc.slug}`;
        history.replaceState(null, '', `#/edit/${encodeURIComponent(doc.slug!)}`);
      }
      toast(
        verb === 'Publish'
          ? store.settings.trigger === 'on-publish'
            ? 'Published. The site updates in about a minute, then distribution starts.'
            : 'Published. The site updates in about a minute.'
          : verb === 'Unpublish'
            ? 'Unpublished. It disappears from the site after the next build.'
            : 'Saved.',
        'ok'
      );
      if (!drawer.hidden) showTab(activeTab);
    } catch (e) {
      if (opts.publish) doc.data.draft = prevDraft;
      if (opts.unpublish) doc.data.draft = false;
      if (errorMessage(e) !== 'cancelled') toast(e instanceof GitHubError ? `GitHub said: ${e.message}` : errorMessage(e), 'error', 7000);
    } finally {
      saving = false;
      updateChrome();
    }
  }

  async function remove() {
    if (!doc.path || !doc.slug) return;
    const entry = store.ledger.posts[doc.slug] ?? {};
    const live = PLATFORMS.filter((p) => entry[p]?.id && !entry[p]?.removed);
    const choice = await dialog({
      title: 'Delete this essay?',
      body: 'This removes it from the site. You can still recover it from the Git history.',
      confirm: 'Delete',
      danger: true,
      checkboxes: live.map((p) => ({ id: p, label: p === 'youtube' ? 'Also delete the YouTube video' : `Also remove the copy on ${PLATFORM_INFO[p].label}` })),
    });
    if (choice === null) return;
    try {
      if (choice.length) await dispatchDistribute({ slug: doc.slug, action: 'remove', platforms: choice.join(',') });
      const job = store.jobs.get(doc.slug);
      const extra = job
        ? [`${PATHS.jobs}/${doc.slug}/job.json`, `${PATHS.jobs}/${doc.slug}/script.md`]
            .filter((p) => (p.endsWith('job.json') ? job.job : job.script) !== null)
            .map((p) => ({ path: p, delete: true as const }))
        : [];
      await commit([{ path: doc.path, delete: true }, ...extra], `Delete: ${doc.data.title}`);
      store.posts.delete(doc.slug);
      store.jobs.delete(doc.slug);
      dropLocal(localKey);
      committed = current();
      toast('Deleted.', 'ok');
      location.hash = '#/';
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  // ── Restore an unsaved local copy ───────────────────────────
  const local = readLocal(localKey);
  if (local && serializePost({ ...local.data, title: local.title.trim() }, local.body) !== committed) {
    const remoteMoved = !!existing && local.baseSha !== null && local.baseSha !== existing.sha;
    clear(
      banner,
      h('span', {}, `You have unsaved changes from ${timeAgo(local.savedAt)}.${remoteMoved ? ' The saved version has changed since then.' : ''}`),
      h(
        'button',
        {
          class: 'btn btn-small btn-primary',
          type: 'button',
          onclick: () => {
            doc.data = local.data;
            titleEl.value = local.title;
            bodyEl.value = local.body;
            banner.hidden = true;
            grow(titleEl);
            grow(bodyEl);
            changed();
          },
        },
        'Restore them'
      ),
      h(
        'button',
        {
          class: 'btn btn-small',
          type: 'button',
          onclick: () => {
            dropLocal(localKey);
            banner.hidden = true;
          },
        },
        'Discard'
      )
    );
    banner.hidden = false;
  }

  // ── Events ──────────────────────────────────────────────────
  titleEl.addEventListener('input', () => {
    grow(titleEl);
    changed();
  });
  titleEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      bodyEl.focus();
      bodyEl.setSelectionRange(0, 0);
    }
  });
  bodyEl.addEventListener('input', () => {
    grow(bodyEl);
    changed();
  });
  bodyEl.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      wrapSelection('**', '**', 'bold');
    } else if (mod && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      wrapSelection('_', '_', 'italic');
    } else if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      wrapSelection('[', '](https://)', 'link text');
    } else if (!mod && e.key.length === 1) {
      typing();
    }
  });
  bodyEl.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
    if (files.length) {
      e.preventDefault();
      insertImages(files);
    }
  });
  bodyEl.addEventListener('dragover', (e) => e.preventDefault());
  bodyEl.addEventListener('drop', (e) => {
    const files = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'));
    if (files.length) {
      e.preventDefault();
      insertImages(files);
    }
  });

  const onKey = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save(doc.data.draft || !doc.path ? {} : { publish: true });
    } else if (mod && e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      togglePreview();
    } else if (e.key === 'Escape') {
      if (!drawer.hidden) closeDrawer();
      else if (!previewEl.hidden) togglePreview(false);
    }
  };
  const onMove = () => awake();
  const onUnload = (e: BeforeUnloadEvent) => {
    if (isDirty()) e.preventDefault();
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('beforeunload', onUnload);

  requestAnimationFrame(() => {
    grow(titleEl);
    grow(bodyEl);
    (doc.data.title ? bodyEl : titleEl).focus();
  });
  updateChrome();

  return () => {
    clearTimeout(localTimer);
    if (isDirty()) writeLocal(localKey, { title: titleEl.value, body: bodyEl.value, data: doc.data, savedAt: Date.now(), baseSha: doc.sha });
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('beforeunload', onUnload);
    document.title = 'Studio';
  };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
