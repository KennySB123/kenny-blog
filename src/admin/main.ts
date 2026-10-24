import { h, clear, errorMessage } from './dom';
import { consumeCallback, loadAuth, clearAuth } from './auth';
import { setToken, getViewer, canPush, GitHubError } from './github';
import { refresh, store } from './state';
import { OWNER, NAME } from './config';
import { session } from './views/shell';
import { loginView } from './views/login';
import { listView } from './views/list';
import { editorView } from './views/editor';
import { settingsView } from './views/settings';
import { videoView } from './views/video';
import { activityView } from './views/activity';

const root = document.getElementById('app')!;
let cleanup: (() => void) | void;

function route() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = undefined;
  window.scrollTo(0, 0);
  const [, view = '', arg] = location.hash.replace(/^#/, '').split('/');
  const param = arg ? decodeURIComponent(arg) : null;
  switch (view) {
    case 'new':
      cleanup = editorView(root, null);
      break;
    case 'edit':
      cleanup = editorView(root, param);
      break;
    case 'video':
      cleanup = videoView(root, param ?? '');
      break;
    case 'settings':
      settingsView(root);
      break;
    case 'activity':
      cleanup = activityView(root);
      break;
    default:
      listView(root);
  }
}

function logout(message?: string) {
  clearAuth();
  window.removeEventListener('hashchange', route);
  loginView(root, message, boot);
}

async function boot() {
  const cb = consumeCallback();
  const auth = cb.auth ?? loadAuth();
  if (!auth) return loginView(root, cb.error, boot);

  clear(root, h('main', { class: 'login' }, h('p', { class: 'muted' }, 'Opening your studio…')));
  setToken(auth.token);
  try {
    session.viewer = await getViewer();
    session.logout = () => logout();
    if (!(await canPush())) return logout(`@${session.viewer.login} cannot write to ${OWNER}/${NAME}.`);
    await refresh();
  } catch (e) {
    if (e instanceof GitHubError && (e.status === 401 || e.status === 403)) {
      return logout(auth.kind === 'oauth' ? 'Your login expired. Log in again.' : `That token was refused: ${e.message}`);
    }
    if (e instanceof GitHubError && e.status === 404) {
      return logout(`Cannot see ${OWNER}/${NAME}. If you logged in with GitHub, check the GitHub App is installed on the repository.`);
    }
    clear(root, h('main', { class: 'login' }, h('p', { class: 'notice notice-error' }, `Could not load your essays: ${errorMessage(e)}`), h('button', { class: 'btn', onclick: () => boot() }, 'Try again')));
    return;
  }
  window.addEventListener('hashchange', route);
  route();
}

void store;
boot();
