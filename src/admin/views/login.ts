import { h, clear } from '../dom';
import { saveAuth } from '../auth';
import { OWNER, NAME } from '../config';

export function loginView(root: HTMLElement, message?: string, onToken?: () => void) {
  const tokenInput = h('input', { type: 'password', class: 'input', placeholder: 'github_pat_…', autocomplete: 'off', 'aria-label': 'Personal access token' });
  const tokenForm = h(
    'form',
    {
      class: 'stack-sm',
      hidden: true,
      onsubmit: (e: Event) => {
        e.preventDefault();
        const token = tokenInput.value.trim();
        if (!token) return;
        saveAuth({ token, kind: 'pat' });
        onToken?.();
      },
    },
    h(
      'p',
      { class: 'muted small' },
      'Create a fine-grained token limited to ',
      h('code', {}, `${OWNER}/${NAME}`),
      ' with Contents and Actions set to read and write. It is stored only in this browser.'
    ),
    tokenInput,
    h('button', { class: 'btn', type: 'submit' }, 'Use token')
  );

  clear(
    root,
    h(
      'main',
      { class: 'login' },
      h(
        'div',
        { class: 'login-card' },
        h('span', { class: 'brand-dot big', 'aria-hidden': 'true' }),
        h('h1', {}, 'Studio'),
        h('p', { class: 'muted' }, 'Write, publish and send your essays everywhere.'),
        message ? h('p', { class: 'notice notice-error', role: 'alert' }, message) : null,
        h('a', { class: 'btn btn-primary btn-lg', href: '/api/auth/login' }, 'Log in with GitHub'),
        h(
          'button',
          {
            class: 'linklike small',
            type: 'button',
            onclick: () => {
              tokenForm.hidden = !tokenForm.hidden;
              if (!tokenForm.hidden) tokenInput.focus();
            },
          },
          'Use a personal access token instead'
        ),
        tokenForm
      )
    )
  );
}
