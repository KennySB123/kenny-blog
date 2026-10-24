// Token storage. The token comes from the GitHub login (via /api/auth/callback)
// or from a fine-grained personal access token pasted on the login screen.

const KEY = 'studio:auth';

export interface Auth {
  token: string;
  kind: 'oauth' | 'pat';
}

export function loadAuth(): Auth | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Auth) : null;
  } catch {
    return null;
  }
}

export function saveAuth(auth: Auth) {
  try {
    localStorage.setItem(KEY, JSON.stringify(auth));
  } catch {}
}

export function clearAuth() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/** Pick up a token or error handed over by the login callback in the URL fragment. */
export function consumeCallback(): { auth?: Auth; error?: string } {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const token = hash.get('token');
  const error = hash.get('auth_error');
  if (!token && !error) return {};
  history.replaceState(null, '', location.pathname + location.search);
  if (token) {
    const auth: Auth = { token, kind: 'oauth' };
    saveAuth(auth);
    return { auth };
  }
  return { error: error ?? 'Login failed.' };
}
