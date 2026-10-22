import test from 'node:test';
import assert from 'node:assert/strict';
import { score, parseImportedText, readProgress } from '../1999/engine.js';
import { score as score1997 } from '../1997/engine.js';
import { createEditionStorage } from '../1997/edition.js';
import { textColumns, energyAfter, acceptGameCommittedInput } from '../1999/game-rules.js';

test('Unicode scoring counts characters rather than UTF-16 code units', () => {
  const result = score('가🙂', '가🙂', 60000);
  assert.equal(result.correct, 2);
  assert.equal(result.cpm, 2);
  assert.equal(result.perfect, true);
});
test('text imports normalize BOM and line endings', () => {
  assert.equal(parseImportedText('\ufeffa\r\nb\r'), 'a\nb');
});
test('malformed local progress is handled without crashing', () => {
  assert.deepEqual(readProgress({getItem: () => 'not json'}), []);
});
test('game columns and energy limits are explicit', () => {
  assert.equal(textColumns('가a'), 3);
  assert.equal(energyAfter(17, 1), 17);
  assert.equal(energyAfter(0, -1), 0);
});
test('a full game input buffer submits its ten cells', () => {
  assert.deepEqual(acceptGameCommittedInput('abcdefghij'), {submitted: ['abcdefghij'], remaining: ''});
});

test('1997 archived scoring remains independently importable', () => {
  assert.equal(score1997('ab', 'ab', 60000).perfect, true);
});
test('1997 storage adapter uses its edition prefix', () => {
  const values = new Map([['record', '1999']]);
  const storage = createEditionStorage({getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)});
  storage.setItem('record', '1997');
  assert.equal(storage.getItem('record'), '1997');
  assert.equal(values.get('record'), '1999');
});
