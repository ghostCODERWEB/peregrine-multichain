// Tests never touch the live database: unless a test file picks its own
// throwaway TIDE_DB_PATH (vi.hoisted), each file gets a fresh one here.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

if (!process.env.TIDE_DB_PATH || /data[\\/](tide|demo)\.db$/.test(process.env.TIDE_DB_PATH)) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-test-'));
  process.env.TIDE_DB_PATH = path.join(dir, 'test.db');
}
