import { bindKeyPracticeInput } from './key-practice-input.js';
import { createKeyboardInputBridge } from './keyboard-input-bridge.js';
import { createVirtualKeyboard } from './virtual-keyboard-view.js';
import { originalKeyGuide } from './original-key-guide.js';
import { createKeyPaintState, paintKeyGlyph, paintWarmupClockCue, initializeKeyPaint } from './original-key-paint.js';
import { createOriginalRandom, originalRandomIndex } from './original-random.js';
import { loadOriginalSpeedHistory, appendOriginalSpeedHistory } from './original-history-store.js';
import { localRecordDate, loadOriginalGameScores, loadOriginalExamRecords, saveOriginalExamRecord } from './original-record-store.js';
import { insertOriginalGameScore } from './original-records.js';
import { openOriginalKeyProfile, appendOriginalKeyProfile, closeOriginalKeyProfile } from './original-key-profile.js';
import { originalLineKeyStats } from './original-key-stats.js';
import { createOriginalIdle, touchOriginalIdle, originalIdleExpired } from './original-idle.js';
import { playOriginalSound } from './original-sound.js';
import { originalWordLine } from './original-word-stage-rules.js';
import { analyzePracticeInput, wrapOriginalLongText, createPracticeTiming, updatePracticeTiming, acceptPracticeInput } from './text-practice.js';
import { originalTextUnits, originalElapsedTicks, originalMetrics } from './original-metrics.js';
import { BIOS_TICK_MS, createRainSpawnMemory, createGameWordMemory, gameWordDisplay, createRainStage, tickRain, hitRain, applyRainEffect, createInvadersStage, tickInvaders, tickInvaderBonus, hitInvaders, applyInvadersEffect } from './game-engine.js';
import { createKeyDrill, requestedKey, remainingKeyRounds, pressKeyDrill } from './drill-rules.js';
import { ENERGY_CAPACITY, INITIAL_SCORE, acceptGameCommittedInput, textColumns, hitScore, stageBonus, energyAfter } from './game-rules.js';
import { ORIGINAL_KEY_STAGE_POOLS } from './original-key-stage-pools.js';
import { renderGameSelector } from './game-selector.js';
import { advancePractice, originalExamProgressionUnits } from './progression.js';
import { bindComposer, isCompositionCommit, renderMappedKey, physicalKey } from './input-composer.js';
import { ORIGINAL_HELP } from './help-pages.js';
import { makeSession, updateSession, finishSession, sessionScore, chars, parseImportedText, readProgress, saveProgress, keyUnits } from './engine.js';
import { ORIGINAL_PROGRESSION } from './original-progression.js';
import { ORIGINAL_KEYBOARD_MAPS } from './original-keyboard-maps.js';
import { PRACTICE_TEXTS } from './practice-texts.js';
import { pauseFor, formatOriginalElapsedClock } from './presentation.js';
import { normalizeSettings, settingsStatus } from './settings.js';
import { LONG_TEXTS, LONG_TEXT_INVENTORY } from './long-texts.js';
import { MODES, LESSONS, KEY_ROWS } from './data.js';
const $ = s => document.querySelector(s);
const workspace = $('#workspace');
workspace.tabIndex=-1;
let keyboardBridge=null,keyboardView=null,keyboardVisible=true,inputMethod='virtual',settingsController=null;
function focusTypingInput(element){if(!element)return;return keyboardBridge?keyboardBridge.focusTypingInput(element,{preventScroll:true}):element.focus({preventScroll:true});}
function dispatchNativeReturn(element){if(!element?.isConnected)return;for(const type of ['keydown','keyup']){const fields={key:'Enter',code:'Enter',bubbles:true,cancelable:true};let event;if(window.KeyboardEvent)event=new window.KeyboardEvent(type,fields);else{event=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{key:'Enter',code:'Enter'});}Object.defineProperty(event,'nativeTextControl',{value:true});element.dispatchEvent(event);}}
function outsideProgramEvent(event){return Boolean(event.target?.closest?.('.helpers,#external-controls,#virtual-keyboard-panel'));}
function currentInputOwner(){
 if(mode==='exited'||workspace.hasAttribute('aria-busy'))return null;
 const active=document.activeElement,focusedClose=active?.matches?.('.dialog-close')?active:null;
 const repeat=workspace.querySelector('.repeat-dialog');if(repeat)return focusedClose&&repeat.contains(focusedClose)?focusedClose:repeat.querySelector(`[data-choice="${repeat.dataset.selectedChoice||'0'}"]`)||repeat;
 const stage=workspace.querySelector('.stage-dialog');if(stage)return focusedClose&&stage.contains(focusedClose)?focusedClose:stage.querySelectorAll('.stage-answer')[Number(stage.dataset.selectedChoice)||0];
 if(openMenuId)return mode==='home'&&active===$('#close')?active:document.querySelector('.dropdown-menu');
 if(mode==='settings'&&settingsController)return settingsController.getInputOwner();
 const modal=workspace.querySelector('.extra-exam-result-modal,.extra-notepad-result');if(modal)return modal;
 const list=workspace.querySelector('[role=listbox]');if(list)return list;
 const input=workspace.querySelector('#key-input,#typing,#game-input,textarea:not([readonly])');if(input)return input;
 return workspace.contains(active)&&active!==workspace?active:workspace;
}
// A focused close control owns Enter/Space before a dialog's selected answer.
// Reuse its ordinary click path and consume the key once, so a later keyup
// cannot confirm the newly opened parent menu.
function activateFocusedDialogClose(event,dialog){
 const close=event.target?.closest?.('.dialog-close');
 if(!close||!dialog.contains(close)||!['Enter',' '].includes(event.key))return false;
 event.preventDefault();event.stopImmediatePropagation();close.click();return true;
}
function refreshKeyboardLabels(){keyboardView?.setLayout(ensureComposerMode().latinMode?ensureComposerMode().latinLayout:ensureComposerMode().layout);}
function reflectKeyboardVisibility(visible){keyboardVisible=Boolean(visible);$('#focus-input').setAttribute('aria-expanded',String(keyboardVisible));$('#focus-input').textContent=keyboardVisible?'가상 키보드 숨기기':'가상 키보드 보이기';}
function setKeyboardVisible(visible){reflectKeyboardVisibility(visible);keyboardView?.setVisible(keyboardVisible);if(!keyboardVisible)keyboardBridge?.releaseAll();}
function setInputMethod(next){if(!['virtual','native','hardware'].includes(next))return;inputMethod=next;releaseProgramKeys();keyboardBridge?.resetInputOwnership();$('#keyboard-input-mode').value=next;const owner=currentInputOwner();if(owner?.matches?.('input:not([type=checkbox]),textarea'))focusTypingInput(owner);else owner?.focus?.({preventScroll:true});}

let extraCleanup=null, navigationVersion=0,composerBaseLayout=null,composerMode=null,lastEnglishLayout='us';
const profileSessionId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
const coreComposers=new Set();
const originalRandom=createOriginalRandom(1);
let coreIdle=null;
function armCoreIdle(onTimeout,started=true){coreIdle={...createOriginalIdle({started}),onTimeout};}
function touchCoreIdle(){if(coreIdle)touchOriginalIdle(coreIdle);}
function checkCoreIdle(){if(!coreIdle||!originalIdleExpired(coreIdle))return;const timeout=coreIdle.onTimeout;coreIdle=null;timeout();}
document.addEventListener('keydown',event=>{if(!['Shift','Control','Alt','Meta','CapsLock','NumLock','ScrollLock'].includes(event.key))touchCoreIdle();},true);
function ensureComposerMode(){
 const englishLayout=['us','dvorak'].includes(appSettings.layout)?appSettings.layout:(appSettings.layoutsByLanguage?.en||lastEnglishLayout),base=appSettings.layout+'|'+englishLayout;
 if(composerBaseLayout!==base){composerBaseLayout=base;lastEnglishLayout=englishLayout;composerMode={layout:appSettings.layout,latinMode:false,latinLayout:englishLayout};}
 return composerMode;
}
function updateComposerMode(next){composerMode={...next};refreshKeyboardLabels();const layout=next.latinMode?next.latinLayout:next.layout;$('#language').textContent=({'2':'한글-2',korean2:'한글-2','3':'한글-3',korean3:'한글-3','3-no-shift':'한글-NS',korean3NoShift:'한글-NS',us:'영문-미',dvorak:'영문-드',hiragana:'일어-히',katakana:'일어-카'})[layout]||settingsStatus(appSettings);}
function resetNativeComposerMode(){composerBaseLayout=null;updateComposerMode(ensureComposerMode());}
function attachComposer(element,options={}){const userInput=options.onInput||(()=>{}),controller=bindComposer(element,{commitOnBlur:false,nativePreview:true,hybridInput:true,onNativeReturn:()=>dispatchNativeReturn(element),...options,...ensureComposerMode(),onInput:result=>{touchCoreIdle();if(result.modeChanged)updateComposerMode(result.mode);userInput(result);}});coreComposers.add(controller);return controller;}
function sound(type){return playOriginalSound(type,appSettings.sound);}
function storePracticeRecord(entry,glyphRecords=null){entry={...entry,date:localRecordDate()};if(['words','sentences','long','exam'].includes(entry.mode))appendOriginalSpeedHistory(originalSpeedHistory,{weight:entry.correct,speed:entry.cpm,accuracy:entry.accuracy,seconds:(entry.elapsedMs||0)/1000,date:entry.date},storage);if(entry.mode==='exam')examRecords=saveOriginalExamRecord(examRecords,entry,storage);if(entry.originalKeyStats)appendOriginalKeyProfile(originalKeyProfile,entry.originalKeyStats,storage,glyphRecords);progress=saveProgress(storage,progress,{profileSessionId,...entry});}

function clearCoreComposers(){for(const composer of coreComposers)composer.destroy();coreComposers.clear();gameComposer=null;}
function clearExtra(){if(extraCleanup){extraCleanup();extraCleanup=null;}}
function releaseProgramKeys(){keyboardBridge?.releaseAll();keyboardView?.releaseAll();}
function stopCurrentActivity(){releaseProgramKeys();coreIdle=null;if(settingsController){settingsController.destroy();settingsController=null;}if(mode==='long'&&workspace.querySelector('.long-dialog'))saveLongProgress();clearExtra();clearCoreComposers();clearInterval(gameTimer);gameTimer=null;gameActive=false;composing=false;}

const appClockStart=performance.now();
const names = Object.fromEntries(MODES.map(m=>[m.id,m.title]));
let storage; try { storage = window.localStorage; } catch { storage = { getItem: () => null, setItem: () => {} }; }
const originalKeyProfile=openOriginalKeyProfile(storage,profileSessionId);
const originalSpeedHistory=loadOriginalSpeedHistory(storage);
let currentLanguage='ko',selectedLongId='kor01',selectedStage=0,appSettings={language:'ko',layout:'2',sound:true,repeat:false,targetSpeed:150,targetAccuracy:90};
let mode = 'home', lesson = 0, session = null, composing = false, finished = false, imported = '', progress = readProgress(storage);
let examRecords=loadOriginalExamRecords(storage,progress);
const esc = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const menuItems = [['home','한컴타자'],['keys','자리연습'],['words','낱말연습'],['textmenu','글연습'],['play','놀이'],['stats','통계'],['help','도움말']];
$('#menu').innerHTML=menuItems.map(([id,label])=>`<button data-mode="${id}">${label}</button>`).join('');
$('#menu').addEventListener('click',e=>{const id=e.target.dataset.mode;if(mode==='home'&&openMenuId&&id){if(openMenuId!==id)openMenu(id);else document.querySelector('.dropdown-menu')?.focus({preventScroll:true});}});
function navigate(next){navigationVersion++;stopCurrentActivity();closeMenu();workspace.removeAttribute('aria-busy');$('#status').style.color='';$('.classic').classList.remove('game-mode');$('#menu').style.display='flex';$('.titlebar>span').textContent='한컴타자연습';mode=next;composing=false;finished=false;session=null;$('#status').textContent='메뉴를 선택하세요';$('#menu').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
if(mode==='home')home();else if(mode==='keys'||mode==='words')startKeys();else if(mode==='long'){selectedLongId=LONG_TEXTS.find(text=>text.language===currentLanguage)?.id||selectedLongId;showLongSelect();}else if(names[mode])startLesson();else if(mode==='textmenu'||mode==='stats'){const id=mode;mode='home';home();openMenu(id);}else if(mode==='play')workspace.innerHTML='';else if(mode==='about')showWelcome();else help();}
function home(){workspace.innerHTML='';$('#status').textContent='좌우 화살표로 항목을 선택한 후 Enter를 누르세요.';$('#menu').querySelectorAll('button').forEach(b=>b.classList.remove('active'));openMenu(mainMenuId,mainMenuIndex);}
function showWelcome(){workspace.innerHTML='<img class="welcome-original" src="welcome-card.png" width="480" height="326" alt="원본 한컴타자연습 시작 안내: 컴퓨터와 타자기 그림, 단계별 연습 안내">';$('#status').textContent='아무 글쇠나 누르세요';$('#menu').querySelectorAll('button').forEach(b=>b.classList.remove('active'));}

function startLesson(){if(mode==='long')startLong();else if(mode==='sentences')startSentence();}
function paint(){if(session&&(mode==='sentences'||(mode==='words'&&wordPhase==='study')))paintSentence();}
let helpPage=0;
function help(){helpPage=0;renderHelp();}
function renderHelp(){const page=ORIGINAL_HELP.pages[helpPage];workspace.innerHTML=`<section class="original-help"><h1>${ORIGINAL_HELP.title}<button class="dialog-close" data-go="home">×</button></h1>${page.keyboard?'<div class="help-keyboard full-keyboard">'+keyboardRows().map((row,r)=>`<div class="keyboard-row row-${r}">`+row.map((k,column)=>`<span data-key="${esc(k)}" data-physical="${esc(physicalKeyboardRows()[r][column])}" data-key-row="${r}" data-key-column="${column}" class="physical-key ${k.length>1?'wide':''} ${k===' '?'space':''}">${k===' '?'':esc(k)}</span>`).join('')+'</div>').join('')+'</div>':''}<div class="help-copy" style="left:${page.text.x-16}px;top:${page.text.y-91}px;line-height:${page.text.lineHeight}px">${page.lineOffsets?page.lines.map((line,i)=>`<span style="position:absolute;left:0;top:${page.lineOffsets[i]}px;white-space:nowrap">${esc(line)}</span>`).join(''):page.lines.map(esc).join('<br>')}</div>${page.contact?`<div class="help-copy" style="left:${page.contact.x-16}px;top:${page.contact.y-91}px;line-height:${page.contact.lineHeight}px">${page.contact.lines.map(esc).join('<br>')}</div>`:''}${page.next?`<span class="help-next" style="left:${page.next.x-16}px;top:${page.next.y-91}px">${esc(page.next.text)}</span>`:''}</section>`;$('#status').textContent=ORIGINAL_HELP.status;}

// Native choice dialogs own mouse input: clicks on the inactive parent must
// neither synthesize Escape nor steal the selected answer's keyboard focus.
function guardRepeatDialogClick(event){
 const dialog=workspace.querySelector('.repeat-dialog');
 if(!dialog||dialog.contains(event.target)||!$('.classic').contains(event.target))return false;
 event.preventDefault();event.stopImmediatePropagation();
 dialog.querySelector(`[data-choice="${dialog.dataset.selectedChoice||'0'}"]`)?.focus({preventScroll:true});return true;
}
workspace.addEventListener('click',e=>{if(guardRepeatDialogClick(e))return;if(e.target.classList.contains('dialog-close')&&e.target.dataset.go==='home'){dispatchExternalKey('Escape');return;}if(e.target.dataset.go)navigate(e.target.dataset.go)});
document.addEventListener('keydown',e=>{if(outsideProgramEvent(e)||mode==='exited')return;if(e.defaultPrevented||e.isComposing||composing||e.keyCode===229)return;if(extraCleanup||mode==='settings')return;if(mode==='home'&&openMenuId&&e.target===$('#close')&&['Enter',' '].includes(e.key))return;if(mode==='home'&&workspace.querySelector('.welcome-original')&&!['Shift','Control','Alt','Meta','CapsLock','NumLock','ScrollLock'].includes(e.key)){e.preventDefault();showStageDialog();return;}if((openMenuId||mode==='home')&&e.altKey&&['KeyH','KeyX'].includes(e.code)){e.preventDefault();endApplication();return;}if(mode==='about'){if(!['Shift','Control','Alt','Meta','CapsLock','NumLock','ScrollLock'].includes(e.key)){e.preventDefault();navigate('home');openMenu('help',1)}return;}if(e.key==='F1'){e.preventDefault();if(openMenuId||mode==='home')navigate('help');return}if(mode==='help'&&e.code==='Space'){e.preventDefault();helpPage++;if(helpPage>=ORIGINAL_HELP.pages.length)navigate('home');else renderHelp();return}if(mode==='long'&&!finished&&workspace.querySelector('.long-dialog')&&(e.key==='PageDown'||e.key==='PageUp')){e.preventDefault();changeLongPage(e.key==='PageDown'?1:-1);return}if(e.key==='Escape'){e.preventDefault();if(mode==='play'&&gamePhase!=='select'){if(gamePhase==='ended')dismissGameOver();else selectGame(gameKind);}else if(mode==='keys'&&!finished)leaveKeyPractice();else if(mode==='words'&&!finished){if(wordPhase==='warmup')startWordStudy();else leaveTextPractice();}else if(mode==='long'&&!finished){if($('.long-select')){navigate('home');openMenu('textmenu',1);}else {saveLongProgress();showLongSelect()}}else if(mode==='sentences'&&!finished)leaveTextPractice();else if(mode==='help'){navigate('home');openMenu('help',0);}else navigate('home')}else if(mode==='home'&&['ArrowLeft','ArrowRight','Enter'].includes(e.key)){e.preventDefault();openMenu('home')}});
document.addEventListener('click',event=>{if(guardRepeatDialogClick(event))return;if(!$('.classic').contains(event.target)||event.target.closest?.('.dropdown-menu'))return;if(mode==='about'){event.preventDefault();navigate('home');openMenu('help',1);}else if(mode==='home'&&workspace.querySelector('.welcome-original')){event.preventDefault();showStageDialog();}},true);
$('#close').onclick=()=>{if(mode==='home'&&openMenuId)endApplication();};$('#focus-input').onclick=()=>{if(mode==='exited'){window.location.reload();return;}setKeyboardVisible(!keyboardVisible);};$('#keyboard-input-mode').onchange=event=>setInputMethod(event.target.value);$('#native-keyboard-focus').onclick=()=>setInputMethod('native');$('#help-toggle').onclick=()=>$('#outside-help').hidden=!$('#outside-help').hidden;$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('.classic').requestFullscreen()}catch{$('#outside-help').hidden=false;$('#outside-help').textContent='이 브라우저에서는 전체 화면을 지원하지 않습니다. 가로 화면으로 돌리면 더 크게 볼 수 있어요.'}};
let lastScreenFocus=null;
document.addEventListener('focusin',event=>{if($('.classic').contains(event.target))lastScreenFocus=event.target;});
$('#control-toggle').addEventListener('pointerdown',event=>event.preventDefault());
$('#control-toggle').onclick=()=>{const controls=$('#external-controls');controls.hidden=!controls.hidden;$('#control-toggle').setAttribute('aria-expanded',String(!controls.hidden));};
$('#external-controls').addEventListener('pointerdown',event=>event.preventDefault());
$('#external-controls').addEventListener('click',event=>{const key=event.target.dataset.controlKey;if(key!==undefined)dispatchExternalKey(key);});
function dispatchExternalKey(key){const code=key===' '?'Space':key;keyboardBridge?.keyDown({code,key});keyboardBridge?.keyUp({code});}

function resize(){const w=$('.app-wrap').clientWidth;const scale=Math.min(1,w/640);$('#frame-box').style.transform=`scale(${scale})`;$('#frame-box').style.marginBottom=`${480*scale-480}px`;}
window.addEventListener('resize',resize);setInterval(()=>{$('#clock').textContent=formatOriginalElapsedClock(performance.now()-appClockStart);if(session&&!finished&&session.startedAt!==null)paint();checkCoreIdle()},1000);


const KEYBOARD=[['`','1','2','3','4','5','6','7','8','9','0','-','=','\\','BS'],['Tab','ㅂ','ㅈ','ㄷ','ㄱ','ㅅ','ㅛ','ㅕ','ㅑ','ㅐ','ㅔ','[',']'],['Caps','ㅁ','ㄴ','ㅇ','ㄹ','ㅎ','ㅗ','ㅓ','ㅏ','ㅣ',"'",'Enter'],['Shift','ㅋ','ㅌ','ㅊ','ㅍ','ㅠ','ㅜ','ㅡ',',','.','/','Shift'],['Ctrl','Alt',' ','Alt','Ctrl']];
const KEYMAP={q:'ㅂ',w:'ㅈ',e:'ㄷ',r:'ㄱ',t:'ㅅ',y:'ㅛ',u:'ㅕ',i:'ㅑ',o:'ㅐ',p:'ㅔ',a:'ㅁ',s:'ㄴ',d:'ㅇ',f:'ㄹ',g:'ㅎ',h:'ㅗ',j:'ㅓ',k:'ㅏ',l:'ㅣ',z:'ㅋ',x:'ㅌ',c:'ㅊ',v:'ㅍ',b:'ㅠ',n:'ㅜ',m:'ㅡ'};
let wordPhase='warmup',wordCompleted=0,wordRepeatCount=0;
let keyCount=0,keyCorrect=0,keyTarget='ㅁ',keyStarted=0,keyUsesPhysical=false,keySequence=[],keyDrill=null,keyRecorded=false,keyPaint=null;
let sessionKeyStats={},sessionPhysicalKeyStats={},lastKeyTime=0;
function startKeys(initialPoolPosition=0){resetNativeComposerMode();armCoreIdle(()=>{if(mode==='keys')leaveKeyPractice();else leaveTextPractice();});wordPhase='warmup';wordCompleted=0;wordRepeatCount=0;clearCoreComposers();sessionKeyStats={};sessionPhysicalKeyStats={};lastKeyTime=performance.now();keyUsesPhysical=false;keyCount=0;keyCorrect=0;keyRecorded=false;keyDrill=mode==='keys'?createKeyDrill(stageDefinition(),{stage:selectedStage,repeat:appSettings.repeat,position:initialPoolPosition}):null;keyTarget=keyDrill?mapCharacter(requestedKey(keyDrill)):stagePool()[0];keyStarted=performance.now();session=null;finished=false;keySequence=mode==='words'?Array.from({length:10},()=>stagePool()[originalRandomIndex(stagePool().length,originalRandom)]):[];if(mode==='words')keyTarget=keySequence[0];
workspace.innerHTML=`<section class="key-dialog ${mode==='words'?'word-dialog':''}"><h1>${mode==='words'?'낱말연습':'자리연습'} <span id="key-score"><span class="key-accuracy">[정확도:  0%]</span> <span class="key-count">[횟수:100]</span></span><button class="dialog-close" data-go="home">×</button></h1><div class="key-target" id="key-target">${esc(keyTarget)}</div><div class="full-keyboard">${keyboardRows().map((row,r)=>`<div class="keyboard-row row-${r}">${row.map((k,column)=>`<span data-key="${esc(k)}" data-physical="${esc(physicalKeyboardRows()[r][column])}" data-key-row="${r}" data-key-column="${column}" class="physical-key ${k.length>1?'wide':''} ${k===' '?'space':''}">${k===' '?'':esc(k)}</span>`).join('')}</div>`).join('')}</div><div class="fingers">${Array.from({length:8},(_,i)=>`<i data-finger="${i}" class="${i===0?'lit':''}"></i>`).join('')}</div><input id="key-input" class="key-input" aria-label="표적 글쇠를 입력하세요" autocomplete="off" autocapitalize="off"></section>`;
keyPaint=initializeKeyPaint(createKeyPaintState(appSettings.layout,physicalKeyboardRows()),stageDefinition(),selectedStage,mode==='words',keyTarget);
$('#status').textContent='네모 속에 들어있는 글쇠를 누르세요';highlightKeys();if(mode==='words')$('#key-score').textContent='[횟수:  5]';const input=$('#key-input');focusTypingInput(input);preventBulkInput(input);const keyInputController=bindKeyPracticeInput(input,{hybridInput:true,physicalCharacter,physicalAscii,onAttempt:keyPress,onComposition:value=>{composing=value;}});coreComposers.add(keyInputController);
}
// Render the original ordered cap paints, including retained labels and home rings.
function highlightKeys(){const guide=originalKeyGuide(appSettings.layout,keyTarget);document.querySelectorAll('.key-dialog .physical-key').forEach(key=>{const paint=keyPaint.cells.get(`${key.dataset.keyRow}:${key.dataset.keyColumn}`);key.dataset.nativePaint=paint.paint;key.classList.toggle('wide',paint.physical.length>1);key.classList.toggle('native-ordinary-key',paint.ordinary);key.classList.toggle('active-key',paint.paint==='active');key.classList.toggle('native-stippled-key',paint.paint==='stipple');key.classList.toggle('native-gray-corner',paint.paint==='stipple'&&paint.cornerGray);key.classList.toggle('native-home-ring',paint.homeRing);key.textContent=paint.physical===' '?'':paint.label;});if(mode==='words')$('#key-target').innerHTML=keySequence.map((c,i)=>`<span class="${i<wordCompleted%10?'warmup-consumed':''}" style="color:${i===wordCompleted%10?'#55ffff':'#000'}">${esc(c)}</span>`).join(' ');document.querySelectorAll('.fingers:not(.clock-ghost-fingers) i').forEach((finger,index)=>finger.classList.toggle('lit',keyPaint.fingers.has(index)));if(keyPaint.fingers.has(-1)&&!workspace.querySelector('.clock-ghost-fingers')){const ghost=document.createElement('div');ghost.className='fingers clock-ghost-fingers';ghost.setAttribute('aria-hidden','true');ghost.innerHTML='<i class="lit"></i>';workspace.querySelector('.key-dialog').append(ghost);}}
function keyPress(value,ascii=null){
 if(finished)return;touchCoreIdle();
 const now=performance.now();
 const correct=mode==='keys'?(ascii===null?value===keyTarget:ascii===requestedKey(keyDrill)):value===keyTarget;
 if(!correct)sound(0);else if(appSettings.repeat)sound(1);else sound(2);
 const record=sessionKeyStats[value]||(sessionKeyStats[value]={correct:0,errors:0,milliseconds:0});
 record[correct?'correct':'errors']++;const interval=Math.max(0,now-lastKeyTime);record.milliseconds+=interval;if(ascii!==null){const entry=sessionPhysicalKeyStats[ascii]||(sessionPhysicalKeyStats[ascii]={correct:0,errors:0,milliseconds:0,display:value,role:mappedKeyEntry(ascii).role||'literal'});entry[correct?'correct':'errors']++;entry.milliseconds+=interval;}lastKeyTime=now;
 const previousTarget=keyTarget;
 if(mode==='keys'){
  const previousDrill=keyDrill;
  keyDrill=pressKeyDrill(keyDrill,correct?requestedKey(keyDrill):(ascii||'\0'),originalRandom);if(correct&&appSettings.repeat&&keyDrill.phaseCorrect===0)sound(2);
  keyCorrect=keyDrill.correct;keyCount=keyDrill.correct+keyDrill.incorrect;
  $('#key-score').innerHTML=`<span class="key-accuracy">[정확도:${String(keyCount?Math.floor(keyCorrect/keyCount*100):0).padStart(3,' ')}%]</span> <span class="key-count">[횟수:${String(remainingKeyRounds(keyDrill)).padStart(3,' ')}]</span>`;
  // Native cap/finger cleanup precedes the completion branch (f8e8..f9b4).
  if(correct&&keyDrill.phaseCorrect===0){
   if(previousDrill.phase==='home'){
    paintKeyGlyph(keyPaint,previousTarget,4);
    const homeIndex=26+'asdfghjkl;'.indexOf(requestedKey(previousDrill));
    if(previousDrill.pool.keyIndices.includes(homeIndex))paintKeyGlyph(keyPaint,previousTarget,0x26);
   }else paintKeyGlyph(keyPaint,previousTarget,selectedStage>0?0x26:6);
  }
  if(keyDrill.finished){highlightKeys();finishKeyDrill();return;}
  keyTarget=mapCharacter(requestedKey(keyDrill));
  if(correct&&keyDrill.phaseCorrect===0)paintKeyGlyph(keyPaint,keyTarget,keyDrill.phase==='target'&&selectedStage>0?0x25:5);
 }else{
  keyCount++;if(correct){keyCorrect++;wordRepeatCount++;if(wordRepeatCount>=(appSettings.repeat?4:1)){wordRepeatCount=0;wordCompleted++;if(appSettings.repeat)sound(2);}}
  $('#key-score').textContent=`[횟수:${String(Math.max(0,5-Math.floor(wordCompleted/10))).padStart(3,' ')}]`;
  const completedTarget=correct&&wordRepeatCount===0,rowEnd=completedTarget&&wordCompleted%10===0;
  if(completedTarget){
   paintKeyGlyph(keyPaint,previousTarget,selectedStage>0?0x26:6);
   // f317 paints the adjacent sampled clock word before checking row/quota.
   // Use the same input-time sample as native idle handling, not a later clock.
   if(rowEnd)paintWarmupClockCue(keyPaint,coreIdle.last);
   else paintKeyGlyph(keyPaint,keySequence[wordCompleted%10],5);
  }
  if(wordCompleted>=50){startWordStudy();return;}
  if(rowEnd){const base=stagePool();keySequence=Array.from({length:10},()=>base[originalRandomIndex(base.length,originalRandom)]);paintKeyGlyph(keyPaint,keySequence[0],5);}
  keyTarget=keySequence[wordCompleted%10];
 }
 $('#key-target').textContent=keyTarget;highlightKeys();
}
function keyResultEntry(){const elapsedMs=Math.max(0,performance.now()-keyStarted);return {mode,layout:appSettings.layout,language:currentLanguage,keyStats:sessionKeyStats,physicalKeyStats:sessionPhysicalKeyStats,correct:keyCorrect,entered:keyCount,errors:keyCount-keyCorrect,elapsedMs,accuracy:keyCount?Math.floor(keyCorrect/keyCount*100):0,cpm:Math.round(keyCorrect*60000/Math.max(1000,elapsedMs)),date:new Date().toISOString()};}
function saveKeyResult(advanceStage=false){const entry=keyResultEntry();if(!keyRecorded&&keyCount){keyRecorded=true;storePracticeRecord(entry);if(advanceStage)recordAdvancement(entry,entry.elapsedMs);}return entry;}
function leaveKeyPractice(){const previous=mode;saveKeyResult(false);navigate('home');openMenu(previous);}
function finishKeyDrill(){coreIdle=null;finished=true;const entry=saveKeyResult(false);const passed=entry.accuracy>=appSettings.targetAccuracy&&(mode==='keys'||entry.cpm>=appSettings.targetSpeed);showRepeatDialog(passed,entry);}
// The native inactive-title redraw writes only the title, not its counters.
function deactivatePracticeHeader(){workspace.querySelectorAll('.key-dialog h1>span,.sentence-dialog h1>span').forEach(counter=>{counter.hidden=true;});}
function showRepeatDialog(canAdvance,entry){releaseProgramKeys();
 deactivatePracticeHeader();
 const currentMode=mode,choices=canAdvance?['계속','다음','그만']:['계속','그만'];let index=0;
 const dialog=document.createElement('section');dialog.className='repeat-dialog stage-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
 dialog.innerHTML=`<h1>연습할 내용 선택<button class="dialog-close" data-repeat-stop="true" aria-label="그만">×</button></h1><div class="stage-copy">계속 같은 내용을 연습할까요?</div><div class="repeat-answers">${choices.map((label,i)=>`<button class="bevel" data-choice="${i}">${label}</button>`).join('')}</div>`;workspace.append(dialog);
 const buttons=Array.from(dialog.querySelectorAll('[data-choice]'));
 const focusChoice=()=>{dialog.dataset.selectedChoice=String(index);buttons[index].focus({preventScroll:true});};
 const choose=()=>{const choice=choices[index],nextPoolPosition=(keyDrill?.position??-1)+1;recordAdvancement(entry,entry.elapsedMs);dialog.remove();if(choice==='그만'){navigate('home');openMenu(currentMode);}else{if(choice==='다음')selectedStage=(selectedStage+1)%progressionInfo().stages.filter(s=>s.mode===currentMode).length;startKeys(nextPoolPosition<stageDefinition().physicalKeys.length?nextPoolPosition:0);}};
 dialog.onclick=e=>{if(e.target.dataset.repeatStop){index=choices.length-1;choose();}else if(e.target.dataset.choice!==undefined){const next=Number(e.target.dataset.choice);if(next===index)choose();else{index=next;focusChoice();}}};
 dialog.onkeydown=e=>{if(activateFocusedDialogClose(e,dialog))return;if(['Escape','Enter',' ','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key)){e.preventDefault();e.stopPropagation();}if(e.key==='Escape'){index=choices.length-1;choose();}else if(e.key==='Enter'||e.key===' '){choose();}else if(e.key==='ArrowLeft'||['ArrowRight','Home','End','PageUp','PageDown'].includes(e.key)){index=(index+(e.key==='ArrowLeft'?-1:1)+choices.length)%choices.length;focusChoice();}};
 focusChoice();$('#status').textContent='좌우 화살표로 항목을 선택한 후 Enter를 누르세요.';
}



function preventBulkInput(input){for(const type of ['paste','drop'])input.addEventListener(type,e=>{e.preventDefault();$('#status').textContent='연습할 글은 한 글자씩 직접 입력하세요'});input.addEventListener('beforeinput',e=>{if(e.inputType==='insertFromPaste'||e.inputType==='insertFromDrop')e.preventDefault()});}

// Native DS:6700/6b1a maxima survive rounds and navigation, not app reload.
const textPracticeBest={words:0,sentences:0};
let textPractice=null,sentenceComposer=null,textTiming=null;
function newTextPractice(kind){return {kind,quota:kind==='words'?40:35,completed:0,correct:0,target:0,ticks:0,best:textPracticeBest[kind],last:null,keyRecords:[]};}
function startSentence(reset=true,reseed=true){if(reseed){originalRandom.reseedFromTime();resetNativeComposerMode();}if(reset||!textPractice||textPractice.kind!=='sentences')textPractice=newTextPractice('sentences');renderTextPracticeLine();}
function startWordStudy(reset=true,reseed=true){if(reseed){originalRandom.reseedFromTime();resetNativeComposerMode();}wordPhase='study';if(reset||!textPractice||textPractice.kind!=='words')textPractice=newTextPractice('words');renderTextPracticeLine();}
function renderTextPracticeLine(){
 clearCoreComposers();finished=false;armCoreIdle(leaveTextPractice,false);
 const pool=sentenceTexts(),target=mode==='words'?makeStudyWords():pool[originalRandomIndex(pool.length,originalRandom)];
 session=makeSession(target);textTiming=createPracticeTiming();
workspace.innerHTML=`<section class="sentence-dialog ${mode==='words'?'word-study':''}"><h1>${mode==='words'?'낱말연습':'짧은글 연습'} <span>[횟수:${String(textPractice.quota-textPractice.completed).padStart(3,' ')}]</span><button class="dialog-close" data-go="home">×</button></h1><div class="sentence-paper"><div id="target"></div><div class="practice-input-wrap"><div id="practice-typed-render" aria-hidden="true"></div><textarea id="typing" aria-label="문장을 따라 입력하세요" autocomplete="off" autocorrect="off" spellcheck="false"></textarea></div></div><fieldset class="speed-panel"><legend>빠르기.정확도</legend><div>제일빠른: <span class="bar-track"><b id="best-bar" class="red">0</b></span></div><div>지금빠른: <span class="bar-track"><b id="now-bar" class="blue">0</b></span></div><div>정 확 도: <span class="bar-track"><b id="acc-bar" class="teal">0</b></span></div></fieldset><fieldset class="result-panel"><legend>결  과</legend><div>쓰인글수: <b id="used-keys">0타</b></div><div>정 타 수: <b id="correct-keys">0타</b></div><div>연습시간: <b id="practice-time">0.0초</b></div><div>빠 르 기: <b id="speed">0타/분</b></div><div>정 확 도: <b id="accuracy">0%</b></div></fieldset></section>`;
 const input=$('#typing');preventBulkInput(input);
 input.onkeydown=e=>{
  if(isCompositionCommit(e))return;input.setSelectionRange(input.value.length,input.value.length);
  if(!e.ctrlKey&&!e.altKey&&!e.metaKey&&!['Shift','Control','Alt','Meta'].includes(e.key)&&session.startedAt===null)session.startedAt=performance.now();
  const state=analyzePracticeInput(session.target,input.value,appSettings.layout);
  if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();const controller=sentenceComposer;controller.commit({notify:true,event:e});if(sentenceComposer===controller&&analyzePracticeInput(session.target,controller.state.committed,appSettings.layout).complete)finishTextPracticeLine();return;}
  if(state.complete&&!sentenceComposer?.state.pending&&!sentenceComposer?.state.kanaPrefix&&!['Backspace','Shift','Control','Alt','Meta','Escape'].includes(e.key)&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();e.stopImmediatePropagation();finishTextPracticeLine();return;}
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Delete','Tab'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();}
 };
 sentenceComposer=attachComposer(input,{layout:appSettings.layout,onInput:result=>{
  if(!session||finished)return;
  const now=performance.now(),analysis=analyzePracticeInput(session.target,input.value,appSettings.layout);
  session=updateSession(session,analysis.acceptedText,now);
  if(result.nativeComposing){paintSentence();return;}
  trackPracticeAcceptance(result,analysis,sentenceComposer,textTiming,session.startedAt,now);
  const accepted=analyzePracticeInput(session.target,sentenceComposer.state.committed,appSettings.layout).complete;
  if(accepted)coreIdle=null;else if(!coreIdle)armCoreIdle(leaveTextPractice);
  if(analysis.overflow){input.value=analysis.acceptedText;finishTextPracticeLine();return;}
  paintSentence();
 }});
 paintSentence();focusTypingInput(input);$('#status').textContent='글을 따라 입력하세요.';
}
function trackPracticeAcceptance(result,analysis,controller,timing,startedAt,now=performance.now()){
 const outcome=acceptPracticeInput({result,analysis,controller,timing,startedAt,now});
 if(outcome.newlyAccepted.some(record=>!record.correct))sound(0);return outcome;
}
function finalizePracticeTiming(controller,timing,analysis,startedAt,now){
 controller?.commit();
 return trackPracticeAcceptance({committed:controller.state.committed},analysis,controller,timing,startedAt,now).records;
}
function paintSentence(){
 if(!session||!$('#target'))return;$('#target').textContent=session.target;
 const analysis=analyzePracticeInput(session.target,session.typed,appSettings.layout);
 const render=$('#practice-typed-render');if(render)render.innerHTML=analysis.entries.map((e,i)=>`<span class="${!e.correct&&i<(textTiming?.records.length||0)?'practice-error':''}" style="display:inline-block;width:${e.columns*8}px">${esc(e.character)}</span>`).join('')+(finished?'':'<i class="practice-caret"></i>');
 const last=textPractice?.last||{speed:0,accuracy:0};const total=textPractice?originalMetrics({correctUnits:textPractice.correct,targetUnits:textPractice.target,elapsedTicks:textPractice.ticks}):{speed:0,accuracy:0,seconds:0};
 for(const [id,value,max]of[['best-bar',textPractice?.best||0,500],['now-bar',last.speed,500],['acc-bar',last.accuracy,100]]){const el=$('#'+id);el.style.width=Math.min(100,value/max*100)+'%';el.textContent=value;}
 $('#used-keys').textContent=(textPractice?.target||0)+'타';$('#correct-keys').textContent=(textPractice?.correct||0)+'타';$('#practice-time').textContent=(textPractice?.completed?total.seconds:0).toFixed(1)+'초';$('#speed').textContent=total.speed+'타/분';$('#accuracy').textContent=total.accuracy+'%';
}
function finishTextPracticeLine(){
 if(!session||finished)return;const now=performance.now(),analysis=analyzePracticeInput(session.target,session.typed,appSettings.layout);if(!analysis.complete)return;
 const records=finalizePracticeTiming(sentenceComposer,textTiming,analysis,session.startedAt,now);
 const ticks=session.startedAt===null?0:originalElapsedTicks(session.startedAt,now);
 const metric=originalMetrics({correctUnits:analysis.correctUnits,targetUnits:analysis.targetUnits,elapsedTicks:ticks});
 if(metric.speed>textPractice.best)sound(2);
 textPractice.completed++;textPractice.correct+=analysis.correctUnits;textPractice.target+=analysis.targetUnits;textPractice.ticks+=ticks;textPractice.last=metric;textPractice.best=textPracticeBest[textPractice.kind]=Math.max(textPracticeBest[textPractice.kind],metric.speed);
 const entry={mode,layout:appSettings.layout,language:currentLanguage,correct:analysis.correctUnits,entered:analysis.targetUnits,errors:analysis.targetUnits-analysis.correctUnits,elapsedTicks:ticks,elapsedMs:metric.seconds*1000,cpm:metric.speed,accuracy:metric.accuracy,date:new Date().toISOString()};
 textPractice.keyRecords.push(...records);const chartRecords=mode==='sentences'?records:textPractice.completed>=textPractice.quota?textPractice.keyRecords:null;
 if(chartRecords)entry.originalKeyStats=originalLineKeyStats(chartRecords);storePracticeRecord(entry,chartRecords);
 if(textPractice.completed>=textPractice.quota){finished=true;session=finishSession(session,now);paintSentence();const aggregate=originalMetrics({correctUnits:textPractice.correct,targetUnits:textPractice.target,elapsedTicks:textPractice.ticks});showTextRepeatDialog({...entry,correct:textPractice.correct,entered:textPractice.target,elapsedTicks:textPractice.ticks,elapsedMs:aggregate.seconds*1000,cpm:aggregate.speed,accuracy:aggregate.accuracy});}
 else renderTextPracticeLine();
}
function leaveTextPractice(){const previous=mode;navigate('home');openMenu(previous==='words'?'words':'textmenu',previous==='words'?selectedStage:0);}
function showTextRepeatDialog(entry){releaseProgramKeys();coreIdle=null;deactivatePracticeHeader();
 const currentMode=mode,canNext=currentMode==='words'&&entry.accuracy>=appSettings.targetAccuracy&&entry.cpm>=appSettings.targetSpeed;
 const choices=canNext?['계속','다음','그만']:['계속','그만'];let index=0;
 const dialog=document.createElement('section');dialog.className='repeat-dialog stage-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
 dialog.innerHTML=`<h1>연습할 내용 선택<button class="dialog-close" data-repeat-stop="true" aria-label="그만">×</button></h1><div class="stage-copy">계속 같은 내용을 연습할까요?</div><div class="repeat-answers">${choices.map((label,i)=>`<button class="bevel" data-choice="${i}">${label}</button>`).join('')}</div>`;workspace.append(dialog);
 const buttons=Array.from(dialog.querySelectorAll('[data-choice]'));
 const focusChoice=()=>{dialog.dataset.selectedChoice=String(index);buttons[index].focus({preventScroll:true});};
 const choose=()=>{resetNativeComposerMode();recordAdvancement(entry,entry.elapsedMs);const choice=choices[index];dialog.remove();if(choice==='그만')leaveTextPractice();else if(choice==='다음'){selectedStage=(selectedStage+1)%progressionInfo().stages.filter(s=>s.mode==='words').length;startKeys();}else currentMode==='words'?startWordStudy(true,false):startSentence(true,false);};
 dialog.onclick=e=>{if(e.target.dataset.repeatStop){index=choices.length-1;choose();}else if(e.target.dataset.choice!==undefined){const next=Number(e.target.dataset.choice);if(next===index)choose();else{index=next;focusChoice();}}};
 dialog.onkeydown=e=>{if(activateFocusedDialogClose(e,dialog))return;if(['Escape','Enter',' ','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key)){e.preventDefault();e.stopPropagation();}if(e.key==='Escape'){index=choices.length-1;choose();}else if(e.key==='Enter'||e.key===' ')choose();else if(['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key)){index=(index+(e.key==='ArrowLeft'?-1:1)+choices.length)%choices.length;focusChoice();}};
 focusChoice();$('#status').textContent='좌우 화살표로 항목을 선택한 후 Enter를 누르세요.';
}
function makeStudyWords(){const layout=({'2':'korean2','3':'korean3','3-no-shift':'korean3NoShift'})[appSettings.layout]||appSettings.layout;return originalWordLine(gameWords(),layout,selectedStage,originalRandom.nextInt);}

const longRememberedPages=[];let longTextOrdinal=0;
let longLines=[],longTyped=[],longIndex=0,longPage=0,longStarted=null,longSavedThrough=0,longResults=[],longInput=null,longComposer=null,longTiming=null,longBlankAccepted=false;
function startLong(){
 resetNativeComposerMode();session=null;finished=false;clearCoreComposers();longStarted=null;longTyped=[];longResults=[];longInput=null;longComposer=null;
 longLines=wrapLongText(imported||LONG_TEXTS.find(t=>t.id===selectedLongId)?.text||LESSONS.long[0]);
 longTextOrdinal=Math.max(0,LONG_TEXTS.filter(t=>t.language===currentLanguage).findIndex(t=>t.id===selectedLongId));
 longPage=imported?0:(longRememberedPages[longTextOrdinal]||0);if(longPage>=Math.ceil(longLines.length/5))longPage=0;
 longIndex=longPage*5;longSavedThrough=longIndex;longPage=Math.floor(longIndex/5);paintLong();
}

function longRenderMarkup(index){const analysis=analyzePracticeInput(longLines[index]||'',longTyped[index]||'',appSettings.layout);return analysis.entries.map((e,i)=>`<span class="${!e.correct&&(index!==longIndex||i<(longTiming?.records.length||0))?'practice-error':''}" style="display:inline-block;width:${e.columns*8}px">${esc(e.character)}</span>`).join('')+(index===longIndex?'<i class="practice-caret"></i>':'');}
function createLongInput(){
 armCoreIdle(showLongSelect,false);longTiming=createPracticeTiming();longBlankAccepted=false;
 longInput=document.createElement('textarea');longInput.dataset.line=String(longIndex);longInput.setAttribute('aria-label',`${longIndex+1}번째 줄 입력`);longInput.autocomplete='off';longInput.spellcheck=false;longInput.value=longTyped[longIndex]||'';preventBulkInput(longInput);
 longInput.onkeydown=e=>{
  if(isCompositionCommit(e))return;longInput.setSelectionRange(longInput.value.length,longInput.value.length);
  if(!['Shift','Control','Alt','Meta'].includes(e.key)&&longStarted===null)longStarted=performance.now();
  if(e.key==='PageDown'||e.key==='PageUp'){e.preventDefault();e.stopImmediatePropagation();changeLongPage(e.key==='PageDown'?1:-1);return;}
  if(!e.ctrlKey&&!e.altKey&&!e.metaKey&&!['Shift','Control','Alt','Meta'].includes(e.key)&&longStarted===null)longStarted=performance.now();
  const analysis=analyzePracticeInput(longLines[longIndex],longInput.value,appSettings.layout),complete=analysis.complete&&(longLines[longIndex]!==''||longBlankAccepted);
  if(longLines[longIndex]===''&&e.key==='Backspace'&&longBlankAccepted){longBlankAccepted=false;armCoreIdle(showLongSelect);e.preventDefault();e.stopImmediatePropagation();return;}
  if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();const controller=longComposer,index=longIndex;controller.commit({notify:true,event:e});if(longComposer===controller&&longIndex===index&&((longLines[index]!==''&&analyzePracticeInput(longLines[index],controller.state.committed,appSettings.layout).complete)||longBlankAccepted))finishLongLine();return;}
  if(complete&&!longComposer?.state.pending&&!longComposer?.state.kanaPrefix&&!['Backspace','Shift','Control','Alt','Meta','Escape'].includes(e.key)&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();e.stopImmediatePropagation();finishLongLine();return;}
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Delete','Tab'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();}
 };
 longComposer=attachComposer(longInput,{layout:appSettings.layout,onInput:result=>{
  const now=performance.now();if(longStarted===null)longStarted=now;if(result.nativeComposing){longTyped[longIndex]=longInput.value;const render=workspace.querySelector(`[data-long-render="${longIndex}"]`);if(render)render.innerHTML=longRenderMarkup(longIndex);return;}if(longLines[longIndex]===''){if(result.committed){longBlankAccepted=true;longComposer.reset('');longInput.value='';coreIdle=null;}return;}const analysis=analyzePracticeInput(longLines[longIndex],longInput.value,appSettings.layout);longTyped[longIndex]=analysis.acceptedText;
  trackPracticeAcceptance(result,analysis,longComposer,longTiming,longStarted,now);
  if(analyzePracticeInput(longLines[longIndex],longComposer.state.committed,appSettings.layout).complete)coreIdle=null;else if(!coreIdle)armCoreIdle(showLongSelect);
  if(analysis.overflow){longInput.value=analysis.acceptedText;finishLongLine();return;}
  const render=workspace.querySelector(`[data-long-render="${longIndex}"]`);if(render)render.innerHTML=longRenderMarkup(longIndex);
 }});
}
function changeLongPage(delta){
 const next=Math.max(0,longPage+delta);
 if(next>=Math.ceil(longLines.length/5)){if(!imported)longRememberedPages[longTextOrdinal]=0;showLongSelect();return;}
 clearCoreComposers();longInput=null;longComposer=null;longStarted=null;
 longPage=next;longIndex=next*5;longSavedThrough=longIndex;
 for(let index=longIndex;index<Math.min(longLines.length,longIndex+5);index++){longTyped[index]='';longResults[index]=undefined;}
 longPage=Math.floor(longIndex/5);paintLong();
}
function paintLong(){
 if(!imported)longRememberedPages[longTextOrdinal]=longPage;
 if(longIndex>=longLines.length){finishLong();return;}
 workspace.innerHTML=`<section class="long-dialog"><h1>긴글 연습(p. ${String(longPage+1).padStart(2,' ')})<button class="dialog-close" data-go="home">×</button></h1><div class="long-lines">${longLines.slice(longPage*5,longPage*5+5).map((text,i)=>{const n=longPage*5+i;return `<div class="long-line"><div>${esc(text)}</div><div class="practice-input-wrap" data-long-wrap="${n}"><div class="practice-typed-render" data-long-render="${n}" aria-hidden="true">${longRenderMarkup(n)}</div>${n!==longIndex?`<textarea data-line="${n}" readonly tabindex="-1" aria-label="${n+1}번째 줄 입력">${esc(longTyped[n]||'')}</textarea>`:''}</div></div>`;}).join('')}</div></section>`;
 if(!longInput)createLongInput();const row=workspace.querySelector(`[data-long-wrap="${longIndex}"]`);longInput.hidden=!row;(row||workspace).append(longInput);
 if(row)focusTypingInput(longInput);else{workspace.tabIndex=-1;workspace.focus({preventScroll:true});}$('#status').textContent='PgUp/PgDn 글쇠를 누르면 페이지가 변경됩니다.';
}
function finishLongLine(){
 const analysis=analyzePracticeInput(longLines[longIndex],longTyped[longIndex]||longInput.value,appSettings.layout);if(!analysis.complete||(longLines[longIndex]===''&&!longBlankAccepted))return;
 const now=performance.now(),records=finalizePracticeTiming(longComposer,longTiming,analysis,longStarted,now);
 const ticks=longStarted===null?0:originalElapsedTicks(longStarted,now);longTyped[longIndex]=analysis.acceptedText;longResults[longIndex]={correctUnits:analysis.correctUnits,targetUnits:analysis.targetUnits,elapsedTicks:ticks,records};longIndex++;
 if(longIndex%5===0||longIndex>=longLines.length)saveLongProgress();clearCoreComposers();longInput=null;longComposer=null;longStarted=null;longPage=Math.floor(longIndex/5);
 if(longIndex>=longLines.length)finishLong();else paintLong();
}
function saveLongProgress(){
 if(longIndex<=longSavedThrough||(longIndex%5!==0&&longIndex<longLines.length))return null;
 const complete=longResults.slice(longSavedThrough,longIndex);if(complete.some(x=>!x))return null;
 const correct=complete.reduce((n,x)=>n+x.correctUnits,0),entered=complete.reduce((n,x)=>n+x.targetUnits,0),ticks=complete.reduce((n,x)=>n+x.elapsedTicks,0);longSavedThrough=longIndex;if(!entered)return null;
 const records=complete.flatMap(result=>result.records||[]),metric=originalMetrics({correctUnits:correct,targetUnits:entered,elapsedTicks:ticks});const entry={originalKeyStats:originalLineKeyStats(records),mode:'long',layout:appSettings.layout,language:currentLanguage,correct,entered,errors:entered-correct,elapsedTicks:ticks,elapsedMs:metric.seconds*1000,cpm:metric.speed,accuracy:metric.accuracy,date:new Date().toISOString()};storePracticeRecord(entry,records);recordAdvancement(entry,entry.elapsedMs);return entry;
}
function finishLong(){saveLongProgress();if(!imported)longRememberedPages[longTextOrdinal]=0;finished=false;showLongSelect();}

let gameScore=INITIAL_SCORE,gameComposer=null,gameKind='invaders',gameStage=1,gameSaved=false,gamePhase='intro',gameEffectUntil=0;
let gameRecords=loadOriginalGameScores(storage);
const wordColumns=textColumns;
let gameTimer=null,gameColumns=[],gameX=40,gameY=47,gameDirection=1,gameHits=0,gameMisses=0,gameActive=false,gameNextMove=0;
let rainState=null,invadersState=null,rainLife=ENERGY_CAPACITY,gameInputText='',gameKeyQueue=[];
const rainSpawnMemory=createRainSpawnMemory(),gameWordMemory=createGameWordMemory();
function prepareGame(kind,continuing=false){
 releaseProgramKeys();closeMenu();
 if(!continuing)resetNativeComposerMode();coreIdle=null;clearInterval(gameTimer);clearCoreComposers();gameTimer=null;mode='play';gameKind=kind;gameActive=false;gamePhase='intro';gameInputText='';gameEffectUntil=0;$('#status').style.color='';
 if(!continuing){gameKeyQueue=[];gameSaved=false;gameScore=INITIAL_SCORE;gameHits=0;gameMisses=0;rainLife=ENERGY_CAPACITY;}
 $('#menu').style.display='none';$('.classic').classList.add('game-mode');$('.titlebar>span').textContent=`한컴타자연습 (놀이마당 ${String(gameStage).padStart(2,' ')})`;
 workspace.innerHTML=`<div class="game-hud" id="game-hud" hidden></div><div class="game-field" id="game-field" hidden></div><input id="game-input" class="game-input" aria-label="놀이 낱말 입력" autocomplete="off" spellcheck="false" readonly><div id="game-input-render" class="game-input-render" aria-hidden="true" hidden></div><div class="game-start game-intro" id="game-start">${String(gameStage).padStart(2,' ')}  놀 이 마 당</div>`;
 const input=$('#game-input');
 input.onkeydown=e=>{
  if(gameActive&&gameInputBusy()){if(!['Shift','Control','Alt','Meta'].includes(e.key)){gameKeyQueue.push({key:e.key,code:e.code,shiftKey:e.shiftKey,ctrlKey:e.ctrlKey,altKey:e.altKey,metaKey:e.metaKey,capsLock:e.getModifierState?.('CapsLock')});e.preventDefault();e.stopImmediatePropagation();}return;}
  if(isCompositionCommit(e))return;if(gamePhase==='running'&&(e.code==='Space'||e.key===' ')&&(e.shiftKey||e.ctrlKey))return;
  if(gamePhase==='intro'&&!['Escape','Shift','Control','Alt','Meta','CapsLock','NumLock','ScrollLock'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();beginGame();}
  else if(gamePhase==='ended'&&(e.code==='Space'||e.key===' ')){e.preventDefault();e.stopImmediatePropagation();dismissGameOver();}
  else if((rainState?.awaitingNext||invadersState?.awaitingNext)&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();e.stopImmediatePropagation();nextGameStage();}
  else if(gameActive&&(e.key==='Enter'||e.code==='Space'||e.key===' ')){e.preventDefault();e.stopImmediatePropagation();const controller=gameComposer;controller.commit({notify:true,event:e});if(gameComposer===controller)submitGameWord();}
 };
 gameComposer=attachComposer(input,{layout:appSettings.layout,onInput:result=>{
  if(!gameActive||gameInputBusy())return;
  if(result.nativeComposing){gameInputText=input.value;paintGameInput();return;}
  const controller=gameComposer,{submitted,remaining}=acceptGameCommittedInput(controller.state.committed);
  controller.replaceCommitted(remaining);gameInputText=input.value;paintGameInput();
  for(const word of submitted){if(gameComposer!==controller||!gameActive)break;submitGameWord(word);}
 }});
 preventBulkInput(input);$('#game-start').onclick=beginGame;focusTypingInput(input);$('#status').style.color='';$('#status').textContent='사이띄개를 누르세요.';
}
function setupInvaders(continuing=false){prepareGame('invaders',continuing);rainState=null;invadersState=createInvadersStage(gameStage,gameWords(),{random:originalRandom,language:currentLanguage,wordMemory:gameWordMemory});}
function setupRain(continuing=false){prepareGame('rain',continuing);invadersState=null;gameColumns=[];rainState=createRainStage(gameStage,gameWords(),{energy:rainLife,spawnMemory:rainSpawnMemory,random:originalRandom,language:currentLanguage,wordMemory:gameWordMemory});}

function beginGame(){
 if(gamePhase!=='intro')return;armCoreIdle(()=>selectGame(gameKind));gamePhase='running';gameActive=true;$('#game-start').hidden=true;$('#game-start').classList.remove('game-intro');$('#game-hud').hidden=false;$('#game-field').hidden=false;$('#game-input').readOnly=false;paintGameInput();focusTypingInput($('#game-input'));$('#status').textContent='';
 gameNextMove=performance.now()+(gameKind==='rain'?0:invadersState.interval*BIOS_TICK_MS);paintGame();gameTimer=setInterval(updateGame,16);
}
function beginInvaders(){beginGame();}function beginRain(){beginGame();}
function updateGame(){
 if(mode!=='play'||!gameActive)return;const now=performance.now();if(gameEffectUntil&&now>=gameEffectUntil){gameEffectUntil=0;$('#status').textContent='';$('#status').style.color='';}
 if(gameKind==='rain'){
  if(rainState.awaitingNext||now<rainState.pauseUntil||now<gameNextMove){if(rainState.concealUntil&&now>=rainState.concealUntil){rainState.concealUntil=0;paintRain();}return;}
  const wasBurst=rainState.burstRemaining>0,wasRewind=rainState.rewinding,wasClearing=rainState.clearing;
  const result=tickRain(rainState);gameScore+=result.points;rainLife=rainState.energy;
  if(wasBurst)rainState.burstRemaining--;
  gameNextMove=now+(wasRewind?(rainState.rewinding?BIOS_TICK_MS:0):wasClearing?60:rainState.burstRemaining?40:rainState.interval*BIOS_TICK_MS);
  paintRain();if(rainLife<=0)endInvaders();else if(rainState.complete)nextGameStage();
 }else{
  const bonusX=invadersState.bonus?.x;tickInvaderBonus(invadersState,now);let changed=bonusX!==invadersState.bonus?.x;
  if(invadersState.concealUntil&&now>=invadersState.concealUntil){invadersState.concealUntil=0;changed=true;}
  if(!invadersState.awaitingNext&&now>=invadersState.pauseUntil&&now>=gameNextMove){
   const forced=invadersState.forcedDown>0;tickInvaders(invadersState,{forceDown:forced});if(forced)invadersState.forcedDown--;
   gameNextMove=now+(invadersState.forcedDown?20:invadersState.interval*BIOS_TICK_MS);changed=true;
  }
  if(changed)paintInvaders();if(invadersState.defeated)endInvaders();else if(invadersState.complete)nextGameStage();
 }
 syncGameInputAvailability();
}
function gameInputBusy(){return gameKind==='rain'?Boolean(rainState?.rewinding||rainState?.clearing||rainState?.burstRemaining):Boolean(invadersState?.forcedDown);}
function syncGameInputAvailability(){
 const input=$('#game-input');if(!input)return;const busy=gameInputBusy();input.readOnly=gamePhase!=='running'||busy;if(busy)return;
 while(gameKeyQueue.length&&$('#game-input')&&!gameInputBusy()){const fields=gameKeyQueue.shift(),target=$('#game-input');let event;if(window.KeyboardEvent){event=new window.KeyboardEvent('keydown',{...fields,bubbles:true,cancelable:true});Object.defineProperty(event,'capsLock',{value:fields.capsLock});}else{event=new window.Event('keydown',{bubbles:true,cancelable:true});Object.assign(event,fields);}target.dispatchEvent(event);}
}
function paintGameHud(){
 const attempts=gameHits+gameMisses;
 $('#game-hud').innerHTML=`<span class="game-hits">정타:${gameHits}</span><span class="game-misses">오타:${gameMisses}</span><span class="game-accuracy">정확도:${String(attempts?Math.floor(gameHits/attempts*100):0).padStart(3,' ')}%</span><span class="game-score-label">점수:</span><span class="game-score">${gameScore}</span>${gameKind==='rain'?`<div class="ph-meter"><span class="ph-label">pH:</span>${Array.from({length:ENERGY_CAPACITY},(_,i)=>`<i style="background:${i>=rainLife?'#aaa':i<6?'#aa0000':i<12?'#0000ba':'#ffff55'}"></i>`).join('')}</div>`:''}`;
}
function paintInvaders(){
 if(!$('#game-field')||!invadersState)return;paintGameHud();const state=invadersState,concealed=state.concealUntil>performance.now();
 let html='';for(let col=state.left;col<=state.right;col++){const column=state.columns[col];for(let row=0;row<column.count;row++){const word=column.words[row],hidden=concealed&&state.concealed.includes(`${col}:${row}`);html+=`<span class="enemy ${row===column.count-1?'shootable':''} ${hidden?'concealed':''}" style="left:${column.x*8}px;top:${state.y-46+row*16}px;${hidden?`width:${textColumns(word)*8}px;background:#656565;color:transparent;`:''}">${esc(gameWordDisplay(word))}</span>`;}}
 if(state.bonus)html+=`<span class="enemy special" style="left:${state.bonus.x*8}px;top:1px;color:#55ffff">${esc(gameWordDisplay(state.bonus.word))}</span>`;
 $('#game-field').innerHTML=html;
}
function paintRain(){if(!$('#game-field'))return;paintGameHud();const concealed=rainState.concealUntil>performance.now();$('#game-field').innerHTML=rainState.words.filter(w=>w?.active).map(w=>`<span class="enemy ${w.special?'special':''} ${concealed?'concealed':''}" style="left:${w.x}px;top:${w.y-46}px;${concealed?`width:${textColumns(w.word)*8}px;background:#656565;color:transparent;`:w.special?'color:#55ffff;':''}">${esc(gameWordDisplay(w.word))}</span>`).join('');}
function paintGame(){gameKind==='rain'?paintRain():paintInvaders();}
function paintGameInput(){const render=$('#game-input-render');if(!render)return;render.hidden=gamePhase!=='running';render.innerHTML=esc($('#game-input')?.value||'')+'<i class="practice-caret"></i>';}
function submitGameWord(word){if(!gameActive||gameInputBusy())return;gameKind==='rain'?shootRain(word):shootWord(word);}
function takeGameInput(){const input=$('#game-input'),word=input.value;gameInputText='';gameComposer?.reset('');input.value='';paintGameInput();return word;}
function shootWord(submitted){
 const word=submitted===undefined?takeGameInput():submitted;if(!word)return;const result=hitInvaders(invadersState,word,performance.now());
 if(result.matched){sound(2);gameHits++;gameScore+=result.points;if(result.effect!==null&&!invadersState.complete){showGameEffect(applyInvadersEffect(invadersState,result.effect,performance.now()),result.effect===3?invadersState.concealUntil:result.effect===4?invadersState.pauseUntil:0);if(result.effect===2)gameNextMove=performance.now();else if([5,6].includes(result.effect))gameNextMove=performance.now()+invadersState.interval*BIOS_TICK_MS;}}else {sound(0);gameMisses++;}
 paintInvaders();if(invadersState.defeated)endInvaders();else if(invadersState.complete)nextGameStage();syncGameInputAvailability();
}
function shootRain(submitted){
 const word=submitted===undefined?takeGameInput():submitted;if(!word)return;const result=hitRain(rainState,word);
 if(result.matched){sound(2);gameHits++;gameScore+=result.points;if(result.effect!==null&&!rainState.complete){const label=applyRainEffect(rainState,result.effect,performance.now());showGameEffect(label,result.effect===3?rainState.concealUntil:result.effect===4?rainState.pauseUntil:0);if([2,5,7].includes(result.effect))gameNextMove=performance.now();}}else {sound(0);gameMisses++;}
 rainLife=rainState.energy;paintRain();if(rainState.complete)nextGameStage();syncGameInputAvailability();
}
function nextGameStage(){
 if(gamePhase==='completed'||gamePhase==='ended')return;clearInterval(gameTimer);gameActive=false;
 if(gameStage>=14){coreIdle=null;gameTimer=null;gamePhase='completed';dismissGameOver();return;}gameScore+=stageBonus(gameHits,gameMisses);gameStage++;gameKind==='rain'?setupRain(true):setupInvaders(true);
}
function saveGameRecord(){
 if(gameSaved)return;gameSaved=true;gameRecords=insertOriginalGameScore(gameRecords,{language:currentLanguage,layout:appSettings.layout,game:gameKind,wordType:'낱말',stage:gameStage,score:gameScore,date:localRecordDate()}).records;
 try{storage.setItem('retro-game-records-v1',JSON.stringify(gameRecords));}catch{}
}
function showGameEffect(label,until=0){$('#status').textContent=label;$('#status').style.color='#55ffff';gameEffectUntil=until;}
function dismissGameOver(){const kind=gameKind,backgroundHTML=workspace.innerHTML;saveGameRecord();handleMenuAction('gameScores',()=>selectGame(kind),{backgroundHTML});}
function endInvaders(){
 coreIdle=null;clearInterval(gameTimer);gameTimer=null;gameActive=false;gamePhase='ended';const overlay=$('#game-start');overlay.hidden=false;overlay.className='game-start game-ended';overlay.textContent='놀이가 끝났습니다.';overlay.onclick=dismissGameOver;const input=$('#game-input');input.readOnly=true;gameComposer?.reset('');input.value='';paintGameInput();focusTypingInput(input);$('#status').style.color='';$('#status').textContent='사이띄개를 누르세요.';
}



function wrapLongText(text){return wrapOriginalLongText(text);}
function showLongSelect(){resetNativeComposerMode();coreIdle=null;clearCoreComposers();const available=LONG_TEXTS.filter(t=>t.language===currentLanguage);if(!available.some(t=>t.id===selectedLongId))selectedLongId=available[0]?.id;const selected=Math.max(0,available.findIndex(t=>t.id===selectedLongId));workspace.innerHTML=`<section class="long-select"><h1>긴글 연습<button class="dialog-close" data-go="home">×</button></h1><fieldset><legend>글</legend><div id="long-list" role="listbox" aria-label="연습할 글 선택" tabindex="0">${available.map((t,i)=>`<div role="option" aria-selected="${i===selected}" data-text-id="${t.id}" style="padding-right:${textColumns(t.title)%2?8:0}px" class="${i===selected?'selected':''}">${esc(t.title)}</div>`).join('')}</div></fieldset><div class="select-message">연습하고자하는 글을 선택하세요.</div></section>`;let index=selected;const list=$('#long-list');function choose(){selectedLongId=available[index].id;imported='';startLong()}function highlight(){list.querySelectorAll('[role=option]').forEach((el,i)=>{el.classList.toggle('selected',i===index);el.setAttribute('aria-selected',String(i===index))});list.children[index]?.scrollIntoView({block:'nearest'})}list.onclick=e=>{const id=e.target.dataset.textId;if(!id)return;const next=available.findIndex(t=>t.id===id);if(next===index){choose();return;}index=next;highlight();list.focus({preventScroll:true});};list.onkeydown=e=>{if(['ArrowDown','ArrowUp','Home','End','PageUp','PageDown','Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();}if(['ArrowDown','ArrowUp','Home','End','PageUp','PageDown'].includes(e.key)){index=['Home','PageUp'].includes(e.key)?0:['End','PageDown'].includes(e.key)?available.length-1:(index+(e.key==='ArrowDown'?1:-1)+available.length)%available.length;highlight()}else if(e.key==='Enter'||e.key===' '){choose()}};list.focus({preventScroll:true});$('#status').textContent='상하 화살표로 항목을 선택한 후 Enter를 누르세요.';}
const STAGE_LABELS=['기본 자리','왼손 윗글쇠','검지 글쇠','오른손 윗글쇠','왼손 밑글쇠','오른손 밑글쇠','왼손 쌍자음','윗글쇠 나머지','숫자 글쇠','기호 글쇠'];
const KO_POOLS=['ㅁㄴㅇㄹㅓㅏㅣ','ㅂㅈㄷㄱㅅ','ㄱㅅㄹㅎㅗㅛㅕㅓ','ㅛㅕㅑㅐㅔ','ㅋㅌㅊㅍ','ㅠㅜㅡ','ㅃㅉㄸㄲㅆ','ㅒㅖ[]','1234567890','!@#$%^&*()_+-='];
const EN_POOLS=['asdfjkl;','qwert','rtyufghj','yuiop','zxcvb','nm,./','ASDF','QWERTY','1234567890','!@#$%^&*()_+-='];
function stageDefinition(){const layout=({'2':'korean2','3':'korean3','3-no-shift':'korean3NoShift',hiragana:'japanese',katakana:'japanese'})[appSettings.layout]||appSettings.layout;const stages=ORIGINAL_KEY_STAGE_POOLS[layout]||ORIGINAL_KEY_STAGE_POOLS.korean2;return stages[selectedStage]||stages[0];}
function stagePool(){return stageDefinition().physicalKeys.map(mapCharacter);}
const MENU_ACTIONS={home:[['환경 설정','settings'],['끝','exit']],keys:STAGE_LABELS.map((s,i)=>[s,'keys:'+i]),words:STAGE_LABELS.slice(0,8).map((s,i)=>[s,'words:'+i]),textmenu:[['짧은글 연습','sentences'],['긴글 연습','long'],['낙 서 장','notepad'],['타자 검정','exam'],['타자 검정 결과','examResults']],play:[['침 략 자','invaders'],['산 성 비','rain'],['점수보기','gameScores']],stats:[['타자 속도','stats-speed'],['글쇠별 타수','stats-keys'],['글쇠별 속도','stats-keySpeed'],['글쇠별 정확도','stats-keyAccuracy'],['손가락 빠르기','stats-fingers']],help:[['도 움 말','help'],['한컴타자연습 정보','about']]};
let openMenuId=null,openMenuIndex=0,mainMenuId='home',mainMenuIndex=0;const menuSelections={};
function closeMenu(){document.querySelector('.dropdown-menu')?.remove();$('.classic').classList.remove('menu-open');$('#menu').querySelectorAll('button').forEach(b=>b.classList.remove('open'));openMenuId=null;}
function openMenu(id,selectedIndex=menuSelections[id]??0){if(workspace.querySelector('.repeat-dialog'))return;releaseProgramKeys();if(id==='keys'||id==='words')MENU_ACTIONS[id]=progressionInfo().stages.filter(s=>s.mode===id).map(s=>[s.label,id+':'+s.subIndex]);if(!Number.isInteger(selectedIndex)||selectedIndex<0||selectedIndex>=MENU_ACTIONS[id].length)selectedIndex=0;closeMenu();openMenuId=id;openMenuIndex=selectedIndex;mainMenuId=id;mainMenuIndex=selectedIndex;menuSelections[id]=selectedIndex;const order=menuItems.findIndex(([m])=>m===id),x=[3,91,179,267,339,395,451][order];const menu=document.createElement('div');menu.className='dropdown-menu';menu.style.left=x+'px';menu.setAttribute('role','menu');menu.tabIndex=0;menu.innerHTML=MENU_ACTIONS[id].map(([label,action],i)=>`<div role="menuitem" class="${i===selectedIndex?'chosen':''}" data-action="${action}">${label}</div>`).join('');$('.classic').append(menu);$('.classic').classList.add('menu-open');$(`#menu [data-mode="${id}"]`).classList.add('open');menu.onclick=e=>{if(e.target.dataset.action){openMenuIndex=MENU_ACTIONS[id].findIndex(item=>item[1]===e.target.dataset.action);mainMenuIndex=openMenuIndex;menuSelections[id]=openMenuIndex;handleMenuAction(e.target.dataset.action)}};menu.onkeydown=e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown','Enter',' ','Escape'].includes(e.key))e.preventDefault();if(['ArrowDown','ArrowUp','Home','End','PageUp','PageDown'].includes(e.key)){openMenuIndex=['Home','PageUp'].includes(e.key)?0:['End','PageDown'].includes(e.key)?MENU_ACTIONS[id].length-1:(openMenuIndex+(e.key==='ArrowDown'?1:-1)+MENU_ACTIONS[id].length)%MENU_ACTIONS[id].length;mainMenuIndex=openMenuIndex;menuSelections[id]=openMenuIndex;Array.from(menu.children).forEach((c,i)=>c.classList.toggle('chosen',i===openMenuIndex))}else if(e.key==='Enter'||e.key===' ')handleMenuAction(MENU_ACTIONS[id][openMenuIndex][1]);else if(e.key==='ArrowRight'||e.key==='ArrowLeft'){const next=(order+(e.key==='ArrowRight'?1:-1)+menuItems.length)%menuItems.length;openMenu(menuItems[next][0])}};menu.focus({preventScroll:true});$('#status').textContent='좌우 화살표로 항목을 선택한 후 Enter를 누르세요.';}
async function handleMenuAction(action,returnTo=null,options={}){
 const request=++navigationVersion;
 stopCurrentActivity();closeMenu();session=null;
 const isCurrent=()=>request===navigationVersion;
 if(action.startsWith('stats-')||['long','sentences','exam'].includes(action)){
  workspace.setAttribute('aria-busy','true');$('#status').textContent='잠시 기다려 주세요.';
  await pauseFor(action);if(!isCurrent())return;workspace.removeAttribute('aria-busy');
 }
 if(action.includes(':')){const [next,stage]=action.split(':');selectedStage=Number(stage);navigate(next);return;}
 if(action==='settings'){
  mode='settings';const module=await import('./settings.js');if(!isCurrent())return;
  settingsController=module.renderSettings(workspace,appSettings,next=>{
   if(!isCurrent())return;appSettings=next;currentLanguage=next.language;refreshKeyboardLabels();
   try{storage.setItem('retro-typing-settings-v1',JSON.stringify(next));}catch{}
   $('#language').textContent=settingsStatus(next);navigate('home');openMenu('home',0);
  },()=>{if(isCurrent()){navigate('home');openMenu('home',0);}},{focusTypingInput});return;
 }
 if(action==='invaders'||action==='rain'){navigate('play');selectGame(action);return;}
 if(action==='exit'){endApplication();return;}
 if(action==='about'){navigate('about');return;}
 if(['notepad','exam','examResults','gameScores'].includes(action)||action.startsWith('stats-')){
  if(action==='notepad'||action==='exam')resetNativeComposerMode();mode=action;const module=await import('./extras.js');if(!isCurrent())return;
  extraCleanup=module.renderExtras(workspace,action,{
   focusTypingInput,onNativeReturn:dispatchNativeReturn,onInputOwnerChange:releaseProgramKeys,backgroundHTML:options.backgroundHTML,language:currentLanguage,settings:appSettings,progress,gameRecords,examRecords,longTexts:LONG_TEXTS,profileSessionId,originalKeyProfile,originalSpeedHistory,composerMode:{...ensureComposerMode()},onComposerMode:updateComposerMode,
   onPageReport:entry=>{if(!isCurrent())return;appendOriginalSpeedHistory(originalSpeedHistory,{weight:entry.correct,speed:entry.cpm,accuracy:entry.accuracy,seconds:(entry.elapsedMs||0)/1000,date:localRecordDate()},storage);recordAdvancement({mode:'exam',...entry},entry.elapsedMs||0);},onHistorySample:sample=>{if(isCurrent())appendOriginalSpeedHistory(originalSpeedHistory,sample,storage);},onKeyStats:(stats,records)=>{if(isCurrent())appendOriginalKeyProfile(originalKeyProfile,stats,storage,records);},onSound:sound,keyboardRows:keyboardRows(),onClose:()=>{if(!isCurrent())return;if(returnTo){returnTo();return;}navigate('home');const parent=action.startsWith('stats-')?'stats':action==='gameScores'?'play':'textmenu';openMenu(parent,Math.max(0,MENU_ACTIONS[parent].findIndex(item=>item[1]===action)));},
   onRecord:entry=>{if(!isCurrent())return;entry={layout:appSettings.layout,language:currentLanguage,...entry};storePracticeRecord(entry);recordAdvancement(entry,entry.elapsedMs||0);},
   onStatus:text=>{if(isCurrent())$('#status').textContent=text;}
  });return;
 }
 navigate(action);
}
try { appSettings=normalizeSettings(JSON.parse(storage.getItem('retro-typing-settings-v1')||'{}'));currentLanguage=appSettings.language;$('#language').textContent=settingsStatus(appSettings); } catch {}
keyboardBridge=createKeyboardInputBridge({document,surface:workspace,getOwner:currentInputOwner,getEpoch:()=>navigationVersion,isVirtualMode:()=>inputMethod!=='native',onKeyState:(code,down)=>keyboardView?.setPressed(code,down),onModifiers:state=>keyboardView?.setModifiers(state)});
keyboardView=createVirtualKeyboard($('#virtual-keyboard'),{onKeyDown:packet=>keyboardBridge.keyDown(packet),onKeyUp:packet=>keyboardBridge.keyUp(packet),onReleaseAll:()=>keyboardBridge.releaseAll(),onVisibilityChange:reflectKeyboardVisibility,getSoundEnabled:()=>true});
refreshKeyboardLabels();setKeyboardVisible(true);
resize();showWelcome();const bootVersion=navigationVersion;pauseFor('boot').then(()=>{if(navigationVersion===bootVersion)showStageDialog();});

function sentenceTexts(){return PRACTICE_TEXTS.sentences[currentLanguage]||PRACTICE_TEXTS.sentences.ko;}
function gameWords(){return PRACTICE_TEXTS.words[currentLanguage==='ja'?(appSettings.layout==='katakana'?'jaKatakana':'jaHiragana'):currentLanguage]||PRACTICE_TEXTS.words.ko;}
function physicalCharacter(e){const ascii=physicalAscii(e);return ascii===null?null:mapCharacter(ascii);}
function physicalAscii(e){return physicalKey(e,appSettings.layout);}
function mappedKeyEntry(ascii){const name=({'2':'korean2','3':'korean3','3-no-shift':'korean3NoShift',dvorak:'dvorak',hiragana:'hiragana',katakana:'katakana'})[appSettings.layout];return name?(ORIGINAL_KEYBOARD_MAPS[name]?.mapping[ascii]||{display:ascii,role:'literal'}):{display:ascii,role:'literal'};}
function mapCharacter(ascii){return renderMappedKey(appSettings.layout,ascii);}
function physicalKeyboardRows(){return [['`','1','2','3','4','5','6','7','8','9','0','-','=','\\','BS'],['Tab','q','w','e','r','t','y','u','i','o','p','[',']'],['Caps','a','s','d','f','g','h','j','k','l',';',"'",'Enter'],['Shift','z','x','c','v','b','n','m',',','.','/','Shift'],['Ctrl','Alt',' ','Alt','Ctrl']];}
function keyboardRows(){return physicalKeyboardRows().map(row=>row.map(key=>key.length===1?mapCharacter(key):key));}

$('#external-import').onchange=async event=>{
 const file=event.target.files[0],version=navigationVersion;if(!file)return;
 const notice=text=>{$('#outside-help').hidden=false;$('#outside-help').textContent=text;};
 if(file.size>200000){notice('가져올 글은200KB 이하의 텍스트 파일을 선택해 주세요.');event.target.value='';return;}
 try{const text=parseImportedText(await file.text());if(version!==navigationVersion)return;if(!text){notice('파일에 연습할 글이 없습니다. 다른 텍스트 파일을 선택해 주세요.');return;}navigationVersion++;stopCurrentActivity();closeMenu();imported=text;mode='long';startLong();}
 catch{notice('텍스트 파일을 읽지 못했습니다. 파일을 다시 선택해 주세요.');}
 finally{event.target.value='';}
};

function progressionForLayout(layout){const name=({'2':'korean2','3':'korean3','3-no-shift':'korean3NoShift'})[layout]||layout;return ORIGINAL_PROGRESSION[name]||ORIGINAL_PROGRESSION.korean2;}
function progressionInfo(){return progressionForLayout(appSettings.layout);}
function showStageDialog(){
 navigationVersion++;stopCurrentActivity();closeMenu();mode='stage';const progression=progressionInfo();let step=1;try{step=Number(storage.getItem('retro-typing-stage-'+appSettings.layout))||1}catch{}step=Math.max(1,Math.min(progression.total,step));const stage=progression.stages[step-1];
 workspace.innerHTML=`<section class="stage-dialog" data-selected-choice="0"><h1>연습단계 선택<button class="dialog-close" data-go="home">×</button></h1><div class="stage-copy">오늘은 총 ${progression.total} 단계에서　${step} 번째 단계로<br>${stage.mode==='keys'?'자리연습':stage.mode==='words'?'낱말연습':'글연습'}의 '${stage.label}'를 연습 할 차례입니다.<span class="stage-question">연습을 하시겠습니까?</span></div><button id="stage-yes" class="stage-answer">예</button><button id="stage-no" class="stage-answer">아니오</button></section>`;
 const dialog=workspace.querySelector('.stage-dialog'),answers=[...dialog.querySelectorAll('.stage-answer')];let selected=0;
 const choose=()=>{if(selected===1){navigate('home');openMenu('home',0);}else{selectedStage=stage.subIndex;if(stage.mode==='test')handleMenuAction('exam');else navigate(stage.mode==='short'?'sentences':stage.mode);}};
 const focusChoice=()=>{dialog.dataset.selectedChoice=String(selected);answers[selected].focus({preventScroll:true});};
 answers.forEach((button,index)=>{button.onpointerdown=event=>event.preventDefault();button.onfocus=()=>{selected=index;dialog.dataset.selectedChoice=String(index);};button.onclick=()=>{if(index===selected)choose();else{selected=index;focusChoice();}};});
 dialog.onkeydown=event=>{if(activateFocusedDialogClose(event,dialog))return;if(['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown','Enter',' ','Escape'].includes(event.key)){event.preventDefault();event.stopPropagation();if(event.key==='Escape'){selected=1;choose();}else if(event.key==='Enter'||event.key===' ')choose();else{selected=1-selected;focusChoice();}}};
 focusChoice();$('#status').textContent='좌우 화살표로 항목을 선택한 후 Enter를 누르세요.';
}

const runTextTotals={};
function recordAdvancement(entry,elapsedMs){
 const layout=appSettings.layout;
 if(['long','exam'].includes(entry.mode)){
  const totals=runTextTotals[layout]||(runTextTotals[layout]={correct:0,entered:0,ticks:0});
  const units=entry.mode==='exam'?originalExamProgressionUnits(entry.correct||0,entry.errors||0):entry;
  totals.correct+=Math.max(0,units.correct||0);totals.entered+=Math.max(0,units.entered||0);
  totals.ticks+=Math.max(0,entry.elapsedTicks??Math.floor(elapsedMs/BIOS_TICK_MS));
  return; // Native long/exam qualification occurs only on profile-save/exit.
 }
 const key='retro-typing-stage-'+layout,dateKey='retro-typing-stage-date-'+layout;
 try{const today=localRecordDate(),result=advancePractice({stages:progressionInfo().stages,savedStage:Number(storage.getItem(key))||1,mode:entry.mode,selectedStage,accuracy:entry.accuracy,cpm:entry.cpm,elapsedMs,lastDate:storage.getItem(dateKey)||'',today,settings:appSettings});storage.setItem(key,String(result.savedStage));storage.setItem(dateKey,result.lastDate);}catch{}
}

let profileExitSaved=false;
function saveNativeProfileOnExit(){
 if(profileExitSaved)return;profileExitSaved=true;
 for(const [layout,totals]of Object.entries(runTextTotals)){
  const key='retro-typing-stage-'+layout,dateKey='retro-typing-stage-date-'+layout,stages=progressionForLayout(layout).stages;
  try{const savedStage=Number(storage.getItem(key))||1,current=stages[savedStage-1];if(!current||!['long','test'].includes(current.mode))continue;
   const metric=originalMetrics({correctUnits:totals.correct,targetUnits:totals.entered,elapsedTicks:totals.ticks});
   const result=advancePractice({stages,savedStage,mode:current.mode==='test'?'exam':'long',accuracy:metric.accuracy,cpm:metric.speed,elapsedMs:metric.seconds*1000,lastDate:storage.getItem(dateKey)||'',today:localRecordDate(),settings:appSettings});
   storage.setItem(key,String(result.savedStage));storage.setItem(dateKey,result.lastDate);
  }catch{}
 }
 closeOriginalKeyProfile(originalKeyProfile,storage);
}
function endApplication(){
 navigationVersion++;stopCurrentActivity();closeMenu();saveNativeProfileOnExit();mode='exited';keyboardBridge?.releaseAll();keyboardView?.setVisible(false);$('#keyboard-input-mode').disabled=true;$('#native-keyboard-focus').disabled=true;workspace.innerHTML='';$('#frame-box').hidden=true;
 $('#external-controls').hidden=true;$('#control-toggle').setAttribute('aria-expanded','false');$('#control-toggle').disabled=true;$('#external-import').disabled=true;
 $('#outside-help').hidden=false;$('#outside-help').textContent='연습을 마쳤습니다. 기록을 저장했습니다. 다시 시작하려면 아래 버튼을 누르세요.';
 $('#focus-input').textContent='다시 시작';$('#focus-input').focus({preventScroll:true});
}
window.addEventListener('pagehide',event=>{if(!event.persisted)saveNativeProfileOnExit();});
function selectGame(kind){resetNativeComposerMode();stopCurrentActivity();closeMenu();gameStage=Math.min(10,Math.max(1,gameStage));$('.titlebar>span').textContent='한컴타자연습';mode='play';gamePhase='select';$('#status').style.color='';$('#menu').style.display='flex';$('.classic').classList.remove('game-mode');renderGameSelector(workspace,kind,stage=>{gameStage=stage;kind==='rain'?setupRain():setupInvaders()},()=>{navigate('home');openMenu('play',kind==='rain'?1:0);},gameStage);}
