extends Node3D
## Generic disk-backed sector loader. Register PackedScene paths and optional HLOD proxies.
signal sector_loaded(cell:Vector2i, node:Node3D)
signal sector_failed(path:String)
@export_range(1,8192,1) var cell_size:float=96
@export_range(0,8,1) var radius:int=1
@export_range(0,5,.05) var lookahead_seconds:float=.6
@export_range(1,16,1) var concurrent_reads:int=4
var live:Dictionary={}
var catalog:Dictionary={}
var proxies:Dictionary={}
var pending:Dictionary={}
var ready_packs:Dictionary={}
var desired:Dictionary={}
var failed:Dictionary={}

func register_sector(cell:Vector2i,path:String,proxy:Node3D=null):
 catalog[cell]=path
 proxies[cell]=proxy

func retry_failed():
 failed.clear()

func grid(point:Vector3)->Vector2i:
 return Vector2i(floori(point.x/cell_size),floori(point.z/cell_size))

func update(eye:Vector3,velocity:Vector3):
 desired.clear()
 var paths={}
 for origin in [grid(eye),grid(eye+velocity*lookahead_seconds)]:
  for x in range(-radius,radius+1):
   for z in range(-radius,radius+1):
    var cell=origin+Vector2i(x,z)
    if catalog.has(cell):
     desired[cell]=true
     paths[catalog[cell]]=true
 for cell in live.keys():
  if not desired.has(cell):
   live[cell].queue_free()
   live.erase(cell)
   if is_instance_valid(proxies[cell]):proxies[cell].show()
 for path in ready_packs.keys():
  if not paths.has(path):ready_packs.erase(path)
 for path in pending.keys():
  var state=ResourceLoader.load_threaded_get_status(path)
  if state==ResourceLoader.THREAD_LOAD_IN_PROGRESS:continue
  pending.erase(path)
  if state==ResourceLoader.THREAD_LOAD_LOADED:
   var pack=ResourceLoader.load_threaded_get(path)
   if paths.has(path):ready_packs[path]=pack
  else:
   failed[path]=true
   sector_failed.emit(path)
 for path in paths:
  if pending.size()>=concurrent_reads:break
  if pending.has(path) or ready_packs.has(path) or failed.has(path):continue
  if ResourceLoader.load_threaded_request(path,"PackedScene")==OK:pending[path]=true
  else:
   failed[path]=true
   sector_failed.emit(path)
 for cell in desired:
  var path=catalog[cell]
  if live.has(cell) or not ready_packs.has(path):continue
  var sector=ready_packs[path].instantiate()
  if not sector is Node3D:
   sector.free();failed[path]=true;ready_packs.erase(path);sector_failed.emit(path);continue
  sector.position=Vector3(cell.x*cell_size,0,cell.y*cell_size)
  add_child(sector);live[cell]=sector
  if is_instance_valid(proxies[cell]):proxies[cell].hide()
  sector_loaded.emit(cell,sector)
  break
