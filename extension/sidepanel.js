// extension/sidepanel.js — Side Panel runtime logic
// NO import/export — plain browser script loaded by sidepanel.html.

// ─── DOM refs ────────────────────────────────────────────────────────────────

const statusDot    = document.getElementById('status-dot');
const statusText   = document.getElementById('status-text');
const actionCount  = document.getElementById('action-count');
const actionList   = document.getElementById('action-list');
const saveBtn      = document.getElementById('save-btn');
const emptyMsg     = document.getElementById('empty-msg');
const tabsNav      = document.getElementById('tabs');
const tabActions   = document.getElementById('tab-actions');
const tabSteps     = document.getElementById('tab-steps');
const stepsList    = document.getElementById('steps-list');
const resetBtn     = document.getElementById('reset-btn');
const footer       = document.getElementById('footer');
const footerSteps  = document.getElementById('footer-steps');
const copyBtn      = document.getElementById('copy-btn');
const downloadBtn  = document.getElementById('download-btn');
const dlActionsBtn = document.getElementById('download-actions-btn');

// ─── Keepalive ───────────────────────────────────────────────────────────────

const keepalivePort = chrome.runtime.connect({ name: 'sidepanel-keepalive' });
keepalivePort.onDisconnect.addListener(() => updateStatus(false));

// ─── State ───────────────────────────────────────────────────────────────────

let capturedCount = 0;
let isRecording = true;
const allActions = [];
let originalSteps = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function updateStatus(recording) {
  isRecording = recording;
  statusDot.className = recording ? 'dot dot-green' : 'dot dot-red';
  statusText.textContent = recording ? 'Recording...' : 'Stopped';
  if (!recording) saveBtn.disabled = true;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const ACTION_ICONS = { click:'👆', input:'✏️', scroll:'↕️', navigate:'→', submit:'↗' };

function formatTime(ms) {
  return ms < 1000 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's';
}

// ─── Action log (Actions tab) ────────────────────────────────────────────────

function appendAction(action) {
  if (emptyMsg) emptyMsg.style.display = 'none';
  allActions.push(action);

  const li = document.createElement('li');
  li.className = 'action-entry';
  const meta = action.meta || {};
  const details = [];
  if (action.value) details.push(escapeHtml(action.value.slice(0, 40)));
  if (meta.textContent && action.type === 'click') details.push('"' + escapeHtml(meta.textContent.slice(0, 30)) + '"');
  if (meta.tagName) details.push('&lt;' + escapeHtml(meta.tagName) + '&gt;');
  if (meta.role) details.push('role=' + escapeHtml(meta.role));
  const detailStr = details.length ? '<div class="action-detail">' + details.join(' · ') + '</div>' : '';

  li.innerHTML =
    '<span class="action-icon">' + (ACTION_ICONS[action.type] || '?') + '</span>' +
    '<div class="action-info">' +
      '<span class="action-selector" title="' + escapeHtml(action.selector) + '">' + escapeHtml(action.selector || action.url || '') + '</span>' +
      detailStr +
    '</div>' +
    '<span class="action-elapsed">' + action.elapsed + 'ms</span>';

  actionList.appendChild(li);
  li.scrollIntoView({ behavior: 'smooth', block: 'end' });
  capturedCount++;
  actionCount.textContent = '(' + capturedCount + ' action' + (capturedCount === 1 ? '' : 's') + ')';
  if (isRecording) saveBtn.disabled = false;
}

// ─── Describe actions in natural language ────────────────────────────────────

function describeElement(action) {
  const meta = action.meta || {};
  const parts = [];

  // Tag name — always include as the anchor (e.g. <button>, <input>)
  let tag = meta.tagName ? '<' + meta.tagName : '';
  // Always attach the best identifier to the tag
  if (meta.testId) tag += ' data-testid="' + meta.testId + '"';
  else if (meta.id) tag += ' id="' + meta.id + '"';
  else if (meta.name) tag += ' name="' + meta.name + '"';
  else if (meta.className) {
    // Use first 2 classes max to keep it readable
    const cls = meta.className.split(/\s+/).slice(0, 2).join('.');
    if (cls) tag += '.' + cls;
  }
  if (tag) parts.push(tag + '>');

  // Role for accessibility context
  if (meta.role) parts.push('[role="' + meta.role + '"]');

  // Label — how a user would identify it
  if (meta.ariaLabel) parts.push('labeled "' + meta.ariaLabel + '"');
  else if (meta.placeholder) parts.push('placeholder "' + meta.placeholder + '"');

  // Visible text for clicks
  if (action.type === 'click' && meta.textContent) {
    parts.push('showing "' + meta.textContent.slice(0, 40) + '"');
  }

  return parts.length ? parts.join(' ') : action.selector;
}

function describeAction(action) {
  const el = describeElement(action);
  switch (action.type) {
    case 'click': return 'Clicked on ' + el;
    case 'input': return action.value === '***' ? 'Typed a password into ' + el : 'Typed "' + action.value + '" into ' + el;
    case 'scroll': return 'Scrolled to y=' + ((action.value || '0,0').split(',')[1] || '0') + 'px';
    case 'submit': return 'Submitted form at ' + el;
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
  btn.textContent = '+';
  btn.title = 'Insert step here';
  btn.addEventListener('click', () => {
    const li = createStepElement('New step — click to edit', '', 0);
    zone.after(li);
    // Add a new insert zone after the inserted item
    const newZone = createInsertZone(0);
    li.after(newZone);
    renumberSteps();
    const textEl = li.querySelector('.step-text');
    textEl.focus();
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

  // Drag handle
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
  // Prevent drag when editing text
  textSpan.addEventListener('mousedown', (e) => e.stopPropagation());

  const timeSpan = document.createElement('span');
  timeSpan.className = 'step-time';
  timeSpan.textContent = time;

  const delBtn = document.createElement('button');
  delBtn.className = 'step-delete';
  delBtn.textContent = '✕';
  delBtn.title = 'Remove step';
  delBtn.addEventListener('click', () => {
    // Remove the insert zone before this item too
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

  // ─── Drag events ───
  li.addEventListener('dragstart', (e) => {
    draggedEl = li;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ''); // required for Firefox
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
    if (e.clientY < midY) {
      li.classList.add('drag-over-above');
    } else {
      li.classList.add('drag-over-below');
    }
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

    // Move the dragged element (and its preceding insert zone)
    const dragZone = draggedEl.previousElementSibling;
    const hasDragZone = dragZone && dragZone.classList.contains('step-insert-zone');

    if (insertBefore) {
      // Find the insert zone before target
      const targetZone = li.previousElementSibling;
      if (targetZone && targetZone.classList.contains('step-insert-zone')) {
        stepsList.insertBefore(draggedEl, targetZone);
        if (hasDragZone) stepsList.insertBefore(dragZone, draggedEl);
      } else {
        stepsList.insertBefore(draggedEl, li);
        if (hasDragZone) stepsList.insertBefore(dragZone, draggedEl);
      }
    } else {
      // Insert after target
      const afterEl = li.nextElementSibling;
      if (afterEl) {
        // Skip insert zone if present
        const skipTo = afterEl.classList.contains('step-insert-zone') ? afterEl.nextElementSibling : afterEl;
        if (skipTo) {
          stepsList.insertBefore(draggedEl, skipTo);
        } else {
          stepsList.appendChild(draggedEl);
        }
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

    // Insert zone before each item
    stepsList.appendChild(createInsertZone(i));
    stepsList.appendChild(createStepElement(text, time, i));
  });

  // Final insert zone at the end
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

// ─── Footer: Copy ────────────────────────────────────────────────────────────

copyBtn.addEventListener('click', async () => {
  const text = getStepsText();
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = '✓ Copied';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyBtn.textContent = '📋 Copy';
      copyBtn.classList.remove('copied');
    }, 1500);
  } catch (err) {
    console.error('Copy failed:', err);
  }
});

// ─── Footer: Download ────────────────────────────────────────────────────────

downloadBtn.addEventListener('click', () => {
  const text = getStepsText();
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'recording-steps.txt';
  a.click();
  URL.revokeObjectURL(url);
});

// ─── Footer: Download raw actions JSON ───────────────────────────────────────

dlActionsBtn.addEventListener('click', () => {
  const data = JSON.stringify(allActions, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'recording-actions.json';
  a.click();
  URL.revokeObjectURL(url);
});

// ─── Tab switching ───────────────────────────────────────────────────────────

function switchTab(target) {
  tabsNav.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tabsNav.querySelector('[data-tab="' + target + '"]').classList.add('active');
  tabActions.classList.toggle('active', target === 'actions');
  tabSteps.classList.toggle('active', target === 'steps');
  footer.classList.toggle('hidden', target === 'steps');
  footerSteps.classList.toggle('hidden', target !== 'steps');
}

tabsNav.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  switchTab(btn.dataset.tab);
});

// ─── Message listener ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'action-log') {
    appendAction(msg.data);
  } else if (msg.type === 'save-complete') {
    updateStatus(false);
    if (msg.error) {
      statusText.textContent = 'Error: ' + escapeHtml(msg.error);
      saveBtn.textContent = 'Stop & Save';
    } else {
      saveBtn.textContent = 'Saved ✓';
      dlActionsBtn.classList.remove('hidden');
      buildStepsView();
      tabsNav.classList.remove('hidden');
      switchTab('steps');
    }
  }
});

// ─── Stop & Save button ─────────────────────────────────────────────────────

saveBtn.addEventListener('click', () => {
  if (!isRecording) return;
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  chrome.runtime.sendMessage({ type: 'save' }).catch((err) => {
    console.error('[rec panel] Save message failed:', err);
    saveBtn.disabled = false;
    saveBtn.textContent = 'Stop & Save';
  });
});
