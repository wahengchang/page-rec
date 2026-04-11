import express from 'express';
import open from 'open';
import pc from 'picocolors';
import { saveRecording } from './store.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function deriveSessionName(targetUrl) {
  const { hostname } = new URL(targetUrl);
  const slug = hostname.replace(/\./g, '-');
  const ts = Math.floor(Date.now() / 1000);
  return `${slug}-${ts}`;
}

function injectRecPort(targetUrl, port) {
  const u = new URL(targetUrl);
  const tag = `__rec=${port}`;
  if (!u.hash || u.hash === '#') {
    u.hash = tag;          // D-04: no existing hash
  } else {
    u.hash = u.hash.slice(1) + '&' + tag;  // D-05: preserve existing hash
  }
  return u.toString();
}

// ─── Server ─────────────────────────────────────────────────────────────────

/**
 * Start the recording session server.
 * @param {string} targetUrl - The URL to open in Chrome
 * @param {number|undefined} requestedPort - Explicit port or undefined for OS-assigned (D-07)
 */
export async function startServer(targetUrl, requestedPort) {
  const app = express();
  app.use(express.json());

  const startedAt = Date.now();
  const sessionName = deriveSessionName(targetUrl);
  let shutdownTimer;

  // ─── Routes ───────────────────────────────────────────────────────────────

  // CLI-02: Extension service worker reads this to get session context
  app.get('/extension-config', (_req, res) => {
    res.json({ targetUrl, sessionName, startedAt });
  });

  // CLI-03 / DATA-01 / DATA-02 / DATA-03: Accept recorded actions payload
  app.post('/api/actions', async (req, res) => {
    const { name, actions } = req.body ?? {};

    // Validate outer shape (DATA-03)
    if (!name || typeof name !== 'string' || !Array.isArray(actions)) {
      return res.status(400).json({
        error: 'Invalid payload: name (string) and actions (array) required',
      });
    }

    // Validate each action (DATA-01, DATA-02)
    for (const action of actions) {
      if (
        !action.type ||
        typeof action.selector !== 'string' || // can be '' for scroll/navigate
        !action.url ||
        typeof action.elapsed !== 'number'
      ) {
        return res.status(400).json({
          error: 'Invalid action shape: type, selector, url (strings) and elapsed (number) required',
        });
      }
    }

    // D-02: Confirmation on successful save
    console.log(pc.green(`Saved: "${name}" — ${actions.length} action(s)`));

    // STOR-01 / D-05 / D-06: Persist recording to recorder-scripts.json
    await saveRecording({ name, timestamp: new Date().toISOString(), actions });

    res.json({ ok: true });
    // CLI-04: Shut down after save (response flushes before exit via server.close callback)
    shutdown('save');
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  function shutdown(_reason) {
    clearTimeout(shutdownTimer);
    server.close(() => process.exit(0));
  }

  // CLI-01 / D-07 / D-10: Bind to 127.0.0.1 on random (or explicit) port
  const server = app.listen(requestedPort ?? 0, '127.0.0.1', async () => {
    const { port } = server.address();

    // D-01: Minimal output — server URL + prompt
    console.log(pc.green(`Recording...  http://127.0.0.1:${port}  — press Ctrl+C to stop`));

    // CLI-05: Open Chrome with port embedded in hash (D-04 / D-05)
    const urlWithPort = injectRecPort(targetUrl, port);
    await open(urlWithPort);

    // CLI-06 / D-09: Auto-shutdown after 30 minutes
    shutdownTimer = setTimeout(() => {
      console.log(pc.yellow('30-minute timeout reached. Shutting down. No save was received.'));
      shutdown('timeout');
    }, 30 * 60 * 1000);

    // D-08: SIGINT warning before exit
    process.on('SIGINT', () => {
      console.log(pc.yellow('\nCtrl+C detected. Unsaved recording data will be lost. Shutting down.'));
      shutdown('sigint');
    });
  });

  // Pitfall 3: EADDRINUSE on explicit port — human-readable error
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(pc.red(`Port ${requestedPort} is already in use. Try without -p for a random port.`));
      process.exit(1);
    }
    throw err;
  });
}
