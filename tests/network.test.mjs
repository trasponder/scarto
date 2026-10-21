import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {createRequire} from 'node:module';
const {WebSocket}=createRequire(new URL('../standalone/server.mjs',import.meta.url))('ws');
import {createScartoServer} from '../standalone/server.mjs';
import {blankInput} from '../core/engine.mjs';
async function waitFor(predicate,timeout=5000){const until=Date.now()+timeout;while(Date.now()<until){if(predicate())return;await delay(12);}throw new Error('Network assertion timed out');}
test('two real WebSocket clients: echo, swap, same snapshots, five rounds and rematch', {timeout:45000},async t=>{
  const app=createScartoServer({port:0,host:'127.0.0.1'}),address=await app.listen();t.after(()=>app.close());
  const origin=`http://127.0.0.1:${address.port}`;
  const post=async data=>{const r=await fetch(origin+'/api/room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:r.status,data:await r.json()};};
  const {data:host}=await post({action:'create'}),{data:guest}=await post({action:'join',code:host.code});
  assert.equal(host.seat,0);assert.equal(guest.seat,1);
  assert.equal((await post({action:'join',code:host.code})).status,409);
  assert.equal((await post({action:'sync',code:host.code,token:'wrong'})).status,403);
  const sessions=[host,guest],sockets=[],latest=[null,null],snapshots=[new Map(),new Map()],inputs=[blankInput(),blankInput()],seq=[0,0];
  for(let id=0;id<2;id++){
    const ws=new WebSocket(origin.replace('http','ws')+'/ws');sockets.push(ws);
    ws.on('message',raw=>{const s=JSON.parse(String(raw));if(s.state){latest[id]=s;snapshots[id].set(s.revision,JSON.stringify(s.state));}});
    await new Promise((done,reject)=>{ws.once('open',done);ws.once('error',reject);});
    ws.send(JSON.stringify({action:'subscribe',code:host.code,token:sessions[id].token}));
  }
  const timer=setInterval(()=>sockets.forEach((ws,id)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({action:'sync',input:inputs[id],seq:++seq[id]}));}),45);t.after(()=>clearInterval(timer));
  await waitFor(()=>latest.every(s=>s?.state.phase==='playing'));
  inputs[0].dash=1;
  await waitFor(()=>latest[0]?.state.echoes.length===1);
  const before=latest[0].state,fireAt=before.echoes[0].fireAt,cooldown=before.players[0].cooldown;
  inputs[0].swap=1;
  await waitFor(()=>latest.every(s=>s?.state.echoes[0]?.swapped));
  assert.equal(latest[0].state.echoes[0].fireAt,fireAt);assert.ok(latest[0].state.players[0].cooldown<=cooldown);
  await waitFor(()=>latest[0].state.events.some(e=>e.type==='echo'));
  const event=latest[0].state.events.find(e=>e.type==='echo');assert.equal(event.tick,fireAt);
  inputs[0].x=-1;
  await waitFor(()=>latest.every(s=>s?.state.phase==='finished'),33000);
  assert.deepEqual(latest[0].state.score,[0,5]);assert.deepEqual(latest[1].state.score,[0,5]);
  const common=[...snapshots[0].keys()].filter(k=>snapshots[1].has(k));assert.ok(common.length>50);
  for(const k of common)assert.equal(snapshots[0].get(k),snapshots[1].get(k));
  inputs[0].x=0;
  for(const ws of sockets)ws.send(JSON.stringify({action:'rematch'}));
  await waitFor(()=>latest.every(s=>s?.state.phase==='countdown'&&s.state.score.every(v=>v===0)));
  sockets[0].send(JSON.stringify({action:'leave'}));
  await waitFor(()=>latest.every(s=>s?.status==='closed'));
  console.log(`Verified ${common.length} identical snapshots across two independent WebSocket clients.`);
});
