extends "res://addons/skerry/world_stream.gd"
const BUILDING=preload("res://block.tres")
var building_occluder:BoxOccluder3D
func _ready():
 sector_loaded.connect(on_sector_loaded)
 if DisplayServer.get_name()!="headless":
  building_occluder=BoxOccluder3D.new();building_occluder.size=Vector3.ONE
 var file=FileAccess.open("res://city/skyline.txt",FileAccess.READ)
 var blocks={}
 while file.get_position()<file.get_length():
  var row=file.get_csv_line()
  if row.size()!=7: continue
  var k=Vector2i(int(row[0]),int(row[1]))
  if not blocks.has(k):blocks[k]=[]
  var size=Vector3(float(row[4]),float(row[5]),float(row[6]))
  blocks[k].append(Transform3D(Basis.from_scale(size),Vector3(k.x*cell_size+float(row[2]),size.y/2,k.y*cell_size+float(row[3]))))
 var mesh=BoxMesh.new()
 var mat=StandardMaterial3D.new()
 mat.albedo_color=Color(.30,.35,.38);mesh.material=mat
 for k in blocks:
  var mm=MultiMesh.new()
  mm.transform_format=MultiMesh.TRANSFORM_3D;mm.mesh=mesh;mm.instance_count=blocks[k].size()
  for i in mm.instance_count:mm.set_instance_transform(i,blocks[k][i])
  var node=MultiMeshInstance3D.new()
  node.multimesh=mm;add_child(node);register_sector(k,"res://city/%d_%d.tscn"%[k.x,k.y],node)
func on_sector_loaded(_cell:Vector2i,sector:Node3D):
 if not building_occluder:return
 for building in sector.get_children():
  var occluder=OccluderInstance3D.new()
  occluder.occluder=building_occluder;occluder.scale=Vector3.ONE*.98
  building.add_child(occluder)
