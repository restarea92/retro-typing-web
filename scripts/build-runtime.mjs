import { mkdir, readFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RESOURCE_FILES, requirePrivateResources } from './private-resources.mjs';
const edition = process.argv[2];
if (!['1997','1999'].includes(edition)) throw new Error('Usage: node scripts/build-runtime.mjs 1997|1999');
const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, edition);
try {
  await requirePrivateResources(source);
  const manifest = JSON.parse(await readFile(join(source, 'SOURCE-MANIFEST.json'), 'utf8'));
  // A unique destination prevents stale or unrelated files from entering a build.
  const destination = join(root, 'dist', `${edition}-${Date.now()}`);
  await mkdir(destination, {recursive:true});
  for (const name of [...manifest.files.map(file=>file.path), ...RESOURCE_FILES]) await copyFile(join(source,name), join(destination,name));
  console.log(`Built ${destination}. Embedded CSS assets remain omitted; this is not pixel-equivalence verification. Review local asset rights before any distribution.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
