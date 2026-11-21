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
