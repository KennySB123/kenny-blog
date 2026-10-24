// Grow a textarea to fit its text without shrinking it first.
// The usual trick (height: auto, then scrollHeight) collapses the box for a moment,
// the page gets shorter, and the browser jumps the scroll position on every key.
// Measuring a hidden twin instead keeps the page perfectly still while typing.
const twins = new WeakMap<HTMLTextAreaElement, HTMLTextAreaElement>();

export function autosize(el: HTMLTextAreaElement) {
  if (!el.isConnected || el.hidden || !el.parentNode) return;
  let twin = twins.get(el);
  if (!twin || twin.parentNode !== el.parentNode) {
    twin = document.createElement('textarea');
    twin.setAttribute('aria-hidden', 'true');
    twin.tabIndex = -1;
    el.parentNode.insertBefore(twin, el.nextSibling);
    twins.set(el, twin);
  }
  // Same classes = same font, size and line height (the font switcher works by class).
  twin.className = el.className;
  Object.assign(twin.style, {
    position: 'absolute',
    top: '0',
    left: '-10000px',
    visibility: 'hidden',
    pointerEvents: 'none',
    height: '0',
    minHeight: '0',
    overflow: 'hidden',
    width: `${el.clientWidth}px`,
  });
  twin.value = el.value || el.placeholder || ' ';
  const min = parseFloat(getComputedStyle(el).minHeight) || 0;
  const next = Math.ceil(Math.max(twin.scrollHeight, min));
  if (Math.abs((parseFloat(el.style.height) || 0) - next) >= 1) el.style.height = `${next}px`;
}

/**
 * Scroll the page only as much as needed to keep the caret on screen,
 * leaving room for the fixed top and bottom bars. Does nothing if it is visible.
 */
export function keepCaretVisible(el: HTMLTextAreaElement, margin = { top: 80, bottom: 110 }) {
  const twin = twins.get(el);
  if (!twin || el.hidden || document.activeElement !== el) return;
  twin.value = el.value.slice(0, el.selectionEnd) || ' ';
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 28;
  const caretBottom = el.getBoundingClientRect().top + twin.scrollHeight;
  const caretTop = caretBottom - lineHeight;
  const limit = window.innerHeight - margin.bottom;
  // 'instant': the site CSS sets smooth scrolling, which would lag behind the typing.
  if (caretBottom > limit) window.scrollBy({ top: caretBottom - limit, behavior: 'instant' as ScrollBehavior });
  else if (caretTop < margin.top) window.scrollBy({ top: caretTop - margin.top, behavior: 'instant' as ScrollBehavior });
  twin.value = el.value || el.placeholder || ' ';
}
