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
