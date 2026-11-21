"""Replay WebGL commands in a surfaceless Mesa GLES context. Requires Pillow and libEGL."""
import ctypes as C,json,sys,time,hashlib
from pathlib import Path
from PIL import Image
root=Path(sys.argv[1]);G=C.CDLL('libEGL.so.1');P=C.c_void_p;I=C.c_int;U=C.c_uint;F=C.c_float;S=C.c_char_p;B=C.c_ubyte
def egl(name,R,*A):
 fn=getattr(G,name);fn.restype=R;fn.argtypes=A;return fn
def ints(a):return (I*len(a))(*a)
d=egl('eglGetPlatformDisplay',P,U,P,P)(0x31dd,None,None)
assert egl('eglInitialize',I,P,P,P)(d,None,None)
cfg=P();count=I();assert egl('eglChooseConfig',I,P,P,P,I,P)(d,ints([0x3033,1,0x3040,0x40,0x3024,8,0x3023,8,0x3022,8,0x3025,24,0x3038]),C.byref(cfg),1,C.byref(count)) and count.value
surface=egl('eglCreatePbufferSurface',P,P,P,P)(d,cfg,ints([0x3057,3840,0x3056,2160,0x3038]))
ctx=egl('eglCreateContext',P,P,P,P,P)(d,cfg,None,ints([0x3098,3,0x3038]));assert egl('eglMakeCurrent',I,P,P,P,P)(d,surface,surface,ctx)
proc=egl('eglGetProcAddress',P,S);cache={}
def call(k,A,a,R=None):
 if k not in cache:cache[k]=C.CFUNCTYPE(R,*A)(proc(('gl'+k[0].upper()+k[1:]).encode()))
 return cache[k](*a)
print(call('getString',[U],[0x1f01],S))
ids={None:0};big=Image.new("RGB",(6144,3456))
sig={'generateMipmap':'u','attachShader':'uu','deleteShader':'u','compileShader':'u','linkProgram':'u','bindBuffer':'uu','bindTexture':'uu','bindFramebuffer':'uu','bindRenderbuffer':'uu','texParameteri':'uui','renderbufferStorage':'uuii','framebufferTexture2D':'uuuui','framebufferRenderbuffer':'uuuu','viewport':'iiii','clear':'u','useProgram':'u','uniform2f':'iff','uniform1f':'if','disable':'u','enable':'u','enableVertexAttribArray':'u','disableVertexAttribArray':'u','vertexAttribPointer':'uiubip','drawArrays':'uii','drawElements':'uiup','texImage2D':'uiiiiiuup','vertexAttrib4f':'uffff','vertexAttrib3f':'ufff','activeTexture':'u','uniform1i':'ii','clearColor':'ffff','blendFunc':'uu','depthMask':'b','vertexAttribDivisor':'uu','drawElementsInstanced':'uiupi'}
mapped={'attachShader':[0,1],'deleteShader':[0],'compileShader':[0],'linkProgram':[0],'bindBuffer':[1],'bindTexture':[1],'bindFramebuffer':[1],'bindRenderbuffer':[1],'framebufferTexture2D':[3],'framebufferRenderbuffer':[3],'useProgram':[0],'enableVertexAttribArray':[0],'disableVertexAttribArray':[0],'vertexAttribPointer':[0],'vertexAttrib4f':[0],'vertexAttrib3f':[0],'vertexAttribDivisor':[0]}
for k,id,*a in json.loads((root/'ops.json').read_text()):
 if k=='begin':call('finish',[],[]);start=time.perf_counter()
 elif k=='end':call('finish',[],[]);print('Frame ms (driver replay):',round((time.perf_counter()-start)*1000,1))
 elif k=='tile':
  x,y,w,h=a;raw=C.create_string_buffer(w*h*4);call('readPixels',[I,I,I,I,U,U,P],[0,0,w,h,6408,5121,raw]);im=Image.frombytes('RGBA',(w,h),raw.raw).transpose(Image.Transpose.FLIP_TOP_BOTTOM);big.paste(im,(x,y))
  if x+w==6144 and y+h==3456:big.save(root/'race6k.jpg',quality=96)
 elif k=='save':
  name,w,h=a;raw=C.create_string_buffer(w*h*4);call('readPixels',[I,I,I,I,U,U,P],[0,0,w,h,6408,5121,raw]);im=Image.frombytes('RGBA',(w,h),raw.raw).transpose(Image.Transpose.FLIP_TOP_BOTTOM).convert('RGB');im.save(root/(name+'.jpg'),quality=96);print('saved',name,'RGBA SHA256',hashlib.sha256(raw.raw).hexdigest())
 elif k in ('createShader','createProgram'):ids[id]=call(k,[U]*len(a),a,U)
 elif k.startswith('create'):
  v=U();call('gen'+k[6:]+'s',[I,P],[1,C.byref(v)]);ids[id]=v.value
 elif k in ('deleteBuffer','deleteTexture','deleteFramebuffer','deleteRenderbuffer'):
  item=U(ids[a[0]]);call(k+'s',[I,P],[1,C.byref(item)])
 elif k=='drawBuffers':call(k,[I,P],[len(a[0]),ints(a[0])])
 elif k=='shaderSource':
  ptr=S(a[1].encode());call(k,[U,I,P,P],[ids[a[0]],1,C.byref(ptr),None])
 elif k.startswith('get'):ids[id]=call(k,[U,S],[ids[a[0]],a[1].encode()],I)
 elif k=='bufferData':
  data=(root/a[1]).read_bytes();call(k,[U,C.c_ssize_t,P,U],[a[0],len(data),data,a[2]])
 elif k.startswith('uniformMatrix'):
  data=a[2];call(k,[I,I,B,P],[ids[a[0]],1,0,(F*len(data))(*data)])
 elif k in ('uniform3fv','uniform4fv'):
  data=a[1];call(k,[I,I,P],[ids[a[0]],1,(F*len(data))(*data)])
 else:
  if k=='texImage2D' and len(a)==6:
   im=Image.open(root/a[5]).convert('RGBA');a=[a[0],0,a[2],im.width,im.height,0,a[3],a[4],im.tobytes()]
  if k=='texImage2D' and isinstance(a[-1],str):a[-1]=(root/a[-1]).read_bytes()
  if k=='texImage2D' and isinstance(a[-1],dict):a[-1]=bytes(a[-1].values())
  for i in mapped.get(k,[0] if k.startswith('uniform') else []):a[i]=ids[a[i]]
  call(k,[{'i':I,'u':U,'p':P,'f':F,'b':B}[x] for x in sig[k]],a)
  if k in ('compileShader','linkProgram'):
   name='Shader' if k=='compileShader' else 'Program';ok=I();call('get'+name+'iv',[U,U,P],[a[0],35713 if name=='Shader' else 35714,C.byref(ok)])
   if not ok.value:
    log=C.create_string_buffer(4096);call('get'+name+'InfoLog',[U,I,P,P],[a[0],4096,None,log]);raise RuntimeError(log.value)
 err=call('getError',[],[],U)
 if err:raise RuntimeError(k,hex(err))
