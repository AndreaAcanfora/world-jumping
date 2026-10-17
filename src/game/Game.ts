import * as THREE from 'three';
import { instance } from '../assets/models';
import { CameraRig } from '../camera/CameraRig';
import { GameLoop } from '../core/GameLoop';
import { Puffs } from '../fx/Puffs';
import { ScreenShake } from '../fx/ScreenShake';
import type { Input } from '../input/Input';
import { LevelRuntime } from '../level/LevelRuntime';
import type { LevelDef } from '../level/types';
import { Physics, loadRapier } from '../physics/Physics';
import { Player } from '../player/Player';
import type { MoveInput } from '../player/movement';
import type { Renderer } from '../render/Renderer';
import { Environment } from '../world/Environment';
import { Autopilot } from '../debug/Autopilot';
import type { Settings } from './progress';

export interface RunResult {
  level: LevelDef;
  time: number;
  coins: number;
  coinsTotal: number;
  gems: boolean[];
  falls: number;
}

export interface HudState {
  time: number;
  started: boolean;
  coins: number;
  coinsTotal: number;
  gems: boolean[];
  dashes: number;
  fuel: number;
  fuelMax: number;
  magic: number;
}

export interface GameHooks {
  hud(state: HudState): void;
  toast(key: 'checkpoint' | 'fall' | 'gem' | 'win'): void;
  pause(): void;
  finish(result: RunResult): void;
}

const MAGIC_LIFETIME = 8;

export class Game {
  private readonly scene = new THREE.Scene();
  private readonly loop: GameLoop;
  private readonly shake = new ScreenShake(0.25);
  private readonly puffs = new Puffs();
  private readonly marker: THREE.Mesh;
  private time = 0;
  private runTime = 0;
  private started = false;
  private paused = false;
  private won = false;
  private winTimer = 0;
  private coins = 0;
  private falls = 0;
  private magic: number;
  private respawnAt: THREE.Vector3;
  private readonly magicBlocks: { object: THREE.Object3D; collider: ReturnType<Physics['addStaticMesh']>; life: number }[] = [];
  private readonly feet = new THREE.Vector3();
  private readonly env: Environment;
  /** Set with ?autopilot: the game plays itself (end-to-end tests). */
  autopilot: Autopilot | null = null;

  private constructor(
    private readonly def: LevelDef,
    private readonly physics: Physics,
    private readonly level: LevelRuntime,
    private readonly player: Player,
    private readonly rig: CameraRig,
    highQuality: boolean,
    private readonly renderer: Renderer,
    private readonly input: Input,
    private readonly hooks: GameHooks,
  ) {
    this.magic = def.abilities.magic;
    this.respawnAt = new THREE.Vector3(...def.spawn);
    this.env = new Environment(this.scene, def.theme, def.killY + 2, highQuality);
    this.scene.add(level.group, player.visual, this.puffs.group);
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.16, 0.24, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.scene.add(this.marker);
    this.loop = new GameLoop({ fixedUpdate: (dt) => this.fixedUpdate(dt), render: (dt, a) => this.render(dt, a) });
  }

  static async create(def: LevelDef, settings: Settings, renderer: Renderer, input: Input, hooks: GameHooks): Promise<Game> {
    const R = await loadRapier();
    const physics = new Physics(R);
    const level = await LevelRuntime.create(def, physics);
    const spawn = new THREE.Vector3(...def.spawn);
    const player = await Player.create(physics, settings.character, spawn, def.abilities);
    const rig = new CameraRig(physics, player.collider);
    rig.mode = settings.view;
    // Face the first jump.
    const first = def.pieces.find((p) => p.route === 1);
    const facing = first ? Math.atan2(first.at[0] - spawn.x, first.at[2] - spawn.z) : 0;
    player.state = { ...player.state, facing };
    rig.snap(spawn, facing);
    renderer.attachCamera(rig.camera);
    renderer.webgl.shadowMap.enabled = settings.quality === 'high';
    return new Game(def, physics, level, player, rig, settings.quality === 'high', renderer, input, hooks);
  }

  /** Test helper (only with ?autopilot or ?debug): put the player somewhere. */
  teleport(x: number, y: number, z: number): void {
    this.player.respawn(new THREE.Vector3(x, y, z), this.abilitiesLeft());
  }

  /** Test helper: where each moving platform is now. */
  moverPositions(): { x: number; y: number; z: number }[] {
    return this.level.movers.map((m) => ({ x: m.position.x, y: m.position.y, z: m.position.z }));
  }

  start(): void {
    this.input.enabled = true;
    this.loop.start();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.input.enabled = !paused;
    if (paused) this.input.releasePointer();
  }

  setView(mode: 'third' | 'first'): void {
    this.rig.mode = mode;
  }

  private abilitiesLeft() {
    return { dashes: this.def.abilities.dashes, fuel: this.def.abilities.fuel };
  }

  private fixedUpdate(dt: number): void {
    if (this.paused) return;
    this.time += dt;
    this.level.fixedUpdate(this.time);
    this.physics.step(dt);

    const c = this.input.sample();
    if (c.viewPressed) this.rig.mode = this.rig.mode === 'third' ? 'first' : 'third';
    if (!this.started && !this.won && (Math.hypot(c.moveX, c.moveY) > 0.1 || c.jumpPressed || c.dashPressed || c.jetpackHeld)) this.started = true;

    const fwd = this.rig.forward();
    const move: MoveInput = {
      // Right vector is (-fwd.z, fwd.x).
      x: fwd.x * c.moveY - fwd.z * c.moveX,
      z: fwd.z * c.moveY + fwd.x * c.moveX,
      jumpPressed: c.jumpPressed,
      jumpHeld: c.jumpHeld,
      dashPressed: c.dashPressed,
      jetpackHeld: c.jetpackHeld,
    };
    if (this.autopilot) {
      Object.assign(move, this.autopilot.next(dt, this.player, this.level, this.time));
      this.started = true;
      // Keep the camera behind the player so screenshots stay readable.
      this.rig.yaw += Math.atan2(Math.sin(this.player.state.facing - this.rig.yaw), Math.cos(this.player.state.facing - this.rig.yaw)) * Math.min(1, dt * 3);
    }
    const events = this.player.fixedUpdate(dt, move, this.level);
    const feet = this.player.feet;

    for (const e of events) {
      if (e === 'jump') this.puffs.emit(feet, 6, 0xffffff, 1.6, 0.4);
      if (e === 'land') {
        this.puffs.emit(feet, 10, 0xffffff, 2.2, 0.3);
        this.shake.add(0.12);
      }
      if (e === 'dash') {
        this.puffs.emit(feet.clone().setY(feet.y + 0.4), 12, 0xffe08a, 3, 0.5);
        this.shake.add(0.2);
      }
      if (e === 'jetpack' && Math.random() < 0.5) this.puffs.emit(feet, 1, 0xff9b45, 1, -1.5, 0.8);
      if (e === 'spring') {
        this.puffs.emit(feet, 14, 0xfff1a8, 3, 1);
        this.shake.add(0.15);
      }
    }

    if (c.magicPressed && this.magic > 0 && !this.player.grounded && !this.won) void this.spawnMagic(feet.clone());
    this.updateMagic(dt);

    if (this.started && !this.won) this.runTime += dt;

    const body = feet.clone().setY(feet.y + 0.45);
    for (const coin of this.level.coins) {
      if (!coin.taken && coin.position.distanceTo(body) < 0.65) {
        this.level.take(coin);
        this.coins++;
        this.puffs.emit(coin.position, 8, 0xffd84a, 2, 1, 0.7);
      }
    }
    for (const gem of this.level.gems) {
      if (!gem.taken && gem.position.distanceTo(body) < 0.75) {
        this.level.take(gem);
        this.puffs.emit(gem.position, 16, 0x7fd8ff, 2.5, 1);
        this.hooks.toast('gem');
      }
    }
    for (const cp of this.level.checkpoints) {
      if (!cp.taken && cp.position.distanceTo(body) < 1.3) {
        cp.taken = true;
        this.respawnAt = cp.position.clone();
        this.puffs.emit(cp.position.clone().setY(cp.position.y + 1), 18, 0x9cff7a, 2.5, 1);
        this.hooks.toast('checkpoint');
      }
    }

    const goal = new THREE.Vector3(...this.def.flag);
    if (!this.won && Math.hypot(feet.x - goal.x, feet.z - goal.z) < 1.1 && Math.abs(feet.y - goal.y) < 1.5) this.win();

    if (feet.y < this.def.killY) {
      this.falls++;
      this.player.respawn(this.respawnAt, this.abilitiesLeft());
      this.rig.snap(this.respawnAt, this.player.state.facing);
      this.shake.add(0.3);
      this.hooks.toast('fall');
    }

    (window as unknown as { __wj?: unknown }).__wj = {
      level: this.def.id,
      won: this.won,
      time: this.runTime,
      falls: this.falls,
      feet: { x: feet.x, y: feet.y, z: feet.z },
      grounded: this.player.grounded,
      vel: { ...this.player.state.vel },
      progress: this.autopilot?.progress ?? null,
    };

    if (this.won) {
      this.winTimer += dt;
      if (this.winTimer > 2.2 && this.winTimer - dt <= 2.2) this.finish();
    }
  }

  private win(): void {
    this.won = true;
    this.player.celebrating = true;
    const at = new THREE.Vector3(...this.def.flag).setY(this.def.flag[1] + 1.5);
    this.puffs.emit(at, 40, 0xffd84a, 4, 1.5, 1.4);
    this.puffs.emit(at, 30, 0xff6fa8, 3.5, 1.5, 1.2);
    this.hooks.toast('win');
  }

  private finish(): void {
    this.input.enabled = false;
    this.input.releasePointer();
    this.hooks.finish({
      level: this.def,
      time: this.runTime,
      coins: this.coins,
      coinsTotal: this.level.coins.length,
      gems: this.level.gems.map((g) => g.taken),
      falls: this.falls,
    });
  }

  private async spawnMagic(at: THREE.Vector3): Promise<void> {
    this.magic--;
    const { object } = await instance('block-grass-low');
    // Kenney's low block is half a unit tall: its top lands just under the feet.
    object.position.set(at.x, at.y - 0.52, at.z);
    this.level.group.add(object);
    const collider = this.physics.addStaticMesh(object);
    this.magicBlocks.push({ object, collider, life: MAGIC_LIFETIME });
    this.puffs.emit(at, 16, 0xc79bff, 2.5, 0.6);
  }

  private updateMagic(dt: number): void {
    for (let i = this.magicBlocks.length - 1; i >= 0; i--) {
      const b = this.magicBlocks[i]!;
      b.life -= dt;
      const s = Math.min(1, b.life * 2);
      b.object.scale.set(1, Math.max(0.01, s), 1);
      if (b.life <= 0) {
        b.object.removeFromParent();
        if (b.collider) this.physics.world.removeCollider(b.collider, false);
        this.magicBlocks.splice(i, 1);
      }
    }
  }

  private render(frameDt: number, alpha: number): void {
    const look = this.input.takeLook(frameDt);
    if (!this.paused) this.rig.rotate(look.x, look.y);

    this.player.render(alpha, this.paused ? 0 : frameDt);
    this.player.visual.visible = this.rig.mode === 'third';
    this.player.renderPosition(alpha, this.feet);

    this.shake.update(frameDt);
    this.rig.update(this.feet, frameDt, this.shake.offset);
    this.env.update(this.feet, this.time);
    this.level.render(this.time, frameDt);
    this.puffs.update(frameDt);

    // Landing marker: where you would land if you dropped straight down.
    if (!this.player.grounded) {
      const from = this.feet.clone().setY(this.feet.y + 0.1);
      const d = this.physics.rayDistance(from, new THREE.Vector3(0, -1, 0), 40, this.player.collider);
      this.marker.visible = d < 40;
      this.marker.position.set(this.feet.x, from.y - d + 0.03, this.feet.z);
    } else this.marker.visible = false;

    const s = this.player.state;
    this.hooks.hud({
      time: this.runTime,
      started: this.started,
      coins: this.coins,
      coinsTotal: this.level.coins.length,
      gems: this.level.gems.map((g) => g.taken),
      dashes: s.dashes,
      fuel: s.fuel,
      fuelMax: this.def.abilities.fuel,
      magic: this.magic,
    });

    this.renderer.adapt(frameDt);
    this.renderer.render(this.scene, this.rig.camera);
  }

  dispose(): void {
    this.loop.stop();
    this.input.enabled = false;
    this.player.dispose();
    this.physics.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
  }
}
