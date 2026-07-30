import { describe, it, expect } from 'vitest';
import { isCharacterReward, isItemReward, isCurrencyReward } from './reward-manager';

describe('reward-manager', () => {
  describe('isCharacterReward', () => {
    it('returns true for character type', () => {
      expect(isCharacterReward('character')).toBe(true);
    });

    it('returns false for non-character types', () => {
      expect(isCharacterReward('item')).toBe(false);
      expect(isCharacterReward('consumable')).toBe(false);
      expect(isCharacterReward('currency')).toBe(false);
      expect(isCharacterReward('crystals')).toBe(false);
    });
  });

  describe('isItemReward', () => {
    it('returns true for item type', () => {
      expect(isItemReward('item')).toBe(true);
    });

    it('returns true for consumable type', () => {
      expect(isItemReward('consumable')).toBe(true);
    });

    it('returns false for non-item types', () => {
      expect(isItemReward('character')).toBe(false);
      expect(isItemReward('currency')).toBe(false);
    });
  });

  describe('isCurrencyReward', () => {
    it('returns true for currency type', () => {
      expect(isCurrencyReward('currency')).toBe(true);
    });

    it('returns true for crystals type', () => {
      expect(isCurrencyReward('crystals')).toBe(true);
    });

    it('returns false for non-currency types', () => {
      expect(isCurrencyReward('character')).toBe(false);
      expect(isCurrencyReward('item')).toBe(false);
    });
  });
});
