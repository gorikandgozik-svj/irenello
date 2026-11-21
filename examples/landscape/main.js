async function main(){
 const canvas=document.querySelector('canvas');
 const game=new SKERRY.Game(canvas),world=game.world;
 const pine=new SKERRY.Geometry(),rock=new SKERRY.Geometry();
 const bark={color:[.12,.078,.043],rough:.91,metal:0};
 pine.box(bark,[0,1.25,0],[.25,2.5,.25]);
 const needles={color:[.84,.92,.79],rough:.92,metal:0,kind:4,cut:.39,image:Uint8Array.from(atob(foliagePNG),c=>c.charCodeAt(0))};
 for(let j=0;j<3;j++){
  const angle=j*Math.PI/3,x=1.93*Math.cos(angle),z=1.93*Math.sin(angle);
  pine.face(needles,[[-x,0,-z],[x,0,z],[x,7.2,z],[-x,7.2,-z]],
   [[0,.96,-.28],[0,.96,.28],[0,.96,.28],[0,.96,-.28]],[[0,1],[1,1],[1,0],[0,0]])
 }
 rock.ellipsoid({color:[.29,.28,.23],rough:.91,metal:0},[0,.22,0],[1.5,.87,1.15],9,4);
 const treeParts=await game.upload(pine),rockParts=await game.upload(rock);
 const terrain=game.terrain({seed:1977,radius:3,steps:48,size:96,scatter:[
  {parts:treeParts,count:60,scale:1.12,accept:(x,y,z)=>y<77&&Math.sin(x*.022)+Math.cos(z*.017)>.05}, {parts:rockParts,count:14,scale:1.3}]});
 let x=0,z=0,yaw=.4,pitch=-.095,drag=null,last=0;
 const actions=new SKERRY.Actions({
  forward:{keys:{KeyW:1,KeyS:-1},axes:{1:-1}},side:{keys:{KeyD:1,KeyA:-1},axes:{0:1}}
 });
 const skyLight=[.66,.45,-.6];world.sun=skyLight;world.fov=.55;world.shadow=0;
 function aim(){
  const y=terrain.heightAt(x,z)+6;
  world.camera=SKERRY.basis([x,y,z],[x+Math.sin(yaw),y+Math.tan(pitch),z+Math.cos(yaw)])
 }
 aim();
 const beacon=new SKERRY.Geometry();
 beacon.box({color:[.18,.21,.23],metal:.72,rough:.27},[0,1.5,0],[.36,3,.36]);
 beacon.box({color:[1,.75,.42],emissive:[2.2,1.1,.35],metal:0,rough:.2},[0,3.1,0],[.6,.36,.6]);
 const parts=await game.upload(beacon);
 for(let i=-2;i<=2;i++){
  const px=i*8,pz=18,h=terrain.heightAt(px,pz);
  const node=world.root.attach(new SKERRY.GameNode('Light '+i,parts));node.position=[px,h,pz];
  world.lights.push({position:[px,h+3.3,pz],range:18,color:[1,.61,.32],intensity:48})
 }
 canvas.onpointerdown=e=>{drag=e.pointerId;canvas.setPointerCapture(drag)};
 canvas.onpointermove=e=>{if(e.pointerId===drag){yaw+=e.movementX*.005;pitch=Math.max(-1.35,Math.min(1.15,pitch-e.movementY*.005))}};
 canvas.onlostpointercapture=()=>drag=null;

 const forward=document.querySelector('button');
 forward.onpointerdown=e=>{actions.set('forward',1,e.pointerId);forward.setPointerCapture(e.pointerId)};forward.onlostpointercapture=e=>actions.set('forward',0,e.pointerId);
 world.systems.add(dt=>{
  const {forward:f,side:s}=actions.sample();
  x+=dt*30*(f*Math.sin(yaw)+s*Math.cos(yaw));z+=dt*30*(f*Math.cos(yaw)-s*Math.sin(yaw));aim();
  if(world.t-last>.3){last=world.t;document.querySelector('output').textContent=terrain.error?String(terrain.error):terrain.live.size+' секторов · '+(game.renderer.stats?.triangles||0).toLocaleString('ru')+' треуг.'}
 });
 game.start()
}
main().catch(error=>document.querySelector('output').textContent=error.message);
