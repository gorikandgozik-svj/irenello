// ESRI ASCII Grid, coordinates in geographic degrees, height in metres.
function readDEM(text){
 const rows=text.trim().split(/\r?\n/),meta={};let row=0;
 for(;row<rows.length;row++){const m=rows[row].trim().match(/^(ncols|nrows|xllcorner|yllcorner|xllcenter|yllcenter|cellsize|nodata_value)\s+([^\s]+)$/i);if(!m)break;meta[m[1].toLowerCase()]=Number(m[2])}
 const {ncols:w,nrows:h,cellsize:step}=meta,west=meta.xllcenter??(meta.xllcorner+step/2),south=meta.yllcenter??(meta.yllcorner+step/2);
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<2||h<2||w*h>4000000||!Number.isFinite(west+south+step)||step<=0||Math.abs(south)>90||Math.abs(west)>180||south+(h-1)*step>90||step*Math.max(w,h)>12)throw Error('Нужна локальная сетка в градусах, до 12° и 4 млн ячеек');
 const z=Float32Array.from(rows.slice(row).join(' ').trim().split(/\s+/),Number);if(z.length!==w*h||!z.every(Number.isFinite))throw Error('Число высот не соответствует сетке');
 const rad=Math.PI/180,lat=(south+(h-1)*step/2)*rad,lon=(west+(w-1)*step/2)*rad,center=geo(lat,lon),east=[-Math.sin(lon),0,-Math.cos(lon)],north=cross(center,east),axes=[east,center,vmul(north,-1)];
 const local=v=>axes.map(a=>dot(v,a)),at=(i,j)=>z[j*w+i];
 const stride=Math.max(1,Math.ceil(Math.max(w,h)/275)),col=[],line=[];for(let i=0;i<w-1;i+=stride)col.push(i);col.push(w-1);for(let j=0;j<h-1;j+=stride)line.push(j);line.push(h-1);
 const grid=line.map(j=>col.map(i=>{const y=at(i,j),N=geo((south+(h-1-j)*step)*rad,(west+i*step)*rad);return {y,ok:y!==meta.nodata_value,p:local(sub(vmul(N,(RADIUS+y)/1000),vmul(center,RADIUS/1000)))}}));
 const parts=[],bins=new Map();let peak=-Infinity;for(const r of grid)for(const v of r)if(v.ok)peak=Math.max(peak,v.y);
 // Share grid vertices inside 32-cell patches; skip triangles touching NODATA.
 for(let j=0;j<grid.length;j++)for(let i=0;i<grid[j].length;i++){
 const v=grid[j][i],sample=(dx,dy)=>{const row=grid[clamp(j+dy,0,grid.length-1)],p=row[clamp(i+dx,0,row.length-1)];return p.ok?p:v};
 const n=unit(cross(sub(sample(0,1).p,sample(0,-1).p),sub(sample(1,0).p,sample(-1,0).p)));v.normal=n[1]<0?vmul(n,-1):n;
 let occ=0;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){let horizon=0;for(const gap of [2,5,12]){const p=sample(dx*gap,dy*gap),delta=sub(p.p,v.p);horizon=Math.max(horizon,delta[1]/Math.max(.001,Math.hypot(delta[0],delta[2])))}
 occ+=Math.atan(horizon)}v.ao=clamp(1-occ*.13,.48,1)}
 for(let j=0;j<grid.length-1;j+=32)for(let i=0;i<grid[0].length-1;i+=32){
 const rows=Math.min(33,grid.length-j),cols=Math.min(33,grid[0].length-i),part={vertices:[],indices:[],mat:{color:[.3,.32,.30],rough:.93,metal:0,kind:3}};
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const v=grid[j+y][i+x];part.vertices.push(...v.p,...v.normal,v.ao,0);
 if(y&&x){const k=y*cols+x,a=k-cols-1,b=k-cols,c=k,d=k-1,g=grid;
 if(g[j+y-1][i+x-1].ok&&g[j+y-1][i+x].ok&&v.ok)part.indices.push(a,c,b);
 if(g[j+y-1][i+x-1].ok&&v.ok&&g[j+y][i+x-1].ok)part.indices.push(a,d,c)}}
 if(part.indices.length)parts.push(part)}
 if(!parts.length)throw Error('В сетке нет треугольников с высотами');
 function heightAt(a,b){const x=(b/rad-west)/step,y=h-1-(a/rad-south)/step;if(x<0||y<0||x>w-1||y>h-1)return 0;const i=Math.min(w-2,Math.floor(x)),j=Math.min(h-2,Math.floor(y)),u=x-i,v=y-j;
 const cells=[at(i,j),at(i+1,j),at(i,j+1),at(i+1,j+1)].map(n=>n===meta.nodata_value?0:n);return (cells[0]*(1-u)+cells[1]*u)*(1-v)+(cells[2]*(1-u)+cells[3]*u)*v}
 return {parts,lat,lon,peak,local,center,heightAt,range:Math.max(w,h)*step*112}
}
