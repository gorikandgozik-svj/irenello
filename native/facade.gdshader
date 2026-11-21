shader_type spatial;
varying vec3 wp;
varying vec3 wn;
void vertex(){wp=(MODEL_MATRIX*vec4(VERTEX,1.)).xyz;wn=MODEL_NORMAL_MATRIX*NORMAL;}
void fragment(){
 vec2 p=vec2(abs(wn.x)>.5?wp.z:wp.x,wp.y);
 vec2 tile=fract(p/vec2(2.8,3.2));
 float glass=step(.13,tile.x)*step(tile.x,.88)*step(.21,tile.y)*step(tile.y,.88)*(1.-step(.6,abs(wn.y)));
 float lit=fract(sin(dot(floor(p/vec2(2.8,3.2)),vec2(14.37,68.23)))*4131.);
 ALBEDO=mix(vec3(.33,.31,.29),mix(vec3(.045,.10,.14),vec3(.16,.22,.26),lit),glass);
 ROUGHNESS=mix(.84,.19,glass);METALLIC=.32*glass;
 EMISSION=vec3(.52,.31,.14)*glass*smoothstep(.80,.93,lit);
}
