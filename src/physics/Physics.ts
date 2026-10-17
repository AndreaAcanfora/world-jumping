import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export type Rapier = typeof RAPIER;

let ready: Promise<Rapier> | null = null;

/**
 * Rapier ships as WebAssembly (about 2 MB); it is loaded in its own chunk so the menu
 * shows right away, and initialised once before use.
 */
export function loadRapier(): Promise<Rapier> {
  ready ??= import('@dimforge/rapier3d-compat').then(async (m) => {
    const R = m.default;
    await R.init();
    return R;
  });
  return ready;
}

/**
 * The physics world. Gravity is zero: the player applies its own (see movement.ts),
 * level geometry is static and moving platforms are kinematic.
 */
export class Physics {
  readonly world: RAPIER.World;

  constructor(readonly R: Rapier) {
    this.world = new R.World({ x: 0, y: 0, z: 0 });
  }

  /** Static triangle-mesh collider matching an object's meshes exactly, in world space. */
  addStaticMesh(object: THREE.Object3D): RAPIER.Collider | null {
    object.updateWorldMatrix(true, true);
    const vertices: number[] = [];
    const indices: number[] = [];
    const v = new THREE.Vector3();
    object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const geo = mesh.geometry;
      const pos = geo.getAttribute('position');
      const base = vertices.length / 3;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        vertices.push(v.x, v.y, v.z);
      }
      if (geo.index) for (let i = 0; i < geo.index.count; i++) indices.push(base + geo.index.getX(i));
      else for (let i = 0; i < pos.count; i++) indices.push(base + i);
    });
    if (indices.length === 0) return null;
    const desc = this.R.ColliderDesc.trimesh(new Float32Array(vertices), new Uint32Array(indices));
    return this.world.createCollider(desc);
  }

  /** A kinematic box (moving platform), positioned by its bottom centre like Kenney models. */
  addKinematicBox(half: THREE.Vector3, centreOffset: THREE.Vector3, at: THREE.Vector3) {
    const body = this.world.createRigidBody(this.R.RigidBodyDesc.kinematicPositionBased().setTranslation(at.x, at.y, at.z));
    const collider = this.world.createCollider(
      this.R.ColliderDesc.cuboid(half.x, half.y, half.z).setTranslation(centreOffset.x, centreOffset.y, centreOffset.z),
      body,
    );
    return { body, collider };
  }

  step(dt: number): void {
    this.world.timestep = dt;
    this.world.step();
  }

  /** Distance along a ray to the nearest solid, or `max` if nothing is hit. */
  rayDistance(from: THREE.Vector3, dir: THREE.Vector3, max: number, exclude?: RAPIER.Collider): number {
    const ray = new this.R.Ray({ x: from.x, y: from.y, z: from.z }, { x: dir.x, y: dir.y, z: dir.z });
    const hit = this.world.castRay(ray, max, true, undefined, undefined, exclude);
    return hit ? hit.timeOfImpact : max;
  }

  dispose(): void {
    this.world.free();
  }
}
