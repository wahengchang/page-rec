// extension/content.js — Content Script
// Runs inside the target page. Captures DOM events (click, input, scroll, submit, SPA navigate),
// resolves stable selectors, masks passwords, strips __rec hash, and relays all actions
// to the service worker via chrome.runtime.sendMessage.
// NO import/export — plain browser script injected by the service worker.

// ─── Guard: prevent double-injection on same page ────────────────────────────
if (window.__recInjected) {
  // Already running on this page — skip
} else {
window.__recInjected = true;

// ─── Section 1: Init — read startedAt from storage and strip hash ─────────────

// Read session config to get startedAt baseline for elapsed time computation
let startedAt = Date.now(); // fallback; overwritten immediately

chrome.storage.session.get(['config']).then(({ config }) => {
  if (config?.startedAt) startedAt = config.startedAt;
});

// EXT-10 / D-16: strip __rec=PORT from hash immediately, before app routing can misinterpret it
// Use history.replaceState so no navigation event fires
const rawHash = location.hash;
if (rawHash.includes('__rec=')) {
  const cleanHash = rawHash.replace(/&?__rec=\d+/, '').replace(/^#?$/, '') || '';
  history.replaceState(null, '', cleanHash ? '#' + cleanHash : location.pathname + location.search);
}

// ─── Section 2: Elapsed helper ────────────────────────────────────────────────

function elapsed() {
  return Date.now() - startedAt;
}

// ─── Section 3: sendAction helper ────────────────────────────────────────────

// D-20: NEVER fetch() from content script. Always relay through service worker.
function sendAction(action) {
  chrome.runtime.sendMessage({ type: 'action', data: action }).catch(() => {
    // Service worker may not be available briefly after injection — silent fail
  });
}

// ─── Section 3b: Collect rich element metadata for automation ────────────────

function getElementMeta(el) {
  if (!el || !el.tagName) return {};
  const meta = {};
  meta.tagName = el.tagName.toLowerCase();
  // Text content (first 80 chars, trimmed)
  const text = (el.innerText || el.textContent || '').trim().slice(0, 80);
  if (text) meta.textContent = text;
  // Key attributes useful for automation
  if (el.id) meta.id = el.id;
  if (el.className && typeof el.className === 'string') meta.className = el.className.trim().slice(0, 120);
  if (el.name) meta.name = el.name;
  if (el.type) meta.type = el.type;
  if (el.placeholder) meta.placeholder = el.placeholder;
  if (el.href) meta.href = el.href;
  if (el.getAttribute('role')) meta.role = el.getAttribute('role');
  if (el.getAttribute('aria-label')) meta.ariaLabel = el.getAttribute('aria-label');
  if (el.dataset && el.dataset.testid) meta.testId = el.dataset.testid;
  return meta;
}

// ─── Section 3c: Get input value from any editable element ──────────────────

function getInputValue(el) {
  if (el.type === 'password') return '***';
  // Standard form elements
  if ('value' in el && el.matches('input, textarea, select')) return el.value;
  // contenteditable elements (e.g. Google Search, Notion, Slack)
  if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
    return (el.innerText || el.textContent || '').trim();
  }
  // Walk up to find the editable ancestor (some sites nest deeply)
  let parent = el.closest('[contenteditable="true"]');
  if (parent) return (parent.innerText || parent.textContent || '').trim();
  return el.value || '';
}

function isEditable(el) {
  if (el.matches && el.matches('input, textarea, select')) return true;
  if (el.isContentEditable) return true;
  if (el.getAttribute && el.getAttribute('contenteditable') === 'true') return true;
  if (el.closest && el.closest('[contenteditable="true"]')) return true;
  if (el.getAttribute && el.getAttribute('role') === 'textbox') return true;
  if (el.getAttribute && el.getAttribute('role') === 'combobox') return true;
  return false;
}

// ─── Section 4: Selector resolution (EXT-08, D-11, D-12, D-13) ───────────────

function resolveSelector(el) {
  if (el.dataset && el.dataset.testid) return '[data-testid="' + el.dataset.testid + '"]';
  if (el.id)                           return '#' + CSS.escape(el.id);
  if (el.name)                         return '[name="' + el.name + '"]';
  const ariaLabel = el.getAttribute && el.getAttribute('aria-label');
  if (ariaLabel)                       return '[aria-label="' + ariaLabel + '"]';
  const text = el.textContent ? el.textContent.trim().slice(0, 40) : '';
  if (text)                            return 'text=' + text;
  return buildCssPath(el);
}

function buildCssPath(el) {
  // D-12: anchor to nearest ancestor with an id to shorten the path
  const anchor = el.closest('[id]');
  if (anchor && anchor !== el) {
    return '#' + CSS.escape(anchor.id) + ' ' + el.tagName.toLowerCase();
  }
  // Last resort: walk up DOM using nth-child (brittle — only used when no id ancestor)
  const parts = [];
  let node = el;
  while (node && node !== document.body && node.parentNode) {
    const siblings = Array.from(node.parentNode.children);
    const idx = siblings.indexOf(node) + 1;
    parts.unshift(node.tagName.toLowerCase() + ':nth-child(' + idx + ')');
    node = node.parentNode;
  }
  return parts.join(' > ');
}

// ─── Section 5: Click capture (EXT-04, D-06) ─────────────────────────────────

document.addEventListener('click', (e) => {
  const el = e.target;
  if (!el || el === document.body || el === document.documentElement) return;
  sendAction({
    type: 'click',
    selector: resolveSelector(el),
    url: location.href,
    elapsed: elapsed(),
    meta: getElementMeta(el)
  });
}, true); // capture phase to catch all clicks

// ─── Section 6: Input/change capture (EXT-05, D-07, D-08, EXT-09) ────────────

// D-07: use 'change' event (fires on blur after value is committed), not 'input' (every keystroke)
// Also capture Enter key — on many sites (e.g. Google Search) the form submits before change fires
let lastCapturedInput = null; // dedup: avoid recording same value twice (change + Enter)

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const el = e.target;
  if (!isEditable(el)) return;
  const value = getInputValue(el);
  if (!value) return;
  const selector = resolveSelector(el);
  lastCapturedInput = selector + ':' + value;
  sendAction({
    type: 'input',
    selector,
    url: location.href,
    elapsed: elapsed(),
    value,
    meta: getElementMeta(el)
  });
}, true);

document.addEventListener('change', (e) => {
  const el = e.target;
  if (!isEditable(el)) return;
  const value = getInputValue(el);
  const selector = resolveSelector(el);
  // Skip if we already captured this exact input via Enter key
  if (lastCapturedInput === selector + ':' + value) {
    lastCapturedInput = null;
    return;
  }
  lastCapturedInput = null;
  sendAction({
    type: 'input',
    selector,
    url: location.href,
    elapsed: elapsed(),
    value,
    meta: getElementMeta(el)
  });
});

// Capture input on blur for contenteditable elements (change event doesn't fire for them)
document.addEventListener('focusout', (e) => {
  const el = e.target;
  if (!el || !el.isContentEditable) return;
  const value = getInputValue(el);
  if (!value) return;
  const selector = resolveSelector(el);
  if (lastCapturedInput === selector + ':' + value) {
    lastCapturedInput = null;
    return;
  }
  sendAction({
    type: 'input',
    selector,
    url: location.href,
    elapsed: elapsed(),
    value,
    meta: getElementMeta(el)
  });
}, true);

// ─── Section 7: Scroll capture (EXT-06, D-06) — throttled to one per 400ms ───

let lastScrollAt = 0;
window.addEventListener('scroll', () => {
  const now = Date.now();
  if (now - lastScrollAt < 400) return;
  lastScrollAt = now;
  sendAction({
    type: 'scroll',
    selector: '',
    url: location.href,
    elapsed: elapsed(),
    value: window.scrollX + ',' + window.scrollY
  });
}, { passive: true });

// ─── Section 8: Form submit capture (D-10) ───────────────────────────────────

document.addEventListener('submit', (e) => {
  const form = e.target;
  const action = form.action || location.href;
  sendAction({
    type: 'submit',
    selector: resolveSelector(form),
    url: action,
    elapsed: elapsed(),
    meta: getElementMeta(form)
  });
});

// ─── Section 9: SPA navigation capture (EXT-07, D-09) ───────────────────────

// D-09 / Pattern 3: monkey-patch History API to detect SPA navigation
const _origPushState = history.pushState.bind(history);
const _origReplaceState = history.replaceState.bind(history);

function onSpaNavigate(url) {
  sendAction({
    type: 'navigate',
    selector: '',
    url: url || location.href,
    elapsed: elapsed()
  });
}

history.pushState = function (...args) {
  _origPushState(...args);
  onSpaNavigate(typeof args[2] === 'string' ? new URL(args[2], location.href).href : location.href);
};

history.replaceState = function (...args) {
  _origReplaceState(...args);
  // Only record non-hash-cleanup replaceState calls (the __rec cleanup above fires before this listener)
  if (args[2] && !String(args[2]).includes('__rec')) {
    onSpaNavigate(typeof args[2] === 'string' ? new URL(args[2], location.href).href : location.href);
  }
};

// Handle browser back/forward navigation
window.addEventListener('popstate', () => {
  onSpaNavigate(location.href);
});

} // end guard
