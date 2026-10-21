import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AI_LEVELS,CONFIG,createGame,step,botInput,blankInput} from '../core/engine.mjs';

test('lower difficulties have less accurate aim against the same target',()=>{
  const s=createGame({countdown:false});s.tick=49;
  const errors=['easy','normal','hard'].map(level=>{
    const i=botInput(s,1,blankInput(),level);
    return Math.abs(Math.atan2(i.aimY,-i.aimX));
  });
  assert.ok(errors[0]>errors[1]);assert.ok(errors[1]>errors[2]);assert.equal(errors[2],0);
});

test('difficulty changes decision-making without modifying either player or physics',()=>{
  const s=createGame({countdown:false}),before=structuredClone(s),physics=JSON.stringify(CONFIG);
  for(const key of Object.keys(AI_LEVELS)){
    const i=botInput(s,1,blankInput(),key);
    assert.ok(Number.isFinite(i.x)&&Number.isFinite(i.y));assert.ok(Math.hypot(i.x,i.y)<=1.000001);
    assert.ok(Math.abs(Math.hypot(i.aimX,i.aimY)-1)<.000001);
  }
  assert.deepEqual(s,before);assert.equal(JSON.stringify(CONFIG),physics);
});

test('an unknown saved difficulty safely uses normal decisions',()=>{
  const s=createGame({countdown:false});s.tick=49;
  assert.deepEqual(botInput(s,1,blankInput(),'unknown'),botInput(s,1,blankInput(),'normal'));
});

const results={};
for(const [key,level] of Object.entries(AI_LEVELS))test(`${level.label}: completes a full match with its actual reaction interval`,()=>{
  const s=createGame();const inputs=[blankInput(),blankInput()];let ticks=0;
  for(;ticks<60000&&s.phase!=='finished';ticks++){
    if(s.tick%level.reactionTicks===0)inputs[1]=botInput(s,1,inputs[1],key);
    step(s,inputs);
    for(const p of s.players)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
  }
  assert.equal(s.phase,'finished');assert.deepEqual(s.score,[0,5]);results[key]=ticks;
});

test('easier levels give a stationary player more time before elimination',()=>{
  assert.ok(results.easy>results.normal);assert.ok(results.normal>results.hard);
});
