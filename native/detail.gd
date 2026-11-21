extends Node
# A low-resolution livery remains embedded in the GLB at all distances.
const PATH="res://number_4k.png"
var slots=[]
var status=0
func bind(root:Node):
 for m in root.find_children("*","MeshInstance3D",true,false):
  for i in m.mesh.get_surface_count():
   var material=m.get_active_material(i)
   if material is StandardMaterial3D and material.resource_name=="number":
    slots.append([m,i,material])
func update(distance:float):
 if slots.is_empty():return
 if status==0 and distance<12 and ResourceLoader.load_threaded_request(PATH)==OK:status=1
 if status==1 and ResourceLoader.load_threaded_get_status(PATH)==ResourceLoader.THREAD_LOAD_LOADED:
  var tex=ResourceLoader.load_threaded_get(PATH)
  status=0
  if distance<22:
   for slot in slots:
    var mat=slot[2].duplicate();mat.albedo_texture=tex;slot[0].set_surface_override_material(slot[1],mat)
   status=2
 elif status==2 and distance>22:
  for slot in slots:slot[0].set_surface_override_material(slot[1],null)
  status=0
