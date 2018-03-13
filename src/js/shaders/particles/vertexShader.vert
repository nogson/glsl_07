uniform sampler2D tData;
uniform vec2 resolution;

varying vec2 vUv;

void main() {
  vUv = uv;

  vec2 pPosition = texture2D(tData, vUv).rg * resolution;

  gl_PointSize = 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pPosition, 1.0, 1.0);
}