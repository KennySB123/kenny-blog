// YouTube Data API v3: upload, thumbnail, captions, playlist, delete.
// Auth is an OAuth refresh token for your channel (see scripts/youtube-auth.mjs).
import fs from 'node:fs';
import { http } from '../platforms/http.mjs';

async function accessToken() {
  const res = await http(
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.YOUTUBE_CLIENT_ID,
        client_secret: process.env.YOUTUBE_CLIENT_SECRET,
        refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    },
    'Google token refresh'
  );
  return res.access_token;
}

export function cleanText(s, max) {
  const out = String(s ?? '').replace(/[<>]/g, '').trim();
  if (Buffer.byteLength(out) <= max) return out;
  let cut = out;
  while (Buffer.byteLength(cut) > max - 3) cut = cut.slice(0, -1);
  return cut.trimEnd() + '…';
}

export function cleanTags(tags) {
  const out = [];
  let len = 0;
  for (const t of tags.map((x) => String(x).replace(/[<>,"]/g, '').trim()).filter(Boolean)) {
    const cost = t.length + (t.includes(' ') ? 2 : 0) + 1;
    if (len + cost > 480) break;
    out.push(t);
    len += cost;
  }
  return out;
}

export async function uploadVideo({ file, title, description, tags, categoryId = '27', privacy = 'private', declareSynthetic = true }) {
  const token = await accessToken();
  const size = fs.statSync(file).size;
  const meta = {
    snippet: {
      title: cleanText(title, 100),
      description: cleanText(description, 4900),
      tags: cleanTags(tags),
      categoryId: String(categoryId),
      defaultLanguage: 'en',
      defaultAudioLanguage: 'en',
    },
    status: { privacyStatus: privacy, selfDeclaredMadeForKids: false, embeddable: true, containsSyntheticMedia: !!declareSynthetic },
  };
  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': String(size),
    },
    body: JSON.stringify(meta),
  });
  if (!init.ok) throw new Error(`YouTube upload start failed (${init.status}): ${(await init.text()).slice(0, 300)}`);
  const location = init.headers.get('location');
  const video = await http(location, { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size) }, body: fs.readFileSync(file) }, 'YouTube upload');
  return { id: video.id, url: `https://www.youtube.com/watch?v=${video.id}`, privacy: video.status?.privacyStatus ?? privacy, token };
}

export async function setThumbnail(token, videoId, png) {
  await http(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' }, body: fs.readFileSync(png) },
    'YouTube thumbnail'
  );
}

export async function uploadCaptions(token, videoId, srtFile) {
  const boundary = `b${Date.now().toString(16)}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ snippet: { videoId, language: 'en', name: 'English' } })}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
    fs.readFileSync(srtFile),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  await http(
    'https://www.googleapis.com/upload/youtube/v3/captions?uploadType=multipart&part=snippet',
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body },
    'YouTube captions'
  );
}

export async function addToPlaylist(token, playlistId, videoId) {
  await http(
    'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } } }),
    },
    'YouTube playlist'
  );
}

export async function deleteVideo(videoId) {
  const token = await accessToken();
  await http(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }, 'YouTube delete');
}
