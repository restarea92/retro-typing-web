import { readdir, readFile } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
const skip = new Set(['.git', 'node_modules']);
const allowed = new Set(['.js', '.mjs', '.css', '.html', '.json', '.md', '.py']);
const excludedNames = new Set(['practice-texts.js','long-texts.js','help-pages.js','original-compounds.js','original-finger-tables.js','original-key-stage-pools.js','original-keyboard-maps.js','original-progression.js','original-word-stage-rules.js']);
const checks = [
  ['embedded image/font asset', /data:(?:image|font)\/[\w.+-]+[;,]/i],
  ['private absolute path', /\/(?:workspace|home|Users)\//],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['token-like credential', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9]{30,})\b/],
];
let count = 0, syntax = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = join(dir, entry.name), path = relative(root, full);
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not part of this source archive: ${path}`);
    if (entry.isDirectory()) { await walk(full); continue; }
    if ((!allowed.has(extname(entry.name)) && entry.name !== '.gitignore') || excludedNames.has(entry.name)) throw new Error(`Excluded file in publication tree: ${path}`);
    const content = await readFile(full, 'utf8');
    if (content.includes('\u0000')) throw new Error(`Binary content: ${path}`);
    for (const [label, pattern] of checks) if (pattern.test(content)) throw new Error(`${label}: ${path}`);
    if (['.js', '.mjs'].includes(extname(entry.name))) {
      const result = spawnSync(process.execPath, ['--check', full], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error(`Syntax check failed: ${path}\n${result.stderr}`);
      syntax++;
    }
    if (extname(entry.name) === '.py') {
      const result = spawnSync('python3', ['-c', 'import ast,pathlib,sys; ast.parse(pathlib.Path(sys.argv[1]).read_text())', full], {encoding:'utf8'});
      if (result.status !== 0) throw new Error(`Python syntax check needs Python 3 and valid source: ${path}\n${result.stderr || result.error || ''}`);
    }
    count++;
  }
}
await walk(root);
for (const edition of ['1997', '1999']) {
  const manifest = JSON.parse(await readFile(join(root, edition, 'SOURCE-MANIFEST.json'), 'utf8'));
  const testManifest = edition === '1999' ? JSON.parse(await readFile(join(root, edition, 'TEST-SOURCE-MANIFEST.json'), 'utf8')) : {files:[]};
  for (const file of [...manifest.files, ...testManifest.files]) {
    const data = await readFile(join(root, edition, file.path));
    const digest = createHash('sha256').update(data).digest('hex');
    if (digest !== file.publishedSha256) throw new Error(`Manifest hash mismatch: ${edition}/${file.path}`);
  }
}
console.log(`Verified ${count} public-source files; ${syntax} JavaScript syntax checks. This is not full runtime or rights verification.`);
