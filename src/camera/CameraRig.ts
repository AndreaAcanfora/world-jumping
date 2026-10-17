import * as THREE from 'three';
import type { Physics } from '../physics/Physics';
import type RAPIER from '@dimforge/rapier3d-compat';

export type ViewMode = 'third' | 'first';

const EYE = 0.72;
const TARGET_HEIGHT = 0.9;
const DISTANCE = 5.5;
const MIN_PITCH = -0.9;
const MAX_PITCH = 1.2;

/**
 * Third person: orbits the player and pulls in when something is in the way.
 * First person: sits at eye height. `yaw` also defines what "forward" means for movement.
 */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.05, 400);
  mode: ViewMode = 'third';
  yaw = 0;
  pitch = 0.32;
  private distance = DISTANCE;
  private readonly target = new THREE.Vector3();
  private readonly look = new THREE.Vector3();

  constructor(
    private readonly physics: Physics,
    private readonly ignore: RAPIER.Collider,
  ) {}

  /** Horizontal forward direction (where the camera looks). */
  forward(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  rotate(dx: number, dy: number): void {
    this.yaw -= dx;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy, MIN_PITCH, MAX_PITCH);
  }

  /** Jump straight to the player (spawn, respawn). */
  snap(feet: THREE.Vector3, facing: number): void {
    this.yaw = facing;
    this.target.copy(feet).y += TARGET_HEIGHT;
    this.distance = DISTANCE;
  }

  update(feet: THREE.Vector3, dt: number, shake: THREE.Vector3): void {
    this.look.set(Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));

    if (this.mode === 'first') {
      this.camera.position.set(feet.x, feet.y + EYE, feet.z);
      this.camera.lookAt(this.camera.position.clone().add(this.look));
      return;
    }

    // Follow horizontally at once, vertically a little softer to hide small hops.
    const k = 1 - Math.exp(-dt * 10);
    this.target.x = feet.x;
    this.target.z = feet.z;
    this.target.y += (feet.y + TARGET_HEIGHT - this.target.y) * k;

    const back = this.look.clone().negate();
    const free = this.physics.rayDistance(this.target, back, DISTANCE + 0.3, this.ignore) - 0.3;
    const want = THREE.MathUtils.clamp(free, 0.8, DISTANCE);
    // Pull in instantly when blocked, ease back out.
    this.distance = want < this.distance ? want : this.distance + (want - this.distance) * Math.min(1, dt * 4);

    this.camera.position.copy(this.target).addScaledVector(back, this.distance).add(shake);
    this.camera.lookAt(this.target);
  }
}
