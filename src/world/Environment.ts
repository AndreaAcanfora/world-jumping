import * as THREE from 'three';
import type { Theme } from '../level/types';

interface Palette {
  top: number;
  horizon: number;
  sea: number;
  fog: number;
  sun: number;
  ground: number;
}

const PALETTES: Record<Theme, Palette> = {
  grass: { top: 0x3d8bdc, horizon: 0xcfeaff, sea: 0x2f8fb8, fog: 0xbfe1f5, sun: 0xfff1d6, ground: 0x7cae5a },
  snow: { top: 0x6f88b8, horizon: 0xe8f0ff, sea: 0x5c86a8, fog: 0xdfe8f7, sun: 0xffffff, ground: 0xcfdcef },
};

/** Sky dome, distant clouds, sea below the islands, and a sun whose shadows follow the player. */
export class Environment {
  readonly group = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  private readonly clouds = new THREE.Group();
  private readonly sea: THREE.Mesh;

  constructor(
    scene: THREE.Scene,
    theme: Theme,
    seaLevel: number,
    private readonly shadows: boolean,
  ) {
    const p = PALETTES[theme];
    scene.fog = new THREE.Fog(p.fog, 40, 160);
    scene.background = new THREE.Color(p.horizon);

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(300, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: new THREE.Color(p.top) }, horizon: { value: new THREE.Color(p.horizon) } },
        vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vDir;
          void main() { float h = clamp(vDir.y * 1.6, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.7)), 1.0); }`,
      }),
    );
    sky.renderOrder = -1;
    this.group.add(sky);

    this.group.add(new THREE.HemisphereLight(0xdff3ff, p.ground, 1.5));
    this.sun = new THREE.DirectionalLight(p.sun, 2.4);
    this.sun.castShadow = shadows;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = this.sun.shadow.camera;
    s.left = -14;
    s.right = 14;
    s.top = 14;
    s.bottom = -14;
    s.near = 1;
    s.far = 60;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.group.add(this.sun, this.sun.target);

    this.sea = new THREE.Mesh(
      new THREE.CircleGeometry(400, 48),
      new THREE.MeshStandardMaterial({ color: p.sea, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.92 }),
    );
    this.sea.rotation.x = -Math.PI / 2;
    this.sea.position.y = seaLevel;
    this.group.add(this.sea);

    this.buildClouds(seaLevel);
    this.group.add(this.clouds);
    scene.add(this.group);
  }

  private buildClouds(seaLevel: number): void {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
    const puff = new THREE.IcosahedronGeometry(1, 1);
    // A fixed pattern so every visit looks the same.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) {
      const cloud = new THREE.Group();
      const n = 3 + Math.floor(rnd() * 4);
      for (let j = 0; j < n; j++) {
        const m = new THREE.Mesh(puff, mat);
        m.position.set(j * 1.4 - n * 0.7, rnd() * 0.6, rnd() * 1.2);
        m.scale.setScalar(1 + rnd() * 1.2);
        cloud.add(m);
      }
      const angle = rnd() * Math.PI * 2;
      const dist = 45 + rnd() * 90;
      cloud.position.set(Math.cos(angle) * dist, seaLevel + 6 + rnd() * 30, Math.sin(angle) * dist);
      cloud.scale.setScalar(1.5 + rnd() * 2);
      this.clouds.add(cloud);
    }
  }

  update(focus: THREE.Vector3, time: number): void {
    // Keep the shadow map centred on the player so shadows stay sharp.
    this.sun.position.set(focus.x + 10, focus.y + 22, focus.z - 8);
    this.sun.target.position.copy(focus);
    this.clouds.rotation.y = time * 0.004;
    if (!this.shadows) this.sun.castShadow = false;
  }
}
