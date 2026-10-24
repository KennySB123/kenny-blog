import { h, themeButton } from '../dom';
import type { Viewer } from '../github';

export const session: { viewer: Viewer | null; logout: () => void } = {
  viewer: null,
  logout: () => {},
};

/** Top bar used by the list, settings and activity screens. */
export function topbar(active: 'posts' | 'settings' | 'activity' | 'backups') {
  const link = (href: string, id: typeof active, label: string) =>
    h('a', { href, class: 'tab', 'aria-current': active === id ? 'page' : undefined }, label);
  return h(
    'header',
    { class: 'studio-top' },
    h('a', { class: 'studio-brand', href: '#/' }, h('span', { class: 'brand-dot', 'aria-hidden': 'true' }), 'Studio'),
    h('nav', { class: 'studio-tabs', 'aria-label': 'Studio' }, link('#/', 'posts', 'Essays'), link('#/settings', 'settings', 'Distribution'), link('#/activity', 'activity', 'Activity'), link('#/backups', 'backups', 'Backups')),
    h(
      'div',
      { class: 'studio-user' },
      h('a', { class: 'btn btn-ghost hide-sm', href: '/', target: '_blank', rel: 'noopener' }, 'View site ↗'),
      themeButton(),
      session.viewer ? h('img', { class: 'avatar', src: session.viewer.avatar_url, alt: '', title: `@${session.viewer.login}` }) : null,
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => session.logout() }, 'Log out')
    )
  );
}
