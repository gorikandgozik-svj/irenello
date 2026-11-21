from pathlib import Path
import json,base64
root=Path(__file__).resolve().parent
files=['clock','world','program','render','math','gltf','physics','batches','scenery','airframe','yard','track','pipeline','tiles','deferred','voxels','elevation','relief','sim','editor','audio','terrain','entities','actions','project','photo','sdk','app']
code='\n'.join((root/'src'/f'{n}.js').read_text() for n in files)
data='\n'.join('const '+name+'='+json.dumps(base64.b64encode((root/f).read_bytes()).decode())+';' for name,f in [('RIDGE','assets/Alpine-25.asc'),('PINE','assets/pine.png'),('DAWN','assets/dawn.jpg'),('CAR','assets/SK-27.glb'),('EARTH','assets/earth.jpg'),('INLET','legacy/Inlet.html')])
(root/'Skerry.html').write_text((root/'index.in').read_text().replace('/*DATA*/',data).replace('/*CODE*/',code))

(root/'SkerrySDK.js').write_text('(() => {\n'+ '\n'.join((root/'src'/f'{n}.js').read_text() for n in ['clock','program','math','gltf','physics','batches','pipeline','tiles','deferred','voxels','elevation','relief','terrain','entities','actions','project','photo','sdk'])+'\n})();\n')
