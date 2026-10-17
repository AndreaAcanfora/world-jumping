import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();

export const modelUrl = (name: string): string => `${import.meta.env.BASE_URL}assets/kenney/${name}.glb`;

/** Loads a Kenney Platformer Kit model once; later calls share the same promise. */
export function loadModel(name: string): Promise<GLTF> {
  let p = cache.get(name);
  if (!p) {
    p = loader.loadAsync(modelUrl(name));
    cache.set(name, p);
  }
  return p;
}

export async function preload(names: Iterable<string>, onProgress?: (done: number, total: number) => void): Promise<void> {
  const list = [...new Set(names)];
  let done = 0;
  await Promise.all(
    list.map(async (n) => {
      await loadModel(n);
      onProgress?.(++done, list.length);
    }),
  );
}

/** A fresh copy of a model, with shadows on. Skinned models get their own skeleton. */
export async function instance(name: string): Promise<{ object: THREE.Object3D; clips: THREE.AnimationClip[] }> {
  const gltf = await loadModel(name);
  const object = SkeletonUtils.clone(gltf.scene);
  object.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { object, clips: gltf.animations };
}
