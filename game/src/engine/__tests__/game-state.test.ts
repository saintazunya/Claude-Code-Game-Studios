import { describe, it, expect } from 'vitest';
import { createGameState, getTurnInfo, getEffectiveAp, getWorkModeCost, processTurn, calculateFinalScore, getMaxAp, inferWorkMode } from '../game-state';

describe('Game State', () => {
  describe('createGameState', () => {
    it('initializes with correct starting values', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 4, geoLocation: 3 });
      expect(state.turn).toBe(0);
      expect(state.phase).toBe('academic');
      expect(state.attributes.health).toBe(90); // all builds start at 90
      expect(state.attributes.mental).toBe(70);
      expect(state.attributes.skills).toBe(36); // 20 + 4*4
      expect(state.attributes.academicImpact).toBe(8); // 4*2
      expect(state.attributes.netWorth).toBe(0);
      expect(state.immigration.visaType).toBe('f1');
      expect(state.career.employed).toBe('student');
    });
  });

  describe('getTurnInfo', () => {
    it('turn 0 = 2024, Q1, age 22', () => {
      expect(getTurnInfo(0)).toEqual({ year: 2024, quarter: 1, age: 22 });
    });

    it('turn 48 = 2036, Q1, age 34', () => {
      expect(getTurnInfo(48)).toEqual({ year: 2036, quarter: 1, age: 34 });
    });

    it('turn 147 = 2060, Q4, age 58', () => {
      expect(getTurnInfo(147)).toEqual({ year: 2060, quarter: 4, age: 58 });
    });
  });

  describe('getMaxAp', () => {
    it('max AP is 10 normally', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      expect(getMaxAp(state)).toBe(10);
    });

    it('grind locked caps at 7', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.grindLockQuarters = 2;
      expect(getMaxAp(state)).toBe(7);
    });

    it('sickness reduces max AP but floors at 4', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.flags.sicknessApPenalty = 8;
      expect(getMaxAp(state)).toBe(4);
    });

    it('burnout = 4 AP', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.flags.burnoutActive = true;
      expect(getMaxAp(state)).toBe(4);
    });
  });

  describe('inferWorkMode', () => {
    it('≤5 AP used = coast', () => {
      expect(inferWorkMode(3, false)).toBe('coast');
      expect(inferWorkMode(5, false)).toBe('coast');
    });

    it('6-7 AP used = normal', () => {
      expect(inferWorkMode(6, false)).toBe('normal');
      expect(inferWorkMode(7, false)).toBe('normal');
    });

    it('>7 AP used = grind', () => {
      expect(inferWorkMode(8, false)).toBe('grind');
      expect(inferWorkMode(10, false)).toBe('grind');
    });

    it('urgent job search forces at least normal', () => {
      expect(inferWorkMode(3, true)).toBe('normal');
      expect(inferWorkMode(9, true)).toBe('grind');
    });
  });

  describe('getWorkModeCost', () => {
    it('work mode cost is always 0 (AP budget set by getMaxAp)', () => {
      expect(getWorkModeCost('coast')).toBe(0);
      expect(getWorkModeCost('normal')).toBe(0);
      expect(getWorkModeCost('grind')).toBe(0);
    });
  });

  describe('processTurn', () => {
    it('advances turn counter', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      const next = processTurn(state, 'normal', ['rest']);
      expect(next.turn).toBe(1);
    });

    it('infers coast mode when few actions used', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      const next = processTurn(state, 'normal', ['exercise']); // 1 AP used
      const record = next.timeline[0];
      expect(record.workMode).toBe('coast');
    });

    it('infers grind mode when many actions used', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      // Use 8+ AP worth of actions
      const next = processTurn(state, 'normal', ['rest', 'exercise', 'studyGpa', 'networking']); // 2+1+3+2 = 8
      const record = next.timeline[0];
      expect(record.workMode).toBe('grind');
    });

    it('records quarter in timeline', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      const next = processTurn(state, 'normal', []);
      expect(next.timeline).toHaveLength(1);
      expect(next.timeline[0].turn).toBe(1);
    });

    it('game ends at turn 148', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.turn = 147;
      const next = processTurn(state, 'normal', []);
      expect(next.turn).toBe(148);
      expect(next.endingType).not.toBeNull();
    });
  });

  describe('calculateFinalScore', () => {
    it('applies GC multiplier', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.attributes.netWorth = 1000000;
      state.immigration.hasGreenCard = true;
      state.turn = 80;
      const score = calculateFinalScore(state);
      expect(score).toBe(1670000);
    });

    it('no GC = 1.0 multiplier', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.attributes.netWorth = 1000000;
      state.immigration.hasGreenCard = false;
      state.turn = 148;
      expect(calculateFinalScore(state)).toBe(1000000);
    });

    it('deportation = 0.8 penalty', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.attributes.netWorth = 1000000;
      state.endingType = 'deported';
      expect(calculateFinalScore(state)).toBe(800000);
    });
  });
});
