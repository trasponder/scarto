// One deterministic simulation, shared by the server, the local game and tests.
export const CONFIG = Object.freeze({
  width: 1120, height: 660,
  arena: { left: 80, right: 1040, top: 80, bottom: 580 },
  radius: 18, speed: 224, dashSpeed: 1100, dashTicks: 12,
  dashCooldown: 180, echoDelay: 120, knockback: 990, drag: 5.6,
  stunTicks: 13, tickRate: 60, scoreToWin: 5,
  countdownTicks: 150, intermissionTicks: 110,
});
export const DT = 1 / CONFIG.tickRate;
export const COLORS = ['#64e8ee', '#ff807b'];
const norm = (x, y) => { const n = Math.hypot(x, y); return n > 0.0001 ? { x: x / n, y: y / n } : { x: 1, y: 0 }; };
export const blankInput = () => ({ x: 0, y: 0, aimX: 1, aimY: 0, dash: 0, swap: 0 });
function player(id) {
  return { id, x: id ? 750 : 370, y: 330, vx: 0, vy: 0, aimX: id ? -1 : 1, aimY: 0,
    cooldown: 0, dashLeft: 0, dashX: 0, dashY: 0, hit: false, stun: 0,
    usedDash: 0, usedSwap: 0, trail: [] };
}
export function createGame({ countdown = true } = {}) {
  return { tick: 0, phase: countdown ? 'countdown' : 'playing', phaseUntil: countdown ? CONFIG.countdownTicks : 0,
    round: 1, score: [0, 0], winner: null, roundWinner: null, doubleOut: false,
    players: [player(0), player(1)], echoes: [], events: [], eventId: 0, elapsed: 0 };
}
function event(s, type, data = {}) {
  s.events.push({ id: ++s.eventId, tick: s.tick, type, ...data });
  if (s.events.length > 20) s.events.shift();
}
export function cleanInput(input = {}) {
  if (!input || typeof input !== 'object') input = {};
  const number = (v, min, max, def = 0) => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : def;
  return { x: number(input.x, -1, 1), y: number(input.y, -1, 1),
    aimX: number(input.aimX, -1, 1, 1), aimY: number(input.aimY, -1, 1),
    dash: Math.floor(number(input.dash, 0, 1e9)), swap: Math.floor(number(input.swap, 0, 1e9)) };
}
export function isOutside(p) {
  const a = CONFIG.arena;
  return p.x < a.left - CONFIG.radius || p.x > a.right + CONFIG.radius || p.y < a.top - CONFIG.radius || p.y > a.bottom + CONFIG.radius;
}
export function edgeDistance(p) {
  const a = CONFIG.arena;
  return Math.min(p.x - a.left, a.right - p.x, p.y - a.top, a.bottom - p.y);
}
export function startDash(s, id) {
  const p = s.players[id];
  if (s.phase !== 'playing' || p.cooldown > 0 || p.stun > 0 || p.dashLeft > 0) return false;
  const dir = norm(p.aimX, p.aimY);
  p.dashX = dir.x; p.dashY = dir.y; p.dashLeft = CONFIG.dashTicks;
  p.cooldown = CONFIG.dashCooldown; p.hit = false; p.vx = 0; p.vy = 0;
  const eco = { id: `${id}-${s.tick}`, owner: id, x: p.x, y: p.y, dx: dir.x, dy: dir.y,
    born: s.tick, fireAt: s.tick + CONFIG.echoDelay, swapped: false, active: false, left: CONFIG.dashTicks, hit: false };
  s.echoes.push(eco);
  event(s, 'dash', { owner: id, x: p.x, y: p.y });
  return true;
}
export function swapEcho(s, id) {
  const e = s.echoes.find(e => e.owner === id && !e.active && !e.swapped && s.tick < e.fireAt);
  if (!e || s.phase !== 'playing') return false;
  const p = s.players[id], x = p.x, y = p.y;
  p.x = e.x; p.y = e.y; e.x = x; e.y = y; e.swapped = true;
  p.vx = p.vy = 0; p.dashLeft = 0; p.stun = 0; p.trail = [];
  event(s, 'swap', { owner: id, x: p.x, y: p.y, fromX: x, fromY: y });
  return true;
}
function resetPlayers(s, inputs) {
  s.players = [player(0), player(1)]; s.echoes = [];
  for (let id = 0; id < 2; id++) {
    s.players[id].usedDash = inputs[id]?.dash ?? 0;
    s.players[id].usedSwap = inputs[id]?.swap ?? 0;
  }
}
function strike(s, target, dx, dy, owner, echo = false) {
  target.vx = dx * CONFIG.knockback; target.vy = dy * CONFIG.knockback;
  target.stun = CONFIG.stunTicks; target.dashLeft = 0;
  event(s, 'hit', { owner, target: target.id, x: target.x, y: target.y, echo });
}
function collisions(s) {
  const [a, b] = s.players, dx = b.x - a.x, dy = b.y - a.y;
  const dist = Math.hypot(dx, dy), touch = CONFIG.radius * 2;
  if (dist < touch) {
    const n = norm(dx, dy), ad = a.dashLeft > 0 && !a.hit, bd = b.dashLeft > 0 && !b.hit;
    if (ad && bd) {
      a.hit = b.hit = true; a.dashLeft = b.dashLeft = 0;
      a.vx = -n.x * 520; a.vy = -n.y * 520; b.vx = n.x * 520; b.vy = n.y * 520;
      a.stun = b.stun = 10;
      event(s, 'clash', { x: (a.x+b.x)/2, y: (a.y+b.y)/2 });
    } else if (ad) {
      a.hit = true; strike(s, b, a.dashX, a.dashY, 0); a.dashLeft = 0;
      a.vx = -a.dashX * 115; a.vy = -a.dashY * 115;
    } else if (bd) {
      b.hit = true; strike(s, a, b.dashX, b.dashY, 1); b.dashLeft = 0;
      b.vx = -b.dashX * 115; b.vy = -b.dashY * 115;
    }
    const overlap = (touch - dist) * .5 + .02;
    a.x -= n.x * overlap; a.y -= n.y * overlap; b.x += n.x * overlap; b.y += n.y * overlap;
  }
  for (const e of s.echoes) {
    if (!e.active || e.hit) continue;
    const target = s.players[1 - e.owner];
    if (Math.hypot(e.x - target.x, e.y - target.y) < touch) {
      e.hit = true; strike(s, target, e.dx, e.dy, e.owner, true);
    }
  }
}
export function step(s, rawInputs = [blankInput(), blankInput()]) {
  const inputs = rawInputs.map(cleanInput);
  s.tick++;
  if (s.phase === 'finished') return s;
  if (s.phase === 'roundEnd') {
    if (s.tick >= s.phaseUntil) {
      s.round++; resetPlayers(s, inputs); s.phase = 'countdown'; s.phaseUntil = s.tick + 90;
    }
    return s;
  }
  if (s.phase === 'countdown') {
    // Inputs pressed during the countdown never fire at its end.
    for (let i = 0; i < 2; i++) { s.players[i].usedDash = inputs[i].dash; s.players[i].usedSwap = inputs[i].swap; }
    if (s.tick >= s.phaseUntil) { s.phase = 'playing'; event(s, 'go'); }
    return s;
  }
  s.elapsed++;
  for (const e of s.echoes) {
    if (!e.active && s.tick >= e.fireAt) { e.active = true; event(s, 'echo', { owner: e.owner, x: e.x, y: e.y }); }
  }
  for (let id = 0; id < 2; id++) {
    const p = s.players[id], input = inputs[id];
    if (p.cooldown > 0) p.cooldown--;
    if (p.stun > 0) p.stun--;
    const aim = norm(input.aimX, input.aimY); p.aimX = aim.x; p.aimY = aim.y;
    if (input.dash > p.usedDash) { p.usedDash = input.dash; startDash(s, id); }
    if (input.swap > p.usedSwap) { p.usedSwap = input.swap; swapEcho(s, id); }
    if (s.tick % 2 === 0) {
      p.trail.push({ x: p.x, y: p.y, dash: p.dashLeft > 0 });
      if (p.trail.length > 7) p.trail.shift();
    }
  }
  // Substeps keep fast dashes from tunnelling through a player.
  for (let sub = 0; sub < 2; sub++) {
    for (let id = 0; id < 2; id++) {
      const p = s.players[id], i = inputs[id], dt = DT / 2;
      if (p.dashLeft > 0) { p.x += p.dashX * CONFIG.dashSpeed * dt; p.y += p.dashY * CONFIG.dashSpeed * dt; }
      else {
        const len = Math.hypot(i.x, i.y), f = len > 1 ? 1 / len : 1;
        const control = p.stun ? .18 : 1;
        p.x += (i.x * f * CONFIG.speed * control + p.vx) * dt;
        p.y += (i.y * f * CONFIG.speed * control + p.vy) * dt;
      }
      p.vx *= Math.exp(-CONFIG.drag * dt); p.vy *= Math.exp(-CONFIG.drag * dt);
    }
    for (const e of s.echoes) if (e.active) { e.x += e.dx * CONFIG.dashSpeed * DT / 2; e.y += e.dy * CONFIG.dashSpeed * DT / 2; }
    collisions(s);
    const out = s.players.map(isOutside);
    if (out[0] || out[1]) {
      s.echoes = [];
      s.doubleOut = out[0] && out[1];
      s.roundWinner = s.doubleOut ? null : out[0] ? 1 : 0;
      if (s.roundWinner !== null) s.score[s.roundWinner]++;
      event(s, 'out', { loser: out[0] ? 0 : 1, double: s.doubleOut, x: s.players[out[0] ? 0 : 1].x, y: s.players[out[0] ? 0 : 1].y });
      if (s.score.some(v => v >= CONFIG.scoreToWin)) {
        s.winner = s.score[0] >= CONFIG.scoreToWin ? 0 : 1; s.phase = 'finished'; event(s, 'win', { owner: s.winner });
      } else { s.phase = 'roundEnd'; s.phaseUntil = s.tick + CONFIG.intermissionTicks; }
      break;
    }
  }
  for (const p of s.players) if (p.dashLeft > 0) p.dashLeft--;
  for (const e of s.echoes) if (e.active) e.left--;
  s.echoes = s.echoes.filter(e => !e.active || e.left > 0);
  return s;
}
export function advance(s, inputs, ticks) { for (let i = 0; i < ticks; i++) step(s, inputs); return s; }

// Difficulty changes decisions, never movement speed, cooldowns or impact force.
export const AI_LEVELS = Object.freeze({
  easy: Object.freeze({label:'Facile',description:'Più tempo per preparare la tua mossa.',reactionTicks:24,aimError:.22,prediction:0,echoLookahead:18,dodgeStrength:1,dashDodge:.5,attackRange:200,openingPeriod:67,openingWindow:11,escapeEdge:45,swapWindow:14,swapRange:95}),
  normal: Object.freeze({label:'Normale',description:'Un rivale attento, con margine per reagire.',reactionTicks:14,aimError:.08,prediction:.02,echoLookahead:30,dodgeStrength:1.7,dashDodge:1,attackRange:225,openingPeriod:53,openingWindow:13,escapeEdge:60,swapWindow:22,swapRange:115}),
  hard: Object.freeze({label:'Difficile',description:'Il tempismo della sfida originale.',reactionTicks:7,aimError:0,prediction:.04,echoLookahead:43,dodgeStrength:2.4,dashDodge:1.6,attackRange:245,openingPeriod:41,openingWindow:13,escapeEdge:70,swapWindow:30,swapRange:130}),
});
// A bounded-reaction bot: positioning, visible-echo avoidance, aiming and swaps.
export function botInput(s, id, previous = blankInput(), difficulty = 'hard') {
  const level = Object.hasOwn(AI_LEVELS,difficulty) ? AI_LEVELS[difficulty] : AI_LEVELS.normal;
  const p = s.players[id], o = s.players[1-id], a = CONFIG.arena;
  const dx = o.x-p.x, dy = o.y-p.y, d = Math.hypot(dx,dy), toward = norm(dx,dy);
  const pressure = norm(o.x-560, o.y-330);
  const target = { x: o.x-pressure.x*142, y: o.y-pressure.y*142 };
  let mx = (target.x-p.x)/130, my = (target.y-p.y)/130;
  if (d < 95 && p.cooldown > 0) { mx -= toward.x*2; my -= toward.y*2; }
  const phase = Math.sin(s.tick*.013+id*3);
  mx += -toward.y * phase*.38; my += toward.x*phase*.38;
  for (const e of s.echoes) {
    if (e.owner === id || e.active) continue;
    const along = (p.x-e.x)*e.dx+(p.y-e.y)*e.dy;
    const side = (p.x-e.x)*-e.dy+(p.y-e.y)*e.dx;
    if (e.fireAt-s.tick < level.echoLookahead && along > -25 && along < 260 && Math.abs(side) < 72) {
      const sign = side >= 0 ? 1 : -1; mx += -e.dy*sign*level.dodgeStrength; my += e.dx*sign*level.dodgeStrength;
    }
  }
  if (o.dashLeft && d < 250) { mx -= toward.y*level.dashDodge; my += toward.x*level.dashDodge; }
  if (p.x < a.left+115) mx += 2.5; if (p.x > a.right-115) mx -= 2.5;
  if (p.y < a.top+100) my += 2.5; if (p.y > a.bottom-100) my -= 2.5;
  let aim = norm(dx + o.vx*level.prediction, dy + o.vy*level.prediction);
  if (level.aimError) {
    const angle=Math.atan2(aim.y,aim.x)+Math.sin(s.tick*.031+id*1.9)*level.aimError;
    aim={x:Math.cos(angle),y:Math.sin(angle)};
  }
  const dashEnd = { x: p.x+aim.x*230, y: p.y+aim.y*230 };
  let dash = previous.dash, swap = previous.swap;
  const opening = (s.tick + id * 17) % level.openingPeriod < level.openingWindow;
  if (opening && s.phase === 'playing' && p.cooldown === 0 && d > 45 && d < level.attackRange && edgeDistance(dashEnd) > 12) dash++;
  const e = s.echoes.find(e => e.owner === id && !e.active && !e.swapped);
  if (e && (edgeDistance(p) < level.escapeEdge && edgeDistance(e)>110 || e.fireAt-s.tick<level.swapWindow && d<level.swapRange && edgeDistance(e)>90)) swap++;
  const movement = norm(mx,my);
  return { x: movement.x, y: movement.y, aimX: aim.x, aimY: aim.y, dash, swap };
}
