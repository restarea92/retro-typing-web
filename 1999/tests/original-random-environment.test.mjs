import test from'node:test';import assert from'node:assert/strict';import{createHash}from'node:crypto';
import{createOriginalRandom,createOriginalAppRandom,originalQaSeed}from'../original-random.js';
import{createRainStage,createInvadersStage,hitRain,hitInvaders,tickRain}from'../game-engine.js';
test('every16-bit seed first output/state matches unchanged original-machine-code digest',()=>{
 const h=createHash('sha256'),b=Buffer.alloc(6);for(let seed=0;seed<65536;seed++){const r=createOriginalRandom(seed);b.writeUInt16LE(r.nextInt(),0);b.writeUInt32LE(r.state,2);h.update(b);}assert.equal(h.digest('hex'),'9cf42700bad04d59f3e4a368b13f6e931330b1ef3307ec4621eeb5f6ab78346e');
});
test('six10000-output/state streams match original-machine-code digests',()=>{
 for(const[seed,expected]of[[0,'0300251da14950ac83806e67a9ecaaf6f65a2277993b1f43552788f79de0885e'],[1,'1830a1552ed6bd0d4d96b6194f03dce962a07351ace0097806bb036eec628e0b'],[42,'59d331c256fbdc529c2cb753b7c9960a35f3b6c294144107d5856733ce11759b'],[12345,'27608a52ca6e2430fc89c5cb8c9771de9c7bd53245aba4ecf11e29313674673b'],[32768,'f5ed90e1e36191f5200bd40b115f20aee1ca329fab5525b0358f48def373f5fd'],[65535,'a275bf01df801f1cacaac01aba527c9c60ad50d746a6109c4a09dcdb4b0ca2da']]){
  const r=createOriginalRandom(seed),h=createHash('sha256'),b=Buffer.alloc(6);for(let i=0;i<10000;i++){b.writeUInt16LE(r.nextInt(),0);b.writeUInt32LE(r.state,2);h.update(b);}assert.equal(h.digest('hex'),expected);
 }
});
test('QA fixed seed requires explicit unambiguous opt-in and canonical16-bit decimal',()=>{
 for(const seed of[0,1,42,65535])assert.equal(originalQaSeed('?qa=1&qaRngSeed='+seed),seed);
 for(const query of['','?qaRngSeed=42','?qa=0&qaRngSeed=42','?qa=1','?qa=1&qa=1&qaRngSeed=42','?qa=1&qaRngSeed=42&qaRngSeed=42',...['','65536','-1','+1','0x1','1.0','1e2','NaN','Infinity','01',' 1'].map(s=>'?qa=1&qaRngSeed='+encodeURIComponent(s))])assert.equal(originalQaSeed(query),null,query);
});
test('production and invalid QA URLs keep fresh time reseeds, not a fixed seed',()=>{
 let clock=10;for(const search of['','?qa=1','?qaRngSeed=42','?qa=1&qaRngSeed=65536']){const r=createOriginalAppRandom(search,{timeSeed:()=>clock++});assert.equal(r.state,1);assert.equal(r.configuration.mode,'original-dos-time');r.reseedFromTime();const a=r.state;r.reseedFromTime();assert.equal(r.state,a+1);}
});
test('QA fixes only reseeds; launch state and pre-reseed stream remain1',()=>{
 const r=createOriginalAppRandom('?qa=1&qaRngSeed=42',{timeSeed:()=>{throw Error('QA must not read clock');}});assert.equal(r.state,1);assert.equal(r.nextInt(),346);r.reseedFromTime();assert.equal(r.state,42);assert.equal(r.nextInt(),createOriginalRandom(42).nextInt());r.reseedFromTime();assert.equal(r.state,42);assert.equal(r.configuration.timingSynchronized,false);assert.ok(Object.isFrozen(r.configuration));
});
test('game initializers consume60 normal then10English/5CJK dictionary draws after one reseed',()=>{
 for(const factory of[createRainStage,createInvadersStage])for(const[language,count]of[['en',70],['ko',65],['ja',65]]){let reseeds=0;const r=createOriginalRandom(1,{timeSeed:()=>{reseeds++;return 42;}}),stage=factory(1,['a','bb','ccc'],{random:r,language}),expected=createOriginalRandom(42);const words=Array.from({length:count},()=>['a','bb','ccc'][expected.modulo(3)]);assert.equal(reseeds,1);assert.deepEqual(stage.selectedWords,words.slice(0,60));assert.deepEqual(stage.bonusWords.slice(0,count-60),words.slice(60));assert.equal(r.state,expected.state);}
});
test('special hits reseed once then consume modulo19; misses/normal/lastRain hit do not',()=>{
 let reseeds=0;const r=createOriginalRandom(1,{timeSeed:()=>{reseeds++;return 42;}}),rain=createRainStage(1,['a'],{random:r,language:'en'});assert.equal(reseeds,1);assert.equal(hitRain(rain,'miss').matched,false);assert.equal(reseeds,1);
 // Authored engine-unit fixtures, not actual-play completion evidence.
 rain.words=[{word:'a',active:true,special:true,nativeState:2}];rain.spawned=1;hitRain(rain,'a');assert.equal(reseeds,2);const expected=createOriginalRandom(42);expected.modulo(19);assert.equal(r.state,expected.state);
 rain.words=[{word:'a',active:true,special:true,nativeState:2}];rain.firstRemaining=0;rain.lastIndex=0;hitRain(rain,'a');assert.equal(reseeds,2);
 const inv=createInvadersStage(1,['a'],{random:r,language:'en'});inv.bonus={word:'a'};hitInvaders(inv,'a');assert.equal(reseeds,4);assert.equal(r.state,expected.state);
});
