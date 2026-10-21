/** @param {object} data @param {{signal?: AbortSignal, keepalive?: boolean}} [options] */
export async function roomRequest(data, { signal, keepalive=false }={}) {
  const response=await fetch('/api/room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal,keepalive});
  const body=await response.json();
  if(!response.ok) { const error=new Error(body.error||'Connessione interrotta.');error.status=response.status;throw error; }
  return body;
}

// The standalone Node server advertises WebSocket; hosted Workers use HTTP.
export async function openSocket(session, onState, onConnection) {
  try {
    const meta=await fetch('/api/transport').then(r=>r.ok?r.json():null).catch(()=>null);
    if(!meta?.websocket) return null;
    return await new Promise((resolve)=>{
      const ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws`);
      const timeout=setTimeout(()=>{ws.close();resolve(null);},2500);
      ws.onopen=()=>{clearTimeout(timeout);ws.send(JSON.stringify({action:'subscribe',...session}));resolve(ws);};
      ws.onmessage=e=>{try{const data=JSON.parse(e.data);if(data.state){onState(data);onConnection(true);}}catch{}};
      ws.onerror=()=>{clearTimeout(timeout);resolve(null);};
      ws.onclose=()=>onConnection(false);
    });
  } catch { return null; }
}
