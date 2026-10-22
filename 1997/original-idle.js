/** DOS callers use minute*60+second, not elapsed monotonic milliseconds.
 * Strict >60 means the last whole-second boundary is included. The native
 * hour-wrap quirk is intentionally preserved for this original behavior. */
export function originalClockSeconds(now=Date.now()){
 const date=new Date(now);return date.getMinutes()*60+date.getSeconds();
}
export function createOriginalIdle({started=true,now=Date.now()}={}){
 return {last:started?originalClockSeconds(now):null};
}
export function touchOriginalIdle(state,now=Date.now()){
 state.last=originalClockSeconds(now);return state;
}
export function originalIdleExpired(state,now=Date.now()){
 return state?.last!==null&&state?.last!==undefined&&originalClockSeconds(now)>state.last+60;
}
