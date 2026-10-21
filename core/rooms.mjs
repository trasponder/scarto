import { createGame, step, cleanInput, blankInput, DT } from './engine.mjs';

export class RoomError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function makeRoom(code, token, now) {
  return { code, revision: 0, tokens: [token, null], lastSeen: [now, 0],
    inputs: [blankInput(), blankInput()], sequences: [-1,-1], votes: [false,false],
    state: createGame(), status: 'waiting', wall: now, carry: 0, updated: now };
}
export function seatFor(room, token) {
  if (!token) throw new RoomError('Sessione non valida. Crea o raggiungi una stanza.', 403);
  const seat = room.tokens.indexOf(token);
  if (seat === -1) throw new RoomError('Questa sessione non appartiene alla stanza.', 403);
  return seat;
}
export function joinRoom(room, token, now) {
  if (room.tokens.includes(token)) return seatFor(room,token);
  if (room.tokens[1]) throw new RoomError('La stanza è già al completo.',409);
  if (room.status === 'closed') throw new RoomError('La stanza è stata chiusa.',410);
  room.tokens[1] = token; room.lastSeen = [now,now]; room.wall = now; room.carry = 0;
  room.state = createGame(); room.status = 'connected'; return 1;
}
export function advanceRoom(room, now) {
  now = Math.max(now, room.wall);
  if (room.status === 'waiting' || room.status === 'closed') { room.wall=now; return; }
  const stale = room.lastSeen.some(seen => now-seen > 8000);
  if (stale) { room.status='disconnected'; room.wall=now; room.carry=0; return; }
  if (room.status === 'disconnected') {
    room.status='connected'; room.wall=now; room.carry=0;
    if (room.state.phase === 'playing') { room.state.phase='countdown'; room.state.phaseUntil=room.state.tick+90; }
    return;
  }
  // Server wall-clock controls simulation. Clients cannot advance game time.
  const delta = Math.max(0, Math.min(now-room.wall, 1000));
  room.carry += delta; room.wall=now;
  let limit=61;
  while (room.carry + .000001 >= DT*1000 && limit-- > 0) {
    const tickWall = now-room.carry;
    const inputs = room.inputs.map((i,id) => tickWall-room.lastSeen[id] > 350 ? {...i,x:0,y:0} : i);
    step(room.state, inputs); room.carry -= DT*1000;
  }
}
export function updateRoom(room, token, command, now) {
  const seat = seatFor(room,token);
  // Catch up using the previously received inputs, then accept the new ones.
  advanceRoom(room,now);
  room.lastSeen[seat]=now; room.updated=now;
  if (command.action === 'leave') {
    room.status='closed'; room.inputs=[blankInput(),blankInput()]; return seat;
  }
  if (room.status === 'closed') return seat;
  if (command.action === 'rematch' && room.state.phase === 'finished') {
    room.votes[seat]=true;
    if (room.votes.every(Boolean)) { room.state=createGame(); room.votes=[false,false]; room.inputs=[blankInput(),blankInput()]; room.sequences=[-1,-1]; room.wall=now; room.carry=0; }
  }
  const seq=command.seq;
  if (Number.isInteger(seq) && seq >= 0 && seq > room.sequences[seat]) {
    room.inputs[seat]=cleanInput(command.input); room.sequences[seat]=seq;
  }
  return seat;
}
export function roomView(room, seat) {
  return { code: room.code, revision: room.revision, seat, status: room.status, state: room.state,
    votes: room.votes, ack: room.sequences[seat] };
}
