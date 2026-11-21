"""Deterministic cutout for far and near crossed foliage planes, no runtime generation."""
from PIL import Image,ImageDraw
import random,math
from pathlib import Path
rng=random.Random(661);im=Image.new('RGBA',(384,640));d=ImageDraw.Draw(im)
d.polygon([(186,625),(197,625),(191,25)],fill=(77,62,45,255))
branches=[]
for j in range(59):
 h=j/59; y=585-550*h;r=(1-h)**.82*166+4
 for s in [-1,1]:
  for l in range(2):
   length=r*rng.uniform(.48,1.02);bend=rng.uniform(-5,15);start=y-rng.uniform(0,9);shade=rng.uniform(.70,1.14)*(1.06 if s<0 else .92)
   pts=[(191+s*length*k/8,start+(k/8)**1.4*(length*.28+bend)-math.sin(k/8*math.pi)*length*.10) for k in range(9)]
   branches.append((shade,pts,s,length))
for shade,pts,s,L in branches:
 d.line(pts,fill=(59,63,46,255),width=2)
 for k,(x,y) in enumerate(pts):
  t=k/8;size=(1-.65*t)*(.18*L+3)
  for _ in range(22):
   dx=rng.gauss(0,size*.43);dy=rng.gauss(0,size*.23);n=rng.uniform(.7,1.32)*shade
   color=tuple(min(255,int(v*n)) for v in (67,96,65))+(255,)
   ex=x+dx+s*rng.uniform(1,6);ey=y+dy+rng.uniform(3,10)
   d.line([(x+dx,y+dy),(ex,ey)],fill=color,width=rng.choice([1,2,3]))
im.save(Path(__file__).resolve().parents[1]/'assets'/'pine.png',optimize=True)
