#ifdef GL_ES
precision mediump float;
#endif
#pragma glslify: pnoise = require(glsl-noise/periodic/3d)

uniform sampler2D textuer;
varying vec2 vUv;


void main(){
	gl_FragColor = texture2D(textuer, vUv); 
}