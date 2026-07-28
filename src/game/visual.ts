import { Mesh, SphereGeometry, MeshBasicMaterial, Vector3, type Scene } from 'three';
import type { ZoneId } from './profile';

interface Particle {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
  maxLife: number;
  size: number;
}

export class VisualEffects {
  private overlay: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private vignetteOverlay: HTMLCanvasElement;
  private vignetteCtx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private flashTimer = 0;
  private flashColor = '';
  private vignetteIntensity = 0;
  private vignetteColor = '255, 0, 0';
  private weatherParticles: Mesh[] = [];
  private weatherType: 'none' | 'rain' | 'sandstorm' | 'snow' = 'none';
  private scene: Scene | null = null;

  constructor() {
    this.overlay = document.createElement('canvas');
    this.overlay.width = window.innerWidth;
    this.overlay.height = window.innerHeight;
    this.overlay.style.cssText =
      'position:fixed;inset:0;z-index:1;pointer-events:none;mix-blend-mode:screen;';
    document.body.appendChild(this.overlay);
    this.ctx = this.overlay.getContext('2d')!;

    this.vignetteOverlay = document.createElement('canvas');
    this.vignetteOverlay.width = window.innerWidth;
    this.vignetteOverlay.height = window.innerHeight;
    this.vignetteOverlay.style.cssText =
      'position:fixed;inset:0;z-index:1;pointer-events:none;mix-blend-mode:multiply;opacity:0.6;';
    document.body.appendChild(this.vignetteOverlay);
    this.vignetteCtx = this.vignetteOverlay.getContext('2d')!;

    window.addEventListener('resize', () => {
      this.overlay.width = window.innerWidth;
      this.overlay.height = window.innerHeight;
      this.vignetteOverlay.width = window.innerWidth;
      this.vignetteOverlay.height = window.innerHeight;
    });
  }

  flashDamage() {
    this.flashTimer = 0.3;
    this.flashColor = 'rgba(255, 40, 40, 0.35)';
    this.vignetteIntensity = 0.8;
    this.vignetteColor = '255, 0, 0';
  }

  flashHeal() {
    this.flashTimer = 0.25;
    this.flashColor = 'rgba(40, 255, 80, 0.3)';
  }

  flashLevelUp() {
    this.flashTimer = 0.5;
    this.flashColor = 'rgba(240, 195, 109, 0.4)';
  }

  flashBossWarning() {
    this.flashTimer = 0.4;
    this.flashColor = 'rgba(255, 100, 0, 0.3)';
  }

  spawnBurst(
    scene: Scene,
    position: Vector3,
    color: number,
    count: number,
    speed: number,
    life: number
  ) {
    this.scene = scene;
    for (let i = 0; i < count; i++) {
      const size = 0.08 + Math.random() * 0.12;
      const mesh = new Mesh(
        new SphereGeometry(size, 4, 3),
        new MeshBasicMaterial({ color, transparent: true, opacity: 1 })
      );
      mesh.position.copy(position);
      mesh.position.y += 1;
      scene.add(mesh);

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.6 + Math.PI * 0.2;
      const velocity = new Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed * 0.8,
        Math.sin(phi) * Math.sin(theta) * speed
      );

      this.particles.push({
        mesh,
        velocity,
        life,
        maxLife: life,
        size,
      });
    }
  }

  spawnLevelUpBurst(scene: Scene, position: Vector3) {
    this.spawnBurst(scene, position, 0xf0c36d, 20, 4, 1.2);
    this.spawnBurst(scene, position, 0xffffff, 10, 3, 0.8);
  }

  spawnDeathBurst(scene: Scene, position: Vector3) {
    this.spawnBurst(scene, position, 0xcc4444, 15, 3, 1.0);
    this.spawnBurst(scene, position, 0x222222, 8, 2, 0.6);
  }

  spawnBossKillBurst(scene: Scene, position: Vector3) {
    this.spawnBurst(scene, position, 0xff6600, 30, 5, 1.5);
    this.spawnBurst(scene, position, 0xf0c36d, 20, 4, 1.2);
    this.spawnBurst(scene, position, 0xffffff, 15, 6, 1.0);
  }

  spawnCollectBurst(scene: Scene, position: Vector3, color: number) {
    this.spawnBurst(scene, position, color, 6, 2, 0.5);
  }

  setWeather(scene: Scene, zone: ZoneId) {
    this.clearWeather(scene);

    const weatherMap: Record<ZoneId, 'none' | 'rain' | 'sandstorm' | 'snow'> = {
      aldea: 'none',
      bosque: 'rain',
      ruinas: 'none',
      desierto: 'sandstorm',
      cueva: 'snow',
    };

    this.weatherType = weatherMap[zone];
    if (this.weatherType === 'none') return;

    this.scene = scene;
    const count = this.weatherType === 'sandstorm' ? 40 : this.weatherType === 'rain' ? 80 : 50;

    for (let i = 0; i < count; i++) {
      const size = this.weatherType === 'rain' ? 0.03 : 0.06;
      const color =
        this.weatherType === 'rain'
          ? 0x88aacc
          : this.weatherType === 'sandstorm'
            ? 0xc2a050
            : 0xddeeff;
      const mesh = new Mesh(
        new SphereGeometry(size, 3, 2),
        new MeshBasicMaterial({ color, transparent: true, opacity: 0.5 })
      );
      mesh.position.set(
        (Math.random() - 0.5) * 50,
        Math.random() * 15 + 2,
        (Math.random() - 0.5) * 50
      );
      scene.add(mesh);
      this.weatherParticles.push(mesh);
    }
  }

  clearWeather(scene: Scene) {
    for (const p of this.weatherParticles) {
      scene.remove(p);
    }
    this.weatherParticles = [];
    this.weatherType = 'none';
  }

  update(delta: number, playerX: number, playerZ: number) {
    if (this.flashTimer > 0) {
      this.flashTimer -= delta;
      this.ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
      if (this.flashTimer > 0) {
        this.ctx.fillStyle = this.flashColor;
        this.ctx.fillRect(0, 0, this.overlay.width, this.overlay.height);
      }
    } else {
      this.ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    }

    if (this.vignetteIntensity > 0) {
      this.vignetteIntensity = Math.max(0, this.vignetteIntensity - delta * 2);
      this.vignetteCtx.clearRect(0, 0, this.vignetteOverlay.width, this.vignetteOverlay.height);
      if (this.vignetteIntensity > 0) {
        const w = this.vignetteOverlay.width;
        const h = this.vignetteOverlay.height;
        const gradient = this.vignetteCtx.createRadialGradient(
          w / 2,
          h / 2,
          w * 0.2,
          w / 2,
          h / 2,
          w * 0.7
        );
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, `rgba(${this.vignetteColor},${this.vignetteIntensity})`);
        this.vignetteCtx.fillStyle = gradient;
        this.vignetteCtx.fillRect(0, 0, w, h);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;
      if (p.life <= 0) {
        if (this.scene) this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.velocity.y -= 5 * delta;
      p.mesh.position.addScaledVector(p.velocity, delta);
      const lifeRatio = p.life / p.maxLife;
      p.mesh.scale.setScalar(lifeRatio);
      const mat = p.mesh.material as MeshBasicMaterial;
      mat.opacity = lifeRatio;
    }

    for (const mesh of this.weatherParticles) {
      switch (this.weatherType) {
        case 'rain':
          mesh.position.y -= 15 * delta;
          mesh.position.x += Math.sin(playerZ * 0.1) * delta;
          if (mesh.position.y < 0) {
            mesh.position.y = 15 + Math.random() * 5;
            mesh.position.x = playerX + (Math.random() - 0.5) * 40;
            mesh.position.z = playerZ + (Math.random() - 0.5) * 40;
          }
          break;
        case 'sandstorm':
          mesh.position.x += 6 * delta;
          mesh.position.y += Math.sin(Date.now() * 0.002 + mesh.id) * 0.02;
          mesh.position.z += Math.cos(Date.now() * 0.001 + mesh.id) * 0.02;
          if (mesh.position.x > playerX + 25) {
            mesh.position.x = playerX - 25;
            mesh.position.z = playerZ + (Math.random() - 0.5) * 40;
            mesh.position.y = Math.random() * 8 + 1;
          }
          break;
        case 'snow':
          mesh.position.y -= 1.5 * delta;
          mesh.position.x += Math.sin(Date.now() * 0.001 + mesh.id) * delta * 0.5;
          if (mesh.position.y < 0) {
            mesh.position.y = 12 + Math.random() * 5;
            mesh.position.x = playerX + (Math.random() - 0.5) * 40;
            mesh.position.z = playerZ + (Math.random() - 0.5) * 40;
          }
          break;
      }
    }
  }

  destroy() {
    this.overlay.remove();
    this.vignetteOverlay.remove();
    for (const p of this.particles) {
      p.mesh.geometry.dispose();
      (p.mesh.material as MeshBasicMaterial).dispose();
    }
    this.particles = [];
    for (const mesh of this.weatherParticles) {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    }
    this.weatherParticles = [];
  }
}
