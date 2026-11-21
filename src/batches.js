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
