import { describe, it, expect } from 'vitest';
import {
  createStartingAttributes,
  clampAttribute,
  modifyAttribute,
  applyDeltas,
  getHealthThreshold,
  getMentalThreshold,
  computeSicknessChance,
  computeBurnoutChance,
  getPerformanceGainMultiplier,
} from '../attributes';
import { createGameState } from '../game-state';

describe('Attribute System', () => {
  describe('createStartingAttributes', () => {
    it('starting health is 90 for all builds', () => {
      expect(createStartingAttributes({ constitution: 0, schoolRanking: 3, geoLocation: 3 }).attributes.health).toBe(90);
      expect(createStartingAttributes({ constitution: 3, schoolRanking: 3, geoLocation: 3 }).attributes.health).toBe(90);
      expect(createStartingAttributes({ constitution: 5, schoolRanking: 3, geoLocation: 3 }).attributes.health).toBe(90);
    });

    it('maps school ranking to school modifier', () => {
      const { schoolModifier: low } = createStartingAttributes({ constitution: 3, schoolRanking: 0, geoLocation: 3 });
      const { schoolModifier: high } = createStartingAttributes({ constitution: 3, schoolRanking: 5, geoLocation: 3 });
      expect(low).toBeCloseTo(-0.10, 2);
      expect(high).toBeCloseTo(0.10, 2);
    });

    it('maps geo location to intern bonus', () => {
      const { geoBonus: low } = createStartingAttributes({ constitution: 3, schoolRanking: 3, geoLocation: 0 });
      const { geoBonus: high } = createStartingAttributes({ constitution: 3, schoolRanking: 3, geoLocation: 5 });
      expect(low).toBeCloseTo(-0.15, 2);
      expect(high).toBeCloseTo(0.15, 2);
    });

    it('sets starting skills based on school ranking', () => {
      expect(createStartingAttributes({ constitution: 3, schoolRanking: 0, geoLocation: 3 }).attributes.skills).toBe(20);
      expect(createStartingAttributes({ constitution: 3, schoolRanking: 5, geoLocation: 3 }).attributes.skills).toBe(40);
    });

    it('sets starting mental to 70 for all builds', () => {
      expect(createStartingAttributes({ constitution: 0, schoolRanking: 5, geoLocation: 5 }).attributes.mental).toBe(70);
      expect(createStartingAttributes({ constitution: 5, schoolRanking: 0, geoLocation: 5 }).attributes.mental).toBe(70);
    });
  });

  describe('clampAttribute', () => {
    it('clamps core attributes to 0-100', () => {
      expect(clampAttribute('health', 150)).toBe(100);
      expect(clampAttribute('health', -20)).toBe(0);
      expect(clampAttribute('performance', 50)).toBe(50);
    });

    it('netWorth has no upper bound but floors at 0', () => {
      expect(clampAttribute('netWorth', 5000000)).toBe(5000000);
      expect(clampAttribute('netWorth', -100)).toBe(0);
    });
  });

  describe('modifyAttribute', () => {
    it('applies delta and clamps', () => {
      const attrs = { performance: 90, skills: 50, academicImpact: 0, health: 80, mental: 70, netWorth: 100000 };
      const result = modifyAttribute(attrs, 'performance', 20);
      expect(result.performance).toBe(100); // clamped
    });
  });

  describe('applyDeltas', () => {
    it('applies multiple deltas at once', () => {
      const attrs = { performance: 50, skills: 50, academicImpact: 10, health: 60, mental: 60, netWorth: 0 };
      const result = applyDeltas(attrs, { health: -15, mental: -8, performance: 15 });
      expect(result.health).toBe(45);
      expect(result.mental).toBe(52);
      expect(result.performance).toBe(65);
      expect(result.skills).toBe(50); // unchanged
    });
  });

  describe('threshold states', () => {
    it('health thresholds', () => {
      expect(getHealthThreshold(80)).toBe('healthy');
      expect(getHealthThreshold(50)).toBe('subhealthy');
      expect(getHealthThreshold(20)).toBe('critical');
      expect(getHealthThreshold(0)).toBe('hospitalized');
    });

    it('mental thresholds', () => {
      expect(getMentalThreshold(70)).toBe('stable');
      expect(getMentalThreshold(45)).toBe('stressed');
      expect(getMentalThreshold(20)).toBe('atRisk');
      expect(getMentalThreshold(5)).toBe('burnout');
    });
  });

  describe('sickness probability', () => {
    it('health 80, age 25 ≈ 4%', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.attributes.health = 80;
      state.turn = 12; // age 25
      state.constitutionSicknessModifier = 0;
      const chance = computeSicknessChance(state);
      expect(chance).toBeCloseTo(0.04, 1); // (100-80)*0.002*1.0 = 0.04
    });

    it('health 50, age 45 ≈ 16%', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.attributes.health = 50;
      state.turn = 92; // age 45
      state.constitutionSicknessModifier = 0;
      const chance = computeSicknessChance(state);
      expect(chance).toBeCloseTo(0.16, 1); // (100-50)*0.002*1.45 = 0.145
    });

    it('capped at 80%', () => {
      const state = createGameState({ constitution: 0, schoolRanking: 5, geoLocation: 5 });
      state.attributes.health = 5;
      state.turn = 140; // age 57
      const chance = computeSicknessChance(state);
      expect(chance).toBeLessThanOrEqual(0.80);
    });

    it('constitution modifier affects sickness', () => {
      const state0 = createGameState({ constitution: 0, schoolRanking: 5, geoLocation: 5 });
      const state5 = createGameState({ constitution: 5, schoolRanking: 3, geoLocation: 2 });
      state0.attributes.health = 60;
      state5.attributes.health = 60;
      state0.turn = 12;
      state5.turn = 12;
      expect(computeSicknessChance(state0)).toBeGreaterThan(computeSicknessChance(state5));
    });
  });

  describe('burnout probability', () => {
    it('0% at mental 30+', () => {
      expect(computeBurnoutChance(30)).toBe(0);
      expect(computeBurnoutChance(70)).toBe(0);
    });

    it('scales below 30', () => {
      expect(computeBurnoutChance(20)).toBeCloseTo(0.10, 2);
      expect(computeBurnoutChance(0)).toBeCloseTo(0.30, 2);
    });
  });

  describe('performance gain multiplier', () => {
    it('1.0 when healthy and stable', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.attributes.mental = 70;
      state.attributes.health = 80;
      expect(getPerformanceGainMultiplier(state)).toBe(1.0);
    });

    it('0.75 when stressed (mental 30-60)', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.attributes.mental = 45;
      state.attributes.health = 80;
      expect(getPerformanceGainMultiplier(state)).toBe(0.75);
    });

    it('0.25 when mental < 30 AND health < 20 (stacks)', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.attributes.mental = 20;
      state.attributes.health = 15;
      expect(getPerformanceGainMultiplier(state)).toBe(0.25);
    });
  });
});
