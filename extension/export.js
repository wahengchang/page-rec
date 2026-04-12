// extension/export.js — Playwright test generator (classic browser script).
// Ported verbatim from src/export.js. DO NOT diverge from src/export.js output.
// Any behavior change here MUST be mirrored in src/export.js and src/export.test.js.
// No Playwright library needed at generation time — pure string construction.
(function () {
  // Pitfall 3: escape single quotes in all interpolated strings to prevent JS syntax errors
  function escapeSingleQuote(str) {
    return String(str ?? '').replace(/'/g, "\\'");
  }

  // Build the best Playwright locator from action data
  // Prefer specific selectors; fall back to text= only if nothing better exists
  function bestLocator(action) {
    const sel = action.selector || '';
    const meta = action.meta || {};

    // data-testid is the gold standard
    if (meta.testId) return `[data-testid="${escapeSingleQuote(meta.testId)}"]`;
    // #id selectors are reliable
    if (sel.startsWith('#')) return escapeSingleQuote(sel);
    // [name=...] selectors
    if (sel.startsWith('[name=')) return escapeSingleQuote(sel);
    // aria-label
    if (sel.startsWith('[aria-label=')) return escapeSingleQuote(sel);
    // If selector is a text= but meta has className, build a more specific locator
    if (sel.startsWith('text=') && meta.tagName && meta.className) {
      const cls = meta.className.split(/\s+/)[0];
      if (cls) return `${meta.tagName}.${escapeSingleQuote(cls)}`;
    }
    // Default: use the recorded selector as-is
    return escapeSingleQuote(sel);
  }

  // D-15: map a single recorded action to its Playwright equivalent line
  function actionToPlaywright(action) {
    switch (action.type) {
      case 'navigate':
        return `await page.goto('${escapeSingleQuote(action.url)}', { waitUntil: 'domcontentloaded' });`;

      case 'click':
      case 'submit':  // D-15: submit maps to page.click() on the submit element
        return `await page.click('${bestLocator(action)}');`;

      case 'input':
        if (action.value === '***') {
          // D-16: password-masked inputs get a TODO placeholder, not the literal ***
          return `await page.fill('${bestLocator(action)}', ''); // TODO: fill in real password`;
        }
        return `await page.fill('${bestLocator(action)}', '${escapeSingleQuote(action.value)}');`;

      case 'scroll': {
        // Scroll value format from content.js: "scrollX,scrollY" string (e.g. "0,500")
        // Extract Y offset; default to 0 if absent or malformed
        const parts = String(action.value ?? '0,0').split(',');
        const y = parseInt(parts[1] ?? '0', 10) || 0;
        return `await page.evaluate(() => window.scrollTo(0, ${y}));`;
      }

      default:
        return `// Unknown action type: ${action.type}`;
    }
  }

  // EXPO-01 / EXPO-02 / EXPO-03: Generate complete .spec.js content string
  function generateTest(recording) {
    const { name, actions } = recording;
    const lines = [];

    // D-14: file header
    lines.push(`import { test, expect } from '@playwright/test';`);
    lines.push('');
    lines.push(`test.describe('${escapeSingleQuote(name)}', () => {`);
    lines.push(`  test('recorded actions', async ({ page }) => {`);

    // Pitfall 4: if first action is not 'navigate', prepend a synthetic goto
    // so the Playwright test always starts with a loaded page
    if (actions.length > 0 && actions[0].type !== 'navigate') {
      lines.push(`    await page.goto('${escapeSingleQuote(actions[0].url)}', { waitUntil: 'domcontentloaded' });`);
    }

    for (const action of actions) {
      lines.push('    ' + actionToPlaywright(action));
    }

    lines.push('  });');
    lines.push('});');
    lines.push('');  // trailing newline

    return lines.join('\n');
  }

  window.generateTest = generateTest;
})();
