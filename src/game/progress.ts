import type { PlayerProfile } from './profile';
import type { CharacterManager } from './characters';
import { updateAchievement } from './achievements';
import { type DailyQuestData, trackDailyKill, saveDailyQuests } from './daily-quests';
import { type BattlePassState, addBattlePassXp, saveBattlePass } from './battlepass';
import { currentQuestDef, advanceQuest } from './profile';
import { xpForLevel } from './nft';
import { LootManager } from './loot';
import type { Enemy } from './world';
import type { ActiveBoss } from './bosses';
import type { RecipeId } from './crafting-manager';

export interface ProgressServices {
  hint: (msg: string) => void;
  updateQuest: () => void;
  updateProfilePanel: () => void;
  levelUpEffects: (name: string, level: number) => void;
}

export class ProgressManager {
  private loot: LootManager;

  constructor(
    private readonly services: ProgressServices,
    lootManager: LootManager
  ) {
    this.loot = lootManager;
  }

  addExperience(amount: number, profile: PlayerProfile, characters: CharacterManager) {
    const activeChar = characters.getActive();
    activeChar.xp += amount;
    const required = xpForLevel(activeChar.level);
    if (activeChar.xp >= required) {
      activeChar.xp -= required;
      activeChar.level += 1;
      profile.attributePoints += 1;
      this.checkLevelAchievements(activeChar.level, profile);
      this.services.levelUpEffects(activeChar.name, activeChar.level);
      this.services.hint(`${activeChar.name} subio a nivel ${activeChar.level}!`);
    }
  }

  private checkLevelAchievements(level: number, profile: PlayerProfile) {
    if (level >= 5) profile.achievements = updateAchievement(profile.achievements, 'level_5', 0);
    if (level >= 10) profile.achievements = updateAchievement(profile.achievements, 'level_10', 0);
    if (level >= 20) profile.achievements = updateAchievement(profile.achievements, 'level_20', 0);
  }

  trackAchievement(id: string, amount: number, profile: PlayerProfile) {
    profile.achievements = updateAchievement(profile.achievements, id, amount);
  }

  processEnemyKill(
    enemy: Enemy,
    profile: PlayerProfile,
    dailyQuestData: DailyQuestData,
    battlePass: BattlePassState
  ) {
    const bpResult = addBattlePassXp(battlePass, 10);
    saveBattlePass(battlePass);
    if (bpResult.leveledUp) this.services.hint(`Battle Pass nivel ${bpResult.newLevel}`);

    profile.quest.creatures += 1;
    this.trackAchievement('monster_slayer_1', 1, profile);
    this.trackAchievement('monster_slayer_2', 1, profile);
    if (enemy.kind === 'wolf') this.trackAchievement('wolf_hunter_1', 1, profile);
    if (enemy.kind === 'wolf') this.trackAchievement('wolf_hunter_2', 1, profile);
    if (enemy.kind === 'spirit') this.trackAchievement('spirit_hunter_1', 1, profile);
    if (enemy.kind === 'golem') this.trackAchievement('golem_hunter_1', 1, profile);

    this.trackQuestKill(profile);

    trackDailyKill(dailyQuestData, enemy.kind);
    saveDailyQuests(dailyQuestData);

    const drops = this.loot.rollEnemyLoot(enemy.kind);
    if (drops.length > 0) {
      const texts = this.loot.applyDrops(drops, profile.inventory, profile.loot);
      profile.quest.resources += drops.reduce((sum, d) => sum + d.amount, 0);
      this.services.hint(`${enemy.name} derrotado. Botin: ${texts.join(', ')}`);
    } else {
      this.services.hint(`${enemy.name} fue derrotado. Volvera mas tarde.`);
    }

    this.services.updateQuest();
  }

  processBossKill(
    boss: ActiveBoss,
    profile: PlayerProfile,
    dailyQuestData: DailyQuestData,
    battlePass: BattlePassState
  ) {
    const bpResult = addBattlePassXp(battlePass, 50);
    saveBattlePass(battlePass);
    if (bpResult.leveledUp) this.services.hint(`Battle Pass nivel ${bpResult.newLevel}`);

    const drops = this.loot.rollBossLoot(boss.definition.loot);
    if (drops.length > 0) {
      const texts = this.loot.applyDrops(drops, profile.inventory, profile.loot);
      profile.quest.resources += drops.reduce((sum, d) => sum + d.amount, 0);
      this.services.hint(`🏆 ¡${boss.definition.name} derrotado! Botin: ${texts.join(', ')}`);
    } else {
      this.services.hint(`🏆 ¡${boss.definition.name} derrotado! +${boss.definition.xpReward} EXP`);
    }

    this.trackAchievement('monster_slayer_1', 1, profile);
    this.trackAchievement('monster_slayer_2', 1, profile);
    this.services.updateQuest();
  }

  trackQuestKill(profile: PlayerProfile) {
    const qdef = currentQuestDef(profile);
    if (!qdef) return;
    const resources = Math.min(profile.quest.resources, qdef.requiredResources);
    const creatures = Math.min(profile.quest.creatures, qdef.requiredCreatures);
    if (resources >= qdef.requiredResources && creatures >= qdef.requiredCreatures) {
      const qs = profile.quests.find((q) => !q.completed);
      if (!qs) return;
      qs.completed = true;
      if (qdef.rewardResource && qdef.rewardAmount)
        profile.inventory[qdef.rewardResource] += qdef.rewardAmount;
      profile.quest.resources = 0;
      profile.quest.creatures = 0;
      const nextDef = advanceQuest(profile);
      if (nextDef && nextDef.unlockZone && !profile.unlockedZones.includes(nextDef.unlockZone)) {
        profile.unlockedZones.push(nextDef.unlockZone);
        this.services.hint(
          `Zona desbloqueada: ${nextDef.unlockZone === 'bosque' ? 'Bosque Ancestral' : nextDef.unlockZone}`
        );
      }
      const completedCount = profile.quests.filter((q) => q.completed).length;
      if (completedCount >= 3) this.trackAchievement('quest_complete_1', 0, profile);
      if (completedCount >= 7) this.trackAchievement('quest_complete_2', 0, profile);
    }
  }

  trackCraft(recipe: RecipeId, profile: PlayerProfile) {
    this.trackAchievement('crafter_1', 1, profile);
    this.trackAchievement('crafter_2', 1, profile);
    this.trackAchievement('crafter_3', 1, profile);
  }
}
