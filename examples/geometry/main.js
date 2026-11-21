async function main(){
 const canvas=document.querySelector('canvas'),menu=document.querySelector('select'),output=document.querySelector('output');
 const game=new SKERRY.Game(canvas),world=game.world;
 world.camera=SKERRY.basis([0,0,70],[0,0,0]);world.fov=.37;
 const mesh=world.root.attach(new SKERRY.GameNode('Array')),models=new Map();
 const records=[];
 for(let y=0;y<32;y++)for(let x=0;x<64;x++)records.push(x-31.5,y-15.5,0,.45,1,0,.75+(x%7)*.045);
 mesh.records=new Float32Array(records);
 let revision=0;
 async function apply(name){
  const current=++revision,segments={mobile:24,aa:64,ultra:112}[name];
  if(!segments)throw RangeError('Unknown profile');
  if(!models.has(name)){
   const g=new SKERRY.Geometry();
   g.ellipsoid({color:[.29,.51,.63],metal:.72,rough:.32},[0,0,0],[1,1,.64],segments,segments/2);
   models.set(name,game.upload(g));
  }
  const parts=await models.get(name);if(current!==revision)return;
  mesh.parts=parts;game.setProfile(name);world.shadow=0;
  output.textContent=(parts.reduce((sum,p)=>sum+p.count/3,0)*2048).toLocaleString('ru')+' треугольников · 2 048 экземпляров';
 }
 menu.onchange=()=>apply(menu.value).catch(e=>output.textContent=e.message);
 await apply('mobile');game.start();return {game,apply};
}
main().catch(e=>document.querySelector('output').textContent=e.message);
