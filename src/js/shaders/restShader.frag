#ifdef GL_ES
precision highp float;
#endif
#pragma glslify: cnoise2 = require(glsl-noise/classic/2d)
#pragma glslify: cnoise3 = require(glsl-noise/classic/3d)


uniform float time;
uniform vec2 mouse;

// For PI declaration:
// 現在の位置情報を決定する
#define delta ( 1.0 / 60.0 )
void main() {
   vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 tmpPos = texture2D( texturePosition, uv );
  vec3 pos = tmpPos.xyz + vec3(mouse,0.0);
  vec4 tmpVel = texture2D( textureVelocity, uv );
  // velが移動する方向(もう一つ下のcomputeShaderVelocityを参照)
  vec3 vel = tmpVel.xyz;

  float noise2 = cnoise2(uv);
  float noise3 = cnoise3(vel);
  float v = 1.0;
  if(noise3 > 0.5){
    v = -1.0;
  }
  

  // 移動する方向に速度を掛け合わせた数値を現在地に加える。
  float l = 1.0 - length(pos.xy /resolution.xy);
  pos += vel * (0.05 * noise3 * l + 0.1);

  gl_FragColor = vec4( pos, 1.0 );
}