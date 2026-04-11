// extension/background.js — MV3 Service Worker
// Brain of the recorder: hash detection, config fetch, content injection,
// action buffering, message relay, save POST, keepalive port acceptance.
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

// ─── Section 2: Tab hash detection (EXT-01) ──────────────────────────────────

// Pitfall 1: changeInfo.url is only populated when extension has "tabs" permission.
// Single-tab guard: only activate on the first matching tab (D-14, RESEARCH.md §Open Questions 2).
// Track injection attempts to avoid double-injection
const injectedTabs = new Set();

async function tryActivateSession(tabId, url) {
  if (!url || !url.includes('__rec=')) return;

  // Single-tab guard: ignore if another recording session is already active
  const existing = await chrome.storage.session.get(['activeTabId']);
  if (existing.activeTabId != null) return;

  // Avoid double-injection
  if (injectedTabs.has(tabId)) return;

  // Match #__rec=PORT — also handles multi-param hashes like #existing&__rec=PORT
  const match = url.match(/#(?:.*&)?__rec=(\d+)/);
  if (!match) return;
  const port = parseInt(match[1], 10);

  console.log('[rec] Detected recording session on tab', tabId, 'port', port);
  injectedTabs.add(tabId);

  // Store session state immediately (Pitfall 3: write to storage before anything async)
  await chrome.storage.session.set({ activeTabId: tabId, port, actions: [], config: null });

  // EXT-02: Fetch config from CLI server (service worker can fetch localhost via host_permissions)
  let config;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/extension-config`);
    config = await res.json();
  } catch (err) {
    console.error('[rec] Failed to fetch extension-config:', err);
    await chrome.storage.session.clear();
    injectedTabs.delete(tabId);
    return;
  }
  await chrome.storage.session.set({ config });

  // D-24: Register side panel for this specific tab
  await chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: true });

  // D-23: Inject content script only when hash detected (programmatic, not declarative)
  // Pitfall 6: requires "scripting" permission in manifest
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    console.log('[rec] Content script injected into tab', tabId);
  } catch (err) {
    console.error('[rec] Failed to inject content script:', err);
    injectedTabs.delete(tabId);
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Check on every event — URL changes, status changes, etc.
  // The hash might be visible in changeInfo.url OR tab.url at different times
  const url = changeInfo.url || tab.url;
  await tryActivateSession(tabId, url);

  // Re-inject content script when the recording tab navigates to a new page.
  // executeScript only runs once — page navigation destroys the content script.
  if (changeInfo.status === 'complete') {
    const { activeTabId } = await chrome.storage.session.get(['activeTabId']);
    if (tabId === activeTabId && injectedTabs.has(tabId)) {
      try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
        console.log('[rec] Re-injected content script after navigation, tab', tabId);
      } catch (err) {
        console.error('[rec] Re-injection failed:', err);
      }
    }
  }
});

// ─── Section 3: Message relay (EXT-03, D-18, D-19) ──────────────────────────

// D-18: All messages use typed format: { type, data }
// Pitfall 5: onMessage handler is NOT async at the outer level — returns false for fire-and-forget
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
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

  // ── Stop & Save from side panel (D-21, Pattern 7) ──
  if (msg.type === 'save') {
    chrome.storage.session.get(['actions', 'config', 'port']).then(async ({ actions = [], config, port }) => {
      if (!config || !port) {
        console.error('[rec] Cannot save: missing config or port in session storage');
        chrome.runtime.sendMessage({ type: 'save-complete', error: 'No active session' }).catch(() => {});
        return;
      }
      try {
        await fetch(`http://127.0.0.1:${port}/api/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: config.sessionName, actions })
        });
        chrome.runtime.sendMessage({ type: 'save-complete' }).catch(() => {});
      } catch (err) {
        console.error('[rec] Save POST failed:', err);
        chrome.runtime.sendMessage({ type: 'save-complete', error: String(err) }).catch(() => {});
      }
      // Clear session state after save (successful or not)
      await chrome.storage.session.clear();
    });

    return false; // async work is internal; no sendResponse
  }

  // ── Config request from side panel ──
  if (msg.type === 'config-request') {
    chrome.storage.session.get(['config']).then(({ config }) => {
      chrome.runtime.sendMessage({ type: 'config-response', data: config }).catch(() => {});
    });
    return false;
  }
});

// ─── Section 4: Clear session on tab close ───────────────────────────────────

chrome.tabs.onRemoved.addListener(async (tabId) => {
  injectedTabs.delete(tabId);
  const { activeTabId } = await chrome.storage.session.get(['activeTabId']);
  if (tabId === activeTabId) {
    await chrome.storage.session.clear();
  }
});
