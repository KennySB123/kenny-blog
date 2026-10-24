/** fetch wrapper that throws readable errors. */
export async function http(url, init = {}, label = 'request') {
  const res = await fetch(url, init);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data && (data.error_description || data.error?.message || data.error || data.message)) || text || res.statusText;
    throw new Error(`${label} failed (${res.status}): ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`.slice(0, 400));
  }
  return data;
}
