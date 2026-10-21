import { CONFIG, COLORS, edgeDistance } from './engine.mjs';

const TAU = Math.PI * 2;
const rgba = (hex, alpha) => `${hex}${Math.round(alpha*255).toString(16).padStart(2,'0')}`;
export class Renderer {
  constructor(canvas) { this.canvas=canvas; this.ctx=canvas.getContext('2d'); this.particles=[]; this.lastEvent=0; this.lastTick=0; this.shake=0; this.visual=null; this.resize(); }
  resize() {
    const rect=this.canvas.getBoundingClientRect(), dpr=Math.min(window.devicePixelRatio||1,2);
    this.canvas.width=Math.round(rect.width*dpr); this.canvas.height=Math.round(rect.height*dpr);
    this.scale=Math.min(this.canvas.width/CONFIG.width,this.canvas.height/CONFIG.height);
    this.offsetX=(this.canvas.width-CONFIG.width*this.scale)/2;
    this.offsetY=(this.canvas.height-CONFIG.height*this.scale)/2;
  }
  toWorld(clientX,clientY) {
    const r=this.canvas.getBoundingClientRect();
    return { x:((clientX-r.left)*this.canvas.width/r.width-this.offsetX)/this.scale,
      y:((clientY-r.top)*this.canvas.height/r.height-this.offsetY)/this.scale };
  }
  consume(state, reducedMotion=false) {
    if (state.tick<this.lastTick || state.eventId<this.lastEvent) { this.lastEvent=0; this.particles=[]; this.visual=null; }
    this.lastTick=state.tick;
    const fresh=state.events.filter(e=>e.id>this.lastEvent);
    for (const e of fresh) {
      if (e.type==='hit'||e.type==='clash'||e.type==='out'||e.type==='swap') {
        if (!reducedMotion) this.shake=e.type==='out'?7:e.type==='hit'?3:0;
        const count=reducedMotion?3:e.type==='out'?38:18;
        for(let i=0;i<count;i++) {
          const angle=TAU*i/count+Math.random()*.3, speed=70+Math.random()*220;
          this.particles.push({x:e.x,y:e.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:1,color:COLORS[e.owner??(1-(e.loser??0))]});
        }
      }
    }
    this.lastEvent=state.eventId; return fresh;
  }
  draw(state, options={}) {
    const c=this.ctx, w=CONFIG.width, h=CONFIG.height, now=performance.now()/1000;
    if (!c) return;
    c.setTransform(1,0,0,1,0,0); c.fillStyle='#0a1117';c.fillRect(0,0,this.canvas.width,this.canvas.height);
    c.setTransform(this.scale,0,0,this.scale,this.offsetX,this.offsetY); c.clearRect(0,0,w,h);
    c.fillStyle='#0a1117'; c.fillRect(0,0,w,h);
    c.save();
    if(this.shake>.1) { c.translate(Math.sin(now*97)*this.shake,Math.cos(now*83)*this.shake); this.shake*=.86; }
    const a=CONFIG.arena;
    // A quiet safety moat makes the actual arena boundary unambiguous.
    c.fillStyle='#0d1920'; c.fillRect(a.left,a.top,a.right-a.left,a.bottom-a.top);
    const glow=c.createRadialGradient(560,330,30,560,330,530);
    glow.addColorStop(0,'#12273080'); glow.addColorStop(1,'#0b151b00'); c.fillStyle=glow; c.fillRect(a.left,a.top,960,500);
    c.lineWidth=.7; c.strokeStyle='#20343b55'; c.beginPath();
    for(let x=a.left+24;x<a.right;x+=24) {c.moveTo(x,a.top);c.lineTo(x,a.bottom);}
    for(let y=a.top+24;y<a.bottom;y+=24) {c.moveTo(a.left,y);c.lineTo(a.right,y);}
    c.stroke();
    c.strokeStyle='#37515b55'; c.lineWidth=1; c.setLineDash([3,7]);
    c.beginPath();c.moveTo(560,a.top);c.lineTo(560,a.bottom);c.stroke();c.setLineDash([]);
    c.beginPath();c.arc(560,330,93,0,TAU);c.stroke();
    c.beginPath();c.arc(560,330,34,0,TAU);c.stroke();
    c.strokeStyle='#36515b';c.strokeRect(a.left+.5,a.top+.5,960,500);
    const corner=25;
    for(const [x,y,sx,sy] of [[80,80,1,1],[1040,80,-1,1],[80,580,1,-1],[1040,580,-1,-1]]) {
      c.strokeStyle='#6b929b';c.lineWidth=2;c.beginPath();c.moveTo(x+sx*corner,y);c.lineTo(x,y);c.lineTo(x,y+sy*corner);c.stroke();
      c.fillStyle='#35515a';c.fillRect(x-sx*8-1,y-sy*8-1,2,2);
    }
    c.font='9px monospace';c.letterSpacing='1.5px';c.fillStyle='#506872';
    c.fillText('SETTORE 01',a.left,57);c.textAlign='right';c.fillText('NESSUNA SECONDA POSSIBILITÀ. TRANNE LA TUA ECO.',a.right,57);c.textAlign='left';
    for(let x=104;x<1040;x+=48) { c.strokeStyle='#3b535f';c.lineWidth=1;c.beginPath();c.moveTo(x,592);c.lineTo(x,596);c.stroke(); }
    c.textAlign='center';c.fillStyle='#3f5864';c.fillText('FUORI DAL PERIMETRO = ROUND PERSO',560,622);c.textAlign='left';c.letterSpacing='0px';
    // Client rendering follows snapshots without affecting authoritative physics.
    if(!this.visual) this.visual=state.players.map(p=>({x:p.x,y:p.y}));
    const playerPositions=state.players.map((p,i)=>{
      const v=this.visual[i], jump=Math.hypot(v.x-p.x,v.y-p.y)>110;
      const factor=options.smooth&&!jump?.4:1;
      v.x+=(p.x-v.x)*factor;v.y+=(p.y-v.y)*factor;return v;
    });
    for(const e of state.echoes) {
      const color=COLORS[e.owner], remain=Math.max(0,(e.fireAt-state.tick)/60), progress=1-remain/2;
      c.save();c.strokeStyle=rgba(color,.24);c.lineWidth=1.5;c.setLineDash([4,7]);
      c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.x+e.dx*220,e.y+e.dy*220);c.stroke();c.setLineDash([]);
      const endX=e.x+e.dx*220,endY=e.y+e.dy*220,angle=Math.atan2(e.dy,e.dx);
      c.translate(endX,endY);c.rotate(angle);c.beginPath();c.moveTo(-9,-4);c.lineTo(0,0);c.lineTo(-9,4);c.stroke();c.restore();
      c.save(); c.translate(e.x,e.y);c.globalAlpha=e.active?.7:.5;
      c.fillStyle=rgba(color,.10);c.strokeStyle=color;c.lineWidth=1.5;
      c.beginPath();c.arc(0,0,17,0,TAU);c.fill();c.setLineDash([3,4]);c.stroke();c.setLineDash([]);
      if(!e.active) {
        c.lineWidth=2;c.globalAlpha=.9;c.beginPath();c.arc(0,0,24,-Math.PI/2,-Math.PI/2+TAU*progress);c.stroke();
        c.fillStyle=color;c.textAlign='center';c.font='10px monospace';c.fillText(`${remain.toFixed(1)} s`,0,-34);
        c.font='8px monospace';c.globalAlpha=.65;c.fillText(e.swapped?'ECO · SCAMBIATA':'ECO',0,41);
      }
      c.restore();
    }
    state.players.forEach((p,id)=>{
      const color=COLORS[id], v=playerPositions[id];
      if(edgeDistance(p)<90 && state.phase==='playing') {
        const g=c.createRadialGradient(v.x,v.y,5,v.x,v.y,90);g.addColorStop(0,rgba('#ff645d',.15));g.addColorStop(1,'#ff645d00');c.fillStyle=g;c.fillRect(v.x-90,v.y-90,180,180);
      }
      p.trail.forEach((t,i)=>{if(!t.dash) return;c.fillStyle=rgba(color,.03+i*.025);c.beginPath();c.arc(t.x,t.y,12+i*.7,0,TAU);c.fill();});
      c.save();c.translate(v.x,v.y);
      c.shadowColor=color;c.shadowBlur=options.reducedMotion?8:22;
      c.fillStyle=rgba(color,.10);c.beginPath();c.arc(0,0,29,0,TAU);c.fill();
      c.fillStyle=rgba(color,.17);c.strokeStyle=color;c.lineWidth=2;
      c.beginPath();c.arc(0,0,18,0,TAU);c.fill();c.stroke();
      c.shadowBlur=0;c.fillStyle=color;c.beginPath();c.arc(0,0,6,0,TAU);c.fill();
      c.rotate(Math.atan2(p.aimY,p.aimX));c.fillStyle=color;c.beginPath();c.moveTo(27,0);c.lineTo(20,-4);c.lineTo(20,4);c.closePath();c.fill();
      c.restore();
      if(p.cooldown>0) {c.strokeStyle=rgba(color,.5);c.lineWidth=1.5;c.beginPath();c.arc(v.x,v.y,33,-Math.PI/2,-Math.PI/2+TAU*(1-p.cooldown/180));c.stroke();}
      c.fillStyle=rgba(color,.8);c.textAlign='center';c.font='9px monospace';c.fillText(options.demo? (id?'ROSSO':'BLU') : id===options.localId?'TU':options.bot?'CPU':'RIVALE',v.x,v.y+49);c.textAlign='left';
    });
    for(const p of this.particles) {
      p.x+=p.vx/60;p.y+=p.vy/60;p.vx*=.95;p.vy*=.95;p.life-=.026;
      c.fillStyle=rgba(p.color,Math.max(0,p.life));c.fillRect(p.x-1.5,p.y-1.5,3,3);
    }
    this.particles=this.particles.filter(p=>p.life>0);
    c.restore();
  }
}

export function demoState(time) {
  const t=time/1000, cycle=(t%5)/5;
  return { tick:Math.round(cycle*120), eventId:0,events:[],phase:'demo',
    players:[{id:0,x:275+Math.sin(t*.7)*42,y:333+Math.cos(t*.9)*70,aimX:.85,aimY:-.35,cooldown:50,trail:[]},
      {id:1,x:530+Math.cos(t*.6)*36,y:270+Math.sin(t*.8)*55,aimX:-.9,aimY:.3,cooldown:0,trail:[]}],
    echoes:[{owner:0,x:210,y:230,dx:.95,dy:.32,born:0,fireAt:120,swapped:false,active:false},
      {owner:1,x:510,y:430,dx:-.85,dy:-.5,born:0,fireAt:140,swapped:false,active:false}] };
}
