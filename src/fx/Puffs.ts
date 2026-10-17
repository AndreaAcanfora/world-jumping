import * as THREE from 'three';

interface Puff {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  max: number;
  grow: number;
}

/** Small pooled particles: dust on jumps and landings, sparkles on pickups. */
export class Puffs {
  readonly group = new THREE.Group();
  private readonly pool: Puff[] = [];
  private readonly geo = new THREE.IcosahedronGeometry(0.08, 0);

  emit(at: THREE.Vector3, count: number, color: number, speed: number, up = 1, size = 1): void {
    for (let i = 0; i < count; i++) {
      let p = this.pool.find((q) => q.life <= 0);
      if (!p) {
        const mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ transparent: true }));
        p = { mesh, vel: new THREE.Vector3(), life: 0, max: 1, grow: 1 };
        this.pool.push(p);
        this.group.add(mesh);
      }
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      p.vel.set(Math.cos(a) * s, up * (0.5 + Math.random()) * speed * 0.6, Math.sin(a) * s);
      p.mesh.position.copy(at);
      (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      p.max = p.life = 0.35 + Math.random() * 0.3;
      p.grow = size * (1 + Math.random());
      p.mesh.visible = true;
    }
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      const t = 1 - p.life / p.max;
      p.vel.multiplyScalar(1 - dt * 3);
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.setScalar(p.grow * (0.6 + t * 1.6));
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
    }
  }
}
