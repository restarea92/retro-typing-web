import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createKeyDrill,pressKeyDrill,requestedKey,remainingKeyRounds} from '../drill-rules.js';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const assignment=source.split('\n').find(x=>x.includes("if(!(correct&&previousDrill.phase==='target'&&keyDrill.phase==='home'))"));
assert.ok(assignment);
const render=new Function('correct','previousDrill','keyDrill','keyCount','keyCorrect','remainingKeyRounds','$',assignment);
const pool={physicalKeys:['q','w','e','r'],keyIndices:[13,14,15,16]};
function run(stage,repeat,keys){let state=createKeyDrill(pool,{stage,repeat,rounds:2}),hud={innerHTML:'initial'};let paints=[];for(const key of keys){const previous=state,correct=key===requestedKey(previous);state=pressKeyDrill(state,key,()=>0);render(correct,previous,state,state.correct+state.incorrect,state.correct,remainingKeyRounds,()=>hud);paints.push(hud.innerHTML);}return {state,paints};}
test('only target-to-home transition retains HUD; next home refreshes',()=>{const {state,paints}=run(1,false,['q','a']);assert.equal(paints[0],'initial');assert.match(paints[1],/100%/);assert.equal(state.correct,2);});
test('wrong key in home phase refreshes retained HUD using actual totals',()=>{const {state,paints}=run(1,false,['q','x','a']);assert.equal(paints[0],'initial');assert.match(paints[1],/50%/);assert.match(paints[2],/66%/);assert.equal(state.incorrect,1);assert.equal(state.correct,2);});
test('basic stage and repeated partial attempts still refresh',()=>{assert.match(run(0,false,['q']).paints[0],/100%/);const r=run(1,true,['q','q','x','q','q','a','a','a','a']);assert.match(r.paints[2],/66%/);assert.equal(r.paints[4],r.paints[3]);assert.match(r.paints[8],/88%/);assert.equal(r.state.correct,8);assert.equal(r.state.incorrect,1);});
