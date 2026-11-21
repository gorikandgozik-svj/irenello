function trackModel(){
 const mats={
 asphalt:[[.095,.101,.108],.04,.9],white:[[.84,.84,.79],.04,.7],red:[[.68,.09,.045],.12,.65],
 gravel:[[.46,.36,.245],0,1],grass:[[.23,.32,.16],0,1],rail:[[.46,.50,.52],.75,.42],
 ink:[[.045,.061,.074],.47,.55],concrete:[[.49,.49,.47],.08,.88],glass:[[.09,.19,.23],.74,.18],seat:[[.63,.25,.13],.1,.7]};
 const parts=[],bins=new Map();
 function quad(name,a,b,c,d,n,uvs){let o=bins.get(name);if(!o||o.vertices.length/8>65529){const [color,metal,rough]=mats[name];o={mat:{color,metal,rough,ground:['asphalt','gravel','white','grass','red'].includes(name),kind:name==='asphalt'?1:name==='gravel'?2:0},vertices:[],indices:[]};parts.push(o);bins.set(name,o)}
 const k=o.vertices.length/8;n=n||unit(cross(sub(b,a),sub(d,a)));[a,b,c,d].forEach((v,i)=>o.vertices.push(...v,...n,...(uvs?.[i]||[0,0])));o.indices.push(k,k+1,k+2,k,k+2,k+3)}
 function strip(name,a,b,l,r,y,Y=y){quad(name,a.point(l,y),a.point(r,Y),b.point(r,Y),b.point(l,y),[0,1,0])}
 function box(name,pose,x,y,z,W,H,D){
 const p=[];for(const [i,j,k] of [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]])p.push(pose.point(x+i*W/2,y+j*H/2,z+k*D/2));
 for(const f of [[0,3,2,1],[4,5,6,7],[1,2,6,5],[0,4,7,3],[3,7,6,2],[0,1,5,4]])quad(name,...f.map(i=>p[i]))}
 for(let i=0;i<400;i++){
 const a=racePose(i*2*Math.PI/400),b=racePose((i+1)*2*Math.PI/400);
 quad('asphalt',a.point(-6.2,0),a.point(6.2,0),b.point(6.2,0),b.point(-6.2,0),[0,1,0],[[-6.2,i],[6.2,i],[6.2,i+1],[-6.2,i+1]]);
 for(const s of [-1,1]){strip('white',a,b,s*5.98,s*6.13,.007);strip(i%4<2?'white':'red',a,b,s*6.2,s*6.95,.032,.005);
 strip('gravel',a,b,s*6.95,s*11.9,0);strip('grass',a,b,s*11.9,s*17,0);
 for(const y of [.32,.57,.81])quad('rail',a.point(s*12,y-.076),b.point(s*12,y-.076),b.point(s*12,y+.076),a.point(s*12,y+.076),[-s*a.c,0,s*a.s]);
 if(i%4===0)box('ink',a,s*12.15,.75,0,.09,1.5,.10)}
 if(i%16===0){strip('white',a,b,-5.86,-4.65,.016);strip('white',a,b,4.65,5.86,.016)}
 if(i%40===0){for(const s of [-1,1]){
 if((i===0||i===360)&&s===-1){
  box('concrete',a,-22,2,0,10,4,22);box('ink',a,-22,4.15,0,11,.34,23);box('glass',a,-22,5.7,0,8,3,21.5);
  box('concrete',a,-21.5,7.32,0,10.8,.25,23);box('ink',a,-16.85,3.43,0,.25,.60,22);
  for(let bay=0;bay<5;bay++){let z=bay*4.2-8.4;box('ink',a,-16.95,1.55,z,.2,2.96,3.75);
   for(let j=0;j<12;j++)box('rail',a,-16.80,.39+.205*j,z,.08,.045,3.5);
   box('red',a,-16.79,3.50,z,.06,.24,2.9);box('white',a,-16.74,3.50,z-.7,.04,.085,.9)}
  for(let j=0;j<15;j++)box('rail',a,-17.93,5.64,-10.5+1.5*j,.15,2.91,.09);
  continue
 }box('concrete',a,s*22,.50,0,5,1,20);
 for(let r=0;r<6;r++)box(r%3?'ink':'seat',a,s*(18+r*.9),1+r*.45,0,.94,.43,19);
 box('rail',a,s*23.4,4.4,-8,.13,5,.13);box('rail',a,s*23.4,4.4,8,.13,5,.13);box('concrete',a,s*21.2,6.8,0,6.75,.18,20)}}
 }
 quad('grass',[-900,-.09,-900],[-900,-.09,900],[900,-.09,900],[900,-.09,-900],[0,1,0]);
 return {parts}
}
