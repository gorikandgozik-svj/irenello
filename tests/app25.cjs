// Smoke-test DOM handlers and the exact bundled entry point. GPU readback is tested separately.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'Skerry.html'),'utf8'),source=html.split('<script>')[1].split('</script>')[0];
const nodes=new Map(),elements=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='quality'?'auto':'race',style:{},dataset:{},tagName:'BUTTON',getContext:()=>gl,addEventListener(){},removeAttribute(){},replaceChildren(){},append(){},querySelector:()=>elements('option'),setPointerCapture(){},click(){this.onclick?.()}});return nodes.get(id)};
const document={hidden:false,getElementById:elements,querySelector:elements,querySelectorAll:()=>[],addEventListener(){},createElement:elements};
let seq=1;const gl=new Proxy({},{get:(o,k)=>{if(/^[A-Z0-9_]+$/.test(k))return k;if(k.startsWith('create'))return ()=>seq++;if(k==='getProgramParameter')return(p,t)=>t==='LINK_STATUS';if(k==='getShaderParameter')return()=>true;if(k==='getExtension')return()=>({drawElementsInstancedANGLE(){},vertexAttribDivisorANGLE(){}});if(k==='checkFramebufferStatus')return()=>'FRAMEBUFFER_COMPLETE';return()=>{}}});
let frame,store={};const context={document,atob,btoa,Image:class{async decode(){}},Blob,TextDecoder,URL:{createObjectURL:()=>'blob:test',revokeObjectURL(){}},devicePixelRatio:1,innerWidth:800,innerHeight:480,requestAnimationFrame:f=>{frame=f;return 1},cancelAnimationFrame(){},localStorage:{setItem:(k,v)=>store[k]=v,getItem:k=>store[k]},console,setTimeout};
(async()=>{await vm.runInNewContext(source,context);assert.equal(elements('msg').textContent,'');frame(1);
 const mode=m=>elements('mode').onchange({target:{value:m}});
 mode('walk');assert.equal(elements('pulse').hidden,false);elements('action').onclick();elements('pulse').onclick();elements('cam').onclick();frame(18);
 mode('earth');await elements('route').onclick();assert(elements('msg').textContent.includes('синтетический'));frame(35);elements('airCam').onclick();frame(51);elements('warp').onclick();frame(68);
 mode('asset');elements('dupe').onclick();frame(85);mode('inlet');assert(elements('inlet').srcdoc.includes('Северный пролив'));
 mode('race');elements('action').onclick();elements('quality').value='4k';frame(110);assert.equal(elements('view').width,3840);
 console.log('OK: offline bundle, all five modes, terrain flight, cameras, impulse, project editor and 4K buffer.');
})().catch(e=>{console.error(e);process.exitCode=1});
