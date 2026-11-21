// The reader receives project-relative paths and returns Uint8Array data.
async function loadScene(game,doc,read){
 if(doc?.format!=='skerry.scene/1'||!Array.isArray(doc.nodes)||typeof read!=='function')throw TypeError('Invalid SKERRY scene');
 const root=new GameNode(doc.name||'Scene'),nodes=new Map(),assets=new Map();
 function relative(base,uri){
  if(typeof uri!=='string'||/^[a-z][a-z0-9+.-]*:|^[\\/]|[\\?#\0]/i.test(uri))throw Error('Expected a relative asset path');
  const parts=base?base.split('/').slice(0,-1):[];
  for(const segment of uri.split('/')){
   if(!segment||segment==='.')continue;
   if(segment==='..'){if(!parts.length)throw Error('Path outside project');parts.pop()}else parts.push(segment)
  }
  if(!parts.length)throw Error('Empty asset path');return parts.join('/')
 }
 function transform(value,length,defaultValue){
  if(value===undefined)return defaultValue;
  if(!Array.isArray(value)||value.length!==length||!value.every(Number.isFinite))throw Error('Invalid node transform');
  return value.slice()
 }
 for(const entry of doc.nodes){
  if(typeof entry?.id!=='string'||!entry.id||nodes.has(entry.id))throw Error('Expected unique node ids');
  const node=new GameNode(entry.name||entry.id);
  node.position=transform(entry.position,3,node.position);node.scale=transform(entry.scale,3,node.scale);
  const q=transform(entry.rotation,4,node.rotation),length=Math.hypot(...q);if(length<1e-8)throw Error('Invalid rotation');
  node.rotation=q.map(v=>v/length);node.visible=entry.visible!==false;nodes.set(entry.id,node)
 }
 for(const entry of doc.nodes){
  const parent=entry.parent===undefined?root:nodes.get(entry.parent);
  if(!parent)throw Error('Missing parent');parent.attach(nodes.get(entry.id))
 }
 try{
  for(const entry of doc.nodes)if(entry.mesh!==undefined){
   const path=relative('',entry.mesh);
   if(!assets.has(path)){
    const bytes=await read(path);
    assets.set(path,await game.load(bytes,uri=>read(relative(path,uri))))
   }
   nodes.get(entry.id).parts=assets.get(path)
  }
  if(game.disposed)throw Error('Game disposed');
  game.world.root.attach(root);
 }catch(error){for(const p of assets.values())game.release(p);throw error}
 function dispose(){root.detach();for(const p of assets.values())game.release(p);assets.clear()}
 return {root,nodes,dispose}
}
