import test from 'node:test';import assert from 'node:assert/strict';import {hitScore,stageBonus,energyAfter,INITIAL_SCORE} from '../game-rules.js';
test('originalscoreformat and8px columnwordlength',()=>{assert.equal(INITIAL_SCORE,10);assert.equal(hitScore('가나다'),40);assert.equal(hitScore('abc'),20);assert.equal(hitScore('가a'),20)});
test('stagebonus threshold usesfloor accuracy90',()=>{assert.equal(stageBonus(9,1),1000);assert.equal(stageBonus(8,1),500);assert.equal(stageBonus(0,0),500)});
test('energy clamps17,damage1',()=>{assert.equal(energyAfter(17,1),17);assert.equal(energyAfter(1,-1),0);assert.equal(energyAfter(0,-1),0)});
