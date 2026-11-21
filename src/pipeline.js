const shared=`
precision highp float;
uniform vec3 eye,cf,cr,cu,sun,focus,lightX,lightY;
uniform vec2 clipZ;uniform float fogDensity;uniform vec2 lens;uniform vec4 crop;
float h(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.11369,.13787));q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
float fb(vec2 p){return .53*noise2(p)+.27*noise2(p*2.03+7.)+.13*noise2(p*4.17)+.07*noise2(p*8.31);}
vec3 skyColor(vec3 v){
 float y=max(0.,v.y),ss=max(0.,dot(v,sun));vec3 base=mix(vec3(.75,.805,.83),vec3(.185,.405,.64),1.-exp(-3.3*y));
 vec2 u=v.xz/max(y+.045,.05);float cloud=fb(u*vec2(.76,1.8));
 base=mix(base,vec3(.93,.90,.85),smoothstep(.47,.70,cloud)*smoothstep(.01,.17,y)*.78);
 float a=atan(v.x,v.z);float ridge=.020+.035*noise2(vec2(a*8.,3.))+.012*noise2(vec2(45.*a,2.));
 base=mix(vec3(.50,.57,.56),base,smoothstep(ridge-.002,ridge+.002,v.y));
 return base+vec3(1.,.85,.61)*(.12*pow(ss,9.)+.40*pow(ss,220.)+smoothstep(.9996,.99995,ss));
}
vec3 lightSpace(vec3 w){vec3 p=w-focus;return vec3(dot(p,lightX)/12.,dot(p,lightY)/12.,-dot(p,sun)/28.);}
`;
const vs2=shared+`attribute vec4 instancePos;attribute vec3 instanceTurn;varying float variation;attribute vec3 p,n;attribute vec2 uv;attribute vec4 tangent;varying vec4 tanFrame;uniform mat4 model;uniform mat3 normalFrame;uniform float shadowPass;
varying vec3 wp,wn;varying vec2 tex;
vec3 spinY(vec3 v){return vec3(v.x*instanceTurn.x+v.z*instanceTurn.y,v.y,v.z*instanceTurn.x-v.x*instanceTurn.y);}
void main(){vec3 local=spinY(p)*instancePos.w+instancePos.xyz;wp=(model*vec4(local,1.)).xyz;wn=normalize(normalFrame*spinY(n));tex=uv;variation=instanceTurn.z;tanFrame=vec4(mat3(model)*spinY(tangent.xyz),tangent.w);
 if(shadowPass>.5){gl_Position=vec4(lightSpace(wp),1.);return;}
 vec3 v=wp-eye;float z=dot(v,cf);vec2 xy=vec2(dot(v,cr),dot(v,cu))/lens;
 gl_Position=vec4((xy-z*crop.zw)/crop.xy,z*clipZ.x-clipZ.y,z);}`;
const ibl=`
uniform sampler2D lighting;uniform float hasIBL;
vec3 environment(vec3 v,float rough){if(hasIBL<.5)return skyColor(v);
 vec2 pos=vec2(fract(.5+atan(v.z,v.x)/6.2831853+.08),clamp(.5-asin(clamp(v.y,-1.,1.))/3.14159265,.001,.999)*.5);
 vec3 sharp=texture2D(lighting,pos).rgb,blur=texture2D(lighting,pos+vec2(0.,.5)).rgb;
 return mix(exp(sharp*4.1744)-1.,exp(blur*4.1744)-1.,rough*rough)*.5;}
vec3 grade(vec3 c){return pow(clamp(c*(2.51*c+.03)/(c*(2.43*c+.59)+.14),0.,1.),vec3(.4545));}
`;
const fs2=shared+ibl+`varying vec3 wp,wn;varying vec2 tex;varying float variation;uniform vec4 tint;uniform vec3 carContact;uniform sampler2D roadReflection;uniform vec2 framePixels;uniform float useReflection;
uniform vec4 lamp0,lamp1,lamp2,lamp3;
uniform vec3 power0,power1,power2,power3;
vec3 pointBRDF(vec4 lamp,vec3 power,vec3 P,vec3 N,vec3 V,vec3 diffuse,vec3 f0,float rough){
 vec3 delta=lamp.xyz-P;float d2=max(.001,dot(delta,delta));float reach=lamp.w;
 if(reach<=0.||d2>=reach*reach)return vec3(0.);
 vec3 L=delta*inversesqrt(d2),H=normalize(L+V);float nl=max(0.,dot(N,L)),nv=max(.001,dot(N,V));
 float nh=max(0.,dot(N,H)),vh=max(0.,dot(V,H)),a=pow(rough,4.);
 float den=nh*nh*(a-1.)+1.,k=(rough+1.)*(rough+1.)*.125;
 vec3 f=f0+(1.-f0)*pow(1.-vh,5.);
 float visibility=.25/max(.001,(nv*(1.-k)+k)*(nl*(1.-k)+k));
 float cutoff=clamp(1.-pow(d2/(reach*reach),2.),0.,1.);
 return power*nl*cutoff*cutoff/max(.09,d2)*((1.-f)*diffuse/3.14159+f*a*visibility/max(.000001,3.14159*den*den));
}
uniform vec2 coatLayer;uniform vec4 material;uniform float shadowPass,shadowSize,cut;
uniform sampler2D shadowTex,albedo,mrMap,normalMap;uniform vec3 emission;uniform float normalScale,alphaBlend;varying vec4 tanFrame;
vec3 packZ(float v){vec3 e=fract(v*vec3(1.,255.,65025.));return e-e.yzz*vec3(1./255.,1./255.,0.);}
float unpackZ(vec3 x){return dot(x,vec3(1.,1./255.,1./65025.));}
float visibility(vec3 N){
 if(shadowSize<1.)return 1.;vec3 sp=lightSpace(wp)*.5+.5;
 if(min(min(sp.x,sp.y),sp.z)<0.||max(max(sp.x,sp.y),sp.z)>1.)return 1.;
 float lit=0.;float bias=.0011+.0026*(1.-max(0.,dot(N,sun)));
 for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++){vec2 uv=sp.xy+vec2(float(i),float(j))/shadowSize;lit+=step(sp.z-bias,unpackZ(texture2D(shadowTex,uv).rgb));}
 return lit/9.;}
void main(){
 vec4 sampleColor=texture2D(albedo,tex);if(tint.a*sampleColor.a<cut)discard;
 if(shadowPass>.5){gl_FragColor=vec4(packZ(gl_FragCoord.z),1.);return;}
 vec3 N=normalize(wn);if(material.w>.5){vec3 T=normalize(tanFrame.xyz-N*dot(N,tanFrame.xyz)),B=cross(N,T)*tanFrame.w;vec3 n=texture2D(normalMap,tex).xyz*2.-1.;N=normalize(mat3(T,B,N)*vec3(n.xy*normalScale,n.z));}vec3 V=normalize(eye-wp),H=normalize(V+sun);vec4 mr=texture2D(mrMap,tex);float metal=material.x*mr.b,rough=clamp(material.y*mr.g,.065,1.);
 float film=0.;vec3 color=variation*tint.rgb*pow(sampleColor.rgb,vec3(2.2));
 if(material.z>7.5){
 float brushed=noise2(vec2(wp.y*148.+wp.x*31.,wp.z*2.+wp.x*.7));
 color*=.91+.11*brushed;rough=clamp(rough+(.5-brushed)*.085,.08,.98);
 }else if(material.z>6.5){
 vec2 p=abs(N.y)>.7?wp.xz:(abs(N.z)>.7?wp.xy:wp.zy);
 float pores=fb(p*3.2),grain=noise2(p*67.);vec2 hole=fract(p/vec2(1.22,1.7))-.5;
 float pit=1.-smoothstep(.005,.015,length(hole));color*=.72+.29*pores+.13*grain-.48*pit;
 rough=clamp(rough+.09*(grain-.5),.1,1.);
 }else if(material.z>5.5){
 float slope=smoothstep(.18,.57,1.-N.y),rock=fb(wp.xz*.12+wp.y*.09);
 float turf=fb(wp.xz*.028);color=mix(mix(vec3(.075,.13,.050),vec3(.31,.32,.13),turf),mix(vec3(.14,.14,.13),vec3(.48,.44,.38),rock),slope);
 float fine=noise2(wp.xz*2.7),grain=noise2(wp.zx*7.1);
 color*=.67+.34*fine+.29*grain;
 N=normalize(N+vec3(fine-.5,0.,grain-.5)*.21);
 rough=mix(.92,.69,slope);
 }else if(material.z>4.5){float grain=fb(wp.xy*vec2(2.,31.)+wp.z*vec2(7.,1.));color*=.62+grain*.64;}
 else if(material.z>3.5){color*=1.12;}else if(material.z>2.5){
  vec2 rock=wp.xz*6.+wp.y*vec2(.72,1.4);float f=fb(rock),detail=noise2(rock*17.);
  vec3 stone=mix(vec3(.13,.12,.11),vec3(.37,.33,.28),f*.8+.2*detail);
  float meadow=smoothstep(.67,.93,N.y)*(1.-smoothstep(1.5,2.5,wp.y+f*.35));
  vec3 pine=mix(vec3(.028,.068,.044),vec3(.13,.18,.091),fb(wp.xz*22.));
 color=mix(stone,pine,meadow);float snow=smoothstep(2.95,3.22,wp.y+1.14*(N.y-.78)+.31*f+.09*detail);
 color=mix(color,vec3(.77,.84,.89)*(.90+.12*detail),snow)*mix(.47,1.,tex.x);
 N=normalize(N+vec3(f-.5,0.,detail-.5)*.14);
 }else if(material.z>.5){float a=noise2(wp.xz*17.71+vec2(.21,.31)),b=fb(wp.xz*.22);
 if(material.z<1.5){
  float tyre=(1.-smoothstep(.19,.75,abs(abs(tex.x+.30*sin(tex.y*.027))-1.04)));float wet=smoothstep(.43,.63,fb(wp.xz*.59+vec2(3.,1.)));
  film=wet;color*=mix(.62,.31,wet)*mix(1.,.72,tyre);rough=mix(.80,.14,wet*.91);metal=.035;
 }color*=.50+.43*b+.23*a;N=normalize(N+vec3(a-.5,0.,noise2(wp.zx*41.)-.5)*.055);}
 float nl=max(dot(N,sun),0.),nv=max(dot(N,V),.001),nh=max(dot(N,H),.001),vh=max(dot(V,H),0.);
 float a2=pow(rough,4.),den=nh*nh*(a2-1.)+1.,D=a2/(3.14159*den*den);
 float k=pow(rough+1.,2.)*.125,G=nv/(nv*(1.-k)+k)*nl/(nl*(1.-k)+k);
 vec3 F0=mix(vec3(.04),color,metal),F=F0+(1.-F0)*pow(1.-vh,5.);
 float vis=visibility(N);vec3 diff=(1.-F)*(1.-metal)*color;
 vec3 refl=reflect(-V,N);vec3 env=environment(refl,rough);
 vec3 c=(diff/3.14159+F*D*G/max(.004,4.*nv*nl))*vec3(3.4,3.12,2.8)*nl*vis;
 c+=color*(1.-metal)*(.055+.32*clamp(environment(N,1.),0.,2.))*(.64+.36*vis);
 c+=env*(F0+(1.-F0)*pow(1.-nv,5.)*.62)*(.83-.35*rough);
 if(carContact.x>.5 && material.z>.5 && material.z<1.5){
 vec2 delta=wp.xz-focus.xz;vec2 car=vec2(dot(delta,vec2(carContact.z,-carContact.y)),dot(delta,carContact.yz));float ao=exp(-dot(car*vec2(.92,.48),car*vec2(.92,.48))*1.6);
 c*=1.-.68*ao;}
 if(lamp0.w>0.){
 vec3 baseDiffuse=(1.-metal)*color;
 c+=pointBRDF(lamp0,power0,wp,N,V,baseDiffuse,F0,rough)+pointBRDF(lamp1,power1,wp,N,V,baseDiffuse,F0,rough)
   +pointBRDF(lamp2,power2,wp,N,V,baseDiffuse,F0,rough)+pointBRDF(lamp3,power3,wp,N,V,baseDiffuse,F0,rough);}
 if(coatLayer.x>0.){
 float gloss=clamp(coatLayer.y,.06,1.),aa=pow(gloss,4.),d=nh*nh*(aa-1.)+1.;
 float fc=.04+.96*pow(1.-vh,5.),fv=.04+.96*pow(1.-nv,5.);
 c=c*(1.-coatLayer.x*fv)+coatLayer.x*(environment(refl,gloss)*fv+
 vec3(3.4,3.12,2.8)*vis*nl*fc*aa/max(.000001,3.14159*d*d*4.*max(nv,nl)));}
 c+=emission;c=grade(c*.74);
 if(useReflection>.5 && film>.0){vec2 uv=((gl_FragCoord.xy/framePixels*2.-1.)*crop.xy+crop.zw)*.5+.5;
 vec2 ripple=vec2(N.x,N.z)*.015;vec3 reflection=texture2D(roadReflection,clamp(uv+ripple,.001,.999)).rgb;
 c=mix(c,reflection,film*(.18+.61*pow(1.-nv,3.)));}
 float fog=1.-exp(-length(eye-wp)*(material.z>2.5&&material.z<3.5?.026:fogDensity));gl_FragColor=vec4(mix(c,vec3(.73,.78,.8),fog),mix(1.,tint.a*sampleColor.a,alphaBlend));}
`;
const bgVS='attribute vec2 p;varying vec2 ndc;void main(){ndc=p;gl_Position=vec4(p,0,1);}';
const bgFS=shared+ibl+`varying vec2 ndc;uniform sampler2D earth;uniform float planet,time,altRatio,clouds;
float cloudDensity(vec3 p){
 float slice=floor(p.y),fy=fract(p.y);fy=fy*fy*(3.-2.*fy);
 return mix(fb(p.xz+slice*17.),fb(p.xz+(slice+1.)*17.),fy);
}
vec3 cloudLayer(vec3 sky,vec3 ray){
 if(clouds<=0.||abs(ray.y)<.008)return sky;
 float a=(2150.-eye.y)/ray.y,b=(3150.-eye.y)/ray.y;
 float enter=max(0.,min(a,b)),leave=min(50000.,max(a,b));
 if(leave<=enter)return sky;
 float ds=(leave-enter)/20.,trans=1.;vec3 scatter=vec3(0.);
 for(int i=0;i<20;i++){
  vec3 p=eye+ray*(enter+(float(i)+.5)*ds);
  float height=(p.y-2150.)*.001;
  vec3 q=p*vec3(.00057,.0026,.00057)+vec3(time*.007,0.,0.);
  float rho=smoothstep(.43,.68,cloudDensity(q))*smoothstep(0.,.18,height)*(1.-smoothstep(.72,1.,height));
  float alpha=1.-exp(-rho*ds*.003*clouds);
  float lit=1.-.65*smoothstep(.44,.67,cloudDensity(q+sun*.48));
  scatter+=trans*alpha*mix(vec3(.48,.55,.64),vec3(1.,.96,.88),lit);
  trans*=1.-alpha;if(trans<.015)break;
 }return mix(sky,scatter+trans*sky,smoothstep(.015,.13,abs(ray.y)));
}
void main(){vec2 screen=ndc*crop.xy+crop.zw;vec3 r=normalize(cf+cr*screen.x*lens.x+cu*screen.y*lens.y);
 if(planet<.5){vec3 photo=grade(environment(normalize(vec3(r.x,max(.32,r.y),r.z)),0.)*.82);
 float a=atan(r.x,r.z);float ridge=.016+.055*fb(vec2(a*6.,4.))+.010*noise2(vec2(a*37.,1.));
 vec3 haze=mix(vec3(.52,.61,.69),vec3(.90,.73,.57),pow(max(0.,dot(r,sun)),4.));
 vec3 sky=mix(haze,photo,smoothstep(.01,.35,r.y));
 vec3 horizon=clouds>0.?mix(vec3(.73,.78,.8),sky,smoothstep(.0,.16,r.y)):mix(haze*.76,sky,smoothstep(ridge-.002,ridge+.002,r.y));
 gl_FragColor=vec4(cloudLayer(horizon,r),1.);return;}
 float localY=dot(normalize(eye),r),altFade=1.-smoothstep(.005,.022,altRatio);
 float daySky=smoothstep(-.16,.23,dot(normalize(eye),sun));vec3 air=mix(vec3(.67,.77,.85),vec3(.18,.43,.72),smoothstep(0.,.64,localY))*mix(.12,1.,daySky);
 if(altFade>.01 && localY>-.03 && altRatio<.00145){
 float p=dot(eye,r),radiusCloud=1.00145,travel=-p+sqrt(max(0.,p*p+radiusCloud*radiusCloud-dot(eye,eye)));
 vec3 location=(eye+r*travel)*560.;vec2 u=location.xz+location.y*.34;
 float trans=1.;vec3 scattered=vec3(0.);
 for(int j=0;j<10;j++){
 float f=(float(j)+.5)/10.;vec3 at=location+(r*1.1/max(.12,localY))*f;
 vec2 drift=vec2(.0009,.00035)*mod(time,20000.);
 float vapor=fb((at.xz+at.y*.34)*vec2(.52,1.25)+drift)+.18*noise2(at.xy*3.+drift);
 float profile=4.*f*(1.-f),density=max(0.,vapor-.53)*profile;
 float alpha=1.-exp(-density*1.65/max(.2,localY));
 scattered+=trans*alpha*mix(vec3(.59,.65,.72),vec3(1.,.96,.87),f)*mix(.16,1.,daySky);
 trans*=1.-alpha;}
 air=air*trans+scattered;}
 float b=dot(eye,r),c=altRatio*(2.+altRatio),disc=b*b-c;
 float glow=exp(-abs(disc)*25.);vec3 space=vec3(.008,.013,.027)+glow*vec3(.07,.23,.42)*step(b,0.);
 if(b>=0.||disc<0.){gl_FragColor=vec4(mix(space,air,altFade),1.);return;}
 float t=c/(-b+sqrt(disc));vec3 N=normalize(eye+t*r);
 vec2 uv=vec2(.5+atan(-N.z,N.x)/6.2831853,.5-asin(clamp(N.y,-1.,1.))/3.14159265);
 vec3 base=texture2D(earth,uv).rgb;float ocean=smoothstep(.01,.10,base.b-base.r);
 float day=dot(N,sun),ndv=max(dot(N,-r),0.);
 vec2 cloudUV=N.xz*7.+N.y*vec2(3.,5.);
 vec2 swirl=vec2(fb(N.xy*9.+N.z*3.),fb(N.zy*11.-N.x*5.))-.5;
 vec3 Q=N*13.;float field=.39*fb(Q.xy+swirl*3.)+.34*fb(Q.yz+swirl*4.)+.27*fb(Q.zx-swirl*3.);
 float bands=sin(N.y*38.+swirl.x*11.+swirl.y*7.);
 float filament=fb(Q.xy*3.1+Q.z*.7+swirl*8.);
 float clouds=smoothstep(.49,.66,field+.073*bands+.14*(filament-.5));
 vec3 surface=mix(base,vec3(.90,.92,.92),clouds*.83);
 surface*=.14+.97*smoothstep(-.10,.75,day);
 surface+=vec3(.96,.78,.47)*pow(max(0.,dot(reflect(-sun,N),-r)),75.)*.50*ocean*(1.-clouds);
 float rim=pow(1.-ndv,3.);surface=mix(surface,vec3(.32,.59,.83),rim*.72*smoothstep(-.35,.25,day));
 surface=mix(surface,air,altFade*(1.-exp(-t*135.)));gl_FragColor=vec4(surface,1.);}`;
function tangentData(part){
 const v=part.vertices,t=new Float32Array(v.length/8*4),bit=new Float32Array(t.length);
 for(let i=0;i<part.indices.length;i+=3){const ids=part.indices.slice(i,i+3),[a,b,c]=ids.map(k=>k*8);
 const u1=v[b+6]-v[a+6],u2=v[c+6]-v[a+6],v1=v[b+7]-v[a+7],v2=v[c+7]-v[a+7],det=u1*v2-v1*u2;if(Math.abs(det)<1e-12)continue;
 for(let j=0;j<3;j++){const e=v[b+j]-v[a+j],f=v[c+j]-v[a+j];for(const id of ids){t[id*4+j]+=(e*v2-f*v1)/det;bit[id*4+j]+=(f*u1-e*u2)/det}}}
 for(let i=0;i<t.length;i+=4){const n=v.slice(i*2+3,i*2+6);let a=Array.from(t.slice(i,i+3));if(Math.hypot(...a)<.001)a=cross(n,Math.abs(n[1])<.9?[0,1,0]:[1,0,0]);a=unit(a);t.set(a,i);t[i+3]=dot(cross(n,a),bit.slice(i,i+3))<0?-1:1}return t
}
function meshInFrustum(object,camera,fov,aspect){
 const bounds=object.bounds||(object.records?null:object.parts.bounds);if(!bounds)return true;
 const m=object.model,c=sub(M.point(m,bounds.center),camera.eye),e=bounds.extent;
 const planes=[camera.f,add(vmul(camera.f,fov*aspect),camera.r),sub(vmul(camera.f,fov*aspect),camera.r),add(vmul(camera.f,fov),camera.u),sub(vmul(camera.f,fov),camera.u)];
 for(const n of planes){
  const radius=e[0]*Math.abs(n[0]*m[0]+n[1]*m[1]+n[2]*m[2])+e[1]*Math.abs(n[0]*m[4]+n[1]*m[5]+n[2]*m[6])+e[2]*Math.abs(n[0]*m[8]+n[1]*m[9]+n[2]*m[10]);
  if(dot(c,n)<-radius)return false
 }
 return true
}
class StageRenderer{
 constructor(canvas){
 this.gl=canvas.getContext('webgl',{alpha:false,antialias:true});if(!this.gl)throw Error('WebGL недоступен');const gl=this.gl;
 this.program=compileProgram;this.meshProgram=this.program(vs2,fs2);this.bg=this.program(bgVS,bgFS);
 this.instancing=gl.getExtension('ANGLE_instanced_arrays');this.instanceBuffer=gl.createBuffer();this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
 this.white=this.texture(null);this.map=this.white;this.environment=this.white;this.fb=gl.createFramebuffer();this.depth=gl.createRenderbuffer();this.shadow=this.texture(null);this.dim=0;this.reflectFB=gl.createFramebuffer();this.reflectDepth=gl.createRenderbuffer();this.reflectTex=this.texture(null);this.reflectW=0;this.reflectH=0;
 }
 texture(image){const g=this.gl,t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);
 if(image)g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,image);else g.texImage2D(g.TEXTURE_2D,0,g.RGBA,1,1,0,g.RGBA,g.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
 for(const p of [g.TEXTURE_MIN_FILTER,g.TEXTURE_MAG_FILTER])g.texParameteri(g.TEXTURE_2D,p,g.LINEAR);
 if(image&&image.width>0&&image.height>0&&(image.width&(image.width-1))===0&&(image.height&(image.height-1))===0){
  g.generateMipmap(g.TEXTURE_2D);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR_MIPMAP_LINEAR)
 }
 for(const p of [g.TEXTURE_WRAP_S,g.TEXTURE_WRAP_T])g.texParameteri(g.TEXTURE_2D,p,g.CLAMP_TO_EDGE);return t}
 async upload(model,keepChassis=false){const g=this.gl,parts=[],textures=new Map();try{
 for(const part of model.parts){const {mat}=part;const get=async bytes=>{if(!bytes)return this.white;if(!textures.has(bytes))textures.set(bytes,this.texture(await decodeImage(bytes)));return textures.get(bytes)};
 const tex=await get(mat.image),mr=await get(mat.mrImage),normal=await get(mat.normalImage);let tangent=null;
 if(mat.normalImage){tangent=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,tangent);g.bufferData(g.ARRAY_BUFFER,tangentData(part),g.STATIC_DRAW)}
 const v=g.createBuffer(),i=g.createBuffer();let center=[0,0,0];if(mat.blend){for(let j=0;j<part.vertices.length;j+=8)for(let k=0;k<3;k++)center[k]+=part.vertices[j+k];center=vmul(center,8/part.vertices.length)}
 parts.push({source:keepChassis&&part.nodeName==='Chassis'?new Float32Array(part.vertices):null,v,i,count:part.indices.length,mat,tex,mr,normal,tangent,center,nodeName:part.nodeName});g.bindBuffer(g.ARRAY_BUFFER,v);g.bufferData(g.ARRAY_BUFFER,new Float32Array(part.vertices),g.STATIC_DRAW);g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,i);g.bufferData(g.ELEMENT_ARRAY_BUFFER,new Uint16Array(part.indices),g.STATIC_DRAW)}
 return parts}catch(e){this.free(parts);throw e}}
 free(parts){let tex=new Set();for(const p of parts){this.gl.deleteBuffer(p.v);this.gl.deleteBuffer(p.i);if(p.tangent)this.gl.deleteBuffer(p.tangent);for(const t of [p.tex,p.mr,p.normal])if(t!==this.white)tex.add(t)}for(const t of tex)this.gl.deleteTexture(t)}
 shadowTarget(size){const g=this.gl;if(this.dim===size)return;this.dim=size;g.bindTexture(g.TEXTURE_2D,this.shadow);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,size,size,0,g.RGBA,g.UNSIGNED_BYTE,null);
 for(const p of [g.TEXTURE_MIN_FILTER,g.TEXTURE_MAG_FILTER])g.texParameteri(g.TEXTURE_2D,p,g.NEAREST);
 g.bindRenderbuffer(g.RENDERBUFFER,this.depth);g.renderbufferStorage(g.RENDERBUFFER,g.DEPTH_COMPONENT16,size,size);g.bindFramebuffer(g.FRAMEBUFFER,this.fb);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,this.shadow,0);g.framebufferRenderbuffer(g.FRAMEBUFFER,g.DEPTH_ATTACHMENT,g.RENDERBUFFER,this.depth);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Недоступна карта теней')}
 reflectTarget(w,h){const g=this.gl;g.bindFramebuffer(g.FRAMEBUFFER,this.reflectFB);
 if(this.reflectW===w&&this.reflectH===h)return;g.bindTexture(g.TEXTURE_2D,this.reflectTex);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,w,h,0,g.RGBA,g.UNSIGNED_BYTE,null);
 g.bindRenderbuffer(g.RENDERBUFFER,this.reflectDepth);g.renderbufferStorage(g.RENDERBUFFER,g.DEPTH_COMPONENT16,w,h);
 g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,this.reflectTex,0);g.framebufferRenderbuffer(g.FRAMEBUFFER,g.DEPTH_ATTACHMENT,g.RENDERBUFFER,this.reflectDepth);
 if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Недоступен буфер отражения');this.reflectW=w;this.reflectH=h}
 lightsFor(state,camera,w,h){
  this.tileCache??=new LightTileCache(this);
  this.tileCache.update(state.lights||[],camera,state.fov,w,h);
  return this.tileCache
 }
 frame(state,w,h,aspect=w/h,crop=[1,1,0,0],refresh=true){
 const g=this.gl,{sun,focus}=state;let objects=state.objects;this.stats={instances:0,calls:0,triangles:0,shadowCalls:0,reflectionCalls:0,candidates:0};let mirror=false;let camera=state.camera,light=sun;const lightX=unit(cross(Math.abs(sun[1])>.999?[1,0,0]:[0,1,0],sun)),lightY=unit(cross(sun,lightX));
 const setup=pr=>{const u=pr.u;g.useProgram(pr.p);for(const [k,v] of Object.entries({eye:camera.eye,cf:camera.f,cr:camera.r,cu:camera.u,sun:light,focus,lightX,lightY}))if(u[k])g.uniform3fv(u[k],v);
 if(u.lamp0){const lamps=(state.lights||[]).filter(l=>l.range>0&&l.intensity>0).sort((a,b)=>Math.hypot(...sub(a.position,camera.eye))-Math.hypot(...sub(b.position,camera.eye))).slice(0,4);
 for(let i=0;i<4;i++){const l=lamps[i];g.uniform4fv(u['lamp'+i],l?[...l.position,l.range]:[0,0,0,0]);g.uniform3fv(u['power'+i],l?l.color.map(c=>c*l.intensity):[0,0,0])}}
 if(u.lighting){g.activeTexture(g.TEXTURE0+4);g.bindTexture(g.TEXTURE_2D,this.environment);g.uniform1i(u.lighting,4);g.uniform1f(u.hasIBL,+(this.environment!==this.white))}if(u.roadReflection){g.activeTexture(g.TEXTURE0+5);g.bindTexture(g.TEXTURE_2D,mirror||!state.roadReflect?this.white:this.reflectTex);g.uniform1i(u.roadReflection,5);g.uniform2f(u.framePixels,w,h);g.uniform1f(u.useReflection,+(!mirror&&!!state.roadReflect))}if(u.carContact)g.uniform3fv(u.carContact,state.carContact||[0,0,1]);if(u.clipZ)g.uniform2f(u.clipZ,...(state.clipZ||[1.00004,.06]));if(u.fogDensity)g.uniform1f(u.fogDensity,state.fogDensity??.0015);if(u.crop)g.uniform4fv(u.crop,crop);if(u.lens)g.uniform2f(u.lens,state.fov*aspect,state.fov);return u};
 const bind=(slot,t)=>{g.activeTexture(g.TEXTURE0+slot);g.bindTexture(g.TEXTURE_2D,t)};
 const draw=(shadow,pr=this.meshProgram,pass=0)=>{const u=setup(pr),a=pr.a;if(pr===this.forwardPlus)this.tileCache.bind(u,bind);if(pass)g.uniform1f(u.bufferIndex,pass);g.enable(g.DEPTH_TEST);g.uniform1f(u.shadowPass,+shadow);g.uniform1f(u.shadowSize,state.shadow);g.uniform1i(u.albedo,0);g.uniform1i(u.shadowTex,1);g.uniform1i(u.mrMap,2);g.uniform1i(u.normalMap,3);bind(1,shadow?this.white:this.shadow);
 const visible=shadow||this.culling===false?objects:objects.filter(o=>meshInFrustum(o,camera,state.fov,aspect));
 if(!shadow&&!mirror)for(const o of visible)if(o.records)this.stats.instances+=o.records.length/7;
 let uploadedRecords=null;const groups=[];for(const field of state.fields||[]){for(const batch of field.select(camera,state.fov,aspect,shadow,focus,state.budget??1)){groups.push({...batch,model:M.id()});if(!shadow&&!mirror)this.stats.instances+=batch.records.length/7}if(!shadow&&!mirror)this.stats.candidates+=field.tested}
 const opaque=[],transparent=[];for(const o of visible.concat(groups))for(const p of o.parts){if((shadow&&(p.mat.ground||p.mat.blend))||(mirror&&p.mat.ground))continue;
 if(p.mat.blend)transparent.push({p,o,z:dot(sub(M.point(o.model,p.center),camera.eye),camera.f)});else opaque.push({p,o})}
 transparent.sort((a,b)=>b.z-a.z);let blending=false;
 for(const {p,o} of opaque.concat(transparent)){if(p.mat.blend&&!blending){g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);g.depthMask(false);blending=true}
 g.uniform1f(u.alphaBlend,+!!p.mat.blend);g.uniformMatrix4fv(u.model,false,o.model);
 const mtx=o.model,A=mtx.slice(0,3),B=mtx.slice(4,7),C=mtx.slice(8,11),bc=cross(B,C),det=dot(A,bc),sign=det<0?-1:1;
 g.uniformMatrix3fv(u.normalFrame,false,[...bc,...cross(C,A),...cross(A,B)].map(n=>n*sign));g.bindBuffer(g.ARRAY_BUFFER,p.v);for(const [i,n,b] of [[a.p,3,0],[a.n,3,12],[a.uv,2,24]]){g.enableVertexAttribArray(i);g.vertexAttribPointer(i,n,g.FLOAT,false,32,b)}
 if(p.tangent){g.bindBuffer(g.ARRAY_BUFFER,p.tangent);g.enableVertexAttribArray(a.tangent);g.vertexAttribPointer(a.tangent,4,g.FLOAT,false,16,0)}else{g.disableVertexAttribArray(a.tangent);g.vertexAttrib4f(a.tangent,1,0,0,1)}
 const m=p.mat;g.uniform2f(u.coatLayer,m.coat||0,m.coatRough??.1);g.uniform3fv(u.emission,m.emissive||[0,0,0]);g.uniform1f(u.normalScale,m.normalScale??1);bind(2,p.mr);bind(3,p.normal);g.uniform4fv(u.tint,[...m.color.slice(0,3),m.color[3]??1]);g.uniform4fv(u.material,[m.metal,m.rough,m.kind||0,+!!m.normalImage]);g.uniform1f(u.cut,m.cut||0);bind(0,p.tex);g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,p.i);const count=o.records?o.records.length/7:1;
 const ext=this.instancing;
 if(o.records&&ext){g.bindBuffer(g.ARRAY_BUFFER,this.instanceBuffer);if(uploadedRecords!==o.records){g.bufferData(g.ARRAY_BUFFER,o.records,g.DYNAMIC_DRAW);uploadedRecords=o.records}
 for(const [loc,size,offset] of [[a.instancePos,4,0],[a.instanceTurn,3,16]]){g.enableVertexAttribArray(loc);g.vertexAttribPointer(loc,size,g.FLOAT,false,28,offset);ext.vertexAttribDivisorANGLE(loc,1)}
 ext.drawElementsInstancedANGLE(g.TRIANGLES,p.count,g.UNSIGNED_SHORT,0,count);
 for(const loc of [a.instancePos,a.instanceTurn]){ext.vertexAttribDivisorANGLE(loc,0);g.disableVertexAttribArray(loc)}
 }else{for(let k=0;k<count;k++){const r=o.records,j=k*7;
 if(r){g.vertexAttrib4f(a.instancePos,r[j],r[j+1],r[j+2],r[j+3]);g.vertexAttrib3f(a.instanceTurn,r[j+4],r[j+5],r[j+6])}
 else{g.vertexAttrib4f(a.instancePos,0,0,0,1);g.vertexAttrib3f(a.instanceTurn,1,0,1)}g.drawElements(g.TRIANGLES,p.count,g.UNSIGNED_SHORT,0)}}
 const calls=o.records&&!ext?count:1;if(shadow)this.stats.shadowCalls+=calls;else if(mirror)this.stats.reflectionCalls+=calls;else{this.stats.calls+=calls;this.stats.triangles+=p.count/3*count}
 }if(blending){g.depthMask(true);g.disable(g.BLEND)}
 for(const i of Object.values(a))g.disableVertexAttribArray(i)};
 if((objects.length||state.fields?.length)&&state.shadow&&refresh){this.shadowTarget(state.shadow);g.bindFramebuffer(g.FRAMEBUFFER,this.fb);g.viewport(0,0,state.shadow,state.shadow);g.clearColor(1,1,1,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);draw(true)}
 const background=()=>{g.disable(g.DEPTH_TEST);
 const u=setup(this.bg);g.uniform1f(u.clouds,state.clouds||0);g.uniform1f(u.planet,+state.planet);g.uniform1f(u.time,state.t);g.uniform1f(u.altRatio,state.alt||0);g.uniform1i(u.earth,0);bind(0,this.map);
 g.bindBuffer(g.ARRAY_BUFFER,this.quad);const i=this.bg.a.p;g.enableVertexAttribArray(i);g.vertexAttribPointer(i,2,g.FLOAT,false,0,0);g.drawArrays(g.TRIANGLES,0,3);g.disableVertexAttribArray(i);};
 if(state.roadReflect&&refresh){mirror=true;const original=camera,saved=crop;crop=[1,1,0,0];const flip=v=>[v[0],-v[1],v[2]];camera={eye:flip(original.eye),f:flip(original.f),r:flip(original.r),u:flip(original.u)};
 const rw=Math.min(state.roadReflect,1024),rh=Math.max(1,Math.round(rw/aspect));this.reflectTarget(rw,rh);g.viewport(0,0,rw,rh);g.clear(g.DEPTH_BUFFER_BIT);background();draw(false);camera=original;crop=saved;mirror=false}
 const deferred=state.deferred&&!state.planet&&!state.actor&&!state.roadReflect&&!(state.fields||[]).some(f=>[...f.near,...f.far].some(p=>p.mat.blend))&&crop[0]===1&&crop[1]===1&&!objects.some(o=>o.parts.some(p=>p.mat.blend));
 this.stats.pipeline=deferred?'deferred':'forward';
 if(deferred){
  this.deferred??=new DeferredPass(this);
  const tiles=this.lightsFor(state,camera,w,h);
  this.stats.lights=tiles.data.count;this.stats.tileOverflow=tiles.data.overflow;
  this.deferred.render(w,h,draw,setup,bind,background,this.quad,state.indirect,tiles);return
 }
 g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,w,h);g.clear(g.DEPTH_BUFFER_BIT);background();if(state.localCamera){camera=state.localCamera;light=state.localSun}if(objects.length||state.fields?.length){
  if(state.forwardPlus&&state.lights?.length&&!state.localCamera&&!state.actor&&crop[0]===1&&crop[1]===1){
   if(!this.forwardPlus){const start=fs2.indexOf(' if(lamp0.w>0.)'),end=fs2.indexOf(' if(coatLayer.x',start);
    this.forwardPlus=this.program(vs2,(fs2.slice(0,start)+' c+=tileLighting(wp,N,V,(1.-metal)*color,F0,rough);\n'+fs2.slice(end)).replace('uniform vec2 coatLayer;',tileShader.replace('i<32','i<8')+'\nuniform vec2 coatLayer;'))}
   const tiles=this.lightsFor(state,camera,w,h);
   this.stats.pipeline='forward+';this.stats.lights=tiles.data.count;draw(false,this.forwardPlus)
  }else draw(false)
 }if(state.actor){g.clear(g.DEPTH_BUFFER_BIT);objects=[{parts:state.actor.parts,model:M.id()}];camera=state.actor.camera;light=state.actor.sun;draw(false)}
 }
}
async function decodeImage(bytes){const url=URL.createObjectURL(new Blob([bytes]));try{const im=new Image();im.src=url;await im.decode();return im}finally{URL.revokeObjectURL(url)}}
