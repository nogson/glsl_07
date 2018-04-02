// global.THREE = require('three');

// const Stats = require('stats.js');
const glslify = require('glslify');
const createBackground = require('three-vignette-background');


const computeShaderVelocity = glslify('./src/js/shaders/computeShaderVelocity.frag');
const computeShaderPosition = glslify('./src/js/shaders/computeShaderPosition.frag');
const computeShaderReset = glslify('./src/js/shaders/restShader.frag');
const particleVertexShader = glslify('./src/js/shaders/particleVertexShader.vert');
const particleFragmentShader = glslify('./src/js/shaders/particleFragmentShader.frag');


if (!Detector.webgl) Detector.addGetWebGLMessage();
// 今回は25万パーティクルを動かすことに挑戦
// なので1辺が500のテクスチャを作る。
// 500 * 500 = 250000
const WIDTH = 50;
const PARTICLES = WIDTH * WIDTH;
const CLOCK = new THREE.Clock();


// メモリ負荷確認用
let stats;

// 基本セット
let container, camera, scene, renderer, geometry, controls;

// gpgpuをするために必要なオブジェクト達
let gpuCompute;
let velocityVariable;
let positionVariable;
let restVariable;
let positionUniforms;
let velocityUniforms;
let particleUniforms;
let effectController;
let time;
let mouse;

init();
animate();

function init() {


  // 一般的なThree.jsにおける定義部分
  container = document.createElement('div');
  document.body.appendChild(container);
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 15000);
  camera.position.y = 1;
  camera.position.z = -3;
  scene = new THREE.Scene();
  renderer = new THREE.WebGLRenderer();
  renderer.setClearColor(0xFFFFFF);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  stats = new Stats();
  container.appendChild(stats.dom);
  window.addEventListener('resize', onWindowResize, false);

  let background = createBackground({
    noiseAlpha: 0.1,
    colors: ['#FFFFFF', '#999999']
  });
  scene.add(background)

  //その他の初期値
  time = 0;
  mouse = new THREE.Vector2();

  // ①gpuCopute用のRenderを作る
  initComputeRenderer();

  // ②particle 初期化
  initPosition();

}


// ①gpuCopute用のRenderを作る
function initComputeRenderer() {

  // gpgpuオブジェクトのインスタンスを格納
  gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, renderer);

  // 今回はパーティクルの位置情報と、移動方向を保存するテクスチャを2つ用意します
  // new THREE.DataTextureを作ってる
  let dtPosition = gpuCompute.createTexture();
  let dtVelocity = gpuCompute.createTexture();


  // テクスチャにGPUで計算するために初期情報を埋めていく
  fillTextures(dtPosition, dtVelocity);

  // shaderプログラムのアタッチ
  velocityVariable = gpuCompute.addVariable("textureVelocity", computeShaderVelocity, dtVelocity);
  positionVariable = gpuCompute.addVariable("texturePosition", computeShaderPosition, dtPosition);

  //uniform変数を追加
  positionUniforms = positionVariable.material.uniforms;
  velocityUniforms = velocityVariable.material.uniforms;
  velocityUniforms.time = {
    value: time
  };
  positionUniforms.mouse = {
    value: mouse
  };

  positionUniforms.time = {
    value: time
  };


  // 一連の関係性を構築するためのおまじない
  gpuCompute.setVariableDependencies(velocityVariable, [positionVariable, velocityVariable]);
  gpuCompute.setVariableDependencies(positionVariable, [positionVariable, velocityVariable]);


  // error処理
  let error = gpuCompute.init();
  if (error !== null) {
    console.error(error);
  }
}


// ②パーティクルそのものの情報を決めていく。
function initPosition() {

  // 最終的に計算された結果を反映するためのオブジェクト。
  // 位置情報はShader側(texturePosition, textureVelocity)
  // で決定されるので、以下のように適当にうめちゃってOK

  geometry = new THREE.BufferGeometry();
  let positions = new Float32Array(PARTICLES * 3);
  let p = 0;
  for (let i = 0; i < PARTICLES; i++) {
    positions[p++] = 0;
    positions[p++] = 0;
    positions[p++] = 0;
  }

  // uv情報の決定。テクスチャから情報を取り出すときに必要
  let uvs = new Float32Array(PARTICLES * 2);
  p = 0;
  for (let j = 0; j < WIDTH; j++) {
    for (let i = 0; i < WIDTH; i++) {
      uvs[p++] = i / (WIDTH - 1);
      uvs[p++] = j / (WIDTH - 1);

    }
  }

  // attributeをgeometryに登録する
  geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));


  // uniform変数をオブジェクトで定義
  // 今回はカメラをマウスでいじれるように、計算に必要な情報もわたす。
  particleUniforms = {
    texturePosition: {
      value: null
    },
    textureVelocity: {
      value: null
    },
    cameraConstant: {
      value: getCameraConstant(camera)
    }
  };



  // Shaderマテリアル これはパーティクルそのものの描写に必要なシェーダー
  let material = new THREE.ShaderMaterial({
    uniforms: particleUniforms,
    vertexShader: particleVertexShader,
    fragmentShader: particleFragmentShader
  });
  //material.extensions.drawBuffers = true;
  let particles = new THREE.Points(geometry, material);
  particles.matrixAutoUpdate = false;
  //particles.updateMatrix();

  // パーティクルをシーンに追加
  scene.add(particles);
}

function fillTextures(texturePosition, textureVelocity) {


  // textureのイメージデータをいったん取り出す
  let posArray = texturePosition.image.data;
  let velArray = textureVelocity.image.data;

  // パーティクルの初期の位置は、ランダムなXZに平面おく。
  // 板状の正方形が描かれる
  let geometry = new THREE.SphereBufferGeometry(1, 32, 32);
  let pos = geometry.attributes.position.array;
  let pArr = [];
  for (let p = 0, pl = pos.length; p < pl; p += 3) {
    pArr.push([
      pos[p + 0],
      pos[p + 1],
      pos[p + 2]
    ]);
  }


  for (let k = 0, kl = posArray.length; k < kl; k += 4) {
    // Position
    let x, y, z;
    let randomPos = pArr[Math.floor(Math.random() * pArr.length)];
    // x = Math.random() * WIDTH - WIDTH/2;
    // z = Math.random() * WIDTH - WIDTH/2;
    // y = 0;
    // posArrayの実態は一次元配列なので
    // x,y,z,wの順番に埋めていく。
    // wは今回は使用しないが、配列の順番などを埋めておくといろいろ使えて便利
    posArray[k + 0] = randomPos[0];
    posArray[k + 1] = randomPos[1];
    posArray[k + 2] = randomPos[2];
    posArray[k + 3] = 0;

    // 移動する方向はとりあえずランダムに決めてみる。
    // これでランダムな方向にとぶパーティクルが出来上がるはず。
    velArray[k + 0] = Math.random() * 2 - 1;
    velArray[k + 1] = Math.random() * 2 - 1;
    velArray[k + 2] = Math.random() * 2 - 1;
    velArray[k + 3] = Math.random() * 2 - 1;
  }
}



// カメラオブジェクトからシェーダーに渡したい情報を引っ張ってくる関数
// カメラからパーティクルがどれだけ離れてるかを計算し、パーティクルの大きさを決定するため。
function getCameraConstant(camera) {
  return window.innerHeight / (Math.tan(THREE.Math.DEG2RAD * 0.5 * camera.fov) / camera.zoom);
}



// 画面がリサイズされたときの処理
// ここでもシェーダー側に情報を渡す。
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  particleUniforms.cameraConstant.value = getCameraConstant(camera);
}


function animate() {
  requestAnimationFrame(animate);
  render();
  stats.update();
}



function render() {

  // 計算用のテクスチャを更新
  gpuCompute.compute();

  //uniform変数を更新
  time = CLOCK.getElapsedTime();

  positionVariable.material.uniforms.time.value = time;
  velocityVariable.material.uniforms.time.value = time;


   // 計算した結果が格納されたテクスチャをレンダリング用のシェーダーに渡す
  particleUniforms.texturePosition.value = gpuCompute.getCurrentRenderTarget(positionVariable).texture;
  particleUniforms.textureVelocity.value = gpuCompute.getCurrentRenderTarget(velocityVariable).texture;
  renderer.render(scene, camera);
}


function restartSimulation() {
  var dtPosition = gpuCompute.createTexture();
  var dtVelocity = gpuCompute.createTexture();
  fillTextures( dtPosition, dtVelocity,mouse );
  gpuCompute.renderTexture( dtPosition, positionVariable.renderTargets[ 0 ] );
  gpuCompute.renderTexture( dtPosition, positionVariable.renderTargets[ 1 ] );
  gpuCompute.renderTexture( dtVelocity, velocityVariable.renderTargets[ 0 ] );
  gpuCompute.renderTexture( dtVelocity, velocityVariable.renderTargets[ 1 ] );
}



window.onmousedown = function (ev) {
  if (ev.target == renderer.domElement) {
    restartSimulation();
  }
}