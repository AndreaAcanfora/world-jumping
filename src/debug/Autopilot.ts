import * as THREE from 'three';
import type { LevelRuntime } from '../level/LevelRuntime';
import { LevelRuntime as LR } from '../level/LevelRuntime';
import { COMFORT, gapBetween, maxJumpDistance, topOf } from '../level/reach';
import type { Top } from '../level/reach';
import type { LevelDef, Mover, Piece } from '../level/types';
import type { Player } from '../player/Player';
import type { MoveInput } from '../player/movement';

interface Stop {
  piece?: Piece;
  mover?: Mover;
  needs?: Piece['needs'];
}

/** Rough time from take-off to landing on a nearby platform. */
const LANDING_TIME = 0.5;

/**
 * Plays a level along its route with the real physics, like a careful player:
 * run to the edge, jump, wait for moving platforms, use the ability the jump needs.
 * Used by the end-to-end tests to prove every level can be finished.
 */
export class Autopilot {
  private readonly stops: Stop[];
  private index = 1;
  private airTime = 0;
  private time = 0;

  constructor(private readonly def: LevelDef) {
    const ordered: { order: number; stop: Stop }[] = [
      ...def.pieces.filter((p) => p.route !== undefined).map((p) => ({ order: p.route!, stop: { piece: p, ...(p.needs ? { needs: p.needs } : {}) } })),
      ...(def.movers ?? []).filter((m) => m.route !== undefined).map((m) => ({ order: m.route!, stop: { mover: m } })),
    ];
    this.stops = ordered.sort((a, b) => a.order - b.order).map((o) => o.stop);
  }

  private top(stop: Stop, ahead = 0): Top {
    if (stop.piece) return topOf(stop.piece.model, stop.piece.at, stop.piece.turns);
    const at = LR.moverAt(stop.mover!, this.time + ahead);
    return topOf(stop.mover!.model, [at.x, at.y, at.z]);
  }

  private static centre(t: Top): THREE.Vector3 {
    return new THREE.Vector3((t.minX + t.maxX) / 2, t.y, (t.minZ + t.maxZ) / 2);
  }

  private static inside(t: Top, p: THREE.Vector3, margin = 0): boolean {
    return p.x > t.minX + margin && p.x < t.maxX - margin && p.z > t.minZ + margin && p.z < t.maxZ - margin;
  }

  next(dt: number, player: Player, _level: LevelRuntime, time: number): MoveInput {
    this.time = time;
    const feet = player.feet;
    const input: MoveInput = { x: 0, z: 0, jumpPressed: false, jumpHeld: true, dashPressed: false, jetpackHeld: false };
    if (this.index >= this.stops.length) {
      // On the last platform: walk to the flag.
      const goal = new THREE.Vector3(...this.def.flag);
      input.x = goal.x - feet.x;
      input.z = goal.z - feet.z;
      return input;
    }

    // After a fall (or anywhere), continue from the route stop we are standing on.
    if (player.grounded) {
      for (let i = this.stops.length - 1; i >= 0; i--) {
        const t = this.top(this.stops[i]!);
        if (Autopilot.inside(t, feet, -0.05) && feet.y > t.y - 0.3 && feet.y < t.y + 1.2) {
          if (i + 1 !== this.index) this.index = i + 1;
          break;
        }
      }
      if (this.index >= this.stops.length) return this.next(dt, player, _level, time);
    }

    const from = this.top(this.stops[this.index - 1]!);
    const stop = this.stops[this.index]!;
    const to = this.top(stop);
    // Aim where a moving platform will be when we land, not where it is now.
    const target = Autopilot.centre(stop.mover ? this.top(stop, player.grounded ? LANDING_TIME : 0.15) : to);

    // Arrived: standing on the next stop.
    if (player.grounded && Autopilot.inside(to, feet, -0.05) && feet.y > to.y - 0.3) {
      this.index++;
      this.airTime = 0;
      return input;
    }

    if (stop.needs === 'spring' && player.grounded) {
      // Walk onto the spring; it does the jumping.
      const spring = this.def.springs?.find((s) => Math.abs(s[1] - from.y) < 0.3);
      if (spring) {
        input.x = spring[0] - feet.x;
        input.z = spring[2] - feet.z;
        return input;
      }
    }

    const dir = new THREE.Vector3(target.x - feet.x, 0, target.z - feet.z);
    const dist = dir.length();
    if (dist > 0.05) dir.divideScalar(dist);

    if (!player.grounded) {
      this.airTime += dt;
      input.x = dir.x;
      input.z = dir.z;
      if (stop.needs === 'dash' && this.airTime > 0.12) input.dashPressed = true;
      if (stop.needs === 'jetpack' && feet.y < to.y + 0.6) input.jetpackHeld = true;
      return input;
    }
    this.airTime = 0;

    // Still on the take-off platform: run towards the target, jump near the edge.
    const ahead = feet.clone().addScaledVector(dir, 0.35);
    const nearEdge = !Autopilot.inside(from, ahead) && Autopilot.inside(from, feet);
    const point: Top = { minX: feet.x, maxX: feet.x, minZ: feet.z, maxZ: feet.z, y: feet.y };
    const rise = to.y - feet.y;
    const reach = (stop.needs === 'jetpack' ? maxJumpDistance(0) : maxJumpDistance(Math.max(0, rise))) * (stop.needs === 'dash' ? 1.6 : 0.85);

    if (stop.mover) {
      // Wait at the edge until the platform is close now and will still be close on landing.
      const gap = Math.max(gapBetween(point, to), gapBetween(point, this.top(stop, LANDING_TIME)));
      if (nearEdge && gap > reach * COMFORT * 0.75) return input;
    }
    const riding = this.stops[this.index - 1]!.mover;
    if (riding && gapBetween(point, to) > reach * COMFORT) {
      // Riding a platform that has not arrived yet: stay in its middle.
      const c = Autopilot.centre(from);
      input.x = (c.x - feet.x) * 3;
      input.z = (c.z - feet.z) * 3;
      return input;
    }
    input.x = dir.x;
    input.z = dir.z;
    if (nearEdge) input.jumpPressed = true;
    return input;
  }

  get progress(): number {
    return this.index;
  }
}
