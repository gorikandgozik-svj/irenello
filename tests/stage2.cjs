const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const src=['world','math','physics','gltf','track','pipeline','relief','sim'].map(n=>fs.readFileSync(path.join(root,'src',n+'.js'),'utf8')).join('\n');
vm.runInNewContext(src+`
(async()=>{
 const bytes=fs.readFileSync(path.join(root,'assets','SK-27.glb')),car=await importModel(bytes);
 assert.equal(new Set(car.parts.map(p=>p.nodeName)).size,5);
 assert(car.parts.some(p=>p.mat.image?.length>100));
 const {doc,bin}=glb(bytes);doc.buffers[0].uri='car.bin';
 const json=new TextEncoder().encode(JSON.stringify(doc));const external=await importModel(json,async u=>{assert.equal(u,'car.bin');return bin});
 assert.deepEqual(external.bounds,car.bounds);await assert.rejects(importModel(bytes.subarray(0,50)));
 const sim=new Demo();sim.car=car.parts;sim.drive=true;
 for(let i=0;i<3600;i++)sim.step(1/60,new Set());assert(sim.lap>=1);assert(sim.speed>10);
 assert.equal(sim.state(512).objects.length,6);
 const v=sim.speed;sim.drive=false;for(let i=0;i<24;i++)sim.step(1/60,new Set(['ArrowDown']));assert(sim.speed<v);
 const a=new Demo(),b=new Demo();for(let i=0;i<90;i++){a.step(1/60,new Set(['KeyW']));b.step(1/60,new Set(['KeyW','KeyA']))}assert(Math.hypot(a.x-b.x,a.z-b.z)>1);
 const [lat,lon]=advanceGeo(0,Math.PI-.001,Math.PI/2,20000);assert(lon<0&&Math.abs(lat)<1e-9);
 sim.mode='earth';for(const latitude of [-1.55,0,1.55]){sim.lat=latitude;const {camera}=sim.state(0);assert(Math.abs(dot(camera.f,camera.r))<1e-8);assert(Math.abs(Math.hypot(...camera.u)-1)<1e-8)}
 const sample=fs.readFileSync(path.join(root,'assets','Test-Ridge.asc'),'utf8'),rel=readDEM(sample);assert(rel.peak>2000);assert(rel.heightAt(rel.lat,rel.lon)>1500);assert.equal(rel.heightAt(0,0),0);assert.throws(()=>readDEM('ncols 0'));
 sim.relief={...rel,gpu:[]};sim.flight=true;sim.lat=rel.lat;sim.lon=rel.lon;sim.alt=100;sim.step(1/60,new Set());assert(sim.alt>1500);assert(sim.state(0).localCamera);
 const tan=tangentData({vertices:[0,0,0,0,0,1,0,0,1,0,0,0,0,1,1,0,0,1,0,0,0,1,0,1],indices:[0,1,2]});assert.deepEqual(Array.from(tan.slice(0,4)),[1,0,0,1]);
 console.log('OK: GLB and external glTF, texture and hierarchy, steering, braking, laps, wheel transforms, dateline, camera frames, DEM, terrain clearance, tangent space.');
})()`,{fs,path,root,assert,TextDecoder,TextEncoder,atob,console}).catch(e=>{console.error(e);process.exitCode=1});
