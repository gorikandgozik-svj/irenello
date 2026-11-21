"""Create the synthetic alpine test sector. Heights are in metres."""
import numpy as np
from scipy.ndimage import map_coordinates
from pathlib import Path
rng=np.random.default_rng(1977);n=257
y,x=np.mgrid[-1:1:complex(n),-1:1:complex(n)]
def noise(k):
 arr=rng.random((k+4,k+4));return map_coordinates(arr,[(y+1)*k/2+1,(x+1)*k/2+1],order=3,mode='nearest')-.5
a,b,c,d=[noise(k) for k in (4,9,24,61)]
valley=.09+.21*np.sin(y*3.3)+.055*np.sin(y*8.2)
dist=np.abs(x-valley);flank=1-np.exp(-np.maximum(dist-.025,0)*5.8)
side=np.sign(x-valley);branch=np.abs(np.sin(y*12.8+side*dist*10+a*2.1+.5*np.sin(x*10)))
rock=(1-np.abs(b)*1.2)*(.70+.3*(1-branch))
z=1450+150*y+flank*(1510+1150*rock+820*a+354*c+133*d)-460*branch*flank+50*b+25*c
z+=320*np.exp(-((x+.19)**2/.025+(y+.57)**2/.032))
out=Path(__file__).resolve().parents[1]/'assets'/'Alpine-25.asc'
with out.open('w') as f:
 f.write(f'ncols {n}\nnrows {n}\nxllcorner 7.055\nyllcorner 45.52\ncellsize 0.00285\nNODATA_value -9999\n')
 np.savetxt(f,z.round(),fmt='%d')
