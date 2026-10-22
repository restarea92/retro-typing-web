import { access } from 'node:fs/promises';
import { join } from 'node:path';
export const RESOURCE_FILES = Object.freeze([
  'practice-texts.js', 'long-texts.js', 'help-pages.js',
  'original-compounds.js', 'original-finger-tables.js', 'original-key-stage-pools.js',
  'original-keyboard-maps.js', 'original-progression.js', 'original-word-stage-rules.js',
  'httd-original-pixel.woff', 'welcome-card.png',
]);
export async function requirePrivateResources(directory) {
  const missing = [];
  for (const name of RESOURCE_FILES) {
    try { await access(join(directory, name)); } catch { missing.push(name); }
  }
  if (missing.length) throw new Error(`This source archive omits private resources. No files will be downloaded.\nSupply compatible, lawfully usable local files before continuing:\n${missing.map(name => `  ${name}`).join('\n')}`);
}
