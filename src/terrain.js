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
