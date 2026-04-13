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
const controlsRow    = document.getElementById('controls-row');
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

  // Solidify the dashed flow-line track when recording has stopped (v3.0 design).
  document.body.classList.toggle('flow-solid', state === 'stopped');

  // Hide all controls, then selectively show
  startBtn.classList.add('hidden');
  stopBtn.classList.add('hidden');
  pauseBtn.classList.add('hidden');
  newBtn.classList.add('hidden');
  controlsRow.classList.add('hidden');
  footerEdit.classList.add('hidden');

  if (state === 'idle') {
    statusDot.className = 'dot';
    statusText.textContent = 'Ready';
    controlsRow.classList.remove('hidden');
    startBtn.classList.remove('hidden');
    startBtn.disabled = false;
  } else if (state === 'recording') {
    statusDot.className = 'dot dot-green pulse';
    statusText.textContent = 'Recording...';
    controlsRow.classList.remove('hidden');
    stopBtn.classList.remove('hidden');
    stopBtn.disabled = (capturedCount === 0);
    stopBtn.textContent = 'Stop Recording';
    pauseBtn.classList.remove('hidden');
    pauseBtn.textContent = 'Pause';
    newBtn.classList.remove('hidden');
  } else if (state === 'paused') {
    statusDot.className = 'dot dot-yellow';
    statusText.textContent = 'Paused';
    controlsRow.classList.remove('hidden');
    stopBtn.classList.remove('hidden');
    pauseBtn.classList.remove('hidden');
    pauseBtn.textContent = 'Resume';
    newBtn.classList.remove('hidden');
  } else if (state === 'stopped') {
    statusDot.className = 'dot dot-red';
    statusText.textContent = 'Stopped';
    // controlsRow hidden — New is in the status row, Copy/Download in footer
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

function formatTime(ms) {
  return ms < 1000 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's';
}

// Map action type → CSS color class for the timeline node dot.
// Driven by action.type (not verb-text parsing) so it stays robust under i18n.
const NODE_DOT_CLASS = {
  click:    'node-dot-click',
  input:    'node-dot-type',
  navigate: 'node-dot-nav',
  scroll:   'node-dot-scroll',
  submit:   'node-dot-submit',
};
function nodeDotClassFor(type) {
  return NODE_DOT_CLASS[type] || 'node-dot';
}

// ─── Timeline entries (node-item per DESIGN.md v3.0) ─────────────────────────

function appendAction(action) {
  if (emptyMsg) emptyMsg.style.display = 'none';
  allActions.push(action);

  const { verb, target } = describeActionParts(action);
  const fullText = verb + ' ' + target;

  const li = document.createElement('li');
  li.className = 'node-item';
  li.title = fullText;

  const dot = document.createElement('div');
  dot.className = 'node-dot ' + nodeDotClassFor(action.type);

  const content = document.createElement('div');
  content.className = 'node-content';

  const actionEl = document.createElement('div');
  actionEl.className = 'node-action';
  actionEl.textContent = verb;

  const targetEl = document.createElement('code');
  targetEl.className = 'node-target';
  targetEl.textContent = target;   // '>_ ' prefix is added by CSS ::before — never hardcode here

  content.appendChild(actionEl);
  content.appendChild(targetEl);

  const elapsedEl = document.createElement('div');
  elapsedEl.className = 'node-elapsed';
  elapsedEl.textContent = formatTime(action.elapsed);

  li.appendChild(dot);
  li.appendChild(content);
  li.appendChild(elapsedEl);

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

function describeActionParts(action) {
  const el = describeElement(action);
  switch (action.type) {
    case 'click':
      return { verb: 'Clicked', target: el };
    case 'input':
      return {
        verb: 'Typed',
        target: (action.value === '***')
          ? '<password> into ' + el
          : '"' + action.value + '" into ' + el,
      };
    case 'scroll':
      return { verb: 'Scrolled', target: 'y=' + ((action.value || '0,0').split(',')[1] || '0') + 'px' };
    case 'submit':
      return { verb: 'Submitted', target: 'form ' + el };
    case 'navigate':
      return { verb: 'Navigated', target: action.url };
    default:
      return { verb: action.type, target: 'on ' + el };
  }
}

// Compat shim — single-string form for getStepsText, tooltips, and any external usage.
function describeAction(action) {
  const p = describeActionParts(action);
  return p.verb + ' ' + p.target;
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
    // Insert an empty step and focus its action line for free-form note input
    const li = createStepElement('', '', 0);
    const newZone = createInsertZone(0);
    zone.after(li);
    li.after(newZone);
    const actionEl = li.querySelector('.node-action');
    if (actionEl) {
      actionEl.focus();
      const range = document.createRange();
      range.selectNodeContents(actionEl);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    }
  });
  zone.appendChild(btn);
  return zone;
}

// Verb-string → action.type guess (used to color-code the step-editor node dot
// when we only have the round-tripped "Verb target..." string available).
const VERB_TO_TYPE = {
  Clicked: 'click',
  Typed: 'input',
  Navigated: 'navigate',
  Scrolled: 'scroll',
  Submitted: 'submit',
};

function createStepElement(text, time, index) {
  const li = document.createElement('li');
  li.className = 'node-item step-node';
  li.draggable = true;
  li.title = text;

  // Drag handle — sits to the left of the dashed track via CSS positioning
  const drag = document.createElement('span');
  drag.className = 'node-drag';
  drag.textContent = '⠿';
  drag.title = 'Drag to reorder';

  // Parse the incoming "Verb target..." string back into parts
  // (it comes from describeAction which is now `verb + ' ' + target`).
  const firstSpace = text.indexOf(' ');
  const verb   = firstSpace === -1 ? text : text.slice(0, firstSpace);
  const target = firstSpace === -1 ? ''   : text.slice(firstSpace + 1);

  const dot = document.createElement('div');
  dot.className = 'node-dot ' + nodeDotClassFor(VERB_TO_TYPE[verb] || 'click');

  const content = document.createElement('div');
  content.className = 'node-content';

  // Verb line — contentEditable
  const actionEl = document.createElement('div');
  actionEl.className = 'node-action';
  actionEl.contentEditable = 'true';
  actionEl.textContent = verb;
  actionEl.addEventListener('mousedown', (e) => e.stopPropagation()); // don't fight drag
  actionEl.addEventListener('input', () => {
    li.title = (actionEl.textContent + ' ' + targetEl.textContent).trim();
  });

  // Target line — contentEditable; CSS ::before adds the '>_ ' prefix visually
  const targetEl = document.createElement('code');
  targetEl.className = 'node-target';
  targetEl.contentEditable = 'true';
  targetEl.textContent = target;
  targetEl.addEventListener('mousedown', (e) => e.stopPropagation());
  targetEl.addEventListener('input', () => {
    li.title = (actionEl.textContent + ' ' + targetEl.textContent).trim();
  });

  content.appendChild(actionEl);
  content.appendChild(targetEl);

  const timeSpan = document.createElement('span');
  timeSpan.className = 'node-elapsed';
  timeSpan.textContent = time;

  const delBtn = document.createElement('button');
  delBtn.className = 'node-delete';
  delBtn.textContent = '✕';
  delBtn.title = 'Remove step';
  delBtn.addEventListener('click', () => {
    if (li.previousElementSibling && li.previousElementSibling.classList.contains('step-insert-zone')) {
      li.previousElementSibling.remove();
    }
    li.remove();
  });

  li.appendChild(drag);
  li.appendChild(dot);
  li.appendChild(content);
  li.appendChild(timeSpan);
  li.appendChild(delBtn);

  // Drag events — same logic as before, just no renumbering (numbers removed in v3.0)
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
  });

  return li;
}

function clearAllDragOver() {
  stepsList.querySelectorAll('.drag-over-above, .drag-over-below').forEach(el => {
    el.classList.remove('drag-over-above', 'drag-over-below');
  });
}

function renumberSteps() {
  /* Step numbers were removed in v3.0 design (high-density node layout per SSOT).
     Kept as a no-op so existing call sites don't throw. */
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
  stepsList.querySelectorAll('.node-item.step-node').forEach((li, idx) => {
    const verb   = li.querySelector('.node-action').textContent.trim();
    const target = li.querySelector('.node-target').textContent.trim();
    const time   = li.querySelector('.node-elapsed').textContent;
    lines.push((idx + 1) + '. ' + verb + ' ' + target + (time ? '  (' + time + ')' : ''));
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
  // Reset Edits button only visible on the Step editor tab
  resetBtn.classList.toggle('hidden', target !== 'test-steps');
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
