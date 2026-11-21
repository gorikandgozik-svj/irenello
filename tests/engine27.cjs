const assert=require('node:assert/strict'),{Worker}=require('node:worker_threads'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../SkerrySDK.js'),'utf8');
const urls=new Map();
class TestWorker{
 constructor(url){
  const blob=urls.get(url);this.ready=blob.text().then(code=>{
   this.worker=new Worker("const {parentPort}=require('node:worker_threads');global.postMessage=(v,t)=>parentPort.postMessage(v,t);"+code+";parentPort.on('message',data=>onmessage({data}));",{eval:true});
   this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',error=>this.onerror?.(error))
  })
 }
 postMessage(data){this.ready.then(()=>this.worker.postMessage(data))}
 terminate(){this.ready.then(()=>this.worker.terminate())}
}
const context=vm.createContext({Worker:TestWorker,Blob,URL:{createObjectURL:b=>{const id=String(urls.size);urls.set(id,b);return id},revokeObjectURL:id=>urls.delete(id)},console});
vm.runInContext(source,context);
const {Game,GameWorld,GameNode,Entities,TerrainStream,bakeTerrain,terrainHeight,Geometry,basis}=context.SKERRY;
const delay=()=>new Promise(r=>setTimeout(r,2));
(async()=>{
 for(const hz of [120,240,1000]){
  const clock=new context.SKERRY.Clock(hz);let ticks=0;
  for(let i=0;i<60;i++)clock.tick(1/60,()=>ticks++);
  assert.equal(ticks,hz)
 }
 const listeners={},target={addEventListener(k,f){listeners[k]=f},removeEventListener(k){delete listeners[k]}};
 const pad={mapping:'standard',axes:[.6],buttons:[]};
 const actions=new context.SKERRY.Actions({move:{keys:{KeyA:-1},axes:{0:1},deadzone:.2}},{target,getPads:()=>[pad]});
 assert(Math.abs(actions.sample().move-.5)<1e-7);listeners.keydown({code:'KeyA'});assert(actions.sample().move<0);
 actions.set('move',1,7);listeners.blur();assert(Math.abs(actions.sample().move-.5)<1e-7);actions.dispose();assert.equal(Object.keys(listeners).length,0);
 const ecs=new Entities(),a=ecs.create({transform:1,mesh:'a'}),b=ecs.create({transform:2});
 assert.equal([...ecs.query('mesh','transform')].length,1);ecs.remove(a,'mesh');assert.equal([...ecs.query('mesh')].length,0);
 ecs.destroy(b);assert.throws(()=>ecs.set(b,'mesh',{}));
 const opts={size:80,steps:24,seed:145},one=bakeTerrain({...opts,x:-1,z:1}),two=bakeTerrain({...opts,x:0,z:1});
 const stride=opts.steps+1;
 for(let i=0;i<stride;i++)for(const field of [1,3,4,5])assert.equal(one.vertices[(i*stride+24)*8+field],two.vertices[i*stride*8+field]);
 assert.equal(one.vertices[1],Math.fround(terrainHeight(-80,80,145)));
 const assets=new Set(),world=new GameWorld();
 const game={world,streams:new Set(),async upload(m){assets.add(m.parts);return m.parts},release(parts){assert(assets.delete(parts))}};
 const stream=new TerrainStream(game,{size:80,radius:1,steps:12,seed:145});
 stream.update([0,0,0]);stream.update([1600,0,0]);
 for(let i=0;i<2000&&stream.live.size<9;i++){await delay();stream.update([1600,0,0])}
 assert.equal(stream.live.size,9);assert.equal(assets.size,9);assert(!stream.live.has('0,0'));
 stream.dispose();assert.equal(assets.size,0);assert.equal(world.root.children.size,0);
 const fake={world:new GameWorld(),load:async bytes=>{if(!bytes.length)throw Error('missing mesh');return [{}]},release(p){assets.delete(p)}};
 const manifest={format:'skerry.scene/1',nodes:[{id:'a',mesh:'object.glb'},{id:'b',parent:'a',mesh:'./object.glb'}]};
 let reads=0;const project=await Game.prototype.loadScene.call(fake,manifest,async()=>{reads++;return [1]});
 assert.equal(reads,1);assert.equal(project.nodes.get('a').children.size,1);project.dispose();
 await assert.rejects(Game.prototype.loadScene.call(fake,{...manifest,nodes:[{id:'a',mesh:'../object.glb'}]},async()=>[1]));
 assert.equal(fake.world.root.children.size,0);
 const geom=new Geometry();geom.box({color:[.65,.08,.03],metal:.1,rough:.4},[0,0,0],[1,1,1]);
 const ref=new GameWorld();ref.root.attach(new GameNode('material',[{}])).parts.photoSource=geom.parts;
 ref.camera=basis([1,1,3],[0,0,0]);
 const params={width:48,height:32,samples:3,bounces:3,seed:8};
 const pixels=await Game.prototype.photo.call({world:ref},params),replay=await Game.prototype.photo.call({world:ref},params);
 assert.equal(pixels.length,48*32*4);assert.deepEqual(pixels,replay);assert(pixels.some((n,i)=>i%4===0&&n>pixels[i+1]+30));
 console.log('OK: isolated ECS, seeded shared tile edge, real worker transfer, pending teleport, resource disposal, deterministic BVH photo.');
})().catch(e=>{console.error(e);process.exitCode=1});
