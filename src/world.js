// World units are metres. The origin is the middle of the inlet.
function hash(x,z){
  let n=Math.imul(x,374761393)+Math.imul(z,668265263)|0;
  n=Math.imul(n^(n>>>13),1274126177);
  return ((n^(n>>>16))>>>0)/4294967296;
}
function noise(x,z){
  const i=Math.floor(x),j=Math.floor(z);
  let u=x-i,v=z-j; u=u*u*(3-2*u);v=v*v*(3-2*v);
  const a=hash(i,j),b=hash(i+1,j),c=hash(i,j+1),d=hash(i+1,j+1);
  return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
}
function height(x,z){
  const coast=Math.abs(x-90*Math.sin(z*.004)-45*Math.sin(z*.009))-125;
  let t=Math.max(0,Math.min(1,(coast+20)/490));t=t*t*(3-2*t);
  const ridge=1-Math.abs(noise(x*.003+4,z*.003)-.5)*2;
  const rock=noise(x*.018,z*.018)*22+noise(x*.052,z*.052)*6;
  const headwall=Math.max(0,Math.min(1,(z-1120)/530));
  const summit=headwall*headwall*(185+90*ridge+70*noise(x*.01,z*.01));
  return summit-19+Math.min(1,Math.max(0,(coast+60)/130))*rock+t*(75+230*ridge+155*noise(x*.004,z*.004));
}
class Scene{
  constructor(){this.objects=[];this.systems=[]}
  add(mesh,position=[0,0,0],scale=[1,1,1]){const o={mesh,position,scale};this.objects.push(o);return o}
  update(dt){for(const system of this.systems)system(dt,this)}
}
function terrainTile(x,z,size,steps){
  const data=[],indices=[],stride=steps+1;
  for(let j=0;j<=steps;j++)for(let i=0;i<=steps;i++){
    const X=x+size*i/steps,Z=z+size*j/steps,Y=height(X,Z);
    let nx=(height(X-2,Z)-height(X+2,Z))/4,nz=(height(X,Z-2)-height(X,Z+2))/4,k=Math.hypot(nx,1,nz);
    data.push(X,Y,Z,nx/k,1/k,nz/k,0,0,0);
    if(i<steps&&j<steps){const a=j*stride+i;indices.push(a,a+stride,a+1,a+1,a+stride,a+stride+1)}
  }
  // Skirts cover height differences at boundaries between mesh resolutions.
  const edges=[[],[],[],[]];
  for(let i=0;i<=steps;i++){edges[0].push(i);edges[1].push(steps*stride+i);edges[2].push(i*stride);edges[3].push(i*stride+steps)}
  for(const edge of edges){
    let prev=-1,top=-1;
    for(const idx of edge){const k=data.length/9;data.push(...data.slice(idx*9,idx*9+9));data[k*9+1]-=22;
      if(prev>=0)indices.push(prev,top,k,top,idx,k);prev=k;top=idx}
  }
  return {data,indices};
}
function towerMesh(){
  const data=[],indices=[];
  function ring(y,r,h,r2,c,n=32,dx=0,dz=0){
    for(let i=0;i<n;i++){
      let a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n,k=data.length/9;
      for(const [ang,Y,R] of [[a,y,r],[b,y,r],[a,y+h,r2],[b,y+h,r2]]){
        data.push(dx+Math.cos(ang)*R,Y,dz+Math.sin(ang)*R,Math.cos(ang),Math.max(0,(r-r2)/h),Math.sin(ang),...c)}
      indices.push(k,k+1,k+2,k+1,k+3,k+2);
    }
  }
  const red=[.67,.075,.035],ivory=[.82,.78,.65],iron=[.10,.14,.14];
  ring(-6,7,8,6,[.32,.30,.25]);ring(2,5.3,13,4.2,ivory);ring(15,4.2,8,3.6,red);
  ring(23,3.6,6,3.2,ivory);ring(29,4.6,1,4.6,iron);ring(30,4.6,.3,2.8,iron);
  ring(30,2.8,4,2.8,[1,.76,.32]);ring(34,3.5,2.4,.24,red);ring(36.4,.22,2.4,.1,iron);
  for(let i=0;i<12;i++){let a=i*Math.PI/6;ring(30,.12,4,.12,iron,6,2.85*Math.cos(a),2.85*Math.sin(a))}
  return {data,indices}
}
