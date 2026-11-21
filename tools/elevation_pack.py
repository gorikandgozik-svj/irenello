"""Build a local, seekable terrain pyramid from an EPSG:4326 north-up ESRI grid
or the Matplotlib Jacksboro NPZ. All elevations are metres."""
from pathlib import Path
import argparse, json, struct, math
import numpy as np
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('source',type=Path)
parser.add_argument('output',type=Path)
args=parser.parse_args()
if args.source.suffix.lower()=='.npz':
    with np.load(args.source,allow_pickle=False) as d:
        heights=d['elevation']
        west,east=float(d['xmin']),float(d['xmax'])
        north,south=float(d['ymin']),float(d['ymax'])
else:
    values={}
    with args.source.open() as f:
        while True:
            pos=f.tell();row=f.readline().split()
            if len(row)!=2 or row[0].lower() not in ('ncols','nrows','xllcorner','yllcorner','xllcenter','yllcenter','cellsize','nodata_value'):
                f.seek(pos);break
            values[row[0].lower()]=float(row[1])
        heights=np.loadtxt(f)
    h,w=heights.shape
    if (h,w)!=(values['nrows'],values['ncols']):raise ValueError('Grid dimensions mismatch')
    if 'nodata_value' in values and np.any(heights==values['nodata_value']):raise ValueError('Fill or crop NODATA before tiling')
    step=values['cellsize']
    west=values.get('xllcenter',values.get('xllcorner',0)+step/2)
    south=values.get('yllcenter',values.get('yllcorner',0)+step/2)
    east=west+(w-1)*step;north=south+(h-1)*step
h,w=heights.shape
if not (-180<=west<east<=180 and -90<=south<north<=90 and np.isfinite(heights).all()):raise ValueError('Invalid geographic grid')
if heights.min()<-32768 or heights.max()>32767:raise ValueError('Elevation exceeds int16 range')
cells=32
levels=max(0,math.ceil(math.log2(max(w-1,h-1)/cells)))
header=dict(name=args.source.stem,bounds=[west,south,east,north],shape=[w,h],levels=levels,cells=cells,min=float(heights.min()),max=float(heights.max()))
meta=json.dumps(header,separators=(',',':')).encode()
with args.output.open('wb') as out:
    out.write(b'SKDEM01\0'+struct.pack('<I',len(meta))+meta)
    for level in range(levels+1):
        n=2**level
        for z in range(n):
            for x in range(n):
                xx=(x*cells+np.arange(cells+1))*(w-1)/(cells*n)
                yy=(z*cells+np.arange(cells+1))*(h-1)/(cells*n)
                ix=xx.astype(int);iy=yy.astype(int);fx=xx-ix;fy=(yy-iy)[:,None]
                ix1=np.minimum(ix+1,w-1);iy1=np.minimum(iy+1,h-1)
                tile=(heights[np.ix_(iy,ix)]*(1-fx)+heights[np.ix_(iy,ix1)]*fx)*(1-fy)+(heights[np.ix_(iy1,ix)]*(1-fx)+heights[np.ix_(iy1,ix1)]*fx)*fy
                out.write(np.rint(tile).astype('<i2').tobytes())
print(json.dumps(header))
