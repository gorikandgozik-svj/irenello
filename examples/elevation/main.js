async function main(){
 const canvas=document.querySelector('canvas'),game=new SKERRY.Game(canvas),world=game.world;
 const info=document.querySelector('output');world.clouds=.9;world.shadow=0;world.clipZ=[(80000+3)/(80000-3),2*3*80000/(80000-3)];world.fogDensity=.000062;
 world.fov=.47;world.sun=[-.55,.55,-.3];
 let atlas,stream,x=0,z=0,heading=.52,paused=false,serial=0;
 async function select(file){
  const n=++serial,a=file instanceof SKERRY.TerrariumAtlas?file:await SKERRY.ElevationAtlas.open(file);if(n!==serial)return;
  stream?.dispose();atlas=a;stream=a.stream(game,{maxTiles:85,reads:3});world.systems.delete(stream.system);
  x=a.width*.38;z=a.depth*.72;heading=.52;update(0)
 }
 function update(dt){
  if(!atlas)return;
  if(x<atlas.width*.08||x>atlas.width*.92||z<atlas.depth*.08||z>atlas.depth*.92)heading=Math.atan2(atlas.width*.5-x,z-atlas.depth*.5);
  const dx=Math.sin(heading),dz=-Math.cos(heading),speed=paused?0:250;
  x+=dx*speed*dt;z+=dz*speed*dt;const y=atlas instanceof SKERRY.TerrariumAtlas?3600:atlas.meta.max+680;
  world.camera=SKERRY.basis([x,y,z],[x+dx*1000,y-285,z+dz*1000]);
  stream.update(world.camera.eye,[dx*speed,0,dz*speed]);
  const [lon,lat]=atlas.coordinates(x,z);info.textContent=stream.error?String(stream.error):lat.toFixed(4)+'°, '+lon.toFixed(4)+'° · '+stream.nodes.size+' тайлов · '+(stream.bytesRead/1024).toFixed(0)+' КиБ прочитано'
 }
 await select(new Blob([Uint8Array.from(atob(sampleDEM),c=>c.charCodeAt(0))]));
 document.querySelector('input').onchange=e=>{const file=e.target.files[0];if(file)select(file).catch(err=>info.textContent=err.message)};
 document.querySelector('button').onclick=e=>{paused=!paused;e.target.textContent=paused?'Продолжить':'Пауза'};
 document.querySelector('#online').onclick=()=>select(new SKERRY.TerrariumAtlas(46.55,8.1)).catch(e=>info.textContent=e.message);
 world.systems.add(update);game.start();return {game,stream}
}
main().catch(e=>document.querySelector('output').textContent=e.message);
