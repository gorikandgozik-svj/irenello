class Entities{
 constructor(){this.next=1;this.live=new Set();this.columns=new Map()}
 create(values={}){
  const id=this.next++;this.live.add(id);
  for(const [name,value] of Object.entries(values))this.set(id,name,value);
  return id
 }
 set(id,name,value){
  if(!this.live.has(id))throw Error('Unknown entity');
  if(!this.columns.has(name))this.columns.set(name,new Map());
  this.columns.get(name).set(id,value);return value
 }
 get(id,name){return this.columns.get(name)?.get(id)}
 remove(id,name){return this.columns.get(name)?.delete(id)||false}
 destroy(id){if(!this.live.delete(id))return false;for(const c of this.columns.values())c.delete(id);return true}
 *query(...names){
  const columns=names.map(n=>this.columns.get(n));if(columns.includes(undefined))return;
  let source=this.live;for(const c of columns)if(c.size<source.size)source=c;
  for(const id of source.keys())if(columns.every(c=>c.has(id)))yield [id,...columns.map(c=>c.get(id))]
 }
}
