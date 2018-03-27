#ifdef GL_ES
precision highp float;
#endif

#pragma glslify: cnoise3 = require(glsl-noise/classic/3d)

const float PI = 3.14159265;

#ifdef GL_ES
precision mediump float;
#endif
uniform sampler2D tData;
uniform vec2 resolution;
uniform float velocityMax;
uniform float time;
uniform float delta;

varying vec2 vUv;

void main() {
  vec4 particle = texture2D(tData, vUv);
  vec2 pPosition = particle.xy * resolution;
  vec2 pVelocity = particle.zw;
	
	vec3 seed = vec3(pPosition / resolution * 20.0, time );
	float forceAngleOffset = sin(time / 16.0) * .25;
  float forceAngle = (cnoise3(seed) + forceAngleOffset) * PI;
  vec2 force = vec2(cos(forceAngle*0.1), sin(forceAngle)) * .75;

  pVelocity += force;

  if (length(pVelocity) > velocityMax) {
    pVelocity = normalize(pVelocity) * velocityMax;
  }

  pPosition += pVelocity * delta;
  pPosition = mod(pPosition + resolution * .5, resolution) - resolution * .5;

  gl_FragColor = vec4(pPosition / resolution, pVelocity);
}

