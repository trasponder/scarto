import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CONFIG, createGame, step, advance, startDash, swapEcho, blankInput, cleanInput, botInput} from '../core/engine.mjs';
const idle=()=>[blankInput(),blankInput()];
const live=()=>createGame({countdown:false});
test('movement uses fixed 60 Hz; diagonals do not move faster',()=>{
  const a=live(),b=live();advance(a,[{...blankInput(),x:1},blankInput()],30);advance(b,[{...blankInput(),x:1,y:1},blankInput()],30);
  assert.ok(Math.abs(a.players[0].x-370-112)<.0001);assert.ok(Math.abs(Math.hypot(b.players[0].x-370,b.players[0].y-330)-112)<.0001);
});
test('countdown consumes actions and prevents queued attacks',()=>{
  const s=createGame(),i=[{...blankInput(),dash:1},blankInput()];advance(s,i,151);assert.equal(s.phase,'playing');assert.equal(s.echoes.length,0);
});
test('dash covers 220 units and creates one echo at the origin',()=>{
  const s=live();assert.equal(startDash(s,0),true);assert.equal(s.echoes.length,1);assert.equal(s.echoes[0].x,370);advance(s,idle(),12);assert.ok(Math.abs(s.players[0].x-590)<.001);assert.equal(s.players[0].dashLeft,0);
});
test('echo starts exactly 120 ticks / 2 seconds after creation',()=>{
  const s=live();startDash(s,0);advance(s,idle(),119);assert.equal(s.echoes[0].active,false);assert.equal(s.echoes[0].x,370);step(s,idle());assert.equal(s.echoes[0].active,true);assert.ok(s.echoes[0].x>370);assert.equal(s.events.find(e=>e.type==='echo').tick,120);
});
test('swap exchanges both positions and preserves direction, clock and cooldown',()=>{
  const s=live();startDash(s,0);advance(s,idle(),30);const e=s.echoes[0],x=s.players[0].x,at=e.fireAt,cd=s.players[0].cooldown;
  assert.equal(swapEcho(s,0),true);assert.equal(s.players[0].x,370);assert.equal(e.x,x);assert.equal(e.fireAt,at);assert.equal(e.dx,1);assert.equal(s.players[0].cooldown,cd);assert.equal(swapEcho(s,0),false);
  advance(s,idle(),90);assert.equal(e.active,true);assert.ok(e.x>x);
});
test('swap is unavailable once the echo has fired',()=>{const s=live();startDash(s,0);advance(s,idle(),120);assert.equal(swapEcho(s,0),false);});
test('dash cooldown is exactly 3 seconds',()=>{const s=live();startDash(s,0);advance(s,idle(),179);assert.equal(startDash(s,0),false);step(s,idle());assert.equal(startDash(s,0),true);});
test('fast dash hits without tunnelling and cannot hit twice',()=>{
  const s=live();s.players[1].x=480;startDash(s,0);advance(s,idle(),30);assert.equal(s.events.filter(e=>e.type==='hit'&&!e.echo).length,1);assert.ok(s.players[1].x>550);assert.ok(s.players[0].x<s.players[1].x);
});
test('simultaneous dashes clash symmetrically',()=>{
  const s=live();s.players[0].x=480;s.players[1].x=640;startDash(s,0);startDash(s,1);advance(s,idle(),20);
  assert.equal(s.events.filter(e=>e.type==='clash').length,1);assert.ok(Math.abs(s.players[0].x+s.players[1].x-1120)<.001);
});
test('echo can hit a rival independently of its owner',()=>{
  const s=live();s.players[1].y=440;startDash(s,0);advance(s,idle(),110);s.players[1].x=440;s.players[1].y=330;advance(s,idle(),25);assert.ok(s.events.some(e=>e.type==='hit'&&e.echo));
});
test('a ring-out scores once, resets temporary states, and starts the next round',()=>{
  const s=live();startDash(s,0);s.players[1].x=1100;step(s,idle());assert.deepEqual(s.score,[1,0]);assert.equal(s.phase,'roundEnd');assert.equal(s.echoes.length,0);advance(s,idle(),110);assert.equal(s.phase,'countdown');assert.equal(s.players[0].cooldown,0);assert.equal(s.round,2);assert.deepEqual(s.score,[1,0]);
});
test('simultaneous ring-outs award no points',()=>{const s=live();s.players[0].x=20;s.players[1].x=1100;step(s,idle());assert.deepEqual(s.score,[0,0]);assert.equal(s.doubleOut,true);});
test('first to five wins and finished games never score again',()=>{const s=live();s.score[0]=4;s.players[1].x=1100;step(s,idle());assert.equal(s.phase,'finished');assert.equal(s.winner,0);advance(s,idle(),600);assert.deepEqual(s.score,[5,0]);});
test('replayed input counters cannot create duplicate attacks or swaps',()=>{const s=live(),i=[{...blankInput(),dash:1,swap:1},blankInput()];advance(s,i,450);assert.equal(s.events.filter(e=>e.type==='dash').length,1);assert.equal(s.events.filter(e=>e.type==='swap').length,1);});
test('untrusted input is bounded and non-finite values are rejected',()=>{const i=cleanInput({x:999,y:NaN,aimX:Infinity,dash:-7,swap:3.8});assert.equal(i.x,1);assert.equal(i.y,0);assert.equal(i.aimX,1);assert.equal(i.dash,0);assert.equal(i.swap,3);});
test('deterministic simulation produces identical state for identical inputs',()=>{const a=live(),b=live();let i=idle();for(let t=0;t<5000;t++){if(t%7===0)i=[botInput(a,0,i[0]),botInput(a,1,i[1])];step(a,i);step(b,i);}assert.deepEqual(a,b);});
test('the bot can win a complete match against a stationary opponent',()=>{
  const s=createGame();let i=idle();for(let t=0;t<40000&&s.phase!=='finished';t++){if(t%7===0)i[1]=botInput(s,1,i[1]);step(s,i);for(const p of s.players)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));}
  assert.equal(s.phase,'finished');assert.equal(Math.max(...s.score),5);
});
