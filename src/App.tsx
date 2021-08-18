import { useEffect } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
// import Stats from 'three/examples/jsm/libs/stats.module'
import AMCLoader from './loaders/amc_loader'
import ASFLoader from './loaders/asf_loader'

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

  const asfLoader = new ASFLoader()
  asfLoader.load('public/1234.asf').then((bones) => {
    mesh = createMesh(bones)
    scene.add(mesh)

    mixer = new THREE.AnimationMixer(mesh);
    //renderer.render(scene, camera);

    const amcLoader = new AMCLoader(bones, 'priman.amc')
    amcLoader.load('priman.amc').then((animation) => {
      // mixer.addAction(new THREE.AnimationAction(animation))
    })
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
