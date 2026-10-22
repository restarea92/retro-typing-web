/** Source-derived CSS contract checks. These do not replace rendered retakes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const css=fs.readFileSync(new URL('styles.css',root),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
function rule(selector){
 const matches=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m=>m[1].trim().split(',').map(s=>s.trim()).includes(selector));
 return Object.assign({},...matches.map(m=>Object.fromEntries(m[2].split(';').filter(Boolean).map(s=>{const n=s.indexOf(':');return [s.slice(0,n).trim(),s.slice(n+1).trim()]}))));
}

test('metric outer frames use the native recessed edge precedence on their own border box',()=>{
 for(const selector of ['.bar-track','.speed-panel','.result-panel']){
  const s=rule(selector);
  assert.equal(s['border-color'],'transparent',selector);
  assert.equal(s['background-origin'],'border-box',selector);
  assert.equal(s['background-clip'],'border-box',selector);
  assert.equal(s['background-image'],'linear-gradient(#fff,#fff),linear-gradient(#fff,#fff),linear-gradient(#656565,#656565),linear-gradient(#656565,#656565)',selector);
  assert.equal(s['background-position'],'right top,left bottom,left top,left top',selector);
  assert.equal(s['background-size'],'1px 100%,100% 1px,1px 100%,100% 1px',selector);
 }
});

test('metric inner frames place the dark bottom and right above white top and left',()=>{
 for(const selector of ['.speed-panel','.result-panel']){
  assert.equal(rule(selector)['box-shadow'],'inset -1px -1px #656565,inset 1px 1px #fff',selector);
 }
});

test('the corner correction does not resize tracks, panels, value fills or graph ticks',()=>{
 assert.deepEqual([rule('.bar-track').width,rule('.bar-track').height,rule('.bar-track').padding],['273px','20px','1px']);
 assert.deepEqual([rule('.speed-panel').width,rule('.speed-panel').height],['385px','136px']);
 assert.deepEqual([rule('.result-panel').width,rule('.result-panel').height],['161px','136px']);
 assert.deepEqual([rule('.bar-track b')['min-width'],rule('.bar-track b').height,rule('.bar-track b')['padding-left']],['30px','16px','6px']);
 assert.deepEqual([rule('.bar-track:before').width,rule('.bar-track:before').height,rule('.bar-track:before')['margin-left']],['241px','7px','30px']);
});
