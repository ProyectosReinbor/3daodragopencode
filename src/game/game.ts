import { Clock, Group, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { InputController } from './input';
import { saveProfile, type PlayerProfile, type ZoneId, currentQuestDef, advanceQuest } from './profile';
import { createWorld, type Enemy, type ResourceNode, rollLoot } from './world';
import { type Npc, type CraftingStation, type ZonePortal, isNearPortal, isNearNpc, isNearStation, zoneConfig } from './zones';
import { validateRewardCode } from './rewards';
import { QrScanner } from './qr-scanner';
import { frameIntervalFor, getQuality, pixelRatioFor, saveQuality, type QualityLevel } from './quality';
import { buildNftModel, totalStats, xpForLevel } from './nft';
import { apiSaveProfile, isLoggedIn } from './api';

export class Game {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(55, 1, 0.1, 70);
  private readonly renderer: WebGLRenderer;
  private readonly clock = new Clock();
  private readonly player: Group;
  private readonly cameraTarget = new Vector3();
  private readonly input: InputController;
  private enemies: Enemy[] = [];
  private resources: ResourceNode[] = [];
  private npcs: Npc[] = [];
  private stations: CraftingStation[] = [];
  private portals: ZonePortal[] = [];
  private health = 100;
  private energy = 100;
  private lastAttack = 0;
  private readonly lastEnemyAttacks = new Map<Enemy, number>();
  private readonly qrScanner: QrScanner;
  private quality = getQuality();
  private lastRenderAt = 0;
  private currentZone: ZoneId;
  private interactMode: 'none' | 'npc' | 'station' | 'portal' = 'none';
  private interactTarget: Npc | CraftingStation | ZonePortal | null = null;
  private isMoving = false;
  private bobPhase = 0;
  private attackAnimTimer = 0;
  private levelupFlashTimer = 0;
  private lastServerSave = 0;
  private readonly SAVE_INTERVAL = 30000;

  constructor(canvas: HTMLCanvasElement, private readonly profile: PlayerProfile) {
    this.player = buildNftModel(this.profile.nft);
    this.renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(pixelRatioFor(this.quality));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = 'srgb';
    this.scene.add(this.player);
    this.currentZone = profile.currentZone || 'aldea';
    this.loadZone(this.currentZone);
    this.health = this.maxHealth();
    this.camera.position.set(0, 7.5, 9);
    this.input = new InputController(this.element('#joystick'), this.element('#joystick-knob'), () => this.attack(), () => this.interact());
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => this.clock.getDelta());
    this.element('#inventory-button').addEventListener('click', () => this.toggleInventory());
    this.element('#close-inventory').addEventListener('click', () => this.toggleInventory(true));
    this.element('#reward-button').addEventListener('click', () => this.toggleRewards());
    this.element('#close-rewards').addEventListener('click', () => this.toggleRewards(true));
    this.element<HTMLFormElement>('#reward-form').addEventListener('submit', (event) => { event.preventDefault(); void this.redeemReward(); });
    this.qrScanner = new QrScanner(this.element('#qr-video'), this.element('#scan-status'), (code) => { this.element<HTMLInputElement>('#reward-code').value = code; void this.redeemReward(); });
    this.element('#scan-qr-button').addEventListener('click', () => { this.element('#qr-video').hidden = false; void this.qrScanner.start(); });
    this.element('#settings-button').addEventListener('click', () => this.toggleSettings());
    this.element('#close-settings').addEventListener('click', () => this.toggleSettings(true));
    const qualitySelect = this.element<HTMLSelectElement>('#quality-select');
    qualitySelect.value = this.quality;
    qualitySelect.addEventListener('change', () => this.setQuality(qualitySelect.value as QualityLevel));
    document.querySelectorAll<HTMLButtonElement>('[data-recipe]').forEach((button) => button.addEventListener('click', () => this.craft(button.dataset.recipe as keyof PlayerProfile['crafted'])));
    document.querySelectorAll<HTMLButtonElement>('[data-attribute]').forEach((button) => button.addEventListener('click', () => this.increaseAttribute(button.dataset.attribute as import('./nft').StatName)));
    document.querySelectorAll<HTMLButtonElement>('[data-use]').forEach((button) => button.addEventListener('click', () => this.useConsumable(button.dataset.use as 'racion' | 'pocion' | 'unguento')));
    this.element('#close-dialog')?.addEventListener('click', () => this.closeDialog());
    this.element('#close-trade')?.addEventListener('click', () => this.closeTrade());
    this.updateProfilePanel();
    this.updateQuest();
    this.updateZoneLabel();
  }

  start() { this.clock.start(); this.loop(); }

  private loop = (timestamp = performance.now()) => {
    if (!document.hidden && timestamp - this.lastRenderAt < frameIntervalFor(this.quality)) { requestAnimationFrame(this.loop); return; }
    const delta = Math.min(this.clock.getDelta(), 0.05);
    if (!document.hidden) { this.update(delta); this.renderer.render(this.scene, this.camera); this.lastRenderAt = timestamp; }
    requestAnimationFrame(this.loop);
  };

  private update(delta: number) {
    const direction = this.input.update();
    const stats = totalStats(this.profile.nft);
    const now = performance.now();
    if (isLoggedIn() && now - this.lastServerSave > this.SAVE_INTERVAL) { this.lastServerSave = now; apiSaveProfile(this.profile).catch(() => {}); }
    const spdMul = 1 + (stats.spd - 5) * 0.04;
    if (direction.lengthSq() > 0) {
      const speed = 4.2 * spdMul;
      this.player.position.x += direction.x * speed * delta;
      this.player.position.z += direction.y * speed * delta;
      this.player.rotation.y = Math.atan2(direction.x, direction.y);
      this.energy = Math.max(0, this.energy - delta * 1.2 * Math.max(0.65, 1 - stats.spd * 0.02));
      this.isMoving = true;
      this.bobPhase += delta * 12;
    } else {
      this.energy = Math.min(100, this.energy + delta * 2.8);
      this.isMoving = false;
      this.bobPhase = 0;
    }
    if (this.isMoving) {
      const children = this.player.children;
      if (children[0]) children[0].position.y += Math.sin(this.bobPhase) * 0.004;
      if (children[1]) children[1].position.y += Math.sin(this.bobPhase) * 0.004;
    }
    const halfGround = 42;
    this.player.position.x = Math.max(-halfGround, Math.min(halfGround, this.player.position.x));
    this.player.position.z = Math.max(-halfGround, Math.min(halfGround, this.player.position.z));
    this.updateEnemies(delta);
    this.autoCollect();
    this.checkInteractProximity();
    this.updateCompass();
    this.updateAnimations(delta);
    this.cameraTarget.set(this.player.position.x, 0.5, this.player.position.z);
    this.camera.position.lerp(this.cameraTarget.clone().add(new Vector3(0, 7.5, 9)), 1 - Math.exp(-delta * 5));
    this.camera.lookAt(this.cameraTarget);
    this.updateHud();
    this.updateTarget();
  }

  private autoCollect() {
    const node = this.resources.find((r) => r.active && r.mesh.position.distanceTo(this.player.position) < 1.8);
    if (!node) return;
    node.active = false; node.mesh.visible = false;
    const amount = 1;
    this.profile.inventory[node.kind] += amount;
    this.addExperience(5);
    this.profile.quest.resources += amount;
    this.updateQuest();
    this.hint(`+${amount} ${node.kind}`);
    window.setTimeout(() => { node.active = true; node.mesh.visible = true; }, 15000);
  }

  private checkInteractProximity() {
    const px = this.player.position.x;
    const pz = this.player.position.z;
    const nearNpc = isNearNpc(px, pz, this.npcs);
    const nearStation = isNearStation(px, pz, this.stations);
    const nearPortal = isNearPortal(px, pz, this.portals);

    if (nearNpc) {
      this.interactMode = 'npc';
      this.interactTarget = nearNpc;
      this.hint(`Interactuar con ${nearNpc.name} (E)`);
    } else if (nearStation) {
      this.interactMode = 'station';
      this.interactTarget = nearStation;
      this.hint(`Usar ${nearStation.name} (E)`);
    } else if (nearPortal) {
      this.interactMode = 'portal';
      this.interactTarget = nearPortal;
      this.hint(`Entrar a ${nearPortal.label} (E)`);
    } else {
      this.interactMode = 'none';
      this.interactTarget = null;
    }
  }

  private attack() {
    const now = performance.now();
    if (now - this.lastAttack < 400) return;
    this.lastAttack = now;
    this.attackAnimTimer = 0.25;
    this.player.scale.setScalar(1.12);
    const stats = totalStats(this.profile.nft);
    const enemy = this.enemies.filter((candidate) => candidate.alive).sort((a, b) => this.player.position.distanceTo(a.mesh.position) - this.player.position.distanceTo(b.mesh.position))[0];
    if (!enemy) { this.hint('No hay criaturas cerca.'); return; }
    const attackRange = enemy.kind === 'golem' ? 4.5 : enemy.kind === 'spirit' ? 4.0 : 4.2;
    if (this.player.position.distanceTo(enemy.mesh.position) >= attackRange) { this.hint('Acercate mas para atacar.'); return; }
    const dmg = 1 + Math.floor(stats.atk / 3) + (this.profile.crafted.espada > 0 ? 2 : 0);
    enemy.health -= dmg;
    enemy.mesh.scale.setScalar(0.85);
    setTimeout(() => enemy.mesh.scale.setScalar(1), 100);
    this.updateEnemyHpBar(enemy);
    if (enemy.health <= 0) {
      enemy.alive = false; enemy.mesh.visible = false;
      this.addExperience(15);
      this.profile.quest.creatures += 1;
      this.trackQuestKill(enemy);
      const drops = rollLoot(enemy.kind);
      if (drops.length > 0) {
        const dropTexts: string[] = [];
        for (const drop of drops) {
          this.profile.inventory[drop.resource] += drop.amount;
          this.profile.loot.push(drop);
          this.profile.quest.resources += drop.amount;
          dropTexts.push(`+${drop.amount} ${drop.resource}`);
        }
        this.hint(`${enemy.name} derrotado. Botin: ${dropTexts.join(', ')}`);
      } else {
        this.hint(`${enemy.name} fue derrotado. Volvera mas tarde.`);
      }
      this.updateQuest();
      window.setTimeout(() => this.respawnEnemy(enemy), 18000);
    }
  }

  private updateEnemyHpBar(enemy: Enemy) {
    const ratio = Math.max(0, enemy.health / enemy.maxHealth);
    enemy.hpBar.scale.x = ratio;
    enemy.hpBar.position.x = -(1.2 * (1 - ratio)) / 2;
  }

  private trackQuestKill(_enemy: Enemy) {
    const qdef = currentQuestDef(this.profile);
    if (!qdef || qdef.zone !== this.currentZone) return;
    const resources = Math.min(this.profile.quest.resources, qdef.requiredResources);
    const creatures = Math.min(this.profile.quest.creatures, qdef.requiredCreatures);
    if (resources >= qdef.requiredResources && creatures >= qdef.requiredCreatures) {
      const qs = this.profile.quests.find((q) => !q.completed);
      if (!qs) return;
      qs.completed = true;
      this.profile.nft.xp += qdef.rewardExp;
      if (qdef.rewardResource && qdef.rewardAmount) this.profile.inventory[qdef.rewardResource] += qdef.rewardAmount;
      this.profile.quest.resources = 0;
      this.profile.quest.creatures = 0;
      const nextDef = advanceQuest(this.profile);
      if (nextDef && nextDef.unlockZone && !this.profile.unlockedZones.includes(nextDef.unlockZone)) {
        this.profile.unlockedZones.push(nextDef.unlockZone);
        this.hint(`Zona desbloqueada: ${nextDef.unlockZone === 'bosque' ? 'Bosque Ancestral' : nextDef.unlockZone}`);
      }
      this.hint(`Mision "${qdef.title}" completada. +${qdef.rewardExp} EXP`);
      if (isLoggedIn()) apiSaveProfile(this.profile).catch(() => {});
    }
    saveProfile(this.profile);
  }

  private interact() {
    if (this.interactMode === 'portal') this.handlePortal();
    else if (this.interactMode === 'npc') this.handleNpcInteract();
    else if (this.interactMode === 'station') this.handleStationInteract();
  }

  private handlePortal() {
    const portal = this.interactTarget as ZonePortal;
    if (!this.profile.unlockedZones.includes(portal.targetZone)) {
      this.hint('Esta zona esta bloqueada. Completa las misiones para desbloquearla.');
      return;
    }
    this.profile.currentZone = portal.targetZone;
    saveProfile(this.profile);
    this.loadZone(portal.targetZone);
    this.hint(`Has llegado a ${portal.label}.`);
    this.updateZoneLabel();
  }

  private loadZone(zone: ZoneId) {
    this.scene.clear();
    this.scene.add(this.player);
    const cfg = zoneConfig(zone);
    this.player.position.set(cfg.playerStart.x, 0, cfg.playerStart.z);
    const world = createWorld(this.scene, zone);
    this.enemies = world.enemies;
    this.resources = world.resources;
    this.npcs = world.npcs;
    this.stations = world.stations;
    this.portals = world.portals;
    this.currentZone = zone;
  }

  private handleNpcInteract() {
    const npc = this.interactTarget as Npc;
    if (npc.tradeOffers && npc.tradeOffers.length > 0) {
      this.openTrade(npc);
    } else {
      this.showDialog(npc);
    }
  }

  private showDialog(npc: Npc) {
    this.element('#dialog-name').textContent = npc.name;
    this.element('#dialog-text').textContent = npc.dialogue;
    this.element('#dialog-panel').hidden = false;
  }

  private closeDialog() {
    this.element('#dialog-panel').hidden = true;
  }

  private openTrade(npc: Npc) {
    if (!npc.tradeOffers) return;
    this.element('#trade-name').textContent = npc.name;
    const container = this.element('#trade-offers');
    container.innerHTML = '';
    npc.tradeOffers.forEach((offer) => {
      const have = this.profile.inventory[offer.give];
      const canTrade = have >= offer.giveAmount;
      const btn = document.createElement('button');
      btn.className = canTrade ? '' : 'disabled';
      btn.textContent = `${offer.giveAmount} ${offer.give} → ${offer.receiveAmount} ${offer.receive}`;
      btn.addEventListener('click', () => {
        if (this.profile.inventory[offer.give] < offer.giveAmount) { this.hint('No tienes suficientes recursos.'); return; }
        this.profile.inventory[offer.give] -= offer.giveAmount;
        this.profile.inventory[offer.receive] += offer.receiveAmount;
        saveProfile(this.profile);
        this.updateProfilePanel();
        this.hint(`Intercambiaste ${offer.giveAmount} ${offer.give} por ${offer.receiveAmount} ${offer.receive}.`);
        this.openTrade(npc);
      });
      container.appendChild(btn);
    });
    this.element('#trade-panel').hidden = false;
  }

  private closeTrade() {
    this.element('#trade-panel').hidden = true;
  }

  private handleStationInteract() {
    const station = this.interactTarget as CraftingStation;
    const recipe = station.recipe as keyof PlayerProfile['crafted'];
    this.craft(recipe, station.name);
  }

  private respawnEnemy(enemy: Enemy) {
    enemy.health = enemy.maxHealth;
    enemy.alive = true;
    enemy.mesh.position.copy(enemy.spawnPosition);
    enemy.mesh.visible = true;
    enemy.hpBar.scale.x = 1;
    enemy.hpBar.position.x = 0;
    this.hint(`${enemy.name} ha regresado al mundo.`);
  }

  private updateEnemies(delta: number) {
    const now = performance.now();
    const stats = totalStats(this.profile.nft);
    this.enemies.filter((enemy) => enemy.alive).forEach((enemy) => {
      const direction = this.player.position.clone().sub(enemy.mesh.position);
      direction.y = 0;
      const distance = direction.length();
      const chaseRange = enemy.kind === 'golem' ? 8 : enemy.kind === 'spirit' ? 9 : 11;
      const attackRange = enemy.kind === 'golem' ? 3.2 : enemy.kind === 'spirit' ? 2.8 : 2.5;
      if (distance > attackRange && distance < chaseRange) {
        enemy.mesh.position.addScaledVector(direction.normalize(), enemy.speed * delta);
        enemy.mesh.rotation.y = Math.atan2(direction.x, direction.z);
      }
      enemy.hpBarBg.lookAt(this.camera.position);
      enemy.hpBar.lookAt(this.camera.position);
      const lastAttack = this.lastEnemyAttacks.get(enemy) ?? 0;
      if (distance <= attackRange && now - lastAttack > 1300) {
        this.lastEnemyAttacks.set(enemy, now);
        const damage = Math.max(2, enemy.damage - stats.def * 0.7 - (this.profile.crafted.escudo > 0 ? 3 : 0));
        this.health = Math.max(0, this.health - damage);
        this.showDamageNumber(Math.round(damage));
        this.hint(`${enemy.name} te ha causado ${Math.round(damage)} de dano.`);
        if (this.health <= 0) this.respawnPlayer();
      }
    });
  }

  private respawnPlayer() {
    this.player.position.set(0, 0, 0);
    this.player.scale.setScalar(1);
    this.health = Math.round(this.maxHealth() * 0.65);
    this.energy = 60;
    this.hint('Has caido en batalla. Regresaste a la aldea.');
  }

  private addExperience(amount: number) {
    const nft = this.profile.nft;
    nft.xp += amount;
    const required = xpForLevel(nft.level);
    if (nft.xp >= required) {
      nft.xp -= required;
      nft.level += 1;
      this.profile.attributePoints += 1;
      this.levelupFlashTimer = 0.6;
      this.hint(`${nft.name} subio a nivel ${nft.level}!`);
      if (isLoggedIn()) apiSaveProfile(this.profile).catch(() => {});
    }
    saveProfile(this.profile);
    this.updateProfilePanel();
  }

  private updateQuest() {
    const qdef = currentQuestDef(this.profile);
    if (!qdef) {
      this.element('#quest-title').textContent = 'Sin misiones';
      this.element('#quest-description').textContent = 'Todas las misiones completadas.';
      return;
    }
    const qs = this.profile.quests.find((q) => !q.completed);
    if (!qs) {
      this.element('#quest-title').textContent = 'Sin misiones';
      this.element('#quest-description').textContent = 'Todas las misiones completadas.';
      return;
    }
    this.element('#quest-title').textContent = qdef.title;
    const resources = Math.min(this.profile.quest.resources, qdef.requiredResources);
    const creatures = Math.min(this.profile.quest.creatures, qdef.requiredCreatures);
    this.element('#quest-description').textContent = `${qdef.description} (Recursos: ${resources}/${qdef.requiredResources}, Criaturas: ${creatures}/${qdef.requiredCreatures})`;
    saveProfile(this.profile);
  }

  private craft(recipe: keyof PlayerProfile['crafted'], stationName?: string) {
    const ingredients: Record<keyof PlayerProfile['crafted'], keyof PlayerProfile['inventory']> = { racion: 'trigo', espada: 'mineral', pocion: 'esencia', escudo: 'madera', unguento: 'hierba' };
    const ingredient = ingredients[recipe];
    const cost = recipe === 'racion' ? 1 : 2;
    if (this.profile.inventory[ingredient] < cost) { this.hint(`Necesitas ${cost} de ${ingredient} para fabricar${stationName ? ` en ${stationName}` : ''}.`); return; }
    this.profile.inventory[ingredient] -= cost;
    this.profile.crafted[recipe] += 1;
    this.addExperience(4);
    this.hint(`${recipe} fabricado${stationName ? ` en ${stationName}` : ''}.`);
    this.updateProfilePanel();
  }

  private increaseAttribute(stat: import('./nft').StatName) {
    const nft = this.profile.nft;
    if (this.profile.attributePoints <= 0) { this.hint('Sube de nivel para obtener puntos de atributo.'); return; }
    this.profile.attributePoints -= 1;
    nft.baseStats[stat] += 1;
    saveProfile(this.profile); this.updateProfilePanel();
    this.hint(`${stat} ha aumentado.`);
  }

  private useConsumable(item: 'racion' | 'pocion' | 'unguento') {
    if (this.profile.crafted[item] <= 0) { this.hint(`No tienes ${item}.`); return; }
    this.profile.crafted[item] -= 1;
    const stats = totalStats(this.profile.nft);
    if (item === 'racion') this.energy = Math.min(100, this.energy + 50);
    if (item === 'pocion') this.health = Math.min(this.maxHealth(), this.health + 45 + stats.ability * 2);
    if (item === 'unguento') this.health = Math.min(this.maxHealth(), this.health + 25 + stats.ability);
    saveProfile(this.profile); this.updateProfilePanel();
    this.hint(`${item} usado.`);
  }

  private async redeemReward() {
    const field = this.element<HTMLInputElement>('#reward-code');
    const reward = await validateRewardCode(field.value);
    if (!reward) { this.hint('Codigo de recompensa invalido.'); return; }
    if (this.profile.redeemedRewards.includes(reward.id)) { this.hint('Esta recompensa ya fue canjeada.'); return; }
    this.profile.redeemedRewards.push(reward.id);
    const stats = totalStats(this.profile.nft);
    this.health = Math.min(this.maxHealth(), this.health + reward.health + stats.ability * 2);
    this.energy = Math.min(100, this.energy + reward.energy + stats.ability);
    if (reward.resource && reward.amount) this.profile.inventory[reward.resource] += reward.amount;
    saveProfile(this.profile); this.updateProfilePanel(); field.value = '';
    this.hint(`${reward.label} recibido.`);
  }

  private resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight, false); }
  private setQuality(level: QualityLevel) {
    this.quality = level;
    saveQuality(level);
    this.renderer.setPixelRatio(pixelRatioFor(level));
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.lastRenderAt = 0;
    const fps = Math.round(1000 / frameIntervalFor(level));
    this.hint(`Calidad grafica: ${level} (${fps} FPS maximo).`);
  }
  private updateHud() {
    const maxHealth = this.maxHealth();
    this.element('#health-bar').style.width = `${this.health / maxHealth * 100}%`;
    this.element('#health-value').textContent = `${Math.round(this.health)} / ${maxHealth}`;
    this.element('#energy-bar').style.width = `${this.energy}%`;
    this.element('#energy-value').textContent = `${Math.round(this.energy)} / 100`;
    const xpRequired = xpForLevel(this.profile.nft.level);
    this.element('#xp-bar').style.width = `${this.profile.nft.xp / xpRequired * 100}%`;
    this.element('#xp-value').textContent = `${this.profile.nft.xp} / ${xpRequired}`;
  }
  private updateTarget() {
    const enemy = this.nearestEnemy();
    const card = this.element('#target-card');
    const visible = Boolean(enemy && this.player.position.distanceTo(enemy.mesh.position) < 8);
    card.hidden = !visible;
    if (!enemy || !visible) return;
    this.element('#target-name').textContent = enemy.name;
    this.element('#target-health').style.width = `${enemy.health / enemy.maxHealth * 100}%`;
  }
  private nearestEnemy() {
    return this.enemies.filter((candidate) => candidate.alive).sort((a, b) => this.player.position.distanceTo(a.mesh.position) - this.player.position.distanceTo(b.mesh.position))[0];
  }
  private updateProfilePanel() {
    const nft = this.profile.nft;
    const stats = totalStats(nft);
    this.element('#profession-name').textContent = `${nft.name} (Lv.${nft.level})`;
    this.element('#level-value').textContent = `${nft.xp} / ${xpForLevel(nft.level)} EXP`;
    (Object.keys(this.profile.inventory) as Array<keyof PlayerProfile['inventory']>).forEach((key) => { this.element(`#${key}-count`).textContent = String(this.profile.inventory[key]); });
    (Object.keys(this.profile.crafted) as Array<keyof PlayerProfile['crafted']>).forEach((key) => { this.element(`#${key}-count`).textContent = String(this.profile.crafted[key]); });
    this.element('#racion-use-count').textContent = String(this.profile.crafted.racion);
    this.element('#pocion-use-count').textContent = String(this.profile.crafted.pocion);
    this.element('#unguento-use-count').textContent = String(this.profile.crafted.unguento);
    this.element('#attribute-points').textContent = String(this.profile.attributePoints);
    const statKeys = ['atk', 'def', 'spd', 'hp', 'ability'] as const;
    for (const key of statKeys) {
      const el = this.element<HTMLElement>(`#${key}-value`);
      if (el) el.textContent = String(stats[key]);
    }
  }
  private updateZoneLabel() {
    const labels: Record<string, string> = { aldea: 'Aldea', bosque: 'Bosque Ancestral', ruinas: 'Ruinas Antiguas' };
    this.element('#zone-label').textContent = labels[this.currentZone] ?? this.currentZone;
  }
  private toggleInventory(force?: boolean) { const panel = this.element('#inventory-panel'); panel.hidden = force ?? !panel.hidden; }
  private toggleRewards(force?: boolean) {
    const panel = this.element('#reward-panel');
    panel.hidden = force ?? !panel.hidden;
    if (panel.hidden) { this.qrScanner.stop(); this.element('#qr-video').hidden = true; }
  }
  private toggleSettings(force?: boolean) { const panel = this.element('#settings-panel'); panel.hidden = force ?? !panel.hidden; }
  private hint(message: string) { this.element('#hint').textContent = message; }
  private updateAnimations(delta: number) {
    if (this.attackAnimTimer > 0) {
      this.attackAnimTimer -= delta;
      if (this.attackAnimTimer <= 0) { this.player.scale.setScalar(1); this.attackAnimTimer = 0; }
    }
    if (this.levelupFlashTimer > 0) {
      this.levelupFlashTimer -= delta;
      const flash = this.element<HTMLElement>('#levelup-flash');
      if (this.levelupFlashTimer > 0) flash.classList.add('active');
      else flash.classList.remove('active');
    }
  }
  private showDamageNumber(amount: number) {
    const container = this.element<HTMLElement>('#damage-numbers');
    const num = document.createElement('div');
    num.className = 'damage-num';
    num.textContent = `-${amount}`;
    num.style.left = `${50 + (Math.random() - 0.5) * 20}%`;
    num.style.top = '45%';
    container.appendChild(num);
    window.setTimeout(() => num.remove(), 900);
  }
  private maxHealth() { return 100 + totalStats(this.profile.nft).hp * 8; }
  private updateCompass() {
    const arrow = this.element<HTMLElement>('#compass-arrow');
    const label = this.element<HTMLElement>('#compass-label');
    if (!arrow || !label) return;
    if (this.portals.length === 0) { arrow.style.opacity = '0'; label.textContent = ''; return; }
    let nearest: import('./zones').ZonePortal | null = null;
    let minDist = Infinity;
    for (const p of this.portals) {
      const dx = p.position.x - this.player.position.x;
      const dz = p.position.z - this.player.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < minDist) { minDist = dist; nearest = p; }
    }
    if (!nearest) { arrow.style.opacity = '0'; label.textContent = ''; return; }
    const dx = nearest.position.x - this.player.position.x;
    const dz = nearest.position.z - this.player.position.z;
    const angle = Math.atan2(dx, dz) * (180 / Math.PI) + 180;
    arrow.style.transform = `rotate(${angle}deg)`;
    arrow.style.opacity = '1';
    const zoneNames: Record<string, string> = { aldea: 'Aldea', bosque: 'Bosque', ruinas: 'Ruinas' };
    label.textContent = zoneNames[nearest.targetZone] ?? nearest.targetZone;
  }
  private element<T extends HTMLElement>(selector: string): T { return document.querySelector(selector) as T; }
}
