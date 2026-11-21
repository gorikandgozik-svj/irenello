const assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs'),vm=require('node:vm');
require('../SkerrySDK.js');
const {TerrariumAtlas,ElevationAtlas,GameWorld,importModel}=globalThis.SKERRY;
async function check(){
 const bad=new TerrariumAtlas(60,13,{read:async()=>new Uint8Array(2)});
 await assert.rejects(bad.tile(0,0,0),/pixels/);
 await assert.rejects(bad.tile(0,1,1),/outside/);
 const root=path.join(__dirname,'..');
 const file=new Blob([fs.readFileSync(path.join(root,'assets/Jacksboro.skdem'))]);
 const atlas=await ElevationAtlas.open(file);
 const game={world:new GameWorld(),managed:new Set(),upload:async m=>m.parts,release(){}};
 const stream=atlas.stream(game);const eye=[30,80,120];
 stream.update(eye);const plan=stream.plan;stream.update(eye);assert.equal(plan,stream.plan);
 eye[0]+=10;stream.update(eye);assert.notEqual(plan,stream.plan);
 stream.dispose();assert.equal(game.managed.size,0);assert.equal(game.world.systems.size,0);
 const data=fs.readFileSync(path.join(root,'assets/SK-27.glb'));
 const len=data.readUInt32LE(12),doc=JSON.parse(data.subarray(20,20+len));
 doc.buffers[0].uri='mesh.bin';const bin=data.subarray(28+len);
 const primitive=doc.meshes[0].primitives[0],idx=primitive.attributes.POSITION;
 const load=()=>importModel(Buffer.from(JSON.stringify(doc)),async()=>bin);
 doc.accessors[idx].type='VEC2';await assert.rejects(load);doc.accessors[idx].type='VEC3';
 const a=doc.accessors[idx],v=doc.bufferViews[a.bufferView];
 bin.writeFloatLE(NaN,(v.byteOffset||0)+(a.byteOffset||0));await assert.rejects(load);
 const context={assert};vm.runInNewContext(['math','tiles'].map(n=>fs.readFileSync(path.join(root,'src',n+'.js'),'utf8')).join('\n')+`
 const cache=new LightTileCache({gl:{},texture:()=>1}),cam=basis([0,0,5],[0,0,0]);
 const ls=[{range:2,intensity:3,position:[0,0,0],color:[1,.5,.1]}];
 cache.update(ls,cam,.5,128,128);const first=cache.data;
 cache.update(ls,cam,.5,128,128);assert.equal(cache.data,first);
 ls[0].color[1]=.25;cache.update(ls,cam,.5,128,128);assert.notEqual(cache.data,first);
 `,context);
 console.log('OK: invalid inputs rejected, mutable light invalidation, terrain plan reuse, stream lifetime.');
}
check().catch(e=>{console.error(e);process.exitCode=1});
