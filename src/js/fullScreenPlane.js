const hmr = require('../../lib/three-hmr')
const cache = hmr.cache(__filename)
const glslify = require('glslify')
// const EffectComposer = require('three-effectcomposer')(THREE);

const vertexShader = glslify('./shaders/fullScreenPlane/vertexShader.vert');
const fragmentShader = glslify('./shaders/fullScreenPlane/fragmentShader.frag');

let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;
let aspect = windowWidth / windowHeight;
let mesh;
let loader = new THREE.TextureLoader();
let textuer;

module.exports = class FullScreenPlane {
  constructor() { }

  create() {

    //Geometryを作成
    var geometry = new THREE.BufferGeometry();

    //頂点座標
    var vertices = new Float32Array([-1.0 * aspect, 1.0, 0.0, 1.0 * aspect, 1.0, 0.0, -1.0 * aspect, -1.0, 0.0, 1.0 * aspect, -1.0, 0.0]);

    //頂点インデックス
    var index = new Uint32Array([0, 2, 1, 1, 2, 3]);

    var uvs = new Float32Array([0.0, 1.0, //1つ目の頂点のUV座標
      1.0, 1.0, //2つ目の頂点のUV座標
      0.0, 0.0, //3つ目の頂点のUV座標
      1.0, 0.0 //4つ目の頂点のUV座標
    ]);

    //頂点座標
    geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
    //テクスチャ座標
    geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    //頂点のつなげ順
    geometry.setIndex(new THREE.BufferAttribute(index, 1));

    //読み込む素材
    var loadImg = windowWidth > windowHeight?'./src/assets/images/tx.jpg':'./src/assets/images/tx2.jpg';

    // Material作成
    let material = new THREE.ShaderMaterial({
      uniforms: {
        'textuer': {
          type: 't',
          value: loader.load(loadImg, function (tx) {
            tx.magFilter = THREE.NearestFilter;
            tx.minFilter = THREE.NearestFilter;
          })
        }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
    });
    // Mesh作成
    mesh = new THREE.Mesh(geometry, material);

    return mesh;
  }

};