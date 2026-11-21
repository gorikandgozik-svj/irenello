extends RigidBody3D
# Local +Z is the nose. Contact forces are applied at each individual contact patch.
var wheel_nodes=[]
var steer=0.
var gas=0.
var brake_input=0.
var contacts=0
var compressions=[0.,0.,0.,0.]
var roll=0.
const PADS=[Vector3(-.95,.37,1.39),Vector3(.95,.37,1.39),Vector3(-.95,.37,-1.48),Vector3(.95,.37,-1.48)]
func _ready():
 mass=790;continuous_cd=true;center_of_mass_mode=RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
 center_of_mass=Vector3(0,.30,-.06);can_sleep=false
 var body=CollisionShape3D.new()
 var box=BoxShape3D.new()
 box.size=Vector3(1.45,.38,3.9);body.shape=box;body.position.y=.39;add_child(body)
 var model=load("res://SK-27.glb").instantiate()
 add_child(model)
 for n in ["FrontL","FrontR","RearL","RearR"]:wheel_nodes.append(model.find_child(n,true,false))
func tyre_curve(slip:float)->float:
 var x=9.3*slip
 return sin(1.52*atan(x-.52*(x-atan(x))))
func _integrate_forces(state:PhysicsDirectBodyState3D):
 var tr=state.transform
 var up=tr.basis.y.normalized()
 var yaw=steer*.47
 var space=state.get_space_state()
 contacts=0
 for i in 4:
  var local=PADS[i]+Vector3.UP*.17
  var origin=tr*local
  var query=PhysicsRayQueryParameters3D.create(origin,origin-up*.70,1,[get_rid()])
  var hit=space.intersect_ray(query)
  if hit.is_empty():
   compressions[i]=0.;continue
  var travel=origin.distance_to(hit.position)
  var compression=clampf(.57-travel,0.,.25)
  var r:Vector3=hit.position-tr.origin
  var v=state.linear_velocity+state.angular_velocity.cross(hit.position-tr*center_of_mass)
  var n:Vector3=hit.normal
  var load_n=clampf(47000.*compression-3700.*v.dot(n),0.,18000.)
  if load_n<=0.:continue
  contacts+=1;compressions[i]=compression
  var f=tr.basis.z.rotated(up,yaw if i<2 else 0.).slide(n).normalized()
  var side=n.cross(f).normalized()
  var longitudinal=v.dot(f)
  var slip=atan2(v.dot(side),maxf(1.4,absf(longitudinal)))
  var fy=-1.45*load_n*tyre_curve(slip)
  var drive=gas*minf(5900.,210000./maxf(5.,absf(longitudinal))) if i>=2 else 0.
  var fx=drive-brake_input*clampf(longitudinal*2400.,-6500.,6500.)-longitudinal*3.
  var combined=Vector2(fx,fy).limit_length(load_n*1.45)
  state.apply_force(n*load_n+f*combined.x+side*combined.y,r)
 var v=state.linear_velocity
 state.apply_central_force(-v*v.length()*.49-up*pow(v.dot(tr.basis.z),2.)*1.1)

func _process(dt:float):
 roll=fmod(roll+linear_velocity.dot(global_transform.basis.z)*dt/.36,TAU)
 for i in wheel_nodes.size():
  var wheel=wheel_nodes[i]
  if wheel==null:continue
  var pivot=PADS[i]-Vector3.UP*.01
  var rotation_basis=Basis(Vector3.UP,steer*.47 if i<2 else 0.)*Basis(Vector3.RIGHT,roll)
  wheel.transform=Transform3D(rotation_basis,pivot-rotation_basis*pivot+Vector3.UP*(compressions[i]-.04))
