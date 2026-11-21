function compileProgram(v,f){
  const gl=this.gl,p=gl.createProgram(),u={},a={};
  for(const [type,source] of [[gl.VERTEX_SHADER,v],[gl.FRAGMENT_SHADER,f]]){
   const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
   if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);gl.deleteShader(s)}
  gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
  for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i++){let name=gl.getActiveUniform(p,i).name;u[name]=gl.getUniformLocation(p,name)}
  for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_ATTRIBUTES);i++){let name=gl.getActiveAttrib(p,i).name;a[name]=gl.getAttribLocation(p,name)}
  return {p,u,a}
 }
