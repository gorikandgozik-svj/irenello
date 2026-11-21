// Each action sums its digital, signed axis, analog button and virtual inputs.
class Actions{
 constructor(bindings,{target=globalThis,getPads=()=>globalThis.navigator?.getGamepads?.()||[]}={}){
  this.bindings=bindings;this.getPads=getPads;this.target=target;this.keys=new Set();this.virtual=new Map();
  this.down=e=>this.keys.add(e.code);this.up=e=>this.keys.delete(e.code);
  this.clear=()=>{this.keys.clear();this.virtual.clear()};
  target.addEventListener('keydown',this.down);target.addEventListener('keyup',this.up);target.addEventListener('blur',this.clear)
 }
 set(name,value,source='touch'){
  if(!this.bindings[name])throw Error('Unknown action '+name);
  let map=this.virtual.get(name);if(!map)this.virtual.set(name,map=new Map());
  if(Number.isFinite(value)&&value!==0)map.set(source,Math.max(-1,Math.min(1,value)));else map.delete(source)
 }
 sample(){
  let pad;try{pad=Array.from(this.getPads()).find(p=>p&&p.connected!==false&&p.mapping==='standard')}catch{}
  const result={};
  for(const [name,b] of Object.entries(this.bindings)){
   let value=0;for(const v of this.virtual.get(name)?.values()||[])value+=v;
   for(const [key,scale] of Object.entries(b.keys||{}))if(this.keys.has(key))value+=scale;
   if(pad){
    for(const [id,scale] of Object.entries(b.buttons||{}))value+=(pad.buttons[id]?.value||0)*scale;
    for(const [id,scale] of Object.entries(b.axes||{})){
     const x=pad.axes[id]||0,d=Math.max(0,Math.min(.95,b.deadzone??.12));
     if(Math.abs(x)>d)value+=Math.sign(x)*(Math.abs(x)-d)/(1-d)*scale
    }
   }
   result[name]=Math.max(-1,Math.min(1,value))
  }
  return result
 }
 dispose(){this.target.removeEventListener('keydown',this.down);this.target.removeEventListener('keyup',this.up);this.target.removeEventListener('blur',this.clear);this.clear()}
}
