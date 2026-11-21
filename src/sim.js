class Demo{
 constructor(){this.mode='race';this.track=[];this.car=[];this.custom=[];this.t=0;this.day=false;this.reset()}
 reset(){const start=racePose(0);this.x=start.x;this.z=start.z;this.yaw=start.yaw;this.spin=0;this.lap=0;this.angle=0;this.speed=0;this.offset=0;this.steer=0;this.drive=false;this.orbit=-.49;this.tilt=.185;this.dist=5.13;this.lat=.48;this.lon=.38;this.bearing=.72;this.alt=8900000;this.alpha=.04;this.stall=0;this.sideSpeed=0;this.lookYaw=0;this.chasePitch=.21;this.external=true;this.flight=false;this.airSpeed=215;this.throttle=.6;this.bank=0;this.climb=0;this.warp=1;this.chase=false;this.pitch=-.19}
 step(dt,keys){
 this.t+=dt;if(this.mode==='walk'){this.yard.step(dt,keys);return}if(this.mode==='race'){const gas=keys.has('KeyW')||keys.has('ArrowUp'),brake=keys.has('KeyS')||keys.has('ArrowDown');
 const q=racePose(this.angle),look=racePose(this.angle+(.055+this.speed*.002)),target=Math.atan2(look.x-this.x,look.z-this.z),delta=target-this.yaw;
 const off=Math.abs(this.offset)>6.3;
 let command=+keys.has('ArrowRight')+ +keys.has('KeyD')- +keys.has('ArrowLeft')- +keys.has('KeyA');
 command=command||keys.steer||0;
 if(this.drive)command=clamp(Math.atan2(6*Math.sin(delta),Math.max(1.1,Math.hypot(look.x-this.x,look.z-this.z)))/.43,-1,1);
 this.steer+=(clamp(command,-1,1)-this.steer)*Math.min(1,dt*7);
 let targetSpeed=off?7:37;
 if(this.drive&&!off){let previous=q,distance=0;for(let j=1;j<=22;j++){const ahead=racePose(this.angle+j*.043),ds=Math.hypot(ahead.x-previous.x,ahead.z-previous.z);
 const curve=Math.abs(Math.atan2(Math.sin(ahead.yaw-previous.yaw),Math.cos(ahead.yaw-previous.yaw)))/Math.max(.1,ds);
 targetSpeed=Math.min(targetSpeed,Math.sqrt(6.7/Math.max(.003,curve)+10*distance));distance+=ds;previous=ahead}}
 // Combined tyre-force budget with aerodynamic loading and surface-dependent grip.
 const mass=790,load=mass*9.81+.76*this.speed*this.speed,mu=off?.57:1.48,maxAccel=load*mu/mass;
 const throttle=gas?1:(keys.gas||0);const push=throttle?throttle*Math.min(14.8,468000/(mass*Math.max(13,this.speed))):this.drive?clamp((targetSpeed-this.speed)*1.5,-9,off?2:6):0;
 const longitudinal=clamp(push-(brake?27:27*(keys.brake||0)),-maxAccel,maxAccel),lateralBudget=Math.sqrt(Math.max(0,maxAccel**2-longitudinal**2));
 this.speed=clamp(this.speed+dt*(longitudinal-.42-this.speed*this.speed*(off?.0035:.00063)),0,90);
 const demand=this.speed**2*Math.tan(this.steer*.43)/3,latForce=clamp(demand,-lateralBudget,lateralBudget);
 this.spin=(this.spin+this.speed*dt/.36)%(2*Math.PI);
 this.yaw+=dt*latForce/Math.max(.5,this.speed);
 const drift=-clamp((demand-latForce)*.055,-7,7);this.sideSpeed+=(drift-this.sideSpeed)*Math.min(1,dt*(off?3.4:6.4));
 this.x+=dt*(Math.sin(this.yaw)*this.speed+Math.cos(this.yaw)*this.sideSpeed);this.z+=dt*(Math.cos(this.yaw)*this.speed-Math.sin(this.yaw)*this.sideSpeed);
 let a=this.angle;
 for(let i=0;i<3;i++){let p=racePose(a);a+=clamp(((this.x-p.x)*p.s+(this.z-p.z)*p.c)/p.rate,-.15,.15)}
 const edge=racePose(a);this.offset=(this.x-edge.x)*edge.c-(this.z-edge.z)*edge.s;
 if(this.cage)this.cage.step(dt);
 if(Math.abs(this.offset)>10.85){this.cage?.impact(Math.sign(this.offset),.62,Math.abs(Math.sin(this.yaw-edge.yaw))*this.speed+Math.abs(this.sideSpeed));const p=edge.point(Math.sign(this.offset)*10.84,0);this.x=p[0];this.z=p[2];this.speed*=.78;this.yaw=edge.yaw;this.offset=Math.sign(this.offset)*10.84}
 if(a>=2*Math.PI)this.lap++;else if(a<0&&this.lap>0)this.lap--;
 this.angle=(a+2*Math.PI)%(2*Math.PI);
 }

 if(this.mode==='earth'&&this.flight){
 const turn=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
 const elevator=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
 this.throttle=clamp(this.throttle+dt*.25*(+keys.has('KeyE')-+keys.has('KeyQ')),0,1);
 const duration=dt*this.warp,steps=Math.max(1,Math.ceil(duration/(1/60)));for(let i=0;i<steps;i++)flyStep(this,duration/steps,elevator,turn);

 }
 }
 state(shadow){
 if(this.mode==='walk')return this.yard.state(this.yardMeshes,this.t,shadow,this.fields||[]);
 const sun=unit(this.day?[.36,.25,-.80]:[.62,.57,.51]);const base={sun,t:this.t,shadow,focus:[0,0,0],objects:[],planet:false,fov:.36};
 if(this.mode==='stress'){
  const count=this.fleetCount||16,cols=Math.ceil(Math.sqrt(count*1.6)),rows=Math.ceil(count/cols);
  if(this.fleet?.length!==7*count){
   this.fleet=new Float32Array(count*7);
   for(let i=0;i<count;i++)this.fleet.set([(i%cols-(cols-1)/2)*3.5,0,(Math.floor(i/cols)-(rows-1)/2)*5.6,1,1,0,.96],i*7)
  }
  const size=Math.max(rows*5.6,cols*3.5),scale=this.dist/5.13;
  return {...base,shadow:0,camera:basis([size*.15*scale,size*1.15*scale,size*.9*scale],[0,0,0]),fov:.55,
   objects:[{parts:this.car,model:M.id(),records:this.fleet}]}
 }
 if(this.mode==='earth'){
 const N=geo(this.lat,this.lon),east=[-Math.sin(this.lon),0,-Math.cos(this.lon)],north=unit(cross(N,east)),bearing=this.flight?this.bearing+(this.external?0:this.lookYaw):0,heading=add(vmul(north,Math.cos(bearing)),vmul(east,Math.sin(bearing)));
 const alt=this.alt/RADIUS,eye=vmul(N,1+alt),pitch=this.flight?this.pitch+this.climb:-Math.PI/2+.0001,f=unit(add(vmul(heading,Math.cos(pitch)),vmul(N,Math.sin(pitch)))),rawR=unit(cross(f,N)),rawU=unit(cross(rawR,f)),roll=this.flight?this.bank:0,r=add(vmul(rawR,Math.cos(roll)),vmul(rawU,-Math.sin(roll))),u=unit(cross(r,f));
 const st={...base,alt,planet:true,sun:unit(this.day?[-.35,.45,.84]:[.74,.44,-.48]),camera:{eye,f,r,u},fov:.46,shadow:0};
 if(this.flight&&this.external&&this.airframe)chaseFlight(st,this,N,east,north,heading);
 const rel=this.relief;if(rel&&this.flight){const p=rel.local(vmul(sub(st.camera.eye,rel.center),RADIUS/1000));
 if(Math.hypot(...p)<Math.min(1500,rel.range*1.5+40)){st.objects=[{parts:rel.gpu,model:M.id()}];st.localSun=rel.local(st.sun);st.localCamera={eye:p,f:rel.local(st.camera.f),r:rel.local(st.camera.r),u:rel.local(st.camera.u)}}}
 return st
 }
 const pose=racePose(this.angle),focus=this.mode==='race'?[this.x,.39,this.z]:[0,.55,0],yaw=this.mode==='race'?this.yaw:0;
 const az=yaw+(this.chase?Math.PI:this.orbit),dist=this.chase?6.6:this.dist,tilt=this.chase?.25:this.tilt;
 const eye=add(focus,[Math.sin(az)*Math.cos(tilt)*dist,Math.sin(tilt)*dist,Math.cos(az)*Math.cos(tilt)*dist]);
 if(this.mode==='race'){
 const pose=M.trs([this.x,.015,this.z],[0,Math.sin(yaw/2),0,Math.cos(yaw/2)]);base.objects=[{parts:this.track,model:M.id()}];
 if(this.wheelSource!==this.car){this.wheelSource=this.car;this.groups=new Map();for(const part of this.car){const name=part.nodeName||'Chassis';if(!this.groups.has(name))this.groups.set(name,[]);this.groups.get(name).push(part)}}
 for(const [name,parts] of this.groups){let model=pose;if(/^(Front|Rear)[LR]$/.test(name)){
 const front=name.startsWith('Front'),center=[name.endsWith('R')?.95:-.95,.36,front?1.39:-1.48],angle=front?this.steer*.43:0;
 const steer=M.trs(center,[0,Math.sin(angle/2),0,Math.cos(angle/2)]),roll=M.trs(undefined,[Math.sin(this.spin/2),0,0,Math.cos(this.spin/2)]);
 model=M.mul(pose,M.mul(steer,M.mul(roll,M.trs(vmul(center,-1)))))}
 base.objects.push({parts,model})}}
 else{base.objects=[{parts:this.track,model:M.trs([-pose.x,-.01,-pose.z])}];for(const item of this.items||[]){const q=item.rot*Math.PI/360;base.objects.push({parts:item.parts,model:M.mul(M.trs([item.x,item.y,item.z],[0,Math.sin(q),0,Math.cos(q)],[item.size,item.size,item.size]),item.fit)})}}
 return {...base,camera:basis(eye,focus),focus,budget:shadow?1:.45,fields:this.mode==='race'?this.fields:[],roadReflect:this.mode==='race'&&shadow?Math.min(960,shadow):0,carContact:this.mode==='race'?[1,Math.sin(yaw),Math.cos(yaw)]:[0,0,1]}
 }
}
