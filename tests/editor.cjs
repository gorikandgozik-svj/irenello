const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),src=['math','gltf','editor'].map(n=>fs.readFileSync(path.join(root,'src',n+'.js'),'utf8')).join('\n');
const elements=new Map();function element(){return {value:0,replaceChildren(){},append(){},click(){}}}function el(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)}
let blob;const URL={createObjectURL(b){blob=b;return 'blob:test'},revokeObjectURL(){}};
vm.runInNewContext(src+`
(async()=>{
 const sim={car:[]},renderer={upload:async m=>m.parts,free(){}},errors=[];
 const editor=workshop(sim,renderer,el,e=>errors.push(e),()=>{});
 const original=fs.readFileSync(path.join(root,'assets','SK-27.glb'));
 await editor.importFiles([{name:'example.glb',arrayBuffer:async()=>original}]);
 assert.equal(sim.items.length,2);el('dupe').onclick();assert.equal(sim.items.length,3);assert.equal(sim.items[2].x,1.5);
 el('edrot').oninput({target:{valueAsNumber:38}});el('writeProject').onclick();
 const content=await saved().text();el('remove').onclick();assert.equal(sim.items.length,2);
 await el('projectFile').onchange({target:{files:[{text:async()=>content}]}});
 assert.deepEqual(errors,[]);assert.equal(sim.items.length,3);assert.equal(sim.items[2].rot,38);assert(sim.items[2].parts.length>1);
 await el('projectFile').onchange({target:{files:[{text:async()=>'{}'}]}});
 assert.equal(errors.length,1);assert.equal(sim.items.length,3);
 console.log('OK: import, duplicate, transform, portable project round trip, rejected invalid project preserves objects.');
})()`,{fs,path,root,assert,TextDecoder,atob,btoa,Blob,URL,el,saved:()=>blob,document:{createElement:element},setTimeout:()=>0,console}).catch(e=>{console.error(e);process.exitCode=1});
