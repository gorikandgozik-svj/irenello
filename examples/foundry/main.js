async function main(){
 const canvas=document.querySelector('canvas'),profile=document.querySelector('#profile'),meter=document.querySelector('output');
 const game=new SKERRY.Game(canvas,{profile:'aa'}),world=game.world;
 const mat=(color,rough,metal=0,extra={})=>({color,rough,metal,...extra});
 const steel=mat([.22,.29,.31],.27,.91,{kind:8}),iron=mat([.046,.064,.067],.39,.78),brass=mat([.72,.39,.115],.31,.82,{kind:8}),edge=mat([.78,.71,.53],.22,.86),teal=mat([.065,.27,.24],.39,.51,{coat:.48,coatRough:.17}),cream=mat([.43,.43,.39],.73,0,{kind:7}),orange=mat([.86,.22,.035],.36,.36),slate=mat([.085,.098,.104],.27,.27,{kind:7}),lamp=mat([.98,.79,.45],.3,.1,{emissive:[3.1,2.15,.92]});
 const hall=new SKERRY.Geometry(),TAU=2*Math.PI,cy=2.48;
 const box=(m,x,y,z,w,h,d)=>hall.box(m,[x,y,z],[w,h,d]);
 function ring(g,m,r0,r1,z0,z1,n){
  const pt=(r,a,z)=>[r*Math.cos(a),cy+r*Math.sin(a),z];
  for(let i=0;i<n;i++){
   const a=TAU*i/n,b=TAU*(i+1)/n,A=[Math.cos(a),Math.sin(a),0],B=[Math.cos(b),Math.sin(b),0];
   g.face(m,[pt(r1,a,z0),pt(r1,b,z0),pt(r1,b,z1),pt(r1,a,z1)],[A,B,B,A]);
   g.face(m,[pt(r0,a,z1),pt(r0,b,z1),pt(r1,b,z1),pt(r1,a,z1)],Array(4).fill([0,0,1]));
   g.face(m,[pt(r0,a,z0),pt(r1,a,z0),pt(r1,b,z0),pt(r0,b,z0)],Array(4).fill([0,0,-1]));
   g.face(m,[pt(r0,a,z0),pt(r0,a,z1),pt(r0,b,z1),pt(r0,b,z0)],[A,A,B,B].map(v=>[-v[0],-v[1],0]))
  }
 }
 for(let x=-7;x<7;x++)for(let z=-6;z<8;z++)box(slate,x*1.45,-.085,z*1.45,1.446,.17,1.446);
 for(let side of [-1,1]){
  box(iron,side*3.2,.015,0,.15,.03,15);
  for(let j=-20;j<21;j++)box(cream,side*3.2,.035,j*.36,.13,.013,.17);
  for(let x=0;x<3;x++)box(steel,side*(5.7+x*.21),2.9+x*.22,-2,.12,.15,10);
  for(let z=-6;z<=6;z+=3){
   box(teal,side*6,2.75,z,.3,5.5,.35);box(steel,side*6,1.1,z,.41,.12,.46);
   box(cream,side*6,4.82,z,.39,.08,.4);box(iron,0,5.65,z,12.5,.28,.18);
  }
  for(let j=-7;j<7;j++)box(steel,side*6.13,2.4,j*.9,.06,4.7,.035);
 }
 for(let x=-8;x<=8;x++)box(cream,x*.78,3.1,-7,.74,6.2,.28);
 for(let row=0;row<3;row++){
  box(iron,0,3.85+row*.55,-6.76,12.8,.042,.13);
  for(let x=-6;x<=6;x++)box(teal,x*.96,3.85+row*.55,-6.8,.89,.46,.1);
 }
 for(let j=-2;j<3;j++){box(iron,j*2.4,5.26,-1,.19,.12,12);box(lamp,j*2.4,5.18,-.8,.069,.04,6.2)}
 box(iron,0,.20,-.45,4.65,.36,2.6);box(teal,0,.43,-.45,4.36,.12,2.4);
 for(const s of [-1,1]){box(steel,s*1.56,.79,-.4,.56,.78,1.32);box(brass,s*1.56,.50,-.4,.72,.08,1.5)}
 ring(hall,teal,1.86,2.12,-1.3,-.17,112);ring(hall,steel,1.87,2.17,-.22,-.11,112);
 ring(hall,brass,1.88,2.10,-.11,-.025,112);ring(hall,iron,1.83,1.89,-.12,.055,112);
 ring(hall,iron,.02,1.9,-1.4,-1.29,96);
 for(let i=0;i<48;i++){
  const a=i*TAU/48,r=2.04;hall.ellipsoid(edge,[r*Math.cos(a),cy+r*Math.sin(a),.006],[.037,.037,.025],6,3)
 }
 for(let i=0;i<11;i++)box(i%2?orange:iron,-2+i*.4,.445,.88,.37,.05,.14);
 // Twisted blade sections across the span. Quads follow both sides and the trailing edge.
 function rotor(spans,chords){
  const g=new SKERRY.Geometry();
  for(let blade=0;blade<29;blade++){
   function p(u,v,back){
    const a=TAU*blade/29+.22*u+.24*v*(1-.41*u),r=.41+1.435*u;
    return [Math.cos(a)*r,cy+Math.sin(a)*r,.53-.59*u+.22*v*(1-.5*u)+.085*Math.sin(Math.PI*v)+back*.026]
   }
   for(let i=0;i<spans;i++)for(let j=0;j<chords;j++){
    const u=i/spans,U=(i+1)/spans,v=j/chords,V=(j+1)/chords;
    g.face(brass,[p(u,v,0),p(U,v,0),p(U,V,0),p(u,V,0)]);
    g.face(steel,[p(u,V,-1),p(U,V,-1),p(U,v,-1),p(u,v,-1)]);
    if(j===0)g.face(edge,[p(u,0,-1),p(U,0,-1),p(U,0,0),p(u,0,0)])
   }
  }
  g.ellipsoid(steel,[0,cy,.45],[.51,.51,.64],spans*3,Math.max(8,spans));
  ring(g,edge,.43,.49,.44,.49,48);
  ring(g,brass,.25,.30,.95,1.008,48);ring(g,iron,.012,.245,.975,1.012,48);
  for(let i=0;i<8;i++){const a=i*TAU/8;g.ellipsoid(edge,[.205*Math.cos(a),cy+.205*Math.sin(a),1.017],[.024,.024,.014],8,3)}
  return g
 }
 world.root.attach(new SKERRY.GameNode('Корпус',await game.upload(hall)));
 const pivot=world.root.attach(new SKERRY.GameNode('Ось'));pivot.position=[0,cy,0];
 const blades=pivot.attach(new SKERRY.GameNode('Ротор'));blades.position=[0,-cy,0];
 const lod={};for(const [key,s,c] of [['mobile',4,2],['aa',10,4],['ultra',20,8]])lod[key]=await game.upload(rotor(s,c));
 const mortar=mat([.50,.35,.23],.81),dark=mat([.24,.17,.11],.86);
 const block=new SKERRY.VoxelVolume(28,22,8,{cell:.095,materials:[mortar,dark]});
 block.brush([0,0,0],[27,21,7],(x,y,z)=>y%4===0||(x+(Math.floor(y/4)%2)*4)%9===0?2:1);
 block.mount(game,[2.5,0,-2.25],world.enablePhysics({substeps:1}));await block.flush();let cuts=0;
 const cut=()=>{const offset=cuts++%5;block.carve([3.06+.36*offset,1.43-.19*offset,-1.53],.47);return block.flush()};
 document.querySelector('#cut').onclick=cut;
 world.sun=[-.65,.49,.46];world.focus=[0,2,0];world.fov=.35;
 world.lights.push({position:[-2.8,3.9,2.6],color:[1,.66,.32],intensity:70,range:12},{position:[2.3,3.4,.7],color:[.48,.80,1],intensity:41,range:10});
 for(let z=-6;z<=6;z+=1.5)for(let x=-5;x<=5;x+=2){
  world.lights.push({position:[x,4.92,z],color:[.87,.73,.54],intensity:1.8,range:3.8})
 }
 let angle=.34,height=.13,radius=8.2,id=null,turn=0,spin=false;
 function camera(){world.camera=SKERRY.basis([Math.sin(angle)*radius,2+height*radius,Math.cos(angle)*radius],[0,2.26,-.25])}
 camera();
 function apply(name){game.setProfile(name);blades.parts=lod[name]}
 apply(profile.value||'aa');profile.onchange=()=>apply(profile.value);
 canvas.onpointerdown=e=>{id=e.pointerId;canvas.setPointerCapture(id)};canvas.onlostpointercapture=()=>id=null;
 canvas.onpointermove=e=>{if(id!==e.pointerId)return;angle-=e.movementX*.006;height=Math.max(-.13,Math.min(.67,height+e.movementY*.003));camera()};
 canvas.onwheel=e=>{e.preventDefault();radius=Math.max(4.8,Math.min(11,radius+Math.sign(e.deltaY)*.45));camera()};
 document.querySelector('#spin').onclick=()=>spin=!spin;
 world.systems.add(dt=>{if(spin){turn+=dt*.62;pivot.rotation=[0,0,Math.sin(turn/2),Math.cos(turn/2)]}
 const stats=game.renderer.stats;if(stats)meter.textContent=stats.pipeline+' · '+canvas.width+' × '+canvas.height+' · '+stats.calls+' выз. геометрии'});
 game.start();return {game,apply,cut}
}
main().catch(e=>document.querySelector('output').textContent=e.message);
