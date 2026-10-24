import { h, clear, formatDate } from '../dom';
import { sortedPosts, store } from '../state';
import { topbar } from './shell';
import { statusDots } from './status';
import { countWords } from '../../utils/reading';

function hasLocalDraft(slug: string) {
  try {
    return localStorage.getItem(`studio:draft:${slug}`) !== null;
  } catch {
    return false;
  }
}

export function listView(root: HTMLElement) {
  const search = h('input', { type: 'search', class: 'input', placeholder: 'Search essays', 'aria-label': 'Search essays' });
  const list = h('ul', { class: 'post-list' });

  const reviewCount = [...store.jobs.values()].filter((j) => j.job?.status === 'review').length;

  function render() {
    const q = search.value.trim().toLowerCase();
    const posts = sortedPosts().filter((p) => !q || p.data.title.toLowerCase().includes(q) || p.data.tags.some((t) => t.includes(q)));
    clear(
      list,
      posts.length === 0
        ? h('li', { class: 'empty' }, q ? 'No essays match.' : 'No essays yet. Start one!')
        : posts.map((p) => {
            const job = store.jobs.get(p.slug)?.job;
            return h(
              'li',
              {},
              h(
                'a',
                { class: 'post-row', href: `#/edit/${encodeURIComponent(p.slug)}` },
                h(
                  'span',
                  { class: 'post-row-main' },
                  h('strong', { class: 'post-row-title' }, p.data.title || 'Untitled'),
                  h(
                    'span',
                    { class: 'post-row-meta' },
                    formatDate(p.data.pubDate),
                    ' · ',
                    `${countWords(p.body).toLocaleString('en-GB')} words`,
                    p.data.tags.length ? ` · ${p.data.tags.map((t) => '#' + t).join(' ')}` : '',
                    hasLocalDraft(p.slug) ? h('span', { class: 'pill pill-sun' }, 'unsaved edits') : null,
                    job?.status === 'review' ? h('span', { class: 'pill pill-accent' }, 'script to review') : null
                  )
                ),
                h('span', { class: 'post-row-side' }, h('span', { class: `pill ${p.data.draft ? '' : 'pill-mint'}` }, p.data.draft ? 'Draft' : 'Live'), p.data.draft ? null : statusDots(p.slug, p.data.distribute))
              )
            );
          })
    );
  }

  search.addEventListener('input', render);

  clear(
    root,
    topbar('posts'),
    h(
      'main',
      { class: 'studio-main' },
      h(
        'div',
        { class: 'studio-head' },
        h('h1', {}, 'Essays'),
        h('a', { class: 'btn btn-primary', href: '#/new' }, '+ New essay')
      ),
      hasLocalDraft('__new__') ? h('p', { class: 'notice' }, 'You have an unsaved new essay. ', h('a', { href: '#/new' }, 'Continue writing it')) : null,
      reviewCount > 0 ? h('p', { class: 'notice notice-accent' }, `${reviewCount} video script${reviewCount > 1 ? 's' : ''} waiting for your review.`) : null,
      search,
      list
    )
  );
  render();
}
