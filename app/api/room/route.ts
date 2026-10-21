import { env } from 'cloudflare:workers';
import { makeRoom, joinRoom, updateRoom, roomView, RoomError } from '../../../core/rooms.mjs';

export const dynamic = 'force-dynamic';
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: {'Cache-Control':'no-store'} });
type Row = { code: string; revision: number; payload: string; updated: number };

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return json({error:'Origine non consentita.'},403);
    const length = Number(request.headers.get('content-length') || 0);
    if (length > 4096) return json({error:'Richiesta troppo grande.'},413);
    const raw = await request.text();
    if (raw.length > 4096) return json({error:'Richiesta troppo grande.'},413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({error:'Richiesta non valida.'},400);
    if (!env.DB) return json({error:'Il server delle stanze non è disponibile. Puoi giocare contro il computer.'},503);
    const now = Date.now();
    if (body.action === 'create') {
      const token = crypto.randomUUID();
      for (let i=0;i<4;i++) {
        const bytes = crypto.getRandomValues(new Uint8Array(6));
        const code = [...bytes].map(b=>alphabet[b%alphabet.length]).join('');
        const room = makeRoom(code,token,now);
        const res = await env.DB.prepare('INSERT OR IGNORE INTO scarto_rooms (code, revision, payload, updated) VALUES (?, 0, ?, ?)').bind(code, JSON.stringify(room),now).run();
        if (res.meta.changes) {
          // Bounded cleanup; never modifies schema at request time.
          await env.DB.prepare('DELETE FROM scarto_rooms WHERE code IN (SELECT code FROM scarto_rooms WHERE updated < ? LIMIT 20)').bind(now-3*3600000).run();
          return json({...roomView(room,0),token});
        }
      }
      throw new RoomError('Non riesco a creare la stanza. Riprova.',503);
    }
    const code = String(body.code||'').toUpperCase().replace(/\s/g,'');
    if (!/^[A-Z2-9]{6}$/.test(code)) throw new RoomError('Inserisci un codice stanza di 6 caratteri.');
    if (!['join','sync','rematch','leave'].includes(body.action)) throw new RoomError('Comando non valido.');
    const joinToken = body.action === 'join' ? crypto.randomUUID() : null;
    for (let attempt=0;attempt<10;attempt++) {
      const row = await env.DB.prepare('SELECT code, revision, payload, updated FROM scarto_rooms WHERE code = ?').bind(code).first<Row>();
      if (!row || now-row.updated>3*3600000) throw new RoomError('Stanza non trovata o scaduta. Controlla il codice.',404);
      const room = JSON.parse(row.payload);
      const at = Math.max(Date.now(), room.wall || 0, room.updated || 0);
      const seat = body.action === 'join' ? joinRoom(room,joinToken,at) : updateRoom(room,body.token,body,at);
      room.updated=at; room.revision=row.revision+1;
      const changed = await env.DB.prepare('UPDATE scarto_rooms SET revision = ?, payload = ?, updated = ? WHERE code = ? AND revision = ?')
        .bind(room.revision,JSON.stringify(room),at,code,row.revision).run();
      if (changed.meta.changes) return json({...roomView(room,seat),...(joinToken?{token:joinToken}:{})});
    }
    return json({error:'Il server è occupato. Riconnessione in corso.'},503);
  } catch (error) {
    if (error instanceof RoomError) return json({error:error.message},error.status);
    if (error instanceof SyntaxError) return json({error:'Richiesta non valida.'},400);
    console.error('Room request failed:', error instanceof Error ? error.message : 'unknown');
    return json({error:'Connessione al server interrotta. Riprova fra un momento.'},500);
  }
}
