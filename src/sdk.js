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
