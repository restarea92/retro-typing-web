/** Original PC-speaker frequency/duration sequences from HTTD b468.
 * Browser square-wave rendering is asynchronous and never delays input/scoring. */
export const ORIGINAL_SOUND_PATTERNS=Object.freeze({0:[[1600,40]],1:[[800,40]],2:[[450,55],[650,50],[1000,45]]});
let context=null,active=[];
export function playOriginalSound(type,enabled=true){
 if(!enabled||!ORIGINAL_SOUND_PATTERNS[type])return false;
 const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return false;
 try{
  context??=new Audio();if(context.state==='suspended')context.resume().catch(()=>{});
  for(const oscillator of active)try{oscillator.stop();}catch{}active=[];
  let start=context.currentTime;
  for(const [frequency,milliseconds]of ORIGINAL_SOUND_PATTERNS[type]){
   const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type='square';oscillator.frequency.setValueAtTime(frequency,start);gain.gain.setValueAtTime(0.035,start);oscillator.connect(gain);gain.connect(context.destination);oscillator.onended=()=>{try{oscillator.disconnect();gain.disconnect();}catch{}};oscillator.start(start);oscillator.stop(start+milliseconds/1000);active.push(oscillator);start+=milliseconds/1000;
  }
  return true;
 }catch{return false;}
}
