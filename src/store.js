import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// D-01: Use cwd so the file is created wherever the user runs `page-rec`
// Pitfall 2: function not constant — cwd evaluated at call time, not module load time
const STORE_PATH = () => join(process.cwd(), 'recorder-scripts.json');

async function readStore() {
  try {
    const raw = await readFile(STORE_PATH(), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return {};  // D-04: file not yet created
    if (err instanceof SyntaxError) {
      // Pitfall 5: corrupt JSON — do NOT silently return {} (would lose existing recordings)
      throw new Error('recorder-scripts.json is corrupt. Delete it to reset.');
    }
    throw err;  // permissions or other I/O errors — bubble up
  }
}

async function writeStore(data) {
  await writeFile(STORE_PATH(), JSON.stringify(data, null, 2), 'utf8');
}

// STOR-01 / STOR-02 / D-03: overwrite by key — same name replaces existing entry
export async function saveRecording({ name, timestamp, actions }) {
  const store = await readStore();
  store[name] = { name, timestamp, actions };
  await writeStore(store);
}

// STOR-03: return all recordings as an array for the list command
export async function listRecordings() {
  const store = await readStore();
  return Object.values(store);
}

// STOR-04: remove entry by name; return false if not found
export async function deleteRecording(name) {
  const store = await readStore();
  if (!(name in store)) return false;
  delete store[name];
  await writeStore(store);
  return true;
}

// EXPO-01: retrieve a single recording for export
export async function getRecording(name) {
  const store = await readStore();
  return store[name] ?? null;
}
