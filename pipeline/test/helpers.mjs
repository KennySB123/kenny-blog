export function fakePost(over = {}) {
  return {
    slug: 'on-walking',
    body: 'Walking slowly is underrated.\n\n![A street](/images/street.jpg)\n\n## Why\n\nBecause you [notice](/blog/other/) things.\n',
    data: { title: 'On Walking', description: 'A short essay about slowness.', tags: ['essays', 'slow-living'], draft: false, ...over },
  };
}

export const ctx = { site: { url: 'https://blog.example', host: 'blog.example', title: 'Blog' }, url: 'https://blog.example/blog/on-walking/' };

/** Replace global fetch; returns the list of captured calls. */
export function mockFetch(handler) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    let url = input;
    if (input instanceof Request) {
      const raw = Buffer.from(await input.arrayBuffer());
      url = input.url;
      init = { method: input.method, headers: Object.fromEntries(input.headers), body: raw.length ? (/json|text/.test(input.headers.get('content-type') ?? '') ? raw.toString() : raw) : undefined, ...init };
    }
    calls.push({ url: String(url), init, body: init.body ? tryJson(init.body) : undefined });
    const r = await handler(String(url), init);
    return r instanceof Response ? r : new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  calls.restore = () => (globalThis.fetch = original);
  return calls;
}

function tryJson(b) {
  if (typeof b !== 'string') return b;
  try {
    return JSON.parse(b);
  } catch {
    return b;
  }
}
