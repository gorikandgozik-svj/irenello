function toBase64(bytes){let str='';for(let i=0;i<bytes.length;i+=24576)str+=String.fromCharCode(...bytes.subarray(i,i+24576));return btoa(str)}
function workshop(sim,renderer,el,notice,enter){
 const built={name:'SK-27',parts:sim.car,fit:M.id(),source:null};
 let library=[built],selection=0;sim.items=[];
 const inputs=['x','y','z','rot','size'];
 function newItem(asset){return {asset,parts:asset.parts,fit:asset.fit,x:0,y:0,z:0,rot:0,size:1}}
 function refresh(){
 const sel=el('active');sel.replaceChildren();sim.items.forEach((o,i)=>{const opt=document.createElement('option');opt.value=i;opt.textContent=(i+1)+' · '+o.asset.name;sel.append(opt)});selection=clamp(selection,0,Math.max(0,sim.items.length-1));sel.value=selection;
 const obj=sim.items[selection];for(const k of inputs){el('ed'+k).disabled=!obj;el('ed'+k).value=obj?obj[k]:0}
 }
 function add(asset){const item=newItem(asset);sim.items.push(item);selection=sim.items.length-1;refresh();return item}
 async function assetFrom(record){
 const bytes=base64bytes(record.bytes),files=record.resources||{};
 const model=await importModel(bytes,async uri=>{if(!Object.hasOwn(files,uri))throw Error('В проекте нет ресурса '+uri);return base64bytes(files[uri])});
 const [a,b]=model.bounds,s=3.8/(Math.max(...sub(b,a))||1);return {name:String(record.name),parts:await renderer.upload(model),fit:M.trs([-(a[0]+b[0])*s/2,-a[1]*s+.02,-(a[2]+b[2])*s/2],undefined,[s,s,s]),source:record}
 }
 async function importFiles(files){const main=files.find(f=>/\.(gltf|glb)$/i.test(f.name));if(!main)throw Error('Выбери GLB или glTF и его ресурсы');const data=new Uint8Array(await main.arrayBuffer()),resources=Object.create(null);
 await importModel(data,async uri=>{const file=files.find(f=>f.name===uri.split('/').pop());if(!file)throw Error('Нужен файл '+uri);const bytes=new Uint8Array(await file.arrayBuffer());resources[uri]=toBase64(bytes);return bytes});
 const asset=await assetFrom({name:main.name,bytes:toBase64(data),resources});library.push(asset);add(asset);enter('asset')}
 el('active').onchange=e=>{selection=Number(e.target.value);refresh()};
 for(const k of inputs)el('ed'+k).oninput=e=>{const n=e.target.valueAsNumber;if(Number.isFinite(n)&&sim.items[selection])sim.items[selection][k]=clamp(n,k==='size'?.01:-10000,10000)};
 el('dupe').onclick=()=>{if(!sim.items.length){add(built);return}const old=sim.items[selection],o=add(old.asset);Object.assign(o,old,{x:old.x+1.5});refresh()};
 el('remove').onclick=()=>{sim.items.splice(selection,1);refresh()};
 el('writeProject').onclick=()=>{const used=[...new Set(sim.items.map(i=>i.asset))],doc={format:'skerry-scene-2',assets:used.map(a=>a.source),objects:sim.items.map(i=>({asset:used.indexOf(i.asset),...Object.fromEntries(inputs.map(k=>[k,i[k]]))}))};
 const url=URL.createObjectURL(new Blob([JSON.stringify(doc)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='scene.skerry.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)};
 el('readProject').onclick=()=>el('projectFile').click();
 el('projectFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;const next=[];try{
 const doc=JSON.parse(await f.text());if(doc.format!=='skerry-scene-2'||!Array.isArray(doc.assets)||!Array.isArray(doc.objects))throw Error('Нужен проект SKERRY 0.2');
 for(const rec of doc.assets)next.push(rec===null?built:await assetFrom(rec));const items=doc.objects.map(o=>{if(!next[o.asset]||!inputs.every(k=>Number.isFinite(o[k]))||o.size<=0)throw Error('Некорректный объект');return Object.assign(newItem(next[o.asset]),Object.fromEntries(inputs.map(k=>[k,o[k]])))});
 for(const a of library)if(a!==built)renderer.free(a.parts);library=[...new Set([built,...next])];sim.items=items;selection=0;enter('asset');refresh()
 }catch(err){for(const a of next)if(a!==built)renderer.free(a.parts);notice(err.message)}finally{e.target.value=''}};
 add(built);return {importFiles,refresh}
}
