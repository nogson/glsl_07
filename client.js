global.THREE = require('three');
const createBackground = require('three-vignette-background');
const Stats = require('stats.js');
const glslify = require('glslify')

const particlesVertex = glslify('./src/js/shaders/particles/vertexShader.vert');
const particlesFragment = glslify('./src/js/shaders/particles/fragmentShader.frag');
const simulationVertex = glslify('./src/js/shaders/simulation/vertexShader.vert');
const simulationFragment = glslify('./src/js/shaders/simulation/fragmentShader.frag');

const CAMERA_DEPTH = 1024;
const PARTICLE_COUNT = Math.pow(2, 20);
const PARTICLE_TEXTURE_SIZE = Math.sqrt(PARTICLE_COUNT);

let time = 0.0;
const WW = window.innerWidth;
let WH = window.innerHeight;
let ASPECT = WW / WH;

if (!THREE.Math.isPowerOfTwo(PARTICLE_TEXTURE_SIZE)) {
  throw new Error('Particle count should be a power of two.');
}

const PARTICLE_TEXTURE_RESOLUTION = new THREE.Vector2(
  window.innerWidth,
  window.innerHeight
);
const PARTICLE_TEXTURE_RESOLUTION_HALF = PARTICLE_TEXTURE_RESOLUTION.clone().multiplyScalar(0.5);

const SHADER_UNIFORMS_GLOBAL = {
  resolution: {
    type:'v2',
    value: PARTICLE_TEXTURE_RESOLUTION,
  },
  velocityMax: {
    type:'f',
    value: Math.min(
			PARTICLE_TEXTURE_RESOLUTION.x,
			PARTICLE_TEXTURE_RESOLUTION.y
		) * 0.125
  },
  colorBase: {
    type:'c',
    value: new THREE.Color('hsl(245, 100%, 30%)'),
  },
  colorIntense: {
    type:'c',
    value: new THREE.Color('hsl(15, 100%, 30%)'),
  },
  time: {
    type:'f',
    value: 0,
  },
  delta: {
    type:'f',
    value: 0,
  }
};

// const camera = new THREE.OrthographicCamera(
//   -PARTICLE_TEXTURE_RESOLUTION_HALF.x,
//   PARTICLE_TEXTURE_RESOLUTION_HALF.x,
//   PARTICLE_TEXTURE_RESOLUTION_HALF.y,
//   -PARTICLE_TEXTURE_RESOLUTION_HALF.y,
//   1,
//   CAMERA_DEPTH
// );
// camera.position.z = CAMERA_DEPTH / 2;

// const renderer = new THREE.WebGLRenderer();


const app = {
  renderer: new THREE.WebGLRenderer(),
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(60, WW / WH, 0.1, CAMERA_DEPTH)
};
const body = document.getElementsByTagName('body')[0];

//app.renderer.setClearColor(new THREE.Color(0xffffff), 1.0);
app.renderer.setPixelRatio(window.devicePixelRatio || 1);
app.renderer.setSize(PARTICLE_TEXTURE_RESOLUTION.x, PARTICLE_TEXTURE_RESOLUTION.y);

// canvasをbodyに追加
body.appendChild(app.renderer.domElement);

app.camera.position.z = CAMERA_DEPTH / 2;


function getParticleData(particleCount, textureSize) {
  const data = new Float32Array(particleCount * 4);
  const getRandomValue = () => Math.random() - 0.5;
  
  for (let i = 0; i < data.length; i += 4) {
    const position = new THREE.Vector2(
      getRandomValue(),
      getRandomValue()
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

function getPlane(size) {
  const geometry = new THREE.PlaneGeometry(size.x, size.y, 1, 1);
  const material = new THREE.MeshBasicMaterial();
  
  return new THREE.Mesh(geometry, material);
}


  






/**
 * Prepare tools to render to texture
 */

var renderTarget = new THREE.WebGLRenderTarget(
  PARTICLE_TEXTURE_SIZE,
  PARTICLE_TEXTURE_SIZE,
  {
		wrapS: THREE.ClampToEdgeWrapping,
		wrapT: THREE.ClampToEdgeWrapping,
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBAFormat,
		type: THREE.FloatType,
		stencilBuffer: false,
	}
);

const textureBuffers = new (function () {
  this.in = renderTarget;
  this.out = renderTarget.clone();
  
  this.swap = () => {
    [this.in, this.out] = [this.out, this.in];
  };
});

const rttScene = new THREE.Scene();
const rttPlane = getPlane(PARTICLE_TEXTURE_RESOLUTION);
rttScene.add(rttPlane);

const renderToTexture = (shader, inTexture, outTexture) => {
	console.log(shader,inTexture);
	
  rttPlane.material = shader;
  rttPlane.material.uniforms.tData.value = inTexture;
  app.renderer.render(rttScene, camera, outTexture, true);
};

/**
 * Create and mutate base data
 */

// const SHADER_PART_NOISE = document.getElementById('shader-noise-perlin').textContent;

const baseData = getParticleData(
  PARTICLE_COUNT,
  PARTICLE_TEXTURE_SIZE
);
const simulationShader = new THREE.ShaderMaterial({
  uniforms: Object.assign({}, SHADER_UNIFORMS_GLOBAL, {
    tData: { 
      type:'t',
      value: baseData
     },
  }),
  vertexShader: simulationVertex,
  fragmentShader: simulationFragment,
});

rttPlane.material = simulationShader;
app.renderer.render(rttScene, app.camera, textureBuffers.out, true);

/**
 * Mutate and render GPU texture
 */

const vertices = new Float32Array(PARTICLE_COUNT * 3);


for (let i = 0; i < vertices.length; i++) {
  vertices[i] = Math.random();
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
particleGeometry.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));

const particles = new THREE.Points(
  particleGeometry,
  new THREE.ShaderMaterial({
    uniforms: Object.assign({}, SHADER_UNIFORMS_GLOBAL, {
    tData: { 
      type:'t',
      value: textureBuffers.in 
    },
  }),
    
    vertexShader: particlesVertex,
    fragmentShader: particlesFragment,
    depthTest: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
  })
);

const scene = new THREE.Scene();
scene.add(particles);

const start = Date.now() / 1000;
let previous = start;

const render = () => {
  requestAnimationFrame(render);
  
  textureBuffers.swap();
  
  const now = Date.now() / 1000;
  const delta = now - previous;
  const elapsed = now - start;
  
  simulationShader.uniforms.time.value = elapsed;
  simulationShader.uniforms.delta.value = delta;
  
  simulationShader.uniforms.tData.value = textureBuffers.in.texture;
  app.renderer.render(rttScene, app.camera, textureBuffers.out, true);
  
  particles.material.uniforms.time.value = elapsed;
  particles.material.uniforms.delta.value = delta;
  
  particles.material.uniforms.tData.value = textureBuffers.in.texture;
  app.renderer.render(scene, app.camera);
  
  previous = now;
};

render();
//document.body.appendChild(renderer.domElement);