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
