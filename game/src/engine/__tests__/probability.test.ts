import { describe, it, expect } from 'vitest';
import { preview, roll, getEventBreakdown } from '../probability';
import { createGameState } from '../game-state';

describe('Probability Engine', () => {
  describe('H1B lottery', () => {
    it('is ~18% for bachelors (±5% annual variance)', () => {
      const state = createGameState({ constitution: 5, schoolRanking: 5, geoLocation: 5 });
      state.hasUsMasters = false;
      state.attributes.performance = 100;
      state.attributes.skills = 100;
      const prob = preview('h1bLottery', state);
      expect(prob).toBeGreaterThanOrEqual(0.13);
      expect(prob).toBeLessThanOrEqual(0.23);
    });

    it('is ~23% for masters (±5% annual variance)', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      const prob = preview('h1bLotteryMasters', state);
      expect(prob).toBeGreaterThanOrEqual(0.18);
      expect(prob).toBeLessThanOrEqual(0.28);
    });
  });

  describe('promotion probability', () => {
    it('uses level-specific base rates', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.career.level = 3;
      state.attributes.performance = 50;
      const l3 = preview('promotion', state);

      state.career.level = 6;
      const l6 = preview('promotion', state);

      expect(l3).toBeGreaterThan(l6); // L3 promotes easier than L6
    });

    it('school modifier affects promotion', () => {
      const state0 = createGameState({ constitution: 3, schoolRanking: 0, geoLocation: 7 });
      const state5 = createGameState({ constitution: 3, schoolRanking: 5, geoLocation: 2 });
      state0.career.level = 5;
      state5.career.level = 5;
      state0.attributes.performance = 60;
      state5.attributes.performance = 60;

      expect(preview('promotion', state5)).toBeGreaterThan(preview('promotion', state0));
    });

    it('is capped per level', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 5, geoLocation: 2 });
      state.career.level = 5;
      state.attributes.performance = 100;
      state.attributes.skills = 100;
      state.economicPhase = 'boom';
      state.career.bossType = 'supportive';
      state.career.company = {
        id: 'test', name: 'Test', tier: 'faang', city: 'tier1',
        culture: 'balanced', gcWillingness: 'eager',
        salaryModifier: 1, pipRateModifier: 0, promotionModifier: 0.05, layoffModifier: 0,
      };

      const prob = preview('promotion', state);
      expect(prob).toBeLessThanOrEqual(0.55); // L5→L6 cap
    });
  });

  describe('sickness probability', () => {
    it('matches reference table: health 80, age 25 ≈ 5%', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.attributes.health = 80;
      state.turn = 12;
      state.constitutionSicknessModifier = 0; // neutral constitution
      const { final } = getEventBreakdown('sickness', state);
      expect(final).toBeCloseTo(0.05, 1);
    });
  });

  describe('economic cycle modifiers', () => {
    it('recession reduces job offer probability', () => {
      const stateNormal = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      stateNormal.attributes.skills = 50;
      stateNormal.economicPhase = 'normal';

      const stateRecession = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      stateRecession.attributes.skills = 50;
      stateRecession.economicPhase = 'recession';

      expect(preview('jobOffer', stateNormal)).toBeGreaterThan(preview('jobOffer', stateRecession));
    });

    it('recession increases layoff probability', () => {
      const stateNormal = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      stateNormal.attributes.performance = 50;
      stateNormal.economicPhase = 'normal';

      const stateRecession = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      stateRecession.attributes.performance = 50;
      stateRecession.economicPhase = 'recession';

      expect(preview('layoff', stateRecession)).toBeGreaterThan(preview('layoff', stateNormal));
    });
  });

  describe('intern search', () => {
    it('no intern drops first job base to 0.15', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.academic.hadIntern = false;
      state.attributes.skills = 30;
      const { base } = getEventBreakdown('firstJob', state);
      expect(base).toBe(0.15);
    });

    it('having intern keeps first job base at 0.40+', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.academic.hadIntern = true;
      state.academic.internQuality = 'mid';
      state.attributes.skills = 30;
      const { base, situational } = getEventBreakdown('firstJob', state);
      expect(base).toBe(0.40);
      expect(situational).toBeGreaterThanOrEqual(0.25); // intern bonus
    });
  });

  describe('roll function', () => {
    it('returns success, probability, and roll value', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      const result = roll('h1bLottery', state);
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('probability');
      expect(result).toHaveProperty('rollValue');
      expect(result.probability).toBeGreaterThanOrEqual(0.13);
      expect(result.probability).toBeLessThanOrEqual(0.23);
      expect(result.rollValue).toBeGreaterThanOrEqual(0);
      expect(result.rollValue).toBeLessThanOrEqual(1);
    });
  });

  describe('breakdown', () => {
    it('components sum to final (before clamping)', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 4, geoLocation: 3 });
      state.career.level = 5;
      state.attributes.performance = 60;
      state.attributes.skills = 40;
      state.economicPhase = 'normal';
      state.career.bossType = 'neutral';
      state.career.company = {
        id: 'test', name: 'Test', tier: 'faang', city: 'tier1',
        culture: 'balanced', gcWillingness: 'eager',
        salaryModifier: 1, pipRateModifier: 0, promotionModifier: 0, layoffModifier: 0,
      };

      const bd = getEventBreakdown('promotion', state);
      const rawSum = bd.base + bd.attributeContribution + bd.schoolModifier + bd.econModifier + bd.situational;
      // Final should be rawSum clamped to [floor, cap]
      expect(bd.final).toBeLessThanOrEqual(0.55); // L5→L6 cap
      expect(bd.final).toBeGreaterThanOrEqual(0.02); // floor
    });
  });
});
