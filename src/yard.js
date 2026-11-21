class ServiceYard {
 constructor(){this.physics=new PhysicsWorld();this.yaw=Math.PI;this.pitch=-.09;this.items=[];this.jumpHeld=false;this.grab=null;this.score=0;this.flash=0;
  const add=(type,position,size,mass=0)=>{
   const body=this.physics.add({shape:type==='orb'?'sphere':'box',radius:size[0]*.5,position,half:vmul(size,.5),mass,friction:.65,bounce:type==='orb'?.58:.10});
   this.items.push({type,body,size});return body};
  add('floor',[0,-.32,0],[46,.64,46]);for(const side of [-1,1]){
   add('concrete',[side*22,.65,0],[.5,1.3,44]);add('concrete',[0,.65,side*22],[44,1.3,.5]);
   for(let i=0;i<4;i++)add('post',[side*8,2.2,-i*4-1],[.19,4.4,.19])}
  add('roof',[0,4.50,-7],[16.8,.18,15.4]);add('concrete',[0,1.25,-15],[16,2.5,.38]);
  for(let i=0;i<4;i++)for(let j=0;j<4-i;j++)add('crate',[-3+i*.53+j*1.08,.51+i*1.006,-3],[1,1,1],14);
  for(let i=0;i<5;i++)add('orb',[1.4+i*.83,1+i*.45,-2.3+(i%2)*.5],[.76,.76,.76],2);
  const moving=this.physics.add({shape:'obb',position:[2.3,1.48,-.4],half:[.49,.49,.49],mass:7,rotation:[0,0,Math.sin(.23),Math.cos(.23)],angularVelocity:[.9,.5,0]});this.items.push({type:'crate',body:moving,size:[1,1,1]});
  for(let i=0;i<6;i++)add('crate',[4.1+i%2*1.08,.53+Math.floor(i/2)*1.02,-8],[1,1,1],12);
  this.player=this.physics.add({shape:'box',half:[.29,.84,.29],position:[0,.85,5.5],mass:72,friction:.18,bounce:0});
 }
 camera(){const eye=add(this.player.position,[0,.68,0]),sy=Math.sin(this.yaw),cy=Math.cos(this.yaw),cp=Math.cos(this.pitch);
 return basis(eye,add(eye,[sy*cp,Math.sin(this.pitch),cy*cp]))}
 interact(){if(this.grab){this.grab=null;return}const c=this.camera(),hit=this.physics.raycast(c.eye,c.f,4,this.player);
 if(hit?.body.inv)this.grab=hit.body}
 pulse(){if(this.flash>0)return;this.flash=.18;const c=this.camera(),h=this.physics.raycast(c.eye,c.f,24,this.player);if(!h?.body.inv)return;
 h.body.impulse(vmul(c.f,Math.min(60,h.body.mass*4.5)),sub(h.point,h.body.position));if(this.items.some(o=>o.body===h.body&&o.type==='orb'))this.score++}
 step(dt,keys){this.flash=Math.max(0,this.flash-dt);
  const forward=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),
  side=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),c=this.camera(),f=unit([c.f[0],0,c.f[2]]),desired=vmul(add(vmul(f,forward),vmul(c.r,side)),(keys.has('ShiftLeft')?5.3:3.5)/Math.max(1,Math.hypot(forward,side)));
  for(const k of [0,2]){const delta=desired[k]-this.player.velocity[k];this.player.velocity[k]+=clamp(delta,-dt*19,dt*19)}
  const jump=keys.has('Space');if(jump&&!this.jumpHeld&&this.player.grounded)this.player.impulse([0,72*4.6,0]);this.jumpHeld=jump;
  if(this.grab){const target=add(c.eye,vmul(c.f,2.2)),d=sub(target,this.grab.position);
   if(Math.hypot(...d)>5)this.grab=null;else{const b=this.grab,force=sub(vmul(d,57),vmul(b.velocity,12));b.applyForce(vmul(add(force,[0,9.81,0]),b.mass))}}
  this.physics.step(dt)
 }
 state(parts,t,shadow,fields){const camera=this.camera(),objects=this.items.map(({type,body,size})=>({parts:parts[type],model:M.trs(body.position,body.rotation,size)}));
 return {camera,objects,focus:camera.eye,sun:unit([-.52,.48,-.60]),t,shadow,planet:false,fov:.55,budget:shadow?1:.45,fields}}
}
async function yardAssets(g){const types=sceneryTypes(),out={};for(const [t,mat] of Object.entries({floor:finish([.25,.26,.235],.87),concrete:finish([.40,.39,.36],.88),post:finish([.13,.18,.20],.35,.68),roof:finish([.31,.35,.38],.43,.73)})){
 const mesh=new Geometry();mesh.box(mat,[0,0,0],[1,1,1]);out[t]=await g.upload(mesh)}
 for(const t of ['crate','orb'])out[t]=await g.upload(types[t]());return out}
