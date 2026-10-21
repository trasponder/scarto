// Run against a reachable Worker/D1 or standalone Node server.
import assert from 'node:assert/strict';
import {blankInput} from '../core/engine.mjs';
const base=process.env.SCARTO_TEST_URL||'http://127.0.0.1:4173';
const request=async body=>{const r=await fetch(base+'/api/room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
const host=(await request({action:'create'})).data;assert.ok(host.token);assert.match(host.code,/^[A-Z2-9]{6}$/);
const join=await Promise.all([request({action:'join',code:host.code}),request({action:'join',code:host.code})]);
assert.deepEqual(join.map(j=>j.status).sort(),[200,409]);const guest=join.find(j=>j.status===200).data;
assert.equal((await request({action:'sync',code:host.code,token:'wrong'})).status,403);
assert.equal((await request(null)).status,400);
let revisions=[];
for(let seq=0;seq<12;seq++){
  const pair=await Promise.all([host,guest].map(s=>request({action:'sync',code:host.code,token:s.token,seq,input:blankInput()})));
  for(const r of pair){assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.tokens,undefined);revisions.push(r.data.revision);}
}
assert.equal(new Set(revisions).size,24,'all concurrent writes have unique committed revisions');
const closed=await request({action:'leave',code:host.code,token:host.token});assert.equal(closed.data.status,'closed');
const other=await request({action:'sync',code:host.code,token:guest.token});assert.equal(other.data.status,'closed');
console.log(`HTTP integration passed: room ${host.code}, concurrent joins, 24 concurrent committed revisions, token security, closed-room propagation.`);
