function base64bytes(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
function glb(bytes){
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length<20||v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==bytes.length)throw Error('Некорректный GLB 2.0');
 let doc,bin;for(let i=12;i<bytes.length;){const len=v.getUint32(i,true),type=v.getUint32(i+4,true);if(i+8+len>bytes.length)throw Error('Повреждённый блок GLB');const section=bytes.subarray(i+8,i+8+len);
 if(type===0x4e4f534a)doc=JSON.parse(new TextDecoder().decode(section));else if(type===0x004e4942)bin=section;i+=8+len}return {doc,bin}
}
async function importModel(bytes,resolve=async()=>{throw Error('Требуется файл ресурса')}){
 const byteBudget=128*1024*1024;
 if(!Number.isSafeInteger(bytes?.byteLength)||bytes.byteLength>byteBudget)throw RangeError('Слишком большой файл модели');
 let remainingScalars=16*1024*1024;
 const {doc,bin}=bytes[0]===0x67?glb(bytes):{doc:JSON.parse(new TextDecoder().decode(bytes))};
 if(doc.asset?.version!=='2.0'||doc.extensionsRequired?.length)throw Error('Нужен glTF 2.0 без обязательных расширений');
 const resource=async uri=>uri.startsWith('data:')?base64bytes(uri.slice(uri.indexOf(',')+1)):resolve(decodeURIComponent(uri));
 const buffers=await Promise.all((doc.buffers||[]).map(b=>b.uri?resource(b.uri):bin));
 function view(i){const v=doc.bufferViews[i],buf=buffers[v.buffer],start=v.byteOffset||0;if(!buf||!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(v.byteLength)||v.byteLength<0||start+v.byteLength>buf.length)throw Error('Повреждённый bufferView');return buf.subarray(start,start+v.byteLength)}
 const images=await Promise.all((doc.images||[]).map(async im=>im.uri?resource(im.uri):view(im.bufferView)));
 const types={5120:['getInt8',1,127],5121:['getUint8',1,255],5122:['getInt16',2,32767],5123:['getUint16',2,65535],5125:['getUint32',4,4294967295],5126:['getFloat32',4,1]};
 function attribute(i,type){const a=doc.accessors[i],b=doc.bufferViews[a.bufferView];if(a.type!==type||a.sparse||!b)throw Error('Sparse accessor пока не поддерживается');const arr=view(a.bufferView),v=new DataView(arr.buffer,arr.byteOffset,arr.byteLength);
 if(!Object.hasOwn(types,a.componentType))throw Error('Некорректный тип компонента');
 const [method,size,max]=types[a.componentType],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],stride=b.byteStride||n*size;
 const start=a.byteOffset??0,packed=n*size;
 if(!n||!Number.isSafeInteger(a.count)||a.count<1||!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(stride)||stride<packed||start+(a.count-1)*stride+packed>arr.byteLength)throw Error('Атрибут выходит за границы буфера');
 remainingScalars-=a.count*n;if(remainingScalars<0)throw RangeError('Превышен бюджет декодирования модели');
 return Array.from({length:a.count},(_,j)=>Array.from({length:n},(_,k)=>{let value=v[method]((a.byteOffset||0)+j*stride+k*size,true);if(!Number.isFinite(value))throw Error('Нечисловой компонент модели');return a.normalized?Math.max(-1,value/max):value}))}
 const parts=[],bounds=[[Infinity,Infinity,Infinity],[-Infinity,-Infinity,-Infinity]],path=new Set(),visited=new Set();
 function visit(id,parent){
 if(path.has(id)||visited.has(id)||path.size>128)throw Error('Некорректная иерархия');path.add(id);visited.add(id);
 const node=doc.nodes[id],m=M.mul(parent,node.matrix||M.trs(node.translation,node.rotation,node.scale));
 if(node.skin!==undefined)throw Error('Скиннинг пока не поддерживается');
 for(const p of doc.meshes?.[node.mesh]?.primitives||[]){
  if((p.mode??4)!==4)throw Error('Поддерживаются треугольные сетки');
  const material=doc.materials?.[p.material]||{},mr=material.pbrMetallicRoughness||{};
  const pos=attribute(p.attributes.POSITION,'VEC3').map(v=>M.point(m,v)),norm=p.attributes.NORMAL===undefined?null:attribute(p.attributes.NORMAL,'VEC3').map(n=>M.normal(m,n));
  const uv=p.attributes.TEXCOORD_0===undefined?null:attribute(p.attributes.TEXCOORD_0,'VEC2'),idx=p.indices===undefined?pos.map((_,i)=>i):attribute(p.indices,'SCALAR').flat();
  if(norm&&norm.length!==pos.length||uv&&uv.length!==pos.length||pos.some(v=>v.length!==3||!v.every(Number.isFinite)))throw Error('Некорректные атрибуты модели');
  if(idx.length%3)throw Error('Неполный треугольник');
  for(const point of pos)for(let j=0;j<3;j++){bounds[0][j]=Math.min(bounds[0][j],point[j]);bounds[1][j]=Math.max(bounds[1][j],point[j])}
  const tex=doc.textures?.[mr.baseColorTexture?.index],mat={coat:material.extensions?.KHR_materials_clearcoat?.clearcoatFactor??0,coatRough:material.extensions?.KHR_materials_clearcoat?.clearcoatRoughnessFactor??.1,blend:material.alphaMode==='BLEND',color:mr.baseColorFactor||[1,1,1,1],metal:mr.metallicFactor??1,rough:mr.roughnessFactor??1,image:tex?images[tex.source]:null,mrImage:images[doc.textures?.[mr.metallicRoughnessTexture?.index]?.source],normalImage:images[doc.textures?.[material.normalTexture?.index]?.source],normalScale:material.normalTexture?.scale??1,emissive:material.emissiveFactor||[0,0,0],cut:material.alphaMode==='MASK'?(material.alphaCutoff??.5):0};
  let vertices=[],indices=[],map=new Map();function push(){if(indices.length)parts.push({vertices,indices,mat,nodeName:node.name||''});vertices=[];indices=[];map=new Map()}
  for(let j=0;j<idx.length;j+=3){if(vertices.length/8>65530)push();
   const tri=idx.slice(j,j+3);if(tri.some(k=>!Number.isInteger(k)||k<0||k>=pos.length))throw Error('Индекс за границами сетки');
   const face=norm?null:unit(cross(sub(pos[tri[1]],pos[tri[0]]),sub(pos[tri[2]],pos[tri[0]])));
   for(const k of tri){let index=norm?map.get(k):undefined;if(index===undefined){index=vertices.length/8;vertices.push(...pos[k],...(norm?norm[k]:face),...(uv?.[k]||[0,0]));map.set(k,index)}indices.push(index)}
  }push()
 }
 for(const child of node.children||[])visit(child,m);path.delete(id)
 }
 for(const root of doc.scenes?.[doc.scene??0]?.nodes||[])visit(root,M.id());if(!parts.length)throw Error('В сцене нет сеток');return {parts,bounds}
}
