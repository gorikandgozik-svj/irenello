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
