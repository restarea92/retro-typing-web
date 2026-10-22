import { BIOS_TICK_MS } from './original-metrics.js';
/** Presentation-only pauses, separate from measured typing. Startup source
 * waits until BIOS tick > start+30; other pauses are user-requested approximations. */
export function originalLogoDelay(now){return (Math.floor(now/BIOS_TICK_MS)+31)*BIOS_TICK_MS-now;}
export const PRESENTATION_TIMING={firstLoad:31*BIOS_TICK_MS,firstExercise:180,statistics:300,subsequentExercise:0};
let firstExercise=true;
export function pauseFor(action){let delay=0;if(action==='boot')delay=originalLogoDelay(performance.now());else if(action.startsWith('stats-'))delay=PRESENTATION_TIMING.statistics;else if(['long','sentences','exam'].includes(action)&&firstExercise){delay=PRESENTATION_TIMING.firstExercise;firstExercise=false}if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)delay=0;return delay?new Promise(resolve=>setTimeout(resolve,delay)):Promise.resolve();}

/** Display-only native MM:SS rolls over after59:59; timing/statistics do not. */
export function formatOriginalElapsedClock(elapsedMs){const seconds=Math.floor(elapsedMs/1000);return String(Math.floor(seconds/60)%60).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
