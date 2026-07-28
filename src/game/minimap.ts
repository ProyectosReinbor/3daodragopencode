import type { ZoneId } from './profile';
import type { Enemy } from './world';
import type { Npc, CraftingStation, ZonePortal } from './zones';
import type { ActiveBoss } from './bosses';

const MINIMAP_SIZE = 140;

export interface MinimapEntity {
  x: number;
  z: number;
  color: string;
  size: number;
  label?: string;
}

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private fogCanvas: HTMLCanvasElement;
  private fogCtx: CanvasRenderingContext2D;
  private explored = new Set<string>();
  private visible = true;
  private readonly cellSize = 4;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = MINIMAP_SIZE;
    this.canvas.height = MINIMAP_SIZE;
    this.canvas.className = 'minimap-canvas';
    this.canvas.style.cssText = `
      position: fixed; z-index: 4; top: max(16px, env(safe-area-inset-top));
      right: 16px; width: ${MINIMAP_SIZE}px; height: ${MINIMAP_SIZE}px;
      border-radius: 50%; border: 2px solid #f0c36d44;
      background: #0a120d88; pointer-events: none;
      box-shadow: 0 0 12px #00000066;
    `;

    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = MINIMAP_SIZE;
    this.fogCanvas.height = MINIMAP_SIZE;
    this.fogCtx = this.fogCanvas.getContext('2d')!;
    this.fogCtx.fillStyle = '#0a120dcc';
    this.fogCtx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  toggle() {
    this.visible = !this.visible;
    this.canvas.style.display = this.visible ? 'block' : 'none';
  }

  resetFog() {
    this.explored.clear();
    this.fogCtx.fillStyle = '#0a120dcc';
    this.fogCtx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
  }

  update(
    playerX: number,
    playerZ: number,
    playerRotation: number,
    groundSize: number,
    enemies: Enemy[],
    npcs: Npc[],
    stations: CraftingStation[],
    portals: ZonePortal[],
    boss: ActiveBoss | null,
    bossMinions: Map<import('three').Group, { alive: boolean }>,
    _zone: ZoneId
  ) {
    if (!this.visible) return;

    const ctx = this.ctx;
    const scale = MINIMAP_SIZE / groundSize;
    const halfMap = MINIMAP_SIZE / 2;

    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    ctx.save();
    ctx.beginPath();
    ctx.arc(halfMap, halfMap, halfMap - 2, 0, Math.PI * 2);
    ctx.clip();

    this.revealFog(playerX, playerZ, groundSize);

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(this.fogCanvas, 0, 0);
    ctx.restore();

    ctx.save();
    ctx.translate(halfMap, halfMap);
    ctx.rotate(-playerRotation);

    const toMapX = (wx: number) => wx * scale;
    const toMapZ = (wz: number) => -wz * scale;

    for (const portal of portals) {
      this.drawDot(ctx, toMapX(portal.position.x), toMapZ(portal.position.z), 4, '#e8ba66');
    }

    for (const station of stations) {
      this.drawDot(
        ctx,
        toMapX(station.mesh.position.x),
        toMapZ(station.mesh.position.z),
        3,
        '#88aacc'
      );
    }

    for (const npc of npcs) {
      this.drawDot(ctx, toMapX(npc.mesh.position.x), toMapZ(npc.mesh.position.z), 3, '#44cc88');
    }

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      this.drawDot(
        ctx,
        toMapX(enemy.mesh.position.x),
        toMapZ(enemy.mesh.position.z),
        2.5,
        '#cc4444'
      );
    }

    if (boss && boss.alive) {
      this.drawDot(ctx, toMapX(boss.mesh.position.x), toMapZ(boss.mesh.position.z), 5, '#ff6600');
    }

    for (const [minion, data] of bossMinions) {
      if (!data.alive) continue;
      this.drawDot(ctx, toMapX(minion.position.x), toMapZ(minion.position.z), 2, '#aa44aa');
    }

    ctx.restore();

    this.drawPlayer(ctx, halfMap, halfMap, playerRotation);

    ctx.restore();

    this.drawBorder(ctx, halfMap);
  }

  private revealFog(playerX: number, playerZ: number, groundSize: number) {
    const scale = MINIMAP_SIZE / groundSize;
    const halfMap = MINIMAP_SIZE / 2;
    const revealRadius = 25;

    const cx = Math.floor(playerX / this.cellSize);
    const cz = Math.floor(playerZ / this.cellSize);
    const cellRadius = Math.ceil(revealRadius / this.cellSize);

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dz = -cellRadius; dz <= cellRadius; dz++) {
        const dist = Math.sqrt(dx * dx + dz * dz) * this.cellSize;
        if (dist > revealRadius) continue;

        const key = `${cx + dx},${cz + dz}`;
        if (this.explored.has(key)) continue;
        this.explored.add(key);

        const wx = (cx + dx) * this.cellSize;
        const wz = (cz + dz) * this.cellSize;
        const mx = halfMap + wx * scale;
        const mz = halfMap - wz * scale;

        const alpha = Math.max(0, 1 - dist / revealRadius);
        this.fogCtx.save();
        this.fogCtx.globalCompositeOperation = 'destination-out';
        this.fogCtx.fillStyle = `rgba(0,0,0,${0.3 + alpha * 0.7})`;
        this.fogCtx.fillRect(mx - 2, mz - 2, 4, 4);
        this.fogCtx.restore();
      }
    }
  }

  private drawDot(ctx: CanvasRenderingContext2D, x: number, z: number, r: number, color: string) {
    ctx.beginPath();
    ctx.arc(x, z, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, rotation: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-rotation);

    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-4, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(4, 5);
    ctx.closePath();
    ctx.fillStyle = '#f0c36d';
    ctx.fill();
    ctx.strokeStyle = '#ffffff88';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  private drawBorder(ctx: CanvasRenderingContext2D, halfMap: number) {
    ctx.beginPath();
    ctx.arc(halfMap, halfMap, halfMap - 1, 0, Math.PI * 2);
    ctx.strokeStyle = '#f0c36d55';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  destroy() {
    this.canvas.remove();
  }
}
