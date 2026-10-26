/** Source-grounded, deterministic ENGINE + SIMULATED DOM coverage for HTTD 1999.
 * GAME-SPEC.md: initialization163d1, rain15a10/15be8/157aa, invaders165dd,
 * matching161d1/17106, effects1605a/16905, LevelUp170ae, gameInsert14e94.
 * No native execution, browser pixels, OS keyboard, audio or clock parity claim.
 * No runtime edits, quota shortcuts, injected enemies or manual stage advances.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
 BIOS_TICK_MS, createRainStage, tickRain, hitRain,
 applyRainEffect, createInvadersStage, tickInvaders, tickInvaderBonus,
 hitInvaders, applyInvadersEffect,
} from '../game-engine.js';
import {createOriginalRandom,browserTimeSeed} from '../original-random.js';
// The six simulated-DOM cases require private resources and are skipped by default.
const resourceTests = process.env.RUN_PRIVATE_RESOURCE_TESTS === '1';
const {api, document, saved} = resourceTests ? await import('./dom-harness.mjs') : {};

const STAGES = Array.from({length:14}, (_, i) => i + 1);
const rainQuota = stage => 26 + 2 * (stage - 1);
const activeColumns = stage => 3 + Math.min(3, Math.floor((stage - 1) / 3));
const scoreOf = text => 10 * (Math.floor(Array.from(text).reduce((n, c) => n + (c.codePointAt(0)>255?2:1), 0) / 2) + 1);
const bonusOf = (hits, misses) => 500 + (hits + misses && Math.floor(100 * hits / (hits + misses)) >= 90 ? 500 : 0);
const pool = [...Array.from({length:60}, (_, i) => `w${String(i).padStart(2, '0')}`), 'bonus'];
/** Injectable random fixture is an engine input, not a state shortcut. The
 * first60 draws select unique ordinary records; the next10 select bonus text.
 * Spawn gates/positions are safe and reproducible; special roll is explicit. */
function fixtureRandom({special=false, effect=0}={}) {
 let selections = 0;
 const random = () => { throw new Error('Expected modulo-based engine RNG'); };
 random.modulo = maximum => {
  if (maximum === pool.length) return selections++ < 60 ? selections - 1 : 60;
  if (maximum === 19) return typeof effect === 'function' ? effect() : effect;
  if (maximum === 3) return special ? 0 : 1;
  return 0;
 };
 return random;
}
function makeRain(stage, options={}) {
 return createRainStage(stage, pool, {language:'en', random:fixtureRandom(options), ...options});
}
function makeInvaders(stage, options={}) {
 return createInvadersStage(stage, pool, {language:'en', random:fixtureRandom(options), ...options});
}
function bottom(state) {
 const column = state.columns[state.direction > 0 ? state.right : state.left];
 return column.words[column.count - 1];
}
function formationCount(state) {
 return state.columns.slice(state.left, state.right + 1).reduce((n,c) => n + c.count, 0);
}

for (const stage of STAGES) {
 test(`ENGINE rain stage ${stage}: full ${rainQuota(stage)}-word quota through ticks and exact hits`, () => {
  const s=makeRain(stage); let hits=0, points=0;
  assert.equal(s.lastIndex, rainQuota(stage)-1);
  assert.equal(s.interval, 19-stage);
  assert.equal(s.selectedWords.length, 60);
  while (!s.complete) {
   assert.ok(hits < rainQuota(stage), 'completion must follow actual quota');
   assert.equal(tickRain(s).points, 0);
   const word=s.words.find(w=>w.active);
   assert.ok(word, 'fixture spawns one actual word per tick');
   const result=hitRain(s,word.word);
   assert.deepEqual(result,{matched:true,points:20,effect:null});
   hits++; points+=result.points;
   assert.equal(s.complete, hits===rainQuota(stage));
  }
  assert.equal(hits,rainQuota(stage)); assert.equal(points,hits*20);
  assert.equal(s.firstRemaining,hits); assert.equal(s.spawned,hits); assert.equal(s.energy,17);
  assert.equal(tickRain(s).points,0); assert.equal(s.spawned,hits);
  assert.equal(hitRain(s,'not-present').matched,false);
 });
 test(`ENGINE invaders stage ${stage}: ${activeColumns(stage)} columns cleared through motion and ${activeColumns(stage)*10} bottom hits`, () => {
  const s=makeInvaders(stage); let hits=0, points=0;
  assert.equal(s.interval,21-stage); assert.equal(s.columns.length,6);
  assert.equal(s.right+1,activeColumns(stage)); assert.equal(s.y,47);
  assert.deepEqual(s.columns.map(c=>c.x),[6,18,30,42,54,66]);
  while (!s.complete) {
   assert.ok(hits<activeColumns(stage)*10);
   const before=formationCount(s);
   tickInvaders(s); tickInvaderBonus(s,hits*2000);
   assert.equal(s.defeated,false);
   const result=hitInvaders(s,bottom(s),hits*2000);
   assert.deepEqual(result,{matched:true,points:20,effect:null});
   assert.equal(formationCount(s),before-1);
   hits++; points+=result.points;
  }
  assert.equal(hits,activeColumns(stage)*10); assert.equal(points,hits*20);
  assert.equal(s.defeated,false); assert.ok(s.left>s.right);
  const y=s.y; tickInvaders(s); assert.equal(s.y,y);
 });
 test(`ENGINE rain stage ${stage}: natural missed-word defeat is not clear and never awards hit points`, () => {
  const s=makeRain(stage); let polls=0, points=0;
  while (s.energy>0) {
   assert.ok(polls++<200,'finite fixture must reach loss'); points+=tickRain(s).points;
  }
  assert.equal(s.energy,0); assert.equal(s.complete,false); assert.equal(points,0);
  assert.ok(s.firstRemaining<=s.lastIndex);
  const before=s.spawned; tickRain(s); assert.equal(s.spawned,before);
 });
 test(`ENGINE rain stage ${stage}: final naturally fallen word clears the quota without a hit`, () => {
  const s=makeRain(stage); let correct=0;
  while(s.spawned<rainQuota(stage)) {
   tickRain(s);
   if(s.spawned<rainQuota(stage)) {assert.equal(hitRain(s,s.words[s.spawned-1].word).matched,true);correct++;}
  }
  assert.equal(s.complete,false); let polls=0;
  while(!s.complete) {assert.ok(polls++<30);assert.equal(tickRain(s).points,0);}
  assert.equal(correct,rainQuota(stage)-1); assert.equal(s.energy,16);
  assert.equal(s.spawned,rainQuota(stage)); assert.equal(s.firstRemaining,rainQuota(stage));
 });
 test(`ENGINE invaders stage ${stage}: unhit formation loses at the source collision boundary`, () => {
  const s=makeInvaders(stage); let polls=0;
  while (!s.defeated) { assert.ok(polls++<1000); tickInvaders(s); }
  assert.equal(s.y,287); assert.equal(s.y+16*10,447);
  assert.equal(s.complete,false); assert.equal(formationCount(s),activeColumns(stage)*10);
  const x=s.columns.map(c=>c.x); tickInvaders(s); assert.deepEqual(s.columns.map(c=>c.x),x);
 });
}

for (let effect=0;effect<9;effect++) {
 test(`ENGINE rain effect ${effect}: reached by a real special hit in every stage`, () => {
  for (const stage of STAGES) {
   const s=makeRain(stage,{special:true,effect,energy:11});
   for (let n=0;n<10;n++) tickRain(s);
   assert.equal(s.spawned,10); assert.equal(s.words[9].special,true);
   const result=hitRain(s,s.words[9].word);
   assert.equal(result.effect,effect,`stage ${stage}`); assert.equal(result.points,20);
   assert.equal(s.complete,false); const interval=s.interval, now=1000;
   applyRainEffect(s,result.effect,now);
   if(effect===0) assert.equal(s.interval,Math.max(2,interval-1));
   if(effect===1) assert.equal(s.interval,interval+2);
   if(effect===2) {assert.equal(s.burstRemaining,3); for(let n=0;n<3;n++) tickRain(s); assert.equal(s.spawned,13);}
   if(effect===3) assert.equal(s.concealUntil,now+60*BIOS_TICK_MS);
   if(effect===4) assert.equal(s.pauseUntil,now+160*BIOS_TICK_MS);
   if(effect===5) {
    assert.equal(s.rewinding,true); let polls=0;
    while(s.rewinding) {assert.ok(polls++<100); tickRain(s);}
    assert.equal(s.spawned,0); assert.equal(s.interval,interval);
    tickRain(s); assert.equal(s.words[0].word,'w00'); assert.equal(s.words[0].active,true);
   }
   if(effect===6) assert.equal(s.energy,17);
   if(effect===7) {
    let points=0; while(s.clearing) points+=tickRain(s).points;
    assert.equal(points,9*20); assert.equal(s.firstRemaining,10); assert.equal(s.complete,false);
   }
   if(effect===8) {
    const before=s.words.map(w=>w.y); tickRain(s);
    assert.equal(s.awaitingNext,true); assert.equal(s.complete,false); assert.deepEqual(s.words.map(w=>w.y),before);
   }
  }
 });
 test(`ENGINE invaders effect ${effect}: real motion, ten normal hits, moving bonus, special hit in every stage`, () => {
  for (const stage of STAGES) {
   const s=makeInvaders(stage,{effect}); let polls=0;
   while(s.y===47) {assert.ok(polls++<100); tickInvaders(s);}
   for(let n=0;n<10;n++) {
    // Spread revive-case hits across columns so restoration is observable,
    // without assigning remaining counts or fabricating bonus state.
    const column=s.columns[s.left+n%(s.right-s.left+1)];
    const word=effect===6?column.words[column.count-1]:bottom(s);
    assert.equal(hitInvaders(s,word,1000).effect,null);
   }
   assert.ok(s.bonus,`stage ${stage}`); assert.equal(s.bonus.word,'bonus');
   tickInvaderBonus(s,1000); assert.equal(s.bonus.x,4);
   const result=hitInvaders(s,'bonus',1000); assert.equal(result.effect,effect); assert.equal(result.points,30);
   const interval=s.interval, count=formationCount(s), direction=s.direction, now=1000;
   const previousCounts=s.columns.map(c=>c.count);
   applyInvadersEffect(s,result.effect,now);
   if(effect===0) assert.equal(s.interval,Math.max(3,interval-2));
   if(effect===1) assert.equal(s.interval,interval+2);
   if(effect===2) {assert.equal(s.forcedDown,2); const y=s.y; tickInvaders(s,{forceDown:true}); tickInvaders(s,{forceDown:true}); assert.equal(s.y,y+32); assert.equal(s.direction,direction);}
   if(effect===3) {assert.equal(s.concealed.length,s.right-s.left+1); assert.equal(s.concealUntil,now+120*BIOS_TICK_MS);}
   if(effect===4) assert.equal(s.pauseUntil,now+180*BIOS_TICK_MS);
   if(effect===5) {assert.equal(s.y,47); assert.equal(formationCount(s),count);}
   if(effect===6) {
    // At this genuine right-boundary descent the full right stack exceeds79,
    // so restore damaged active stacks except the overflowing rightmost one.
    assert.ok(s.columns[s.right].x+4>79);
    for(let c=s.left;c<=s.right;c++) assert.equal(s.columns[c].count,c===s.right?previousCounts[c]:10);
    assert.ok(formationCount(s)>count); assert.equal(s.complete,false);
   }
   if(effect===7) {assert.equal(formationCount(s),count-10); assert.equal(s.normalKills,0);}
   if(effect===8) {const x=s.columns.map(c=>c.x); tickInvaders(s); assert.equal(s.awaitingNext,true); assert.equal(s.complete,false); assert.deepEqual(s.columns.map(c=>c.x),x);}
  }
 });
}

test('ENGINE all14 rain quotas can complete from the erase effect, with score but no fabricated correct-input events', () => {
 for(const stage of STAGES) {
  let selectedEffect=0;
  const s=makeRain(stage,{special:true,effect:()=>selectedEffect}); let correct=0, erasedPoints=0;
  // Keep only the final11 naturally spawned words. Earlier specials earn the
  // harmless faster effect. No record geometry/quota is modified.
  for(let n=0;n<rainQuota(stage);n++) {
   tickRain(s);
   if(n<rainQuota(stage)-11) {
    const result=hitRain(s,s.words[n].word); correct++;
    if(result.effect!==null) applyRainEffect(s,result.effect,0);
   }
  }
  const special=s.words.find(w=>w.active&&w.special);
  assert.ok(special); selectedEffect=7; const result=hitRain(s,special.word); correct++;
  assert.equal(result.effect,7); applyRainEffect(s,result.effect,0);
  while(!s.complete) {assert.ok(s.clearing); erasedPoints+=tickRain(s).points;}
  assert.equal(correct,rainQuota(stage)-10); assert.equal(erasedPoints,10*20);
  assert.equal(s.energy,17); assert.equal(s.spawned,rainQuota(stage));
 }
});

const $=selector=>document.querySelector(selector);
function press(target,key,code=key) {
 const event=new document.defaultView.Event('keydown',{bubbles:true,cancelable:true});
 Object.assign(event,{key,code}); target.dispatchEvent(event); return event;
}
function seedFor(effect) {
 for(let seed=0;seed<65536;seed++) if(createOriginalRandom(seed).modulo(19)===effect) return seed;
 throw new Error('No source RNG seed for requested effect');
}
/** Fake elapsed/wall clocks and direct app callbacks are stated simulation
 * boundaries. Production timers still exist, but synchronous driver loops
 * cannot yield to them; app.updateGame executes the real timer body. */
async function withClock(run) {
 const descriptor=Object.getOwnPropertyDescriptor(performance,'now'), RealDate=Date;
 const calendarBase=new RealDate(2026,0,1,0,0,0),baseSeed=browserTimeSeed(calendarBase);
 let now=1000, wall=calendarBase.getTime();
 const seed=value=>{wall=calendarBase.getTime()+((value-baseSeed+65536)%65536)*1000;assert.equal(browserTimeSeed(new Date()),value);};
 Object.defineProperty(performance,'now',{configurable:true,value:()=>now});
 // Production now reads the original local-calendar conversion, not Unix
 // seconds. Fake the calendar input; do not mutate the application's RNG.
 globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[wall]));}static now(){return wall;}};
 seed(0);
 try {await run({advance:(ms=2000)=>{now+=ms;api.updateGame();},seed});}
 finally {
  api.navigate('home'); globalThis.Date=RealDate;
  if(descriptor) Object.defineProperty(performance,'now',descriptor); else delete performance.now;
 }
}
async function chooseFirstStage(kind) {
 api.navigate('home'); api.setLanguage('en','us'); await api.handleMenuAction(kind);
 const selector=$('.original-game-select'); assert.ok(selector);
 press(selector,'Home'); press(selector,'Enter');
 assert.equal(api.getState().gameStage,1); assert.equal(api.getState().gamePhase,'intro');
 $('#game-start').click(); assert.equal(api.getState().gamePhase,'running');
}
async function waitForRanking() {
 // Dynamic extras import is the only asynchronous completion in this replay.
 for(let i=0;i<50&&!$('.extra-game-scores');i++) await new Promise(r=>setTimeout(r,10));
 assert.ok($('.extra-game-scores'),'final completion must render ranking dialog');
}
function assertCounters(expected, context) {
 const s=api.getState();
 assert.equal(s.gameHits,expected.hits,`${context}: cumulative correct`);
 assert.equal(s.gameMisses,expected.misses,`${context}: cumulative wrong`);
 assert.equal(s.gameScore,expected.score,`${context}: cumulative score`);
}

for(const kind of ['rain','invaders']) {
 test(`SIMULATED DOM ${kind}: real quota exhaustion advances all14 stages and saves final ranking exactly once`, {skip: !resourceTests}, async () => withClock(async clock => {
  await chooseFirstStage(kind);
  const beforeRecords=api.getState().gameRecords.length;
  const expected={hits:0,misses:0,score:10}; let totalNormal=0, totalBonus=0, sawRainDamage=false;
  for(const stage of STAGES) {
   const state=api.getGameState(), quota=kind==='rain'?rainQuota(stage):activeColumns(stage)*10;
   assert.equal(api.getState().gameStage,stage); assert.equal(api.getState().gamePhase,'running');
   assert.equal(state.interval,kind==='rain'?19-stage:21-stage);
   if(kind==='rain') {assert.equal(state.lastIndex+1,quota); assert.equal(state.energy,stage===1?17:16);}
   else assert.equal(formationCount(state),quota);
   // 4 first-stage mistakes distinguish the cumulative accuracy calculation
   // from a reset-per-stage counter, then one mistake in each later stage.
   assert.equal(state.pool.includes('?'),false);
   for(let i=0;i<(stage===1?4:1);i++) {api.submitGameWord('?'); expected.misses++;}
   assertCounters(expected,`${kind} ${stage} after wrong inputs`);
   let normal=0, bonus=0, polls=0;
   while(!state.complete) {
    assert.ok(polls++<2000,`${kind} ${stage}: finite replay`);
    clock.advance();
    if(kind==='rain') {
     if(stage===1&&state.energy===16) sawRainDamage=true;
     const words=state.words.filter(w=>w?.active);
     for(const word of words) {
      // Let the genuine first normal word fall once; no energy write is used.
      if(stage===1&&!sawRainDamage&&word.word===state.words[0]?.word) continue;
      const oldStage=api.getState().gameStage;
      api.submitGameWord(word.word); expected.hits++; expected.score+=scoreOf(word.word); normal++;
      if(state.complete&&stage<14) expected.score+=bonusOf(expected.hits,expected.misses);
      assertCounters(expected,`${kind} ${stage} hit ${normal}`);
      if(api.getState().gameStage!==oldStage) break;
     }
    } else {
     if(state.bonus) {
      const word=state.bonus.word;
      api.submitGameWord(word); expected.hits++; expected.score+=scoreOf(word); bonus++;
      assertCounters(expected,`${kind} ${stage} bonus ${bonus}`);
     }
     if(!state.complete) {
      const word=bottom(state);
      api.submitGameWord(word); expected.hits++; expected.score+=scoreOf(word); normal++;
      if(state.complete&&stage<14) expected.score+=bonusOf(expected.hits,expected.misses);
      assertCounters(expected,`${kind} ${stage} hit ${normal}`);
     }
    }
    assert.notEqual(api.getState().gamePhase,'ended',`${kind} ${stage} must clear, not lose`);
   }
   assert.equal(normal,quota-(kind==='rain'&&stage===1?1:0)); totalNormal+=normal; totalBonus+=bonus;
   assert.equal(api.getState().rainLife,kind==='rain'?16:17);
   assert.equal(state.complete,true);
   if(stage<14) {
    assert.equal(api.getState().gameStage,stage+1); assert.equal(api.getState().gamePhase,'intro');
    assert.equal(api.getState().gameActive,false); assert.equal(api.getState().gameRecords.length,beforeRecords);
    assert.equal($('#game-hud').hidden,true); $('#game-start').click();
   }
  }
  assert.equal(totalNormal,kind==='rain'?545:660); if(kind==='rain') assert.equal(sawRainDamage,true);
  assert.equal(expected.hits,totalNormal+totalBonus); assert.equal(expected.misses,17);
  assert.equal(api.getState().mode,'gameScores'); assert.equal(api.getState().gameStage,14); assert.equal(api.getState().gameActive,false);
  await waitForRanking(); assertCounters(expected,`${kind} final`);
  const record=api.getState().gameRecords.find(r=>r.game===kind&&r.stage===14&&r.score===expected.score);
  assert.ok(record,'final ranking must contain exact cumulative result');
  assert.equal(api.getState().gameRecords.length,Math.min(10,beforeRecords+1));
  assert.deepEqual(JSON.parse(saved.get('retro-game-records-v1')),api.getState().gameRecords);
  const records=JSON.stringify(api.getState().gameRecords);
  clock.advance(); api.submitGameWord('ignored'); press($('.extra-game-scores'),'Escape');
  assert.equal(api.getState().gamePhase,'select');
  assert.equal(api.getState().gameStage,10,'returning selector clamps completed14 to exposed10');
  assert.equal(JSON.stringify(api.getState().gameRecords),records,'dismiss/late poll must not insert twice');
 }));
}

for(const kind of ['rain','invaders']) {
 test(`SIMULATED DOM ${kind}: real defeat waits for acknowledgment; Escape while running does not save a ranking`, {skip: !resourceTests}, async () => withClock(async clock => {
  await chooseFirstStage(kind); const before=api.getState().gameRecords.length;
  let polls=0;
  while(api.getState().gamePhase==='running') {assert.ok(polls++<2000); clock.advance();}
  assert.equal(api.getState().gamePhase,'ended'); assert.equal(api.getState().gameStage,1);
  assert.equal(api.getState().gameRecords.length,before); assert.equal(api.getState().gameHits,0); assert.equal(api.getState().gameMisses,0); assert.equal(api.getState().gameScore,10);
  assert.equal($('#game-start').textContent,'놀이가 끝났습니다.');
  assert.equal($('#game-input').readOnly,true);
  press($('#game-input'),' ','Space'); await waitForRanking();
  assert.equal(api.getState().gameRecords.length,Math.min(10,before+1));
  press($('.extra-game-scores'),'Escape');
  await chooseFirstStage(kind); const records=JSON.stringify(api.getState().gameRecords);
  press($('#game-input'),'Escape');
  assert.equal(api.getState().gamePhase,'select'); assert.equal(api.getState().mode,'play');
  assert.equal($('.extra-game-scores'),null); assert.equal(JSON.stringify(api.getState().gameRecords),records);
 }));
 test(`SIMULATED DOM ${kind}: naturally earned next-stage effect waits for key and preserves cumulative counters`, {skip: !resourceTests}, async () => withClock(async clock => {
  await chooseFirstStage(kind); let polls=0, earned=false;
  // A formation must first descend. Killing early columns immediately can
  // legitimately clear stage1 before its first descent, with no bonus at all.
  if(kind==='invaders') while(api.getGameState().y===47) {assert.ok(polls++<100);clock.advance();}
  while(!earned) {
   assert.ok(polls++<1000); clock.advance(); const s=api.getGameState();
   assert.equal(api.getState().gameStage,1);
   if(kind==='rain') {
    for(const word of s.words.filter(w=>w?.active)) {
     if(word.special) {clock.seed(seedFor(8)); api.submitGameWord(word.word); earned=true; break;}
     api.submitGameWord(word.word);
    }
   } else {
    if(s.bonus) {clock.seed(seedFor(8)); api.submitGameWord(s.bonus.word); earned=true;}
    else api.submitGameWord(bottom(s));
   }
  }
  const state=api.getGameState(), before=api.getState(); assert.equal(state.awaitingNext,true); assert.equal(state.complete,false);
  clock.advance(); assert.equal(api.getState().gameStage,1); assert.equal(api.getState().gameScore,before.gameScore);
  press($('#game-input'),'x','KeyX');
  const after=api.getState(); assert.equal(after.gameStage,2); assert.equal(after.gamePhase,'intro');
  assert.equal(after.gameHits,before.gameHits); assert.equal(after.gameMisses,before.gameMisses);
  assert.equal(after.gameScore,before.gameScore+bonusOf(before.gameHits,before.gameMisses));
  assert.equal($('#game-input').value,''); assert.equal(after.gameRecords.length,before.gameRecords.length);
 }));
}
