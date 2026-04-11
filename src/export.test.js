// src/export.test.js — TDD tests for generateTest() (RED phase)
// Run with: node --input-type=module src/export.test.js
// All assertions use console.assert for zero-dependency testing

import { generateTest } from './export.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: ${msg}`);
  }
}

// ─── Test 1: Basic recording with navigate as first action ───────────────────

const rec1 = {
  name: 'my-test',
  actions: [
    { type: 'navigate', selector: '', url: 'https://example.com', elapsed: 0 },
    { type: 'click', selector: '#btn', url: 'https://example.com', elapsed: 100 },
    { type: 'input', selector: '[name="q"]', url: 'https://example.com', elapsed: 200, value: 'alice' },
    { type: 'scroll', selector: '', url: 'https://example.com', elapsed: 300, value: '0,500' },
    { type: 'submit', selector: 'form', url: 'https://example.com', elapsed: 400 },
  ]
};
const out1 = generateTest(rec1);

assert(out1.includes("import { test, expect } from '@playwright/test'"), 'T1: missing playwright import');
assert(out1.includes("test.describe('my-test'"), 'T1: missing test.describe with name');
assert(out1.includes("test('recorded actions'"), 'T1: missing inner test');
assert(out1.includes("await page.goto('https://example.com')"), 'T1: navigate → page.goto');
assert(out1.includes("await page.click('#btn')"), 'T1: click → page.click');
assert(out1.includes("await page.fill") && out1.includes("alice"), 'T1: input → page.fill');
assert(out1.includes("window.scrollTo(0, 500)"), 'T1: scroll with Y=500');
assert(out1.includes("await page.click('form')"), 'T1: submit → page.click');
assert(out1.endsWith('\n'), 'T1: file ends with trailing newline');

// ─── Test 2: Password masking (D-16) ─────────────────────────────────────────

const rec2 = {
  name: 'login',
  actions: [
    { type: 'navigate', selector: '', url: 'https://login.com', elapsed: 0 },
    { type: 'input', selector: '#password', url: 'https://login.com', elapsed: 100, value: '***' },
  ]
};
const out2 = generateTest(rec2);

assert(out2.includes("// TODO: fill in real password"), 'T2: password masked → TODO comment');
assert(!out2.includes("'***'"), 'T2: should not include literal ***');
assert(out2.includes("page.fill('#password', ''"), 'T2: password fill has empty string value');

// ─── Test 3: Pitfall 4 — first action is not navigate, synthetic goto prepended ──

const rec3 = {
  name: 'no-nav',
  actions: [
    { type: 'click', selector: '#x', url: 'https://notnav.com', elapsed: 0 },
  ]
};
const out3 = generateTest(rec3);

// synthetic goto should appear BEFORE the click
const gotoIdx3 = out3.indexOf("await page.goto('https://notnav.com')");
const clickIdx3 = out3.indexOf("await page.click('#x')");
assert(gotoIdx3 !== -1, 'T3: Pitfall 4 — synthetic goto must be present');
assert(gotoIdx3 < clickIdx3, 'T3: Pitfall 4 — synthetic goto must precede click');

// ─── Test 4: Single-quote injection prevention (Pitfall 3) ───────────────────

const rec4 = {
  name: "it's a test",
  actions: [
    { type: 'navigate', selector: '', url: "https://x.com/it's", elapsed: 0 },
    { type: 'input', selector: "[name=\"it's\"]", url: "https://x.com", elapsed: 100, value: "o'clock" },
  ]
};
const out4 = generateTest(rec4);

assert(typeof out4 === 'string', 'T4: output is a string even with quotes in values');
// The key requirement: no unescaped single quotes inside JS string literals
// Verify the content is parseable JavaScript conceptually (just check escaping happened)
assert(out4.includes("\\'"), 'T4: single quotes are escaped in output');

// ─── Test 5: Scroll with malformed value defaults to 0 ───────────────────────

const rec5 = {
  name: 'malformed-scroll',
  actions: [
    { type: 'navigate', selector: '', url: 'https://x.com', elapsed: 0 },
    { type: 'scroll', selector: '', url: 'https://x.com', elapsed: 100, value: 'bad-value' },
    { type: 'scroll', selector: '', url: 'https://x.com', elapsed: 200 },  // no value at all
  ]
};
const out5 = generateTest(rec5);

assert(out5.includes("window.scrollTo(0, 0)"), 'T5: malformed scroll value defaults to Y=0');

// ─── Test 6: Unknown action type generates comment ────────────────────────────

const rec6 = {
  name: 'unknown-action',
  actions: [
    { type: 'navigate', selector: '', url: 'https://x.com', elapsed: 0 },
    { type: 'hover', selector: '#menu', url: 'https://x.com', elapsed: 100 },
  ]
};
const out6 = generateTest(rec6);

assert(out6.includes("// Unknown action type: hover"), 'T6: unknown type → comment');

// ─── Test 7: Empty actions array ─────────────────────────────────────────────

const rec7 = {
  name: 'empty-recording',
  actions: []
};
const out7 = generateTest(rec7);

assert(out7.includes("test.describe('empty-recording'"), 'T7: empty recording has describe block');
assert(out7.endsWith('\n'), 'T7: empty recording ends with newline');

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('ALL EXPORT TESTS PASSED');
