// Cloudflare Pages Function: GET /api/auth/callback
// Swaps GitHub's one-time code for an access token and hands it to /admin
// in the URL fragment (fragments never reach any server or log).

function back(origin, params) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/admin/#${new URLSearchParams(params).toString()}`,
      'Set-Cookie': 'studio_oauth_state=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookie = request.headers.get('Cookie') ?? '';
  const expected = cookie.match(/(?:^|;\s*)studio_oauth_state=([^;]+)/)?.[1];

  if (url.searchParams.get('error')) {
    return back(url.origin, { auth_error: url.searchParams.get('error_description') ?? 'GitHub login was cancelled.' });
  }
  if (!code || !state || !expected || state !== expected) {
    return back(url.origin, { auth_error: 'Login expired or was started in another tab. Try again.' });
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'kenny-blog-studio' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/api/auth/callback`,
    }),
  });
  const data = await tokenRes.json().catch(() => ({}));
  if (!data.access_token) {
    return back(url.origin, { auth_error: data.error_description ?? 'GitHub did not return a token.' });
  }

  const allowed = (env.ALLOWED_USERS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length) {
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${data.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'kenny-blog-studio' },
    });
    const user = await userRes.json().catch(() => ({}));
    if (!user.login || !allowed.includes(String(user.login).toLowerCase())) {
      return back(url.origin, { auth_error: `@${user.login ?? 'unknown'} is not allowed into this studio.` });
    }
  }

  return back(url.origin, { token: data.access_token });
}
