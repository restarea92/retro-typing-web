import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { requirePrivateResources } from './private-resources.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
try {
  await requirePrivateResources(join(root,'1999'));
  try { await import('linkedom'); } catch { throw new Error('The optional simulated-DOM suite needs LinkeDOM 0.18.14. Run npm install first.'); }
  const cases = (await readdir(join(root,'1999/qa'))).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>`1999/qa/${name}`);
  const result = spawnSync(process.execPath, ['--test', '1999/tests/warmup-clock-paint.test.mjs', ...cases], {
    cwd: root, stdio: 'inherit', env: {...process.env, RUN_PRIVATE_RESOURCE_TESTS:'1'},
  });
  process.exitCode = result.status ?? 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
