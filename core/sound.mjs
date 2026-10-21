export class Sound {
  constructor() { this.enabled=true; this.ctx=null; }
  unlock() { if(!this.ctx) { const C=window.AudioContext||window.webkitAudioContext; if(C) this.ctx=new C(); } if(this.ctx?.state==='suspended') this.ctx.resume().catch(()=>{}); }
  play(type) {
    if(!this.enabled||!this.ctx||this.ctx.state!=='running') return;
    const c=this.ctx, t=c.currentTime, osc=c.createOscillator(), gain=c.createGain();
    const presets={dash:[350,90,.10,'sine'],echo:[600,160,.14,'sine'],swap:[180,780,.19,'sine'],hit:[110,35,.17,'triangle'],clash:[170,50,.17,'triangle'],out:[160,32,.35,'sawtooth'],go:[440,660,.13,'sine'],win:[420,840,.5,'sine']};
    const p=presets[type];if(!p)return;
    osc.type=p[3];osc.frequency.setValueAtTime(p[0],t);osc.frequency.exponentialRampToValueAtTime(p[1],t+p[2]);
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(type==='out'?.075:.045,t+.012);gain.gain.exponentialRampToValueAtTime(.0001,t+p[2]);
    osc.connect(gain);gain.connect(c.destination);osc.start(t);osc.stop(t+p[2]+.01);
  }
}
