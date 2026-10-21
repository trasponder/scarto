import http from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocketServer,WebSocket} from 'ws';
import {makeRoom,joinRoom,updateRoom,roomView,advanceRoom,seatFor,RoomError} from '../core/rooms.mjs';

export function createScartoServer({port=3000,host='0.0.0.0',root=fileURLToPath(new URL('./public/',import.meta.url))}={}) {
  const rooms=new Map();
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const request=(body)=>{
    if(!body||typeof body!=='object'||Array.isArray(body))throw new RoomError('Richiesta non valida.',400);
    const now=Date.now();
    if(body.action==='create') {
      if(rooms.size>=512)throw new RoomError('Troppe stanze attive. Riprova più tardi.',503);
      let code;do{code=[...randomBytes(6)].map(b=>alphabet[b%alphabet.length]).join('');}while(rooms.has(code));
      const token=randomUUID(),r=makeRoom(code,token,now);rooms.set(code,r);return{...roomView(r,0),token};
    }
    const code=String(body.code||'').toUpperCase().replace(/\s/g,'');
    if(!/^[A-Z2-9]{6}$/.test(code))throw new RoomError('Inserisci un codice stanza di 6 caratteri.');
    const r=rooms.get(code);if(!r)throw new RoomError('Stanza non trovata o scaduta.',404);
    if(!['join','sync','rematch','leave'].includes(body.action))throw new RoomError('Comando non valido.');
    let token=body.token,id;
    if(body.action==='join'){token=randomUUID();id=joinRoom(r,token,now);}else id=updateRoom(r,token,body,now);
    r.revision++;return {...roomView(r,id),...(body.action==='join'?{token}:{})};
  };
  const json=(res,body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
  const server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/api/transport')return json(res,{websocket:true,authoritative:'server',tickRate:60});
      if(url.pathname==='/api/room'){
        if(req.method!=='POST')return json(res,{error:'Usa POST.'},405);
        if(req.headers.origin&&req.headers.origin!==`${req.headers['x-forwarded-proto']||'http'}://${req.headers.host}`)return json(res,{error:'Origine non consentita.'},403);
        let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)throw new RoomError('Richiesta troppo grande.',413);}
        return json(res,request(JSON.parse(raw)));
      }
      if(req.method!=='GET'&&req.method!=='HEAD')return json(res,{error:'Metodo non consentito.'},405);
      const file=resolve(root,`.${decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname)}`);
      if(!file.startsWith(resolve(root)+sep))return json(res,{error:'Percorso non valido.'},403);
      const info=await stat(file);if(!info.isFile())return json(res,{error:'Non trovato.'},404);
      const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
      res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Content-Length':info.size,'Cache-Control':extname(file)==='.html'?'no-cache':'public, max-age=3600'});
      res.end(req.method==='HEAD'?undefined:await readFile(file));
    }catch(e){json(res,{error:e instanceof RoomError?e.message:e instanceof SyntaxError?'Richiesta non valida.':'Risorsa non disponibile.'},e.status||(e instanceof SyntaxError?400:404));}
  });
  const wss=new WebSocketServer({noServer:true,maxPayload:4096});
  server.on('upgrade',(req,socket,head)=>{
    if(req.url!=='/ws'||req.headers.origin&&req.headers.origin!==`${req.headers['x-forwarded-proto']||'http'}://${req.headers.host}`){socket.destroy();return;}
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
  });
  wss.on('connection',ws=>{
    let session=null,burst=0,window=Date.now();
    ws.on('error',()=>{});
    ws.on('message',raw=>{
      try{
        if(Date.now()-window>1000){window=Date.now();burst=0;}if(++burst>80){ws.close(1008,'Troppi messaggi');return;}
        const body=JSON.parse(String(raw));
        if(body.action==='subscribe'){
          const r=rooms.get(body.code);if(!r)throw new RoomError('Stanza non trovata.',404);
          const seat=seatFor(r,body.token);session={code:body.code,token:body.token,seat};ws.session=session;
          ws.send(JSON.stringify(roomView(r,seat)));return;
        }
        if(!session)throw new RoomError('Iscriviti alla stanza.',403);
        if(!['sync','rematch','leave'].includes(body.action))throw new RoomError('Comando non valido.');
        const result=request({...body,code:session.code,token:session.token});
        if(body.action!=='sync')ws.send(JSON.stringify(result));
      }catch(e){ws.send(JSON.stringify({error:e.message}));}
    });
  });
  let count=0;
  const timer=setInterval(()=>{
    const now=Date.now();count++;
    for(const [code,r] of rooms){if(now-r.updated>3*3600000){rooms.delete(code);continue;}advanceRoom(r,now);r.revision++;}
    if(count%3===0)for(const ws of wss.clients){const session=ws.session;if(ws.readyState!==WebSocket.OPEN||!session||ws.bufferedAmount>65536)continue;const r=rooms.get(session.code);if(r)ws.send(JSON.stringify(roomView(r,session.seat)));}
  },1000/60);
  const close=async()=>{clearInterval(timer);for(const ws of wss.clients)ws.terminate();await new Promise(done=>wss.close(done));await new Promise(done=>server.close(done));};
  return {server,rooms,request,close,listen:()=>new Promise(done=>server.listen(port,host,()=>done(server.address())))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const app=createScartoServer({port:Number(process.env.PORT)||3000,host:process.env.HOST||'0.0.0.0'});
  const address=await app.listen();console.log(`SCARTO pronto: http://localhost:${address.port}`);console.log('Multiplayer WebSocket attivo. Per la LAN usa l’indirizzo IP di questo computer.');
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
}
