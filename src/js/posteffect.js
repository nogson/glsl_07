const hmr = require('../../lib/three-hmr')
const cache = hmr.cache(__filename)
const glslify = require('glslify')
const EffectComposer = require('three-effectcomposer')(THREE);

const vertexShader = glslify('./shaders/posteffect/vertexShader.vert');
const fragmentShader = glslify('./shaders/posteffect/fragmentShader.frag');

let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;
let composer;
let dpr = window.devicePixelRatio;

module.exports = class PostEffect {
  constructor(app) {
    composer = new EffectComposer(app.renderer);
    composer.addPass(new EffectComposer.RenderPass(app.scene, app.camera));

    var myEffect = {
      uniforms: {
          'tDiffuse': {
            type: 't',
            value: null
          },
          'resolution':{
            type:'v2',
            value:new THREE.Vector2(windowWidth * dpr,windowHeight * dpr)
          },
          'time':{
            type:'f',
            value : 0.0
          }

      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
  }

    var effect = new EffectComposer.ShaderPass(myEffect)
    effect.renderToScreen = true;

    composer.addPass(effect);
  }

  getComposer(){
    return composer;
  }

  update(wh){
    //composer.passes[1].uniforms.resolution.value = wh;
  }
};

if (module.hot) {
  module.hot.accept(err => {
    if (err) throw errr
  })
  hmr.update(cache, {
    vertexShader,
    fragmentShader
  })
}