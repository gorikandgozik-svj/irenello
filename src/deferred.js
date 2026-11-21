// Portable G-buffer implementation. Each attachment uses an ordinary RGBA8 surface,
// allowing the same lighting pass to work on WebGL 1 without multiple render targets.
const gbufferWrite=`
 if(bufferIndex>.5){
  if(bufferIndex<1.5){gl_FragColor=vec4(sqrt(clamp(color,0.,1.)),metal);return;}
  if(bufferIndex<2.5){
   vec3 n=N/(abs(N.x)+abs(N.y)+abs(N.z));
   vec2 oct=n.z>=0.?n.xy:(1.-abs(n.yx))*vec2(n.x<0.?-1.:1.,n.y<0.?-1.:1.);
   gl_FragColor=vec4(oct*.5+.5,rough,coatLayer.x);return;
  }
  if(bufferIndex<3.5){float z=max(.001,dot(wp-eye,cf));
   gl_FragColor=vec4(packZ(clamp(log2(z+1.)/24.,.000001,.99999)),visibility(N));return;}
  gl_FragColor=vec4(emission/(1.+emission),coatLayer.y);return;
 }
`;
const resolveFS=shared+ibl+`
varying vec2 ndc;
uniform sampler2D colors,normals,depths,emissive;
uniform float bounce;
uniform vec4 lamp0,lamp1,lamp2,lamp3;
uniform vec3 power0,power1,power2,power3;
`+fs2.slice(fs2.indexOf('vec3 pointBRDF'),fs2.indexOf('uniform vec2 coatLayer'))+tileShader+`
vec3 normalAt(vec4 data){
 vec2 p=data.xy*2.-1.;vec3 n=vec3(p,1.-abs(p.x)-abs(p.y));
 float t=max(-n.z,0.);n.xy+=vec2(n.x>=0.?-t:t,n.y>=0.?-t:t);return normalize(n);
}
float distanceAt(vec4 d){return exp2(dot(d.rgb,vec3(1.,1./255.,1./65025.))*24.)-1.;}
vec3 positionAt(vec2 uv,float z){return eye+(cf+cr*((uv.x*2.-1.)*lens.x)+cu*((uv.y*2.-1.)*lens.y))*z;}
vec3 surfaceLight(vec2 uv){
 vec4 a=texture2D(colors,uv),n=texture2D(normals,uv),e=texture2D(emissive,uv);
 return a.rgb*a.rgb*(.13+max(dot(normalAt(n),sun),0.)*texture2D(depths,uv).a)+e.rgb/max(vec3(.004),1.-e.rgb);
}
void main(){
 vec2 uv=ndc*.5+.5;vec4 depth=texture2D(depths,uv);float z=distanceAt(depth);if(z<.001)discard;
 vec4 al=texture2D(colors,uv),nr=texture2D(normals,uv),em=texture2D(emissive,uv);
 vec3 P=positionAt(uv,z),N=normalAt(nr),V=normalize(eye-P),R=reflect(-V,N),base=al.rgb*al.rgb;
 float metal=al.a,rough=max(.065,nr.b),nv=max(.001,dot(N,V));
 vec3 F0=mix(vec3(.04),base,metal),F=F0+(1.-F0)*pow(1.-nv,5.);
 vec3 reflection=environment(R,rough);
 if(rough<.58){
  float previous=-1.;bool valid=false;
  for(int j=0;j<32;j++){
   float f=float(j+1);float travel=.12*f+.019*f*f;vec3 aim=P+N*.075+R*travel-eye;
   float az=dot(aim,cf);if(az<=.03)break;
   vec2 coord=.5+.5*vec2(dot(aim,cr)/lens.x,dot(aim,cu)/lens.y)/az;
   if(any(lessThanEqual(coord,vec2(.001)))||any(greaterThanEqual(coord,vec2(.999))))break;
   float sz=distanceAt(texture2D(depths,coord)),delta=az-sz;
   if(valid&&sz>.01&&delta>=0.&&previous<0.&&delta<.24+.05*travel){
    float edge=min(min(coord.x,coord.y),min(1.-coord.x,1.-coord.y));
    reflection=mix(reflection,surfaceLight(coord),smoothstep(0.,.08,edge)*(1.-rough));break;
   }
   previous=delta;valid=sz>.01;
  }
 }
 vec3 diffuse=base*(1.-metal),c=diffuse*(.09+.25*clamp(environment(N,1.),0.,2.))+reflection*F;
 c+=pointBRDF(vec4(P+sun*10.,10000.),vec3(340.,312.,280.)*depth.a,P,N,V,diffuse,F0,rough);
 c+=tileLighting(P,N,V,diffuse,F0,rough);
 if(bounce>.5){
  vec3 indirect=vec3(0.);
  for(int j=0;j<16;j++){
   float fi=float(j)+.5,angle=fi*2.399963;
   vec2 q=uv+vec2(cos(angle),sin(angle))*sqrt(fi/16.)*2.5/(max(z,1.)*lens);
   if(any(lessThan(q,vec2(0.)))||any(greaterThan(q,vec2(1.))))continue;
   float sz=distanceAt(texture2D(depths,q));if(sz<.01)continue;
   vec3 d=positionAt(q,sz)-P;float len=length(d);if(len<.06||len>6.)continue;
   vec3 dir=d/len;float weight=max(0.,dot(N,dir))*max(0.,dot(normalAt(texture2D(normals,q)),-dir))/(1.+len*len*.2);
   indirect+=surfaceLight(q)*weight;
  }
  c+=diffuse*indirect*.17;
 }
 float coat=nr.a*(.04+.96*pow(1.-nv,5.));c=c*(1.-coat)+coat*environment(R,em.a);
 c+=em.rgb/max(vec3(.004),1.-em.rgb);float fog=1.-exp(-length(P-eye)*fogDensity);
 gl_FragColor=vec4(mix(grade(c*.74),vec3(.73,.78,.8),fog),1.);
}`;
class DeferredPass{
 constructor(renderer){
  const g=renderer.gl;this.gl=g;
  const source=fs2.replace('uniform vec2 coatLayer;','uniform float bufferIndex;uniform vec2 coatLayer;').replace(' float nl=max(dot(N,sun)',gbufferWrite+' float nl=max(dot(N,sun)');
  this.ext=g.getExtension('WEBGL_draw_buffers');
  if(this.ext?.drawBuffersWEBGL&&g.getParameter(this.ext.MAX_DRAW_BUFFERS_WEBGL)>=4&&g.getParameter(this.ext.MAX_COLOR_ATTACHMENTS_WEBGL)>=4){
   const write=gbufferWrite.replaceAll(/if\(bufferIndex<[123]\.5\)/g,'').replaceAll('return;','');
   let index=0;const outputs=write.replaceAll('gl_FragColor',()=> 'gl_FragData['+(index++)+']').replace('if(bufferIndex>.5)','if(bufferIndex>.5)').replace(/}\s*$/,'return;}');
   const frag='#extension GL_EXT_draw_buffers : require\n'+fs2.replaceAll('gl_FragColor','gl_FragData[0]').replace('uniform vec2 coatLayer;','uniform float bufferIndex;uniform vec2 coatLayer;').replace(' float nl=max(dot(N,sun)',outputs+' float nl=max(dot(N,sun)');
   try{this.mrt=renderer.program(vs2,frag)}catch{this.mrt=null}
  }
  this.geometry=this.mrt||renderer.program(vs2,source);this.light=renderer.program(bgVS,resolveFS);
  this.fb=g.createFramebuffer();this.depth=g.createRenderbuffer();this.maps=Array.from({length:4},()=>renderer.texture(null))
 }
 targets(w,h){
  const g=this.gl;g.bindFramebuffer(g.FRAMEBUFFER,this.fb);
  if(this.w===w&&this.h===h)return;
  g.bindRenderbuffer(g.RENDERBUFFER,this.depth);g.renderbufferStorage(g.RENDERBUFFER,g.DEPTH_COMPONENT16,w,h);
  g.framebufferRenderbuffer(g.FRAMEBUFFER,g.DEPTH_ATTACHMENT,g.RENDERBUFFER,this.depth);
  for(const tex of this.maps){
   g.bindTexture(g.TEXTURE_2D,tex);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,w,h,0,g.RGBA,g.UNSIGNED_BYTE,null);
   for(const p of [g.TEXTURE_MIN_FILTER,g.TEXTURE_MAG_FILTER])g.texParameteri(g.TEXTURE_2D,p,g.NEAREST);
  }
  this.w=w;this.h=h
 }
 render(w,h,draw,setup,bind,background,quad,bounce,tiles){
  const g=this.gl;this.targets(w,h);g.viewport(0,0,w,h);
  if(this.mrt){
   const attachments=this.maps.map((tex,i)=>{const a=g.COLOR_ATTACHMENT0+i;g.framebufferTexture2D(g.FRAMEBUFFER,a,g.TEXTURE_2D,tex,0);return a});
   this.ext.drawBuffersWEBGL(attachments);
   if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Unsupported MRT size');
   g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);draw(false,this.geometry,1)
  }else for(let i=0;i<this.maps.length;i++){
   g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,this.maps[i],0);
   if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Unsupported G-buffer size');
   g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);
   draw(false,this.geometry,i+1)
  }
  g.bindFramebuffer(g.FRAMEBUFFER,null);g.clear(g.DEPTH_BUFFER_BIT);background();
  const u=setup(this.light);
  for(const [i,n] of ['colors','normals','depths','emissive'].entries()){bind(i,this.maps[i]);g.uniform1i(u[n],i)}
  tiles.bind(u,bind);
  g.uniform1f(u.bounce,bounce?1:0);g.disable(g.DEPTH_TEST);g.bindBuffer(g.ARRAY_BUFFER,quad);
  const a=this.light.a.p;g.enableVertexAttribArray(a);g.vertexAttribPointer(a,2,g.FLOAT,false,0,0);g.drawArrays(g.TRIANGLES,0,3);g.disableVertexAttribArray(a)
 }
 dispose(){const g=this.gl;for(const t of this.maps)g.deleteTexture(t);g.deleteFramebuffer(this.fb);g.deleteRenderbuffer(this.depth);g.deleteProgram(this.geometry.p);g.deleteProgram(this.light.p)}
}
