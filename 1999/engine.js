/** Count Unicode characters, not UTF-16 units. Korean IME commits are handled by UI. */
export const chars = text => Array.from(text.normalize('NFC'));
export function score(target, typed, elapsedMs) {
  const expected = chars(target), actual = chars(typed);
  const correct = actual.reduce((n, c, i) => n + Number(c === expected[i]), 0);
  const errors = actual.length - correct;
  const minutes = Math.max(0, elapsedMs) / 60000;
  return { correct, errors, entered: actual.length, total: expected.length,
    accuracy: actual.length ? Math.round(correct / actual.length * 100) : 100,
    cpm: minutes > 0 ? Math.round(correct / minutes) : 0,
    complete: actual.length >= expected.length,
    perfect: actual.length === expected.length && errors === 0 };
}
export function makeSession(target, now = 0) {
  return { target, typed: '', startedAt: null, updatedAt: now, finishedAt: null };
}
export function updateSession(session, typed, now) {
  if (session.finishedAt !== null) return session;
  const startedAt = session.startedAt ?? (typed ? now : null);
  return { ...session, typed, startedAt, updatedAt: now };
}
export function finishSession(session, now) {
  return { ...session, finishedAt: session.finishedAt ?? now };
}
export function sessionScore(session, now) {
  return score(session.target, session.typed,
    session.startedAt === null ? 0 : (session.finishedAt ?? now) - session.startedAt);
}
export function parseImportedText(text) {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim().slice(0, 50000);
}
export function readProgress(storage) {
  try {
    const raw = JSON.parse(storage.getItem('retro-typing-progress-v1') || '[]');
    return Array.isArray(raw) ? raw.filter(x => x && typeof x.mode === 'string' && Number.isFinite(x.cpm) && Number.isFinite(x.accuracy)).slice(-100) : [];
  } catch { return []; }
}
export function saveProgress(storage, progress, entry) {
  const next = [...progress, entry].slice(-100);
  try { storage.setItem('retro-typing-progress-v1', JSON.stringify(next)); } catch { /* Private mode/storage full: typing still works. */ }
  return next;
}
// Two-set Hangul key-unit estimate: compound vowels/final clusters use two keys.
export function keyUnits(text) {
 const doubleVowels = new Set([9,10,11,14,15,16,19]);
 const doubleFinals = new Set([3,5,6,9,10,11,12,13,14,15,18]);
 return chars(text).reduce((sum,c)=>{const original=originalGlyphUnits(c);if(original!==null)return sum+original;const code=c.codePointAt(0)-0xAC00;if(code<0||code>=11172)return sum+1;const vowel=Math.floor(code/28)%21,final=code%28;return sum+1+(doubleVowels.has(vowel)?2:1)+(final?(doubleFinals.has(final)?2:1):0)},0);
}

/** Original-glyph aliases are supplementary PUA, not a single arbitrary key.
 * Return component units for Korean raw partials; Japanese blank-prefix aliases
 * count one original glyph unit, including the invalid-prefix blank glyph. */
export function originalGlyphUnits(character){
 const raw=character.codePointAt(0)-0xf0000;
 if(raw===0x1f00||raw===0x1f60)return 1;
 if(raw<0x8000||raw>0xffff)return null;
 const leads=(raw>>10)&31,vowel=(raw>>5)&31,tail=raw&31;
 const vowels=[3,4,5,6,7,10,11,12,13,14,15,18,19,20,21,22,23,26,27,28,29];
 const finals=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,19,20,21,22,23,24,25,26,27,28,29];
 const v=vowels.indexOf(vowel),t=finals.indexOf(tail);
 return (leads===1?0:1)+(vowel===2?0:[9,10,11,14,15,16,19].includes(v)?2:1)+(tail===1?0:[3,5,6,9,10,11,12,13,14,15,18].includes(t)?2:1);
}
