// Small procedural vehicle sound bank. The audio context starts after a user gesture.
class VehicleAudio{
 async toggle(){if(!this.ctx){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Web Audio недоступен');const c=this.ctx=new Audio();
 this.master=c.createGain();this.master.gain.value=0;this.master.connect(c.destination);
 const filter=this.filter=c.createBiquadFilter();filter.type='lowpass';filter.Q.value=.8;filter.connect(this.master);
 this.tones=['sawtooth','triangle'].map(type=>{const osc=c.createOscillator();osc.type=type;osc.connect(filter);osc.start();return osc})}
 this.on=!this.on;if(this.on)await this.ctx.resume();else this.master.gain.setTargetAtTime(0,this.ctx.currentTime,.035);return this.on}
 update(sim,visible){if(!this.on||!this.ctx)return;const t=this.ctx.currentTime,race=sim.mode==='race',air=sim.mode==='earth'&&sim.flight;
 const kmh=sim.speed*3.6,gear=clamp(Math.floor(kmh/42)+1,1,7),hz=race?65+kmh/gear*5.7:38+sim.throttle*32;
 this.tones[0].frequency.setTargetAtTime(hz,t,.045);this.tones[1].frequency.setTargetAtTime(hz*(race?2.014:1.502),t,.06);
 this.filter.frequency.setTargetAtTime(race?540+hz*3:340+sim.throttle*350,t,.06);this.master.gain.setTargetAtTime(visible&&(race||air)?(race?.038:.025):0,t,.045)}
}
