/** Archive identity, not an authenticated publisher build/version claim.
 * The DOS frame retains the original product title; the web shell identifies
 * which separately supplied source archive this recreation follows. */
export const EDITION = Object.freeze({
 id:'1997',
 label:'1997',
 archiveSha256:'47931756fd9e35d2de4fe0f53a1f3e35dbb8019aa7c22ab866b92e631015c100',
 executableSha256:'4cd9a0efcd7676d6f08528643bb76fcb0834dc61881a046149ac85b0702c90c7',
 storagePrefix:'retro-typing-1997:'
});
/** Isolate every native store, settings and stage key from the 1999 edition,
 * even when both variants are served under one origin during local review.
 * Deliberately do not migrate another edition's records. */
export function createEditionStorage(storage,prefix=EDITION.storagePrefix){
 return Object.freeze({
  getItem:key=>storage.getItem(prefix+String(key)),
  setItem:(key,value)=>storage.setItem(prefix+String(key),String(value)),
  removeItem:key=>storage.removeItem?.(prefix+String(key))
 });
}

// The native sentence loader counts CRLF terminators, not a final unterminated
// record. All source text remains preserved in practice-texts.js.
export const NATIVE_SENTENCE_COUNTS=Object.freeze({ko:713,en:231,ja:300});
