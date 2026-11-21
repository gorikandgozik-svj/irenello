// Metres, seconds, kilograms. Boxes are axis-aligned. Spheres may spin.
class PhysicsBody {
 constructor({shape='box',position=[0,0,0],half=[.5,.5,.5],radius=.5,mass=1,friction=.65,bounce=.12,velocity=[0,0,0],sensor=false,continuous=false,rotation=[0,0,0,1],angularVelocity=[0,0,0]}={}){
  if(!['sphere','box','obb'].includes(shape)||mass<0||radius<=0||half.some(v=>v<=0))throw Error('Некорректное физическое тело');
  this.shape=shape;this.position=[...position];this.velocity=[...velocity];this.half=shape==='sphere'?[radius,radius,radius]:[...half];
  this.radius=radius;this.mass=mass;this.inv=mass?1/mass:0;this.rotation=rotation.map(v=>v/(Math.hypot(...rotation)||1));this.spin=[...angularVelocity];this.invI=mass&&shape==='sphere'?2.5/(mass*radius*radius):0;
  this.updateBasis();this.force=[0,0,0];this.friction=friction;this.bounce=bounce;this.sensor=sensor;this.continuous=continuous;this.grounded=false;
 }
 updateBasis(){const m=M.trs(undefined,this.rotation);this.axes=this.shape==='obb'?[m.slice(0,3),m.slice(4,7),m.slice(8,11)]:[[1,0,0],[0,1,0],[0,0,1]];
 this.extent=[0,1,2].map(i=>this.axes.reduce((v,a,k)=>v+Math.abs(a[i])*this.half[k],0))}
 inertia(t){if(this.shape!=='obb')return vmul(t,this.invI);let out=[0,0,0];for(let i=0;i<3;i++){const u=this.half[(i+1)%3],v=this.half[(i+2)%3];out=add(out,vmul(this.axes[i],dot(t,this.axes[i])*3*this.inv/(u*u+v*v)))}return out}
 rotate(dt){if(this.shape==='box'||!this.inv||Math.hypot(...this.spin)<1e-7)return;
 const [x,y,z,w]=this.rotation,[a,b,c]=this.spin,k=dt*.5;
 const q=[x+k*(a*w+b*z-c*y),y+k*(b*w+c*x-a*z),z+k*(c*w+a*y-b*x),w-k*(a*x+b*y+c*z)];this.rotation=vmul(q,1/Math.hypot(...q));if(this.shape==='obb')this.updateBasis()}
 applyForce(f){this.force=add(this.force,f)}
 impulse(j,arm=[0,0,0]){if(!this.inv)return;this.velocity=add(this.velocity,vmul(j,this.inv));this.spin=add(this.spin,this.inertia(cross(arm,j)))}
}
function supportFace(b,n){let p=[...b.position];for(let i=0;i<3;i++){const d=dot(n,b.axes[i]);if(Math.abs(d)>1e-6)p=add(p,vmul(b.axes[i],Math.sign(d)*b.half[i]))}return p}
function orientedContact(a,b,d){
 const axes=[...a.axes,...b.axes];for(const u of a.axes)for(const v of b.axes){const c=cross(u,v),l=Math.hypot(...c);if(l>1e-6)axes.push(vmul(c,1/l))}
 let depth=Infinity,n;
 for(const axis of axes){const projection=body=>body.axes.reduce((v,dir,i)=>v+Math.abs(dot(dir,axis))*body.half[i],0);
 const signed=dot(d,axis),overlap=projection(a)+projection(b)-Math.abs(signed);if(overlap<=0)return null;
 if(overlap<depth){depth=overlap;n=vmul(axis,signed<0?-1:1)}}
 let point;if(!a.inv)point=supportFace(b,vmul(n,-1));else if(!b.inv)point=supportFace(a,n);
 else point=vmul(add(supportFace(a,n),supportFace(b,vmul(n,-1))),.5);
 return {n,depth,point}
}
function contact(a,b){
 const d=sub(b.position,a.position);
 if(a.shape==='sphere'&&b.shape==='sphere'){let l=Math.hypot(...d),depth=a.radius+b.radius-l;if(depth<=0)return null;return {n:l?vmul(d,1/l):[1,0,0],depth}}
 if(a.shape!=='sphere'&&b.shape!=='sphere'&&(a.shape==='obb'||b.shape==='obb'))return orientedContact(a,b,d);
 if(a.shape==='box'&&b.shape==='box'){const overlap=d.map((v,k)=>a.half[k]+b.half[k]-Math.abs(v));const depth=Math.min(...overlap);if(depth<=0)return null;let n=[0,0,0],i=overlap.indexOf(depth);n[i]=Math.sign(d[i])||1;return {n,depth}}
 const sphere=a.shape==='sphere'?a:b,box=sphere===a?b:a;
 const diff=sub(sphere.position,box.position),local=box.axes.map(axis=>dot(diff,axis)),near=local.map((v,k)=>clamp(v,-box.half[k],box.half[k])),axis=sub(local,near),length=Math.hypot(...axis);
 let n,depth;if(length){depth=sphere.radius-length;if(depth<=0)return null;n=vmul(axis,1/length)}
 else{const edge=local.map((v,k)=>box.half[k]-Math.abs(v)),k=edge.indexOf(Math.min(...edge));n=[0,0,0];n[k]=Math.sign(local[k])||1;depth=sphere.radius+edge[k]}
 n=box.axes.reduce((out,axis,i)=>add(out,vmul(axis,n[i])),[0,0,0]);return {n:sphere===a?vmul(n,-1):n,depth,point:sub(sphere.position,vmul(n,sphere.radius))}
}
function solveContact(a,b,{n,depth,point}){
 const inv=a.inv+b.inv;if(!inv)return;
 const fix=Math.max(0,depth-.0005)*.80/inv;
 a.position=sub(a.position,vmul(n,fix*a.inv));b.position=add(b.position,vmul(n,fix*b.inv));
 if(n[1]<-.55)a.grounded=true;if(n[1]>.55)b.grounded=true;
 const ra=a.shape==='obb'&&point?sub(point,a.position):a.invI?vmul(n,a.radius):[0,0,0],rb=b.shape==='obb'&&point?sub(point,b.position):b.invI?vmul(n,-b.radius):[0,0,0];
 const relative=sub(add(b.velocity,cross(b.spin,rb)),add(a.velocity,cross(a.spin,ra))),closing=dot(relative,n);
 if(closing>=0)return;
 const effective=axis=>{const u=cross(ra,axis),v=cross(rb,axis);return inv+dot(u,a.inertia(u))+dot(v,b.inertia(v))};
 const j=-closing*(1+(closing<-.8?Math.min(a.bounce,b.bounce):0))/effective(n);
 let impulse=vmul(n,j);const t=sub(relative,vmul(n,closing)),speed=Math.hypot(...t);
 if(speed>1e-7){const axis=vmul(t,1/speed),den=effective(axis);
 impulse=sub(impulse,vmul(axis,Math.min(speed/den,j*Math.sqrt(a.friction*b.friction))))}
 a.impulse(vmul(impulse,-1),ra);b.impulse(impulse,rb)
}
// Distance to a box is quadratic between crossings of its six face planes.
function sweepAgainst(body,start,delta,radius){
 const off=sub(start,body.position);
 function firstRoot(p,v,r,lo,hi){const A=dot(v,v),B=dot(p,v),C=dot(p,p)-r*r;
 if(A*lo*lo+2*B*lo+C<=1e-10)return lo;if(A<1e-16)return null;const disc=B*B-A*C;if(disc<0)return null;const t=(-B-Math.sqrt(disc))/A;return t>=lo-1e-10&&t<=hi+1e-10?clamp(t,lo,hi):null}
 if(body.shape==='sphere'){const t=firstRoot(off,delta,radius+body.radius,0,1);if(t===null)return null;const n=unit(add(off,vmul(delta,t)));return {t,n}}
 const p=body.axes.map(a=>dot(off,a)),v=body.axes.map(a=>dot(delta,a)),cuts=[0,1];
 for(let k=0;k<3;k++)if(Math.abs(v[k])>1e-12)for(const sign of [-1,1]){const t=(sign*body.half[k]-p[k])/v[k];if(t>0&&t<1)cuts.push(t)}
 cuts.sort((a,b)=>a-b);
 for(let j=1;j<cuts.length;j++){const lo=cuts[j-1],hi=cuts[j],mid=(lo+hi)*.5,q=[0,0,0],u=[0,0,0];
 for(let k=0;k<3;k++){const h=body.half[k],m=p[k]+v[k]*mid;if(Math.abs(m)>h){q[k]=p[k]-Math.sign(m)*h;u[k]=v[k]}}
 const t=firstRoot(q,u,radius,lo,hi);if(t===null)continue;
 let n=unit(add(q,vmul(u,t)));if(!Math.hypot(...n)){const pt=add(p,vmul(v,t)),gap=pt.map((x,k)=>body.half[k]-Math.abs(x)),k=gap.indexOf(Math.min(...gap));n[k]=Math.sign(pt[k])||1}
 n=body.axes.reduce((acc,axis,k)=>add(acc,vmul(axis,n[k])),[0,0,0]);return {t,n}}
 return null
}
class PhysicsWorld{
 constructor({gravity=[0,-9.81,0],substeps=3,iterations=4}={}){this.gravity=gravity;this.substeps=Math.max(1,Math.floor(substeps));this.iterations=Math.max(1,Math.floor(iterations));this.bodies=[];this.springs=[];this.contacts=[]}
 add(options){const b=new PhysicsBody(options);this.bodies.push(b);return b}
 spring(a,b,length,k=60,damping=5){const s={a,b,length,k,damping};this.springs.push(s);return s}
 sweepSphere(start,delta,radius,{ignore=null,staticOnly=false,incomingOnly=false}={}){
 let best=null;for(const body of this.bodies){if(body===ignore||body.sensor||(staticOnly&&body.inv))continue;const hit=sweepAgainst(body,start,delta,radius);
 if(hit&&(!incomingOnly||dot(delta,hit.n)<-1e-10)&&(!best||hit.t<best.t))best={...hit,body,point:add(start,vmul(delta,hit.t))}}return best}
 advance(body,h){if(!body.continuous||body.shape!=='sphere'||Math.hypot(...body.velocity)*h<body.radius*.5){body.position=add(body.position,vmul(body.velocity,h));return}
 let left=h;for(let i=0;i<4&&left>1e-7;i++){const delta=vmul(body.velocity,left),hit=this.sweepSphere(body.position,delta,body.radius,{ignore:body,staticOnly:true,incomingOnly:true});
 if(!hit){body.position=add(body.position,delta);break}
 body.position=add(hit.point,vmul(hit.n,.0001));solveContact(hit.body,body,{n:hit.n,depth:0});left*=1-hit.t}}
 step(dt){
  if(!(dt>0))return;const h=dt/this.substeps,hits=new Map();
  for(const b of this.bodies)b.grounded=false;
  for(let pass=0;pass<this.substeps;pass++){
   for(const {a,b,length,k,damping} of this.springs){const d=sub(b.position,a.position),l=Math.hypot(...d);if(l<1e-7)continue;const n=vmul(d,1/l),j=vmul(n,h*(k*(l-length)+damping*dot(sub(b.velocity,a.velocity),n)));a.impulse(j);b.impulse(vmul(j,-1))}
   for(const b of this.bodies)if(b.inv){b.velocity=add(b.velocity,vmul(add(this.gravity,vmul(b.force,b.inv)),h));this.advance(b,h);b.rotate(h)}
   for(let it=0;it<this.iterations;it++){
    const sorted=this.bodies.map((b,i)=>({b,i,min:b.position[0]-b.extent[0]})).sort((a,b)=>a.min-b.min);
    for(let i=0;i<sorted.length;i++){const {b:a,i:ia}=sorted[i],end=a.position[0]+a.extent[0];for(let j=i+1;j<sorted.length&&sorted[j].min<=end;j++){
     const {b,i:ib}=sorted[j];if(!a.inv&&!b.inv||Math.abs(a.position[2]-b.position[2])>a.extent[2]+b.extent[2])continue;
     const hit=contact(a,b);if(!hit)continue;const key=Math.min(ia,ib)+'/'+Math.max(ia,ib);hits.set(key,{a,b,...hit});if(!a.sensor&&!b.sensor)solveContact(a,b,hit)
    }}
   }
  }
  for(const b of this.bodies)b.force=[0,0,0];this.contacts=[...hits.values()]
 }
 raycast(start,direction,max=Infinity,ignore=null){
  if(!Math.hypot(...direction))return null;const dir=unit(direction);let nearest=max,result=null;
  for(const body of this.bodies){if(body===ignore||body.sensor)continue;const s=sub(start,body.position);let t;
   if(body.shape==='sphere'){const b=dot(s,dir),c=dot(s,s)-body.radius**2,disc=b*b-c;if(disc<0)continue;t=c<=0?0:-b-Math.sqrt(disc)}
   else{let lo=0,hi=nearest;for(let i=0;i<3;i++){const r=body.half[i],v=dot(dir,body.axes[i]),p=dot(s,body.axes[i]);if(Math.abs(v)<1e-8){if(Math.abs(p)>r){hi=-1;break}}else{const a=(-r-p)/v,b=(r-p)/v;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b))}}if(lo>hi)continue;t=lo}
   if(t>=0&&t<=nearest){nearest=t;result={body,distance:t,point:add(start,vmul(dir,t))}}
  }return result
 }
}
function airForces(speed,alt,alpha,throttle){
 const rho=1.225*Math.exp(-Math.max(0,alt)/8500),q=.5*rho*speed*speed,stall=clamp((Math.abs(alpha)-.24)/.20,0,1);
 const cl=clamp(.24+4.8*alpha,-1.35,1.55)*(1-.67*stall),cd=.024+.052*cl*cl+.40*stall;
 return {lift:q*27.8*cl,drag:q*27.8*cd,thrust:42000*throttle*(rho/1.225)**.72,stall,rho}
}
function flyStep(s,dt,elevator,turn){
 const mass=7900;s.bank+=(turn*1.02-s.bank)*Math.min(1,dt*2.3);
 const q=.5*1.225*Math.exp(-Math.max(0,s.alt)/8500)*s.airSpeed**2;
 const trim=clamp((mass*9.81/Math.max(1,q*27.8)-.24)/4.8,-.09,.22);
 const target=trim+.28*elevator-.11*s.climb;
 s.alpha+=(target-s.alpha)*Math.min(1,dt*2.7);
 const {lift,drag,thrust,stall}=airForces(s.airSpeed,s.alt,s.alpha,s.throttle);s.stall=stall;
 const speed=Math.max(25,s.airSpeed);s.climb=clamp(s.climb+dt*(lift*Math.cos(s.bank)/mass-9.81*Math.cos(s.climb))/speed,-1.2,1.2);
 s.bearing+=dt*lift*Math.sin(s.bank)/(mass*speed*Math.max(.3,Math.cos(s.climb)));
 s.airSpeed=clamp(speed+dt*((thrust-drag)/mass-9.81*Math.sin(s.climb)),25,380);
 [s.lat,s.lon]=advanceGeo(s.lat,s.lon,s.bearing,dt*s.airSpeed*Math.cos(s.climb));const floor=s.relief?Math.max(150,s.relief.heightAt(s.lat,s.lon)+35):150;
 s.alt=clamp(s.alt+dt*s.airSpeed*Math.sin(s.climb),floor,18000000);if(s.alt===floor)s.climb=Math.max(0,s.climb)
}
// Chassis-local scalar displacement field. Adjacent masses exchange impulse and
// each node has a yielding attachment to the undeformed frame.
class CrushCage {
 constructor(){this.size=[9,5,17];this.count=765;this.disp=new Float32Array(this.count);
  this.rest=new Float32Array(this.count);this.vel=new Float32Array(this.count);
  this.force=new Float32Array(this.count);this.active=0;this.version=0}
 index(x,y,z){return x+9*(y+5*z)}
 impact(side,longitudinal,speed){
  if(speed<2)return;
  for(let z=0;z<17;z++)for(let y=0;y<5;y++)for(let x=0;x<9;x++){
   const i=this.index(x,y,z),dx=x/4-1-side,dy=y/4-.34,dz=z/8-1-longitudinal;
   const strength=Math.exp(-5*dx*dx-3*dy*dy-8*dz*dz)*Math.min(8,speed*.15);
   this.vel[i]-=side*strength;
  }
  this.active=1.3;
 }
 step(dt){
  if(this.active<=0)return;
  const d=this.disp,v=this.vel,f=this.force,r=this.rest;
  for(let i=0;i<this.count;i++){
   const strain=d[i]-r[i];
   if(Math.abs(strain)>.055)r[i]=clamp(r[i]+(strain-Math.sign(strain)*.055)*Math.min(1,dt*15),-.26,.26);
   f[i]=-260*(d[i]-r[i])-11*v[i];
  }
  const link=(i,j)=>{const a=(d[j]-d[i])*74;f[i]+=a;f[j]-=a};
  for(let z=0;z<17;z++)for(let y=0;y<5;y++)for(let x=0;x<9;x++){
   const i=this.index(x,y,z);if(x<8)link(i,i+1);if(y<4)link(i,i+9);if(z<16)link(i,i+45)
  }
  for(let i=0;i<this.count;i++){v[i]+=f[i]*dt;d[i]=clamp(d[i]+v[i]*dt,-.34,.34)}
  this.active-=dt;this.version++;
 }
 bind(parts){
  for(const p of parts){if(!p.source)continue;
   const count=p.source.length/8;p.weights=new Float32Array(count*3);p.base=new Uint16Array(count);p.changed=new Float32Array(p.source);
   for(let i=0;i<count;i++){
    const v=i*8,coords=[clamp((p.source[v]+1.15)*8/2.3,0,7.9999),clamp(p.source[v+1]*4/1.2,0,3.9999),clamp((p.source[v+2]+2.4)*16/4.8,0,15.9999)];
    const [x,y,z]=coords.map(Math.floor);p.base[i]=this.index(x,y,z);
    for(let k=0;k<3;k++)p.weights[i*3+k]=coords[k]%1
   }
  }
 }
 upload(gl,parts){
  if(this.uploaded===this.version)return;
  this.uploaded=this.version;
  for(const p of parts){if(!p.base)continue;
   for(let i=0;i<p.base.length;i++){
    const k=i*3,b=p.base[i],a=p.weights[k],c=p.weights[k+1],e=p.weights[k+2];
    const row=(j)=>this.disp[j]*(1-a)+this.disp[j+1]*a;
    p.changed[i*8]=p.source[i*8]+(row(b)*(1-c)+row(b+9)*c)*(1-e)+(row(b+45)*(1-c)+row(b+54)*c)*e
   }
   gl.bindBuffer(gl.ARRAY_BUFFER,p.v);gl.bufferData(gl.ARRAY_BUFFER,p.changed,gl.DYNAMIC_DRAW)
  }
 }
}
