class Renderer{
 constructor(canvas){
  this.gl=canvas.getContext('webgl',{antialias:false,alpha:false,preserveDrawingBuffer:false});
  if(!this.gl)throw Error('Для сцены нужен браузер с WebGL.');
  const gl=this.gl;
  this.sky=this.program(screenVS,skyFS);this.land=this.program(meshVS,meshFS);
  this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  this.fallback=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.fallback);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
  this.ref=gl.createTexture();this.fb=gl.createFramebuffer();this.depth=gl.createRenderbuffer();
  gl.bindTexture(gl.TEXTURE_2D,this.ref);
  for(const [p,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,p,v);
  this.tiles=new Map();this.tris=0;
 }
 program(v,f){return compileProgram.call(this,v,f)}
 mesh({data,indices}){
  const gl=this.gl,v=gl.createBuffer(),i=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,v);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,i);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);return {v,i,count:indices.length}
 }
 listTiles(cam,quality,terrain){
  const gl=this.gl,used=new Set(),out=[],size=256;
  if(terrain!==this.activeTerrain){for(const m of this.tiles.values()){gl.deleteBuffer(m.v);gl.deleteBuffer(m.i)}this.tiles.clear();this.activeTerrain=terrain}
  if(!terrain)return out;
  for(let z=terrain.zMin;z<terrain.zMax;z++)for(let x=terrain.xMin;x<terrain.xMax;x++){
   const dx=(x+.5)*size-cam.eye[0],dz=(z+.5)*size-cam.eye[2],d=Math.hypot(dx,dz);
   const front=dx*cam.forward[0]+dz*cam.forward[2];
   if(d>540 && front < -200)continue;
   const steps=d<620?quality.grid:d<1200?quality.grid/2:Math.max(4,quality.grid/4),key=[x,z,steps].join('/');
   used.add(key);if(!this.tiles.has(key))this.tiles.set(key,this.mesh(terrain.build(x*size,z*size,size,steps)));
   out.push(this.tiles.get(key))
  }
  for(const [k,m] of this.tiles)if(!used.has(k)){gl.deleteBuffer(m.v);gl.deleteBuffer(m.i);this.tiles.delete(k)}
  return out
 }
 reflectSize(w,h){
  const gl=this.gl;if(this.rw===w&&this.rh===h)return;this.rw=w;this.rh=h;
  gl.bindTexture(gl.TEXTURE_2D,this.ref);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.bindRenderbuffer(gl.RENDERBUFFER,this.depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,w,h);
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.ref,0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,this.depth);
  if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Недоступен буфер отражений')
 }
 pass(cam,scene,tiles,time,mirror,crop,w,h,aspect,reflected){
  const gl=this.gl;gl.viewport(0,0,w,h);gl.clear(gl.DEPTH_BUFFER_BIT);
  const setup=pr=>{gl.useProgram(pr.p);const u=pr.u;
   for(const k of ['eye','forward','right','up','sun'])if(u[k])gl.uniform3fv(u[k],cam[k]);
   gl.uniform2f(u.lens,.55*aspect,.55);gl.uniform4fv(u.crop,crop);gl.uniform1f(u.mirror,mirror);if(u.time)gl.uniform1f(u.time,time)};
  const attr=(loc,size,stride,offset)=>{gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,stride,offset)};
  setup(this.sky);gl.disable(gl.DEPTH_TEST);gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);attr(this.sky.a.p,2,0,0);
  gl.bindTexture(gl.TEXTURE_2D,reflected ? this.ref : this.fallback);gl.uniform1f(this.sky.u.reflected,+reflected);gl.drawArrays(gl.TRIANGLES,0,3);gl.disableVertexAttribArray(this.sky.a.p);
  setup(this.land);gl.enable(gl.DEPTH_TEST);const {a,u}=this.land;
  const draw=m=>{gl.bindBuffer(gl.ARRAY_BUFFER,m.v);attr(a.p,3,36,0);attr(a.n,3,36,12);attr(a.color,3,36,24);
   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.i);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_SHORT,0);this.tris+=m.count/3};
  gl.uniform3f(u.origin,0,0,0);gl.uniform3f(u.scale,1,1,1);for(const tile of tiles)draw(tile);
  for(const o of scene.objects){gl.uniform3fv(u.origin,o.position);gl.uniform3fv(u.scale,o.scale);draw(o.mesh)}
  for(const loc of Object.values(a))gl.disableVertexAttribArray(loc)
 }
 frame(cam,scene,q,t,w,h,aspect=w/h,crop=[1,1,0,0],refresh=true){
  const gl=this.gl,tiles=this.listTiles(cam,q,scene.terrain);this.tris=0;
  if(q.reflect&&refresh){this.reflectSize(q.reflect,Math.max(1,Math.round(q.reflect/aspect)));gl.bindFramebuffer(gl.FRAMEBUFFER,this.fb);
   this.pass(cam,scene,tiles,t,-1,[1,1,0,0],this.rw,this.rh,aspect,false)}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);this.pass(cam,scene,tiles,t,1,crop,w,h,aspect,!!q.reflect)
 }
}
