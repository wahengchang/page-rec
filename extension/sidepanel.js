// extension/sidepanel.js — Side Panel runtime logic
// NO import/export — plain browser script loaded by sidepanel.html.

// ─── DOM refs ────────────────────────────────────────────────────────────────

const statusDot      = document.getElementById('status-dot');
const statusText     = document.getElementById('status-text');
const actionCount    = document.getElementById('action-count');
const actionList     = document.getElementById('action-list');
const emptyMsg       = document.getElementById('empty-msg');
const tabsNav        = document.getElementById('tabs');
const tabTimeline    = document.getElementById('tab-timeline');
const tabTestSteps   = document.getElementById('tab-test-steps');
const stepsList      = document.getElementById('steps-list');
const resetBtn       = document.getElementById('reset-btn');
const startBtn       = document.getElementById('start-btn');
const stopBtn        = document.getElementById('stop-btn');
const pauseBtn       = document.getElementById('pause-btn');
const newBtn         = document.getElementById('new-btn');
const footerEdit     = document.getElementById('footer-edit');
const copyCodeBtn    = document.getElementById('copy-code-btn');
const downloadSpecBtn = document.getElementById('download-spec-btn');
const toast          = document.getElementById('toast');

// ─── Keepalive ───────────────────────────────────────────────────────────────

let keepalivePort = chrome.runtime.connect({ name: 'sidepanel-keepalive' });
keepalivePort.onDisconnect.addListener(() => {
  keepalivePort = chrome.runtime.connect({ name: 'sidepanel-keepalive' });
});

// ─── State ───────────────────────────────────────────────────────────────────

let capturedCount = 0;
let isRecording = false;
let isPaused = false;
let currentSessionName = null;
const allActions = [];
let originalSteps = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function showToast(msg, duration) {
  toast.textContent = msg || 'Copied!';
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), duration || 1500);
}

// State machine: 'idle' | 'recording' | 'paused' | 'stopped'
function setState(state) {
  isRecording = (state === 'recording' || state === 'paused');
  isPaused = (state === 'paused');

  // Hide all controls, then selectively show
  startBtn.classList.add('hidden');
  stopBtn.classList.add('hidden');
  pauseBtn.classList.add('hidden');
  newBtn.classList.add('hidden');
  footerEdit.classList.add('hidden');

  if (state === 'idle') {
    statusDot.className = 'dot';
    statusText.textContent = 'Ready';
    startBtn.classList.remove('hidden');
    startBtn.disabled = false;
  } else if (state === 'recording') {
    statusDot.className = 'dot dot-green pulse';
    statusText.textContent = 'Recording...';
    stopBtn.classList.remove('hidden');
    stopBtn.disabled = (capturedCount === 0);
    pauseBtn.classList.remove('hidden');
    pauseBtn.textContent = 'Pause';
    newBtn.classList.remove('hidden');
  } else if (state === 'paused') {
    statusDot.className = 'dot dot-yellow';
    statusText.textContent = 'Paused';
    stopBtn.classList.remove('hidden');
    pauseBtn.classList.remove('hidden');
    pauseBtn.textContent = 'Resume';
    newBtn.classList.remove('hidden');
  } else if (state === 'stopped') {
    statusDot.className = 'dot dot-red';
    statusText.textContent = 'Stopped';
    newBtn.classList.remove('hidden');
    footerEdit.classList.remove('hidden');
  }
}

function deriveSessionName(targetUrl) {
  const { hostname } = new URL(targetUrl);
  const slug = hostname.replace(/\./g, '-');
  const ts = Math.floor(Date.now() / 1000);
  return `${slug}-${ts}`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const ACTION_ICONS = { click:'👆', input:'✏️', scroll:'↕️', navigate:'→', submit:'↗' };

function formatTime(ms) {
  return ms < 1000 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's';
}

// ─── Timeline entries (human-readable) ───────────────────────────────────────

function appendAction(action) {
  if (emptyMsg) emptyMsg.style.display = 'none';
  allActions.push(action);

  const li = document.createElement('li');
  li.className = 'action-entry';

  // Human-readable description as primary text
  const humanText = describeAction(action);
  const rawSelector = action.selector || action.url || '';
  const detailsHtml = rawSelector
    ? '<details class="action-details"><summary>Details</summary><code>' + escapeHtml(rawSelector) + '</code></details>'
    : '';

  li.innerHTML =
    '<span class="action-icon">' + (ACTION_ICONS[action.type] || '?') + '</span>' +
    '<div class="action-info">' +
      '<span class="action-text">' + escapeHtml(humanText) + '</span>' +
      detailsHtml +
    '</div>' +
    '<span class="action-elapsed">' + formatTime(action.elapsed) + '</span>';

  actionList.appendChild(li);
  li.scrollIntoView({ behavior: 'smooth', block: 'end' });
  capturedCount++;
  actionCount.textContent = '(' + capturedCount + ' action' + (capturedCount === 1 ? '' : 's') + ')';
  // Enable stop button after first action
  if (isRecording) stopBtn.disabled = false;
}

// ─── Describe actions in natural language ────────────────────────────────────

function describeElement(action) {
  const meta = action.meta || {};
  const parts = [];

  let tag = meta.tagName ? '<' + meta.tagName : '';
  if (meta.testId) tag += ' data-testid="' + meta.testId + '"';
  else if (meta.id) tag += ' id="' + meta.id + '"';
  else if (meta.name) tag += ' name="' + meta.name + '"';
  else if (meta.className) {
    const cls = meta.className.split(/\s+/).slice(0, 2).join('.');
    if (cls) tag += '.' + cls;
  }
  if (tag) parts.push(tag + '>');

  if (meta.role) parts.push('[role="' + meta.role + '"]');
  if (meta.ariaLabel) parts.push('labeled "' + meta.ariaLabel + '"');
  else if (meta.placeholder) parts.push('placeholder "' + meta.placeholder + '"');

  if (action.type === 'click' && meta.textContent) {
    parts.push('"' + meta.textContent.slice(0, 40) + '"');
  }

  return parts.length ? parts.join(' ') : action.selector;
}

function describeAction(action) {
  const el = describeElement(action);
  switch (action.type) {
    case 'click': return 'Clicked ' + el;
    case 'input': return action.value === '***' ? 'Typed a password into ' + el : 'Typed "' + action.value + '" into ' + el;
    case 'scroll': return 'Scrolled to y=' + ((action.value || '0,0').split(',')[1] || '0') + 'px';
    case 'submit': return 'Submitted form ' + el;
    case 'navigate': return 'Navigated to ' + action.url;
    default: return action.type + ' on ' + el;
  }
}

// ─── Steps editor with drag & drop ──────────────────────────────────────────

let draggedEl = null;

function createInsertZone(beforeIndex) {
  const zone = document.createElement('div');
  zone.className = 'step-insert-zone';
  const btn = document.createElement('button');
  btn.className = 'insert-btn';
  btn.textContent = '+ Add note';
  btn.title = 'Add a human-readable note';
  btn.addEventListener('click', () => {
    // Insert an empty step and focus it for free-form note input
    const li = createStepElement('', '', 0);
    const newZone = createInsertZone(0);
    zone.after(li);
    li.after(newZone);
    renumberSteps();
    const textEl = li.querySelector('.step-text');
    textEl.focus();
    // Place caret inside the empty editable span
    const range = document.createRange();
    range.selectNodeContents(textEl);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  });
  zone.appendChild(btn);
  return zone;
}

function createStepElement(text, time, index) {
  const li = document.createElement('li');
  li.className = 'step-entry';
  li.draggable = true;

  const drag = document.createElement('span');
  drag.className = 'step-drag';
  drag.textContent = '⠿';
  drag.title = 'Drag to reorder';

  const numSpan = document.createElement('span');
  numSpan.className = 'step-number';
  numSpan.textContent = (index + 1) + '.';

  const textSpan = document.createElement('span');
  textSpan.className = 'step-text';
  textSpan.contentEditable = 'true';
  textSpan.textContent = text;
  textSpan.addEventListener('mousedown', (e) => e.stopPropagation());

  const timeSpan = document.createElement('span');
  timeSpan.className = 'step-time';
  timeSpan.textContent = time;

  const delBtn = document.createElement('button');
  delBtn.className = 'step-delete';
  delBtn.textContent = '✕';
  delBtn.title = 'Remove step';
  delBtn.addEventListener('click', () => {
    if (li.previousElementSibling && li.previousElementSibling.classList.contains('step-insert-zone')) {
      li.previousElementSibling.remove();
    }
    li.remove();
    renumberSteps();
  });

  li.appendChild(drag);
  li.appendChild(numSpan);
  li.appendChild(textSpan);
  li.appendChild(timeSpan);
  li.appendChild(delBtn);

  // Drag events
  li.addEventListener('dragstart', (e) => {
    draggedEl = li;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  });
  li.addEventListener('dragend', () => {
    li.classList.remove('dragging');
    clearAllDragOver();
    draggedEl = null;
    renumberSteps();
  });
  li.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!draggedEl || draggedEl === li) return;
    clearAllDragOver();
    const rect = li.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    if (e.clientY < midY) li.classList.add('drag-over-above');
    else li.classList.add('drag-over-below');
  });
  li.addEventListener('dragleave', () => {
    li.classList.remove('drag-over-above', 'drag-over-below');
  });
  li.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!draggedEl || draggedEl === li) return;
    const rect = li.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertBefore = e.clientY < midY;
    const dragZone = draggedEl.previousElementSibling;
    const hasDragZone = dragZone && dragZone.classList.contains('step-insert-zone');

    if (insertBefore) {
      const targetZone = li.previousElementSibling;
      if (targetZone && targetZone.classList.contains('step-insert-zone')) {
        stepsList.insertBefore(draggedEl, targetZone);
        if (hasDragZone) stepsList.insertBefore(dragZone, draggedEl);
      } else {
        stepsList.insertBefore(draggedEl, li);
        if (hasDragZone) stepsList.insertBefore(dragZone, draggedEl);
      }
    } else {
      const afterEl = li.nextElementSibling;
      if (afterEl) {
        const skipTo = afterEl.classList.contains('step-insert-zone') ? afterEl.nextElementSibling : afterEl;
        if (skipTo) stepsList.insertBefore(draggedEl, skipTo);
        else stepsList.appendChild(draggedEl);
      } else {
        stepsList.appendChild(draggedEl);
      }
      if (hasDragZone) stepsList.insertBefore(dragZone, draggedEl);
    }
    clearAllDragOver();
    renumberSteps();
  });

  return li;
}

function clearAllDragOver() {
  stepsList.querySelectorAll('.drag-over-above, .drag-over-below').forEach(el => {
    el.classList.remove('drag-over-above', 'drag-over-below');
  });
}

function renumberSteps() {
  let num = 1;
  stepsList.querySelectorAll('.step-entry').forEach((li) => {
    li.querySelector('.step-number').textContent = num + '.';
    num++;
  });
}

function buildStepsView() {
  stepsList.innerHTML = '';
  originalSteps = [];

  allActions.forEach((action, i) => {
    const text = describeAction(action);
    const time = formatTime(action.elapsed);
    originalSteps.push({ text, time });
    stepsList.appendChild(createInsertZone(i));
    stepsList.appendChild(createStepElement(text, time, i));
  });
  stepsList.appendChild(createInsertZone(allActions.length));
}

// ─── Toolbar: Reset ──────────────────────────────────────────────────────────

resetBtn.addEventListener('click', () => {
  stepsList.innerHTML = '';
  originalSteps.forEach((s, i) => {
    stepsList.appendChild(createInsertZone(i));
    stepsList.appendChild(createStepElement(s.text, s.time, i));
  });
  stepsList.appendChild(createInsertZone(originalSteps.length));
});

// ─── Collect steps text ──────────────────────────────────────────────────────

function getStepsText() {
  const lines = [];
  stepsList.querySelectorAll('.step-entry').forEach((li) => {
    const num = li.querySelector('.step-number').textContent;
    const text = li.querySelector('.step-text').textContent.trim();
    const time = li.querySelector('.step-time').textContent;
    lines.push(num + ' ' + text + (time ? '  (' + time + ')' : ''));
  });
  return lines.join('\n');
}

// ─── Footer: Copy Code (Playwright spec to clipboard) ────────────────────────

copyCodeBtn.addEventListener('click', async () => {
  if (typeof window.generateTest !== 'function') {
    console.error('[rec panel] generateTest not loaded');
    return;
  }
  const recording = {
    name: currentSessionName || 'recording',
    timestamp: new Date().toISOString(),
    actions: allActions,
  };
  const specText = window.generateTest(recording);
  try {
    await navigator.clipboard.writeText(specText);
    showToast('Copied!');
  } catch (err) {
    console.error('Copy failed:', err);
    showToast('Copy failed', 2000);
  }
});

// ─── Footer: Download .spec.js ───────────────────────────────────────────────

downloadSpecBtn.addEventListener('click', () => {
  if (typeof window.generateTest !== 'function') {
    console.error('[rec panel] generateTest not loaded');
    return;
  }
  const recording = {
    name: currentSessionName || 'recording',
    timestamp: new Date().toISOString(),
    actions: allActions,
  };
  const specText = window.generateTest(recording);
  const blob = new Blob([specText], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download(
    { url, filename: (currentSessionName || 'recording') + '.spec.js', saveAs: false },
    () => setTimeout(() => URL.revokeObjectURL(url), 1000)
  );
});

// ─── Tab switching ───────────────────────────────────────────────────────────

function switchTab(target) {
  tabsNav.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const btn = tabsNav.querySelector('[data-tab="' + target + '"]');
  if (btn) btn.classList.add('active');
  tabTimeline.classList.toggle('active', target === 'timeline');
  tabTestSteps.classList.toggle('active', target === 'test-steps');
}

tabsNav.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  switchTab(btn.dataset.tab);
});

// ─── Message listener ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'action-log') {
    if (!isPaused) appendAction(msg.data);
  } else if (msg.type === 'save-complete') {
    setState('stopped');
    if (msg.error) {
      statusText.textContent = 'Error: ' + escapeHtml(msg.error);
    } else {
      buildStepsView();
      tabsNav.classList.remove('hidden');
      switchTab('test-steps');
    }
  }
});

// ─── Stop Recording button ──────────────────────────────────────────────────

stopBtn.addEventListener('click', () => {
  if (!isRecording) return;
  stopBtn.disabled = true;
  stopBtn.textContent = 'Saving...';
  chrome.runtime.sendMessage({ type: 'save' }).catch((err) => {
    console.error('[rec panel] Save message failed:', err);
    stopBtn.disabled = false;
    stopBtn.textContent = 'Stop Recording';
  });
});

// ─── Pause / Resume button ──────────────────────────────────────────────────

pauseBtn.addEventListener('click', () => {
  if (isPaused) {
    setState('recording');
  } else {
    setState('paused');
  }
});

// ─── New button (discard current session and return to idle) ────────────────

newBtn.addEventListener('click', async () => {
  // If still recording, tell background to clear session so content script stops
  if (isRecording) {
    chrome.runtime.sendMessage({ type: 'discard' }).catch(() => {});
  }
  // Reset in-memory + UI state back to initial blank
  allActions.length = 0;
  originalSteps = [];
  capturedCount = 0;
  currentSessionName = null;
  actionCount.textContent = '(0 actions)';
  actionList.innerHTML = '';
  stepsList.innerHTML = '';
  tabsNav.classList.add('hidden');
  tabTimeline.classList.add('active');
  tabTestSteps.classList.remove('active');
  if (emptyMsg) emptyMsg.style.display = '';
  setState('idle');
});

// ─── Start recording button ─────────────────────────────────────────────────

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || !tab.id || !tab.url) throw new Error('No active tab');
    if (!/^https?:/.test(tab.url)) throw new Error('Can only record http(s) pages');
    const sessionName = deriveSessionName(tab.url);
    allActions.length = 0;
    originalSteps = [];
    capturedCount = 0;
    actionCount.textContent = '(0 actions)';
    actionList.innerHTML = '';
    stepsList.innerHTML = '';
    tabsNav.classList.add('hidden');
    tabTimeline.classList.add('active');
    tabTestSteps.classList.remove('active');
    if (emptyMsg) emptyMsg.style.display = '';
    currentSessionName = sessionName;
    setState('recording');
    await chrome.runtime.sendMessage({ type: 'start-recording', data: { tabId: tab.id, sessionName, url: tab.url } });
  } catch (err) {
    console.error('[rec panel] start failed:', err);
    statusText.textContent = 'Error: ' + err.message;
    setState('idle');
  }
});

// ─── Initial state ──────────────────────────────────────────────────────────

setState('idle');
