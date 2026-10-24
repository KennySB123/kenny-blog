// Review gate for video scripts. Claude writes pipeline/jobs/<slug>/script.md;
// you read it here, edit if needed, and approve. Approving commits the job and
// the render workflow picks it up.
import { h, clear, toast, dialog, errorMessage, timeAgo } from '../dom';
import { store } from '../state';
import { commit, dispatchDistribute } from '../github';
import { PATHS } from '../config';
import { effective } from '../platforms';
import { autosize } from '../autosize';

const STATUS_TEXT: Record<string, string> = {
  generating: 'Claude is writing the script',
  review: 'Waiting for your review',
  approved: 'Approved, waiting to render',
  rendering: 'Rendering and uploading',
  done: 'Uploaded',
  failed: 'Failed',
  cancelled: 'Skipped',
};

export function videoView(root: HTMLElement, slug: string): () => void {
  const post = store.posts.get(slug);
  const job = store.jobs.get(slug);
  const back = h('a', { class: 'btn btn-ghost', href: `#/edit/${encodeURIComponent(slug)}` }, '← Essay');

  if (!job?.script || !job.job) {
    clear(
      root,
      h(
        'div',
        { class: 'ed font-sans' },
        h('header', { class: 'ed-bar ed-top' }, back),
        h(
          'main',
          { class: 'ed-page' },
          h('h1', {}, 'No video script yet'),
          h('p', {}, job?.job?.status === 'generating' ? 'Claude is still writing it. Check back in a minute.' : 'A script is written when the essay is distributed with YouTube switched on.'),
          post && !post.data.draft
            ? h(
                'button',
                {
                  class: 'btn btn-primary',
                  type: 'button',
                  onclick: async () => {
                    try {
                      await dispatchDistribute({ slug, action: 'regenerate-script' });
                      toast('Asked Claude for a script. It takes a minute or two.', 'ok');
                    } catch (e) {
                      toast(errorMessage(e), 'error');
                    }
                  },
                },
                'Write a script now'
              )
            : null
        )
      )
    );
    return () => {};
  }

  const status = job.job.status;
  const locked = ['approved', 'rendering', 'done'].includes(status);
  const scriptEl = h('textarea', { class: 'ed-body ed-script', 'aria-label': 'Video script', spellcheck: true, readOnly: locked });
  scriptEl.value = job.script;
  const original = job.script;
  const speed = Number(effective(store.settings, post?.data.distribute as any, 'youtube').speed ?? 1) || 1;
  const info = h('span', {});

  function updateInfo() {
    const spoken = scriptEl.value.replace(/^---[\s\S]*?---/, '');
    const words = (spoken.match(/[\p{L}\p{N}’']+/gu) ?? []).length;
    const mins = words / (150 * speed);
    info.textContent = `${words.toLocaleString('en-GB')} words · about ${Math.max(1, Math.round(mins))} min of video`;
  }

  const grow = () => autosize(scriptEl);
  scriptEl.addEventListener('input', () => {
    grow();
    updateInfo();
  });

  async function writeJob(nextStatus: string, message: string, includeScript: boolean) {
    const jobPath = `${PATHS.jobs}/${slug}/job.json`;
    const scriptPath = `${PATHS.jobs}/${slug}/script.md`;
    const now = new Date().toISOString();
    await commit(
      [
        ...(includeScript && scriptEl.value !== original ? [{ path: scriptPath, text: scriptEl.value.replace(/\s*$/, '\n') }] : []),
        {
          path: jobPath,
          update: (cur: string | null) => {
            const j = cur ? JSON.parse(cur) : {};
            return JSON.stringify({ ...j, status: nextStatus, error: undefined, updatedAt: now }, null, 2) + '\n';
          },
        },
      ],
      message
    );
    job!.job = { ...job!.job!, status: nextStatus as any, error: undefined, updatedAt: now };
    job!.script = scriptEl.value;
  }

  const actions = locked
    ? []
    : [
        h(
          'button',
          {
            class: 'btn btn-ghost',
            type: 'button',
            onclick: async () => {
              const ok = await dialog({ title: 'Skip the video for this essay?', body: 'Nothing is uploaded. You can still write a new script later.', confirm: 'Skip video' });
              if (!ok) return;
              try {
                await writeJob('cancelled', `Skip video: ${slug}`, false);
                toast('Video skipped.', 'ok');
                location.hash = `#/edit/${encodeURIComponent(slug)}`;
              } catch (e) {
                toast(errorMessage(e), 'error');
              }
            },
          },
          'Skip video'
        ),
        h(
          'button',
          {
            class: 'btn btn-ghost',
            type: 'button',
            onclick: async () => {
              const ok = await dialog({ title: 'Ask Claude for a fresh script?', body: 'The current script, including your edits, is replaced.', confirm: 'Rewrite it', danger: true });
              if (!ok) return;
              try {
                await dispatchDistribute({ slug, action: 'regenerate-script' });
                toast('Rewriting. Reload this page in a minute or two.', 'ok');
              } catch (e) {
                toast(errorMessage(e), 'error');
              }
            },
          },
          'Rewrite'
        ),
        h(
          'button',
          {
            class: 'btn',
            type: 'button',
            onclick: async () => {
              try {
                await writeJob('review', `Edit video script: ${slug}`, true);
                toast('Script saved.', 'ok');
              } catch (e) {
                toast(errorMessage(e), 'error');
              }
            },
          },
          'Save'
        ),
        h(
          'button',
          {
            class: 'btn btn-primary',
            type: 'button',
            onclick: async () => {
              const privacy = effective(store.settings, post?.data.distribute as any, 'youtube').privacy ?? 'private';
              const ok = await dialog({
                title: 'Approve and make the video?',
                body: `The video renders on GitHub Actions (roughly 10 to 20 minutes) and uploads to YouTube as ${privacy}.`,
                confirm: 'Approve',
              });
              if (!ok) return;
              try {
                await writeJob('approved', `Approve video script: ${slug}`, true);
                toast('Approved. Rendering starts in a moment. Watch it under Activity.', 'ok');
                location.hash = '#/activity';
              } catch (e) {
                toast(errorMessage(e), 'error');
              }
            },
          },
          'Approve & render'
        ),
      ];

  const ledgerYt = store.ledger.posts[slug]?.youtube;

  clear(
    root,
    h(
      'div',
      { class: 'ed font-sans' },
      h('header', { class: 'ed-bar ed-top' }, back, h('strong', { class: 'ed-heading' }, 'Video script'), h('span', { class: 'ed-spacer' }), ...actions),
      h(
        'main',
        { class: 'ed-page' },
        h('p', { class: 'kicker' }, post?.data.title ?? slug),
        h(
          'p',
          { class: `status status-${status === 'failed' ? 'error' : status === 'review' ? 'action' : status === 'done' ? 'done' : 'pending'}` },
          STATUS_TEXT[status] ?? status,
          job.job.updatedAt ? ` · ${timeAgo(job.job.updatedAt)}` : '',
          job.job.error ? ` · ${job.job.error}` : '',
          ledgerYt?.url ? h('a', { href: ledgerYt.url, target: '_blank', rel: 'noopener' }, ' Open on YouTube ↗') : null
        ),
        h(
          'details',
          { class: 'help' },
          h('summary', {}, 'How the script becomes a video'),
          h(
            'ul',
            {},
            h('li', {}, 'The block between the --- lines sets the YouTube title, description, tags and thumbnail text.'),
            h('li', {}, 'A line starting with # becomes a chapter card, and the narrator reads it.'),
            h('li', {}, 'A line starting with > becomes a full-screen quote card.'),
            h('li', {}, 'Every other paragraph is read aloud, with the words on screen as a read-along.'),
            h('li', {}, 'Write numbers and names the way they should be spoken.')
          )
        ),
        scriptEl
      ),
      h('footer', { class: 'ed-bar ed-bottom' }, info, h('span', { class: 'ed-spacer' }), locked ? h('span', {}, 'Locked while rendering or after upload') : null)
    )
  );
  updateInfo();
  requestAnimationFrame(grow);
  return () => {};
}
