// Record the same calls made by StageRenderer, including GPU instancing, for EGL headless verification.
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),out=process.argv[2];fs.mkdirSync(out,{recursive:true});
const enums={VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,COMPILE_STATUS:35713,LINK_STATUS:35714,ACTIVE_UNIFORMS:35718,ACTIVE_ATTRIBUTES:35721,ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963,STATIC_DRAW:35044,DYNAMIC_DRAW:35048,FLOAT:5126,UNSIGNED_SHORT:5123,UNSIGNED_BYTE:5121,TRIANGLES:4,TEXTURE_2D:3553,TEXTURE_MIN_FILTER:10241,TEXTURE_MAG_FILTER:10240,TEXTURE_WRAP_S:10242,TEXTURE_WRAP_T:10243,NEAREST:9728,LINEAR:9729,LINEAR_MIPMAP_LINEAR:9987,CLAMP_TO_EDGE:33071,FRAMEBUFFER:36160,RENDERBUFFER:36161,DEPTH_COMPONENT16:33189,COLOR_ATTACHMENT0:36064,DEPTH_ATTACHMENT:36096,RGBA:6408,DEPTH_TEST:2929,DEPTH_BUFFER_BIT:256,COLOR_BUFFER_BIT:16384,FRAMEBUFFER_COMPLETE:36053,TEXTURE0:33984,BLEND:3042,SRC_ALPHA:770,ONE_MINUS_SRC_ALPHA:771};
let serial=0,ops=[],sources={},attached={},symbols={};
const ext={vertexAttribDivisorANGLE:(...a)=>ops.push(['vertexAttribDivisor',0,...a]),drawElementsInstancedANGLE:(...a)=>ops.push(['drawElementsInstanced',0,...a])};
const gl=new Proxy(enums,{get:(obj,k)=>k in obj?obj[k]:(...a)=>{
 if(k==='getExtension'&&a[0]==='WEBGL_draw_buffers')return process.argv.includes('--serial')?null:{MAX_DRAW_BUFFERS_WEBGL:34852,MAX_COLOR_ATTACHMENTS_WEBGL:36063,drawBuffersWEBGL:list=>ops.push(['drawBuffers',0,list])};
 if(k==='getParameter'&&[34852,36063].includes(a[0]))return 4;if(k==='getExtension')return ext;if(k==='getShaderParameter')return true;
 if(k==='getProgramParameter'){const s=symbols[a[0]];return a[1]===35718?s.uniform.length:a[1]===35721?s.attribute.length:true}
 if(k==='getActiveUniform'||k==='getActiveAttrib')return {name:symbols[a[0]][k==='getActiveUniform'?'uniform':'attribute'][a[1]]};
 if(k==='checkFramebufferStatus')return 36053;
 if(k==='shaderSource')sources[a[0]]=a[1];if(k==='attachShader')(attached[a[0]]??=[]).push(a[1]);
 if(k==='linkProgram'){const all=attached[a[0]].map(i=>sources[i]).join('\n'),s={};for(const kind of ['uniform','attribute'])s[kind]=[...new Set([...all.matchAll(new RegExp(kind+'\\s+\\w+\\s+([^;]+);','g'))].flatMap(m=>m[1].split(',').map(x=>x.trim())))];symbols[a[0]]=s}
 let id=0;if(k.startsWith('create')||k.startsWith('get'))id=++serial;
 if(k==='bufferData'){const name='buf'+ops.length;fs.writeFileSync(path.join(out,name),Buffer.from(a[1].buffer,a[1].byteOffset,a[1].byteLength));a[1]=name}
 if(k==='texImage2D'&&a.length===9&&ArrayBuffer.isView(a[8])&&a[8].byteLength>16){const name='tex'+ops.length;fs.writeFileSync(path.join(out,name),Buffer.from(a[8].buffer,a[8].byteOffset,a[8].byteLength));a[8]=name}
 if(k==='texImage2D'&&a.length===6){const name='img'+ops.length;fs.writeFileSync(path.join(out,name),a[5]);a[5]=name}
 ops.push([k,id,...a]);return id}});
const PINE=fs.readFileSync(path.join(root,'assets/pine.png')).toString('base64');
// Execute the browser photo worker in a native Node worker during offline verification.
const NativeWorker=require('node:worker_threads').Worker;
class CaptureWorker{
 constructor(url){
  const blob=require('node:buffer').resolveObjectURL(url);
  this.ready=blob.text().then(code=>{
   this.thread=new NativeWorker("const {parentPort}=require('node:worker_threads');global.postMessage=(p,t)=>parentPort.postMessage(p,t);"+code+";parentPort.on('message',data=>onmessage({data}))",{eval:true});
   this.thread.on('message',data=>this.onmessage({data}));this.thread.on('error',e=>this.onerror(e))
  })
 }
 postMessage(v){this.ready.then(()=>this.thread.postMessage(v))}
 terminate(){this.ready.then(()=>this.thread.terminate())}
}
const source=['clock','world','program','render','math','physics','batches','scenery','airframe','gltf','track','pipeline','tiles','deferred','voxels','elevation','relief','yard','sim','terrain','entities','actions','project','photo','sdk'].map(n=>fs.readFileSync(path.join(root,'src',n+'.js'),'utf8')).join('\n');
vm.runInNewContext(source+`
decodeImage=async b=>{if(b[0]===137){const v=new DataView(b.buffer,b.byteOffset,b.byteLength);b.width=v.getUint32(16);b.height=v.getUint32(20)}return b};
(async()=>{if(geometry){
 const dom={querySelector:k=>k==='canvas'?{getContext:()=>gl}:{}};
 Game.prototype.start=function(){};
 const lab=await vm.runInNewContext(fs.readFileSync(path.join(root,'examples/geometry/main.js'),'utf8'),{SKERRY,document:dom,console});
 for(const [p,w,h] of [['mobile',1280,720],['aa',1920,1080],['ultra',3840,2160]]){
  await lab.apply(p);ops.push(['begin',0]);lab.game.renderer.frame(lab.game.world.state(),w,h);ops.push(['end',0]);console.log(p,lab.game.renderer.stats);ops.push(['save',0,p,w,h]);
 }return
 }if(elevation){
 const document={querySelector:k=>k==='canvas'?{getContext:()=>gl}:{}};
 const context=vm.createContext({SKERRY,document,Blob,Uint8Array,atob,console});
 Game.prototype.start=function(){};
 vm.runInContext(fs.readFileSync(path.join(root,'examples/elevation/sample.js'),'utf8'),context);
 const sim=await vm.runInContext(fs.readFileSync(path.join(root,'examples/elevation/main.js'),'utf8'),context);
 if(!sim)throw Error('DEM lab initialization failed');
 for(let i=0;i<220;i++){sim.game.world.update(.05);await new Promise(r=>setTimeout(r,2))}
 if(sim.stream.error||sim.stream.nodes.size<5)throw Error('No loaded terrain');
 sim.game.renderer.frame(sim.game.world.state(),3840,2160);console.log('DEM',sim.stream.nodes.size,sim.stream.bytesRead,sim.game.renderer.stats);
 ops.push(['save',0,'real-terrain',3840,2160]);return}
 if(foundry){
 const nodes=new Map(),document={querySelector(k){if(!nodes.has(k))nodes.set(k,k==='canvas'?{getContext:()=>gl}:{value:k==='#profile'?'aa':''});return nodes.get(k)}};
 const before=Game.prototype.start;Game.prototype.start=function(){};
 try{
 const lab=await vm.runInNewContext(fs.readFileSync(path.join(root,'examples/foundry/main.js'),'utf8'),{SKERRY,document,console});if(!lab)throw Error(document.querySelector('output').textContent);
 for(const [profile,w,h] of [['mobile',1280,720],['aa',1920,1080],['ultra',3840,2160]]){
 lab.apply(profile);const state=lab.game.world.state();ops.push(['begin',0]);lab.game.renderer.frame(state,w,h);ops.push(['end',0]);for(let k=0;k<3;k++){ops.push(['begin',0]);lab.game.renderer.frame(state,w,h);ops.push(['end',0])}console.log(profile,lab.game.renderer.stats);ops.push(['save',0,profile,w,h])
 }
 await lab.cut();lab.game.renderer.frame(lab.game.world.state(),1280,720);ops.push(['save',0,'cut',1280,720]);return
 }finally{Game.prototype.start=before}
 }
 if(studio){
 let game;Game.prototype.start=function(){game=this};
 const ui={querySelector:k=>k==='canvas'?{getContext:()=>gl}:{}};
 const text=fs.readFileSync(path.join(root,'MaterialLab.html'),'utf8').split('<script>')[1].split('</script>')[0];
 await vm.runInNewContext(text,{SKERRY,document:ui,console});
 if(!game)throw Error('Material lab failed to start');
 const raw=await game.photo({width:480,height:270,samples:photoSamples,bounces:4,seed:19});
 fs.writeFileSync(path.join(out,'studio.rgba'),raw);console.log('CPU photo 480x270',photoSamples,'spp · 4 bounces');return
 }
 if(landscape){
 const canvas={getContext:()=>gl};let queued;
 const dom={querySelector:k=>k==='canvas'?canvas:({})};
 const context={SKERRY,atob,addEventListener(){},removeEventListener(){},document:dom,console,requestAnimationFrame:f=>{queued=f;return 1}};
 vm.createContext(context);
 const gameStart=Game.prototype.start;
 let game;Game.prototype.start=function(){game=this};
 try{
 vm.runInContext(fs.readFileSync(path.join(root,'examples/landscape/foliage.js'),'utf8'),context);
 await vm.runInContext(fs.readFileSync(path.join(root,'examples/landscape/main.js'),'utf8'),context);
 for(let i=0;i<140;i++){game.world.update(1/60);await Promise.resolve();await Promise.resolve();await Promise.resolve()}
 const state=game.world.state();game.renderer.frame(state,1920,1080);console.log('SDK landscape',game.streams.values().next().value.live.size,game.renderer.stats);
 ops.push(['save',0,'landscape',1920,1080]);
 game.renderer.culling=false;game.renderer.frame(state,1920,1080);console.log('Without culling',game.renderer.stats);ops.push(['save',0,'unculled',1920,1080]);return
 }finally{Game.prototype.start=gameStart}
 }
 const g=new StageRenderer({getContext:()=>gl}),s=new Demo();
 s.car=await g.upload(await importModel(fs.readFileSync(path.join(root,'assets/SK-27.glb'))));s.track=await g.upload(trackModel());s.fields=await uploadDecor(g);
 g.environment=g.texture(fs.readFileSync(path.join(root,'assets/dawn.jpg')));g.map=g.texture(fs.readFileSync(path.join(root,'assets/earth.jpg')));
 if(stress){s.mode='stress';
 for(const n of [128,256,512]){s.fleetCount=n;ops.push(['begin',0]);g.frame(s.state(0),3840,2160);ops.push(['end',0]);console.log('4K stress',n,g.stats);ops.push(['save',0,'fleet'+n,3840,2160])}return}
 const population=s.fields.map(f=>f.records.length/7);console.log('population',population,population.reduce((a,b)=>a+b));
 s.yard=new ServiceYard();s.yardMeshes=await yardAssets(g);for(let i=0;i<90;i++)s.yard.step(1/60,new Set());
 for(const mode of ['race','walk','earth']){
 s.mode=mode;const state=s.state(1024);g.frame(state,3840,2160);console.log(mode,g.stats);ops.push(['save',0,mode,3840,2160])}
 s.airframe=await g.upload(aircraftMesh());const rel=readDEM(fs.readFileSync(path.join(root,'assets/Alpine-25.asc'),'utf8'));rel.gpu=await g.upload(rel);s.relief=rel;s.lat=rel.lat-.0008;s.lon=rel.lon;s.alt=rel.heightAt(s.lat,s.lon)+920;s.bearing=.3;s.alpha=.045;s.flight=true;s.airSpeed=139;g.frame(s.state(1024),3840,2160);ops.push(['save',0,'flight',3840,2160]);

 s.mode='race';const race=s.state(1024);g.frame(race,1280,720);
 for(let i=0;i<5;i++){ops.push(['begin',0]);g.frame(race,1280,720);ops.push(['end',0])}
 ops.push(['save',0,'batched',1280,720]);
 for(let y=0;y<3456;y+=768)for(let x=0;x<6144;x+=768){const w=768,h=Math.min(768,3456-y);g.frame(race,w,h,16/9,[w/6144,h/3456,(2*x+w)/6144-1,1-(2*y+h)/3456],x+y===0);ops.push(['tile',0,x,y,w,h])}
 g.instancing=null;g.frame(race,1280,720);console.log('fallback',g.stats);ops.push(['save',0,'individual',1280,720]);
})()`,{gl,fs,path,root,out,PINE,vm,Worker:process.argv.includes('--studio')?CaptureWorker:undefined,URL,Blob,Math,Infinity,Number,Array,addEventListener(){},removeEventListener(){},photoSamples:Number((process.argv.find(x=>x.startsWith('--samples='))||'--samples=4').split('=')[1]),setTimeout,geometry:process.argv.includes('--geometry'),elevation:process.argv.includes('--elevation'),foundry:process.argv.includes('--foundry'),studio:process.argv.includes('--studio'),landscape:process.argv.includes('--landscape'),stress:process.argv.includes('--stress'),console,TextDecoder,atob,ops}).then(()=>fs.writeFileSync(path.join(out,'ops.json'),JSON.stringify(ops))).catch(e=>{console.error(e);process.exitCode=1});
