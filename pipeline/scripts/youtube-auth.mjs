// One-time helper: get a YouTube refresh token for your channel.
//
//   cd pipeline
//   YOUTUBE_CLIENT_ID=... YOUTUBE_CLIENT_SECRET=... npm run youtube-auth
//
// Open the printed link, pick the channel, allow access. The refresh token is printed
// here; store it as the YOUTUBE_REFRESH_TOKEN GitHub secret. See DEPLOY.md.
import http from 'node:http';

const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}`;
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.force-ssl'];
const { YOUTUBE_CLIENT_ID: id, YOUTUBE_CLIENT_SECRET: secret } = process.env;

if (!id || !secret) {
  console.error('Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET first (from your Google Cloud "Desktop app" OAuth client).');
  process.exit(1);
}

const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
url.search = new URLSearchParams({ client_id: id, redirect_uri: REDIRECT, response_type: 'code', scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent' });

const server = http.createServer(async (req, res) => {
  const q = new URL(req.url, REDIRECT).searchParams;
  if (!q.get('code')) {
    res.end(q.get('error') ? `Google said: ${q.get('error')}` : 'Waiting for Google…');
    return;
  }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: q.get('code'), client_id: id, client_secret: secret, redirect_uri: REDIRECT, grant_type: 'authorization_code' }),
  });
  const data = await r.json();
  if (!data.refresh_token) {
    res.end('No refresh token came back. See the terminal.');
    console.error('Token response:', data);
  } else {
    res.end('Done. Go back to the terminal.');
    console.log('\nYOUTUBE_REFRESH_TOKEN =', data.refresh_token, '\n');
    console.log('Add it in GitHub: repo Settings → Secrets and variables → Actions → New repository secret.');
  }
  server.close();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Open this link in your browser and choose the YouTube channel for your essays:\n');
  console.log(url.toString(), '\n');
});
