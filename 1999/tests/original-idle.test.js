import test from 'node:test';import assert from 'node:assert/strict';
import {createOriginalIdle,touchOriginalIdle,originalIdleExpired} from '../original-idle.js';
const t=Date.UTC(2026,0,1,0,10,0);
test('key-style idle starts at entry and uses strict whole-second60 threshold',()=>{const s=createOriginalIdle({now:t});assert.equal(originalIdleExpired(s,t+60999),false);assert.equal(originalIdleExpired(s,t+61000),true);});
test('text first-key waiting has no idle deadline until a key arrives',()=>{const s=createOriginalIdle({started:false,now:t});assert.equal(originalIdleExpired(s,t+120000),false);touchOriginalIdle(s,t+120000);assert.equal(originalIdleExpired(s,t+180000),false);assert.equal(originalIdleExpired(s,t+181000),true);});
test('every accepted poll refreshes idle independently of correctness',()=>{const s=createOriginalIdle({now:t});touchOriginalIdle(s,t+59000);assert.equal(originalIdleExpired(s,t+119999),false);assert.equal(originalIdleExpired(s,t+120000),true);});
test('native minute-second clock retains documented hour-wrap behavior',()=>{const s=createOriginalIdle({now:Date.UTC(2026,0,1,0,59,30)});assert.equal(originalIdleExpired(s,Date.UTC(2026,0,1,1,1,0)),false);});
