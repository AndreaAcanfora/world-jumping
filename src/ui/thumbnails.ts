import * as THREE from 'three';
import { instance } from '../assets/models';

/** Renders a character model to a small transparent image for the selection screen. */
export async function characterThumbnail(model: string, size = 180): Promise<string> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x88aa77, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(2, 3, 4);
  scene.add(sun);
  const { object } = await instance(model);
  object.rotation.y = -0.45;
  scene.add(object);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 0.62, 2.3);
  camera.lookAt(0, 0.45, 0);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  renderer.dispose();
  renderer.forceContextLoss();
  return url;
}
