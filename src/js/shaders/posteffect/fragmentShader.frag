#ifdef GL_ES
precision highp float;
#endif
 
uniform float time;
uniform vec2 resolution;
 
#define XSpeed 1.50
#define YSpeed 1.50
#define size 0.1
#define count 10.0
const float PI = 3.1415926535897932384626433832795;
uniform sampler2D tDiffuse;
varying vec2 vUv;


void main( void ) 
{
    //座標を正規化
    vec2 pos =(gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);;
    
    float c = 0.0;
    float rad = (PI*2.0) /count;

    for( float i = 1.0; i < count+1.0; ++i )
    {   
        //X軸の移動
        float px = cos( time * XSpeed * (i/count));

        //Y軸の移動　
        float py = sin( time * YSpeed  * (i/count));

        //circleの座標
        vec2 circlePos = vec2( px , py );

        //円のサイズを変更
        float d = size / length(pos - circlePos);

        //円のボケ幅を調整
        c += pow( d, 2.0 );
    }
 
   // gl_FragColor = vec4(vec3(c), 1.0 );
	gl_FragColor = texture2D(tDiffuse, vUv); 
 
}