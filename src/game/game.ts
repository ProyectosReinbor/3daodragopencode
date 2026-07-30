import { Clock, Group, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { InputController } from './input';
import {
  saveProfile,
  type PlayerProfile,
  type ZoneId,
  currentQuestDef,
  advanceQuest,
} from './profile';
import { createWorld, type Enemy, type ResourceNode, rollLoot } from './world';
import {
  type Npc,
  type CraftingStation,
  type ZonePortal,
  isNearPortal,
  isNearNpc,
  isNearStation,
  zoneConfig,
} from './zones';
import { validateRewardCode } from './rewards';
import { QrScanner } from './qr-scanner';
import {
  frameIntervalFor,
  getQuality,
  pixelRatioFor,
  saveQuality,
  type QualityLevel,
} from './quality';
import { buildNftModel, totalStats, xpForLevel, type StatName } from './nft';
import { apiSaveProfile, isLoggedIn } from './api';
import {
  createActiveAbilities,
  calculateAbilityEffect,
  type ActiveAbility,
  type AbilityEffect,
} from './abilities';
import { updateAchievement } from './achievements';
import { type ActiveBoss, getBossPhase, rollBossLoot, buildBossMinion } from './bosses';
import { Minimap } from './minimap';
import { AudioManager } from './audio';
import {
  loadDailyQuests,
  saveDailyQuests,
  updateLoginStreak,
  trackDailyKill,
  trackDailyCollect,
  trackDailyCraft,
  trackDailyExplore,
  claimDailyQuest,
  getDailyQuestStatus,
} from './daily-quests';
import { VisualEffects } from './visual';
import {
  loadLeaderboard,
  submitScore,
  calculateScore,
  getRank,
  type LeaderboardEntry,
} from './leaderboard';
import {
  loadBattlePass,
  saveBattlePass,
  addBattlePassXp,
  claimBattlePassTier,
  getBattlePassTiers,
  getBattlePassProgress,
  type BattlePassState,
} from './battlepass';

type ConsumableItem =
  | 'racion'
  | 'pocion'
  | 'unguento'
  | 'pocion_fuerza'
  | 'pocion_velocidad'
  | 'antidoto'
  | 'gran_pocion'
  | 'elixir';

interface ActiveBuff {
  stat: StatName;
  amount: number;
  timerId: ReturnType<typeof setTimeout>;
}

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
  private abilities: ActiveAbility[] = [];
  private shieldActive = false;
  private shieldHp = 0;
  private stunTimer = 0;
  private dashTimer = 0;
  private dashDirection = new Vector3();
  private readonly cameraOffset = new Vector3(0, 7.5, 9);
  private readonly tempVec = new Vector3();
  private readonly activeBuffs: ActiveBuff[] = [];
  private cachedNearestEnemy: Enemy | null = null;
  private cachedNearestEnemyDist = Infinity;
  private readonly dom = {} as Record<string, HTMLElement>;
  private readonly domInput = {} as Record<string, HTMLInputElement>;
  private readonly domButton = {} as Record<string, HTMLButtonElement>;
  private readonly domSelect = {} as Record<string, HTMLSelectElement>;
  private activeBoss: ActiveBoss | null = null;
  private bossMinions = new Map<
    Group,
    { health: number; damage: number; speed: number; alive: boolean }
  >();
  private bossWarningTimer = 0;
  private bossAbilityWarnings: string[] = [];
  private readonly lastMinionAttacks = new Map<Group, number>();
  private readonly minimap: Minimap;
  private readonly audio: AudioManager;
  private readonly visuals: VisualEffects;
  private dailyQuestData: ReturnType<typeof loadDailyQuests>;
  private leaderboard: LeaderboardEntry[];
  private battlePass: BattlePassState;
  private sessionStartTime = 0;
  private sessionKills = 0;
  private sessionBossKills = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly profile: PlayerProfile
  ) {
    this.player = buildNftModel(this.profile.nft);
    this.renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(pixelRatioFor(this.quality));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = 'srgb';
    this.scene.add(this.player);
    this.cacheDom();
    this.currentZone = profile.currentZone || 'aldea';
    this.minimap = new Minimap();
    this.audio = new AudioManager();
    this.visuals = new VisualEffects();
    this.loadZone(this.currentZone);
    this.health = this.maxHealth();
    this.camera.position.set(0, 7.5, 9);

    this.input = new InputController(
      this.dom['joystick'],
      this.dom['joystick-knob'],
      () => this.attack(),
      () => this.interact()
    );
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => this.clock.getDelta());
    this.dom['inventory-button'].addEventListener('click', () => this.toggleInventory());
    this.dom['close-inventory'].addEventListener('click', () => this.toggleInventory(true));
    this.dom['reward-button'].addEventListener('click', () => this.toggleRewards());
    this.dom['close-rewards'].addEventListener('click', () => this.toggleRewards(true));
    (this.dom['reward-form'] as HTMLFormElement).addEventListener('submit', (event) => {
      event.preventDefault();
      void this.redeemReward();
    });
    this.qrScanner = new QrScanner(
      this.domInput['qr-video'] as unknown as HTMLVideoElement,
      this.dom['scan-status'],
      (code) => {
        this.domInput['reward-code'].value = code;
        void this.redeemReward();
      }
    );
    this.dom['scan-qr-button'].addEventListener('click', () => {
      this.domInput['qr-video'].hidden = false;
      void this.qrScanner.start();
    });
    this.dom['settings-button'].addEventListener('click', () => this.toggleSettings());
    this.dom['close-settings'].addEventListener('click', () => this.toggleSettings(true));
    this.dom['mute-toggle']?.addEventListener('click', () => {
      const muted = this.audio.toggleMute();
      const btn = this.dom['mute-toggle'];
      if (btn) btn.textContent = muted ? '🔇 Silenciado' : '🔊 Sonido';
    });
    this.dom['daily-button']?.addEventListener('click', () => this.toggleDailyQuests());
    this.dom['close-daily']?.addEventListener('click', () => this.toggleDailyQuests(true));
    this.dom['leaderboard-button']?.addEventListener('click', () => this.toggleLeaderboard());
    this.dom['close-leaderboard']?.addEventListener('click', () => this.toggleLeaderboard(true));
    this.dom['battlepass-button']?.addEventListener('click', () => this.toggleBattlePass());
    this.dom['close-battlepass']?.addEventListener('click', () => this.toggleBattlePass(true));
    const qualitySelect = this.domSelect['quality-select'];
    qualitySelect.value = this.quality;
    qualitySelect.addEventListener('change', () =>
      this.setQuality(qualitySelect.value as QualityLevel)
    );
    document
      .querySelectorAll<HTMLButtonElement>('[data-recipe]')
      .forEach((button) =>
        button.addEventListener('click', () =>
          this.craft(button.dataset.recipe as keyof PlayerProfile['crafted'])
        )
      );
    document
      .querySelectorAll<HTMLButtonElement>('[data-attribute]')
      .forEach((button) =>
        button.addEventListener('click', () =>
          this.increaseAttribute(button.dataset.attribute as StatName)
        )
      );
    document
      .querySelectorAll<HTMLButtonElement>('[data-use]')
      .forEach((button) =>
        button.addEventListener('click', () =>
          this.useConsumable(button.dataset.use as ConsumableItem)
        )
      );
    this.dom['close-dialog']?.addEventListener('click', () => this.closeDialog());
    this.dom['close-trade']?.addEventListener('click', () => this.closeTrade());
    this.abilities = createActiveAbilities(this.profile.nft);
    this.setupAbilityButtons();
    this.leaderboard = loadLeaderboard();
    this.battlePass = loadBattlePass();
    this.sessionStartTime = Date.now();
    this.dailyQuestData = updateLoginStreak(this.profile.dailyQuests);
    this.profile.dailyQuests = this.dailyQuestData;
    saveDailyQuests(this.dailyQuestData);
    this.updateProfilePanel();
    this.updateQuest();
    this.updateZoneLabel();
  }

  start() {
    this.clock.start();
    this.loop();
  }

  private loop = (timestamp = performance.now()) => {
    if (!document.hidden && timestamp - this.lastRenderAt < frameIntervalFor(this.quality)) {
      requestAnimationFrame(this.loop);
      return;
    }
    const delta = Math.min(this.clock.getDelta(), 0.05);
    if (!document.hidden) {
      this.update(delta);
      this.renderer.render(this.scene, this.camera);
      this.lastRenderAt = timestamp;
    }
    requestAnimationFrame(this.loop);
  };

  private update(delta: number) {
    const direction = this.input.update();
    const stats = totalStats(this.profile.nft);
    const now = performance.now();
    if (isLoggedIn() && now - this.lastServerSave > this.SAVE_INTERVAL) {
      this.lastServerSave = now;
      apiSaveProfile(this.profile).catch(() => {});
    }

    this.cacheNearestEnemy();

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
    if (this.dashTimer > 0) {
      this.player.position.x += this.dashDirection.x * 20 * delta;
      this.player.position.z += this.dashDirection.z * 20 * delta;
      this.dashTimer -= delta;
    }
    this.player.position.x = Math.max(-halfGround, Math.min(halfGround, this.player.position.x));
    this.player.position.z = Math.max(-halfGround, Math.min(halfGround, this.player.position.z));
    this.updateEnemies(delta);
    this.updateBoss(delta);
    this.updateBossMinions(delta);
    this.autoCollect();
    this.checkInteractProximity();
    this.updateCompass();
    this.minimap.update(
      this.player.position.x,
      this.player.position.z,
      this.player.rotation.y,
      zoneConfig(this.currentZone).groundSize,
      this.enemies,
      this.npcs,
      this.stations,
      this.portals,
      this.activeBoss,
      this.bossMinions,
      this.currentZone
    );
    this.visuals.update(delta, this.player.position.x, this.player.position.z);
    this.updateAnimations(delta);
    this.updateAbilityCooldowns();
    if (this.bossWarningTimer > 0) {
      this.bossWarningTimer -= delta;
      const warning = this.dom['levelup-flash'];
      if (this.bossWarningTimer > 0) {
        warning.classList.add('active');
        warning.style.background = 'rgba(255, 50, 0, 0.3)';
      } else {
        warning.classList.remove('active');
        warning.style.background = '';
      }
    }
    this.cameraTarget.set(this.player.position.x, 0.5, this.player.position.z);
    this.tempVec.copy(this.cameraTarget).add(this.cameraOffset);
    this.camera.position.lerp(this.tempVec, 1 - Math.exp(-delta * 5));
    this.camera.lookAt(this.cameraTarget);
    this.updateHud();
    this.updateTarget();
  }

  private autoCollect() {
    const node = this.resources.find(
      (r) => r.active && r.mesh.position.distanceTo(this.player.position) < 1.8
    );
    if (!node) return;
    node.active = false;
    node.mesh.visible = false;
    const amount = 1;
    this.profile.inventory[node.kind] += amount;
    this.addExperience(5);
    this.profile.quest.resources += amount;
    trackDailyCollect(this.dailyQuestData, node.kind, amount);
    saveDailyQuests(this.dailyQuestData);
    this.trackAchievement('collector_1', amount);
    this.trackAchievement('collector_2', amount);
    this.trackAchievement('collector_3', amount);
    this.updateQuest();
    this.audio.playCollect();
    const resourceColors: Record<string, number> = {
      trigo: 0xd8bc4f,
      mineral: 0x788c9a,
      esencia: 0x9c70cb,
      madera: 0x71472e,
      hierba: 0x75b954,
    };
    this.visuals.spawnCollectBurst(
      this.scene,
      node.mesh.position,
      resourceColors[node.kind] ?? 0xffffff
    );
    this.hint(`+${amount} ${node.kind}`);
    window.setTimeout(() => {
      node.active = true;
      node.mesh.visible = true;
    }, 15000);
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
    this.audio.playAttack();
    const stats = totalStats(this.profile.nft);

    const enemy = this.cachedNearestEnemy;
    const boss = this.activeBoss;
    const bossDist =
      boss && boss.alive ? this.player.position.distanceTo(boss.mesh.position) : Infinity;
    const enemyDist = enemy ? this.player.position.distanceTo(enemy.mesh.position) : Infinity;

    const targetBoss = boss && boss.alive && bossDist < enemyDist && bossDist < 6;
    const targetEnemy = enemy && enemyDist < 6;

    if (!targetBoss && !targetEnemy) {
      this.hint('No hay criaturas cerca.');
      return;
    }

    if (targetBoss) {
      const attackRange = boss!.definition.attackRange;
      if (bossDist >= attackRange) {
        this.hint('Acercate mas para atacar al boss.');
        return;
      }
      const dmg = 1 + Math.floor(stats.atk / 3) + (this.profile.crafted.espada > 0 ? 2 : 0);
      this.damageBoss(dmg);
      return;
    }

    if (targetEnemy && enemy) {
      const attackRange = enemy.kind === 'golem' ? 4.5 : enemy.kind === 'spirit' ? 4.0 : 4.2;
      if (enemyDist >= attackRange) {
        this.hint('Acercate mas para atacar.');
        return;
      }
      const dmg = 1 + Math.floor(stats.atk / 3) + (this.profile.crafted.espada > 0 ? 2 : 0);
      enemy.health -= dmg;
      enemy.mesh.scale.setScalar(0.85);
      setTimeout(() => enemy.mesh.scale.setScalar(1), 100);
      this.updateEnemyHpBar(enemy);
      if (enemy.health <= 0) {
        enemy.alive = false;
        enemy.mesh.visible = false;
        this.visuals.spawnDeathBurst(this.scene, enemy.mesh.position);
        this.addExperience(15);
        this.sessionKills++;
        const bpResult = addBattlePassXp(this.battlePass, 10);
        saveBattlePass(this.battlePass);
        if (bpResult.leveledUp) this.hint(`Battle Pass nivel ${bpResult.newLevel}`);
        this.profile.quest.creatures += 1;
        this.trackAchievement('monster_slayer_1', 1);
        this.trackAchievement('monster_slayer_2', 1);
        if (enemy.kind === 'wolf') this.trackAchievement('wolf_hunter_1', 1);
        if (enemy.kind === 'wolf') this.trackAchievement('wolf_hunter_2', 1);
        if (enemy.kind === 'spirit') this.trackAchievement('spirit_hunter_1', 1);
        if (enemy.kind === 'golem') this.trackAchievement('golem_hunter_1', 1);
        this.trackQuestKill(enemy);
        trackDailyKill(this.dailyQuestData, enemy.kind);
        saveDailyQuests(this.dailyQuestData);
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
  }

  private damageBoss(dmg: number) {
    const boss = this.activeBoss;
    if (!boss || !boss.alive) return;

    boss.health -= dmg;
    boss.mesh.scale.setScalar(0.9);
    setTimeout(() => boss.mesh.scale.setScalar(1), 100);
    this.showDamageNumber(dmg, true);
    this.updateBossHpBar();

    const healthRatio = boss.health / boss.maxHealth;
    const newPhase = getBossPhase(healthRatio, boss.definition.phases);

    if (newPhase > boss.currentPhase) {
      boss.currentPhase = newPhase;
      const phaseConfig = boss.definition.phases[newPhase - 1];
      if (phaseConfig && phaseConfig.message) {
        this.hint(`⚠ ${phaseConfig.message}`);
        this.bossWarningTimer = 3.0;
        this.audio.playBossWarning();
        this.visuals.flashBossWarning();
      }
    }

    if (healthRatio <= 0.25 && !boss.enraged) {
      boss.enraged = true;
      boss.enrageTimer = boss.enrageMaxTime;
      this.hint(`⚠ ¡${boss.definition.name} se ha enfurecido! ¡Ataca con todo!`);
      this.bossWarningTimer = 3.0;
      this.audio.playBossWarning();
      this.visuals.flashBossWarning();
    }

    if (boss.health <= 0) {
      this.killBoss();
    }
  }

  private killBoss() {
    const boss = this.activeBoss;
    if (!boss) return;

    boss.alive = false;
    boss.mesh.visible = false;
    this.visuals.spawnBossKillBurst(this.scene, boss.mesh.position);
    this.addExperience(boss.definition.xpReward);
    this.sessionBossKills++;
    const bpResult = addBattlePassXp(this.battlePass, 50);
    saveBattlePass(this.battlePass);
    if (bpResult.leveledUp) this.hint(`Battle Pass nivel ${bpResult.newLevel}`);

    for (const [minion] of this.bossMinions) {
      this.scene.remove(minion);
    }
    this.bossMinions.clear();

    const drops = rollBossLoot(boss.definition);
    if (drops.length > 0) {
      const dropTexts: string[] = [];
      for (const drop of drops) {
        this.profile.inventory[drop.resource] += drop.amount;
        this.profile.loot.push({ resource: drop.resource, amount: drop.amount });
        this.profile.quest.resources += drop.amount;
        dropTexts.push(`+${drop.amount} ${drop.resource}`);
      }
      this.hint(`🏆 ¡${boss.definition.name} derrotado! Botin: ${dropTexts.join(', ')}`);
    } else {
      this.hint(`🏆 ¡${boss.definition.name} derrotado! +${boss.definition.xpReward} EXP`);
    }

    this.trackAchievement('monster_slayer_1', 1);
    this.trackAchievement('monster_slayer_2', 1);
    this.updateQuest();
    this.dom['boss-card'].hidden = true;

    window.setTimeout(() => this.respawnBoss(), boss.definition.respawnTime);
  }

  private respawnBoss() {
    const boss = this.activeBoss;
    if (!boss) return;

    boss.alive = true;
    boss.health = boss.maxHealth;
    boss.currentPhase = 1;
    boss.enraged = false;
    boss.enrageTimer = 0;
    boss.lastAttack = 0;
    boss.lastAbilityUse.clear();
    boss.summonCount = 0;
    boss.mesh.position.copy(boss.spawnPosition);
    boss.mesh.visible = true;
    boss.hpBar.scale.x = 1;
    boss.hpBar.position.x = 0;
    boss.phaseBar.scale.x = 1;
    boss.phaseBar.position.x = 0;
    this.hint(`⚠ ¡${boss.definition.name} ha regresado!`);
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
      if (qdef.rewardResource && qdef.rewardAmount)
        this.profile.inventory[qdef.rewardResource] += qdef.rewardAmount;
      this.profile.quest.resources = 0;
      this.profile.quest.creatures = 0;
      const nextDef = advanceQuest(this.profile);
      if (
        nextDef &&
        nextDef.unlockZone &&
        !this.profile.unlockedZones.includes(nextDef.unlockZone)
      ) {
        this.profile.unlockedZones.push(nextDef.unlockZone);
        this.hint(
          `Zona desbloqueada: ${nextDef.unlockZone === 'bosque' ? 'Bosque Ancestral' : nextDef.unlockZone}`
        );
      }
      this.audio.playQuestComplete();
      this.hint(`Mision "${qdef.title}" completada. +${qdef.rewardExp} EXP`);
      const completedCount = this.profile.quests.filter((q) => q.completed).length;
      if (completedCount >= 3) this.trackAchievement('quest_complete_1', 0);
      if (completedCount >= 7) this.trackAchievement('quest_complete_2', 0);
      if (isLoggedIn()) apiSaveProfile(this.profile).catch(() => {});
    }
    saveProfile(this.profile);
  }

  private trackAchievement(id: string, amount: number) {
    this.profile.achievements = updateAchievement(this.profile.achievements, id, amount);
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
    this.trackAchievement('explorer_2', 1);
    this.trackAchievement('explorer_3', 1);
    const visitedCount = new Set(this.profile.unlockedZones).size;
    if (visitedCount >= 5) this.trackAchievement('explorer_1', 0);
    trackDailyExplore(this.dailyQuestData, visitedCount);
    saveDailyQuests(this.dailyQuestData);
    this.hint(`Has llegado a ${portal.label}.`);
    this.updateZoneLabel();
  }

  private loadZone(zone: ZoneId) {
    this.clearBuffs();
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
    this.activeBoss = world.boss;
    this.bossMinions.clear();
    this.bossWarningTimer = 0;
    this.bossAbilityWarnings = [];
    this.currentZone = zone;
    this.minimap.resetFog();
    this.audio.startZoneAmbient(zone);
    this.visuals.setWeather(this.scene, zone);
    if (this.activeBoss) {
      this.hint(`⚠ ¡${this.activeBoss.definition.name} acecha en esta zona!`);
    }
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
    this.dom['dialog-name'].textContent = npc.name;
    this.dom['dialog-text'].textContent = npc.dialogue;
    this.dom['dialog-panel'].hidden = false;
  }

  private closeDialog() {
    this.dom['dialog-panel'].hidden = true;
  }

  private openTrade(npc: Npc) {
    if (!npc.tradeOffers) return;
    this.dom['trade-name'].textContent = npc.name;
    const container = this.dom['trade-offers'];
    container.innerHTML = '';
    npc.tradeOffers.forEach((offer) => {
      const have = this.profile.inventory[offer.give];
      const canTrade = have >= offer.giveAmount;
      const btn = document.createElement('button');
      btn.className = canTrade ? '' : 'disabled';
      btn.textContent = `${offer.giveAmount} ${offer.give} → ${offer.receiveAmount} ${offer.receive}`;
      btn.addEventListener('click', () => {
        if (this.profile.inventory[offer.give] < offer.giveAmount) {
          this.hint('No tienes suficientes recursos.');
          return;
        }
        this.profile.inventory[offer.give] -= offer.giveAmount;
        this.profile.inventory[offer.receive] += offer.receiveAmount;
        saveProfile(this.profile);
        this.updateProfilePanel();
        this.hint(
          `Intercambiaste ${offer.giveAmount} ${offer.give} por ${offer.receiveAmount} ${offer.receive}.`
        );
        this.openTrade(npc);
      });
      container.appendChild(btn);
    });
    this.dom['trade-panel'].hidden = false;
  }

  private closeTrade() {
    this.dom['trade-panel'].hidden = true;
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

  private updateBoss(delta: number) {
    const boss = this.activeBoss;
    if (!boss || !boss.alive) return;

    const now = performance.now();
    const distance = this.player.position.distanceTo(boss.mesh.position);
    const phaseConfig = boss.definition.phases[boss.currentPhase - 1];
    const dmgMul = phaseConfig?.damageMultiplier ?? 1;
    const spdMul = phaseConfig?.speedMultiplier ?? 1;

    if (boss.enraged) {
      boss.enrageTimer -= delta * 1000;
      if (boss.enrageTimer <= 0) {
        boss.health = boss.maxHealth;
        this.hint(`⚠ ¡${boss.definition.name} se ha regenerado!`);
        this.updateBossHpBar();
      }
    }

    boss.hpBarBg.lookAt(this.camera.position);
    boss.hpBar.lookAt(this.camera.position);
    boss.phaseBar.lookAt(this.camera.position);

    const chaseRange = boss.definition.aggroRange;
    const attackRange = boss.definition.attackRange;

    if (distance > attackRange && distance < chaseRange) {
      const dir = this.player.position.clone().sub(boss.mesh.position);
      dir.y = 0;
      dir.normalize();
      boss.mesh.position.addScaledVector(dir, boss.definition.baseSpeed * spdMul * delta);
      boss.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }

    const lastAttack = boss.lastAttack;
    if (distance <= attackRange && now - lastAttack > boss.definition.attackCooldown) {
      boss.lastAttack = now;
      const stats = totalStats(this.profile.nft);
      let damage = Math.max(
        2,
        boss.definition.baseDamage * dmgMul -
          stats.def * 0.6 -
          (this.profile.crafted.escudo > 0 ? 3 : 0)
      );
      if (this.shieldActive && this.shieldHp > 0) {
        const absorbed = Math.min(this.shieldHp, damage);
        this.shieldHp -= absorbed;
        damage -= absorbed;
        if (this.shieldHp <= 0) this.shieldActive = false;
      }
      if (damage > 0) {
        this.health = Math.max(0, this.health - damage);
        this.audio.playDamage();
        this.visuals.flashDamage();
        this.showDamageNumber(Math.round(damage));
        this.hint(`${boss.definition.name} te ha causado ${Math.round(damage)} de dano.`);
        if (this.health <= 0) this.respawnPlayer();
      } else {
        this.hint(`${boss.definition.name} ataco pero tu escudo lo bloqueo!`);
      }
    }

    for (const ability of boss.definition.abilities) {
      if (ability.phaseRequired > boss.currentPhase) continue;
      const lastUsed = boss.lastAbilityUse.get(ability.type + ability.name) ?? 0;
      if (ability.cooldown > 0 && now - lastUsed < ability.cooldown) continue;
      if (distance < ability.range || ability.type === 'summon' || ability.type === 'enrage') {
        this.executeBossAbility(boss, ability);
        boss.lastAbilityUse.set(ability.type + ability.name, now);
      }
    }

    this.updateBossHpBar();
  }

  private executeBossAbility(boss: ActiveBoss, ability: import('./bosses').BossAbility) {
    const stats = totalStats(this.profile.nft);
    const distance = this.player.position.distanceTo(boss.mesh.position);

    switch (ability.type) {
      case 'aoe':
      case 'slam':
      case 'charge': {
        const dmg = ability.damage;
        if (distance <= ability.range) {
          let damage = Math.max(
            2,
            dmg - stats.def * 0.5 - (this.profile.crafted.escudo > 0 ? 3 : 0)
          );
          if (this.shieldActive && this.shieldHp > 0) {
            const absorbed = Math.min(this.shieldHp, damage);
            this.shieldHp -= absorbed;
            damage -= absorbed;
            if (this.shieldHp <= 0) this.shieldActive = false;
          }
          if (damage > 0) {
            this.health = Math.max(0, this.health - damage);
            this.showDamageNumber(Math.round(damage), true);
          }
          this.hint(`⚠ ${boss.definition.name} usa ${ability.name}!`);
        }
        break;
      }
      case 'summon': {
        if (boss.summonCount >= 5) break;
        const minionKinds: Record<
          string,
          { kind: Parameters<typeof buildBossMinion>[0]; count: number }
        > = {
          guardian_ancestral: { kind: 'stone_fragment', count: 2 },
          senor_bosque: { kind: 'spirit_wolf', count: 2 },
          rey_golem: { kind: 'stone_pillar', count: 3 },
          faraon: { kind: 'mummy_guardian', count: 2 },
          senor_profundidades: { kind: 'shadow', count: 3 },
        };
        const config = minionKinds[boss.definition.id];
        if (!config) break;
        for (let i = 0; i < config.count && boss.summonCount < 5; i++) {
          const minionMesh = buildBossMinion(config.kind, boss.definition.zone);
          const angle = (i / config.count) * Math.PI * 2;
          const spawnDist = 3 + Math.random() * 2;
          minionMesh.position.set(
            boss.mesh.position.x + Math.cos(angle) * spawnDist,
            0,
            boss.mesh.position.z + Math.sin(angle) * spawnDist
          );
          this.scene.add(minionMesh);
          this.bossMinions.set(minionMesh, {
            health: 30 + boss.definition.baseDamage * 2,
            damage: boss.definition.baseDamage * 0.5,
            speed: 2.0,
            alive: true,
          });
          boss.summonCount++;
        }
        this.hint(`⚠ ${boss.definition.name} invoca ayuda!`);
        break;
      }
      case 'heal': {
        const healAmount = Math.round(boss.maxHealth * 0.15);
        boss.health = Math.min(boss.maxHealth, boss.health + healAmount);
        this.showHealNumber(healAmount);
        this.hint(`⚠ ${boss.definition.name} se regenera!`);
        break;
      }
      case 'enrage': {
        if (!boss.enraged) {
          boss.enraged = true;
          boss.enrageTimer = boss.enrageMaxTime;
          this.hint(`⚠ ¡${boss.definition.name} se ha enfurecido!`);
        }
        break;
      }
    }
  }

  private updateBossMinions(delta: number) {
    const now = performance.now();
    const stats = totalStats(this.profile.nft);

    for (const [minion, data] of this.bossMinions) {
      if (!data.alive) continue;

      const distance = this.player.position.distanceTo(minion.position);
      if (distance > 1 && distance < 12) {
        const dir = this.player.position.clone().sub(minion.position);
        dir.y = 0;
        dir.normalize();
        minion.position.addScaledVector(dir, data.speed * delta);
        minion.rotation.y = Math.atan2(dir.x, dir.z);
      }

      const attackRange = 2.5;
      if (distance <= attackRange) {
        const lastAttack = this.lastMinionAttacks.get(minion) ?? 0;
        if (now - lastAttack > 1500) {
          this.lastMinionAttacks.set(minion, now);
          let damage = Math.max(
            1,
            data.damage - stats.def * 0.5 - (this.profile.crafted.escudo > 0 ? 2 : 0)
          );
          if (this.shieldActive && this.shieldHp > 0) {
            const absorbed = Math.min(this.shieldHp, damage);
            this.shieldHp -= absorbed;
            damage -= absorbed;
            if (this.shieldHp <= 0) this.shieldActive = false;
          }
          if (damage > 0) {
            this.health = Math.max(0, this.health - damage);
            this.showDamageNumber(Math.round(damage));
            if (this.health <= 0) this.respawnPlayer();
          }
        }
      }

      if (distance < 4.5) {
        const dmg = 1 + Math.floor(stats.atk / 4);
        data.health -= dmg;
        if (data.health <= 0) {
          data.alive = false;
          this.scene.remove(minion);
          this.bossMinions.delete(minion);
          this.addExperience(8);
        }
      }
    }
  }

  private updateBossHpBar() {
    const boss = this.activeBoss;
    if (!boss) return;
    const ratio = Math.max(0, boss.health / boss.maxHealth);
    boss.hpBar.scale.x = ratio;
    boss.hpBar.position.x = -(1.8 * (1 - ratio)) / 2;

    const phaseConfig = boss.definition.phases[boss.currentPhase - 1];
    const prevThreshold =
      boss.currentPhase > 1 ? boss.definition.phases[boss.currentPhase - 2].threshold : 1;
    const phaseRange = prevThreshold - phaseConfig.threshold;
    const phaseProgress = phaseRange > 0 ? (prevThreshold - ratio) / phaseRange : 1;
    boss.phaseBar.scale.x = Math.max(0, 1 - phaseProgress);
    boss.phaseBar.position.x = -(1.8 * phaseProgress) / 2;

    const card = this.dom['boss-card'];
    if (card) {
      card.hidden = false;
      this.dom['boss-name'].textContent = boss.definition.name;
      this.dom['boss-health'].style.width = `${ratio * 100}%`;
      this.dom['boss-phase'].textContent =
        `Fase ${boss.currentPhase} / ${boss.definition.phases.length}`;
      if (boss.enraged) {
        this.dom['boss-enrage'].textContent = `FURIA: ${Math.ceil(boss.enrageTimer / 1000)}s`;
        this.dom['boss-enrage'].style.color = '#ff4444';
      } else {
        this.dom['boss-enrage'].textContent = '';
      }
    }
  }

  private updateEnemies(delta: number) {
    const now = performance.now();
    const stats = totalStats(this.profile.nft);
    this.enemies
      .filter((enemy) => enemy.alive)
      .forEach((enemy) => {
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
          let damage = Math.max(
            2,
            enemy.damage - stats.def * 0.7 - (this.profile.crafted.escudo > 0 ? 3 : 0)
          );
          if (this.shieldActive && this.shieldHp > 0) {
            const absorbed = Math.min(this.shieldHp, damage);
            this.shieldHp -= absorbed;
            damage -= absorbed;
            if (this.shieldHp <= 0) this.shieldActive = false;
          }
          if (damage > 0) {
            this.health = Math.max(0, this.health - damage);
            this.audio.playDamage();
            this.visuals.flashDamage();
            this.showDamageNumber(Math.round(damage));
            this.hint(`${enemy.name} te ha causado ${Math.round(damage)} de dano.`);
            if (this.health <= 0) this.respawnPlayer();
          } else {
            this.hint(`${enemy.name} ataco pero tu escudo lo bloqueo!`);
          }
        }
      });
  }

  private respawnPlayer() {
    this.clearBuffs();
    const cfg = zoneConfig(this.currentZone);
    this.player.position.set(cfg.playerStart.x, 0, cfg.playerStart.z);
    this.player.scale.setScalar(1);
    this.health = Math.round(this.maxHealth() * 0.65);
    this.energy = 60;
    this.audio.playDeath();
    this.hint('Has caido en batalla. Regresaste al punto de inicio.');
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
      this.audio.playLevelUp();
      this.visuals.flashLevelUp();
      this.visuals.spawnLevelUpBurst(this.scene, this.player.position);
      this.hint(`${nft.name} subio a nivel ${nft.level}!`);
      if (nft.level >= 5) this.trackAchievement('level_5', 0);
      if (nft.level >= 10) this.trackAchievement('level_10', 0);
      if (nft.level >= 20) this.trackAchievement('level_20', 0);
      if (isLoggedIn()) apiSaveProfile(this.profile).catch(() => {});
    }
    saveProfile(this.profile);
    this.updateProfilePanel();
  }

  private updateQuest() {
    const qdef = currentQuestDef(this.profile);
    if (!qdef) {
      this.dom['quest-title'].textContent = 'Sin misiones';
      this.dom['quest-description'].textContent = 'Todas las misiones completadas.';
      return;
    }
    const qs = this.profile.quests.find((q) => !q.completed);
    if (!qs) {
      this.dom['quest-title'].textContent = 'Sin misiones';
      this.dom['quest-description'].textContent = 'Todas las misiones completadas.';
      return;
    }
    this.dom['quest-title'].textContent = qdef.title;
    const resources = Math.min(this.profile.quest.resources, qdef.requiredResources);
    const creatures = Math.min(this.profile.quest.creatures, qdef.requiredCreatures);
    this.dom['quest-description'].textContent =
      `${qdef.description} (Recursos: ${resources}/${qdef.requiredResources}, Criaturas: ${creatures}/${qdef.requiredCreatures})`;
    saveProfile(this.profile);
  }

  private craft(recipe: keyof PlayerProfile['crafted'], stationName?: string) {
    const recipes: Record<
      keyof PlayerProfile['crafted'],
      { ingredient: keyof PlayerProfile['inventory']; cost: number; name: string }
    > = {
      racion: { ingredient: 'trigo', cost: 1, name: 'Racion' },
      espada: { ingredient: 'mineral', cost: 2, name: 'Espada' },
      pocion: { ingredient: 'esencia', cost: 2, name: 'Pocion' },
      escudo: { ingredient: 'madera', cost: 2, name: 'Escudo' },
      unguento: { ingredient: 'hierba', cost: 2, name: 'Unguento' },
      armadura: { ingredient: 'mineral', cost: 3, name: 'Armadura' },
      amuleto: { ingredient: 'esencia', cost: 2, name: 'Amuleto' },
      pocion_fuerza: { ingredient: 'mineral', cost: 2, name: 'Pocion de Fuerza' },
      pocion_velocidad: { ingredient: 'hierba', cost: 2, name: 'Pocion de Velocidad' },
      antidoto: { ingredient: 'hierba', cost: 1, name: 'Antidoto' },
      gran_pocion: { ingredient: 'esencia', cost: 3, name: 'Gran Pocion' },
      elixir: { ingredient: 'esencia', cost: 4, name: 'Elixir' },
    };
    const recipeData = recipes[recipe];
    if (!recipeData) return;

    const { ingredient, cost, name } = recipeData;
    if (this.profile.inventory[ingredient] < cost) {
      this.hint(
        `Necesitas ${cost} de ${ingredient} para fabricar ${name}${stationName ? ` en ${stationName}` : ''}.`
      );
      return;
    }
    this.profile.inventory[ingredient] -= cost;
    this.profile.crafted[recipe] += 1;
    trackDailyCraft(this.dailyQuestData, 1);
    saveDailyQuests(this.dailyQuestData);
    this.trackAchievement('crafter_1', 1);
    this.trackAchievement('crafter_2', 1);
    this.trackAchievement('crafter_3', 1);
    this.addExperience(4);
    this.hint(`${name} fabricado${stationName ? ` en ${stationName}` : ''}.`);
    this.updateProfilePanel();
  }

  private increaseAttribute(stat: import('./nft').StatName) {
    const nft = this.profile.nft;
    if (this.profile.attributePoints <= 0) {
      this.hint('Sube de nivel para obtener puntos de atributo.');
      return;
    }
    this.profile.attributePoints -= 1;
    nft.baseStats[stat] += 1;
    saveProfile(this.profile);
    this.updateProfilePanel();
    this.hint(`${stat} ha aumentado.`);
  }

  private useConsumable(item: ConsumableItem) {
    if (this.profile.crafted[item] <= 0) {
      this.hint(`No tienes ${item}.`);
      return;
    }
    this.profile.crafted[item] -= 1;
    const stats = totalStats(this.profile.nft);

    switch (item) {
      case 'racion':
        this.energy = Math.min(100, this.energy + 50);
        break;
      case 'pocion':
        this.health = Math.min(this.maxHealth(), this.health + 45 + stats.ability * 2);
        break;
      case 'unguento':
        this.health = Math.min(this.maxHealth(), this.health + 25 + stats.ability);
        break;
      case 'gran_pocion':
        this.health = Math.min(this.maxHealth(), this.health + 80 + stats.ability * 3);
        break;
      case 'elixir':
        this.health = Math.min(this.maxHealth(), this.health + 100 + stats.ability * 4);
        this.energy = Math.min(100, this.energy + 50);
        break;
      case 'pocion_fuerza':
        this.applyBuff('atk', 2, 60000, 'Ataque +2 por 60 segundos.');
        break;
      case 'pocion_velocidad':
        this.applyBuff('spd', 3, 45000, 'Velocidad +3 por 45 segundos.');
        break;
      case 'antidoto':
        this.health = Math.min(this.maxHealth(), this.health + 20);
        this.hint('Efectos negativos removidos.');
        break;
    }

    saveProfile(this.profile);
    this.updateProfilePanel();
  }

  private applyBuff(stat: StatName, amount: number, duration: number, message: string) {
    const existing = this.activeBuffs.find((b) => b.stat === stat);
    if (existing) {
      clearTimeout(existing.timerId);
      this.profile.nft.baseStats[stat] -= existing.amount;
      this.activeBuffs.splice(this.activeBuffs.indexOf(existing), 1);
    }
    this.profile.nft.baseStats[stat] += amount;
    const timerId = setTimeout(() => {
      this.profile.nft.baseStats[stat] -= amount;
      const idx = this.activeBuffs.findIndex((b) => b.stat === stat && b.amount === amount);
      if (idx !== -1) this.activeBuffs.splice(idx, 1);
      this.updateProfilePanel();
    }, duration);
    this.activeBuffs.push({ stat, amount, timerId });
    this.hint(message);
  }

  private clearBuffs() {
    for (const buff of this.activeBuffs) {
      clearTimeout(buff.timerId);
      this.profile.nft.baseStats[buff.stat] -= buff.amount;
    }
    this.activeBuffs.length = 0;
  }

  private setupAbilityButtons() {
    const container = this.dom['ability-buttons'];
    if (!container) return;
    container.innerHTML = '';

    const keys = ['q', 'w'];
    this.abilities.forEach((ability, i) => {
      const btn = document.createElement('button');
      btn.className = 'ability-btn';
      btn.dataset.abilityIndex = String(i);
      btn.innerHTML = `
        <span class="ability-icon">${ability.icon}</span>
        <span class="ability-key">${keys[i]?.toUpperCase() || ''}</span>
        <span class="ability-cooldown"></span>
      `;
      btn.addEventListener('click', () => this.useAbility(i));
      btn.title = `${ability.name}: ${ability.description}`;
      container.appendChild(btn);
    });

    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'q') this.useAbility(0);
      if (e.key.toLowerCase() === 'w' && !this.isMoving) this.useAbility(1);
      if (e.key.toLowerCase() === 'm') this.minimap.toggle();
    });
  }

  private useAbility(index: number) {
    const ability = this.abilities[index];
    if (!ability) return;

    const now = performance.now();
    if (now - ability.lastUsed < ability.cooldown) {
      this.hint(`${ability.name} en enfriamiento.`);
      return;
    }

    if (this.energy < ability.energyCost) {
      this.hint(`Energia insuficiente para ${ability.name}.`);
      return;
    }

    const stats = totalStats(this.profile.nft);
    const effect = calculateAbilityEffect(ability, stats, this.profile.nft.level);

    this.energy -= ability.energyCost;
    ability.lastUsed = now;
    ability.currentCooldown = ability.cooldown;

    this.applyAbilityEffect(ability, effect);
    this.hint(`${ability.icon} ${ability.name} activado!`);

    if (effect.type === 'dash') {
      const direction = new Vector3();
      this.camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      this.dashDirection.copy(direction);
      this.dashTimer = 0.2;
    }
  }

  private applyAbilityEffect(_ability: ActiveAbility, effect: AbilityEffect) {
    switch (effect.type) {
      case 'damage': {
        const targets =
          effect.targets === 'aoe'
            ? this.enemies.filter(
                (e) => e.alive && e.mesh.position.distanceTo(this.player.position) < 6
              )
            : [this.cachedNearestEnemy];

        for (const enemy of targets) {
          if (!enemy) continue;
          const dmg = effect.value;
          enemy.health -= dmg;
          this.updateEnemyHpBar(enemy);
          this.showDamageNumber(dmg, true);

          if (enemy.health <= 0) {
            enemy.alive = false;
            enemy.mesh.visible = false;
            this.addExperience(15);
            this.profile.quest.creatures += 1;
            this.trackQuestKill(enemy);
            const drops = rollLoot(enemy.kind);
            if (drops.length > 0) {
              for (const drop of drops) {
                this.profile.inventory[drop.resource] += drop.amount;
                this.profile.loot.push(drop);
                this.profile.quest.resources += drop.amount;
              }
            }
            window.setTimeout(() => this.respawnEnemy(enemy), 18000);
          }
        }

        const boss = this.activeBoss;
        if (boss && boss.alive) {
          const bossDist = this.player.position.distanceTo(boss.mesh.position);
          if (effect.targets === 'aoe' && bossDist < 6) {
            this.damageBoss(effect.value);
          } else if (effect.targets !== 'aoe' && bossDist < 5) {
            this.damageBoss(effect.value);
          }
        }
        break;
      }
      case 'heal': {
        const healAmount = effect.value;
        this.health = Math.min(this.maxHealth(), this.health + healAmount);
        this.audio.playHeal();
        this.visuals.flashHeal();
        this.showHealNumber(healAmount);
        break;
      }
      case 'shield': {
        this.shieldActive = true;
        this.shieldHp = effect.value;
        if (effect.duration && effect.duration > 0) {
          window.setTimeout(() => {
            this.shieldActive = false;
            this.shieldHp = 0;
          }, effect.duration * 1000);
        }
        break;
      }
      case 'stun': {
        this.enemies
          .filter((e) => e.alive && e.mesh.position.distanceTo(this.player.position) < 6)
          .forEach((e) => {
            e.speed = 0;
            window.setTimeout(() => {
              e.speed = e.kind === 'golem' ? 1.2 : e.kind === 'spirit' ? 2.0 : 2.5;
            }, effect.value * 1000);
          });
        break;
      }
      case 'lifesteal': {
        const enemy = this.cachedNearestEnemy;
        if (enemy && enemy.alive) {
          const dmg = effect.value;
          enemy.health -= dmg;
          this.updateEnemyHpBar(enemy);
          this.showDamageNumber(dmg, true);
          const heal = Math.round(dmg * 0.3);
          this.health = Math.min(this.maxHealth(), this.health + heal);
          this.showHealNumber(heal);

          if (enemy.health <= 0) {
            enemy.alive = false;
            enemy.mesh.visible = false;
            this.addExperience(15);
            this.profile.quest.creatures += 1;
            this.trackQuestKill(enemy);
            window.setTimeout(() => this.respawnEnemy(enemy), 18000);
          }
        } else {
          const boss = this.activeBoss;
          if (boss && boss.alive) {
            const bossDist = this.player.position.distanceTo(boss.mesh.position);
            if (bossDist < 5) {
              const dmg = effect.value;
              this.damageBoss(dmg);
              const heal = Math.round(dmg * 0.3);
              this.health = Math.min(this.maxHealth(), this.health + heal);
              this.showHealNumber(heal);
            }
          }
        }
        break;
      }
    }
  }

  private updateAbilityCooldowns() {
    const now = performance.now();
    this.abilities.forEach((ability, i) => {
      const elapsed = now - ability.lastUsed;
      if (elapsed < ability.cooldown) {
        ability.currentCooldown = ability.cooldown - elapsed;
      } else {
        ability.currentCooldown = 0;
      }

      const btn = document.querySelector<HTMLButtonElement>(`[data-ability-index="${i}"]`);
      if (btn) {
        const cooldownEl = btn.querySelector('.ability-cooldown');
        if (ability.currentCooldown > 0) {
          btn.classList.add('on-cooldown');
          if (cooldownEl) {
            cooldownEl.textContent = `${Math.ceil(ability.currentCooldown / 1000)}s`;
          }
        } else {
          btn.classList.remove('on-cooldown');
          if (cooldownEl) cooldownEl.textContent = '';
        }
      }
    });
  }

  private async redeemReward() {
    const field = this.domInput['reward-code'];
    const reward = await validateRewardCode(field.value);
    if (!reward) {
      this.hint('Codigo de recompensa invalido.');
      return;
    }
    if (this.profile.redeemedRewards.includes(reward.id)) {
      this.hint('Esta recompensa ya fue canjeada.');
      return;
    }
    this.profile.redeemedRewards.push(reward.id);
    const stats = totalStats(this.profile.nft);
    this.health = Math.min(this.maxHealth(), this.health + reward.health + stats.ability * 2);
    this.energy = Math.min(100, this.energy + reward.energy + stats.ability);
    if (reward.resource && reward.amount) this.profile.inventory[reward.resource] += reward.amount;
    saveProfile(this.profile);
    this.updateProfilePanel();
    field.value = '';
    this.hint(`${reward.label} recibido.`);
  }

  private resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight, false);
  }
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
    this.dom['health-bar'].style.width = `${(this.health / maxHealth) * 100}%`;
    this.dom['health-value'].textContent = `${Math.round(this.health)} / ${maxHealth}`;
    this.dom['energy-bar'].style.width = `${this.energy}%`;
    this.dom['energy-value'].textContent = `${Math.round(this.energy)} / 100`;
    const xpRequired = xpForLevel(this.profile.nft.level);
    this.dom['xp-bar'].style.width = `${(this.profile.nft.xp / xpRequired) * 100}%`;
    this.dom['xp-value'].textContent = `${this.profile.nft.xp} / ${xpRequired}`;
  }
  private updateTarget() {
    const enemy = this.cachedNearestEnemy;
    const boss = this.activeBoss;
    const bossDist =
      boss && boss.alive ? this.player.position.distanceTo(boss.mesh.position) : Infinity;
    const enemyDist = enemy ? this.player.position.distanceTo(enemy.mesh.position) : Infinity;

    const showBoss = boss && boss.alive && bossDist < enemyDist && bossDist < 8;
    const showEnemy = enemy && enemyDist < 8 && !showBoss;

    const card = this.dom['target-card'];
    if (showBoss) {
      card.hidden = false;
      this.dom['target-name'].textContent = `👑 ${boss!.definition.name}`;
      this.dom['target-health'].style.width = `${(boss!.health / boss!.maxHealth) * 100}%`;
    } else if (showEnemy) {
      card.hidden = false;
      this.dom['target-name'].textContent = enemy!.name;
      this.dom['target-health'].style.width = `${(enemy!.health / enemy!.maxHealth) * 100}%`;
    } else {
      card.hidden = true;
    }
  }
  private cacheNearestEnemy() {
    let closest: Enemy | null = null;
    let minDist = Infinity;
    for (const candidate of this.enemies) {
      if (!candidate.alive) continue;
      const dx = this.player.position.x - candidate.mesh.position.x;
      const dz = this.player.position.z - candidate.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < minDist) {
        minDist = dist;
        closest = candidate;
      }
    }
    this.cachedNearestEnemy = closest;
    this.cachedNearestEnemyDist = minDist;
  }
  private cacheDom() {
    const ids = [
      'ability-buttons',
      'ability-value',
      'amuleto-count',
      'antidoto-count',
      'armadura-count',
      'atk-value',
      'attack-button',
      'attribute-points',
      'battlepass-button',
      'battlepass-panel',
      'battlepass-progress',
      'battlepass-tiers',
      'battlepass-title',
      'boss-card',
      'boss-enrage',
      'boss-health',
      'boss-name',
      'boss-phase',
      'clear-cache-button',
      'close-battlepass',
      'close-daily',
      'close-dialog',
      'close-inventory',
      'close-leaderboard',
      'close-rewards',
      'close-settings',
      'close-trade',
      'compass-arrow',
      'compass-label',
      'daily-button',
      'daily-panel',
      'daily-quests',
      'daily-streak',
      'damage-numbers',
      'def-value',
      'dialog-name',
      'dialog-panel',
      'dialog-text',
      'elixir-count',
      'energy-bar',
      'energy-value',
      'escudo-count',
      'esencia-count',
      'espada-count',
      'game-canvas',
      'gran_pocion-count',
      'health-bar',
      'health-value',
      'hierba-count',
      'hint',
      'hp-value',
      'install-button',
      'interact-button',
      'intro',
      'inventory-button',
      'inventory-panel',
      'joystick',
      'joystick-knob',
      'leaderboard-button',
      'leaderboard-list',
      'leaderboard-panel',
      'level-value',
      'levelup-flash',
      'login-error',
      'login-password',
      'login-phone',
      'login-register',
      'login-screen',
      'login-submit',
      'madera-count',
      'mineral-count',
      'mute-toggle',
      'nft-back',
      'nft-body-type',
      'nft-element',
      'nft-enter',
      'nft-generate',
      'nft-id',
      'nft-name',
      'nft-preview',
      'nft-rarity',
      'nft-screen',
      'nft-stats',
      'pocion-count',
      'pocion_fuerza-count',
      'pocion_velocidad-count',
      'profession-name',
      'qr-video',
      'quality-select',
      'quest-description',
      'quest-title',
      'racion-count',
      'reward-button',
      'reward-code',
      'reward-form',
      'reward-panel',
      'scan-qr-button',
      'scan-status',
      'settings-button',
      'settings-panel',
      'spd-value',
      'target-card',
      'target-health',
      'target-name',
      'trade-name',
      'trade-offers',
      'trade-panel',
      'trigo-count',
      'unguento-count',
      'xp-bar',
      'xp-value',
      'zone-label',
    ];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) this.dom[id] = el;
    }
    this.domInput['qr-video'] = document.getElementById('qr-video') as HTMLInputElement;
    this.domInput['reward-code'] = document.getElementById('reward-code') as HTMLInputElement;
    this.domSelect['quality-select'] = document.getElementById(
      'quality-select'
    ) as HTMLSelectElement;
  }
  private updateProfilePanel() {
    const nft = this.profile.nft;
    const stats = totalStats(nft);
    this.dom['profession-name'].textContent = `${nft.name} (Lv.${nft.level})`;
    this.dom['level-value'].textContent = `${nft.xp} / ${xpForLevel(nft.level)} EXP`;
    (Object.keys(this.profile.inventory) as Array<keyof PlayerProfile['inventory']>).forEach(
      (key) => {
        const el = this.dom[`${key}-count`];
        if (el) el.textContent = String(this.profile.inventory[key]);
      }
    );
    (Object.keys(this.profile.crafted) as Array<keyof PlayerProfile['crafted']>).forEach((key) => {
      const el = this.dom[`${key}-count`];
      if (el) el.textContent = String(this.profile.crafted[key]);
    });
    this.dom['attribute-points'].textContent = String(this.profile.attributePoints);
    const statKeys = ['atk', 'def', 'spd', 'hp', 'ability'] as const;
    for (const key of statKeys) {
      const el = this.dom[`${key}-value`];
      if (el) el.textContent = String(stats[key]);
    }
  }
  private updateZoneLabel() {
    const labels: Record<string, string> = {
      aldea: 'Aldea',
      bosque: 'Bosque Ancestral',
      ruinas: 'Ruinas Antiguas',
      desierto: 'Desierto Ardiente',
      cueva: 'Cueva Profunda',
    };
    this.dom['zone-label'].textContent = labels[this.currentZone] ?? this.currentZone;
  }
  private toggleInventory(force?: boolean) {
    const panel = this.dom['inventory-panel'];
    panel.hidden = force ?? !panel.hidden;
  }
  private toggleRewards(force?: boolean) {
    const panel = this.dom['reward-panel'];
    panel.hidden = force ?? !panel.hidden;
    if (panel.hidden) {
      this.qrScanner.stop();
      this.domInput['qr-video'].hidden = true;
    }
  }
  private toggleSettings(force?: boolean) {
    const panel = this.dom['settings-panel'];
    panel.hidden = force ?? !panel.hidden;
  }
  private toggleDailyQuests(force?: boolean) {
    const panel = this.dom['daily-panel'];
    panel.hidden = force ?? !panel.hidden;
    if (!panel.hidden) this.updateDailyQuestsUI();
  }
  private updateDailyQuestsUI() {
    const data = this.dailyQuestData;
    const streakEl = this.dom['daily-streak'];
    if (streakEl)
      streakEl.textContent = `Racha: ${data.loginStreak} dia${data.loginStreak > 1 ? 's' : ''}`;
    const container = this.dom['daily-quests'];
    if (!container) return;
    container.innerHTML = '';
    const status = getDailyQuestStatus(data);
    for (let i = 0; i < data.quests.length; i++) {
      const quest = data.quests[i];
      const state = data.states[i];
      const item = document.createElement('div');
      item.className = `daily-quest-item${state.completed ? ' completed' : ''}${state.claimed ? ' claimed' : ''}`;
      const progress = Math.min(state.progress, quest.required);
      const pct = Math.round((progress / quest.required) * 100);
      let rewardText = `+${quest.rewardXp} EXP`;
      if (quest.rewardResource && quest.rewardAmount)
        rewardText += ` +${quest.rewardAmount} ${quest.rewardResource}`;
      item.innerHTML = `
        <div class="daily-quest-title">${quest.title}</div>
        <div class="daily-quest-desc">${quest.description}</div>
        <div class="daily-quest-progress"><b style="width:${pct}%"></b></div>
        <div class="daily-quest-reward">${progress}/${quest.required} — ${rewardText}</div>
        <button class="daily-claim-btn" data-daily-index="${i}" ${state.completed && !state.claimed ? '' : 'disabled'}>${state.claimed ? 'Reclamado' : state.completed ? 'Reclamar' : 'En progreso'}</button>
      `;
      container.appendChild(item);
    }
    container.querySelectorAll<HTMLButtonElement>('.daily-claim-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.dailyIndex);
        this.claimDailyQuest(idx);
      });
    });
    const claimed = status.claimed;
    const total = status.total;
    if (claimed === total) {
      const done = document.createElement('div');
      done.style.cssText = 'text-align:center;color:#44cc88;font-size:11px;margin-top:8px;';
      done.textContent = '¡Todas las misiones diarias completadas!';
      container.appendChild(done);
    }
  }
  private claimDailyQuest(index: number) {
    const result = claimDailyQuest(this.dailyQuestData, index);
    if (!result) return;
    saveDailyQuests(this.dailyQuestData);
    this.profile.nft.xp += result.xp;
    if (result.resource && result.amount) {
      this.profile.inventory[result.resource] += result.amount;
    }
    this.hint(
      `Mision diaria reclamada. +${result.xp} EXP${result.streakBonus > 0 ? ` (+${result.streakBonus} bonus racha)` : ''}`
    );
    this.updateDailyQuestsUI();
    this.updateProfilePanel();
    saveProfile(this.profile);
  }
  private toggleLeaderboard(force?: boolean) {
    const panel = this.dom['leaderboard-panel'];
    panel.hidden = force ?? !panel.hidden;
    if (!panel.hidden) this.updateLeaderboardUI();
  }
  private updateLeaderboardUI() {
    const elapsed = Math.floor((Date.now() - this.sessionStartTime) / 1000);
    const playerScore = calculateScore(
      this.currentZone,
      this.sessionKills,
      this.sessionBossKills,
      elapsed,
      this.profile.nft.level
    );
    this.leaderboard = submitScore(
      this.leaderboard,
      this.profile.nft.name,
      this.profile.nft.level,
      this.profile.nft.traits.element,
      playerScore,
      this.currentZone
    );
    const container = this.dom['leaderboard-list'];
    if (!container) return;
    container.innerHTML = '';
    const rank = getRank(this.leaderboard, this.profile.nft.name);
    const entries = this.leaderboard.slice(0, 20);
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const entry = document.createElement('div');
      entry.className = `lb-entry${e.name === this.profile.nft.name ? ' self' : ''}`;
      entry.innerHTML = `
        <span class="lb-rank">${i + 1}</span>
        <span class="lb-name">${e.name}</span>
        <span class="lb-level">Lv.${e.level}</span>
        <span class="lb-score">${e.score}</span>
      `;
      container.appendChild(entry);
    }
    const footer = document.createElement('div');
    footer.style.cssText = 'text-align:center;color:#aaa88a;font-size:10px;margin-top:8px;';
    footer.textContent = `Tu rango: #${rank} — Puntos: ${playerScore}`;
    container.appendChild(footer);
  }
  private toggleBattlePass(force?: boolean) {
    const panel = this.dom['battlepass-panel'];
    panel.hidden = force ?? !panel.hidden;
    if (!panel.hidden) this.updateBattlePassUI();
  }
  private updateBattlePassUI() {
    const progress = getBattlePassProgress(this.battlePass);
    const tiers = getBattlePassTiers();
    const title = this.dom['battlepass-title'];
    if (title) title.textContent = `Nivel ${progress.tier}`;
    const barContainer = this.dom['battlepass-progress'];
    if (barContainer) barContainer.innerHTML = `<b style="width:${progress.pct}%"></b>`;
    const container = this.dom['battlepass-tiers'];
    if (!container) return;
    container.innerHTML = '';
    const displayTiers = tiers.filter((t) => t.level <= progress.tier + 2 && t.level > 0);
    for (const tier of displayTiers) {
      const claimed = this.battlePass.claimedTiers.includes(tier.level);
      const available = !claimed && progress.tier >= tier.level;
      const tierEl = document.createElement('div');
      tierEl.className = `bp-tier${claimed ? ' claimed' : ''}${available ? ' available' : ''}`;
      tierEl.innerHTML = `
        <span class="bp-level">${tier.level}</span>
        <span class="bp-reward">${tier.label}</span>
        <button class="bp-claim-btn" data-bp-tier="${tier.level}" ${available ? '' : 'disabled'}>${claimed ? 'Reclamado' : available ? 'Reclamar' : 'Bloqueado'}</button>
      `;
      container.appendChild(tierEl);
    }
    container.querySelectorAll<HTMLButtonElement>('.bp-claim-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.claimBattlePassTier(Number(btn.dataset.bpTier));
      });
    });
  }
  private claimBattlePassTier(tierLevel: number) {
    const result = claimBattlePassTier(this.battlePass, tierLevel);
    if (!result) return;
    saveBattlePass(this.battlePass);
    if (result.rewardType === 'xp') {
      this.profile.nft.xp += result.rewardAmount;
    } else if (result.rewardType === 'resource') {
      this.profile.inventory[result.rewardId as keyof typeof this.profile.inventory] +=
        result.rewardAmount;
    } else if (result.rewardType === 'crafted') {
      this.profile.crafted[result.rewardId as keyof typeof this.profile.crafted] +=
        result.rewardAmount;
    }
    this.hint(`Recompensa reclamada: ${result.rewardAmount}x ${result.rewardId}`);
    this.updateBattlePassUI();
    this.updateProfilePanel();
    saveProfile(this.profile);
  }
  private hint(message: string) {
    this.dom['hint'].textContent = message;
  }
  private updateAnimations(delta: number) {
    if (this.attackAnimTimer > 0) {
      this.attackAnimTimer -= delta;
      if (this.attackAnimTimer <= 0) {
        this.player.scale.setScalar(1);
        this.attackAnimTimer = 0;
      }
    }
    if (this.levelupFlashTimer > 0) {
      this.levelupFlashTimer -= delta;
      const flash = this.dom['levelup-flash'];
      if (this.levelupFlashTimer > 0) flash.classList.add('active');
      else flash.classList.remove('active');
    }
  }
  private showDamageNumber(amount: number, isAbility = false) {
    const container = this.dom['damage-numbers'];
    const num = document.createElement('div');
    num.className = 'damage-num';
    num.textContent = `-${amount}`;
    num.style.left = `${50 + (Math.random() - 0.5) * 20}%`;
    num.style.top = '45%';
    if (isAbility) {
      num.style.color = '#ffaa00';
      num.style.fontSize = '18px';
    }
    container.appendChild(num);
    window.setTimeout(() => num.remove(), 900);
  }

  private showHealNumber(amount: number) {
    const container = this.dom['damage-numbers'];
    const num = document.createElement('div');
    num.className = 'damage-num';
    num.textContent = `+${amount}`;
    num.style.left = `${50 + (Math.random() - 0.5) * 20}%`;
    num.style.top = '45%';
    num.style.color = '#44ff44';
    num.style.fontSize = '16px';
    container.appendChild(num);
    window.setTimeout(() => num.remove(), 900);
  }
  private maxHealth() {
    return 100 + totalStats(this.profile.nft).hp * 8;
  }
  private updateCompass() {
    const arrow = this.dom['compass-arrow'];
    const label = this.dom['compass-label'];
    if (!arrow || !label) return;
    if (this.portals.length === 0) {
      arrow.style.opacity = '0';
      label.textContent = '';
      return;
    }
    let nearest: import('./zones').ZonePortal | null = null;
    let minDist = Infinity;
    for (const p of this.portals) {
      const dx = p.position.x - this.player.position.x;
      const dz = p.position.z - this.player.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < minDist) {
        minDist = dist;
        nearest = p;
      }
    }
    if (!nearest) {
      arrow.style.opacity = '0';
      label.textContent = '';
      return;
    }
    const dx = nearest.position.x - this.player.position.x;
    const dz = nearest.position.z - this.player.position.z;
    const angle = Math.atan2(dx, dz) * (180 / Math.PI) + 180;
    arrow.style.transform = `rotate(${angle}deg)`;
    arrow.style.opacity = '1';
    const zoneNames: Record<string, string> = {
      aldea: 'Aldea',
      bosque: 'Bosque',
      ruinas: 'Ruinas',
      desierto: 'Desierto',
      cueva: 'Cueva',
    };
    label.textContent = zoneNames[nearest.targetZone] ?? nearest.targetZone;
  }
}
