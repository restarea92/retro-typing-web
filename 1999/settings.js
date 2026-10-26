/** Original environment dialog reconstructed from settings-dialog.png.
 * Language/layout labels and numeric bounds come from the original executable.
 * Profile entry remains unverified and is deliberately omitted here.
 */
export const DEFAULT_SETTINGS = Object.freeze({language:'ko',layout:'2',sound:true,repeat:false,targetSpeed:150,targetAccuracy:90,layoutsByLanguage:Object.freeze({ko:'2',en:'us',ja:'hiragana'})});
export const LANGUAGES = Object.freeze([{value:'ko',label:'한글'},{value:'en',label:'영어'},{value:'ja',label:'일어'}]);
export const LAYOUTS = Object.freeze({ko:[{value:'2',label:'2 벌 식'},{value:'3',label:'3 벌 식'},{value:'3-no-shift',label:'3벌 NO SHIFT'}],en:[{value:'us',label:'영문 미국'},{value:'dvorak',label:'영문 드보락'}],ja:[{value:'hiragana',label:'히라가나'},{value:'katakana',label:'카타카나'}]});
export const OBSERVED_KOREAN_KEY_GROUPS = Object.freeze(['기본 자리','왼손 윗글쇠','검지 글쇠','오른손 윗글쇠','왼손 밑글쇠','오른손 밑글쇠','왼손 쌍자음','윗글쇠 나머지','숫자 글쇠','기호 글쇠']);
export const OBSERVED_KOREAN_WORD_GROUPS = Object.freeze(OBSERVED_KOREAN_KEY_GROUPS.slice(0,8));
export const SETTINGS_FIDELITY = Object.freeze({appearance:'observed',labels:'original',languageCycle:'Enter/Space cycle; mouse release selects another field or cycles the selected field, native observed 2026-10-26',saveOnClose:'Escape applies prior changes but cancels active numeric edit; close-X commits the active edit',numericBounds:'original load clamps: speed80..400, accuracy60..100; binary GAME-SPEC.md, routine19dc7'});
export function normalizeSettings(value={}) {
  const v={...DEFAULT_SETTINGS,...value};
  if(!LAYOUTS[v.language])v.language='ko';
  const remembered={...DEFAULT_SETTINGS.layoutsByLanguage,...(value.layoutsByLanguage||{})};
  for(const language of Object.keys(LAYOUTS))if(!LAYOUTS[language].some(x=>x.value===remembered[language]))remembered[language]=LAYOUTS[language][0].value;
  v.layout=LAYOUTS[v.language].some(x=>x.value===value.layout)?value.layout:remembered[v.language];
  remembered[v.language]=v.layout;v.layoutsByLanguage=remembered;
  v.sound=Boolean(v.sound);v.repeat=Boolean(v.repeat);
  v.targetSpeed=Math.min(400,Math.max(80,Math.trunc(Number(v.targetSpeed))||80));
  v.targetAccuracy=Math.min(100,Math.max(60,Math.trunc(Number(v.targetAccuracy))||60));
  return v;
}
export function settingsStatus(settings){const s=normalizeSettings(settings);return ({'2':'한글-2','3':'한글-3','3-no-shift':'한글-NS','us':'영문-미','dvorak':'영문-드','hiragana':'일어-히','katakana':'일어-카'})[s.layout];}
export function renderSettings(container, settings, onSave=()=>{}, onCancel=()=>{}, inputContext={}) {
  let draft=normalizeSettings(settings),closed=false,suppressNumericBlur=null;
  const status=document.querySelector('#status');
  const help={language:'사이띄개로 연습할 글자판을 선택하세요.',layout:'사이띄개로 글자판 종류를 선택하세요.',sound:'사이띄개로 소리발생 여부를 결정하세요.',repeat:'자리연습의 반복누름 여부를 결정하세요.',speed:'빠르기의 연습 목표값을 입력하세요.',accuracy:'정확도의 연습 목표값을 입력하세요.'};
  container.innerHTML=`<section class="original-settings" role="dialog" aria-modal="true" aria-labelledby="settings-title"><header><span id="settings-title">환경 설정</span><button type="button" class="settings-close" aria-label="환경 설정 저장하고 닫기">×</button></header><div class="settings-body"><div class="settings-row"><label for="setting-language">연습 글자판</label><button type="button" id="setting-language" data-help="language" class="settings-cycle"></button></div><div class="settings-row"><label for="setting-layout">글자판 종류</label><button type="button" id="setting-layout" data-help="layout" class="settings-cycle"></button></div><fieldset class="settings-switches"><label><input type="checkbox" id="setting-sound" data-help="sound"><span>소       리</span></label><label><input type="checkbox" id="setting-repeat" data-help="repeat"><span>반복 누르기</span></label></fieldset><fieldset class="settings-targets"><legend>연습 목표</legend><label for="setting-speed">빠르기 (타/분)</label><input id="setting-speed" data-help="speed" type="text" maxlength="3" data-numeric="speed" pattern="[0-9]*" min="80" max="400" inputmode="numeric" aria-label="목표 빠르기"><span class="settings-number-render" data-number-render="speed" aria-hidden="true"></span><label for="setting-accuracy">정확도 (%)</label><input id="setting-accuracy" data-help="accuracy" type="text" maxlength="3" data-numeric="accuracy" pattern="[0-9]*" min="60" max="100" inputmode="numeric" aria-label="목표 정확도"><span class="settings-number-render accuracy-number-render" data-number-render="accuracy" aria-hidden="true"></span></fieldset></div></section>`;
  const root=container.querySelector('.original-settings'),q=s=>root.querySelector(s);let selectedControl=null;
  const selected=()=>root.contains(document.activeElement)&&document.activeElement?.dataset.help?document.activeElement:selectedControl;
  function ownControl(control){if(!control?.dataset.help)return;if(selectedControl!==control){if(selectedControl?.dataset.numeric&&document.activeElement!==selectedControl){if(suppressNumericBlur===selectedControl)suppressNumericBlur=null;else validateNumeric(selectedControl,true);paintNumber(selectedControl,false);}selectedControl=control;if(control.dataset.numeric)control.select?.();}if(status)status.textContent=help[control.dataset.help];if(control.dataset.numeric)paintNumber(control,true);}
  function focusControl(control){ownControl(control);if(control.dataset.numeric&&inputContext.focusTypingInput)inputContext.focusTypingInput(control);else control.focus({preventScroll:true});}

  function paint(initial=false){const languageStatus=document.querySelector('#language');if(languageStatus)languageStatus.textContent=settingsStatus(draft);q('#setting-language').textContent=LANGUAGES.find(x=>x.value===draft.language).label;q('#setting-layout').textContent=LAYOUTS[draft.language].find(x=>x.value===draft.layout).label;q('#setting-sound').checked=draft.sound;q('#setting-repeat').checked=draft.repeat;if(initial){q('#setting-speed').value=draft.targetSpeed;q('#setting-accuracy').value=draft.targetAccuracy;}}
  function collect(){draft.sound=q('#setting-sound').checked;draft.repeat=q('#setting-repeat').checked;return normalizeSettings(draft)}
  function close(save){if(closed)return;closed=true;save?onSave(collect()):onCancel();}
  const cycleLanguage=()=>{draft=collect();let index=LANGUAGES.findIndex(x=>x.value===draft.language);draft.language=LANGUAGES[(index+1)%LANGUAGES.length].value;draft.layout=draft.layoutsByLanguage[draft.language];paint()};
  const cycleLayout=()=>{draft=collect();const options=LAYOUTS[draft.language],index=options.findIndex(x=>x.value===draft.layout);draft.layout=options[(index+1)%options.length].value;draft.layoutsByLanguage[draft.language]=draft.layout;paint()};
  // Native mouse input is consumed on release, not browser pointer-down focus.
  // A different cycle field is selected first; a selected field cycles.
  for(const [id,cycle]of [['#setting-language',cycleLanguage],['#setting-layout',cycleLayout]]){
    const control=q(id);
    control.addEventListener('pointerdown',e=>{if((e.button??0)===0)e.preventDefault();});
    const activate=(keyboard=false)=>{const wasSelected=selected()===control;focusControl(control);if(keyboard||wasSelected)cycle();};
    control.onclick=e=>activate(e.detail===0);
    const label=q(`label[for="${control.id}"]`);
    label.addEventListener('pointerdown',e=>{if((e.button??0)===0)e.preventDefault();});
    label.onclick=e=>{e.preventDefault();activate();};
  }
  const numericProperty=input=>input.id==='setting-speed'?'targetSpeed':'targetAccuracy';
  function paintNumber(input,focused=selected()===input){const view=q(`[data-number-render="${input.dataset.numeric}"]`);if(!view)return;view.replaceChildren();const glyphs=document.createElement('span');glyphs.className='settings-number-glyphs';glyphs.style.transform=`translateX(-${input.scrollLeft||0}px)`;const value=input.value||'',start=Number.isInteger(input.selectionStart)?input.selectionStart:value.length,end=Number.isInteger(input.selectionEnd)?input.selectionEnd:start;for(let i=0;i<value.length;i++){const digit=document.createElement('span');digit.textContent=value[i];if(focused&&i>=start&&i<end)digit.className='number-selected';glyphs.append(digit)}if(focused&&start===end){const caret=document.createElement('i');caret.className='practice-caret number-caret';caret.style.left=`${start*8}px`;caret.textContent=value[start]||' ';glyphs.append(caret)}view.append(glyphs);}
  for(const input of root.querySelectorAll('[data-numeric]'))for(const type of ['input','keyup','select','pointerup'])input.addEventListener(type,()=>paintNumber(input));
  function validateNumeric(input,commit){const property=numericProperty(input),value=normalizeSettings({...draft,[property]:parseInt(input.value,10)||0})[property];input.value=value;if(commit)draft[property]=value;paintNumber(input);}
  q('.settings-close').onclick=()=>{if(selected()?.dataset.numeric)validateNumeric(selected(),true);close(true)};
  root.addEventListener('focusout',e=>{const input=e.target;if(!input.dataset.numeric||closed)return;if(suppressNumericBlur===input)suppressNumericBlur=null;else validateNumeric(input,true);paintNumber(input,false)});
  root.addEventListener('focusin',e=>ownControl(e.target));
  if(inputContext.focusTypingInput)for(const input of root.querySelectorAll('[data-numeric]'))input.addEventListener('pointerdown',event=>{event.preventDefault();event.stopImmediatePropagation();focusControl(input);});
  root.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();e.stopPropagation();return}if((e.code==='Space'||e.key===' '||e.key==='Enter')&&e.target.classList.contains('settings-cycle')){e.preventDefault();e.stopPropagation();e.target.id==='setting-language'?cycleLanguage():cycleLayout();return}if(e.key==='ArrowDown'||e.key==='ArrowUp'||e.key==='Enter'){const controls=[...root.querySelectorAll('[data-help]')],i=controls.indexOf(e.target);if(i>=0){e.preventDefault();e.stopPropagation();if(e.target.dataset.numeric){validateNumeric(e.target,e.key==='Enter');suppressNumericBlur=e.target}focusControl(controls[(i+(e.key==='ArrowUp'?-1:1)+controls.length)%controls.length]);return}}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(e.target.dataset.numeric){e.target.value=draft[numericProperty(e.target)];suppressNumericBlur=e.target}close(true)}});
  paint(true);for(const input of root.querySelectorAll('[data-numeric]'))paintNumber(input);focusControl(q('#setting-language'));return {getSettings:collect,getInputOwner:()=>selected()||root,destroy(){closed=true;root.remove()}};
}
