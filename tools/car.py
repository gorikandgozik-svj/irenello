"""Generate the original SK-27 open-wheel demonstration asset."""
import math,struct,json,io
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from collections import defaultdict
root=Path(__file__).resolve().parents[1]
colors={'papaya':([.95,.19,.018],.52,.22),'carbon':([.018,.026,.036],.54,.30),'tyre':([.023,.025,.027],.04,.82),'rim':([.10,.115,.12],.92,.23),'silver':([.48,.53,.55],.94,.22),'stripe':([1,.50,.025],.25,.32),'visor':([.035,.15,.20],.89,.11),'white':([.9,.90,.85],.2,.23),'decal':([1,1,1],.35,.28)}
colors['number']=([1,1,1],.18,.29)
colors['papaya']=([.98,.135,.009],.26,.23)
colors['ivory']=([.92,.91,.78],.23,.28)
colors['sidewall']=([1,1,1],.08,.68)
group="Chassis"
parts=defaultdict(lambda:[[],[],[],[]])
def quad(mat,pts,ns=None,uv=None):
 p,n,t,ix=parts[(group,mat)];k=len(p);pts=np.array(pts)
 if ns is None:
  no=np.cross(pts[1]-pts[0],pts[2]-pts[0]);no=no/(np.linalg.norm(no)+1e-20);ns=[no]*4
 p.extend(pts);n.extend(ns);t.extend(uv or [(0,0)]*4);ix.extend([k,k+1,k+2,k,k+2,k+3])
def loft(mat,sections,N=96):
 # Three interpolated stations per segment keep a continuous silhouette up close.
 pts=np.asarray(sections);dense=[]
 for j in range(len(pts)-1):
  a,b,c,d=pts[max(0,j-1)],pts[j],pts[j+1],pts[min(len(pts)-1,j+2)]
  for t in np.arange(15)/15:
   q=.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
   dense.append(np.clip(q,np.minimum(b,c),np.maximum(b,c)))
 grid=[]
 for z,x,y,rx,ry in [*dense,pts[-1]]:
  grid.append([np.array([x+rx*math.cos(2*math.pi*i/N),y+ry*math.sin(2*math.pi*i/N),z]) for i in range(N)])
 for j in range(len(grid)-1):
  for i in range(N):
   ids=[(j,i),(j,(i+1)%N),(j+1,(i+1)%N),(j+1,i)];ns=[]
   for a,b in ids:
    d1=grid[a][(b+1)%N]-grid[a][(b-1)%N];d2=grid[min(len(grid)-1,a+1)][b]-grid[max(0,a-1)][b]
    n=np.cross(d1,d2);ns.append(n/(np.linalg.norm(n)+1e-20))
   paint=mat
   if mat=='papaya':
    yphase=math.sin(2*math.pi*(i+.5)/N);z=grid[j][i][2];x=grid[j][i][0]
    if yphase<-.24+.14*math.sin(z*2.5):paint='carbon'
    if -.24+.14*math.sin(z*2.5)<yphase<-.14+.14*math.sin(z*2.5):paint='ivory'
    if z>.52 and abs(x)<.066 and yphase>.5:paint='carbon'
   quad(paint,[grid[a][b] for a,b in ids],ns)
 # Seal both ends including the nose tip and inlet fairing.
 for index,sign in [(0,-1),(-1,1)]:
  ring=grid[index];center=np.mean(ring,axis=0)
  for i in range(N):quad(mat,[center,ring[i],ring[(i+1)%N],center],[[0,0,sign]]*4)
def box(mat,c,s):
 x,y,z=c;u,v,w=np.array(s)/2
 p=[(x+i*u,y+j*v,z+k*w) for i,j,k in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
 for ids in [(0,3,2,1),(4,5,6,7),(1,2,6,5),(0,4,7,3),(3,7,6,2),(0,1,5,4)]:quad(mat,[p[i] for i in ids])
def tube(mat,a,b,r,R=None,N=10):
 a,b=np.array(a),np.array(b);axis=b-a;axis=axis/np.linalg.norm(axis);v=np.cross(axis,[0,1,0] if abs(axis[1])<.9 else [1,0,0]);v/=np.linalg.norm(v);u=np.cross(axis,v);R=r if R is None else R
 for i in range(N):
  n,m=[v*math.cos(2*math.pi*j/N)+u*math.sin(2*math.pi*j/N) for j in (i,i+1)]
  quad(mat,[a+r*n,a+r*m,b+R*m,b+R*n],[n,m,m,n])
def wing(mat,x,y,z,width,chord,thick,tilt=0):
 for j in range(20):
  for i in range(16):
   a,b=np.pi*np.array([i,i+1])/8
   def point(t,u):
    sweep=(.28 if z>0 else .08)*abs(u)**1.5
    lift=(.14 if z>0 else .06)*u*u-(.028 if z>0 else .0)*math.exp(-u*u*14)
    return (x+u*width/2,y+lift+math.sin(t)*thick/2+math.cos(t)*tilt,z-sweep+math.cos(t)*chord/2*(1-.3*abs(u)))
   u,v=-1+j*.1,-.9+j*.1
   quad('ivory' if mat=='papaya' and .67<abs((u+v)/2)<.78 else mat,[point(a,u),point(a,v),point(b,v),point(b,u)])
loft('papaya',[(z,0,y,rx,ry) for z,y,rx,ry in [(-2.12,.34,.04,.05),(-1.65,.46,.22,.23),(-1.15,.53,.34,.36),(-.65,.58,.40,.40),(-.22,.46,.40,.23),(.25,.49,.38,.24),(.65,.52,.31,.17),(1.15,.48,.23,.13),(1.75,.32,.14,.10),(2.18,.27,.095,.07),(2.23,.26,.01,.02)]])
for sign in [-1,1]:
 loft('papaya',[(z,sign*x,y,rx,ry) for z,x,y,rx,ry in [(-1.72,.34,.25,.04,.05),(-1.34,.41,.29,.15,.14),(-.9,.47,.35,.22,.20),(-.45,.54,.37,.23,.23),(.02,.56,.39,.22,.23),(.27,.54,.44,.20,.17),(.35,.54,.47,.13,.10)]])
 box('carbon',(sign*.53,.15,-.57),(.55,.055,2.3))
 for z in [-1.48,1.39]:
  group=("Front" if z>0 else "Rear")+("R" if sign>0 else "L")
  x=sign*.95
  rings=[(-.19,.215),(-.19,.29),(-.175,.333),(-.153,.353),(-.11,.360),(.11,.360),(.153,.353),(.175,.333),(.19,.29),(.19,.215)]
  for (u,r),(v,R) in zip(rings,rings[1:]):
   for i in range(64):
    a,b=[j*math.pi/32 for j in (i,i+1)]
    def pt(d,rad,t):return (x+d,.36+rad*math.cos(t),z+rad*math.sin(t))
    def norm(t):
     n=np.array([r-R,(v-u)*math.cos(t),(v-u)*math.sin(t)]);return n/(np.linalg.norm(n)+1e-20)
    quad('tyre',[pt(u,r,a),pt(u,r,b),pt(v,R,b),pt(v,R,a)],[norm(a),norm(b),norm(b),norm(a)])
  # Inner wheel face, hub and brake disc are visible across the chassis.
  inner=x-sign*.187
  for i in range(64):
   a,b=[j*math.pi/32 for j in (i,i+1)]
   def hub(rad,t):return (inner,.36+rad*math.cos(t),z+rad*math.sin(t))
   for m,ri,ro in [('rim',0,.216),('carbon',.12,.18)]:quad(m,[hub(ri,a),hub(ro,a),hub(ro,b),hub(ri,b)],[[-sign,0,0]]*4)
  side=x+sign*.191
  for i in range(64):
   a,b=[j*math.pi/32 for j in (i,i+1)]
   def face(rad,t):return (side,.36+rad*math.cos(t),z+rad*math.sin(t))
   for m,ri,ro in [('stripe',.304,.310),('silver',.209,.218),('rim',.015,.209)]:quad(m,[face(ri,a),face(ro,a),face(ro,b),face(ri,b)],[[sign,0,0]]*4)
  for j in range(12):
   ang=j*math.pi/6;tube('silver',(side+sign*.003,.36+.055*math.cos(ang),z+.055*math.sin(ang)),(side+sign*.003,.36+.192*math.cos(ang+.16),z+.192*math.sin(ang+.16)),.011,N=5)
  # Sidewall printing uses an alpha-masked circular atlas.
  qu=[(side+sign*.002,.36+h*.362,z+u*.362) for u,h in [(-1,-1),(1,-1),(1,1),(-1,1)]]
  quad('sidewall',qu,[[sign,0,0]]*4,[(0,1),(1,1),(1,0),(0,0)] if sign<0 else [(1,1),(0,1),(0,0),(1,0)])
  tube('silver',(side,.36,z),(side+sign*.03,.36,z),.049,N=6)
  for j in range(40):
   a=j*math.pi/20;ang=a+.055
   def slit(rad,b):return (side+sign*.001,.36+rad*math.cos(b),z+rad*math.sin(b))
   quad('carbon',[slit(.13,a),slit(.177,a+.03),slit(.177,ang+.03),slit(.13,ang)],[[sign,0,0]]*4)
  group="Chassis"
  for y in [.22,.43]:
   for offset in [-.40,.37]:tube('carbon',(sign*.26,y,z+offset),(sign*.81,.35+(y-.3)*.4,z),.020)
 for Z in [-2.0,1.97]:
  box('carbon',(sign*(.8 if Z<0 else 1.04),.65 if Z<0 else .285,Z-.16),(.025,.37 if Z<0 else .29,.54))
 tube('carbon',(sign*.26,.7,-.34),(sign*.285,.87,.045),.026)
 tube('carbon',(sign*.285,.87,.045),(0,.865,.45),.028)
 tube('carbon',(sign*.31,.61,.24),(sign*.54,.68,.34),.018)
 box('papaya',(sign*.55,.69,.34),(.145,.074,.09))
# Air intake behind the driver, dark opening and longitudinal engine-cover spine.
loft('papaya',[(-1.49,0,.56,.035,.04),(-1.1,0,.75,.11,.13),(-.65,0,.91,.17,.18),(-.49,0,.99,.156,.162),(-.43,0,1.01,.132,.125)])
for j in range(36):
 a,b=2*np.pi*np.array([j,j+1])/36
 def intake(t,r):return (math.cos(t)*.128*r,1.01+math.sin(t)*.119*r,-.426)
 quad('carbon',[intake(a,0),intake(a,1),intake(b,1),intake(b,0)],[[0,0,1]]*4)
for sign in [-1,1]:
 for j in range(9):
  z=-.88+j*.072;box('carbon',(sign*(.51+(z+.88)*.14),.56+(z+.88)*.14,z),(.14,.014,.024))
 for j in range(4):
  tube('carbon',(sign*(.4+.08*j),.14,1.96),(sign*(.44+.08*j),.26,1.72),.011,N=6)
 for j in range(5):
  box('carbon',(sign*(.27+.086*j),.16,-1.89),(.014,.22,.42))
 # The frontal opening of each sidepod appears inside the orange lip.
 for j in range(32):
  a,b=np.array([j,j+1])*math.pi/16
  def opening(t,r):return (sign*.54+math.cos(t)*.129*r,.47+math.sin(t)*.09*r,.351)
  quad('carbon',[opening(a,0),opening(a,1),opening(b,1),opening(b,0)],[[0,0,1]]*4)
for i in range(3):wing('carbon' if i!=1 else 'papaya',0,.14+i*.060,2.05-i*.11,2.08,.22,.048,.022)
for i in range(2):wing('papaya' if i else 'carbon',0,.78+i*.10,-2.0-i*.12,1.60,.32,.06,-.06)
tube('carbon',(0,.35,-1.7),(0,.78,-2.0),.045)
tube('carbon',(0,.64,.46),(0,.86,.45),.028)
loft('carbon',[(z,0,y,rx,ry) for z,y,rx,ry in [(-.56,.70,.20,.06),(-.44,.68,.28,.09),(-.01,.68,.24,.08),(.28,.68,.13,.025)]])
loft('white',[(z,0,.765,rx,ry) for z,rx,ry in [(-.35,.03,.045),(-.30,.13,.13),(-.20,.16,.16),(-.095,.14,.13),(-.05,.07,.075)]])
loft('visor',[(-.19,0,.78,.157,.07),(-.095,0,.78,.15,.07),(-.04,0,.78,.064,.035)])
for sign in [-1,1]:
 p=[(sign*.783,.335,-.64),(sign*.795,.335,-.055),(sign*.795,.465,-.055),(sign*.783,.465,-.64)]
 quad('decal',p,[[sign,0,0]]*4,[(1,1),(0,1),(0,0),(1,0)] if sign==1 else [(0,1),(1,1),(1,0),(0,0)])
# Number panel follows the upper taper of the nose.
quad('number',[(-.118,.64,1.12),(.118,.64,1.12),(.098,.534,1.53),(-.098,.534,1.53)],[[0,1,.25]]*4,[(0,0),(1,0),(1,1),(0,1)])
# Embedded livery texture is decoded by the runtime GLB importer.
img=Image.new('RGBA',(512,112),(255,255,255,0));d=ImageDraw.Draw(img);font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',84);d.text((12,-1),'SK / 27',font=font,fill=(22,29,31,255));stream=io.BytesIO();img.save(stream,'PNG');
data=bytearray();views=[];access=[]
def block(raw):
 while len(data)%4:data.append(0)
 idx=len(views);views.append(dict(buffer=0,byteOffset=len(data),byteLength=len(raw)));data.extend(raw);return idx
def acc(a,typ,component):
 a=np.array(a,dtype='<f4' if component==5126 else '<u2');v=block(a.tobytes());o=dict(bufferView=v,componentType=component,count=len(a),type=typ)
 if typ=='VEC3':o.update(min=a.min(0).tolist(),max=a.max(0).tolist())
 i=len(access);access.append(o);return i
mats=[];meshes=defaultdict(list)
for (group,name),(p,n,uv,ix) in parts.items():
 color,metal,rough=colors[name];pbr=dict(baseColorFactor=color+[1],metallicFactor=metal,roughnessFactor=rough)
 if name in ('decal','sidewall','number'):pbr['baseColorTexture']={'index':{'decal':0,'sidewall':1,'number':2}[name]}
 if max(ix)>65535:
  # Wide index accessor for the native asset. The WebGL importer splits draw batches.
  indices_view=block(np.asarray(ix,dtype='<u4').tobytes());index_id=len(access)
  access.append(dict(bufferView=indices_view,componentType=5125,count=len(ix),type='SCALAR'))
 else:index_id=acc(ix,'SCALAR',5123)
 meshes[group].append(dict(attributes=dict(POSITION=acc(p,'VEC3',5126),NORMAL=acc(n,'VEC3',5126),TEXCOORD_0=acc(uv,'VEC2',5126)),indices=index_id,material=len(mats)))
 mats.append(dict(**({'extensions':{'KHR_materials_clearcoat':{'clearcoatFactor':.88,'clearcoatRoughnessFactor':.13}}} if name=='papaya' else {}),name=name,pbrMetallicRoughness=pbr,**({'alphaMode':'MASK','alphaCutoff':.45} if name in ('decal','sidewall','number') else {})))
wheel=Image.new('RGBA',(512,512),(255,255,255,0))
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',28)
for label,start in [('SKERRY',-127),('S / 27',46)]:
 for j,ch in enumerate(label):
  deg=start+j*11;letter=Image.new('RGBA',(50,50));ImageDraw.Draw(letter).text((25,25),ch,font=font,fill=(230,221,178,255),anchor='mm')
  letter=letter.rotate(-deg-90,resample=Image.Resampling.BICUBIC);a=math.radians(deg)
  wheel.alpha_composite(letter,(round(231+194*math.cos(a)),round(231+194*math.sin(a))))
data2=io.BytesIO();wheel.save(data2,'PNG')
v=block(stream.getvalue());v2=block(data2.getvalue());number=Image.new('RGBA',(256,256));nd=ImageDraw.Draw(number);nf=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',162);nd.text((128,126),'27',font=nf,anchor='mm',fill=(244,241,222,255),stroke_width=4,stroke_fill=(21,25,26,255));nb=io.BytesIO();number.save(nb,'PNG');v3=block(nb.getvalue());doc=dict(extensionsUsed=['KHR_materials_clearcoat'],asset=dict(version='2.0',generator='SKERRY'),scene=0,scenes=[dict(nodes=[0])],nodes=[dict(name='SK-27',children=list(range(1,len(meshes)+1)))]+[dict(name=g,mesh=i) for i,g in enumerate(meshes)],meshes=[dict(primitives=ps) for ps in meshes.values()],materials=mats,textures=[dict(source=i) for i in range(3)],images=[dict(bufferView=k,mimeType='image/png') for k in (v,v2,v3)],buffers=[dict(byteLength=len(data))],bufferViews=views,accessors=access)
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*(-len(j)%4);data+=bytes(-len(data)%4);raw=struct.pack('<4sII',b'glTF',2,28+len(j)+len(data))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(data),b'BIN\0')+data
(root/'assets/SK-27.glb').write_bytes(raw)
