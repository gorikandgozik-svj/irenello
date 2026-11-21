(() => {
class Clock{
 constructor(hz=60){
  if(!Number.isInteger(hz)||hz<1||hz>1000)throw RangeError('Fixed tick frequency must be between 1 and 1000 Hz');
  this.acc=0;this.step=1/hz
 }
 tick(delta,update){
  this.acc+=Math.min(.1,Math.max(0,delta));
  while(this.acc+1e-10>=this.step){update(this.step);this.acc-=this.step}
 }
}

function compileProgram(v,f){
  const gl=this.gl,p=gl.createProgram(),u={},a={};
  for(const [type,source] of [[gl.VERTEX_SHADER,v],[gl.FRAGMENT_SHADER,f]]){
   const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
   if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);gl.deleteShader(s)}
  gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
  for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i++){let name=gl.getActiveUniform(p,i).name;u[name]=gl.getUniformLocation(p,name)}
  for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_ATTRIBUTES);i++){let name=gl.getActiveAttrib(p,i).name;a[name]=gl.getAttribLocation(p,name)}
  return {p,u,a}
 }

const M={
 id:()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
 mul(a,b){return Array.from({length:16},(_,i)=>{let r=i%4,c=i-r;return a[r]*b[c]+a[r+4]*b[c+1]+a[r+8]*b[c+2]+a[r+12]*b[c+3]})},
 trs(t=[0,0,0],q=[0,0,0,1],s=[1,1,1]){let [x,y,z,w]=q;
 return [(1-2*(y*y+z*z))*s[0],2*(x*y+w*z)*s[0],2*(x*z-w*y)*s[0],0,2*(x*y-w*z)*s[1],(1-2*(x*x+z*z))*s[1],2*(y*z+w*x)*s[1],0,2*(x*z+w*y)*s[2],2*(y*z-w*x)*s[2],(1-2*(x*x+y*y))*s[2],0,...t,1]},
 point(m,v){return [0,1,2].map(i=>m[i]*v[0]+m[i+4]*v[1]+m[i+8]*v[2]+m[i+12])},
 normal(m,n){const a=m.slice(0,3),b=m.slice(4,7),c=m.slice(8,11),u=cross(b,c),v=cross(c,a),w=cross(a,b);return unit(u.map((x,i)=>(x*n[0]+v[i]*n[1]+w[i]*n[2])*Math.sign(dot(a,u))))}
};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]),vmul=(a,k)=>a.map(v=>v*k),unit=v=>vmul(v,1/(Math.hypot(...v)||1)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function basis(eye,target,up=[0,1,0]){let f=unit(sub(target,eye)),r=unit(cross(f,Math.abs(dot(f,up))>.9999?(Math.abs(f[0])<.9?[1,0,0]:[0,0,1]):up));return {eye,f,r,u:unit(cross(r,f))}}
function racePose(t){const x=68*Math.sin(t)+14*Math.sin(2*t),z=108*Math.cos(t)+13*Math.sin(3*t),dx=68*Math.cos(t)+28*Math.cos(2*t),dz=-108*Math.sin(t)+39*Math.cos(3*t);
 const yaw=Math.atan2(dx,dz),s=Math.sin(yaw),c=Math.cos(yaw);
 return {x,z,yaw,s,c,rate:Math.hypot(dx,dz),point:(side,y,ahead=0)=>[x+side*c+ahead*s,y,z-side*s+ahead*c]}}
const RADIUS=6371000;
function geo(lat,lon){return [Math.cos(lat)*Math.cos(lon),Math.sin(lat),-Math.cos(lat)*Math.sin(lon)]}
function advanceGeo(lat,lon,bearing,meters){let d=meters/RADIUS,sl=Math.sin(lat),cl=Math.cos(lat),a=Math.asin(clamp(sl*Math.cos(d)+cl*Math.sin(d)*Math.cos(bearing),-1,1));return [a,Math.atan2(Math.sin(lon+Math.atan2(Math.sin(bearing)*Math.sin(d)*cl,Math.cos(d)-sl*Math.sin(a))),Math.cos(lon+Math.atan2(Math.sin(bearing)*Math.sin(d)*cl,Math.cos(d)-sl*Math.sin(a))))]}

function base64bytes(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
function glb(bytes){
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length<20||v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==bytes.length)throw Error('Некорректный GLB 2.0');
 let doc,bin;for(let i=12;i<bytes.length;){const len=v.getUint32(i,true),type=v.getUint32(i+4,true);if(i+8+len>bytes.length)throw Error('Повреждённый блок GLB');const section=bytes.subarray(i+8,i+8+len);
 if(type===0x4e4f534a)doc=JSON.parse(new TextDecoder().decode(section));else if(type===0x004e4942)bin=section;i+=8+len}return {doc,bin}
}
async function importModel(bytes,resolve=async()=>{throw Error('Требуется файл ресурса')}){
 const byteBudget=128*1024*1024;
 if(!Number.isSafeInteger(bytes?.byteLength)||bytes.byteLength>byteBudget)throw RangeError('Слишком большой файл модели');
 let remainingScalars=16*1024*1024;
 const {doc,bin}=bytes[0]===0x67?glb(bytes):{doc:JSON.parse(new TextDecoder().decode(bytes))};
 if(doc.asset?.version!=='2.0'||doc.extensionsRequired?.length)throw Error('Нужен glTF 2.0 без обязательных расширений');
 const resource=async uri=>uri.startsWith('data:')?base64bytes(uri.slice(uri.indexOf(',')+1)):resolve(decodeURIComponent(uri));
 const buffers=await Promise.all((doc.buffers||[]).map(b=>b.uri?resource(b.uri):bin));
 function view(i){const v=doc.bufferViews[i],buf=buffers[v.buffer],start=v.byteOffset||0;if(!buf||!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(v.byteLength)||v.byteLength<0||start+v.byteLength>buf.length)throw Error('Повреждённый bufferView');return buf.subarray(start,start+v.byteLength)}
 const images=await Promise.all((doc.images||[]).map(async im=>im.uri?resource(im.uri):view(im.bufferView)));
 const types={5120:['getInt8',1,127],5121:['getUint8',1,255],5122:['getInt16',2,32767],5123:['getUint16',2,65535],5125:['getUint32',4,4294967295],5126:['getFloat32',4,1]};
 function attribute(i,type){const a=doc.accessors[i],b=doc.bufferViews[a.bufferView];if(a.type!==type||a.sparse||!b)throw Error('Sparse accessor пока не поддерживается');const arr=view(a.bufferView),v=new DataView(arr.buffer,arr.byteOffset,arr.byteLength);
 if(!Object.hasOwn(types,a.componentType))throw Error('Некорректный тип компонента');
 const [method,size,max]=types[a.componentType],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],stride=b.byteStride||n*size;
 const start=a.byteOffset??0,packed=n*size;
 if(!n||!Number.isSafeInteger(a.count)||a.count<1||!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(stride)||stride<packed||start+(a.count-1)*stride+packed>arr.byteLength)throw Error('Атрибут выходит за границы буфера');
 remainingScalars-=a.count*n;if(remainingScalars<0)throw RangeError('Превышен бюджет декодирования модели');
 return Array.from({length:a.count},(_,j)=>Array.from({length:n},(_,k)=>{let value=v[method]((a.byteOffset||0)+j*stride+k*size,true);if(!Number.isFinite(value))throw Error('Нечисловой компонент модели');return a.normalized?Math.max(-1,value/max):value}))}
 const parts=[],bounds=[[Infinity,Infinity,Infinity],[-Infinity,-Infinity,-Infinity]],path=new Set(),visited=new Set();
 function visit(id,parent){
 if(path.has(id)||visited.has(id)||path.size>128)throw Error('Некорректная иерархия');path.add(id);visited.add(id);
 const node=doc.nodes[id],m=M.mul(parent,node.matrix||M.trs(node.translation,node.rotation,node.scale));
 if(node.skin!==undefined)throw Error('Скиннинг пока не поддерживается');
 for(const p of doc.meshes?.[node.mesh]?.primitives||[]){
  if((p.mode??4)!==4)throw Error('Поддерживаются треугольные сетки');
  const material=doc.materials?.[p.material]||{},mr=material.pbrMetallicRoughness||{};
  const pos=attribute(p.attributes.POSITION,'VEC3').map(v=>M.point(m,v)),norm=p.attributes.NORMAL===undefined?null:attribute(p.attributes.NORMAL,'VEC3').map(n=>M.normal(m,n));
  const uv=p.attributes.TEXCOORD_0===undefined?null:attribute(p.attributes.TEXCOORD_0,'VEC2'),idx=p.indices===undefined?pos.map((_,i)=>i):attribute(p.indices,'SCALAR').flat();
  if(norm&&norm.length!==pos.length||uv&&uv.length!==pos.length||pos.some(v=>v.length!==3||!v.every(Number.isFinite)))throw Error('Некорректные атрибуты модели');
  if(idx.length%3)throw Error('Неполный треугольник');
  for(const point of pos)for(let j=0;j<3;j++){bounds[0][j]=Math.min(bounds[0][j],point[j]);bounds[1][j]=Math.max(bounds[1][j],point[j])}
  const tex=doc.textures?.[mr.baseColorTexture?.index],mat={coat:material.extensions?.KHR_materials_clearcoat?.clearcoatFactor??0,coatRough:material.extensions?.KHR_materials_clearcoat?.clearcoatRoughnessFactor??.1,blend:material.alphaMode==='BLEND',color:mr.baseColorFactor||[1,1,1,1],metal:mr.metallicFactor??1,rough:mr.roughnessFactor??1,image:tex?images[tex.source]:null,mrImage:images[doc.textures?.[mr.metallicRoughnessTexture?.index]?.source],normalImage:images[doc.textures?.[material.normalTexture?.index]?.source],normalScale:material.normalTexture?.scale??1,emissive:material.emissiveFactor||[0,0,0],cut:material.alphaMode==='MASK'?(material.alphaCutoff??.5):0};
  let vertices=[],indices=[],map=new Map();function push(){if(indices.length)parts.push({vertices,indices,mat,nodeName:node.name||''});vertices=[];indices=[];map=new Map()}
  for(let j=0;j<idx.length;j+=3){if(vertices.length/8>65530)push();
   const tri=idx.slice(j,j+3);if(tri.some(k=>!Number.isInteger(k)||k<0||k>=pos.length))throw Error('Индекс за границами сетки');
   const face=norm?null:unit(cross(sub(pos[tri[1]],pos[tri[0]]),sub(pos[tri[2]],pos[tri[0]])));
   for(const k of tri){let index=norm?map.get(k):undefined;if(index===undefined){index=vertices.length/8;vertices.push(...pos[k],...(norm?norm[k]:face),...(uv?.[k]||[0,0]));map.set(k,index)}indices.push(index)}
  }push()
 }
 for(const child of node.children||[])visit(child,m);path.delete(id)
 }
 for(const root of doc.scenes?.[doc.scene??0]?.nodes||[])visit(root,M.id());if(!parts.length)throw Error('В сцене нет сеток');return {parts,bounds}
}

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

// One variant owns one shared mesh. Each instance record is xyz, scale, cos(yaw), sin(yaw), luminance.
class InstanceField {
 constructor(near,far,records,{radius=1,centerY=0,lod=75,distance=450}={}){Object.assign(this,{near,far,records,radius,centerY,lod,distance});this.rebuild()}
 rebuild(){const cells=new Map(),a=this.records;for(let i=0;i<a.length;i+=7){const x=a[i],y=a[i+1]+this.centerY*a[i+3],z=a[i+2],r=this.radius*a[i+3],key=Math.floor(x/32)+'/'+Math.floor(z/32);
 let c=cells.get(key);if(!c){c={ids:[],lo:[Infinity,Infinity,Infinity],hi:[-Infinity,-Infinity,-Infinity]};cells.set(key,c)}c.ids.push(i);
 [x,y,z].forEach((v,k)=>{c.lo[k]=Math.min(c.lo[k],v-r);c.hi[k]=Math.max(c.hi[k],v+r)})}
 this.cells=[...cells.values()].map(c=>{const center=vmul(add(c.hi,c.lo),.5);return {ids:c.ids,center,r:Math.hypot(...sub(c.hi,center))}})}
 select(camera,lens,aspect,shadow,focus,budget=1){
  const near=[],far=[],{eye,f,r,u}=camera,hx=lens*aspect,sx=Math.hypot(1,hx),sy=Math.hypot(1,lens);
  const distance=this.distance*(.55+.45*budget),lod=this.lod*(.65+.35*budget);this.tested=0;
  for(const cell of this.cells){const [x,y,z]=cell.center,R=cell.r;
   if(shadow){if(Math.hypot(x-focus[0],y-focus[1],z-focus[2])>34+R)continue}
   else{const v=sub(cell.center,eye),depth=dot(v,f);if(depth< -R||dot(v,v)>(distance+R)**2||Math.abs(dot(v,r))>depth*hx+R*sx||Math.abs(dot(v,u))>depth*lens+R*sy)continue}
   for(const i of cell.ids){this.tested++;const a=this.records,s=a[i+3],rad=this.radius*s,x=a[i],y=a[i+1]+this.centerY*s,z=a[i+2];
   const dx=x-eye[0],dy=y-eye[1],dz=z-eye[2],d2=dx*dx+dy*dy+dz*dz;
   if(shadow){if(Math.hypot(x-focus[0],y-focus[1],z-focus[2])>34+rad)continue}
   else{const depth=dx*f[0]+dy*f[1]+dz*f[2];if(depth< -rad||d2>(distance+rad)**2||Math.abs(dx*r[0]+dy*r[1]+dz*r[2])>depth*hx+rad*sx||Math.abs(dx*u[0]+dy*u[1]+dz*u[2])>depth*lens+rad*sy)continue}
   if(!shadow&&budget<1&&d2>lod**2&&((i/7*137)%997)/997>budget)continue;const target=d2<lod**2?near:far;for(let j=0;j<7;j++)target.push(a[i+j])
  }}
  return [{parts:this.near,records:new Float32Array(near)},{parts:this.far,records:new Float32Array(far)}].filter(o=>o.records.length)
 }
}
class Geometry {
 constructor(){this.parts=[];this.bins=new Map()}
 face(mat,pts,normals=null,uv=null){let p=this.bins.get(mat);if(!p||p.vertices.length>65500*8){p={vertices:[],indices:[],mat};this.bins.set(mat,p);this.parts.push(p)}
 const k=p.vertices.length/8,n=unit(cross(sub(pts[1],pts[0]),sub(pts[2],pts[0])));
 pts.forEach((v,j)=>p.vertices.push(...v,...(normals?.[j]||n),...(uv?.[j]||[0,0])));for(let j=1;j<pts.length-1;j++)p.indices.push(k,k+j,k+j+1)}
 box(mat,center,size){const pts=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(v=>v.map((k,i)=>center[i]+k*size[i]/2));
 for(const f of [[0,3,2,1],[4,5,6,7],[1,2,6,5],[0,4,7,3],[3,7,6,2],[0,1,5,4]])this.face(mat,f.map(i=>pts[i]))}
 ellipsoid(mat,c,r,n=10,m=6){const point=(i,j)=>{let a=i*2*Math.PI/n,b=j*Math.PI/m-Math.PI/2;return [Math.cos(a)*Math.cos(b),Math.sin(b),Math.sin(a)*Math.cos(b)]};
 for(let j=0;j<m;j++)for(let i=0;i<n;i++){const v=[point(i,j),point(i,j+1),point(i+1,j+1),point(i+1,j)];this.face(mat,v.map(q=>q.map((x,k)=>c[k]+x*r[k])),v.map(q=>unit(q.map((x,k)=>x/r[k]))))}}
}

const shared=`
precision highp float;
uniform vec3 eye,cf,cr,cu,sun,focus,lightX,lightY;
uniform vec2 clipZ;uniform float fogDensity;uniform vec2 lens;uniform vec4 crop;
float h(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.11369,.13787));q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
float fb(vec2 p){return .53*noise2(p)+.27*noise2(p*2.03+7.)+.13*noise2(p*4.17)+.07*noise2(p*8.31);}
vec3 skyColor(vec3 v){
 float y=max(0.,v.y),ss=max(0.,dot(v,sun));vec3 base=mix(vec3(.75,.805,.83),vec3(.185,.405,.64),1.-exp(-3.3*y));
 vec2 u=v.xz/max(y+.045,.05);float cloud=fb(u*vec2(.76,1.8));
 base=mix(base,vec3(.93,.90,.85),smoothstep(.47,.70,cloud)*smoothstep(.01,.17,y)*.78);
 float a=atan(v.x,v.z);float ridge=.020+.035*noise2(vec2(a*8.,3.))+.012*noise2(vec2(45.*a,2.));
 base=mix(vec3(.50,.57,.56),base,smoothstep(ridge-.002,ridge+.002,v.y));
 return base+vec3(1.,.85,.61)*(.12*pow(ss,9.)+.40*pow(ss,220.)+smoothstep(.9996,.99995,ss));
}
vec3 lightSpace(vec3 w){vec3 p=w-focus;return vec3(dot(p,lightX)/12.,dot(p,lightY)/12.,-dot(p,sun)/28.);}
`;
const vs2=shared+`attribute vec4 instancePos;attribute vec3 instanceTurn;varying float variation;attribute vec3 p,n;attribute vec2 uv;attribute vec4 tangent;varying vec4 tanFrame;uniform mat4 model;uniform mat3 normalFrame;uniform float shadowPass;
varying vec3 wp,wn;varying vec2 tex;
vec3 spinY(vec3 v){return vec3(v.x*instanceTurn.x+v.z*instanceTurn.y,v.y,v.z*instanceTurn.x-v.x*instanceTurn.y);}
void main(){vec3 local=spinY(p)*instancePos.w+instancePos.xyz;wp=(model*vec4(local,1.)).xyz;wn=normalize(normalFrame*spinY(n));tex=uv;variation=instanceTurn.z;tanFrame=vec4(mat3(model)*spinY(tangent.xyz),tangent.w);
 if(shadowPass>.5){gl_Position=vec4(lightSpace(wp),1.);return;}
 vec3 v=wp-eye;float z=dot(v,cf);vec2 xy=vec2(dot(v,cr),dot(v,cu))/lens;
 gl_Position=vec4((xy-z*crop.zw)/crop.xy,z*clipZ.x-clipZ.y,z);}`;
const ibl=`
uniform sampler2D lighting;uniform float hasIBL;
vec3 environment(vec3 v,float rough){if(hasIBL<.5)return skyColor(v);
 vec2 pos=vec2(fract(.5+atan(v.z,v.x)/6.2831853+.08),clamp(.5-asin(clamp(v.y,-1.,1.))/3.14159265,.001,.999)*.5);
 vec3 sharp=texture2D(lighting,pos).rgb,blur=texture2D(lighting,pos+vec2(0.,.5)).rgb;
 return mix(exp(sharp*4.1744)-1.,exp(blur*4.1744)-1.,rough*rough)*.5;}
vec3 grade(vec3 c){return pow(clamp(c*(2.51*c+.03)/(c*(2.43*c+.59)+.14),0.,1.),vec3(.4545));}
`;
const fs2=shared+ibl+`varying vec3 wp,wn;varying vec2 tex;varying float variation;uniform vec4 tint;uniform vec3 carContact;uniform sampler2D roadReflection;uniform vec2 framePixels;uniform float useReflection;
uniform vec4 lamp0,lamp1,lamp2,lamp3;
uniform vec3 power0,power1,power2,power3;
vec3 pointBRDF(vec4 lamp,vec3 power,vec3 P,vec3 N,vec3 V,vec3 diffuse,vec3 f0,float rough){
 vec3 delta=lamp.xyz-P;float d2=max(.001,dot(delta,delta));float reach=lamp.w;
 if(reach<=0.||d2>=reach*reach)return vec3(0.);
 vec3 L=delta*inversesqrt(d2),H=normalize(L+V);float nl=max(0.,dot(N,L)),nv=max(.001,dot(N,V));
 float nh=max(0.,dot(N,H)),vh=max(0.,dot(V,H)),a=pow(rough,4.);
 float den=nh*nh*(a-1.)+1.,k=(rough+1.)*(rough+1.)*.125;
 vec3 f=f0+(1.-f0)*pow(1.-vh,5.);
 float visibility=.25/max(.001,(nv*(1.-k)+k)*(nl*(1.-k)+k));
 float cutoff=clamp(1.-pow(d2/(reach*reach),2.),0.,1.);
 return power*nl*cutoff*cutoff/max(.09,d2)*((1.-f)*diffuse/3.14159+f*a*visibility/max(.000001,3.14159*den*den));
}
uniform vec2 coatLayer;uniform vec4 material;uniform float shadowPass,shadowSize,cut;
uniform sampler2D shadowTex,albedo,mrMap,normalMap;uniform vec3 emission;uniform float normalScale,alphaBlend;varying vec4 tanFrame;
vec3 packZ(float v){vec3 e=fract(v*vec3(1.,255.,65025.));return e-e.yzz*vec3(1./255.,1./255.,0.);}
float unpackZ(vec3 x){return dot(x,vec3(1.,1./255.,1./65025.));}
float visibility(vec3 N){
 if(shadowSize<1.)return 1.;vec3 sp=lightSpace(wp)*.5+.5;
 if(min(min(sp.x,sp.y),sp.z)<0.||max(max(sp.x,sp.y),sp.z)>1.)return 1.;
 float lit=0.;float bias=.0011+.0026*(1.-max(0.,dot(N,sun)));
 for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++){vec2 uv=sp.xy+vec2(float(i),float(j))/shadowSize;lit+=step(sp.z-bias,unpackZ(texture2D(shadowTex,uv).rgb));}
 return lit/9.;}
void main(){
 vec4 sampleColor=texture2D(albedo,tex);if(tint.a*sampleColor.a<cut)discard;
 if(shadowPass>.5){gl_FragColor=vec4(packZ(gl_FragCoord.z),1.);return;}
 vec3 N=normalize(wn);if(material.w>.5){vec3 T=normalize(tanFrame.xyz-N*dot(N,tanFrame.xyz)),B=cross(N,T)*tanFrame.w;vec3 n=texture2D(normalMap,tex).xyz*2.-1.;N=normalize(mat3(T,B,N)*vec3(n.xy*normalScale,n.z));}vec3 V=normalize(eye-wp),H=normalize(V+sun);vec4 mr=texture2D(mrMap,tex);float metal=material.x*mr.b,rough=clamp(material.y*mr.g,.065,1.);
 float film=0.;vec3 color=variation*tint.rgb*pow(sampleColor.rgb,vec3(2.2));
 if(material.z>7.5){
 float brushed=noise2(vec2(wp.y*148.+wp.x*31.,wp.z*2.+wp.x*.7));
 color*=.91+.11*brushed;rough=clamp(rough+(.5-brushed)*.085,.08,.98);
 }else if(material.z>6.5){
 vec2 p=abs(N.y)>.7?wp.xz:(abs(N.z)>.7?wp.xy:wp.zy);
 float pores=fb(p*3.2),grain=noise2(p*67.);vec2 hole=fract(p/vec2(1.22,1.7))-.5;
 float pit=1.-smoothstep(.005,.015,length(hole));color*=.72+.29*pores+.13*grain-.48*pit;
 rough=clamp(rough+.09*(grain-.5),.1,1.);
 }else if(material.z>5.5){
 float slope=smoothstep(.18,.57,1.-N.y),rock=fb(wp.xz*.12+wp.y*.09);
 float turf=fb(wp.xz*.028);color=mix(mix(vec3(.075,.13,.050),vec3(.31,.32,.13),turf),mix(vec3(.14,.14,.13),vec3(.48,.44,.38),rock),slope);
 float fine=noise2(wp.xz*2.7),grain=noise2(wp.zx*7.1);
 color*=.67+.34*fine+.29*grain;
 N=normalize(N+vec3(fine-.5,0.,grain-.5)*.21);
 rough=mix(.92,.69,slope);
 }else if(material.z>4.5){float grain=fb(wp.xy*vec2(2.,31.)+wp.z*vec2(7.,1.));color*=.62+grain*.64;}
 else if(material.z>3.5){color*=1.12;}else if(material.z>2.5){
  vec2 rock=wp.xz*6.+wp.y*vec2(.72,1.4);float f=fb(rock),detail=noise2(rock*17.);
  vec3 stone=mix(vec3(.13,.12,.11),vec3(.37,.33,.28),f*.8+.2*detail);
  float meadow=smoothstep(.67,.93,N.y)*(1.-smoothstep(1.5,2.5,wp.y+f*.35));
  vec3 pine=mix(vec3(.028,.068,.044),vec3(.13,.18,.091),fb(wp.xz*22.));
 color=mix(stone,pine,meadow);float snow=smoothstep(2.95,3.22,wp.y+1.14*(N.y-.78)+.31*f+.09*detail);
 color=mix(color,vec3(.77,.84,.89)*(.90+.12*detail),snow)*mix(.47,1.,tex.x);
 N=normalize(N+vec3(f-.5,0.,detail-.5)*.14);
 }else if(material.z>.5){float a=noise2(wp.xz*17.71+vec2(.21,.31)),b=fb(wp.xz*.22);
 if(material.z<1.5){
  float tyre=(1.-smoothstep(.19,.75,abs(abs(tex.x+.30*sin(tex.y*.027))-1.04)));float wet=smoothstep(.43,.63,fb(wp.xz*.59+vec2(3.,1.)));
  film=wet;color*=mix(.62,.31,wet)*mix(1.,.72,tyre);rough=mix(.80,.14,wet*.91);metal=.035;
 }color*=.50+.43*b+.23*a;N=normalize(N+vec3(a-.5,0.,noise2(wp.zx*41.)-.5)*.055);}
 float nl=max(dot(N,sun),0.),nv=max(dot(N,V),.001),nh=max(dot(N,H),.001),vh=max(dot(V,H),0.);
 float a2=pow(rough,4.),den=nh*nh*(a2-1.)+1.,D=a2/(3.14159*den*den);
 float k=pow(rough+1.,2.)*.125,G=nv/(nv*(1.-k)+k)*nl/(nl*(1.-k)+k);
 vec3 F0=mix(vec3(.04),color,metal),F=F0+(1.-F0)*pow(1.-vh,5.);
 float vis=visibility(N);vec3 diff=(1.-F)*(1.-metal)*color;
 vec3 refl=reflect(-V,N);vec3 env=environment(refl,rough);
 vec3 c=(diff/3.14159+F*D*G/max(.004,4.*nv*nl))*vec3(3.4,3.12,2.8)*nl*vis;
 c+=color*(1.-metal)*(.055+.32*clamp(environment(N,1.),0.,2.))*(.64+.36*vis);
 c+=env*(F0+(1.-F0)*pow(1.-nv,5.)*.62)*(.83-.35*rough);
 if(carContact.x>.5 && material.z>.5 && material.z<1.5){
 vec2 delta=wp.xz-focus.xz;vec2 car=vec2(dot(delta,vec2(carContact.z,-carContact.y)),dot(delta,carContact.yz));float ao=exp(-dot(car*vec2(.92,.48),car*vec2(.92,.48))*1.6);
 c*=1.-.68*ao;}
 if(lamp0.w>0.){
 vec3 baseDiffuse=(1.-metal)*color;
 c+=pointBRDF(lamp0,power0,wp,N,V,baseDiffuse,F0,rough)+pointBRDF(lamp1,power1,wp,N,V,baseDiffuse,F0,rough)
   +pointBRDF(lamp2,power2,wp,N,V,baseDiffuse,F0,rough)+pointBRDF(lamp3,power3,wp,N,V,baseDiffuse,F0,rough);}
 if(coatLayer.x>0.){
 float gloss=clamp(coatLayer.y,.06,1.),aa=pow(gloss,4.),d=nh*nh*(aa-1.)+1.;
 float fc=.04+.96*pow(1.-vh,5.),fv=.04+.96*pow(1.-nv,5.);
 c=c*(1.-coatLayer.x*fv)+coatLayer.x*(environment(refl,gloss)*fv+
 vec3(3.4,3.12,2.8)*vis*nl*fc*aa/max(.000001,3.14159*d*d*4.*max(nv,nl)));}
 c+=emission;c=grade(c*.74);
 if(useReflection>.5 && film>.0){vec2 uv=((gl_FragCoord.xy/framePixels*2.-1.)*crop.xy+crop.zw)*.5+.5;
 vec2 ripple=vec2(N.x,N.z)*.015;vec3 reflection=texture2D(roadReflection,clamp(uv+ripple,.001,.999)).rgb;
 c=mix(c,reflection,film*(.18+.61*pow(1.-nv,3.)));}
 float fog=1.-exp(-length(eye-wp)*(material.z>2.5&&material.z<3.5?.026:fogDensity));gl_FragColor=vec4(mix(c,vec3(.73,.78,.8),fog),mix(1.,tint.a*sampleColor.a,alphaBlend));}
`;
const bgVS='attribute vec2 p;varying vec2 ndc;void main(){ndc=p;gl_Position=vec4(p,0,1);}';
const bgFS=shared+ibl+`varying vec2 ndc;uniform sampler2D earth;uniform float planet,time,altRatio,clouds;
float cloudDensity(vec3 p){
 float slice=floor(p.y),fy=fract(p.y);fy=fy*fy*(3.-2.*fy);
 return mix(fb(p.xz+slice*17.),fb(p.xz+(slice+1.)*17.),fy);
}
vec3 cloudLayer(vec3 sky,vec3 ray){
 if(clouds<=0.||abs(ray.y)<.008)return sky;
 float a=(2150.-eye.y)/ray.y,b=(3150.-eye.y)/ray.y;
 float enter=max(0.,min(a,b)),leave=min(50000.,max(a,b));
 if(leave<=enter)return sky;
 float ds=(leave-enter)/20.,trans=1.;vec3 scatter=vec3(0.);
 for(int i=0;i<20;i++){
  vec3 p=eye+ray*(enter+(float(i)+.5)*ds);
  float height=(p.y-2150.)*.001;
  vec3 q=p*vec3(.00057,.0026,.00057)+vec3(time*.007,0.,0.);
  float rho=smoothstep(.43,.68,cloudDensity(q))*smoothstep(0.,.18,height)*(1.-smoothstep(.72,1.,height));
  float alpha=1.-exp(-rho*ds*.003*clouds);
  float lit=1.-.65*smoothstep(.44,.67,cloudDensity(q+sun*.48));
  scatter+=trans*alpha*mix(vec3(.48,.55,.64),vec3(1.,.96,.88),lit);
  trans*=1.-alpha;if(trans<.015)break;
 }return mix(sky,scatter+trans*sky,smoothstep(.015,.13,abs(ray.y)));
}
void main(){vec2 screen=ndc*crop.xy+crop.zw;vec3 r=normalize(cf+cr*screen.x*lens.x+cu*screen.y*lens.y);
 if(planet<.5){vec3 photo=grade(environment(normalize(vec3(r.x,max(.32,r.y),r.z)),0.)*.82);
 float a=atan(r.x,r.z);float ridge=.016+.055*fb(vec2(a*6.,4.))+.010*noise2(vec2(a*37.,1.));
 vec3 haze=mix(vec3(.52,.61,.69),vec3(.90,.73,.57),pow(max(0.,dot(r,sun)),4.));
 vec3 sky=mix(haze,photo,smoothstep(.01,.35,r.y));
 vec3 horizon=clouds>0.?mix(vec3(.73,.78,.8),sky,smoothstep(.0,.16,r.y)):mix(haze*.76,sky,smoothstep(ridge-.002,ridge+.002,r.y));
 gl_FragColor=vec4(cloudLayer(horizon,r),1.);return;}
 float localY=dot(normalize(eye),r),altFade=1.-smoothstep(.005,.022,altRatio);
 float daySky=smoothstep(-.16,.23,dot(normalize(eye),sun));vec3 air=mix(vec3(.67,.77,.85),vec3(.18,.43,.72),smoothstep(0.,.64,localY))*mix(.12,1.,daySky);
 if(altFade>.01 && localY>-.03 && altRatio<.00145){
 float p=dot(eye,r),radiusCloud=1.00145,travel=-p+sqrt(max(0.,p*p+radiusCloud*radiusCloud-dot(eye,eye)));
 vec3 location=(eye+r*travel)*560.;vec2 u=location.xz+location.y*.34;
 float trans=1.;vec3 scattered=vec3(0.);
 for(int j=0;j<10;j++){
 float f=(float(j)+.5)/10.;vec3 at=location+(r*1.1/max(.12,localY))*f;
 vec2 drift=vec2(.0009,.00035)*mod(time,20000.);
 float vapor=fb((at.xz+at.y*.34)*vec2(.52,1.25)+drift)+.18*noise2(at.xy*3.+drift);
 float profile=4.*f*(1.-f),density=max(0.,vapor-.53)*profile;
 float alpha=1.-exp(-density*1.65/max(.2,localY));
 scattered+=trans*alpha*mix(vec3(.59,.65,.72),vec3(1.,.96,.87),f)*mix(.16,1.,daySky);
 trans*=1.-alpha;}
 air=air*trans+scattered;}
 float b=dot(eye,r),c=altRatio*(2.+altRatio),disc=b*b-c;
 float glow=exp(-abs(disc)*25.);vec3 space=vec3(.008,.013,.027)+glow*vec3(.07,.23,.42)*step(b,0.);
 if(b>=0.||disc<0.){gl_FragColor=vec4(mix(space,air,altFade),1.);return;}
 float t=c/(-b+sqrt(disc));vec3 N=normalize(eye+t*r);
 vec2 uv=vec2(.5+atan(-N.z,N.x)/6.2831853,.5-asin(clamp(N.y,-1.,1.))/3.14159265);
 vec3 base=texture2D(earth,uv).rgb;float ocean=smoothstep(.01,.10,base.b-base.r);
 float day=dot(N,sun),ndv=max(dot(N,-r),0.);
 vec2 cloudUV=N.xz*7.+N.y*vec2(3.,5.);
 vec2 swirl=vec2(fb(N.xy*9.+N.z*3.),fb(N.zy*11.-N.x*5.))-.5;
 vec3 Q=N*13.;float field=.39*fb(Q.xy+swirl*3.)+.34*fb(Q.yz+swirl*4.)+.27*fb(Q.zx-swirl*3.);
 float bands=sin(N.y*38.+swirl.x*11.+swirl.y*7.);
 float filament=fb(Q.xy*3.1+Q.z*.7+swirl*8.);
 float clouds=smoothstep(.49,.66,field+.073*bands+.14*(filament-.5));
 vec3 surface=mix(base,vec3(.90,.92,.92),clouds*.83);
 surface*=.14+.97*smoothstep(-.10,.75,day);
 surface+=vec3(.96,.78,.47)*pow(max(0.,dot(reflect(-sun,N),-r)),75.)*.50*ocean*(1.-clouds);
 float rim=pow(1.-ndv,3.);surface=mix(surface,vec3(.32,.59,.83),rim*.72*smoothstep(-.35,.25,day));
 surface=mix(surface,air,altFade*(1.-exp(-t*135.)));gl_FragColor=vec4(surface,1.);}`;
function tangentData(part){
 const v=part.vertices,t=new Float32Array(v.length/8*4),bit=new Float32Array(t.length);
 for(let i=0;i<part.indices.length;i+=3){const ids=part.indices.slice(i,i+3),[a,b,c]=ids.map(k=>k*8);
 const u1=v[b+6]-v[a+6],u2=v[c+6]-v[a+6],v1=v[b+7]-v[a+7],v2=v[c+7]-v[a+7],det=u1*v2-v1*u2;if(Math.abs(det)<1e-12)continue;
 for(let j=0;j<3;j++){const e=v[b+j]-v[a+j],f=v[c+j]-v[a+j];for(const id of ids){t[id*4+j]+=(e*v2-f*v1)/det;bit[id*4+j]+=(f*u1-e*u2)/det}}}
 for(let i=0;i<t.length;i+=4){const n=v.slice(i*2+3,i*2+6);let a=Array.from(t.slice(i,i+3));if(Math.hypot(...a)<.001)a=cross(n,Math.abs(n[1])<.9?[0,1,0]:[1,0,0]);a=unit(a);t.set(a,i);t[i+3]=dot(cross(n,a),bit.slice(i,i+3))<0?-1:1}return t
}
function meshInFrustum(object,camera,fov,aspect){
 const bounds=object.bounds||(object.records?null:object.parts.bounds);if(!bounds)return true;
 const m=object.model,c=sub(M.point(m,bounds.center),camera.eye),e=bounds.extent;
 const planes=[camera.f,add(vmul(camera.f,fov*aspect),camera.r),sub(vmul(camera.f,fov*aspect),camera.r),add(vmul(camera.f,fov),camera.u),sub(vmul(camera.f,fov),camera.u)];
 for(const n of planes){
  const radius=e[0]*Math.abs(n[0]*m[0]+n[1]*m[1]+n[2]*m[2])+e[1]*Math.abs(n[0]*m[4]+n[1]*m[5]+n[2]*m[6])+e[2]*Math.abs(n[0]*m[8]+n[1]*m[9]+n[2]*m[10]);
  if(dot(c,n)<-radius)return false
 }
 return true
}
class StageRenderer{
 constructor(canvas){
 this.gl=canvas.getContext('webgl',{alpha:false,antialias:true});if(!this.gl)throw Error('WebGL недоступен');const gl=this.gl;
 this.program=compileProgram;this.meshProgram=this.program(vs2,fs2);this.bg=this.program(bgVS,bgFS);
 this.instancing=gl.getExtension('ANGLE_instanced_arrays');this.instanceBuffer=gl.createBuffer();this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
 this.white=this.texture(null);this.map=this.white;this.environment=this.white;this.fb=gl.createFramebuffer();this.depth=gl.createRenderbuffer();this.shadow=this.texture(null);this.dim=0;this.reflectFB=gl.createFramebuffer();this.reflectDepth=gl.createRenderbuffer();this.reflectTex=this.texture(null);this.reflectW=0;this.reflectH=0;
 }
 texture(image){const g=this.gl,t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);
 if(image)g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,image);else g.texImage2D(g.TEXTURE_2D,0,g.RGBA,1,1,0,g.RGBA,g.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
 for(const p of [g.TEXTURE_MIN_FILTER,g.TEXTURE_MAG_FILTER])g.texParameteri(g.TEXTURE_2D,p,g.LINEAR);
 if(image&&image.width>0&&image.height>0&&(image.width&(image.width-1))===0&&(image.height&(image.height-1))===0){
  g.generateMipmap(g.TEXTURE_2D);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR_MIPMAP_LINEAR)
 }
 for(const p of [g.TEXTURE_WRAP_S,g.TEXTURE_WRAP_T])g.texParameteri(g.TEXTURE_2D,p,g.CLAMP_TO_EDGE);return t}
 async upload(model,keepChassis=false){const g=this.gl,parts=[],textures=new Map();try{
 for(const part of model.parts){const {mat}=part;const get=async bytes=>{if(!bytes)return this.white;if(!textures.has(bytes))textures.set(bytes,this.texture(await decodeImage(bytes)));return textures.get(bytes)};
 const tex=await get(mat.image),mr=await get(mat.mrImage),normal=await get(mat.normalImage);let tangent=null;
 if(mat.normalImage){tangent=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,tangent);g.bufferData(g.ARRAY_BUFFER,tangentData(part),g.STATIC_DRAW)}
 const v=g.createBuffer(),i=g.createBuffer();let center=[0,0,0];if(mat.blend){for(let j=0;j<part.vertices.length;j+=8)for(let k=0;k<3;k++)center[k]+=part.vertices[j+k];center=vmul(center,8/part.vertices.length)}
 parts.push({source:keepChassis&&part.nodeName==='Chassis'?new Float32Array(part.vertices):null,v,i,count:part.indices.length,mat,tex,mr,normal,tangent,center,nodeName:part.nodeName});g.bindBuffer(g.ARRAY_BUFFER,v);g.bufferData(g.ARRAY_BUFFER,new Float32Array(part.vertices),g.STATIC_DRAW);g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,i);g.bufferData(g.ELEMENT_ARRAY_BUFFER,new Uint16Array(part.indices),g.STATIC_DRAW)}
 return parts}catch(e){this.free(parts);throw e}}
 free(parts){let tex=new Set();for(const p of parts){this.gl.deleteBuffer(p.v);this.gl.deleteBuffer(p.i);if(p.tangent)this.gl.deleteBuffer(p.tangent);for(const t of [p.tex,p.mr,p.normal])if(t!==this.white)tex.add(t)}for(const t of tex)this.gl.deleteTexture(t)}
 shadowTarget(size){const g=this.gl;if(this.dim===size)return;this.dim=size;g.bindTexture(g.TEXTURE_2D,this.shadow);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,size,size,0,g.RGBA,g.UNSIGNED_BYTE,null);
 for(const p of [g.TEXTURE_MIN_FILTER,g.TEXTURE_MAG_FILTER])g.texParameteri(g.TEXTURE_2D,p,g.NEAREST);
 g.bindRenderbuffer(g.RENDERBUFFER,this.depth);g.renderbufferStorage(g.RENDERBUFFER,g.DEPTH_COMPONENT16,size,size);g.bindFramebuffer(g.FRAMEBUFFER,this.fb);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,this.shadow,0);g.framebufferRenderbuffer(g.FRAMEBUFFER,g.DEPTH_ATTACHMENT,g.RENDERBUFFER,this.depth);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Недоступна карта теней')}
 reflectTarget(w,h){const g=this.gl;g.bindFramebuffer(g.FRAMEBUFFER,this.reflectFB);
 if(this.reflectW===w&&this.reflectH===h)return;g.bindTexture(g.TEXTURE_2D,this.reflectTex);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,w,h,0,g.RGBA,g.UNSIGNED_BYTE,null);
 g.bindRenderbuffer(g.RENDERBUFFER,this.reflectDepth);g.renderbufferStorage(g.RENDERBUFFER,g.DEPTH_COMPONENT16,w,h);
 g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,this.reflectTex,0);g.framebufferRenderbuffer(g.FRAMEBUFFER,g.DEPTH_ATTACHMENT,g.RENDERBUFFER,this.reflectDepth);
 if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Недоступен буфер отражения');this.reflectW=w;this.reflectH=h}
 lightsFor(state,camera,w,h){
  this.tileCache??=new LightTileCache(this);
  this.tileCache.update(state.lights||[],camera,state.fov,w,h);
  return this.tileCache
 }
 frame(state,w,h,aspect=w/h,crop=[1,1,0,0],refresh=true){
 const g=this.gl,{sun,focus}=state;let objects=state.objects;this.stats={instances:0,calls:0,triangles:0,shadowCalls:0,reflectionCalls:0,candidates:0};let mirror=false;let camera=state.camera,light=sun;const lightX=unit(cross(Math.abs(sun[1])>.999?[1,0,0]:[0,1,0],sun)),lightY=unit(cross(sun,lightX));
 const setup=pr=>{const u=pr.u;g.useProgram(pr.p);for(const [k,v] of Object.entries({eye:camera.eye,cf:camera.f,cr:camera.r,cu:camera.u,sun:light,focus,lightX,lightY}))if(u[k])g.uniform3fv(u[k],v);
 if(u.lamp0){const lamps=(state.lights||[]).filter(l=>l.range>0&&l.intensity>0).sort((a,b)=>Math.hypot(...sub(a.position,camera.eye))-Math.hypot(...sub(b.position,camera.eye))).slice(0,4);
 for(let i=0;i<4;i++){const l=lamps[i];g.uniform4fv(u['lamp'+i],l?[...l.position,l.range]:[0,0,0,0]);g.uniform3fv(u['power'+i],l?l.color.map(c=>c*l.intensity):[0,0,0])}}
 if(u.lighting){g.activeTexture(g.TEXTURE0+4);g.bindTexture(g.TEXTURE_2D,this.environment);g.uniform1i(u.lighting,4);g.uniform1f(u.hasIBL,+(this.environment!==this.white))}if(u.roadReflection){g.activeTexture(g.TEXTURE0+5);g.bindTexture(g.TEXTURE_2D,mirror||!state.roadReflect?this.white:this.reflectTex);g.uniform1i(u.roadReflection,5);g.uniform2f(u.framePixels,w,h);g.uniform1f(u.useReflection,+(!mirror&&!!state.roadReflect))}if(u.carContact)g.uniform3fv(u.carContact,state.carContact||[0,0,1]);if(u.clipZ)g.uniform2f(u.clipZ,...(state.clipZ||[1.00004,.06]));if(u.fogDensity)g.uniform1f(u.fogDensity,state.fogDensity??.0015);if(u.crop)g.uniform4fv(u.crop,crop);if(u.lens)g.uniform2f(u.lens,state.fov*aspect,state.fov);return u};
 const bind=(slot,t)=>{g.activeTexture(g.TEXTURE0+slot);g.bindTexture(g.TEXTURE_2D,t)};
 const draw=(shadow,pr=this.meshProgram,pass=0)=>{const u=setup(pr),a=pr.a;if(pr===this.forwardPlus)this.tileCache.bind(u,bind);if(pass)g.uniform1f(u.bufferIndex,pass);g.enable(g.DEPTH_TEST);g.uniform1f(u.shadowPass,+shadow);g.uniform1f(u.shadowSize,state.shadow);g.uniform1i(u.albedo,0);g.uniform1i(u.shadowTex,1);g.uniform1i(u.mrMap,2);g.uniform1i(u.normalMap,3);bind(1,shadow?this.white:this.shadow);
 const visible=shadow||this.culling===false?objects:objects.filter(o=>meshInFrustum(o,camera,state.fov,aspect));
 if(!shadow&&!mirror)for(const o of visible)if(o.records)this.stats.instances+=o.records.length/7;
 let uploadedRecords=null;const groups=[];for(const field of state.fields||[]){for(const batch of field.select(camera,state.fov,aspect,shadow,focus,state.budget??1)){groups.push({...batch,model:M.id()});if(!shadow&&!mirror)this.stats.instances+=batch.records.length/7}if(!shadow&&!mirror)this.stats.candidates+=field.tested}
 const opaque=[],transparent=[];for(const o of visible.concat(groups))for(const p of o.parts){if((shadow&&(p.mat.ground||p.mat.blend))||(mirror&&p.mat.ground))continue;
 if(p.mat.blend)transparent.push({p,o,z:dot(sub(M.point(o.model,p.center),camera.eye),camera.f)});else opaque.push({p,o})}
 transparent.sort((a,b)=>b.z-a.z);let blending=false;
 for(const {p,o} of opaque.concat(transparent)){if(p.mat.blend&&!blending){g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);g.depthMask(false);blending=true}
 g.uniform1f(u.alphaBlend,+!!p.mat.blend);g.uniformMatrix4fv(u.model,false,o.model);
 const mtx=o.model,A=mtx.slice(0,3),B=mtx.slice(4,7),C=mtx.slice(8,11),bc=cross(B,C),det=dot(A,bc),sign=det<0?-1:1;
 g.uniformMatrix3fv(u.normalFrame,false,[...bc,...cross(C,A),...cross(A,B)].map(n=>n*sign));g.bindBuffer(g.ARRAY_BUFFER,p.v);for(const [i,n,b] of [[a.p,3,0],[a.n,3,12],[a.uv,2,24]]){g.enableVertexAttribArray(i);g.vertexAttribPointer(i,n,g.FLOAT,false,32,b)}
 if(p.tangent){g.bindBuffer(g.ARRAY_BUFFER,p.tangent);g.enableVertexAttribArray(a.tangent);g.vertexAttribPointer(a.tangent,4,g.FLOAT,false,16,0)}else{g.disableVertexAttribArray(a.tangent);g.vertexAttrib4f(a.tangent,1,0,0,1)}
 const m=p.mat;g.uniform2f(u.coatLayer,m.coat||0,m.coatRough??.1);g.uniform3fv(u.emission,m.emissive||[0,0,0]);g.uniform1f(u.normalScale,m.normalScale??1);bind(2,p.mr);bind(3,p.normal);g.uniform4fv(u.tint,[...m.color.slice(0,3),m.color[3]??1]);g.uniform4fv(u.material,[m.metal,m.rough,m.kind||0,+!!m.normalImage]);g.uniform1f(u.cut,m.cut||0);bind(0,p.tex);g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,p.i);const count=o.records?o.records.length/7:1;
 const ext=this.instancing;
 if(o.records&&ext){g.bindBuffer(g.ARRAY_BUFFER,this.instanceBuffer);if(uploadedRecords!==o.records){g.bufferData(g.ARRAY_BUFFER,o.records,g.DYNAMIC_DRAW);uploadedRecords=o.records}
 for(const [loc,size,offset] of [[a.instancePos,4,0],[a.instanceTurn,3,16]]){g.enableVertexAttribArray(loc);g.vertexAttribPointer(loc,size,g.FLOAT,false,28,offset);ext.vertexAttribDivisorANGLE(loc,1)}
 ext.drawElementsInstancedANGLE(g.TRIANGLES,p.count,g.UNSIGNED_SHORT,0,count);
 for(const loc of [a.instancePos,a.instanceTurn]){ext.vertexAttribDivisorANGLE(loc,0);g.disableVertexAttribArray(loc)}
 }else{for(let k=0;k<count;k++){const r=o.records,j=k*7;
 if(r){g.vertexAttrib4f(a.instancePos,r[j],r[j+1],r[j+2],r[j+3]);g.vertexAttrib3f(a.instanceTurn,r[j+4],r[j+5],r[j+6])}
 else{g.vertexAttrib4f(a.instancePos,0,0,0,1);g.vertexAttrib3f(a.instanceTurn,1,0,1)}g.drawElements(g.TRIANGLES,p.count,g.UNSIGNED_SHORT,0)}}
 const calls=o.records&&!ext?count:1;if(shadow)this.stats.shadowCalls+=calls;else if(mirror)this.stats.reflectionCalls+=calls;else{this.stats.calls+=calls;this.stats.triangles+=p.count/3*count}
 }if(blending){g.depthMask(true);g.disable(g.BLEND)}
 for(const i of Object.values(a))g.disableVertexAttribArray(i)};
 if((objects.length||state.fields?.length)&&state.shadow&&refresh){this.shadowTarget(state.shadow);g.bindFramebuffer(g.FRAMEBUFFER,this.fb);g.viewport(0,0,state.shadow,state.shadow);g.clearColor(1,1,1,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);draw(true)}
 const background=()=>{g.disable(g.DEPTH_TEST);
 const u=setup(this.bg);g.uniform1f(u.clouds,state.clouds||0);g.uniform1f(u.planet,+state.planet);g.uniform1f(u.time,state.t);g.uniform1f(u.altRatio,state.alt||0);g.uniform1i(u.earth,0);bind(0,this.map);
 g.bindBuffer(g.ARRAY_BUFFER,this.quad);const i=this.bg.a.p;g.enableVertexAttribArray(i);g.vertexAttribPointer(i,2,g.FLOAT,false,0,0);g.drawArrays(g.TRIANGLES,0,3);g.disableVertexAttribArray(i);};
 if(state.roadReflect&&refresh){mirror=true;const original=camera,saved=crop;crop=[1,1,0,0];const flip=v=>[v[0],-v[1],v[2]];camera={eye:flip(original.eye),f:flip(original.f),r:flip(original.r),u:flip(original.u)};
 const rw=Math.min(state.roadReflect,1024),rh=Math.max(1,Math.round(rw/aspect));this.reflectTarget(rw,rh);g.viewport(0,0,rw,rh);g.clear(g.DEPTH_BUFFER_BIT);background();draw(false);camera=original;crop=saved;mirror=false}
 const deferred=state.deferred&&!state.planet&&!state.actor&&!state.roadReflect&&!(state.fields||[]).some(f=>[...f.near,...f.far].some(p=>p.mat.blend))&&crop[0]===1&&crop[1]===1&&!objects.some(o=>o.parts.some(p=>p.mat.blend));
 this.stats.pipeline=deferred?'deferred':'forward';
 if(deferred){
  this.deferred??=new DeferredPass(this);
  const tiles=this.lightsFor(state,camera,w,h);
  this.stats.lights=tiles.data.count;this.stats.tileOverflow=tiles.data.overflow;
  this.deferred.render(w,h,draw,setup,bind,background,this.quad,state.indirect,tiles);return
 }
 g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,w,h);g.clear(g.DEPTH_BUFFER_BIT);background();if(state.localCamera){camera=state.localCamera;light=state.localSun}if(objects.length||state.fields?.length){
  if(state.forwardPlus&&state.lights?.length&&!state.localCamera&&!state.actor&&crop[0]===1&&crop[1]===1){
   if(!this.forwardPlus){const start=fs2.indexOf(' if(lamp0.w>0.)'),end=fs2.indexOf(' if(coatLayer.x',start);
    this.forwardPlus=this.program(vs2,(fs2.slice(0,start)+' c+=tileLighting(wp,N,V,(1.-metal)*color,F0,rough);\n'+fs2.slice(end)).replace('uniform vec2 coatLayer;',tileShader.replace('i<32','i<8')+'\nuniform vec2 coatLayer;'))}
   const tiles=this.lightsFor(state,camera,w,h);
   this.stats.pipeline='forward+';this.stats.lights=tiles.data.count;draw(false,this.forwardPlus)
  }else draw(false)
 }if(state.actor){g.clear(g.DEPTH_BUFFER_BIT);objects=[{parts:state.actor.parts,model:M.id()}];camera=state.actor.camera;light=state.actor.sun;draw(false)}
 }
}
async function decodeImage(bytes){const url=URL.createObjectURL(new Blob([bytes]));try{const im=new Image();im.src=url;await im.decode();return im}finally{URL.revokeObjectURL(url)}}

// Per-screen-tile light lists, packed for baseline RGBA8 texture sampling.
function lightTiles(lights,camera,fov,width,height,limit=2048){
 const cols=Math.ceil(width/64),rows=Math.ceil(height/64),capacity=32;
 const ranked=lights.filter(l=>l.range>0&&l.intensity>0&&Number.isFinite(l.range+l.intensity)&&l.position.every(Number.isFinite)).map(l=>{
  const delta=sub(l.position,camera.eye),d=dot(delta,camera.f);
  return {l,delta,d,x:dot(delta,camera.r),y:dot(delta,camera.u),priority:l.intensity/Math.max(1,dot(delta,delta))}
 }).filter(p=>p.d+p.l.range>.03).sort((a,b)=>b.priority-a.priority).slice(0,limit);
 let scale=1;for(const {l,delta} of ranked)scale=Math.max(scale,l.range,...delta.map(Math.abs));
 const records=new Uint8Array(12*Math.max(1,ranked.length)),ids=new Uint8Array(cols*rows*capacity*2),counts=new Uint8Array(cols*rows);
 let overflow=0;
 for(let i=0;i<ranked.length;i++){
  const {l,delta,d,x,y}=ranked[i],r=l.range,j=i*12;
  const put=(offset,v)=>{const n=Math.round(Math.min(1,Math.max(0,v))*65535);records[j+offset]=n>>8;records[j+offset+1]=n&255};
  for(let a=0;a<3;a++)put(a*2,.5+.5*delta[a]/scale);put(6,r/scale);
  const rgb=l.color.map(v=>Math.max(0,v*l.intensity)),exponent=Math.max(-120,Math.min(120,Math.ceil(Math.log2(Math.max(1e-20,...rgb)))));
  rgb.forEach((v,k)=>records[j+8+k]=Math.min(255,Math.round(v*255/2**exponent)));records[j+11]=exponent+128;
  const bounds=(v,lens,pixels,tiles)=>{
   if(d-r<=.03)return [0,tiles-1];
   const four=[(v-r)/(d-r),(v+r)/(d-r),(v-r)/(d+r),(v+r)/(d+r)];
   const tile=n=>Math.floor((n/lens*.5+.5)*pixels/64);
   return [Math.max(0,tile(Math.min(...four))),Math.min(tiles-1,tile(Math.max(...four)))]
  };
  const [left,right]=bounds(x,fov*width/height,width,cols),[bottom,top]=bounds(y,fov,height,rows);
  for(let ty=bottom;ty<=top;ty++)for(let tx=left;tx<=right;tx++){
   const tile=ty*cols+tx,n=counts[tile];if(n===capacity){overflow++;continue}
   const p=(tile*capacity+n)*2,id=i+1;ids[p]=id>>8;ids[p+1]=id&255;counts[tile]++
  }
 }
 return {records,ids,scale,cols,rows,count:ranked.length,overflow}
}
const tileShader=`
uniform sampler2D tileIds,lampData;
uniform vec4 tileLayout;
float unpack16(vec2 p){return dot(p,vec2(65280.,255.))/65535.;}
vec3 tileLighting(vec3 P,vec3 N,vec3 V,vec3 diffuse,vec3 F0,float rough){
 vec3 result=vec3(0.);vec2 tile=floor(gl_FragCoord.xy/64.);
 for(int i=0;i<32;i++){
  float pair=floor(float(i)*.5);vec2 coord=vec2((tile.x*16.+pair+.5)/(tileLayout.x*16.),(tile.y+.5)/tileLayout.y);
  vec4 keys=texture2D(tileIds,coord);
  vec2 key=mod(float(i),2.)<.5?keys.rg:keys.ba;
  float id=floor(dot(key,vec2(65280.,255.))+.5);if(id<1.)break;
  float row=(id-.5)/tileLayout.z;
  vec4 a=texture2D(lampData,vec2(1./6.,row)),b=texture2D(lampData,vec2(.5,row)),c=texture2D(lampData,vec2(5./6.,row));
  vec3 position=eye+(2.*vec3(unpack16(a.rg),unpack16(a.ba),unpack16(b.rg))-1.)*tileLayout.w;
  result+=pointBRDF(vec4(position,unpack16(b.ba)*tileLayout.w),c.rgb*exp2(floor(c.a*255.+.5)-128.),P,N,V,diffuse,F0,rough);
 }return result;
}`;

// Geometry and lighting passes share two textures. Compare scalar values so in-place
// edits to cameras and lights also invalidate the uploaded lists.
class LightTileCache {
 constructor(renderer){
  this.gl=renderer.gl;this.maps=[renderer.texture(null),renderer.texture(null)];
 }
 update(lights,camera,fov,width,height){
  const values=[width,height,fov,...camera.eye,...camera.r,...camera.u,...camera.f];
  for(const l of lights)values.push(...l.position,...l.color,l.range,l.intensity);
  if(this.values?.length===values.length&&values.every((v,i)=>v===this.values[i]))return;
  this.data=lightTiles(lights,camera,fov,width,height);this.values=values;this.dirty=true;
 }
 bind(u,bind){
  const g=this.gl,d=this.data;
  const maps=[[d.ids,d.cols*16,d.rows,u.tileIds],[d.records,3,Math.max(1,d.count),u.lampData]];
  maps.forEach(([data,w,h,location],i)=>{
   bind(i+6,this.maps[i]);
   if(this.dirty){
    g.texImage2D(g.TEXTURE_2D,0,g.RGBA,w,h,0,g.RGBA,g.UNSIGNED_BYTE,data);
    for(const p of [g.TEXTURE_MIN_FILTER,g.TEXTURE_MAG_FILTER])g.texParameteri(g.TEXTURE_2D,p,g.NEAREST)
   }
   g.uniform1i(location,i+6)
  });
  this.dirty=false;g.uniform4fv(u.tileLayout,[d.cols,d.rows,Math.max(1,d.count),d.scale]);
 }
 dispose(){for(const texture of this.maps)this.gl.deleteTexture(texture)}
}

// Portable G-buffer implementation. Each attachment uses an ordinary RGBA8 surface,
// allowing the same lighting pass to work on WebGL 1 without multiple render targets.
const gbufferWrite=`
 if(bufferIndex>.5){
  if(bufferIndex<1.5){gl_FragColor=vec4(sqrt(clamp(color,0.,1.)),metal);return;}
  if(bufferIndex<2.5){
   vec3 n=N/(abs(N.x)+abs(N.y)+abs(N.z));
   vec2 oct=n.z>=0.?n.xy:(1.-abs(n.yx))*vec2(n.x<0.?-1.:1.,n.y<0.?-1.:1.);
   gl_FragColor=vec4(oct*.5+.5,rough,coatLayer.x);return;
  }
  if(bufferIndex<3.5){float z=max(.001,dot(wp-eye,cf));
   gl_FragColor=vec4(packZ(clamp(log2(z+1.)/24.,.000001,.99999)),visibility(N));return;}
  gl_FragColor=vec4(emission/(1.+emission),coatLayer.y);return;
 }
`;
const resolveFS=shared+ibl+`
varying vec2 ndc;
uniform sampler2D colors,normals,depths,emissive;
uniform float bounce;
uniform vec4 lamp0,lamp1,lamp2,lamp3;
uniform vec3 power0,power1,power2,power3;
`+fs2.slice(fs2.indexOf('vec3 pointBRDF'),fs2.indexOf('uniform vec2 coatLayer'))+tileShader+`
vec3 normalAt(vec4 data){
 vec2 p=data.xy*2.-1.;vec3 n=vec3(p,1.-abs(p.x)-abs(p.y));
 float t=max(-n.z,0.);n.xy+=vec2(n.x>=0.?-t:t,n.y>=0.?-t:t);return normalize(n);
}
float distanceAt(vec4 d){return exp2(dot(d.rgb,vec3(1.,1./255.,1./65025.))*24.)-1.;}
vec3 positionAt(vec2 uv,float z){return eye+(cf+cr*((uv.x*2.-1.)*lens.x)+cu*((uv.y*2.-1.)*lens.y))*z;}
vec3 surfaceLight(vec2 uv){
 vec4 a=texture2D(colors,uv),n=texture2D(normals,uv),e=texture2D(emissive,uv);
 return a.rgb*a.rgb*(.13+max(dot(normalAt(n),sun),0.)*texture2D(depths,uv).a)+e.rgb/max(vec3(.004),1.-e.rgb);
}
void main(){
 vec2 uv=ndc*.5+.5;vec4 depth=texture2D(depths,uv);float z=distanceAt(depth);if(z<.001)discard;
 vec4 al=texture2D(colors,uv),nr=texture2D(normals,uv),em=texture2D(emissive,uv);
 vec3 P=positionAt(uv,z),N=normalAt(nr),V=normalize(eye-P),R=reflect(-V,N),base=al.rgb*al.rgb;
 float metal=al.a,rough=max(.065,nr.b),nv=max(.001,dot(N,V));
 vec3 F0=mix(vec3(.04),base,metal),F=F0+(1.-F0)*pow(1.-nv,5.);
 vec3 reflection=environment(R,rough);
 if(rough<.58){
  float previous=-1.;bool valid=false;
  for(int j=0;j<32;j++){
   float f=float(j+1);float travel=.12*f+.019*f*f;vec3 aim=P+N*.075+R*travel-eye;
   float az=dot(aim,cf);if(az<=.03)break;
   vec2 coord=.5+.5*vec2(dot(aim,cr)/lens.x,dot(aim,cu)/lens.y)/az;
   if(any(lessThanEqual(coord,vec2(.001)))||any(greaterThanEqual(coord,vec2(.999))))break;
   float sz=distanceAt(texture2D(depths,coord)),delta=az-sz;
   if(valid&&sz>.01&&delta>=0.&&previous<0.&&delta<.24+.05*travel){
    float edge=min(min(coord.x,coord.y),min(1.-coord.x,1.-coord.y));
    reflection=mix(reflection,surfaceLight(coord),smoothstep(0.,.08,edge)*(1.-rough));break;
   }
   previous=delta;valid=sz>.01;
  }
 }
 vec3 diffuse=base*(1.-metal),c=diffuse*(.09+.25*clamp(environment(N,1.),0.,2.))+reflection*F;
 c+=pointBRDF(vec4(P+sun*10.,10000.),vec3(340.,312.,280.)*depth.a,P,N,V,diffuse,F0,rough);
 c+=tileLighting(P,N,V,diffuse,F0,rough);
 if(bounce>.5){
  vec3 indirect=vec3(0.);
  for(int j=0;j<16;j++){
   float fi=float(j)+.5,angle=fi*2.399963;
   vec2 q=uv+vec2(cos(angle),sin(angle))*sqrt(fi/16.)*2.5/(max(z,1.)*lens);
   if(any(lessThan(q,vec2(0.)))||any(greaterThan(q,vec2(1.))))continue;
   float sz=distanceAt(texture2D(depths,q));if(sz<.01)continue;
   vec3 d=positionAt(q,sz)-P;float len=length(d);if(len<.06||len>6.)continue;
   vec3 dir=d/len;float weight=max(0.,dot(N,dir))*max(0.,dot(normalAt(texture2D(normals,q)),-dir))/(1.+len*len*.2);
   indirect+=surfaceLight(q)*weight;
  }
  c+=diffuse*indirect*.17;
 }
 float coat=nr.a*(.04+.96*pow(1.-nv,5.));c=c*(1.-coat)+coat*environment(R,em.a);
 c+=em.rgb/max(vec3(.004),1.-em.rgb);float fog=1.-exp(-length(P-eye)*fogDensity);
 gl_FragColor=vec4(mix(grade(c*.74),vec3(.73,.78,.8),fog),1.);
}`;
class DeferredPass{
 constructor(renderer){
  const g=renderer.gl;this.gl=g;
  const source=fs2.replace('uniform vec2 coatLayer;','uniform float bufferIndex;uniform vec2 coatLayer;').replace(' float nl=max(dot(N,sun)',gbufferWrite+' float nl=max(dot(N,sun)');
  this.ext=g.getExtension('WEBGL_draw_buffers');
  if(this.ext?.drawBuffersWEBGL&&g.getParameter(this.ext.MAX_DRAW_BUFFERS_WEBGL)>=4&&g.getParameter(this.ext.MAX_COLOR_ATTACHMENTS_WEBGL)>=4){
   const write=gbufferWrite.replaceAll(/if\(bufferIndex<[123]\.5\)/g,'').replaceAll('return;','');
   let index=0;const outputs=write.replaceAll('gl_FragColor',()=> 'gl_FragData['+(index++)+']').replace('if(bufferIndex>.5)','if(bufferIndex>.5)').replace(/}\s*$/,'return;}');
   const frag='#extension GL_EXT_draw_buffers : require\n'+fs2.replaceAll('gl_FragColor','gl_FragData[0]').replace('uniform vec2 coatLayer;','uniform float bufferIndex;uniform vec2 coatLayer;').replace(' float nl=max(dot(N,sun)',outputs+' float nl=max(dot(N,sun)');
   try{this.mrt=renderer.program(vs2,frag)}catch{this.mrt=null}
  }
  this.geometry=this.mrt||renderer.program(vs2,source);this.light=renderer.program(bgVS,resolveFS);
  this.fb=g.createFramebuffer();this.depth=g.createRenderbuffer();this.maps=Array.from({length:4},()=>renderer.texture(null))
 }
 targets(w,h){
  const g=this.gl;g.bindFramebuffer(g.FRAMEBUFFER,this.fb);
  if(this.w===w&&this.h===h)return;
  g.bindRenderbuffer(g.RENDERBUFFER,this.depth);g.renderbufferStorage(g.RENDERBUFFER,g.DEPTH_COMPONENT16,w,h);
  g.framebufferRenderbuffer(g.FRAMEBUFFER,g.DEPTH_ATTACHMENT,g.RENDERBUFFER,this.depth);
  for(const tex of this.maps){
   g.bindTexture(g.TEXTURE_2D,tex);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,w,h,0,g.RGBA,g.UNSIGNED_BYTE,null);
   for(const p of [g.TEXTURE_MIN_FILTER,g.TEXTURE_MAG_FILTER])g.texParameteri(g.TEXTURE_2D,p,g.NEAREST);
  }
  this.w=w;this.h=h
 }
 render(w,h,draw,setup,bind,background,quad,bounce,tiles){
  const g=this.gl;this.targets(w,h);g.viewport(0,0,w,h);
  if(this.mrt){
   const attachments=this.maps.map((tex,i)=>{const a=g.COLOR_ATTACHMENT0+i;g.framebufferTexture2D(g.FRAMEBUFFER,a,g.TEXTURE_2D,tex,0);return a});
   this.ext.drawBuffersWEBGL(attachments);
   if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Unsupported MRT size');
   g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);draw(false,this.geometry,1)
  }else for(let i=0;i<this.maps.length;i++){
   g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,this.maps[i],0);
   if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Unsupported G-buffer size');
   g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);
   draw(false,this.geometry,i+1)
  }
  g.bindFramebuffer(g.FRAMEBUFFER,null);g.clear(g.DEPTH_BUFFER_BIT);background();
  const u=setup(this.light);
  for(const [i,n] of ['colors','normals','depths','emissive'].entries()){bind(i,this.maps[i]);g.uniform1i(u[n],i)}
  tiles.bind(u,bind);
  g.uniform1f(u.bounce,bounce?1:0);g.disable(g.DEPTH_TEST);g.bindBuffer(g.ARRAY_BUFFER,quad);
  const a=this.light.a.p;g.enableVertexAttribArray(a);g.vertexAttribPointer(a,2,g.FLOAT,false,0,0);g.drawArrays(g.TRIANGLES,0,3);g.disableVertexAttribArray(a)
 }
 dispose(){const g=this.gl;for(const t of this.maps)g.deleteTexture(t);g.deleteFramebuffer(this.fb);g.deleteRenderbuffer(this.depth);g.deleteProgram(this.geometry.p);g.deleteProgram(this.light.p)}
}

// Editable material grid. Empty cells have index zero; each chunk owns its exposed surfaces.
class VoxelVolume{
 constructor(nx,ny,nz,{cell=.25,chunk=16,materials=[]}={}){
  if(![nx,ny,nz,chunk].every(v=>Number.isInteger(v)&&v>0)||nx*ny*nz>16777216||!Number.isFinite(cell)||cell<=0||chunk>32)throw RangeError('Invalid voxel grid');
  Object.assign(this,{nx,ny,nz,cell,chunk,materials});this.data=new Uint8Array(nx*ny*nz);this.dirty=new Set();this.live=new Map();this.position=[0,0,0];this.colliders=new Map()
 }
 inside(x,y,z){return x>=0&&x<this.nx&&y>=0&&y<this.ny&&z>=0&&z<this.nz}
 get(x,y,z){return this.inside(x,y,z)?this.data[(z*this.ny+y)*this.nx+x]:0}
 set(x,y,z,id){
  if(![x,y,z,id].every(Number.isInteger)||!this.inside(x,y,z)||id<0||id>255||id>this.materials.length)throw RangeError('Invalid voxel');
  const i=(z*this.ny+y)*this.nx+x;if(this.data[i]===id)return false;this.data[i]=id;
  const mark=(a,b,c)=>{if(this.inside(a,b,c))this.dirty.add([a,b,c].map(v=>Math.floor(v/this.chunk)).join(','))};
  mark(x,y,z);
  for(let a=0;a<3;a++){const p=[x,y,z],mod=p[a]%this.chunk;
   if(mod===0){p[a]--;mark(...p);p[a]++}if(mod===this.chunk-1){p[a]++;mark(...p)}}
  return true
 }
 brush(min,max,fn){
  let changed=0;const dims=[this.nx,this.ny,this.nz],lo=min.map(v=>Math.max(0,Math.floor(v))),hi=max.map((v,i)=>Math.min(dims[i]-1,Math.ceil(v)));
  for(let z=lo[2];z<=hi[2];z++)for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++){
   const id=this.get(x,y,z),next=fn(x,y,z,id);if(next!==id)changed+=+this.set(x,y,z,next)
  }return changed
 }
 carve(center,radius){
  if(!Number.isFinite(radius)||radius<=0)return 0;
  const p=center.map((v,i)=>(v-this.position[i])/this.cell-.5),r=radius/this.cell;
  return this.brush(p.map(v=>v-r),p.map(v=>v+r),(x,y,z,id)=>(x-p[0])**2+(y-p[1])**2+(z-p[2])**2<=r*r?0:id)
 }
 mesh(key){
  const start=key.split(',').map(v=>Number(v)*this.chunk),dims=[this.nx,this.ny,this.nz].map((v,i)=>Math.min(this.chunk,v-start[i]));
  const mesh=new Geometry();
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
   const u=(axis+1)%3,v=(axis+2)%3,W=dims[u],H=dims[v],mask=new Uint8Array(W*H);
   for(let slice=0;slice<dims[axis];slice++){
    for(let j=0;j<H;j++)for(let i=0;i<W;i++){
     const p=start.slice();p[axis]+=slice;p[u]+=i;p[v]+=j;const id=this.get(...p);p[axis]+=sign;
     mask[j*W+i]=id&&!this.get(...p)?id:0
    }
    for(let j=0;j<H;j++)for(let i=0;i<W;i++){
     const id=mask[j*W+i];if(!id)continue;
     let w=1,h=1;while(i+w<W&&mask[j*W+i+w]===id)w++;
     outer:while(j+h<H){for(let dx=0;dx<w;dx++)if(mask[(j+h)*W+i+dx]!==id)break outer;h++}
     for(let dy=0;dy<h;dy++)mask.fill(0,(j+dy)*W+i,(j+dy)*W+i+w);
     const corner=(du,dv)=>{const p=start.slice();p[axis]+=slice+(sign>0?1:0);p[u]+=i+du;p[v]+=j+dv;return p.map(n=>n*this.cell)};
     const pts=[corner(0,0),corner(w,0),corner(w,h),corner(0,h)];if(sign<0)pts.reverse();
     mesh.face(this.materials[id-1],pts)
    }
   }
  }return mesh
 }
 raycast(origin,direction,limit=Infinity){
  const length=Math.hypot(...direction);if(!length||limit<0)return null;
  const d=direction.map(v=>v/length),o=origin.map((v,i)=>v-this.position[i]),dims=[this.nx,this.ny,this.nz];
  let t=0,end=limit;
  for(let a=0;a<3;a++){
   const hi=dims[a]*this.cell;if(Math.abs(d[a])<1e-12){if(o[a]<0||o[a]>=hi)return null;continue}
   const t0=-o[a]/d[a],t1=(hi-o[a])/d[a];t=Math.max(t,Math.min(t0,t1));end=Math.min(end,Math.max(t0,t1))
  }
  if(t>end)return null;
  const p=o.map((v,i)=>Math.floor((v+(t+1e-8)*d[i])/this.cell)),step=d.map(Math.sign),stride=d.map(v=>v?this.cell/Math.abs(v):Infinity);
  const next=p.map((v,i)=>d[i]?((v+(step[i]>0?1:0))*this.cell-o[i])/d[i]:Infinity);
  while(this.inside(...p)&&t<=end){
   if(this.get(...p))return {cell:p.slice(),distance:t,point:origin.map((v,i)=>v+t*d[i])};
   t=Math.min(...next);for(let a=0;a<3;a++)if(next[a]<=t+1e-10){p[a]+=step[a];next[a]+=stride[a]}
  }return null
 }
 rebuildColliders(key){
  const physics=this.physics;if(!physics)return;
  const old=this.colliders.get(key);if(old)physics.bodies=physics.bodies.filter(b=>!old.has(b));
  const origin=key.split(',').map(v=>Number(v)*this.chunk),length=this.chunk,used=new Uint8Array(length**3),bodies=new Set();
  const free=(x,y,z)=>x<length&&y<length&&z<length&&!used[(z*length+y)*length+x]&&this.get(origin[0]+x,origin[1]+y,origin[2]+z);
  for(let z=0;z<length;z++)for(let y=0;y<length;y++)for(let x=0;x<length;x++){
   if(!free(x,y,z))continue;
   let w=1,h=1,d=1;while(free(x+w,y,z))w++;
   height:while(y+h<length){for(let i=0;i<w;i++)if(!free(x+i,y+h,z))break height;h++}
   depth:while(z+d<length){for(let j=0;j<h;j++)for(let i=0;i<w;i++)if(!free(x+i,y+j,z+d))break depth;d++}
   for(let k=0;k<d;k++)for(let j=0;j<h;j++)used.fill(1,((z+k)*length+y+j)*length+x,((z+k)*length+y+j)*length+x+w);
   const half=[w,h,d].map(v=>v*this.cell*.5),position=[x,y,z].map((v,a)=>this.position[a]+(origin[a]+v)*this.cell+half[a]);
   bodies.add(physics.add({shape:'box',mass:0,position,half}))
  }
  this.colliders.set(key,bodies)
 }
 mount(game,position=[0,0,0],physics=null){
  if(this.game)throw Error('Volume already mounted');this.game=game;game.managed?.add(this);this.physics=physics;this.position=position.slice();
  this.root=game.world.root.attach(new GameNode('Volume'));this.root.position=this.position;
  this.system=()=>{if(!this.error)this.flush(1).catch(e=>{this.error=e})};game.world.systems.add(this.system);return this
 }
 async flush(limit=Infinity){
  if(!this.game)throw Error('Mount the volume first');if(this.work)return this.work;
  const game=this.game;
  this.work=(async()=>{
   let count=0;while(this.dirty.size&&count++<limit&&this.game===game){
    const key=this.dirty.values().next().value;this.dirty.delete(key);const mesh=this.mesh(key);
    const parts=mesh.parts.length?await game.upload(mesh):null;
    if(this.game!==game||this.dirty.has(key)){if(parts)game.release(parts);continue}
    this.rebuildColliders(key);const old=this.live.get(key);if(old){old.detach();game.release(old.parts);this.live.delete(key)}
    if(parts)this.live.set(key,this.root.attach(new GameNode('Voxel '+key,parts)))
   }
  })();
  try{await this.work}finally{this.work=null}
 }
 dispose(){
  if(!this.game)return;this.game.managed?.delete(this);this.game.world.systems.delete(this.system);this.root.detach();
  for(const n of this.live.values())this.game.release(n.parts);this.live.clear();if(this.physics){const all=new Set();for(const set of this.colliders.values())for(const b of set)all.add(b);this.physics.bodies=this.physics.bodies.filter(b=>!all.has(b))}this.colliders.clear();this.game=null
 }
}

// File/Blob backed quadtree. Offsets are implicit; each disk read fetches one height tile.
class ElevationAtlas{
 static async open(file){
  const head=new Uint8Array(await file.slice(0,12).arrayBuffer());
  if(head.length!==12||new TextDecoder().decode(head.subarray(0,7))!=='SKDEM01')throw Error('Unknown elevation file');
  const len=new DataView(head.buffer).getUint32(8,true);if(len>65536)throw Error('Invalid terrain header');
  const meta=JSON.parse(await file.slice(12,12+len).text()),[w,s,e,n]=meta.bounds;
  if(!Number.isInteger(meta.levels)||meta.levels<0||meta.levels>15||meta.cells!==32||!(w>=-180&&e<=180&&s>=-90&&n<=90&&w<e&&s<n))throw Error('Invalid elevation pyramid');
  const offset=12+len,bytes=2*(meta.cells+1)**2,count=(4**(meta.levels+1)-1)/3;
  if(file.size!==offset+bytes*count)throw Error('Truncated elevation pyramid');
  const atlas=new ElevationAtlas();Object.assign(atlas,{file,meta,offset,bytes});
  atlas.width=(e-w)*Math.PI/180*6371000*Math.cos((n+s)*Math.PI/360);atlas.depth=(n-s)*Math.PI/180*6371000;
  return atlas
 }
 async tile(level,x,z){
  const n=2**level;if(![level,x,z].every(Number.isInteger)||level<0||level>this.meta.levels||x<0||z<0||x>=n||z>=n)throw RangeError('Tile outside pyramid');
  const start=this.offset+this.bytes*((4**level-1)/3+z*n+x);
  const view=new DataView(await this.file.slice(start,start+this.bytes).arrayBuffer()),out=new Int16Array(this.bytes/2);
  for(let i=0;i<out.length;i++)out[i]=view.getInt16(i*2,true);return out
 }
 coordinates(x,z){const [w,s,e,n]=this.meta.bounds;return [w+(e-w)*x/this.width,n-(n-s)*z/this.depth]}
 mesh(level,x,z,h){
  const n=2**level,dx=this.width/(32*n),dz=this.depth/(32*n),vertices=[],indices=[];
  const put=(px,y,pz,nx,ny,nz)=>vertices.push(px,y,pz,nx,ny,nz,px*.01,pz*.01);
  for(let j=0;j<=32;j++)for(let i=0;i<=32;i++){
   const k=33*j+i,ax=Math.max(0,i-1),bx=Math.min(32,i+1),az=Math.max(0,j-1),bz=Math.min(32,j+1);
   const normal=unit([(h[33*j+ax]-h[33*j+bx])/((bx-ax)*dx),1,(h[33*az+i]-h[33*bz+i])/((bz-az)*dz)]);
   put((x*32+i)*dx,h[k],(z*32+j)*dz,...normal);
   if(i<32&&j<32)indices.push(k,k+33,k+1,k+1,k+33,k+34)
  }
  for(let edge=0;edge<4;edge++){
   let prev;for(let i=0;i<=32;i++){
    const k=[i,i*33+32,1088-i,(32-i)*33][edge],b=vertices.length/8,copy=vertices.slice(k*8,k*8+8);
    copy[1]-=Math.max(dx,dz)*.9;vertices.push(...copy);
    if(i)indices.push(prev,k,b,prev,b,b-1);prev=k
   }
  }
  return {parts:[{mat:{color:[.3,.35,.18],metal:0,rough:.93,kind:6},vertices,indices}]}
 }
 stream(game,options){return new ElevationStream(game,this,options)}
}
class ElevationStream{
 constructor(game,atlas,{maxTiles=85,reads=2}={}){
  if(!Number.isInteger(maxTiles)||maxTiles<5||!Number.isInteger(reads)||reads<1||reads>16)throw RangeError('Invalid stream budget');
  Object.assign(this,{game,atlas,maxTiles,reads});this.nodes=new Map();this.pending=new Set();this.closed=false;this.generation=0;this.bytesRead=0;
  this.root=game.world.root.attach(new GameNode('Elevation'));this.system=()=>this.update(game.world.camera.eye);
  game.managed?.add(this);game.world.systems.add(this.system);this.desired=new Set()
 }
 update(eye,velocity=[0,0,0]){
  if(this.closed||this.error)return;const a=this.atlas,budget=this.maxTiles,at=eye.map((v,i)=>v+velocity[i]*.65);
  const id=(l,x,z)=>l+'/'+x+'/'+z,make=(l,x,z)=>{
   const n=2**l,w=a.width/n,d=a.depth/n,cx=(x+.5)*w,cz=(z+.5)*d;
   const distance=p=>Math.hypot(Math.max(0,Math.abs(p[0]-cx)-w*.5),Math.max(0,p[1]-a.meta.max,a.meta.min-p[1]),Math.max(0,Math.abs(p[2]-cz)-d*.5));
   return {l,x,z,key:id(l,x,z),score:Math.max(w,d)/Math.max(1,Math.min(distance(eye),distance(at)))}
  };
  const stable=this.lastEye&&eye.every((v,i)=>v===this.lastEye[i]&&at[i]===this.lastAt[i])&&this.lastBudget===budget;
  let top,all;
  if(stable){({top,all}=this.plan)}else{
  top=make(0,0,0);all=[top];const leaves=[top];
  while(all.length+4<=budget){
   leaves.sort((p,q)=>q.score-p.score);const t=leaves.shift();if(!t||t.score<.75)break;if(t.l>=a.meta.levels)continue;
   t.children=[];for(let j=0;j<2;j++)for(let i=0;i<2;i++)t.children.push(make(t.l+1,t.x*2+i,t.z*2+j));
   all.push(...t.children);leaves.push(...t.children)
  }
  this.plan={top,all};this.lastEye=eye.slice();this.lastAt=at;this.lastBudget=budget;
  this.desired=new Set(all.map(t=>t.key))
  }
  const wanted=this.desired;
  for(const [key,n] of this.nodes){if(!wanted.has(key)){n.detach();this.game.release(n.parts);this.nodes.delete(key)}else n.visible=false}
  const reveal=t=>{
   if(t.children?.every(c=>this.nodes.has(c.key))){t.children.forEach(reveal);return}
   const node=this.nodes.get(t.key);if(node)node.visible=true
  };reveal(top);
  for(const t of all){if(this.pending.size>=this.reads)break;if(!this.nodes.has(t.key)&&!this.pending.has(t.key))this.load(t)}
 }
 async load(t){
  this.pending.add(t.key);
  try{
   const h=await this.atlas.tile(t.l,t.x,t.z);this.bytesRead+=h.byteLength;if(this.closed||!this.desired.has(t.key))return;
   const parts=await this.game.upload(this.atlas.mesh(t.l,t.x,t.z,h));
   if(this.closed||!this.desired.has(t.key)){this.game.release(parts);return}
   const node=this.root.attach(new GameNode(t.key,parts));node.visible=false;this.nodes.set(t.key,node)
  }catch(error){this.error=error}finally{this.pending.delete(t.key)}
 }
 dispose(){this.closed=true;this.game.managed?.delete(this);this.game.world.systems.delete(this.system);for(const node of this.nodes.values())this.game.release(node.parts);this.nodes.clear();this.root.detach()}
}

// Regional tangent-plane view of an XYZ elevation pyramid. Entries are real elevation
// samples in metres. A region is one parent XYZ tile and its more detailed descendants.
class TerrariumAtlas extends ElevationAtlas{
 constructor(latitude,longitude,{zoom=9,levels=4,read=null}={}){
  super();
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>85||!Number.isInteger(zoom)||zoom<4||zoom>14||!Number.isInteger(levels)||levels<0||zoom+levels>15)throw RangeError('Invalid terrain region');
  const n=2**zoom,lat=latitude*Math.PI/180;
  this.zoom=zoom;this.x=Math.floor(((longitude+180)%360+360)%360/360*n);this.z=Math.floor((1-Math.asinh(Math.tan(lat))/Math.PI)*n/2);
  const lon=x=>x/n*360-180,deg=z=>Math.atan(Math.sinh(Math.PI*(1-2*z/n)))*180/Math.PI;
  const west=lon(this.x),east=lon(this.x+1),north=deg(this.z),south=deg(this.z+1);
  this.meta={name:'Terrain Tiles',bounds:[west,south,east,north],levels,cells:32,min:-440,max:8850};
  this.width=2*Math.PI*6371000*Math.cos((north+south)*Math.PI/360)/n;this.depth=this.width;
  this.read=read||TerrariumAtlas.fetchTile;this.cache=new Map()
 }
 static async fetchTile(z,x,y){
  const res=await fetch('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/'+z+'/'+x+'/'+y+'.png');
  if(!res.ok)throw Error('Terrain Tiles HTTP '+res.status);
  const bitmap=await createImageBitmap(await res.blob(),{colorSpaceConversion:'none'});
  try{if(bitmap.width!==256||bitmap.height!==256)throw Error('Expected 256 × 256 Terrarium');
   const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);return ctx.getImageData(0,0,256,256).data
  }finally{bitmap.close()}
 }
 pixels(z,x,y){
  const n=2**z,key=[z,(x+n)%n,Math.min(n-1,y)].join('/');
  if(this.cache.has(key)){const entry=this.cache.get(key);this.cache.delete(key);this.cache.set(key,entry);return entry}
  const entry=Promise.resolve().then(()=>this.read(z,(x+n)%n,Math.min(n-1,y)));
  this.cache.set(key,entry);if(this.cache.size>48)this.cache.delete(this.cache.keys().next().value);
  entry.catch(()=>{if(this.cache.get(key)===entry)this.cache.delete(key)});return entry
 }
 async tile(l,x,z){
  const n=2**l;if(![l,x,z].every(Number.isInteger)||l<0||l>this.meta.levels||x<0||z<0||x>=n||z>=n)throw RangeError("Tile outside region");
  const zoom=this.zoom+l,tx=this.x*n+x,ty=this.z*n+z;
  // A 33-by-33 patch includes the first sample of its eastern and southern neighbors.
  const pixels=await Promise.all([this.pixels(zoom,tx,ty),this.pixels(zoom,tx+1,ty),this.pixels(zoom,tx,ty+1),this.pixels(zoom,tx+1,ty+1)]);
  if(!pixels.every(p=>p?.length===256*256*4))throw Error("Invalid Terrarium pixels");
  const heights=new Float32Array(1089);
  for(let j=0;j<=32;j++)for(let i=0;i<=32;i++){
   const image=pixels[+(i===32)+2*(j===32)],p=((j%32)*8*256+(i%32)*8)*4;
   heights[j*33+i]=image[p]*256+image[p+1]+image[p+2]/256-32768
  }return heights
 }
 coordinates(x,z){
  const n=2**this.zoom;return [(this.x+x/this.width)/n*360-180,Math.atan(Math.sinh(Math.PI*(1-2*(this.z+z/this.depth)/n)))*180/Math.PI]
 }
}

// ESRI ASCII Grid, coordinates in geographic degrees, height in metres.
function readDEM(text){
 const rows=text.trim().split(/\r?\n/),meta={};let row=0;
 for(;row<rows.length;row++){const m=rows[row].trim().match(/^(ncols|nrows|xllcorner|yllcorner|xllcenter|yllcenter|cellsize|nodata_value)\s+([^\s]+)$/i);if(!m)break;meta[m[1].toLowerCase()]=Number(m[2])}
 const {ncols:w,nrows:h,cellsize:step}=meta,west=meta.xllcenter??(meta.xllcorner+step/2),south=meta.yllcenter??(meta.yllcorner+step/2);
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<2||h<2||w*h>4000000||!Number.isFinite(west+south+step)||step<=0||Math.abs(south)>90||Math.abs(west)>180||south+(h-1)*step>90||step*Math.max(w,h)>12)throw Error('Нужна локальная сетка в градусах, до 12° и 4 млн ячеек');
 const z=Float32Array.from(rows.slice(row).join(' ').trim().split(/\s+/),Number);if(z.length!==w*h||!z.every(Number.isFinite))throw Error('Число высот не соответствует сетке');
 const rad=Math.PI/180,lat=(south+(h-1)*step/2)*rad,lon=(west+(w-1)*step/2)*rad,center=geo(lat,lon),east=[-Math.sin(lon),0,-Math.cos(lon)],north=cross(center,east),axes=[east,center,vmul(north,-1)];
 const local=v=>axes.map(a=>dot(v,a)),at=(i,j)=>z[j*w+i];
 const stride=Math.max(1,Math.ceil(Math.max(w,h)/275)),col=[],line=[];for(let i=0;i<w-1;i+=stride)col.push(i);col.push(w-1);for(let j=0;j<h-1;j+=stride)line.push(j);line.push(h-1);
 const grid=line.map(j=>col.map(i=>{const y=at(i,j),N=geo((south+(h-1-j)*step)*rad,(west+i*step)*rad);return {y,ok:y!==meta.nodata_value,p:local(sub(vmul(N,(RADIUS+y)/1000),vmul(center,RADIUS/1000)))}}));
 const parts=[],bins=new Map();let peak=-Infinity;for(const r of grid)for(const v of r)if(v.ok)peak=Math.max(peak,v.y);
 // Share grid vertices inside 32-cell patches; skip triangles touching NODATA.
 for(let j=0;j<grid.length;j++)for(let i=0;i<grid[j].length;i++){
 const v=grid[j][i],sample=(dx,dy)=>{const row=grid[clamp(j+dy,0,grid.length-1)],p=row[clamp(i+dx,0,row.length-1)];return p.ok?p:v};
 const n=unit(cross(sub(sample(0,1).p,sample(0,-1).p),sub(sample(1,0).p,sample(-1,0).p)));v.normal=n[1]<0?vmul(n,-1):n;
 let occ=0;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){let horizon=0;for(const gap of [2,5,12]){const p=sample(dx*gap,dy*gap),delta=sub(p.p,v.p);horizon=Math.max(horizon,delta[1]/Math.max(.001,Math.hypot(delta[0],delta[2])))}
 occ+=Math.atan(horizon)}v.ao=clamp(1-occ*.13,.48,1)}
 for(let j=0;j<grid.length-1;j+=32)for(let i=0;i<grid[0].length-1;i+=32){
 const rows=Math.min(33,grid.length-j),cols=Math.min(33,grid[0].length-i),part={vertices:[],indices:[],mat:{color:[.3,.32,.30],rough:.93,metal:0,kind:3}};
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const v=grid[j+y][i+x];part.vertices.push(...v.p,...v.normal,v.ao,0);
 if(y&&x){const k=y*cols+x,a=k-cols-1,b=k-cols,c=k,d=k-1,g=grid;
 if(g[j+y-1][i+x-1].ok&&g[j+y-1][i+x].ok&&v.ok)part.indices.push(a,c,b);
 if(g[j+y-1][i+x-1].ok&&v.ok&&g[j+y][i+x-1].ok)part.indices.push(a,d,c)}}
 if(part.indices.length)parts.push(part)}
 if(!parts.length)throw Error('В сетке нет треугольников с высотами');
 function heightAt(a,b){const x=(b/rad-west)/step,y=h-1-(a/rad-south)/step;if(x<0||y<0||x>w-1||y>h-1)return 0;const i=Math.min(w-2,Math.floor(x)),j=Math.min(h-2,Math.floor(y)),u=x-i,v=y-j;
 const cells=[at(i,j),at(i+1,j),at(i,j+1),at(i+1,j+1)].map(n=>n===meta.nodata_value?0:n);return (cells[0]*(1-u)+cells[1]*u)*(1-v)+(cells[2]*(1-u)+cells[3]*u)*v}
 return {parts,lat,lon,peak,local,center,heightAt,range:Math.max(w,h)*step*112}
}

// World coordinates are metres. The same height function is used by mesh and gameplay queries.
function terrainHeight(x,z,seed=1){
 function hash(a,b){
  let v=Math.imul(a,1597334677)^Math.imul(b,3812015801)^seed;
  v=Math.imul(v^(v>>>16),2246822519);return ((v^(v>>>13))>>>0)/4294967296
 }
 function noise(a,b){
  const i=Math.floor(a),j=Math.floor(b);
  let u=a-i,v=b-j;u=u*u*(3-2*u);v=v*v*(3-2*v);
  return (hash(i,j)*(1-u)+hash(i+1,j)*u)*(1-v)+(hash(i,j+1)*(1-u)+hash(i+1,j+1)*u)*v
 }
 const warp=noise(x/490,z/490)*74;
 const ridge=1-Math.abs(2*noise((x+warp)/210,(z-warp)/210)-1);
 return 63*noise(x/670,z/670)+54*ridge*ridge+9*noise(x/53,z/53)+2.4*noise(x/15,z/15)
}
function bakeTerrain({x,z,size,steps,seed}){
 if(!Number.isInteger(steps)||steps<2||steps>192||!(size>0&&Number.isFinite(size)))throw Error('Invalid terrain resolution');
 const width=steps+1,stride=steps+3,spacing=size/steps;
 const samples=new Float64Array(stride*stride);
 for(let j=-1;j<=steps+1;j++)for(let i=-1;i<=steps+1;i++)
  samples[(j+1)*stride+i+1]=terrainHeight((x+i/steps)*size,(z+j/steps)*size,seed);
 const vertices=new Float32Array((width*width+4*width)*8);
 const indices=new Uint16Array(6*(steps*steps+4*steps));let at=0;
 for(let j=0;j<width;j++)for(let i=0;i<width;i++){
  const k=j*width+i,h=(j+1)*stride+i+1,nx=samples[h-1]-samples[h+1],nz=samples[h-stride]-samples[h+stride];
  const len=Math.hypot(nx,2*spacing,nz);
  vertices.set([i*spacing,samples[h],j*spacing,nx/len,2*spacing/len,nz/len,(x+i/steps)*size/12,(z+j/steps)*size/12],8*k);
  if(i<steps&&j<steps){indices.set([k,k+width,k+1,k+1,k+width,k+width+1],at);at+=6}
 }
 for(let edge=0;edge<4;edge++){
  let previous;
  for(let i=0;i<width;i++){
   const k=[i,i*width+steps,steps*width+steps-i,(steps-i)*width][edge],s=width*width+edge*width+i;
   vertices.set(vertices.subarray(k*8,k*8+8),s*8);vertices[s*8+1]-=Math.max(3,spacing*1.5);
   if(i){indices.set([previous,k,s,previous,s,s-1],at);at+=6}previous=k
  }
 }
 return {vertices,indices}
}
class TerrainStream{
 constructor(game,{seed=1,size=128,radius=2,steps=48,worker=true,scatter=[]}={}){
  if(!Number.isInteger(radius)||radius<1||radius>8||!Number.isInteger(steps)||steps<4||steps>192||!Number.isFinite(size)||size<=0)throw Error('Invalid terrain configuration');
  this.scatter=scatter;Object.assign(this,{game,seed:seed|0,size,radius,steps});this.live=new Map();this.target=new Map();this.closed=false;this.busy=false;
  this.mat={color:[.24,.30,.16],metal:0,rough:.87,kind:6};this.system=()=>this.update(game.world.camera.eye);
  if(worker&&typeof Worker==='function'){
   const source=[terrainHeight,bakeTerrain].map(f=>f.toString()).join('\n')+'\nonmessage=e=>{const m=bakeTerrain(e.data);postMessage(m,[m.vertices.buffer,m.indices.buffer])}';
   const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
   try{this.worker=new Worker(url);this.worker.onmessage=e=>this.resolve(e.data);this.worker.onerror=()=>{this.worker?.terminate();this.worker=null;this.resolve?.(null)}}catch{}finally{URL.revokeObjectURL(url)}
  }
  game.world.systems.add(this.system)
 }
 heightAt(x,z){return terrainHeight(x,z,this.seed)}
 update(eye){
  if(this.closed)return;
  const cx=Math.floor(eye[0]/this.size),cz=Math.floor(eye[2]/this.size);
  if(this.cx!==cx||this.cz!==cz){
   this.cx=cx;this.cz=cz;const jobs=[];
   for(let dz=-this.radius;dz<=this.radius;dz++)for(let dx=-this.radius;dx<=this.radius;dx++){
    const x=cx+dx,z=cz+dz,dist=Math.max(Math.abs(dx),Math.abs(dz));
    jobs.push({id:x+','+z,x,z,distance:dx*dx+dz*dz,size:this.size,seed:this.seed,steps:Math.max(4,this.steps>>Math.min(2,dist))})
   }
   this.target=new Map(jobs.sort((a,b)=>a.distance-b.distance).map(j=>[j.id,j]));
   for(const [id,entry] of this.live)if(!this.target.has(id)){this.release(entry);this.live.delete(id)}
  }
  if(this.busy)return;
  for(const job of this.target.values())if(this.live.get(job.id)?.steps!==job.steps){this.run(job);break}
 }
 async run(job){
  this.busy=true;
  try{
   const mesh=this.worker?await new Promise(resolve=>{this.resolve=resolve;this.worker.postMessage(job)}):bakeTerrain(job);
   if(!mesh||this.closed||this.target.get(job.id)?.steps!==job.steps)return;
   const parts=await this.game.upload({parts:[{...mesh,mat:this.mat}]});
   if(this.closed||this.target.get(job.id)?.steps!==job.steps){this.game.release(parts);return}
   const node=new GameNode('Terrain '+job.id,parts);node.position=[job.x*this.size,0,job.z*this.size];
   for(const [layer,spec] of this.scatter.entries()){
    const instances=this.instances(job,spec,layer);
    if(instances.length){const child=node.attach(new GameNode('Scatter '+layer,spec.parts));child.records=instances;
     const bounds=spec.parts.bounds;
     if(bounds){
      const radius=Math.hypot(...bounds.center)+Math.hypot(...bounds.extent),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
      for(let i=0;i<instances.length;i+=7)for(let k=0;k<3;k++){
       const padding=radius*Math.abs(instances[i+3]);lo[k]=Math.min(lo[k],instances[i+k]-padding);hi[k]=Math.max(hi[k],instances[i+k]+padding)
      }
      child.bounds={center:vmul(add(hi,lo),.5),extent:vmul(sub(hi,lo),.5)}
     }}
   }
   const old=this.live.get(job.id);if(old)this.release(old);
   this.game.world.root.attach(node);this.live.set(job.id,{node,steps:job.steps})
  }catch(error){this.error=error;this.dispose()}finally{this.busy=false;this.resolve=null}
 }
 instances(job,spec,layer){
  let state=(Math.imul(job.x,1597334677)^Math.imul(job.z,3812015801)^this.seed^Math.imul(layer+1,1664525))>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
  const values=[];
  for(let i=0;i<spec.count;i++){
   const x=random()*job.size,z=random()*job.size,worldX=job.x*job.size+x,worldZ=job.z*job.size+z;
   const y=this.heightAt(worldX,worldZ),yaw=random()*2*Math.PI,scale=(spec.scale??1)*(.66+.79*random()),tone=.8+.34*random();
   if(spec.accept&&!spec.accept(worldX,y,worldZ))continue;
   values.push(x,y,z,scale,Math.cos(yaw),Math.sin(yaw),tone)
  }
  return Float32Array.from(values)
 }
 release(entry){entry.node.detach();this.game.release(entry.node.parts)}
 dispose(){
  this.closed=true;this.game.world.systems.delete(this.system);this.worker?.terminate();this.resolve?.(null);
  for(const entry of this.live.values())this.release(entry);this.live.clear();this.game.streams.delete(this)
 }
}

class Entities{
 constructor(){this.next=1;this.live=new Set();this.columns=new Map()}
 create(values={}){
  const id=this.next++;this.live.add(id);
  for(const [name,value] of Object.entries(values))this.set(id,name,value);
  return id
 }
 set(id,name,value){
  if(!this.live.has(id))throw Error('Unknown entity');
  if(!this.columns.has(name))this.columns.set(name,new Map());
  this.columns.get(name).set(id,value);return value
 }
 get(id,name){return this.columns.get(name)?.get(id)}
 remove(id,name){return this.columns.get(name)?.delete(id)||false}
 destroy(id){if(!this.live.delete(id))return false;for(const c of this.columns.values())c.delete(id);return true}
 *query(...names){
  const columns=names.map(n=>this.columns.get(n));if(columns.includes(undefined))return;
  let source=this.live;for(const c of columns)if(c.size<source.size)source=c;
  for(const id of source.keys())if(columns.every(c=>c.has(id)))yield [id,...columns.map(c=>c.get(id))]
 }
}

// Each action sums its digital, signed axis, analog button and virtual inputs.
class Actions{
 constructor(bindings,{target=globalThis,getPads=()=>globalThis.navigator?.getGamepads?.()||[]}={}){
  this.bindings=bindings;this.getPads=getPads;this.target=target;this.keys=new Set();this.virtual=new Map();
  this.down=e=>this.keys.add(e.code);this.up=e=>this.keys.delete(e.code);
  this.clear=()=>{this.keys.clear();this.virtual.clear()};
  target.addEventListener('keydown',this.down);target.addEventListener('keyup',this.up);target.addEventListener('blur',this.clear)
 }
 set(name,value,source='touch'){
  if(!this.bindings[name])throw Error('Unknown action '+name);
  let map=this.virtual.get(name);if(!map)this.virtual.set(name,map=new Map());
  if(Number.isFinite(value)&&value!==0)map.set(source,Math.max(-1,Math.min(1,value)));else map.delete(source)
 }
 sample(){
  let pad;try{pad=Array.from(this.getPads()).find(p=>p&&p.connected!==false&&p.mapping==='standard')}catch{}
  const result={};
  for(const [name,b] of Object.entries(this.bindings)){
   let value=0;for(const v of this.virtual.get(name)?.values()||[])value+=v;
   for(const [key,scale] of Object.entries(b.keys||{}))if(this.keys.has(key))value+=scale;
   if(pad){
    for(const [id,scale] of Object.entries(b.buttons||{}))value+=(pad.buttons[id]?.value||0)*scale;
    for(const [id,scale] of Object.entries(b.axes||{})){
     const x=pad.axes[id]||0,d=Math.max(0,Math.min(.95,b.deadzone??.12));
     if(Math.abs(x)>d)value+=Math.sign(x)*(Math.abs(x)-d)/(1-d)*scale
    }
   }
   result[name]=Math.max(-1,Math.min(1,value))
  }
  return result
 }
 dispose(){this.target.removeEventListener('keydown',this.down);this.target.removeEventListener('keyup',this.up);this.target.removeEventListener('blur',this.clear);this.clear()}
}

// The reader receives project-relative paths and returns Uint8Array data.
async function loadScene(game,doc,read){
 if(doc?.format!=='skerry.scene/1'||!Array.isArray(doc.nodes)||typeof read!=='function')throw TypeError('Invalid SKERRY scene');
 const root=new GameNode(doc.name||'Scene'),nodes=new Map(),assets=new Map();
 function relative(base,uri){
  if(typeof uri!=='string'||/^[a-z][a-z0-9+.-]*:|^[\\/]|[\\?#\0]/i.test(uri))throw Error('Expected a relative asset path');
  const parts=base?base.split('/').slice(0,-1):[];
  for(const segment of uri.split('/')){
   if(!segment||segment==='.')continue;
   if(segment==='..'){if(!parts.length)throw Error('Path outside project');parts.pop()}else parts.push(segment)
  }
  if(!parts.length)throw Error('Empty asset path');return parts.join('/')
 }
 function transform(value,length,defaultValue){
  if(value===undefined)return defaultValue;
  if(!Array.isArray(value)||value.length!==length||!value.every(Number.isFinite))throw Error('Invalid node transform');
  return value.slice()
 }
 for(const entry of doc.nodes){
  if(typeof entry?.id!=='string'||!entry.id||nodes.has(entry.id))throw Error('Expected unique node ids');
  const node=new GameNode(entry.name||entry.id);
  node.position=transform(entry.position,3,node.position);node.scale=transform(entry.scale,3,node.scale);
  const q=transform(entry.rotation,4,node.rotation),length=Math.hypot(...q);if(length<1e-8)throw Error('Invalid rotation');
  node.rotation=q.map(v=>v/length);node.visible=entry.visible!==false;nodes.set(entry.id,node)
 }
 for(const entry of doc.nodes){
  const parent=entry.parent===undefined?root:nodes.get(entry.parent);
  if(!parent)throw Error('Missing parent');parent.attach(nodes.get(entry.id))
 }
 try{
  for(const entry of doc.nodes)if(entry.mesh!==undefined){
   const path=relative('',entry.mesh);
   if(!assets.has(path)){
    const bytes=await read(path);
    assets.set(path,await game.load(bytes,uri=>read(relative(path,uri))))
   }
   nodes.get(entry.id).parts=assets.get(path)
  }
  if(game.disposed)throw Error('Game disposed');
  game.world.root.attach(root);
 }catch(error){for(const p of assets.values())game.release(p);throw error}
 function dispose(){root.detach();for(const p of assets.values())game.release(p);assets.clear()}
 return {root,nodes,dispose}
}

// CPU reference integrator for material look development. Geometry is instanced
// through a two-level BVH, so a forest shares one acceleration structure per mesh.
async function preparePhotoMeshes(parts){
 const pictures=new Map();
 async function pixels(bytes){
  if(!bytes)return null;if(pictures.has(bytes))return pictures.get(bytes);
  const image=await decodeImage(bytes),canvas=document.createElement('canvas');
  canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const result=ctx.getImageData(0,0,canvas.width,canvas.height);
  const texture={width:image.width,height:image.height,data:result.data};pictures.set(bytes,texture);return texture
 }
 const result=[];
 for(const part of parts){
  const m=part.mat;
  result.push({vertices:part.vertices,indices:part.indices,mat:{color:m.color,rough:m.rough,metal:m.metal,emissive:m.emissive,cut:m.cut,albedo:await pixels(m.image),mr:await pixels(m.mrImage)}})
 }
 return result
}
function renderPhoto(scene,{width,height,samples,bounces,seed}){
 const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s);
 const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const unit=a=>mul(a,1/(Math.hypot(...a)||1)),mix=(a,b,t)=>add(mul(a,1-t),mul(b,t));
 function tree(items){
  if(!items.length)return null;
  const lo=[Infinity,Infinity,Infinity],hi=lo.map(v=>-v);
  for(const q of items)for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],q.lo[i]);hi[i]=Math.max(hi[i],q.hi[i])}
  if(items.length<=6)return {lo,hi,items};
  const extent=sub(hi,lo),axis=extent.indexOf(Math.max(...extent)),middle=items.length>>1;
  items.sort((a,b)=>a.lo[axis]+a.hi[axis]-b.lo[axis]-b.hi[axis]);
  return {lo,hi,left:tree(items.slice(0,middle)),right:tree(items.slice(middle))}
 }
 function visit(node,o,d,best,leaf){
  if(!node||best.done)return;
  let low=0,high=best.t;
  for(let i=0;i<3;i++){
   if(Math.abs(d[i])<1e-12){if(o[i]<node.lo[i]||o[i]>node.hi[i])return;continue}
   const a=(node.lo[i]-o[i])/d[i],b=(node.hi[i]-o[i])/d[i];
   low=Math.max(low,Math.min(a,b));high=Math.min(high,Math.max(a,b));if(high<low)return
  }
  if(node.items){for(const item of node.items){leaf(item);if(best.done)break}}
  else{visit(node.left,o,d,best,leaf);visit(node.right,o,d,best,leaf)}
 }
 function texel(texture,uv){
  const x=Math.min(texture.width-1,Math.max(0,Math.floor(uv[0]*texture.width))),y=Math.min(texture.height-1,Math.max(0,Math.floor(uv[1]*texture.height)));
  const k=(y*texture.width+x)*4;return [0,1,2,3].map(i=>texture.data[k+i]/255)
 }
 const geometries=scene.meshes.map(parts=>{
  const triangles=[];
  for(const part of parts){
   const v=part.vertices,ix=part.indices;
   for(let i=0;i<ix.length;i+=3){
    const p=[ix[i],ix[i+1],ix[i+2]].map(k=>[v[k*8],v[k*8+1],v[k*8+2]]);
    const normals=[ix[i],ix[i+1],ix[i+2]].map(k=>[v[k*8+3],v[k*8+4],v[k*8+5]]);
    const uv=[ix[i],ix[i+1],ix[i+2]].map(k=>[v[k*8+6],v[k*8+7]]);
    triangles.push({uv,a:p[0],e:sub(p[1],p[0]),f:sub(p[2],p[0]),normals,mat:part.mat,
     lo:[0,1,2].map(k=>Math.min(...p.map(q=>q[k]))),hi:[0,1,2].map(k=>Math.max(...p.map(q=>q[k])))})
   }
  }
  return tree(triangles)
 });
 const objects=[];
 for(const {mesh,m} of scene.instances){
  const g=geometries[mesh];if(!g)continue;
  const a=m.slice(0,3),b=m.slice(4,7),c=m.slice(8,11),origin=m.slice(12,15),det=dot(a,cross(b,c));if(Math.abs(det)<1e-14)continue;
  const inv=[cross(b,c),cross(c,a),cross(a,b)].map(v=>mul(v,1/det));
  const center=mul(add(g.hi,g.lo),.5),extent=mul(sub(g.hi,g.lo),.5);
  const pos=add(origin,add(mul(a,center[0]),add(mul(b,center[1]),mul(c,center[2]))));
  const bounds=pos.map((_,i)=>Math.abs(a[i])*extent[0]+Math.abs(b[i])*extent[1]+Math.abs(c[i])*extent[2]);
  objects.push({g,origin,inv,lo:sub(pos,bounds),hi:add(pos,bounds)})
 }
 const root=tree(objects);
 function cast(o,d,max=Infinity,any=false){
  const hit={t:max,mat:null};
  visit(root,o,d,hit,obj=>{
   const relative=sub(o,obj.origin),ro=obj.inv.map(r=>dot(r,relative)),rd=obj.inv.map(r=>dot(r,d));
   visit(obj.g,ro,rd,hit,q=>{
    const px=rd[1]*q.f[2]-rd[2]*q.f[1],py=rd[2]*q.f[0]-rd[0]*q.f[2],pz=rd[0]*q.f[1]-rd[1]*q.f[0];
    const det=q.e[0]*px+q.e[1]*py+q.e[2]*pz;if(Math.abs(det)<1e-9)return;
    const sx=ro[0]-q.a[0],sy=ro[1]-q.a[1],sz=ro[2]-q.a[2],u=(sx*px+sy*py+sz*pz)/det;if(u<0||u>1)return;
    const rx=sy*q.e[2]-sz*q.e[1],ry=sz*q.e[0]-sx*q.e[2],rz=sx*q.e[1]-sy*q.e[0],v=(rd[0]*rx+rd[1]*ry+rd[2]*rz)/det;if(v<0||u+v>1)return;
    const t=(q.f[0]*rx+q.f[1]*ry+q.f[2]*rz)/det;if(t<=.0005||t>=hit.t)return;
    let material=q.mat;
    if(material.albedo||material.mr){
     const uv=add(mul(q.uv[0],1-u-v),add(mul(q.uv[1],u),mul(q.uv[2],v)));
     const color=material.albedo?texel(material.albedo,uv):[1,1,1,1],mr=material.mr?texel(material.mr,uv):[1,1,1,1];
     if(color[3]*(material.color[3]??1)<(material.cut||0))return;
     material={...material,color:material.color.slice(0,3).map((c,i)=>c*color[i]**2.2),rough:material.rough*mr[1],metal:material.metal*mr[2]}
    }
    if(any){hit.mat=material;hit.done=true;return}
    const local=add(mul(q.normals[0],1-u-v),add(mul(q.normals[1],u),mul(q.normals[2],v)));
    let n=unit([0,1,2].map(i=>obj.inv.reduce((sum,row,j)=>sum+row[i]*local[j],0)));
    if(dot(n,d)>0)n=mul(n,-1);Object.assign(hit,{t,mat:material,n})
   })
  });return hit
 }
 let rng=seed>>>0;function rand(){rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296}
 function cosine(n){
  const a=rand()*Math.PI*2,s=Math.sqrt(rand()),u=unit(cross(n,Math.abs(n[1])<.9?[0,1,0]:[1,0,0])),v=cross(n,u);
  return add(mul(n,Math.sqrt(1-s*s)),add(mul(u,s*Math.cos(a)),mul(v,s*Math.sin(a))))
 }
 function trace(ro,rd){
  let weight=[1,1,1],light=[0,0,0];
  for(let j=0;j<bounces;j++){
   const hit=cast(ro,rd);
   if(!hit.mat){const sky=mix([.69,.73,.79],[.18,.38,.72],Math.max(0,rd[1]));return add(light,sky.map((v,i)=>v*weight[i]))}
   const {mat,n}=hit,base=mat.color.slice(0,3),metal=mat.metal||0;
   const f0=base.map(v=>.04*(1-metal)+v*metal);
   const f=f0.map(v=>v+(1-v)*Math.pow(1-Math.max(0,-dot(rd,n)),5));
   ro=add(add(ro,mul(rd,hit.t)),mul(n,.001));let irradiance=[0,0,0];
   const sun=scene.sun,nd=Math.max(0,dot(n,sun));
   if(nd&&!cast(ro,sun,Infinity,true).mat)irradiance=mul([3.4,3.12,2.8],nd);
   for(const l of scene.lights){
    const delta=sub(l.position,ro),dist=Math.hypot(...delta);if(dist>=l.range||dist<.001)continue;
    const dir=mul(delta,1/dist),nl=Math.max(0,dot(n,dir));
    if(nl&&!cast(ro,dir,dist-.001,true).mat)irradiance=add(irradiance,mul(l.color,l.intensity*nl*Math.pow(1-(dist/l.range)**4,2)/Math.max(.09,dist*dist)))
   }
   light=add(light,weight.map((w,i)=>w*((mat.emissive?.[i]||0)+(1-metal)*(1-f[i])*base[i]*irradiance[i]/Math.PI)));
   const chance=Math.min(.96,Math.max(.04,Math.max(...f))),hemi=cosine(n);
   if(rand()<chance){
    rd=unit(mix(sub(rd,mul(n,2*dot(rd,n))),hemi,(mat.rough??.5)**2));weight=weight.map((w,i)=>w*f[i]/chance)
   }else{rd=hemi;weight=weight.map((w,i)=>w*base[i]*(1-metal)*(1-f[i])/(1-chance))}
  }
  return light
 }
 const pixels=new Uint8ClampedArray(width*height*4),cam=scene.camera;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  let sum=[0,0,0];
  for(let s=0;s<samples;s++){
   const dx=((x+rand())/width*2-1)*scene.fov*width/height,dy=(1-(y+rand())/height*2)*scene.fov;
   sum=add(sum,trace(cam.eye,unit(add(cam.f,add(mul(cam.r,dx),mul(cam.u,dy))))))
  }
  const k=(y*width+x)*4;
  for(let i=0;i<3;i++){const v=sum[i]/samples;pixels[k+i]=255*Math.pow(Math.min(1,v*(2.51*v+.03)/(v*(2.43*v+.59)+.14)),1/2.2)}pixels[k+3]=255
 }
 return pixels
}
function photoSnapshot(world){
 const state=world.state(),meshes=[],ids=new Map(),instances=[];
 for(const o of state.objects){
  const src=o.parts.photoSource;if(!src)throw Error('Enable photo mode before uploading meshes.');
  if(!ids.has(src)){ids.set(src,meshes.length);meshes.push(src)}
  const mesh=ids.get(src),r=o.records;
  if(!r){instances.push({mesh,m:o.model});continue}
  for(let i=0;i<r.length;i+=7){
   const s=r[i+3],c=r[i+4]*s,t=r[i+5]*s;
   instances.push({mesh,m:M.mul(o.model,[c,0,-t,0,0,s,0,0,t,0,c,0,r[i],r[i+1],r[i+2],1])})
  }
 }
 return {meshes,instances,camera:state.camera,sun:state.sun,lights:state.lights,fov:state.fov}
}
async function renderWorldPhoto(world,{width=640,height=360,samples=8,bounces=3,seed=1}={}){
 const values=[width,height,samples,bounces];
 if(!values.every(v=>Number.isInteger(v)&&v>0)||width*height>6144*3456||samples>1024||bounces>16)throw RangeError('Invalid photo settings');
 const scene=photoSnapshot(world),settings={width,height,samples,bounces,seed};
 if(typeof Worker==='undefined')return renderPhoto(scene,settings);
 const source=renderPhoto.toString()+'\nonmessage=e=>{let p=renderPhoto(...e.data);postMessage(p,[p.buffer])}';
 const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
 let worker;try{worker=new Worker(url);return await new Promise((resolve,reject)=>{
  worker.onmessage=e=>resolve(e.data);worker.onerror=e=>reject(Error(e.message));worker.postMessage([scene,settings])
 })}finally{worker?.terminate();URL.revokeObjectURL(url)}
}

class GameNode{
 constructor(name,parts=[]){this.name=name;this.parts=parts;this.parent=null;this.children=new Set();this.position=[0,0,0];this.rotation=[0,0,0,1];this.scale=[1,1,1];this.visible=true;this.body=null}
 attach(node){for(let p=this;p;p=p.parent)if(p===node)throw Error('Цикл иерархии');if(node.parent)node.parent.children.delete(node);node.parent=this;this.children.add(node);return node}
 detach(){if(this.parent)this.parent.children.delete(this);this.parent=null;return this}
 collect(parent,output){if(!this.visible)return;let model=M.mul(parent,M.trs(this.position,this.rotation,this.scale));if(this.body){const scales=[0,4,8].map(i=>Math.hypot(model[i],model[i+1],model[i+2]));model=M.trs(this.body.position,this.body.rotation,scales)}if(this.parts.length)output.push({parts:this.parts,model,records:this.records,bounds:this.bounds});for(const n of this.children)n.collect(model,output)}
}
class GameWorld{
 constructor(){this.entities=new Entities();this.lights=[];this.physics=null;this.fields=[];this.root=new GameNode('Root');this.systems=new Set();this.camera=basis([3,2,5],[0,.5,0]);this.sun=unit([-.4,.8,.5]);this.focus=[0,0,0];this.fov=.4;this.shadow=1024;this.t=0}
 enablePhysics(options){return this.physics=new PhysicsWorld(options)}
 update(dt){this.t+=dt;for(const system of this.systems)system(dt,this);if(this.physics)this.physics.step(dt)}
 state(){const objects=[];this.root.collect(M.id(),objects);return {clouds:this.clouds,forwardPlus:this.forwardPlus,clipZ:this.clipZ,fogDensity:this.fogDensity,deferred:this.deferred,indirect:this.indirect,lights:this.lights,fields:this.fields,camera:this.camera,sun:unit(this.sun),focus:this.focus,fov:this.fov,shadow:this.shadow,t:this.t,planet:false,objects}}
}
const qualityProfiles=Object.freeze({
 mobile:Object.freeze({width:1280,shadow:256,radius:1,steps:24,deferred:false,indirect:false}),
 aa:Object.freeze({width:1920,shadow:768,radius:2,steps:48,deferred:true,indirect:false}),
 ultra:Object.freeze({width:3840,shadow:1536,radius:3,steps:72,deferred:true,indirect:true})
});
class Game{
 constructor(canvas,{photo=false,physicsHz=60,profile=null}={}){this.photoEnabled=photo;this.canvas=canvas;this.renderer=new StageRenderer(canvas);this.clock=new Clock(physicsHz);this.world=new GameWorld();this.frameId=0;this.widthLimit=1920;this.managed=new Set();this.assets=new Set();this.streams=new Set();this.disposed=false;if(profile)this.setProfile(profile)}
 setProfile(name){
  const p=qualityProfiles[name];if(!Object.hasOwn(qualityProfiles,name))throw RangeError('Unknown profile');
  this.world.forwardPlus=!p.deferred;this.profile=name;this.widthLimit=p.width;this.world.shadow=p.shadow;this.world.deferred=p.deferred;this.world.indirect=p.indirect;
  for(const stream of this.streams){stream.radius=p.radius;stream.steps=p.steps;stream.cx=undefined}
 }
 async load(bytes,resolve){const model=await importModel(bytes,resolve);return this.upload(model)}
 async upload(model){if(this.disposed)throw Error("Game disposed");const parts=await this.renderer.upload(model);if(this.disposed){this.renderer.free(parts);throw Error("Game disposed")}let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(const p of model.parts)for(let i=0;i<p.vertices.length;i+=8)for(let j=0;j<3;j++){
  const v=p.vertices[i+j];lo[j]=Math.min(lo[j],v);hi[j]=Math.max(hi[j],v)
 }
 if(Number.isFinite(lo[0]))parts.bounds={center:vmul(add(lo,hi),.5),extent:vmul(sub(hi,lo),.5)};
 if(this.photoEnabled){
  try{parts.photoSource=await preparePhotoMeshes(model.parts);if(this.disposed)throw Error('Game disposed')}
  catch(error){this.renderer.free(parts);throw error}
 }
 this.assets.add(parts);return parts}
 loadScene(doc,read){return loadScene(this,doc,read)}
 photo(options){return renderWorldPhoto(this.world,options)}
 release(parts){if(this.assets.delete(parts))this.renderer.free(parts)}
 terrain(options){if(this.disposed)throw Error("Game disposed");const stream=new TerrainStream(this,{...options,...(this.profile?{steps:qualityProfiles[this.profile].steps,radius:qualityProfiles[this.profile].radius}:{})});this.streams.add(stream);return stream}
 start(){if(this.frameId)return;let last=0;
 const loop=now=>{this.frameId=requestAnimationFrame(loop);if(document.hidden){last=0;return}this.clock.tick(last?(now-last)/1000:0,dt=>this.world.update(dt));last=now;
 const c=this.canvas,scale=Math.min(devicePixelRatio||1,this.widthLimit/Math.max(1,c.clientWidth,c.clientHeight)),w=Math.max(1,Math.round(c.clientWidth*scale)),h=Math.max(1,Math.round(c.clientHeight*scale));if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;
 this.renderer.frame(this.world.state(),w,h)};this.frameId=requestAnimationFrame(loop)}
 stop(){cancelAnimationFrame(this.frameId);this.frameId=0}
 dispose(){if(this.disposed)return;this.disposed=true;this.stop();for(const item of this.managed)item.dispose();for(const stream of this.streams)stream.dispose();for(const asset of this.assets)this.renderer.free(asset);this.assets.clear();const r=this.renderer,g=r.gl;
 r.deferred?.dispose();r.tileCache?.dispose();if(r.forwardPlus)g.deleteProgram(r.forwardPlus.p);g.deleteBuffer(r.quad);g.deleteBuffer(r.instanceBuffer);for(const t of new Set([r.white,r.shadow,r.map,r.environment,r.reflectTex]))g.deleteTexture(t);g.deleteFramebuffer(r.reflectFB);g.deleteRenderbuffer(r.reflectDepth);g.deleteFramebuffer(r.fb);g.deleteRenderbuffer(r.depth);g.deleteProgram(r.bg.p);g.deleteProgram(r.meshProgram.p)}
}
globalThis.SKERRY=Object.freeze({version:"0.29.0",VoxelVolume,ElevationAtlas,TerrariumAtlas,qualityProfiles,Actions,Entities,terrainHeight,bakeTerrain,TerrainStream,PhysicsWorld,PhysicsBody,airForces,InstanceField,Geometry,Game,GameWorld,GameNode,Clock,StageRenderer,importModel,readDEM,advanceGeo,basis,M});

})();
