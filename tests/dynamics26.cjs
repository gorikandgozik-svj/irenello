const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const files=['world','math','physics','sim','track'];
const code=files.map(f=>fs.readFileSync(path.join(__dirname,'../src',f+'.js'),'utf8')).join('\n');
vm.runInNewContext(code+`
const cage=new CrushCage();
assert.equal(cage.count,765);
const parts=[{source:new Float32Array([1,.3,1.6,0,1,0,0,0,-1,.3,-1.6,0,1,0,0,0])}];
cage.bind(parts);cage.impact(1,.62,32);
for(let i=0;i<180;i++)cage.step(1/120);
cage.upload({bindBuffer(){},bufferData(){}},parts);
assert(parts[0].changed[0]<.99);assert(Math.abs(parts[0].changed[8]+1)<.015);
assert(cage.rest.some(v=>v<-.03));
const sim=new Demo(),keys=new Set();keys.gas=.65;
for(let i=0;i<60;i++)sim.step(1/120,keys);
assert(sim.speed>1);sim.mode='stress';
for(const n of [16,128,256,512]){sim.fleetCount=n;assert.equal(sim.state(0).objects[0].records.length,7*n)}
`,{assert});
console.log('OK: permanent local impact, interpolation onto chassis, analog throttle, stress tiers.');
