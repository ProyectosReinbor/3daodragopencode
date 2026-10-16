import { describe, expect, it } from 'vitest';
import { equipmentStats, previewEquipment } from './equipment-preview';
const base = { atk: 6, def: 5, spd: 6, hp: 6, ability: 5 };
describe('equipment comparison', () => {
  it('compares a replacement rather than adding both weapon bonuses', () => {
    const loadout = { weapon: 'fang', armor: 'hide' };
    const result = previewEquipment(base, loadout, 'explorer_blade')!;
    expect(result.current.atk).toBe(10);
    expect(result.next.atk).toBe(14);
    expect(result.delta.atk).toBe(4);
    expect(result.next.def).toBe(9);
    expect(loadout.weapon).toBe('fang');
    expect(base.atk).toBe(6);
  });
  it('shows both the lost health and gained power when replacing a relic', () => {
    const result = previewEquipment(base, { relic: 'heart' }, 'aurora_gem')!;
    expect(result.delta.hp).toBe(-6);
    expect(result.delta.ability).toBe(10);
    expect(result.next.hp).toBe(6);
    expect(previewEquipment(base, { relic: 'heart' }, 'heart')!.delta.hp).toBe(0);
  });
  it('ignores unknown saved items and rejects unknown previews', () => {
    expect(equipmentStats(base, { weapon: 'missing' })).toEqual(base);
    expect(previewEquipment(base, {}, 'missing')).toBeNull();
    expect(previewEquipment(base, {}, 'constructor')).toBeNull();
  });
});
