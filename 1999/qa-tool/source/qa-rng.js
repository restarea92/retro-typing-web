/** Read-only RNG provenance. Never changes loaded executable bytes or game state. */
const ORIGINAL_SHA256='8eaf841b5af1810687b26b7b07c16de0e2d434546c19c6088d31a228fb38d1f5',OFFSET=0x48cf;
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
export async function inspectExecutableRng(bytes){
 const unknown={mode:'unverified',qaSeed:null,initialSeed:null,verified:false};
 if(!(bytes instanceof Uint8Array))return Object.freeze(unknown);
 const hash=await digest(bytes);
 if(hash===ORIGINAL_SHA256)return Object.freeze({mode:'original-dos-time',qaSeed:null,initialSeed:1,verified:true,sha256:hash});
 if(bytes.length>OFFSET+3&&bytes[OFFSET]===0xb8){
  const original=bytes.slice(),seed=bytes[OFFSET+1]|(bytes[OFFSET+2]<<8);original.set([0x8b,0x46,0x06],OFFSET);
  if(await digest(original)===ORIGINAL_SHA256)return Object.freeze({mode:'qa-fixed-reseed',qaSeed:seed,initialSeed:1,verified:true,sha256:hash,originalSha256:ORIGINAL_SHA256});
 }
 return Object.freeze({...unknown,sha256:hash});
}
/** Preserve duplicate/invalid values: the app's strict opt-in parser rejects them. */
export function webQaUrl(search=''){
 const input=new URLSearchParams(search),output=new URLSearchParams({qa:'1'});
 for(const value of input.getAll('qaRngSeed'))output.append('qaRngSeed',value);
 return '../?'+output.toString();
}
export function describeRng(web,dos){
 const webFixed=web?.mode==='qa-fixed-reseed',dosFixed=dos?.verified&&dos?.mode==='qa-fixed-reseed';
 const seedSetupMatched=Boolean(webFixed&&dosFixed&&web.qaSeed===dos.qaSeed&&web.initialSeed===1&&dos.initialSeed===1);
 let text;
 if(!dos)text=`DOS 파일 로드 대기 · ${webFixed?'웹만 QA 재시드 '+web.qaSeed+' 고정':web?'웹 시간 시드':'웹 준비 대기'}. 양쪽 난수는 아직 미동기화입니다.`;
 else if(!dos.verified||!['original-dos-time','qa-fixed-reseed'].includes(dos.mode))text=`DOS 원본·시드 미확인 · ${webFixed?'웹만 QA 재시드 '+web.qaSeed+' 고정':web?'웹 시간 시드':'웹 준비 대기'}. DOS 시드 방식을 추정하지 않습니다.`;
 else if(!web)text='웹 준비 대기 · DOS 출처 확인됨. 양쪽 시드 상태는 아직 비교할 수 없습니다.';
 else if(seedSetupMatched)text=`양쪽 QA 재시드 ${web.qaSeed} 확인 · 시작 state 1. 호출 순서·시간·게임 결과는 자동 동기화되지 않습니다.`;
 else if(webFixed&&dosFixed)text=`QA 시드 불일치: 웹 ${web.qaSeed} / DOS ${dos.qaSeed}. 같은 시드의 QA 복사본을 선택하세요.`;
 else if(webFixed)text=`웹만 QA 재시드 ${web.qaSeed} 고정 · DOS ${dos?.verified?'원본 시간 시드':'시드 미확인'}: 양쪽 난수는 아직 미동기화입니다.`;
 else if(dosFixed)text=`DOS만 QA 재시드 ${dos.qaSeed} 고정 · 웹은 시간 시드입니다. URL에 ?qaRngSeed=${dos.qaSeed}를 지정하세요.`;
 else text='원본 시간 시드 모드 · DOS/웹의 실행 시각과 난수 소비 순서는 동기화하지 않습니다.';
 return {seedSetupMatched,timingSynchronized:false,gameplaySynchronized:false,web:web||null,dos:dos||null,text};
}

/** Ready describes emulator state, not provenance unless the hash was verified. */
export function describeDosReady(rng){
 if(rng?.verified&&rng.mode==='qa-fixed-reseed')return `QA 복사본 준비 완료 · 재시드 ${rng.qaSeed}`;
 if(rng?.verified&&rng.mode==='original-dos-time')return '원본 준비 완료 · 시간 시드';
 return 'DOS 준비 완료 · 원본·시드 미확인';
}
