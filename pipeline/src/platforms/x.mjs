// X (Twitter): one announcement post per essay, through the official API v2.
// Auth: OAuth 1.0a user context (four keys from the X Developer Console; they don't expire).
// Cost: X bills per post from prepaid credits; a post with a link costs more than one without.
import crypto from 'node:crypto';
import { http } from './http.mjs';
import { fillTemplate, hashtag } from '../lib/markdown.mjs';

const API = 'https://api.x.com/2';
const LIMIT = 280;
const URL_COST = 23; // X counts every link as 23 characters

const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/**
 * OAuth 1.0a HMAC-SHA1 Authorization header.
 * `params` are query or form parameters that take part in the signature
 * (a JSON body does not).
 */
export function oauthHeader({ method, url, params = {}, consumerKey, consumerSecret, token, tokenSecret, nonce, timestamp }) {
  const oauth = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce ?? crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(timestamp ?? Math.floor(Date.now() / 1000)),
    oauth_token: token,
    oauth_version: '1.0',
  };
  const all = { ...params, ...oauth };
  const paramString = Object.keys(all)
    .map((k) => [enc(k), enc(String(all[k]))])
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const base = [method.toUpperCase(), enc(url), enc(paramString)].join('&');
  const signature = crypto.createHmac('sha1', `${enc(consumerSecret)}&${enc(tokenSecret)}`).update(base).digest('base64');
  const header = { ...oauth, oauth_signature: signature };
  return 'OAuth ' + Object.keys(header).sort().map((k) => `${enc(k)}="${enc(header[k])}"`).join(', ');
}

function auth(method, url) {
  return oauthHeader({
    method,
    url,
    consumerKey: process.env.X_API_KEY,
    consumerSecret: process.env.X_API_SECRET,
    token: process.env.X_ACCESS_TOKEN,
    tokenSecret: process.env.X_ACCESS_TOKEN_SECRET,
  });
}

export function xLength(text) {
  return [...text.replace(/https?:\/\/\S+/g, 'x'.repeat(URL_COST))].length;
}

export function xText(post, opts, ctx) {
  const withLink = opts.includeLink !== false;
  let template = opts.template || '{title}\n\n{description}\n\n{url}';
  if (!withLink) template = template.replace(/\{url\}/g, '');
  else if (!template.includes('{url}')) template += '\n\n{url}';
  const vars = (description) => ({
    title: post.data.title,
    description,
    url: ctx.url,
    tags: post.data.tags.map(hashtag).filter(Boolean).join(' '),
  });
  let desc = post.data.description;
  let text = fillTemplate(template, vars(desc));
  while (xLength(text) > LIMIT && desc.length > 0) {
    desc = desc.slice(0, Math.max(0, desc.length - 20)).replace(/\s+\S*$/, '') + '…';
    if (desc === '…') desc = '';
    text = fillTemplate(template, vars(desc));
  }
  if (xLength(text) > LIMIT) text = fillTemplate(withLink ? '{title}\n\n{url}' : '{title}', vars(''));
  return text;
}

export async function publish(post, opts, ctx) {
  const url = `${API}/tweets`;
  const res = await http(
    url,
    { method: 'POST', headers: { Authorization: auth('POST', url), 'Content-Type': 'application/json' }, body: JSON.stringify({ text: xText(post, opts, ctx) }) },
    'X post'
  );
  const id = res?.data?.id;
  if (!id) throw new Error('X did not return a post id.');
  return { id, url: `https://x.com/i/web/status/${id}` };
}

export async function remove(existing) {
  const url = `${API}/tweets/${existing.id}`;
  await http(url, { method: 'DELETE', headers: { Authorization: auth('DELETE', url) } }, 'X delete');
  return {};
}
