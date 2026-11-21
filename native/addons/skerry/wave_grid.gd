extends RefCounted
## Damped shallow-water height perturbations on a rectangular grid, in metres.
var cols:int
var rows:int
var spacing:Vector2
var speed:float
var elevation=PackedFloat32Array()
var velocity=PackedFloat32Array()
var next_velocity=PackedFloat32Array()

func _init(nx:int=48,nz:int=96,step:Vector2=Vector2(3.,4.),wave_speed:float=6.):
 assert(nx>=3 and nz>=3 and step.x>0 and step.y>0 and wave_speed>0)
 cols=nx;rows=nz;spacing=step;speed=wave_speed
 elevation.resize(cols*rows);velocity.resize(cols*rows);next_velocity.resize(cols*rows)

func impulse(point:Vector2,strength:float,radius:float):
 if radius<=0:return
 var grid=point/spacing
 for z in range(maxi(1,floori(grid.y-radius/spacing.y)),mini(rows-1,ceili(grid.y+radius/spacing.y)+1)):
  for x in range(maxi(1,floori(grid.x-radius/spacing.x)),mini(cols-1,ceili(grid.x+radius/spacing.x)+1)):
   var r=(Vector2(x,z)*spacing-point).length()/radius
   if r<1:velocity[z*cols+x]+=strength*pow(1.-r*r,2.)

func advance(dt:float):
 if dt<=0:return
 var stable=.82/(speed*sqrt(1./spacing.x**2+1./spacing.y**2))
 var steps=maxi(1,ceili(dt/stable))
 var h=dt/steps
 for substep in steps:
  for z in range(1,rows-1):
   for x in range(1,cols-1):
    var k=z*cols+x
    var lap=(elevation[k-1]+elevation[k+1]-2.*elevation[k])/spacing.x**2+(elevation[k-cols]+elevation[k+cols]-2.*elevation[k])/spacing.y**2
    next_velocity[k]=(velocity[k]+h*speed**2*lap)/(1.+h*.18)
  var tmp=velocity;velocity=next_velocity;next_velocity=tmp
  for k in elevation.size():elevation[k]+=h*velocity[k]

func height_at(point:Vector2)->float:
 var p=point/spacing
 if p.x<0 or p.y<0 or p.x>=cols-1 or p.y>=rows-1:return 0.
 var x=floori(p.x);var z=floori(p.y);var k=z*cols+x
 return lerpf(lerpf(elevation[k],elevation[k+1],p.x-x),lerpf(elevation[k+cols],elevation[k+cols+1],p.x-x),p.y-z)
