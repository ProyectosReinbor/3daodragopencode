import type { PlayerProfile, ZoneId } from './profile';
import type { CharacterManager } from './characters';
import { totalStats as characterTotalStats, type Character } from './characters';
import { xpForLevel } from './nft';
import { currentQuestDef } from './profile';
import { type Enemy } from './world';
import { type ActiveBoss } from './bosses';
import { type ZonePortal } from './zones';
import { saveProfile } from './profile';
import {
  saveDailyQuests,
  claimDailyQuest as claimDaily,
  getDailyQuestStatus,
} from './daily-quests';
import type { DailyQuestData } from './daily-quests';
import {
  saveBattlePass,
  claimBattlePassTier as claimBP,
  getBattlePassTiers,
  getBattlePassProgress,
} from './battlepass';
import type { BattlePassState } from './battlepass';
import { calculateScore, submitScore, getRank, type LeaderboardEntry } from './leaderboard';

export class GameUI {
  private readonly dom: Record<string, HTMLElement>;
  private readonly char: CharacterManager;

  constructor(
    private readonly profile: PlayerProfile,
    chars: CharacterManager,
    private readonly domRef: Record<string, HTMLElement>,
    private readonly hint: (msg: string) => void
  ) {
    this.dom = domRef;
    this.char = chars;
  }

  get activeChar(): Character {
    return this.char.getActive();
  }

  updateHud(health: number, energy: number) {
    const maxHealth = 100 + characterTotalStats(this.activeChar).hp * 8;
    this.dom['health-bar'].style.width = `${(health / maxHealth) * 100}%`;
    this.dom['health-value'].textContent = `${Math.round(health)} / ${maxHealth}`;
    this.dom['energy-bar'].style.width = `${energy}%`;
    this.dom['energy-value'].textContent = `${Math.round(energy)} / 100`;
    const xpRequired = xpForLevel(this.activeChar.level);
    this.dom['xp-bar'].style.width = `${(this.activeChar.xp / xpRequired) * 100}%`;
    this.dom['xp-value'].textContent = `${this.activeChar.xp} / ${xpRequired}`;
  }

  updateTarget(enemies: Enemy[], activeBoss: ActiveBoss | null, playerX: number, playerZ: number) {
    let closestEnemy: Enemy | null = null;
    let minDist = Infinity;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = playerX - e.mesh.position.x;
      const dz = playerZ - e.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < minDist) {
        minDist = dist;
        closestEnemy = e;
      }
    }

    const boss = activeBoss;
    const bossDist =
      boss && boss.alive
        ? Math.sqrt((playerX - boss.mesh.position.x) ** 2 + (playerZ - boss.mesh.position.z) ** 2)
        : Infinity;
    const enemyDist = closestEnemy
      ? Math.sqrt(
          (playerX - closestEnemy.mesh.position.x) ** 2 +
            (playerZ - closestEnemy.mesh.position.z) ** 2
        )
      : Infinity;

    const showBoss = boss && boss.alive && bossDist < enemyDist && bossDist < 8;
    const showEnemy = closestEnemy && enemyDist < 8 && !showBoss;

    const card = this.dom['target-card'];
    if (showBoss) {
      card.hidden = false;
      this.dom['target-name'].textContent = `👑 ${boss!.definition.name}`;
      this.dom['target-health'].style.width = `${(boss!.health / boss!.maxHealth) * 100}%`;
    } else if (showEnemy) {
      card.hidden = false;
      this.dom['target-name'].textContent = closestEnemy!.name;
      this.dom['target-health'].style.width =
        `${(closestEnemy!.health / closestEnemy!.maxHealth) * 100}%`;
    } else {
      card.hidden = true;
    }
  }

  updateProfilePanel() {
    const stats = characterTotalStats(this.activeChar);
    this.dom['profession-name'].textContent =
      `${this.activeChar.name} (Lv.${this.activeChar.level})`;
    this.dom['level-value'].textContent =
      `${this.activeChar.xp} / ${xpForLevel(this.activeChar.level)} EXP`;
    for (const key of Object.keys(this.profile.inventory) as Array<
      keyof typeof this.profile.inventory
    >) {
      const el = this.dom[`${key}-count`];
      if (el) el.textContent = String(this.profile.inventory[key]);
    }
    for (const key of Object.keys(this.profile.crafted) as Array<
      keyof typeof this.profile.crafted
    >) {
      const el = this.dom[`${key}-count`];
      if (el) el.textContent = String(this.profile.crafted[key]);
    }
    this.dom['attribute-points'].textContent = String(this.profile.attributePoints);
    const statKeys = ['atk', 'def', 'spd', 'hp', 'ability'] as const;
    for (const key of statKeys) {
      const el = this.dom[`${key}-value`];
      if (el) el.textContent = String(stats[key]);
    }
  }

  updateQuest() {
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

  updateZoneLabel(currentZone: ZoneId) {
    const labels: Record<string, string> = {
      aldea: 'Aldea',
      bosque: 'Bosque Ancestral',
      ruinas: 'Ruinas Antiguas',
      desierto: 'Desierto Ardiente',
      cueva: 'Cueva Profunda',
    };
    this.dom['zone-label'].textContent = labels[currentZone] ?? currentZone;
  }

  updateCompass(portals: ZonePortal[], playerX: number, playerZ: number) {
    const arrow = this.dom['compass-arrow'];
    const label = this.dom['compass-label'];
    if (!arrow || !label) return;
    if (portals.length === 0) {
      arrow.style.opacity = '0';
      label.textContent = '';
      return;
    }
    let nearest: ZonePortal | null = null;
    let minDist = Infinity;
    for (const p of portals) {
      const dx = p.position.x - playerX;
      const dz = p.position.z - playerZ;
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
    const dx = nearest.position.x - playerX;
    const dz = nearest.position.z - playerZ;
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

  updateAnimations(
    attackAnimTimer: number,
    levelupFlashTimer: number,
    delta: number
  ): { attackAnimTimer: number; levelupFlashTimer: number } {
    let aat = attackAnimTimer;
    let lft = levelupFlashTimer;
    if (aat > 0) {
      aat -= delta;
      if (aat <= 0) aat = 0;
    }
    if (lft > 0) {
      lft -= delta;
      const flash = this.dom['levelup-flash'];
      if (lft > 0) flash.classList.add('active');
      else flash.classList.remove('active');
    }
    return { attackAnimTimer: aat, levelupFlashTimer: lft };
  }

  showDamageNumber(amount: number, isAbility = false) {
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

  showHealNumber(amount: number) {
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

  togglePanel(panelId: string, force?: boolean) {
    const panel = this.dom[panelId];
    if (!panel) return;
    panel.hidden = force ?? !panel.hidden;
    return panel.hidden;
  }

  updateDailyQuestsUI(dailyQuestData: DailyQuestData, onClaim: (idx: number) => void) {
    const data = dailyQuestData;
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
        onClaim(Number(btn.dataset.dailyIndex));
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

  claimDailyQuest(
    dailyQuestData: DailyQuestData,
    index: number,
    profile: PlayerProfile
  ): DailyQuestData | null {
    const result = claimDaily(dailyQuestData, index);
    if (!result) return null;
    saveDailyQuests(dailyQuestData);
    this.activeChar.xp += result.xp;
    if (result.resource && result.amount) {
      profile.inventory[result.resource] += result.amount;
    }
    this.hint(
      `Mision diaria reclamada. +${result.xp} EXP${result.streakBonus > 0 ? ` (+${result.streakBonus} bonus racha)` : ''}`
    );
    saveProfile(profile);
    this.updateProfilePanel();
    return dailyQuestData;
  }

  updateLeaderboardUI(
    profile: PlayerProfile,
    leaderboard: LeaderboardEntry[],
    currentZone: ZoneId,
    sessionKills: number,
    sessionBossKills: number,
    sessionStartTime: number,
    charName: string,
    charLevel: number,
    charElement: string
  ): LeaderboardEntry[] {
    const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
    const playerScore = calculateScore(
      currentZone,
      sessionKills,
      sessionBossKills,
      elapsed,
      charLevel
    );
    const updated = submitScore(
      leaderboard,
      charName,
      charLevel,
      charElement,
      playerScore,
      currentZone
    );
    const container = this.dom['leaderboard-list'];
    if (!container) return updated;
    container.innerHTML = '';
    const rank = getRank(updated, charName);
    const entries = updated.slice(0, 20);
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const entry = document.createElement('div');
      entry.className = `lb-entry${e.name === charName ? ' self' : ''}`;
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
    return updated;
  }

  updateBattlePassUI(battlePass: BattlePassState, onClaim: (tier: number) => void) {
    const progress = getBattlePassProgress(battlePass);
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
      const claimed = battlePass.claimedTiers.includes(tier.level);
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
        onClaim(Number(btn.dataset.bpTier));
      });
    });
  }

  claimBattlePassTier(
    battlePass: BattlePassState,
    tierLevel: number,
    profile: PlayerProfile
  ): BattlePassState {
    const result = claimBP(battlePass, tierLevel);
    if (!result) return battlePass;
    saveBattlePass(battlePass);
    if (result.rewardType === 'xp') {
      this.activeChar.xp += result.rewardAmount;
    } else if (result.rewardType === 'resource') {
      profile.inventory[result.rewardId as keyof typeof profile.inventory] += result.rewardAmount;
    } else if (result.rewardType === 'crafted') {
      profile.crafted[result.rewardId as keyof typeof profile.crafted] += result.rewardAmount;
    }
    this.hint(`Recompensa reclamada: ${result.rewardAmount}x ${result.rewardId}`);
    this.updateProfilePanel();
    saveProfile(profile);
    return battlePass;
  }
}
