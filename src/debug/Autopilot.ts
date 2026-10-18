import * as THREE from 'three';
import type { LevelRuntime } from '../level/LevelRuntime';
import { LevelRuntime as LR } from '../level/LevelRuntime';
import { COMFORT, gapBetween, maxJumpDistance, stopPoint, stopTops, supportAt, topOf } from '../level/reach';
import type { Top } from '../level/reach';
import type { LevelDef, Waypoint } from '../level/types';
import type { Player } from '../player/Player';
import type { MoveInput } from '../player/movement';

/** Rough time from take-off to landing on a nearby platform. */
const LANDING_TIME = 0.5;

const inside = (t: Top, p: THREE.Vector3, margin = 0) =>
  p.x > t.minX + margin && p.x < t.maxX - margin && p.z > t.minZ + margin && p.z < t.maxZ - margin;

/** A degenerate top rectangle at a point. */
const pointTop = (p: THREE.Vector3): Top => ({ minX: p.x, maxX: p.x, minZ: p.z, maxZ: p.z, y: p.y });

/**
 * Plays a level along its route with the real physics, like a careful player: walk across
 * areas, step up terraces, run to the edge and jump, wait for moving platforms, use the
 * ability a jump needs. The end-to-end tests use it to prove every level can be finished.
 */
export class Autopilot {
  private index = 1;
  private airTime = 0;
  private time = 0;
  private readonly lastFeet = new THREE.Vector3(NaN, NaN, NaN);

  constructor(private readonly def: LevelDef) {}

  private moverTop(w: Waypoint, ahead = 0): Top | null {
    if (!('mover' in w)) return null;
    const m = this.def.movers![w.mover]!;
    const at = LR.moverAt(m, this.time + ahead);
    return topOf(m.model, [at.x, at.y, at.z]);
  }

  private point(w: Waypoint, ahead = 0): THREE.Vector3 {
    const t = this.moverTop(w, ahead);
    if (t) return new THREE.Vector3((t.minX + t.maxX) / 2, t.y, (t.minZ + t.maxZ) / 2);
    return new THREE.Vector3(...stopPoint(this.def, w));
  }

  /** Is there ground at about this height at a point (static pieces or moving platforms)? */
  private groundAt(p: THREE.Vector3): boolean {
    for (const dy of [0, -0.08, 0.08]) if (supportAt(this.def, [p.x, p.y + dy, p.z])) return true;
    return this.def.route.some((w) => {
      const t = this.moverTop(w);
      return t !== null && inside(t, p) && Math.abs(t.y - p.y) < 0.3;
    });
  }

  next(dt: number, player: Player, _level: LevelRuntime, time: number): MoveInput {
    this.time = time;
    const feet = player.feet;
    const input: MoveInput = { x: 0, z: 0, jumpPressed: false, jumpHeld: true, dashPressed: false, jetpackHeld: false };

    // Respawned after a fall: continue from the route stop nearest to where we are now.
    if (this.lastFeet.distanceTo(feet) > 3) {
      let best = 0;
      this.def.route.forEach((w, i) => {
        if (this.point(w).distanceTo(feet) < this.point(this.def.route[best]!).distanceTo(feet)) best = i;
      });
      this.index = best + 1;
    }
    this.lastFeet.copy(feet);

    if (this.index >= this.def.route.length) {
      const goal = new THREE.Vector3(...this.def.flag);
      input.x = goal.x - feet.x;
      input.z = goal.z - feet.z;
      return input;
    }

    const w = this.def.route[this.index]!;
    const prev = this.def.route[this.index - 1]!;
    const target = this.point(w, player.grounded && 'mover' in w ? LANDING_TIME : 0);
    const flat = new THREE.Vector3(target.x - feet.x, 0, target.z - feet.z);
    const dist = flat.length();
    if (dist > 0.05) flat.divideScalar(dist);

    const mt = this.moverTop(w);
    const arrived = mt ? player.grounded && inside(mt, feet, -0.05) : player.grounded && dist < 0.55 && Math.abs(target.y - feet.y) < 0.45;
    if (arrived) {
      this.index++;
      this.airTime = 0;
      return input;
    }

    if (!player.grounded) {
      this.airTime += dt;
      input.x = flat.x;
      input.z = flat.z;
      if (w.needs === 'dash' && this.airTime > 0.12) input.dashPressed = true;
      if (w.needs === 'jetpack' && feet.y < target.y + 0.6) input.jetpackHeld = true;
      return input;
    }
    this.airTime = 0;

    if (w.needs === 'spring') {
      const spring = this.def.springs?.find((s) => Math.abs(s[1] - feet.y) < 0.3);
      if (spring) {
        input.x = spring[0] - feet.x;
        input.z = spring[2] - feet.z;
        return input;
      }
    }

    if (w.move === 'walk') {
      input.x = flat.x;
      input.z = flat.z;
      // Step up onto a higher terrace (ramps are walked up without jumping).
      if (target.y - feet.y > 0.3 && dist < 2.2 && !this.groundAt(feet.clone().addScaledVector(flat, 0.6))) input.jumpPressed = true;
      return input;
    }

    // A jump: run towards the target and take off where the ground ends.
    const nearEdge = !this.groundAt(feet.clone().addScaledVector(flat, 0.4));
    const here = pointTop(feet);
    const rise = target.y - feet.y;
    const reach = (w.needs === 'jetpack' ? maxJumpDistance(0) : maxJumpDistance(Math.max(0, rise))) * (w.needs === 'dash' ? 1.6 : 0.85);

    if (mt) {
      // Wait at the edge until the platform is close now and will still be close on landing.
      const gap = Math.max(gapBetween(here, mt), gapBetween(here, this.moverTop(w, LANDING_TIME)!));
      if (nearEdge && gap > reach * COMFORT * 0.9) return input;
    }
    const riding = this.moverTop(prev);
    // Distance to where we land: the whole landing surface, not its centre.
    const landingTop = mt ?? stopTops(this.def, w)[0] ?? pointTop(target);
    if (riding && inside(riding, feet) && gapBetween(here, landingTop) > reach * COMFORT) {
      // Riding a platform that has not arrived yet: stay in its middle.
      input.x = ((riding.minX + riding.maxX) / 2 - feet.x) * 3;
      input.z = ((riding.minZ + riding.maxZ) / 2 - feet.z) * 3;
      return input;
    }
    input.x = flat.x;
    input.z = flat.z;
    if (nearEdge) input.jumpPressed = true;
    return input;
  }

  get progress(): number {
    return this.index;
  }
}
