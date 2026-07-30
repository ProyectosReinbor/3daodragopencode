import { Clock, Group, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { InputController } from './input';
import {
  saveProfile,
  migrateProfile,
  type PlayerProfile,
  type ZoneId,
  currentQuestDef,
  advanceQuest,
} from './profile';
import { createWorld, type Enemy, type ResourceNode } from './world';
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
import { buildNftModel, xpForLevel, type StatName } from './nft';
import { apiSaveProfile, isLoggedIn } from './api';

import { CharacterManager, totalStats as characterTotalStats } from './characters';
import { RECIPES, type RecipeId } from './recipes';
import { canCraft, performCraft } from './crafting';
import {
  useConsumable,
  applyBuffToCharacter,
  clearBuffsFromCharacter,
  type ConsumableItem,
} from './items';
import { updateAchievement } from './achievements';

import { GameUI } from './game-ui';
import { Minimap } from './minimap';
import { CombatManager } from './combat';
import { AudioManager } from './audio';
import {
  loadDailyQuests,
  saveDailyQuests,
  updateLoginStreak,
  trackDailyCollect,
  trackDailyExplore,
} from './daily-quests';
import { VisualEffects } from './visual';
import { loadLeaderboard, type LeaderboardEntry } from './leaderboard';
import { loadBattlePass, type BattlePassState } from './battlepass';

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
  private readonly combat: CombatManager;
  private resources: ResourceNode[] = [];
  private npcs: Npc[] = [];
  private stations: CraftingStation[] = [];
  private portals: ZonePortal[] = [];
  private readonly qrScanner: QrScanner;
  private quality = getQuality();
  private readonly characters: CharacterManager;
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
  private dashTimer = 0;
  private dashDirection = new Vector3();
  private readonly cameraOffset = new Vector3(0, 7.5, 9);
  private readonly tempVec = new Vector3();
  private readonly activeBuffs: ActiveBuff[] = [];
  private readonly dom = {} as Record<string, HTMLElement>;
  private readonly domInput = {} as Record<string, HTMLInputElement>;
  private readonly domButton = {} as Record<string, HTMLButtonElement>;
  private readonly domSelect = {} as Record<string, HTMLSelectElement>;
  private readonly minimap: Minimap;
  private readonly ui: GameUI;
  private readonly audio: AudioManager;
  private readonly visuals: VisualEffects;
  private dailyQuestData: ReturnType<typeof loadDailyQuests>;
  private leaderboard: LeaderboardEntry[];
  private battlePass: BattlePassState;
  private sessionStartTime = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly profile: PlayerProfile
  ) {
    migrateProfile(this.profile);
    this.characters = new CharacterManager(this.profile.characters!);
    this.player = buildNftModel(this.characters.getActive() as any);
    this.renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(pixelRatioFor(this.quality));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = 'srgb';
    this.scene.add(this.player);
    this.cacheDom();
    this.ui = new GameUI(this.profile, this.characters, this.dom, (msg) => this.hint(msg));
    this.currentZone = profile.currentZone || 'aldea';
    this.minimap = new Minimap();
    this.audio = new AudioManager();
    this.visuals = new VisualEffects();
    this.combat = new CombatManager(
      this.player,
      this.camera,
      this.scene,
      this.audio,
      this.visuals,
      this.characters,
      this.ui,
      {
        hint: (msg) => this.hint(msg),
        trackAchievement: (id, amount) => this.trackAchievement(id, amount),
        updateQuest: () => this.updateQuest(),
        updateProfilePanel: () => this.updateProfilePanel(),
        addExperience: (amount) => this.addExperience(amount),
        notifyKill: (enemy) => this.trackQuestKill(enemy),
        onPlayerDeath: () => {
          this.clearBuffs();
          const cfg = zoneConfig(this.currentZone);
          this.player.position.set(cfg.playerStart.x, 0, cfg.playerStart.z);
          this.player.scale.setScalar(1);
        },
      }
    );
    this.loadZone(this.currentZone);
    this.combat.initAbilities();
    this.camera.position.set(0, 7.5, 9);

    this.input = new InputController(
      this.dom['joystick'],
      this.dom['joystick-knob'],
      () => this.attackButtonHandler(),
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
    const stats = characterTotalStats(this.characters.getActive());
    const now = performance.now();
    if (isLoggedIn() && now - this.lastServerSave > this.SAVE_INTERVAL) {
      this.lastServerSave = now;
      apiSaveProfile(this.profile).catch(() => {});
    }

    const spdMul = 1 + (stats.spd - 5) * 0.04;
    if (direction.lengthSq() > 0) {
      const speed = 4.2 * spdMul;
      this.player.position.x += direction.x * speed * delta;
      this.player.position.z += direction.y * speed * delta;
      this.player.rotation.y = Math.atan2(direction.x, direction.y);
      this.combat.energy = Math.max(
        0,
        this.combat.energy - delta * 1.2 * Math.max(0.65, 1 - stats.spd * 0.02)
      );
      this.isMoving = true;
      this.bobPhase += delta * 12;
    } else {
      this.combat.energy = Math.min(100, this.combat.energy + delta * 2.8);
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
    this.combat.update(delta, this.profile);
    this.updateBossCard();
    this.autoCollect();
    this.checkInteractProximity();
    this.updateCompass();
    this.minimap.update(
      this.player.position.x,
      this.player.position.z,
      this.player.rotation.y,
      zoneConfig(this.currentZone).groundSize,
      this.combat.enemies,
      this.npcs,
      this.stations,
      this.portals,
      this.combat.activeBoss,
      this.combat.bossMinions,
      this.currentZone
    );
    this.visuals.update(delta, this.player.position.x, this.player.position.z);
    this.updateAnimations(delta);
    this.updateAbilityCooldowns();
    if (this.combat.bossWarning > 0) {
      const warning = this.dom['levelup-flash'];
      warning.classList.add('active');
      warning.style.background = 'rgba(255, 50, 0, 0.3)';
    } else {
      this.dom['levelup-flash']?.classList.remove('active');
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

  private trackQuestKill(_enemy: Enemy) {
    const qdef = currentQuestDef(this.profile);
    if (!qdef || qdef.zone !== this.currentZone) return;
    const resources = Math.min(this.profile.quest.resources, qdef.requiredResources);
    const creatures = Math.min(this.profile.quest.creatures, qdef.requiredCreatures);
    if (resources >= qdef.requiredResources && creatures >= qdef.requiredCreatures) {
      const qs = this.profile.quests.find((q) => !q.completed);
      if (!qs) return;
      qs.completed = true;
      this.characters.getActive().xp += qdef.rewardExp;
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
    this.combat.enemies = world.enemies;
    this.resources = world.resources;
    this.npcs = world.npcs;
    this.stations = world.stations;
    this.portals = world.portals;
    this.combat.activeBoss = world.boss;
    this.combat.bossMinions.clear();
    this.currentZone = zone;
    this.minimap.resetFog();
    this.audio.startZoneAmbient(zone);
    this.visuals.setWeather(this.scene, zone);
    if (this.combat.activeBoss) {
      this.hint(`⚠ ¡${this.combat.activeBoss.definition.name} acecha en esta zona!`);
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

  private addExperience(amount: number) {
    const activeChar = this.characters.getActive();
    activeChar.xp += amount;
    const required = xpForLevel(activeChar.level);
    if (activeChar.xp >= required) {
      activeChar.xp -= required;
      activeChar.level += 1;
      this.profile.attributePoints += 1;
      this.levelupFlashTimer = 0.6;
      this.audio.playLevelUp();
      this.visuals.flashLevelUp();
      this.visuals.spawnLevelUpBurst(this.scene, this.player.position);
      this.hint(`${activeChar.name} subio a nivel ${activeChar.level}!`);
      if (activeChar.level >= 5) this.trackAchievement('level_5', 0);
      if (activeChar.level >= 10) this.trackAchievement('level_10', 0);
      if (activeChar.level >= 20) this.trackAchievement('level_20', 0);
      if (isLoggedIn()) apiSaveProfile(this.profile).catch(() => {});
    }
    saveProfile(this.profile);
    this.updateProfilePanel();
  }

  private updateQuest() {
    this.ui.updateQuest();
  }

  private craft(recipe: keyof PlayerProfile['crafted'], stationName?: string) {
    if (!canCraft(this.profile, recipe as RecipeId)) {
      const def = RECIPES[recipe as RecipeId];
      if (!def) return;
      this.hint(
        `Necesitas ${def.cost} de ${def.ingredient} para fabricar ${def.name}${stationName ? ` en ${stationName}` : ''}.`
      );
      return;
    }
    const msg = performCraft(this.profile, recipe as RecipeId, this.dailyQuestData, stationName);
    if (!msg) return;
    this.trackAchievement('crafter_1', 1);
    this.trackAchievement('crafter_2', 1);
    this.trackAchievement('crafter_3', 1);
    this.addExperience(4);
    this.hint(msg);
    this.updateProfilePanel();
  }

  private increaseAttribute(stat: import('./nft').StatName) {
    const activeChar = this.characters.getActive();
    if (this.profile.attributePoints <= 0) {
      this.hint('Sube de nivel para obtener puntos de atributo.');
      return;
    }
    this.profile.attributePoints -= 1;
    activeChar.baseStats[stat] += 1;
    saveProfile(this.profile);
    this.updateProfilePanel();
    this.hint(`${stat} ha aumentado.`);
  }

  private useConsumable(item: ConsumableItem) {
    const result = useConsumable(item, this.profile, this.characters);
    if (!result) {
      this.hint(`No tienes ${item}.`);
      return;
    }

    if (result.healthDelta > 0) {
      this.combat.health = Math.min(this.maxHealth(), this.combat.health + result.healthDelta);
    }
    if (result.energyDelta > 0) {
      this.combat.energy = Math.min(100, this.combat.energy + result.energyDelta);
    }
    if (result.buff) {
      const b = result.buff;
      applyBuffToCharacter(
        this.characters.getActive(),
        b.stat,
        b.amount,
        b.duration,
        this.activeBuffs,
        () => this.updateProfilePanel()
      );
      this.hint(b.message);
    }

    saveProfile(this.profile);
    this.updateProfilePanel();
  }

  private applyBuff(stat: StatName, amount: number, duration: number, message: string) {
    applyBuffToCharacter(
      this.characters.getActive(),
      stat,
      amount,
      duration,
      this.activeBuffs,
      () => this.updateProfilePanel()
    );
    this.hint(message);
  }

  private clearBuffs() {
    clearBuffsFromCharacter(this.characters.getActive(), this.activeBuffs);
  }

  private setupAbilityButtons() {
    const container = this.dom['ability-buttons'];
    if (!container) return;
    container.innerHTML = '';

    const keys = ['q', 'w'];
    this.combat.abilities.forEach((ability, i) => {
      const btn = document.createElement('button');
      btn.className = 'ability-btn';
      btn.dataset.abilityIndex = String(i);
      btn.innerHTML = `
        <span class="ability-icon">${ability.icon}</span>
        <span class="ability-key">${keys[i]?.toUpperCase() || ''}</span>
        <span class="ability-cooldown"></span>
      `;
      btn.addEventListener('click', () => this.abilityButtonHandler(i));
      btn.title = `${ability.name}: ${ability.description}`;
      container.appendChild(btn);
    });

    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'q') this.abilityButtonHandler(0);
      if (e.key.toLowerCase() === 'w' && !this.isMoving) this.abilityButtonHandler(1);
      if (e.key.toLowerCase() === 'm') this.minimap.toggle();
    });
  }

  private attackButtonHandler() {
    const initiated = this.combat.attack(this.profile, this.dailyQuestData, this.battlePass);
    if (initiated) {
      this.attackAnimTimer = 0.25;
      this.player.scale.setScalar(1.12);
      this.audio.playAttack();
    }
  }

  private abilityButtonHandler(index: number) {
    const result = this.combat.useAbility(
      index,
      this.profile,
      this.dailyQuestData,
      this.battlePass
    );
    if (result) {
      this.dashDirection.copy(result.dashDirection);
      this.dashTimer = 0.2;
    }
  }

  private updateAbilityCooldowns() {
    const now = performance.now();
    this.combat.abilities.forEach((ability, i) => {
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
    const stats = characterTotalStats(this.characters.getActive());
    this.combat.health = Math.min(
      this.maxHealth(),
      this.combat.health + reward.health + stats.ability * 2
    );
    this.combat.energy = Math.min(100, this.combat.energy + reward.energy + stats.ability);
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
    this.ui.updateHud(this.combat.health, this.combat.energy);
  }
  private updateTarget() {
    this.ui.updateTarget(
      this.combat.enemies,
      this.combat.activeBoss,
      this.player.position.x,
      this.player.position.z
    );
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
    this.ui.updateProfilePanel();
  }
  private updateZoneLabel() {
    this.ui.updateZoneLabel(this.currentZone);
  }
  private toggleInventory(force?: boolean) {
    this.ui.togglePanel('inventory-panel', force);
  }
  private toggleRewards(force?: boolean) {
    const hidden = this.ui.togglePanel('reward-panel', force);
    if (hidden) {
      this.qrScanner.stop();
      this.domInput['qr-video'].hidden = true;
    }
  }
  private toggleSettings(force?: boolean) {
    this.ui.togglePanel('settings-panel', force);
  }
  private toggleDailyQuests(force?: boolean) {
    const hidden = this.ui.togglePanel('daily-panel', force);
    if (!hidden) this.updateDailyQuestsUI();
  }
  private updateDailyQuestsUI() {
    this.ui.updateDailyQuestsUI(this.dailyQuestData, (idx) => this.claimDailyQuest(idx));
  }
  private claimDailyQuest(index: number) {
    this.dailyQuestData =
      this.ui.claimDailyQuest(this.dailyQuestData, index, this.profile) ?? this.dailyQuestData;
    this.updateProfilePanel();
    this.updateDailyQuestsUI();
  }
  private toggleLeaderboard(force?: boolean) {
    const hidden = this.ui.togglePanel('leaderboard-panel', force);
    if (!hidden) this.updateLeaderboardUI();
  }
  private updateLeaderboardUI() {
    const activeChar = this.characters.getActive();
    this.leaderboard = this.ui.updateLeaderboardUI(
      this.profile,
      this.leaderboard,
      this.currentZone,
      this.combat.sessionKills,
      this.combat.sessionBossKills,
      this.sessionStartTime,
      activeChar.name,
      activeChar.level,
      activeChar.traits.element
    );
  }
  private toggleBattlePass(force?: boolean) {
    const hidden = this.ui.togglePanel('battlepass-panel', force);
    if (!hidden) this.updateBattlePassUI();
  }
  private updateBattlePassUI() {
    this.ui.updateBattlePassUI(this.battlePass, (tier) => this.claimBattlePassTier(tier));
  }
  private claimBattlePassTier(tierLevel: number) {
    this.battlePass = this.ui.claimBattlePassTier(this.battlePass, tierLevel, this.profile);
    this.updateBattlePassUI();
  }
  private hint(message: string) {
    this.dom['hint'].textContent = message;
  }
  private updateAnimations(delta: number) {
    const result = this.ui.updateAnimations(this.attackAnimTimer, this.levelupFlashTimer, delta);
    this.attackAnimTimer = result.attackAnimTimer;
    this.levelupFlashTimer = result.levelupFlashTimer;
  }
  private maxHealth() {
    return 100 + characterTotalStats(this.characters.getActive()).hp * 8;
  }
  private updateCompass() {
    this.ui.updateCompass(this.portals, this.player.position.x, this.player.position.z);
  }
  private updateBossCard() {
    const boss = this.combat.activeBoss;
    const card = this.dom['boss-card'];
    if (!boss || !boss.alive) {
      if (card) card.hidden = true;
      return;
    }
    if (!card) return;
    const ratio = Math.max(0, boss.health / boss.maxHealth);
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
