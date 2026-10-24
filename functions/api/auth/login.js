// Cloudflare Pages Function: GET /api/auth/login
// Sends you to GitHub to log in. The site itself stays static; this function and
// /api/auth/callback exist only because GitHub needs a server to hold the client secret.
//
// Environment variables (Cloudflare Pages → Settings → Variables and Secrets):
//   GITHUB_CLIENT_ID      from your GitHub App (or OAuth App)
//   GITHUB_CLIENT_SECRET  same place, store it as a Secret
//   ALLOWED_USERS         optional, comma-separated GitHub logins allowed in

export async function onRequestGet({ request, env }) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return Response.redirect(new URL('/admin/#auth_error=' + encodeURIComponent('Login is not set up yet: add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in Cloudflare Pages. See DEPLOY.md.'), request.url), 302);
  }

  const url = new URL(request.url);
  const state = crypto.randomUUID();
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', `${url.origin}/api/auth/callback`);
  authorize.searchParams.set('state', state);
  // Used by OAuth Apps; ignored by GitHub Apps, whose access comes from the app's permissions.
  authorize.searchParams.set('scope', 'repo workflow');

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      'Set-Cookie': `studio_oauth_state=${state}; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      'Cache-Control': 'no-store',
    },
  });
}
