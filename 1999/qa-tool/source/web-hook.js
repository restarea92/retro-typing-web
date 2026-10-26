
// Explicit opt-in QA adapter. Normal production visits do not load this module.
if (typeof URLSearchParams !== 'undefined' && new URLSearchParams(window.location?.search || '').get('qa') === '1') {
 import('./qa/web-adapter.js').then(({installQaWebAdapter})=>installQaWebAdapter({
  bridge:keyboardBridge,
  releasePointer:()=>originalMouse.cancel(),
  getOwner:currentInputOwner,
  getState:()=>({rng:originalRandom.configuration,mode,languageCode:currentLanguage,layout:appSettings.layout,composer:composerMode?{...composerMode}:null}),
  document
 })).catch(error=>console.error('QA input adapter failed to load:',error));
}
