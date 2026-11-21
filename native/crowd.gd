extends Node3D
# Distant lanes use analytic positions. Only nearby agents get avoidance and limb poses.
const COUNT=2400
var parts=[]
var offsets=PackedFloat32Array()
var near_count=0
var time=0.
var elapsed=0.
func _ready():
 offsets.resize(COUNT)
 for i in 5:
  var geom=BoxMesh.new()
  var mat=StandardMaterial3D.new()
  mat.albedo_color=[Color(.19,.36,.51),Color(.45,.28,.20),Color(.13,.16,.19),Color(.13,.16,.19),Color(.61,.32,.15)][i]
  geom.material=mat
  var mm=MultiMesh.new();mm.transform_format=MultiMesh.TRANSFORM_3D;mm.mesh=geom;mm.instance_count=COUNT
  var item=MultiMeshInstance3D.new();item.multimesh=mm;add_child(item);parts.append(mm)
func update(dt:float,eye:Vector3):
 time+=dt;elapsed+=dt
 if elapsed<.075:return
 var step=elapsed;elapsed=0.;near_count=0
 var counts=[0,0,0,0,0]
 for i in COUNT:
  var vehicle=i%4==0
  var lane=i%27-12
  var direction=1 if lane%2==0 else -1
  var speed=8.+(i%6) if vehicle else 1.1+.16*(i%4)
  var p=Vector3(lane*32+(1.9 if vehicle else 4.8)*direction,0.,fposmod(i*79.237+time*speed*direction,864.)-384.)
  var near=p.distance_squared_to(eye)<65.*65.
  if near:
   near_count+=1
   var dodge=clampf(1.-p.distance_to(eye)/5.,0.,1.)*1.2
   offsets[i]=move_toward(offsets[i],dodge,step*2.)
   p.x+=offsets[i]*direction
  if vehicle:
   emit(4,counts,p+Vector3.UP*.62,Vector3(1.7,1.24,3.8))
  else:
   emit(0,counts,p+Vector3.UP*(1.15 if near else .84),Vector3(.45,.68 if near else 1.68,.30))
   if near:
    emit(1,counts,p+Vector3.UP*1.61,Vector3(.26,.29,.25))
    for j in 2:
     var phase=sin(time*6.+i+j*PI)*.53
     emit(2+j,counts,p+Vector3((j-.5)*.22,.44,sin(phase)*.23),Vector3(.17,.82,.18),phase)
 for i in 5:parts[i].visible_instance_count=counts[i]
func emit(kind:int,counts:Array,p:Vector3,size:Vector3,angle=0.):
 parts[kind].set_instance_transform(counts[kind],Transform3D(Basis(Vector3.RIGHT,angle)*Basis.from_scale(size),p))
 counts[kind]+=1
