extends Node3D
var sectors=preload("res://sectors.gd").new()
var crowd=preload("res://crowd.gd").new()
var car=preload("res://chassis.gd").new()
var detail=preload("res://detail.gd").new()
var camera=Camera3D.new()
var label=Label.new()
var barrier:StaticBody3D
var fracture=false
var survey=false
var ticks=0
var qa=OS.get_cmdline_user_args().has("--verify")
var top_speed=0.
var max_contacts=0
func add_box(parent:Node3D,size:Vector3,center:Vector3,color:Color):
 var shape=BoxShape3D.new();shape.size=size
 var collider=CollisionShape3D.new();collider.shape=shape;collider.position=center;parent.add_child(collider)
 var mesh=BoxMesh.new();mesh.size=size
 var mat=StandardMaterial3D.new();mat.albedo_color=color;mesh.material=mat
 var visual=MeshInstance3D.new();visual.mesh=mesh;visual.position=center;parent.add_child(visual)
func _ready():
 add_child(preload("res://harbor.gd").new());add_child(sectors);add_child(crowd)
 var floor_body=StaticBody3D.new();add_child(floor_body)
 add_box(floor_body,Vector3(920,.4,920),Vector3(48,-.2,48),Color(.19,.20,.21))
 barrier=StaticBody3D.new();barrier.position=Vector3(0,0,28);add_child(barrier)
 add_box(barrier,Vector3(4.8,1.2,.65),Vector3.UP*.6,Color(.76,.35,.12))
 car.position=Vector3(0,.3,0);add_child(car)
 add_child(detail);detail.bind(car)
 car.contact_monitor=true;car.max_contacts_reported=8;car.body_entered.connect(on_impact)
 var env=Environment.new();env.background_mode=Environment.BG_SKY
 var sky=Sky.new();sky.sky_material=ProceduralSkyMaterial.new();env.sky=sky
 env.ambient_light_source=Environment.AMBIENT_SOURCE_SKY;env.fog_enabled=true;env.fog_density=.0018
 env.sdfgi_enabled=RenderingServer.get_current_rendering_method()=="forward_plus"
 var world=WorldEnvironment.new();world.environment=env;add_child(world)
 var light=DirectionalLight3D.new();light.rotation_degrees=Vector3(-38,-43,0);light.shadow_enabled=true;add_child(light)
 add_child(camera);camera.position=Vector3(3,2.2,-6);camera.current=true
 var ui=CanvasLayer.new();add_child(ui);ui.add_child(label);label.position=Vector2(18,14)
func on_impact(other:Node):
 if other==barrier and top_speed>3. and not fracture:
  fracture=true;call_deferred("break_barrier",car.linear_velocity)
func break_barrier(v:Vector3):
 barrier.queue_free()
 for j in 3:
  for i in 8:
   var chunk=RigidBody3D.new();chunk.mass=32
   chunk.position=Vector3((i-3.5)*.60,(j+.5)*.4,28)
   add_child(chunk)
   add_box(chunk,Vector3(.59,.39,.64),Vector3.ZERO,Color(.76,.35,.12))
   chunk.linear_velocity=v*.4+Vector3((i-3.5)*.35,j*.7,0.)
func _unhandled_key_input(e:InputEvent):
 if e is InputEventKey and e.pressed and not e.echo:
  if e.keycode==KEY_TAB:survey=not survey
  if e.keycode==KEY_F and RenderingServer.get_current_rendering_method()=="forward_plus":
   var vp=get_viewport()
   if vp.scaling_3d_scale>.9:
    vp.scaling_3d_mode=Viewport.SCALING_3D_MODE_FSR2;vp.scaling_3d_scale=.67
   else:vp.scaling_3d_scale=1.;vp.scaling_3d_mode=Viewport.SCALING_3D_MODE_BILINEAR
  if e.keycode==KEY_R:get_tree().reload_current_scene()
func _physics_process(dt:float):
 ticks+=1
 car.gas=1. if qa or Input.is_physical_key_pressed(KEY_W) else 0.
 car.brake_input=1. if Input.is_physical_key_pressed(KEY_S) else 0.
 car.steer=move_toward(car.steer,float(Input.is_physical_key_pressed(KEY_D))-float(Input.is_physical_key_pressed(KEY_A)),dt*3.)
 top_speed=maxf(top_speed,car.linear_velocity.length());max_contacts=maxi(max_contacts,car.contacts)
 if survey:
  camera.position+=Vector3(car.steer,0,car.gas-car.brake_input)*dt*250.
  camera.position.y=85;camera.look_at(camera.position+Vector3(0,-1,1),Vector3.UP)
 else:
  var target=car.global_transform*Vector3(1.1,2.1,-6.)
  camera.position=camera.position.lerp(target,1.-exp(-7.*dt));camera.look_at(car.global_transform*Vector3(0,.60,2.),Vector3.UP)
 detail.update(camera.position.distance_to(car.position))
 sectors.update(camera.position,car.linear_velocity if not survey else Vector3(0,0,250))
 crowd.update(dt,camera.position)
 label.text="SKERRY   /   CITY DYNAMICS\n%d км/ч   ·   %d колёс в контакте   ·   %d секторов\nW газ   S тормоз   A/D руль   Tab обзор   R рестарт"%[car.linear_velocity.length()*3.6,car.contacts,sectors.live.size()]
 if qa and ticks==1500:
  print("CITY QA ticks=",ticks," contacts=",max_contacts," top_speed_m_s=",top_speed," streamed=",sectors.live.size()," fracture=",fracture," agents=",crowd.COUNT," nearby=",crowd.near_count," detail_slots=",detail.slots.size()," detail_status=",detail.status)
  get_tree().quit(0 if max_contacts==4 and top_speed>5. and fracture and sectors.live.size()>0 else 2)
