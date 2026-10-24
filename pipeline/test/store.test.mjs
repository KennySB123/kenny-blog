import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

test('DRY_RUN never writes the ledger or job files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-'));
  fs.mkdirSync(path.join(root, 'src/data'), { recursive: true });
  const ledger = path.join(root, 'src/data/syndication.json');
  fs.writeFileSync(ledger, '{"posts":{}}\n');
  const script = `
    const { persist, setLedgerEntry } = await import(${JSON.stringify(new URL('../src/lib/store.mjs', import.meta.url).href)});
    persist({ ledger: [setLedgerEntry('x', 'devto', { skipped: 'test' })], files: { 'pipeline/jobs/x/job.json': '{}' } }, 'msg');
  `;
  execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, REPO_ROOT: root, DRY_RUN: '1', GITHUB_ACTIONS: '' } });
  assert.equal(fs.readFileSync(ledger, 'utf8'), '{"posts":{}}\n');
  assert.equal(fs.existsSync(path.join(root, 'pipeline/jobs/x/job.json')), false);
});
