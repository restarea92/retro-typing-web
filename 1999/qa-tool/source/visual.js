/** Presentation only. Input transport, composition and recording live in the shared SDK. */
const KEY_ROWS = [
  [['Escape','Esc'],null,...Array.from({length:12},(_,i)=>['F'+(i+1),'F'+(i+1)]),null,['Delete','Del']],
  [['Backquote','`'],...Array.from({length:10},(_,i)=>['Digit'+((i+1)%10),String((i+1)%10)]),['Minus','−'],['Equal','='],['Backspace','Backspace','',2]],
  [['Tab','Tab','',1.5],...('QWERTYUIOP'.split('').map((c,i)=>['Key'+c,c,'ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔ'[i]])),['BracketLeft','['],['BracketRight',']'],['Backslash','\\','',1.5]],
  [['CapsLock','Caps','',1.8],...('ASDFGHJKL'.split('').map((c,i)=>['Key'+c,c,'ㅁㄴㅇㄹㅎㅗㅓㅏㅣ'[i]])),['Semicolon',';'],['Quote',"'"],['Enter','Enter','',2.2]],
  [['ShiftLeft','Shift','',2.3],...('ZXCVBNM'.split('').map((c,i)=>['Key'+c,c,'ㅋㅌㅊㅍㅠㅜㅡ'[i]])),['Comma',','],['Period','.'],['Slash','/'],['ShiftRight','Shift','',2.7]],
  [['ControlLeft','Ctrl','',1.3],['AltLeft','Alt','',1.3],['Space','Space','',6.8],['AltRight','Alt','',1.3],['ArrowLeft','←'],['ArrowDown','↓'],['ArrowUp','↑'],['ArrowRight','→'],['ControlRight','Ctrl','',1.3]]
];
const stateName=value=>typeof value==='string'?value:value?.status||value?.state||value?.phase||(value?.ready?'ready':'waiting');
export function createVisuals({onAction=()=>{},onVirtualKey=()=>{},document:doc=document,window:win=window}={}) {
  const $=id=>doc.getElementById(id), cleanups=[], pointerKeys=new Map();
  let snapshot={enabled:false,ready:false,pressedCodes:[]}, entries=[], pulseTimer=0, resizeFrame=0;
  const listen=(el,type,fn,opts)=>{el?.addEventListener(type,fn,opts);cleanups.push(()=>el?.removeEventListener(type,fn,opts));};
  const dispatch=(action,payload)=>{try{const r=onAction(action,payload);if(r?.catch)r.catch(showError);}catch(error){showError(error);}};
  function showError(error){const el=$('global-error');if(!el)return;el.textContent=error?.message||String(error);el.hidden=false;}
  function keyEvent(type,code){try{onVirtualKey({type,code});}catch(error){showError(error);}}
  function releasePointer(id){const code=pointerKeys.get(id);if(!code)return;pointerKeys.delete(id);keyEvent('keyup',code);}
  const keyboard=$('virtual-keyboard');
  if(keyboard){
    keyboard.replaceChildren();
    KEY_ROWS.forEach((keys,index)=>{
      const row=doc.createElement('div');row.className='keyboard-row'+(index===0?' function-row':'');
      for(const key of keys){
        if(!key){const spacer=doc.createElement('span');spacer.className='key-spacer';spacer.setAttribute('aria-hidden','true');row.append(spacer);continue;}
        const [code,label,ko='',width=1]=key,button=doc.createElement('button');button.type='button';button.className='keycap';button.dataset.code=code;button.style.setProperty('--key-width',width);button.setAttribute('aria-label',code);button.setAttribute('aria-pressed','false');button.title=code;
        const en=doc.createElement('span');en.textContent=label;button.append(en);if(ko){const syllable=doc.createElement('span');syllable.className='ko-label';syllable.textContent=ko;button.append(syllable);}
        listen(button,'pointerdown',event=>{if(event.button!==0)return;event.preventDefault();if(!snapshot.enabled)return;button.setPointerCapture?.(event.pointerId);pointerKeys.set(event.pointerId,code);keyEvent('keydown',code);});
        listen(button,'pointerup',event=>{event.preventDefault();releasePointer(event.pointerId);});listen(button,'pointercancel',event=>releasePointer(event.pointerId));listen(button,'lostpointercapture',event=>releasePointer(event.pointerId));
        listen(button,'keydown',event=>{if(event.repeat||!['Enter',' '].includes(event.key))return;event.preventDefault();event.stopPropagation();if(snapshot.enabled)keyEvent('keydown',code);});
        listen(button,'keyup',event=>{if(!['Enter',' '].includes(event.key))return;event.preventDefault();event.stopPropagation();keyEvent('keyup',code);});
        row.append(button);
      }keyboard.append(row);
    });
  }
  const actions={'bridge-toggle':'toggle','release-all':'release','clear-log':'clear','replay-log':'replay','stop-replay':'cancel','export-log':'export','reload-web':'reloadWeb','toggle-mode':'toggleMode','cancel-sequence':'cancel'};
  for(const [id,action] of Object.entries(actions))listen($(id),'click',()=>dispatch(action));
  listen($('dos-file'),'change',event=>{const file=event.target.files?.[0];if(file){$('dos-file-name').textContent=file.name;dispatch('file',file);}});
  listen($('import-log'),'change',event=>{const file=event.target.files?.[0];if(file)dispatch('import',file);});
  listen($('run-sequence'),'click',()=>{try{const value=JSON.parse($('sequence-input').value);if(!Array.isArray(value))throw new Error('시퀀스는 JSON 배열이어야 합니다.');dispatch('runSequence',value);}catch(error){showError(error);}});
  listen(win,'blur',()=>{for(const id of [...pointerKeys.keys()])releasePointer(id);});
  function drawConnections(){
    const area=$('input-workspace'),svg=$('connection-lines'),bridge=$('bridge-node'),keyNode=$('keyboard-node');if(!area||!svg||!bridge||!keyNode)return;
    const d3=win.d3;if(!d3?.select||!d3?.linkVertical)return;
    const bounds=area.getBoundingClientRect(),b=bridge.getBoundingClientRect(),k=keyNode.getBoundingClientRect();
    const point=(r,edge)=>({x:r.left+r.width/2-bounds.left,y:(edge==='bottom'?r.bottom:r.top)-bounds.top});
    const sources=[$('dos-shell'),$('web-shell')].filter(Boolean).map(el=>point(el.getBoundingClientRect(),'bottom'));
    const target=point(b,'top'),tail=point(b,'bottom'),keyboardPoint=point(k,'top');
    const links=[...sources.map((source,i)=>({id:'screen-'+i,source,target})),{id:'keyboard',source:tail,target:keyboardPoint}];
    const selection=d3.select(svg).attr('viewBox',`0 0 ${bounds.width} ${bounds.height}`);
    selection.selectAll('path.connection-path').data(links,d=>d.id).join('path').attr('class','connection-path').attr('d',d3.linkVertical().x(d=>d.x).y(d=>d.y));
    selection.selectAll('circle.connection-port').data([...sources,target,tail,keyboardPoint]).join('circle').attr('class','connection-port').attr('cx',d=>d.x).attr('cy',d=>d.y).attr('r',2.8);
  }
  function layout(){
    for(const [shellId,surfaceId] of [['dos-shell','dos-host'],['web-shell','web-frame']]){const shell=$(shellId),surface=$(surfaceId);if(shell&&surface){const scale=shell.clientWidth/640;surface.style.transform=`scale(${scale})`;}}
    drawConnections();
  }
  function requestLayout(){if(resizeFrame)return;resizeFrame=win.requestAnimationFrame(()=>{resizeFrame=0;layout();});}
  listen(win,'resize',requestLayout);listen(win,'load',requestLayout);
  const ro=win.ResizeObserver?new win.ResizeObserver(requestLayout):null;if($('qa-root'))ro?.observe($('qa-root'));cleanups.push(()=>ro?.disconnect());
  function update(state={}){
    snapshot={...snapshot,...state};const s=snapshot;
    const canRun=Boolean(s.ready&&s.enabled&&!s.replaying);for(const id of ['run-sequence','replay-log','toggle-mode'])if($(id))$(id).disabled=!canRun;
    if($('sequence-status'))$('sequence-status').textContent=s.replaying?'입력 시퀀스 실행 중입니다. 중지하면 모든 키를 해제합니다.':canRun?'양쪽 정상 입력 연결됨 · 시퀀스 실행 가능':'양쪽 준비 후 입력 연결을 켜세요.';
    $('input-workspace')?.classList.toggle('is-connected',Boolean(s.enabled));
    const toggle=$('bridge-toggle');if(toggle){toggle.disabled=!s.ready;toggle.textContent=s.enabled?'연결 해제':'입력 연결';toggle.setAttribute('aria-pressed',String(Boolean(s.enabled)));}
    if($('bridge-status'))$('bridge-status').textContent=s.enabled?'연결됨':s.ready?'연결 준비':'준비 대기';
    for(const prefix of ['dos','web']){const value=s[prefix+'State'];if(value===undefined)continue;const state=stateName(value),el=$(prefix+'-status');if(el){el.dataset.state=state;el.textContent=typeof value==='object'&&value.label?value.label:({ready:'준비됨',loading:'불러오는 중',error:'연결 오류',waiting:prefix==='dos'?'파일 대기':'대기 중',idle:'파일 대기'}[state]||state);}if(prefix==='dos'&&$('dos-empty'))$('dos-empty').hidden=state==='ready'||state==='loading';}
    const pressed=new Set(s.pressedCodes||s.held||[]);keyboard?.querySelectorAll('[data-code]').forEach(el=>{const active=pressed.has(el.dataset.code);el.classList.toggle('is-pressed',active);el.setAttribute('aria-pressed',String(active));});
    if(s.mode!==undefined&&$('mode-status'))$('mode-status').textContent=({ko:'한글',en:'영문',hangul:'한글',english:'영문'}[s.mode]||s.mode);
    if(s.text!==undefined&&$('input-monitor')){$('input-monitor').value=s.text;$('input-monitor').scrollLeft=$('input-monitor').scrollWidth;}
    if(s.warning!==undefined){const el=$('global-error');if(el){el.textContent=s.warning||'';el.hidden=!s.warning;}}
    if(s.point&&$('pointer-status'))$('pointer-status').textContent=`X ${Math.round(s.point.x)} · Y ${Math.round(s.point.y)}`;
    if(s.events!==undefined&&$('event-count'))$('event-count').textContent=String(s.events);
    if(s.replaying!==undefined){$('replay-log').hidden=Boolean(s.replaying);$('stop-replay').hidden=!s.replaying;}
    requestLayout();
  }
  function delivery(result){if(result===false)return ' · 전달 안 됨';if(result&&typeof result==='object')return ['web','dos'].filter(k=>k in result).map(k=>` · ${k.toUpperCase()} ${result[k]?'✓':'실패'}${result[k+'Error']?' ('+result[k+'Error']+')':''}`).join('');return '';}
  function event(entry){
    if(!entry)return;entries.push(entry);if(entries.length>80)entries.shift();
    if($('event-count'))$('event-count').textContent=String(entry.seq??entries.length);
    if($('last-input'))$('last-input').textContent=[entry.type,entry.code??'',entry.x!==undefined?`${Math.round(entry.x)}, ${Math.round(entry.y)}`:''].filter(Boolean).join(' · ');
    if($('event-log'))$('event-log').textContent=entries.map(e=>`${String(e.seq??'').padStart(4,'0')}  ${e.type}  ${e.code??(e.x!==undefined?`${Math.round(e.x)},${Math.round(e.y)}`:'')}${delivery(e.result)}`).join('\n');
    if(entry.type==='clear')entries=[];
    const area=$('input-workspace');area?.classList.add('is-pulsing');win.clearTimeout(pulseTimer);pulseTimer=win.setTimeout(()=>area?.classList.remove('is-pulsing'),95);
  }
  update(snapshot);requestLayout();
  return Object.freeze({update,event,layout,showError,clear(){entries=[];if($('event-log'))$('event-log').textContent='아직 기록된 입력이 없습니다.';if($('event-count'))$('event-count').textContent='0';},destroy(){for(const cleanup of cleanups)cleanup();win.clearTimeout(pulseTimer);if(resizeFrame)win.cancelAnimationFrame(resizeFrame);}});
}
