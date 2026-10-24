type Child = Node | string | number | false | null | undefined;
type Attrs = Record<string, any>;

/** Tiny element builder: h('button', { class: 'x', onclick }, 'Label') */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && k !== 'list' && typeof v !== 'string') (el as any)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

function append(el: Node, children: (Child | Child[])[]) {
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}

export function clear(el: Element, ...children: (Child | Child[])[]) {
  el.replaceChildren();
  append(el, children);
}

let toastTimer: number | undefined;
export function toast(message: string, kind: 'ok' | 'error' | 'info' = 'info', ms = 4200) {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(el);
  }
  el.className = `toast toast-${kind} show`;
  el.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove('show'), ms);
}

export interface DialogOptions {
  title: string;
  body?: string;
  confirm: string;
  danger?: boolean;
  checkboxes?: { id: string; label: string; checked?: boolean }[];
}

/** Modal confirm. Resolves to the checked checkbox ids, or null if cancelled. */
export function dialog(opts: DialogOptions): Promise<string[] | null> {
  return new Promise((resolve) => {
    const boxes = (opts.checkboxes ?? []).map((c) => {
      const input = h('input', { type: 'checkbox', checked: !!c.checked, value: c.id });
      return { c, input, row: h('label', { class: 'check' }, input, ' ', c.label) };
    });
    const dlg = h(
      'dialog',
      { class: 'modal' },
      h('h2', {}, opts.title),
      opts.body ? h('p', {}, opts.body) : null,
      boxes.length ? h('div', { class: 'stack-sm' }, boxes.map((b) => b.row)) : null,
      h(
        'div',
        { class: 'modal-actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => done(null) }, 'Cancel'),
        h(
          'button',
          { class: `btn ${opts.danger ? 'btn-danger' : 'btn-primary'}`, type: 'button', onclick: () => done(boxes.filter((b) => b.input.checked).map((b) => b.c.id)) },
          opts.confirm
        )
      )
    );
    function done(v: string[] | null) {
      dlg.close();
      dlg.remove();
      resolve(v);
    }
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      done(null);
    });
    document.body.appendChild(dlg);
    dlg.showModal();
  });
}

export function timeAgo(iso: string | number | Date): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const hr = Math.round(m / 60);
  if (hr < 24) return `${hr} h ago`;
  const d = Math.round(hr / 24);
  if (d < 30) return `${d} d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(+d) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Light/dark switch shared with the public site (same localStorage key). */
export function themeButton() {
  const label = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? '☀︎' : '☾');
  const btn = h('button', { class: 'btn btn-ghost', type: 'button', title: 'Toggle dark mode', 'aria-label': 'Toggle dark mode' }, label());
  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {}
    btn.textContent = label();
  });
  return btn;
}
