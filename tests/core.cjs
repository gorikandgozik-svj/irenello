const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const world = ['clock','world'].map(f=>fs.readFileSync(path.join(__dirname,'../src',f+'.js'),'utf8')).join('\n');
vm.runInNewContext(world + `
for(const fps of [30,60,120]){
  let steps=0;const clock=new Clock();
  for(let i=0;i<fps;i++)clock.tick(1/fps,()=>steps++);
  assert.equal(steps,60);
}
const clock=new Clock();let ticks=0;clock.tick(8,()=>ticks++);assert.equal(ticks,6);
const scene=new Scene(),object=scene.add('test');
scene.systems.push(dt=>object.position[0]+=dt);scene.update(.25);assert.equal(object.position[0],.25);
for(const steps of [4,6,10,12,16,20,24,40]){
 const mesh=terrainTile(-256,0,256,steps),next=terrainTile(0,0,256,steps);
 assert.equal(mesh.data.length%9,0);
 assert.ok(mesh.indices.every(i=>Number.isInteger(i)&&i>=0&&i<mesh.data.length/9));
 assert.ok(mesh.data.every(Number.isFinite));
 for(let j=0;j<=steps;j++){
   let p=(j*(steps+1)+steps)*9,q=j*(steps+1)*9;
   assert.deepEqual(mesh.data.slice(p,p+6),next.data.slice(q,q+6))
 }
}
const tower=towerMesh();assert.ok(tower.indices.every(i=>i<tower.data.length/9));
`, {assert});
console.log('OK: fixed step, stall cap, scene systems, tile geometry, shared edges, lighthouse indices.');
