#ifdef GL_ES
precision highp float;
#endif

uniform vec2 resolution;

void main() {

  vec2 p = gl_FragCoord.xy/resolution;


  gl_FragColor = vec4(vec3(p,1.0), 1.0);
}


