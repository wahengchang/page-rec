// src/store.test.js — TDD RED phase tests for store.js
// Run: node --input-type=module < src/store.test.js (from project root)
// Or: node src/store.test.js --input-type=module won't work, use inline runner

import { writeFile, unlink, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const storePath = join(process.cwd(), 'recorder-scripts.json');

let passed = 0;
let failed = 0;

async function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

async function reset() {
  try { await unlink(storePath); } catch {}
}

// ── TESTS ─────────────────────────────────────────────────────────────────────

import { saveRecording, listRecordings, deleteRecording, getRecording } from './store.js';

console.log('\n--- Test: saveRecording creates file on first call ---');
await reset();
await saveRecording({ name: 'test-1', timestamp: '2026-01-01T00:00:00.000Z', actions: [{ type: 'click', selector: '#btn', url: 'https://ex.com', elapsed: 100 }] });
const fileExists = await readFile(storePath, 'utf8').then(() => true).catch(() => false);
await assert(fileExists, 'recorder-scripts.json is created on first save');

console.log('\n--- Test: saveRecording stores correct shape ---');
const contents = JSON.parse(await readFile(storePath, 'utf8'));
await assert(contents['test-1'] !== undefined, 'entry keyed by name exists');
await assert(contents['test-1'].name === 'test-1', 'entry.name matches');
await assert(contents['test-1'].timestamp === '2026-01-01T00:00:00.000Z', 'entry.timestamp matches');
await assert(Array.isArray(contents['test-1'].actions), 'entry.actions is array');
await assert(contents['test-1'].actions.length === 1, 'entry.actions has 1 item');

console.log('\n--- Test: listRecordings returns all entries ---');
const list = await listRecordings();
await assert(list.length === 1, 'listRecordings returns 1 entry');
await assert(list[0].name === 'test-1', 'listRecordings entry.name correct');

console.log('\n--- Test: saveRecording overwrites same name (STOR-02) ---');
await saveRecording({ name: 'test-1', timestamp: '2026-01-02T00:00:00.000Z', actions: [] });
const list2 = await listRecordings();
await assert(list2.length === 1, 'overwrite does not create duplicate');
await assert(list2[0].timestamp === '2026-01-02T00:00:00.000Z', 'timestamp updated on overwrite');
await assert(list2[0].actions.length === 0, 'actions updated on overwrite');

console.log('\n--- Test: multiple entries stored independently ---');
await saveRecording({ name: 'test-2', timestamp: '2026-01-03T00:00:00.000Z', actions: [{ type: 'navigate', selector: '', url: 'https://a.com', elapsed: 0 }] });
const list3 = await listRecordings();
await assert(list3.length === 2, 'second entry added without removing first');

console.log('\n--- Test: getRecording returns entry by name ---');
const rec = await getRecording('test-1');
await assert(rec !== null, 'getRecording returns entry');
await assert(rec.name === 'test-1', 'getRecording entry.name correct');

console.log('\n--- Test: getRecording returns null for missing ---');
const missing = await getRecording('no-such-recording');
await assert(missing === null, 'getRecording returns null for absent key');

console.log('\n--- Test: deleteRecording removes entry and returns true ---');
const deleted = await deleteRecording('test-1');
await assert(deleted === true, 'deleteRecording returns true when found');
const list4 = await listRecordings();
await assert(list4.length === 1, 'entry removed after delete');
await assert(list4[0].name === 'test-2', 'remaining entry is test-2');

console.log('\n--- Test: deleteRecording returns false for missing ---');
const notDeleted = await deleteRecording('no-such-recording');
await assert(notDeleted === false, 'deleteRecording returns false for missing');

console.log('\n--- Test: readStore returns {} for missing file (ENOENT) ---');
await reset();
const listEmpty = await listRecordings();
await assert(listEmpty.length === 0, 'empty list when file missing');

console.log('\n--- Test: readStore throws on corrupt JSON (Pitfall 5) ---');
await writeFile(storePath, '{ invalid json !!!', 'utf8');
let corruptError = null;
try {
  await listRecordings();
} catch (err) {
  corruptError = err;
}
await assert(corruptError !== null, 'corrupt JSON throws error');
await assert(
  corruptError?.message === 'recorder-scripts.json is corrupt. Delete it to reset.',
  `corrupt JSON error message exact: "${corruptError?.message}"`
);

// ── CLEANUP ──────────────────────────────────────────────────────────────────
await reset();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log('\nALL STORE TESTS PASSED');
