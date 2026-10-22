/** Source-grounded CSS/DOM regressions, not browser pixel or native-input proof.
 * Public copy always reads this edition; the omitted title-bitmap case is skipped. */
import test, {resourceTestsEnabled} from './resource-test.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const css=fs.readFileSync(new URL('styles.css',root),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
const {api,document}=resourceTestsEnabled ? await import(new URL('qa/dom-harness.mjs',root)) : {};
function rule(selector){const matches=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m=>m[1].trim().split(',').map(s=>s.trim()).includes(selector));return Object.assign({},...matches.map(m=>Object.fromEntries(m[2].split(';').filter(Boolean).map(s=>{const n=s.indexOf(':');return [s.slice(0,n).trim(),s.slice(n+1).trim()]}))));}
const cells=()=>[...document.querySelectorAll('#key-target>span')];
const hidden=()=>cells().filter(c=>c.classList.contains('warmup-consumed'));
function begin(repeat=false){api.navigate('home');api.setLanguage('ko','2');api.setStage(0);api.getState().appSettings.repeat=repeat;api.navigate('words');}
function accept(){api.keyPress(api.getKeyTarget());}

test('repeat focus uses explicit one-pixel dots, not browser dotted-border rasterization',()=>{
 const style=rule('.repeat-dialog .repeat-answers .bevel:focus:after');
 assert.equal(style.border,'0');assert.equal(style.inset,'2px 12px 2px 16px');
 assert.equal(style['background-image'],[...Array(2).fill('repeating-linear-gradient(to right,#656565 0 1px,transparent 1px 2px)'),...Array(2).fill('repeating-linear-gradient(to bottom,#656565 0 1px,transparent 1px 2px)')].join(','));
 assert.equal(style['background-size'],'100% 1px,100% 1px,1px 100%,1px 100%');
 assert.equal(style['background-position'],'left top,left bottom,left top,right top');
 const [t,r,b,l]=style.inset.match(/\d+/g).map(Number),width=83-2-l-r,height=27-2-t-b;
 assert.equal(width,53);assert.equal(height,21);
 assert.deepEqual(Array.from({length:Math.ceil(width/2)},(_,i)=>199+1+l+2*i),Array.from({length:27},(_,i)=>216+2*i));
 assert.deepEqual(Array.from({length:Math.ceil(height/2)},(_,i)=>256+1+t+2*i),Array.from({length:11},(_,i)=>259+2*i));
});
test('recessed target endpoints are opaque white in native bottom-then-right paint order',()=>{
 const s=rule('.key-dialog .key-target');assert.equal(s['border-color'],'transparent');assert.equal(s['background-origin'],'border-box');assert.equal(s['background-clip'],'border-box');
 assert.equal(s['background-image'],'linear-gradient(#fff,#fff),linear-gradient(#fff,#fff),linear-gradient(#656565,#656565),linear-gradient(#656565,#656565)');
 assert.equal(s['background-size'],'1px 100%,100% 1px,1px 100%,100% 1px');assert.equal(s['background-position'],'right top,left bottom,left top,left top');
});
test('warmup clipping cannot remove the panel-owned border paint',()=>{
 assert.equal(rule('.word-dialog .key-target').overflow,'hidden');
 assert.equal(rule('.key-dialog .key-target')['background-origin'],'border-box');
 assert.equal(rule('.key-dialog .key-target:before').content,undefined);
 assert.equal(rule('.key-dialog .key-target:after').content,undefined);
});
test('inactive title retains the verified composite and adds only its missing keyboard scanline',{skip:'Original embedded title bitmap is intentionally omitted from the public source'},()=>{
 const icon=css.match(/\.key-dialog h1:before\{background-image:url\("data:image\/png;base64,([^"]+)/)[1];
 const png=Buffer.from(icon,'base64');assert.equal(png.readUInt32BE(16),32);assert.equal(png.readUInt32BE(20),16);
 const s=rule('.classic:has(.repeat-dialog) .key-dialog h1');assert.equal(s['background-image'],'linear-gradient(#000,#000)');assert.equal(s['background-size'],'13px 1px');assert.equal(s['background-position'],'22px 17px');
 assert.deepEqual([69+22,92+17,13],[91,109,13]);
});
test('warmup ASCII remains left-aligned in the unchanged32px slot',()=>{
 const s=rule('.word-dialog .key-target>span');assert.equal(s['text-align'],'left');assert.equal(s.width,'32px');assert.equal(s['min-width'],'32px');assert.equal(s.flex,'none');
 assert.equal(rule('.word-dialog .key-target>span.warmup-consumed').visibility,'hidden');
});
test('Study ticks retain40px spacing but use the native7px height and corrected origin',()=>{
 const s=rule('.bar-track:before');assert.equal(s.height,'7px');assert.equal(s['margin-left'],'30px');assert.equal(s.width,'241px');assert.equal(s.top,'-9px');assert.equal(s.background,'repeating-linear-gradient(to right,#000 0 1px,transparent 1px 40px)');
});
test('value-slab frame surrounds rather than resizes the existing fill and caption',()=>{
 const fill=rule('.bar-track b'),frame=rule('.bar-track b:after');
 assert.equal(fill['min-width'],'30px');assert.equal(fill.height,'16px');assert.equal(fill['padding-left'],'6px');assert.equal(fill.position,'relative');
 assert.equal(frame.inset,'-1px');assert.equal(frame['background-image'],'linear-gradient(#656565,#656565),linear-gradient(#656565,#656565),linear-gradient(#fff,#fff),linear-gradient(#fff,#fff)');
 assert.equal(frame['background-size'],'1px 100%,100% 1px,1px 100%,100% 1px');assert.equal(frame['background-position'],'right top,left bottom,left top,left top');assert.equal(frame['pointer-events'],'none');
 assert.deepEqual([parseInt(fill['min-width'])+2,parseInt(fill.height)+2],[32,18]);
});
test('warmup wrong input preserves all current/future slots',()=>{
 begin();const target=api.getKeyTarget(),text=cells().map(c=>c.textContent);api.keyPress('\0');assert.equal(api.getKeyTarget(),target);assert.equal(hidden().length,0);assert.deepEqual(cells().map(c=>c.textContent),text);assert.equal(cells()[0].style.color,'#55ffff');
});
test('nine accepted warmup targets are erased without changing slot content or width',()=>{
 begin();const text=cells().map(c=>c.textContent);for(let i=0;i<9;i++)accept();assert.equal(cells().length,10);assert.equal(hidden().length,9);assert.deepEqual(cells().map(c=>c.textContent),text);assert.equal(cells()[9].textContent,api.getKeyTarget());assert.equal(cells()[9].style.color,'#55ffff');assert.equal(document.querySelector('#key-score').textContent,'[횟수:  5]');
});
test('rollover resets only the new row and final50 still enters Study40',()=>{
 accept();assert.equal(cells().length,10);assert.equal(hidden().length,0);assert.equal(document.querySelector('#key-score').textContent,'[횟수:  4]');
 for(let i=10;i<49;i++)accept();assert.equal(hidden().length,9);assert.equal(document.querySelector('#key-score').textContent,'[횟수:  1]');accept();assert.equal(document.querySelector('.key-dialog'),null);assert.equal(api.getState().textPractice.quota,40);assert.equal(api.getState().textPractice.completed,0);
});
test('repeat mode erases a target only after the fourth correct press',()=>{
 begin(true);for(let i=0;i<3;i++){accept();assert.equal(hidden().length,0);}accept();assert.equal(hidden().length,1);api.keyPress('\0');assert.equal(hidden().length,1);api.navigate('home');
});
