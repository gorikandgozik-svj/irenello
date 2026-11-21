shader_type spatial;
varying vec2 p;
uniform sampler2D height_map : filter_linear, repeat_disable;
uniform float t=0.;
float wave(vec2 x){return texture(height_map,((x-vec2(508.,-352.))/vec2(200.,800.)*vec2(48.,96.)+.5)/vec2(49.,97.)).r+.48*sin(dot(x,vec2(.19,.10))-1.45*t)+.18*sin(dot(x,vec2(-.31,.21))-1.91*t);}
void vertex(){p=(MODEL_MATRIX*vec4(VERTEX,1.)).xz;VERTEX.y+=wave(p);}
void fragment(){
 vec2 d=vec2(wave(p+vec2(.05,0.))-wave(p-vec2(.05,0.)),wave(p+vec2(0.,.05))-wave(p-vec2(0.,.05)))/.1;
 NORMAL=normalize(mat3(VIEW_MATRIX)*vec3(-d.x,1.,-d.y));ROUGHNESS=.13;METALLIC=.28;ALBEDO=vec3(.025,.14,.18);
}
