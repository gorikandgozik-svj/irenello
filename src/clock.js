class Clock{
 constructor(hz=60){
  if(!Number.isInteger(hz)||hz<1||hz>1000)throw RangeError('Fixed tick frequency must be between 1 and 1000 Hz');
  this.acc=0;this.step=1/hz
 }
 tick(delta,update){
  this.acc+=Math.min(.1,Math.max(0,delta));
  while(this.acc+1e-10>=this.step){update(this.step);this.acc-=this.step}
 }
}
