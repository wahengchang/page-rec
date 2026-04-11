#!/usr/bin/env node
import { program } from 'commander';
import pc from 'picocolors';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

program
  .name('page-rec')
  .description('Browser behaviour recorder')
  .version('1.0.0');

// ─── start ───────────────────────────────────────────────────────────────────

program
  .command('start')
  .description('Start a recording session')
  .requiredOption('-u, --url <url>', 'Target URL to record')
  .option('-p, --port <port>', 'Bind server to specific port (default: random)', parseInt)
  .action(async (options) => {
    const { startServer } = await import('../src/server.js');
    await startServer(options.url, options.port);
  });

// ─── list (STOR-03 / D-07 / D-08 / D-09) ────────────────────────────────────

program
  .command('list')
  .description('List all saved recordings')
  .action(async () => {
    const { listRecordings } = await import('../src/store.js');
    const recordings = await listRecordings();

    if (recordings.length === 0) {
      console.log('No recordings found.');
      return;
    }

    // D-08: simple string padding — no table dependency
    const NAME_WIDTH = Math.max(4, ...recordings.map(r => r.name.length)) + 2;
    const COUNT_WIDTH = 9;

    console.log(
      pc.bold('Name'.padEnd(NAME_WIDTH)) +
      pc.bold('Actions'.padEnd(COUNT_WIDTH)) +
      pc.bold('Recorded')
    );
    for (const r of recordings) {
      console.log(
        r.name.padEnd(NAME_WIDTH) +
        String(r.actions.length).padEnd(COUNT_WIDTH) +
        new Date(r.timestamp).toLocaleString()
      );
    }
  });

// ─── delete (STOR-04 / D-10 / D-11 / D-12) ──────────────────────────────────

program
  .command('delete')
  .description('Delete a saved recording')
  .argument('<name>', 'Recording name to delete')
  .action(async (name) => {
    const { deleteRecording } = await import('../src/store.js');
    const deleted = await deleteRecording(name);
    if (!deleted) {
      // D-11: error message exact format
      console.error(pc.red(`Recording "${name}" not found.`));
      process.exit(1);
    }
    console.log(pc.green(`Recording "${name}" deleted.`));
  });

// ─── export (EXPO-01 / EXPO-02 / EXPO-03 / D-13 / D-17) ─────────────────────

program
  .command('export')
  .description('Export a recording as a Playwright test')
  .argument('<name>', 'Recording name to export')
  .action(async (name) => {
    const { getRecording } = await import('../src/store.js');
    const { generateTest } = await import('../src/export.js');

    const recording = await getRecording(name);
    if (!recording) {
      // D-17: error message exact format
      console.error(pc.red(`Recording "${name}" not found.`));
      process.exit(1);
    }

    // D-13: write <name>.spec.js in cwd
    const outPath = join(process.cwd(), `${name}.spec.js`);
    const content = generateTest(recording);
    await writeFile(outPath, content, 'utf8');
    console.log(pc.green(`Exported: ${outPath}`));
  });

// ─── describe ───────────────────────────────────────────────────────────────

program
  .command('describe')
  .description('Describe a recording in natural language')
  .argument('<name>', 'Recording name to describe')
  .option('-o, --output <file>', 'Write to file instead of stdout')
  .action(async (name, options) => {
    const { getRecording } = await import('../src/store.js');
    const { describeRecording } = await import('../src/describe.js');

    const recording = await getRecording(name);
    if (!recording) {
      console.error(pc.red(`Recording "${name}" not found.`));
      process.exit(1);
    }

    const text = describeRecording(recording);

    if (options.output) {
      const outPath = join(process.cwd(), options.output);
      await writeFile(outPath, text + '\n', 'utf8');
      console.log(pc.green(`Written: ${outPath}`));
    } else {
      console.log(text);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────

await program.parseAsync(process.argv);
