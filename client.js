global.THREE = require('three');
const createBackground = require('three-vignette-background');
const Stats = require('stats.js');
const glslify = require('glslify');

const particlesVertex = glslify('./src/js/shaders/particles/vertexShader.vert');
const particlesFragment = glslify('./src/js/shaders/particles/fragmentShader.frag');
const simulationVertex = glslify('./src/js/shaders/simulation/vertexShader.vert');
const simulationFragment = glslify('./src/js/shaders/simulation/fragmentShader.frag');

const CAMERA_DEPTH = 1024;
const PARTICLE_COUNT = Math.pow(2, 14);
const PARTICLE_TEXTURE_SIZE = Math.sqrt(PARTICLE_COUNT);

let time = 0.0;

if (!THREE.Math.isPowerOfTwo(PARTICLE_TEXTURE_SIZE)) {
  throw new Error('Particle count should be a power of two.');
}

const RESOLUTION = new THREE.Vector2(
  window.innerWidth,
  window.innerHeight
);

const RESOLUTION_HALF = RESOLUTION.clone().multiplyScalar(0.5);



//基本設定
const renderer = new THREE.WebGLRenderer();
const scene = new THREE.Scene()

const camera = new THREE.OrthographicCamera(
  RESOLUTION_HALF.x * -1, //left 視線のどれぐらい左まで画面に入れるか。 
  RESOLUTION_HALF.x, //right 視線のどれぐらい右まで画面に入れるか。 
  RESOLUTION_HALF.y, //top 視線のどれぐらい上まで画面に入れるか。
  RESOLUTION_HALF.y * -1, //bottom 視線のどれぐらい下まで画面に入れるか。 
  1, //near
  CAMERA_DEPTH //far
);
camera.position.z = CAMERA_DEPTH / 2;

const body = document.getElementsByTagName('body')[0];

//renderer.setClearColorはしない
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setSize(RESOLUTION.x, RESOLUTION.y);

// canvasをbodyに追加
body.appendChild(renderer.domElement);


function getParticleData(particleCount, textureSize) {
  const data = new Float32Array(particleCount * 4);

  for (let i = 0; i < data.length; i += 4) {
    const position = new THREE.Vector2(
      Math.random() - 0.5,
      Math.random() - 0.5
    );

    data[i + 0] = position.x;
    data[i + 1] = position.y;
  }

  const texture = new THREE.DataTexture(
    data, textureSize, textureSize,
    THREE.RGBAFormat,
    THREE.FloatType,
    THREE.Texture.DEFAULT_MAPPING,
    THREE.RepeatWrapping,
    THREE.RepeatWrapping,
    THREE.NearestFilter,
    THREE.NearestFilter
  );

  texture.needsUpdate = true;

  return texture;
}


var renderTarget = new THREE.WebGLRenderTarget(
  PARTICLE_TEXTURE_SIZE,
  PARTICLE_TEXTURE_SIZE, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    type: THREE.FloatType,
    stencilBuffer: false,//ステンシルバッファをOFF
  }
);

const textureBuffers = new(function () {
  this.in = renderTarget;
  this.out = renderTarget.clone();

  this.swap = () => {
    [this.in, this.out] = [this.out, this.in];
  };
});




const SHADER_UNIFORMS_GLOBAL = {
  tData: {
    type: 't',
    value: getParticleData(PARTICLE_COUNT, PARTICLE_TEXTURE_SIZE)
  },
  resolution: {
    type: 'v2',
    value: RESOLUTION,
  },
  velocityMax: {
    type: 'f',
    value: Math.min(
      RESOLUTION.x,
      RESOLUTION.y
    ) * 0.125
  },
  colorBase: {
    type: 'c',
    value: new THREE.Color('hsl(245, 100%, 30%)'),
  },
  colorIntense: {
    type: 'c',
    value: new THREE.Color('hsl(15, 100%, 30%)'),
  },
  time: {
    type: 'f',
    value: 0,
  },
  delta: {
    type: 'f',
    value: 0,
  }
};

const rttScene = new THREE.Scene();
const rttGeometry = new THREE.PlaneGeometry(RESOLUTION.x, RESOLUTION.y, 1, 1);

const rttMaterial = new THREE.ShaderMaterial({
  uniforms: SHADER_UNIFORMS_GLOBAL,
  vertexShader: simulationVertex,
  fragmentShader: simulationFragment,
});

const rttPlane = new THREE.Mesh(rttGeometry, rttMaterial);
rttScene.add(rttPlane);
renderer.render(rttScene, camera, textureBuffers.out, true);

/**
 * Mutate and render GPU texture
 */

const vertices = new Float32Array(PARTICLE_COUNT * 3);


for (let i = 0; i < vertices.length; i++) {
  vertices[i] = 0;
}

const uvs = new Float32Array(PARTICLE_COUNT * 2);

for (let i = 0; i < uvs.length; i += 2) {
  const index = i / 2;
  uvs[i + 0] = (index % PARTICLE_TEXTURE_SIZE) / PARTICLE_TEXTURE_SIZE;
  uvs[i + 1] = Math.floor(index / PARTICLE_TEXTURE_SIZE) / PARTICLE_TEXTURE_SIZE;
}

const particleGeometry = new THREE.BufferGeometry();
particleGeometry.addAttribute(
  'position',
  new THREE.BufferAttribute(vertices, 3)
);
particleGeometry.addAttribute(
  'uv', 
  new THREE.BufferAttribute(uvs, 2)
);

const particleMaterial = new THREE.ShaderMaterial({
  uniforms: Object.assign({}, SHADER_UNIFORMS_GLOBAL, {
    tData: {
      type: 't',
      value: textureBuffers.in
    },
  }),

  vertexShader: particlesVertex,
  fragmentShader: particlesFragment,
  depthTest: false,
  transparent: true,
  blending: THREE.AdditiveBlending,
})


const particles = new THREE.Points(
  particleGeometry,
  particleMaterial
);

scene.add(particles);

const start = Date.now() / 1000;
let previous = start;

const render = () => {
  requestAnimationFrame(render);

  textureBuffers.swap();

  const now = Date.now() / 1000;
  const delta = now - previous;
  const elapsed = now - start;

  rttMaterial.uniforms.time.value = elapsed;
  rttMaterial.uniforms.delta.value = delta;

  rttMaterial.uniforms.tData.value = textureBuffers.in.texture;
  renderer.render(rttScene, camera, textureBuffers.out, true);

  particles.material.uniforms.time.value = elapsed;
  particles.material.uniforms.delta.value = delta;

  particles.material.uniforms.tData.value = textureBuffers.in.texture;
  renderer.render(scene, camera);

  previous = now;
};

render();
