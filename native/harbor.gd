extends Node3D
var sea=ShaderMaterial.new()
var buoy=RigidBody3D.new()
var t=0.
const ORIGIN=Vector2(508,-352)
var waves=preload("res://addons/skerry/wave_grid.gd").new(49,97,Vector2(200./48.,800./96.),8.)
var accumulated=0.
var ripple:ImageTexture
func upload_water():
 if DisplayServer.get_name()=="headless":return
 var image=Image.create_from_data(waves.cols,waves.rows,false,Image.FORMAT_RF,waves.elevation.to_byte_array())
 if ripple==null:
  ripple=ImageTexture.create_from_image(image)
  sea.set_shader_parameter("height_map",ripple)
 else:ripple.update(image)
func height(p:Vector3)->float:
 return waves.height_at(Vector2(p.x,p.z)-ORIGIN)-.35+.48*sin(p.x*.19+p.z*.10-1.45*t)+.18*sin(-p.x*.31+p.z*.21-1.91*t)
func _ready():
 var visual=MeshInstance3D.new()
 var mesh=PlaneMesh.new();mesh.size=Vector2(200,800);mesh.subdivide_width=100;mesh.subdivide_depth=300
 sea.shader=preload("res://water.gdshader");mesh.material=sea;visual.mesh=mesh
 visual.position=Vector3(608,-.35,48);add_child(visual)
 buoy.mass=100.;buoy.position=Vector3(526,.4,10);add_child(buoy)
 var shape=CollisionShape3D.new();var ball=SphereShape3D.new();ball.radius=.7;shape.shape=ball;buoy.add_child(shape)
 var shell=MeshInstance3D.new();var sphere=SphereMesh.new();sphere.radius=.7;sphere.height=1.4
 var mat=StandardMaterial3D.new();mat.albedo_color=Color(.95,.36,.07);sphere.material=mat;shell.mesh=sphere;buoy.add_child(shell)
func _physics_process(dt:float):
 accumulated+=dt
 if accumulated>=1./30.:
  var pos=Vector2(buoy.position.x,buoy.position.z)-ORIGIN
  waves.impulse(pos,clampf(-buoy.linear_velocity.y,-2.,2.)*accumulated*2.5,12.)
  waves.advance(accumulated);accumulated=0.;upload_water()
 t+=dt;sea.set_shader_parameter("t",t)
 var depth=clampf(height(buoy.position)-buoy.position.y+.7,0.,1.4)
 if depth>0.:
  buoy.apply_central_force(Vector3.UP*depth*2300.-buoy.linear_velocity*depth*480.)
