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
