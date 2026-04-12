// extension/background.js — MV3 Service Worker
// Brain of the recorder: start-recording handler, content injection,
// action buffering, message relay, local save (chrome.storage.local + chrome.downloads),
// keepalive port acceptance.
// NO import/export — Chrome extension service workers use global scope scripts.

// ─── Section 1: Service worker setup and keepalive ───────────────────────────

// D-24 / Pitfall 2: Set panel behavior so clicking extension icon opens panel.
// This avoids the user-gesture requirement for chrome.sidePanel.open().
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// Pattern 6: Accept long-lived port connections for keepalive.
// Keeps service worker alive while the side panel is open.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel-keepalive') {
    port.onDisconnect.addListener(() => {
      // Panel closed — no action needed; session persists until tab closes or save
    });
  }
});

// ─── Section 2: Navigation re-injection listener ─────────────────────────────

// Re-inject content script when the recording tab navigates to a new document.
// executeScript runs once per document — full page loads destroy the content script.
// Without this listener, after the user records on page A and clicks a link to page B,
// NO events get captured — silently. The listener is narrowed to re-injection only
// (the old hash-based activation branch is gone — activation now happens via the
// in-panel Start button → 'start-recording' message handler below).
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return;
  const { activeTabId } = await chrome.storage.session.get(['activeTabId']);
  if (tabId !== activeTabId) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    console.log('[rec] Re-injected content script after navigation, tab', tabId);
  } catch (err) {
    console.error('[rec] Re-injection after navigation failed:', err);
  }
  // Do NOT overwrite chrome.storage.session.config here — content.js reads
  // config.startedAt on every injection and needs the original value so
  // elapsed-time calculations remain consistent across navigations.
});

// ─── Section 3: Message relay (EXT-03, D-18, D-19) ──────────────────────────

// D-18: All messages use typed format: { type, data }
// Pitfall 5: onMessage handler is NOT async at the outer level — returns false for fire-and-forget
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // ── Start recording from side panel ──
  if (msg.type === 'start-recording') {
    const { tabId, sessionName } = msg.data;
    (async () => {
      try {
        // D-14: Single-tab guard — ignore if another recording session is active
        const existing = await chrome.storage.session.get(['activeTabId']);
        if (existing.activeTabId != null && existing.activeTabId !== tabId) {
          chrome.runtime.sendMessage({ type: 'save-complete', error: 'Another tab is already recording' }).catch(() => {});
          return;
        }
        // Pitfall 3: write session state BEFORE async injection so content.js
        // can read config.startedAt on first load (elapsed-time baseline)
        await chrome.storage.session.set({
          activeTabId: tabId,
          actions: [],
          sessionName,
          config: { startedAt: Date.now() }
        });
        // D-23: Programmatic content script injection (not declarative)
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
        console.log('[rec] Recording started on tab', tabId, 'session', sessionName);
      } catch (err) {
        console.error('[rec] start-recording failed:', err);
        await chrome.storage.session.clear();
        chrome.runtime.sendMessage({ type: 'save-complete', error: String(err) }).catch(() => {});
      }
    })();
    return false; // fire-and-forget
  }

  // ── Action from content script ──
  if (msg.type === 'action') {
    // D-15: Buffer action in storage immediately (protects against service worker termination)
    chrome.storage.session.get(['actions']).then(({ actions = [] }) => {
      actions.push(msg.data);
      chrome.storage.session.set({ actions });
    });

    // D-19: Relay to side panel (all extension pages receive runtime.sendMessage)
    chrome.runtime.sendMessage({ type: 'action-log', data: msg.data }).catch(() => {
      // Side panel may not be open yet — silent fail is acceptable
    });

    return false; // fire-and-forget, no sendResponse needed
  }

  // ── Stop & Save from side panel (local-only: chrome.storage.local + chrome.downloads) ──
  if (msg.type === 'save') {
    chrome.storage.session.get(['actions', 'sessionName']).then(async ({ actions = [], sessionName }) => {
      if (!sessionName) {
        chrome.runtime.sendMessage({ type: 'save-complete', error: 'No active session' }).catch(() => {});
        return;
      }
      const recording = { name: sessionName, timestamp: new Date().toISOString(), actions };
      try {
        // 1. Append to chrome.storage.local['recordings'] (persistent history)
        const { recordings = [] } = await chrome.storage.local.get(['recordings']);
        recordings.push(recording);
        await chrome.storage.local.set({ recordings });

        // 2. Trigger JSON download via chrome.downloads
        // Service worker has no DOM → use a data: URL (URL.createObjectURL is unreliable here)
        const json = JSON.stringify(recording, null, 2);
        const dataUrl = 'data:application/json;charset=utf-8;base64,' + btoa(unescape(encodeURIComponent(json)));
        await chrome.downloads.download({ url: dataUrl, filename: sessionName + '.json', saveAs: false });

        chrome.runtime.sendMessage({ type: 'save-complete' }).catch(() => {});
      } catch (err) {
        console.error('[rec] Save failed:', err);
        chrome.runtime.sendMessage({ type: 'save-complete', error: String(err) }).catch(() => {});
      } finally {
        // Clear session state whether success or failure
        await chrome.storage.session.clear();
      }
    });

    return false; // async work is internal; no sendResponse
  }
});

// ─── Section 4: Clear session on tab close ───────────────────────────────────

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { activeTabId } = await chrome.storage.session.get(['activeTabId']);
  if (tabId === activeTabId) {
    await chrome.storage.session.clear();
  }
});
