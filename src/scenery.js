const finish=(color,rough=.76,metal=0,kind=0)=>({color,rough,metal,kind});
function sceneryTypes(){
 const bark=finish([.125,.069,.038]),needles=finish([.045,.102,.06]),tip=finish([.067,.147,.076]),seat=finish([.29,.046,.027],.47),steel=finish([.18,.22,.23],.4,.64),white=finish([.68,.67,.61]),wood=finish([.42,.205,.075],.8,0,5),iron=finish([.065,.079,.089],.53,.51),rubber=finish([.03,.039,.045],.86),ball=finish([.94,.22,.048],.38,.15);
 function pine(detail){const g=new Geometry(),mat=finish([.75,.85,.66],.93);mat.image=base64bytes(PINE);mat.cut=.34;mat.kind=4;
 const planes=detail?4:2;for(let i=0;i<planes;i++){const a=Math.PI*i/planes,x=Math.cos(a)*1.73,z=Math.sin(a)*1.73;
 const n1=unit([-x*.28,.90,-z*.28]),n2=unit([x*.28,.90,z*.28]);g.face(mat,[[-x,0,-z],[x,0,z],[x,5.7,z],[-x,5.7,-z]],[n1,n2,n2,n1],[[0,1],[1,1],[1,0],[0,0]])}return g}
 function chair(detail){const g=new Geometry();g.box(seat,[0,.32,0],[.43,.07,.4]);g.box(seat,[0,.53,-.17],[.43,.41,.055]);if(detail)g.box(steel,[0,.16,0],[.07,.32,.12]);return g}
 function person(detail){let g=new Geometry();const coat=finish([.10,.19,.23]),skin=finish([.45,.28,.17]);g.ellipsoid(coat,[0,.65,0],[.20,.26,.13],detail?8:4,detail?5:3);g.ellipsoid(skin,[0,1.01,0],[.112,.128,.11],detail?8:4,detail?5:3);return g}
 function fence(detail){let g=new Geometry();g.box(steel,[0,1.30,0],[.065,2.6,.065]);g.box(steel,[1.1,2.54,0],[2.2,.036,.036]);if(detail){for(let j=0;j<12;j++)g.box(steel,[j*.19,1.60,0],[.011,1.8,.011]);for(let j=0;j<8;j++)g.box(steel,[1.04,.83+j*.22,0],[2.16,.016,.016])}return g}
 function crate(){const g=new Geometry();g.box(wood,[0,0,0],[.98,.98,.98]);for(let y of [-.41,.41]){g.box(iron,[0,y,0],[1.012,.055,1.012])}for(let x of [-.43,.43])g.box(wood,[x,0,0],[.08,.94,1.013]);return g}
 function orb(){let g=new Geometry();g.ellipsoid(ball,[0,0,0],[.49,.49,.49],24,14);return g}
 return {pine,chair,person,fence,crate,orb}
}
function decorations(){
 const t=sceneryTypes(),fields=[],seeded=(v)=>{const q=Math.sin(v*127.1+311.7)*43758.5453;return q-Math.floor(q)};
 function field(factory,opt){const records=[];fields.push({near:factory(true),far:factory(false),records,opt});return (p,s,yaw,tone)=>records.push(...p,s,Math.cos(yaw),Math.sin(yaw),tone)}
 const tree=field(t.pine,{radius:3.5,centerY:2.8,lod:88,distance:560}),chairs=field(t.chair,{radius:.6,centerY:.36,lod:50,distance:165}),people=field(t.person,{radius:.7,centerY:.58,lod:60,distance:145}),fences=field(t.fence,{radius:2.65,centerY:1.4,lod:39,distance:190});
 for(let i=0;i<8800;i++){const a=seeded(i+.12)*Math.PI*2,rad=1.13+2.3*seeded(i+.19),p=[Math.sin(a)*152*rad,-.09,Math.cos(a)*165*rad];tree(p,1.05+1.5*seeded(i+.38),a, .64+.57*seeded(i+.72))}
 for(let i=0;i<10;i++)for(const side of [-1,1]){if((i===0||i===9)&&side===-1)continue;const p=racePose(i*2*Math.PI/10);for(let row=0;row<6;row++)for(let col=0;col<31;col++){
 const pt=p.point(side*(18+.9*row),1.25+.45*row,(col-15)*.59),yaw=p.yaw+side*Math.PI/2;chairs(pt,1,yaw, .69+.43*seeded(row*31+col));if(seeded(i*137+col*13+row*17+side)>.35)people(pt,1,yaw,.53+.76*seeded(i*71+col))}}
 for(let i=0;i<300;i++){const p=racePose(i*2*Math.PI/300);for(const side of [-1,1])fences(p.point(side*12.35,0),1,p.yaw-Math.PI/2,1)}
 return fields
}
async function uploadDecor(g){const fields=[];for(const e of decorations())fields.push(new InstanceField(await g.upload(e.near),await g.upload(e.far),new Float32Array(e.records),e.opt));return fields}
