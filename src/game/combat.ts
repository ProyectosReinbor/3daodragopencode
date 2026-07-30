import { Group, PerspectiveCamera, Scene, Vector3 } from 'three';
import { CharacterManager, totalStats as characterTotalStats } from './characters';
import {
  calculateAbilityEffect,
  createActiveAbilities,
  type ActiveAbility,
  type AbilityEffect,
} from './abilities';
import { type ActiveBoss, getBossPhase, buildBossMinion } from './bosses';
import { type Enemy } from './world';

import { type PlayerProfile } from './profile';
import { AudioManager } from './audio';
import { VisualEffects } from './visual';
import { GameUI } from './game-ui';

interface MinionData {
  health: number;
  damage: number;
  speed: number;
  alive: boolean;
}

export interface CombatServices {
  hint: (msg: string) => void;
  updateQuest: () => void;
  updateProfilePanel: () => void;
  addExperience: (amount: number) => void;
  onPlayerDeath: () => void;
  onEnemyKilled: (enemy: Enemy, profile: PlayerProfile) => void;
  onBossKilled: (boss: ActiveBoss, profile: PlayerProfile) => void;
}

export class CombatManager {
  enemies: Enemy[] = [];
  health = 100;
  energy = 100;
  activeBoss: ActiveBoss | null = null;
  bossMinions = new Map<Group, MinionData>();
  cachedNearestEnemy: Enemy | null = null;
  cachedNearestEnemyDist = Infinity;
  sessionKills = 0;
  sessionBossKills = 0;
  abilities: ActiveAbility[] = [];
  private lastAttack = 0;
  private readonly lastEnemyAttacks = new Map<Enemy, number>();
  private shieldActive = false;
  private shieldHp = 0;
  private stunTimer = 0;
  private bossWarningTimer = 0;
  private readonly lastMinionAttacks = new Map<Group, number>();

  constructor(
    private readonly player: Group,
    private readonly camera: PerspectiveCamera,
    private readonly scene: Scene,
    private readonly audio: AudioManager,
    private readonly visuals: VisualEffects,
    private readonly characters: CharacterManager,
    private readonly ui: GameUI,
    private readonly services: CombatServices
  ) {}

  get bossWarning(): number {
    return this.bossWarningTimer;
  }

  private maxHealth(): number {
    return 100 + characterTotalStats(this.characters.getActive()).hp * 8;
  }

  private get shieldBonus(): number {
    return 3;
  }

  private get swordBonus(): number {
    return 2;
  }

  initAbilities() {
    this.abilities = createActiveAbilities(this.characters.getActive());
    this.health = this.maxHealth();
  }

  update(delta: number, profile: PlayerProfile) {
    this.cacheNearestEnemy();
    this.updateEnemies(delta, profile);
    this.updateBoss(delta, profile);
    this.updateBossMinions(delta, profile);
    if (this.bossWarningTimer > 0) {
      this.bossWarningTimer -= delta;
    }
  }

  attack(profile: PlayerProfile): boolean {
    const now = performance.now();
    if (now - this.lastAttack < 400) return false;
    this.lastAttack = now;

    const stats = characterTotalStats(this.characters.getActive());
    const enemy = this.cachedNearestEnemy;
    const boss = this.activeBoss;
    const bossDist =
      boss && boss.alive ? this.player.position.distanceTo(boss.mesh.position) : Infinity;
    const enemyDist = enemy ? this.player.position.distanceTo(enemy.mesh.position) : Infinity;

    const targetBoss = boss && boss.alive && bossDist < enemyDist && bossDist < 6;
    const targetEnemy = enemy && enemyDist < 6;

    if (!targetBoss && !targetEnemy) {
      this.services.hint('No hay criaturas cerca.');
      return true;
    }

    if (targetBoss) {
      const attackRange = boss!.definition.attackRange;
      if (bossDist >= attackRange) {
        this.services.hint('Acercate mas para atacar al boss.');
        return true;
      }
      const dmg =
        1 + Math.floor(stats.atk / 3) + (profile.crafted.espada > 0 ? this.swordBonus : 0);
      this.damageBoss(dmg, profile);
      return true;
    }

    if (targetEnemy && enemy) {
      const attackRange = enemy.kind === 'golem' ? 4.5 : enemy.kind === 'spirit' ? 4.0 : 4.2;
      if (enemyDist >= attackRange) {
        this.services.hint('Acercate mas para atacar.');
        return true;
      }
      const dmg =
        1 + Math.floor(stats.atk / 3) + (profile.crafted.espada > 0 ? this.swordBonus : 0);
      enemy.health -= dmg;
      enemy.mesh.scale.setScalar(0.85);
      setTimeout(() => enemy.mesh.scale.setScalar(1), 100);
      this.updateEnemyHpBar(enemy);
      if (enemy.health <= 0) {
        enemy.alive = false;
        enemy.mesh.visible = false;
        this.visuals.spawnDeathBurst(this.scene, enemy.mesh.position);
        this.services.addExperience(15);
        this.sessionKills++;
        this.services.onEnemyKilled(enemy, profile);
        window.setTimeout(() => this.respawnEnemy(enemy), 18000);
      }
    }
    return true;
  }

  private damageBoss(dmg: number, profile: PlayerProfile) {
    const boss = this.activeBoss;
    if (!boss || !boss.alive) return;

    boss.health -= dmg;
    boss.mesh.scale.setScalar(0.9);
    setTimeout(() => boss.mesh.scale.setScalar(1), 100);
    this.ui.showDamageNumber(dmg, true);
    this.updateBossHpBar();

    const healthRatio = boss.health / boss.maxHealth;
    const newPhase = getBossPhase(healthRatio, boss.definition.phases);

    if (newPhase > boss.currentPhase) {
      boss.currentPhase = newPhase;
      const phaseConfig = boss.definition.phases[newPhase - 1];
      if (phaseConfig && phaseConfig.message) {
        this.services.hint(`⚠ ${phaseConfig.message}`);
        this.bossWarningTimer = 3.0;
        this.audio.playBossWarning();
        this.visuals.flashBossWarning();
      }
    }

    if (healthRatio <= 0.25 && !boss.enraged) {
      boss.enraged = true;
      boss.enrageTimer = boss.enrageMaxTime;
      this.services.hint(`⚠ ¡${boss.definition.name} se ha enfurecido! ¡Ataca con todo!`);
      this.bossWarningTimer = 3.0;
      this.audio.playBossWarning();
      this.visuals.flashBossWarning();
    }

    if (boss.health <= 0) {
      this.killBoss(boss, profile);
    }
  }

  private killBoss(boss: ActiveBoss, profile: PlayerProfile) {
    if (!boss) return;

    boss.alive = false;
    boss.mesh.visible = false;
    this.visuals.spawnBossKillBurst(this.scene, boss.mesh.position);
    this.services.addExperience(boss.definition.xpReward);
    this.sessionBossKills++;
    this.services.onBossKilled(boss, profile);

    for (const [minion] of this.bossMinions) {
      this.scene.remove(minion);
    }
    this.bossMinions.clear();

    window.setTimeout(() => this.respawnBoss(boss), boss.definition.respawnTime);
  }

  private respawnBoss(boss: ActiveBoss) {
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
    this.services.hint(`⚠ ¡${boss.definition.name} ha regresado!`);
  }

  private updateEnemyHpBar(enemy: Enemy) {
    const ratio = Math.max(0, enemy.health / enemy.maxHealth);
    enemy.hpBar.scale.x = ratio;
    enemy.hpBar.position.x = -(1.2 * (1 - ratio)) / 2;
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
  }

  private updateEnemies(delta: number, profile: PlayerProfile) {
    const now = performance.now();
    const stats = characterTotalStats(this.characters.getActive());
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
        const lastAttack = this.lastEnemyAttacks.get(enemy) ?? 0;
        if (distance <= attackRange && now - lastAttack > 1300) {
          this.lastEnemyAttacks.set(enemy, now);
          let damage = Math.max(
            2,
            enemy.damage - stats.def * 0.7 - (profile.crafted.escudo > 0 ? this.shieldBonus : 0)
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
            this.ui.showDamageNumber(Math.round(damage));
            this.services.hint(`${enemy.name} te ha causado ${Math.round(damage)} de dano.`);
            if (this.health <= 0) this.respawnPlayer();
          } else {
            this.services.hint(`${enemy.name} ataco pero tu escudo lo bloqueo!`);
          }
        }
      });
  }

  private updateBoss(delta: number, profile: PlayerProfile) {
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
        this.services.hint(`⚠ ¡${boss.definition.name} se ha regenerado!`);
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
      const stats = characterTotalStats(this.characters.getActive());
      let damage = Math.max(
        2,
        boss.definition.baseDamage * dmgMul -
          stats.def * 0.6 -
          (profile.crafted.escudo > 0 ? this.shieldBonus : 0)
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
        this.ui.showDamageNumber(Math.round(damage));
        this.services.hint(`${boss.definition.name} te ha causado ${Math.round(damage)} de dano.`);
        if (this.health <= 0) this.respawnPlayer();
      } else {
        this.services.hint(`${boss.definition.name} ataco pero tu escudo lo bloqueo!`);
      }
    }

    for (const ability of boss.definition.abilities) {
      if (ability.phaseRequired > boss.currentPhase) continue;
      const lastUsed = boss.lastAbilityUse.get(ability.type + ability.name) ?? 0;
      if (ability.cooldown > 0 && now - lastUsed < ability.cooldown) continue;
      if (distance < ability.range || ability.type === 'summon' || ability.type === 'enrage') {
        this.executeBossAbility(boss, ability, profile);
        boss.lastAbilityUse.set(ability.type + ability.name, now);
      }
    }

    this.updateBossHpBar();
  }

  private executeBossAbility(
    boss: ActiveBoss,
    ability: import('./bosses').BossAbility,
    profile: PlayerProfile
  ) {
    const stats = characterTotalStats(this.characters.getActive());
    const distance = this.player.position.distanceTo(boss.mesh.position);

    switch (ability.type) {
      case 'aoe':
      case 'slam':
      case 'charge': {
        const dmg = ability.damage;
        if (distance <= ability.range) {
          let damage = Math.max(
            2,
            dmg - stats.def * 0.5 - (profile.crafted.escudo > 0 ? this.shieldBonus : 0)
          );
          if (this.shieldActive && this.shieldHp > 0) {
            const absorbed = Math.min(this.shieldHp, damage);
            this.shieldHp -= absorbed;
            damage -= absorbed;
            if (this.shieldHp <= 0) this.shieldActive = false;
          }
          if (damage > 0) {
            this.health = Math.max(0, this.health - damage);
            this.ui.showDamageNumber(Math.round(damage), true);
          }
          this.services.hint(`⚠ ${boss.definition.name} usa ${ability.name}!`);
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
        this.services.hint(`⚠ ${boss.definition.name} invoca ayuda!`);
        break;
      }
      case 'heal': {
        const healAmount = Math.round(boss.maxHealth * 0.15);
        boss.health = Math.min(boss.maxHealth, boss.health + healAmount);
        this.ui.showHealNumber(healAmount);
        this.services.hint(`⚠ ${boss.definition.name} se regenera!`);
        break;
      }
      case 'enrage': {
        if (!boss.enraged) {
          boss.enraged = true;
          boss.enrageTimer = boss.enrageMaxTime;
          this.services.hint(`⚠ ¡${boss.definition.name} se ha enfurecido!`);
        }
        break;
      }
    }
  }

  private updateBossMinions(delta: number, profile: PlayerProfile) {
    const now = performance.now();
    const stats = characterTotalStats(this.characters.getActive());

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
            data.damage - stats.def * 0.5 - (profile.crafted.escudo > 0 ? 2 : 0)
          );
          if (this.shieldActive && this.shieldHp > 0) {
            const absorbed = Math.min(this.shieldHp, damage);
            this.shieldHp -= absorbed;
            damage -= absorbed;
            if (this.shieldHp <= 0) this.shieldActive = false;
          }
          if (damage > 0) {
            this.health = Math.max(0, this.health - damage);
            this.ui.showDamageNumber(Math.round(damage));
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
          this.services.addExperience(8);
        }
      }
    }
  }

  private respawnEnemy(enemy: Enemy) {
    enemy.health = enemy.maxHealth;
    enemy.alive = true;
    enemy.mesh.position.copy(enemy.spawnPosition);
    enemy.mesh.visible = true;
    enemy.hpBar.scale.x = 1;
    enemy.hpBar.position.x = 0;
    this.services.hint(`${enemy.name} ha regresado al mundo.`);
  }

  private respawnPlayer() {
    this.health = Math.round(this.maxHealth() * 0.65);
    this.energy = 60;
    this.audio.playDeath();
    this.services.hint('Has caido en batalla. Regresaste al punto de inicio.');
    this.services.onPlayerDeath();
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

  useAbility(index: number, profile: PlayerProfile): { dashDirection: Vector3 } | null {
    const ability = this.abilities[index];
    if (!ability) return null;

    const now = performance.now();
    if (now - ability.lastUsed < ability.cooldown) {
      this.services.hint(`${ability.name} en enfriamiento.`);
      return null;
    }

    if (this.energy < ability.energyCost) {
      this.services.hint(`Energia insuficiente para ${ability.name}.`);
      return null;
    }

    const stats = characterTotalStats(this.characters.getActive());
    const effect = calculateAbilityEffect(ability, stats, this.characters.getActive().level);

    this.energy -= ability.energyCost;
    ability.lastUsed = now;
    ability.currentCooldown = ability.cooldown;

    this.applyAbilityEffect(ability, effect, profile);
    this.services.hint(`${ability.icon} ${ability.name} activado!`);

    if (effect.type === 'dash') {
      const direction = new Vector3();
      this.camera.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      return { dashDirection: direction };
    }

    return null;
  }

  private applyAbilityEffect(
    _ability: ActiveAbility,
    effect: AbilityEffect,
    profile: PlayerProfile
  ) {
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
          this.ui.showDamageNumber(dmg, true);

          if (enemy.health <= 0) {
            enemy.alive = false;
            enemy.mesh.visible = false;
            this.services.addExperience(15);
            this.services.onEnemyKilled(enemy, profile);
            window.setTimeout(() => this.respawnEnemy(enemy), 18000);
          }
        }

        const boss = this.activeBoss;
        if (boss && boss.alive) {
          const bossDist = this.player.position.distanceTo(boss.mesh.position);
          if (
            (effect.targets === 'aoe' && bossDist < 6) ||
            (effect.targets !== 'aoe' && bossDist < 5)
          ) {
            this.damageBoss(effect.value, profile);
          }
        }
        break;
      }
      case 'heal': {
        const healAmount = effect.value;
        this.health = Math.min(this.maxHealth(), this.health + healAmount);
        this.audio.playHeal();
        this.visuals.flashHeal();
        this.ui.showHealNumber(healAmount);
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
          this.ui.showDamageNumber(dmg, true);
          const heal = Math.round(dmg * 0.3);
          this.health = Math.min(this.maxHealth(), this.health + heal);
          this.ui.showHealNumber(heal);

          if (enemy.health <= 0) {
            enemy.alive = false;
            enemy.mesh.visible = false;
            this.services.addExperience(15);
            this.services.onEnemyKilled(enemy, profile);
            window.setTimeout(() => this.respawnEnemy(enemy), 18000);
          }
        } else {
          const boss = this.activeBoss;
          if (boss && boss.alive) {
            const bossDist = this.player.position.distanceTo(boss.mesh.position);
            if (bossDist < 5) {
              const dmg = effect.value;
              this.damageBoss(dmg, profile);
              const heal = Math.round(dmg * 0.3);
              this.health = Math.min(this.maxHealth(), this.health + heal);
              this.ui.showHealNumber(heal);
            }
          }
        }
        break;
      }
    }
  }
}
