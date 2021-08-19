import { useEffect } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader'

// import Stats from 'three/examples/jsm/libs/stats.module'

function setup() {
  const { innerWidth: w, innerHeight: h } = window

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
  camera.position.z = 30;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(w, h);
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera)
  controls.target.set(0, 0, 0)
  controls.update()

  let skeletonHelper: THREE.SkeletonHelper

  function createMesh(bones: any) {
    const skeleton = new THREE.Skeleton(bones)
    const geometry = new THREE.BufferGeometry()

    const mesh = new THREE.SkinnedMesh(geometry)
    mesh.add(skeleton.bones[0])
    mesh.bind(skeleton)

    skeletonHelper = new THREE.SkeletonHelper(skeleton.bones[0])
    // skeletonHelper.material.linewidth = 2
    scene.add(skeletonHelper)

    return mesh
  }

  let mixer: THREE.AnimationMixer
  let mesh: THREE.Mesh

  const loader = new BVHLoader()
  loader.load('bvh/01/01_bvh', (result) => {

    skeletonHelper = new THREE.SkeletonHelper( result.skeleton.bones[ 0 ] );
    //@ts-expect-error
    skeletonHelper.skeleton = result.skeleton; // allow animation mixer to bind to THREE.SkeletonHelper directly

    const boneContainer = new THREE.Group();
    boneContainer.add( result.skeleton.bones[ 0 ] );

    scene.add( skeletonHelper );
    scene.add( boneContainer );

    // play animation
    mixer = new THREE.AnimationMixer( skeletonHelper );
    mixer.clipAction( result.clip ).setEffectiveWeight( 1.0 ).play();
  })

  /*
  const stats = new Stats()
  stats.domElement.style.position = 'absolute'
  stats.domElement.style.top = '0px'
  document.body.appendChild(stats.domElement)
  */

  const clock = new THREE.Clock()

  return function render() {
    const delta = clock.getDelta()
    
    if (mixer) {
      mixer.update(delta)
      skeletonHelper.update()
    }

    renderer.render(scene, camera)
    // stats.update()

    requestAnimationFrame(render)
  }
}

export default function App() {
  useEffect(() => {
    const render = setup()
    render()
  }, [])

  return (
    <div />
  );
}
