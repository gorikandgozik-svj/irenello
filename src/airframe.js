// Twin-engine demonstrator, nose toward +Z. Local geometry is in metres.
function aircraftMesh(){
 const g=new Geometry(),white=finish([.77,.81,.80],.26,.38),blue=finish([.028,.09,.145],.29,.44),glass=finish([.018,.062,.085],.11,.70),gold=finish([.85,.35,.055],.29,.61),dark=finish([.032,.040,.047],.45,.52),chrome=finish([.44,.5,.55],.25,.83);
 function shell(stations,dx=0,dy=0,engine=false){const count=40;
 const rings=stations.map(([z,y,w,r])=>Array.from({length:count},(_,j)=>{const a=j/count*2*Math.PI;return [dx+w*Math.cos(a),dy+y+r*Math.sin(a),z]}));
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<count;j++){
 const next=(j+1)%count,ids=[[i,j],[i,next],[i+1,next],[i+1,j]],a=(j+.5)/count*2*Math.PI;
 const n=ids.map(([l,k])=>unit(cross(sub(rings[l][(k+1)%count],rings[l][(k+count-1)%count]),sub(rings[Math.min(l+1,rings.length-1)][k],rings[Math.max(0,l-1)][k]))));
 const z=(stations[i][0]+stations[i+1][0])*.5,h=Math.sin(a);let mat=white;
 if(engine)mat=i===0||i===stations.length-2?chrome:(h<-.55?blue:white);
 else if(h<-.25)mat=blue;else if(h<-.13)mat=gold;
 else if(z>3.2&&z<4.9&&h>.25&&h<.84&&Math.abs(Math.cos(a))>.22)mat=glass;
 g.face(mat,ids.map(([l,k])=>rings[l][k]),n)}
 for(const l of [0,rings.length-1])for(let j=0;j<count;j++){const [z,y]=stations[l];g.face(engine?dark:white,[[dx,dy+y,z],rings[l][j],rings[l][(j+1)%count]],[[0,0,l?1:-1],[0,0,l?1:-1],[0,0,l?1:-1]])}}
 const hull=[[-7,.40,.045,.05],[-5.9,.32,.24,.26],[-4.9,.23,.45,.43],[-3.6,.16,.69,.66],[-2.4,.12,.85,.81],[-1,.12,.93,.88],[1,.12,.94,.89],[2.8,.11,.88,.86],[3.5,.09,.80,.77],[4.25,.03,.67,.63],[4.85,-.05,.50,.45],[5.4,-.15,.32,.27],[5.95,-.20,.045,.05]];
 shell(hull);
 function foil(side,stations){const count=20;for(let i=0;i<stations.length-1;i++)for(let j=0;j<count;j++){
 const pt=(k,t)=>{let [x,y,z,chord,thick]=stations[k],a=t*2*Math.PI/count;return [side*x,y+thick*Math.sin(a)+.04*Math.cos(a),z+.5*chord*Math.cos(a)]};
 const v=[pt(i,j),pt(i+1,j),pt(i+1,j+1),pt(i,j+1)];if(side<0)v.reverse();g.face(j<2||j>18?chrome:i===stations.length-2?blue:white,v)}}
 for(const s of [-1,1]){
 foil(s,[[.49,-.30,.1,3.5,.22],[1.8,-.26,-.25,2.91,.19],[4.4,-.08,-1.05,1.9,.12],[6.25,.11,-1.60,1.13,.078],[7.05,.30,-1.96,.55,.045],[7.35,1.06,-2.23,.26,.020]]);
 foil(s,[[.10,1.48,-5.8,1.80,.12],[1.3,1.49,-6.17,1.20,.078],[2.57,1.59,-6.60,.41,.045]]);
 g.box(blue,[s*.90,.32,-3.25],[1.04,.16,1.36]);shell([[-4.95,.09,.31,.32],[-4.7,.11,.40,.40],[-4.1,.11,.47,.48],[-3.25,.10,.48,.49],[-2.59,.09,.47,.47],[-2.47,.09,.43,.43]],s*1.40,.41,true);
 for(let j=0;j<7;j++){const z=-2+j*.68,w=.92-.015*Math.abs(z);g.ellipsoid(glass,[s*w,.39,z],[.057,.191,.224],12,8)}
 g.box(gold,[s*6.99,.27,-1.89],[.11,.08,.2])}
 g.face(blue,[[-.075,.5,-4.4],[-.075,2.56,-6.35],[-.075,2.66,-7.10],[-.075,.54,-6.87]]);
 g.face(blue,[[.075,.54,-6.87],[.075,2.66,-7.10],[.075,2.56,-6.35],[.075,.5,-4.4]]);
 g.face(white,[[-.075,.5,-4.4],[.075,.5,-4.4],[.075,2.56,-6.35],[-.075,2.56,-6.35]]);
 return g
}
// Express the chase camera in the aircraft's local basis, then convert to globe space.
function chaseFlight(state,sim,N,east,north,heading){
 const cr=unit(cross(heading,N)),cp=Math.cos(sim.climb+sim.alpha),sp=Math.sin(sim.climb+sim.alpha),cb=Math.cos(sim.bank),sb=Math.sin(sim.bank);
 const forward=add(vmul(heading,cp),vmul(N,sp)),up=unit(cross(cr,forward)),right=add(vmul(cr,cb),vmul(up,-sb)),top=unit(cross(right,forward));
 // Model X points to starboard, Z forward.
 const transform=v=>add(add(vmul(right,v[0]),vmul(top,v[1])),vmul(forward,v[2]));
 const az=2.645+sim.lookYaw,localEye=[Math.sin(az)*22.05,Math.tan(sim.chasePitch)*22.05,Math.cos(az)*22.05],cam=basis(localEye,[0,.0,.55]),eye=add(state.camera.eye,vmul(transform(localEye),1/RADIUS));
 // basis() uses a right-handed scene; looking down +Z its camera right points to -X.
 const f=unit(transform(cam.f)),r=unit(cross(f,N)),u=unit(cross(r,f));
 const inverse=v=>[dot(v,right),dot(v,top),dot(v,forward)];
 state.camera={eye,f,r,u};state.alt=Math.hypot(...eye)-1;
 state.actor={camera:{eye:localEye,f:inverse(f),r:inverse(r),u:inverse(u)},sun:inverse(state.sun),parts:sim.airframe};
}
