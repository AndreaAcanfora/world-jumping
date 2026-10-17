import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { instance } from '../assets/models';
import type { LevelRuntime, MoverRuntime } from '../level/LevelRuntime';
import type { Physics } from '../physics/Physics';
import { TUNING, newMoveState, stepMovement } from './movement';
import type { MoveEvent, MoveInput, MoveState } from './movement';

const RADIUS = 0.25;
const HALF_HEIGHT = 0.2;
/** Capsule centre above the feet. */
const CENTRE = HALF_HEIGHT + RADIUS;

export type PlayerEvent = MoveEvent | 'land' | 'spring';

export const CHARACTERS = ['character-oobi', 'character-oodi', 'character-ooli', 'character-oopi', 'character-oozi'] as const;
export type CharacterModel = (typeof CHARACTERS)[number];

type AnimName = 'idle' | 'walk' | 'sprint' | 'jump' | 'fall' | 'emote-yes' | 'die';

export class Player {
  state: MoveState;
  grounded = false;
  readonly feet = new THREE.Vector3();
  private readonly prevFeet = new THREE.Vector3();
  readonly visual = new THREE.Group();
  private ground: MoverRuntime | undefined;
  private mixer!: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private anim: AnimName | null = null;
  private visualFacing = 0;
  /** Set when the level is won: the character cheers instead of moving. */
  celebrating = false;

  private constructor(
    private readonly physics: Physics,
    private readonly body: RAPIER.RigidBody,
    readonly collider: RAPIER.Collider,
    private readonly controller: RAPIER.KinematicCharacterController,
    abilities: { dashes: number; fuel: number },
  ) {
    this.state = newMoveState(abilities);
  }

  static async create(physics: Physics, model: CharacterModel, spawn: THREE.Vector3, abilities: { dashes: number; fuel: number }) {
    const R = physics.R;
    const body = physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y + CENTRE, spawn.z));
    const collider = physics.world.createCollider(R.ColliderDesc.capsule(HALF_HEIGHT, RADIUS), body);
    const controller = physics.world.createCharacterController(0.02);
    controller.setUp({ x: 0, y: 1, z: 0 });
    controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    controller.setMinSlopeSlideAngle((55 * Math.PI) / 180);
    controller.enableSnapToGround(0.25);
    controller.enableAutostep(0.22, 0.15, false);
    controller.setApplyImpulsesToDynamicBodies(false);

    const player = new Player(physics, body, collider, controller, abilities);
    player.feet.copy(spawn);
    player.prevFeet.copy(spawn);

    const { object, clips } = await instance(model);
    player.visual.add(object);
    player.mixer = new THREE.AnimationMixer(object);
    for (const clip of clips) player.actions.set(clip.name, player.mixer.clipAction(clip));
    player.play('idle');
    return player;
  }

  fixedUpdate(dt: number, input: MoveInput, level: LevelRuntime): PlayerEvent[] {
    this.prevFeet.copy(this.feet);
    const wasGrounded = this.grounded;
    const fallSpeed = this.state.vel.y;

    const step = stepMovement(this.state, this.celebrating ? NO_INPUT : input, this.grounded, dt);
    this.state = step.state;
    const events: PlayerEvent[] = [...step.events];

    // Ride the platform under our feet: it already moved this step, so follow it. Found
    // with a short ray, because standing still produces no contacts to read it from.
    const probe = this.feet.clone().setY(this.feet.y + 0.1);
    const below = this.state.vel.y <= 0.5 ? this.physics.rayHit(probe, DOWN, 0.45, this.collider) : null;
    this.ground = below ? level.mover(below.collider) : undefined;
    const carry = this.ground ? this.ground.delta : ZERO;
    const desired = {
      x: this.state.vel.x * dt + carry.x,
      y: this.state.vel.y * dt + carry.y,
      z: this.state.vel.z * dt + carry.z,
    };
    this.controller.computeColliderMovement(this.collider, desired);
    const moved = this.controller.computedMovement();
    this.grounded = this.controller.computedGrounded();

    for (let i = 0; i < this.controller.numComputedCollisions(); i++) {
      const c = this.controller.computedCollision(i);
      if (!c) continue;
      // Bumped our head: stop rising.
      if (c.normal1.y < -0.5 && this.state.vel.y > 0) this.state.vel.y = 0;
    }

    const t = this.body.translation();
    const next = { x: t.x + moved.x, y: t.y + moved.y, z: t.z + moved.z };
    this.body.setTranslation(next, true);
    this.feet.set(next.x, next.y - CENTRE, next.z);

    // The character controller can lose contact for a frame on uneven tops (the grass lip
    // of Kenney blocks). A short probe under the feet keeps the player grounded there, so
    // a jump pressed at that moment is never swallowed.
    if (!this.grounded && this.state.vel.y <= 0.5) {
      const probe = this.feet.clone().setY(this.feet.y + 0.1);
      if (this.physics.rayDistance(probe, DOWN, 0.3, this.collider) < 0.22) this.grounded = true;
    }

    if (!wasGrounded && this.grounded && fallSpeed < -6) events.push('land');

    if (this.grounded && this.state.vel.y <= 0) {
      for (const s of level.springs) {
        const onTop = Math.hypot(this.feet.x - s.top.x, this.feet.z - s.top.z) < 0.45 && this.feet.y > s.top.y - 0.45 && this.feet.y < s.top.y + 0.2;
        if (!onTop) continue;
        this.state = { ...this.state, vel: { ...this.state.vel, y: TUNING.springVelocity }, rising: false, coyote: 0 };
        s.squash = 1;
        events.push('spring');
        break;
      }
    }
    return events;
  }

  respawn(at: THREE.Vector3, abilities: { dashes: number; fuel: number }): void {
    this.body.setTranslation({ x: at.x, y: at.y + CENTRE, z: at.z }, true);
    this.feet.copy(at);
    this.prevFeet.copy(at);
    this.state = { ...newMoveState(abilities), facing: this.state.facing };
    this.grounded = false;
    this.ground = undefined;
  }

  /** Interpolated position for rendering between fixed steps. */
  renderPosition(alpha: number, out = new THREE.Vector3()): THREE.Vector3 {
    return out.lerpVectors(this.prevFeet, this.feet, alpha);
  }

  render(alpha: number, dt: number): void {
    this.renderPosition(alpha, this.visual.position);
    // Turn smoothly towards the facing direction.
    let diff = this.state.facing - this.visualFacing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.visualFacing += diff * Math.min(1, dt * 14);
    this.visual.rotation.y = this.visualFacing;

    const speed = Math.hypot(this.state.vel.x, this.state.vel.z);
    let next: AnimName;
    if (this.celebrating) next = 'emote-yes';
    else if (!this.grounded) next = this.state.vel.y > 0 ? 'jump' : 'fall';
    else if (speed > 4) next = 'sprint';
    else if (speed > 0.4) next = 'walk';
    else next = 'idle';
    this.play(next);
    this.mixer.update(dt);
  }

  private play(name: AnimName): void {
    if (this.anim === name) return;
    const action = this.actions.get(name);
    if (!action) return;
    const prev = this.anim ? this.actions.get(this.anim) : undefined;
    action.reset().setEffectiveWeight(1).play();
    if (prev) prev.crossFadeTo(action, 0.12, false);
    this.anim = name;
  }

  dispose(): void {
    this.physics.world.removeCharacterController(this.controller);
    this.physics.world.removeRigidBody(this.body);
    this.mixer.stopAllAction();
  }
}

const ZERO = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);
const NO_INPUT: MoveInput = { x: 0, z: 0, jumpPressed: false, jumpHeld: false, dashPressed: false, jetpackHeld: false };
