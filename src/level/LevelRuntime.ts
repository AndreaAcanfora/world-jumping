import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { instance } from '../assets/models';
import type { Physics } from '../physics/Physics';
import { NON_SOLID, boundsOf } from './reach';
import type { LevelDef, Mover, Piece, Vec3 } from './types';


const v3 = (a: Vec3) => new THREE.Vector3(a[0], a[1], a[2]);

export interface MoverRuntime {
  def: Mover;
  object: THREE.Object3D;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  position: THREE.Vector3;
  /** Movement during the last fixed step, used to carry the player. */
  delta: THREE.Vector3;
}

export interface Pickup {
  object: THREE.Object3D;
  position: THREE.Vector3;
  taken: boolean;
}

export interface Checkpoint extends Pickup {
  index: number;
}

export class LevelRuntime {
  readonly group = new THREE.Group();
  readonly movers: MoverRuntime[] = [];
  readonly coins: Pickup[] = [];
  readonly gems: Pickup[] = [];
  readonly springs: { object: THREE.Object3D; top: THREE.Vector3; squash: number }[] = [];
  readonly checkpoints: Checkpoint[] = [];
  flag!: THREE.Object3D;
  /** Column of light over the goal flag, so it can be found from far away. */
  private beam!: THREE.Mesh;
  private readonly moverByHandle = new Map<number, MoverRuntime>();

  private constructor(
    readonly def: LevelDef,
    private readonly physics: Physics,
  ) {}

  static async create(def: LevelDef, physics: Physics): Promise<LevelRuntime> {
    const level = new LevelRuntime(def, physics);
    await level.build();
    return level;
  }

  private readonly boxMaterials = new Map<number, THREE.MeshStandardMaterial>();

  /** Plain ground under an area: a box with its origin at the bottom centre, like Kenney models. */
  private box(p: Piece): THREE.Object3D {
    const [sx, sy, sz] = p.size ?? [1, 1, 1];
    const color = p.color ?? 0xb8693a;
    let material = this.boxMaterials.get(color);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true });
      this.boxMaterials.set(color, material);
    }
    const geometry = new THREE.BoxGeometry(sx, sy, sz);
    geometry.translate(0, sy / 2, 0);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(p.at[0], p.at[1], p.at[2]);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  private async place(model: string, at: Vec3, turns = 0, scale = 1): Promise<THREE.Object3D> {
    const { object } = await instance(model);
    object.position.set(at[0], at[1], at[2]);
    object.rotation.y = (turns * Math.PI) / 2;
    object.scale.setScalar(scale);
    this.group.add(object);
    return object;
  }

  private async build(): Promise<void> {
    const d = this.def;
    await Promise.all(
      d.pieces.map(async (p) => {
        const object = p.model === 'box' ? this.box(p) : await this.place(p.model, p.at, p.turns);
        if (!NON_SOLID.has(p.model)) this.physics.addStaticMesh(object);
      }),
    );

    for (const m of d.movers ?? []) {
      const object = await this.place(m.model, m.from);
      const b = boundsOf(m.model);
      const half = new THREE.Vector3((b.max[0]! - b.min[0]!) / 2, (b.max[1]! - b.min[1]!) / 2, (b.max[2]! - b.min[2]!) / 2);
      const offset = new THREE.Vector3((b.max[0]! + b.min[0]!) / 2, (b.max[1]! + b.min[1]!) / 2, (b.max[2]! + b.min[2]!) / 2);
      const { body, collider } = this.physics.addKinematicBox(half, offset, v3(m.from));
      const runtime: MoverRuntime = { def: m, object, body, collider, position: v3(m.from), delta: new THREE.Vector3() };
      this.movers.push(runtime);
      this.moverByHandle.set(collider.handle, runtime);
    }

    for (const s of d.springs ?? []) {
      // Springs are not solid: stepping on one launches you (see Player).
      const object = await this.place('spring', s);
      this.springs.push({ object, top: v3(s).add(new THREE.Vector3(0, boundsOf('spring').max[1]!, 0)), squash: 0 });
    }

    for (const c of d.coins ?? []) this.coins.push({ object: await this.place('coin-gold', c, 0, 0.9), position: v3(c), taken: false });
    for (const g of d.gems ?? []) {
      const object = await this.place('jewel', g, 0, 1.6);
      object.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
          mat.emissive = new THREE.Color(0x66ccff);
          mat.emissiveIntensity = 0.6;
          mesh.material = mat;
        }
      });
      this.gems.push({ object, position: v3(g), taken: false });
    }
    for (const [index, c] of (d.checkpoints ?? []).entries()) {
      this.checkpoints.push({ object: await this.place('flag', c, 1, 1.1), position: v3(c), taken: false, index });
    }
    this.flag = await this.place('flag', d.flag, 1, 2.4);
    const beamHeight = 40;
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.6, beamHeight, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffc83d, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    this.beam.position.set(d.flag[0], d.flag[1] + beamHeight / 2, d.flag[2]);
    this.group.add(this.beam);
  }

  /** Position of a moving platform at time `t` (eased back and forth). */
  static moverAt(m: Mover, t: number, out = new THREE.Vector3()): THREE.Vector3 {
    const s = (1 - Math.cos(2 * Math.PI * (t / m.period + (m.phase ?? 0)))) / 2;
    return out.set(m.from[0] + (m.to[0] - m.from[0]) * s, m.from[1] + (m.to[1] - m.from[1]) * s, m.from[2] + (m.to[2] - m.from[2]) * s);
  }

  /** Advances moving platforms to time `t` (fixed step). */
  fixedUpdate(t: number): void {
    const next = new THREE.Vector3();
    for (const m of this.movers) {
      LevelRuntime.moverAt(m.def, t, next);
      m.delta.subVectors(next, m.position);
      m.position.copy(next);
      m.body.setNextKinematicTranslation({ x: next.x, y: next.y, z: next.z });
    }
  }

  mover(collider: RAPIER.Collider | null): MoverRuntime | undefined {
    return collider ? this.moverByHandle.get(collider.handle) : undefined;
  }

  /** Visual-only animation: spinning pickups, springs relaxing, platforms following their bodies. */
  render(time: number, dt: number): void {
    for (const m of this.movers) m.object.position.copy(m.position);
    for (const c of this.coins) if (!c.taken) c.object.rotation.y = time * 3;
    for (const g of this.gems) {
      if (g.taken) continue;
      g.object.rotation.y = time * 1.5;
      g.object.position.y = g.position.y + Math.sin(time * 2) * 0.08;
    }
    for (const s of this.springs) {
      s.squash = Math.max(0, s.squash - dt * 4);
      s.object.scale.y = 1 + s.squash * 0.8;
    }
    this.flag.rotation.y = Math.PI / 2 + Math.sin(time * 1.3) * 0.15;
    (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(time * 2.5) * 0.12;
  }

  take(p: Pickup): void {
    p.taken = true;
    p.object.visible = false;
  }
}
