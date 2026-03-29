import { describe, it, expect } from 'vitest';
import { createGameState, getTurnInfo, getEffectiveAp, getWorkModeCost, processTurn, calculateFinalScore } from '../game-state';

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

  describe('getEffectiveAp', () => {
    it('base AP is 10', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      expect(getEffectiveAp(state, 'normal')).toBe(10);
    });

    it('grind mode adds 3 AP', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      expect(getEffectiveAp(state, 'grind')).toBe(13);
    });

    it('sickness penalty reduces AP', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.flags.sicknessApPenalty = 5;
      expect(getEffectiveAp(state, 'normal')).toBe(5);
    });

    it('burnout = minimum 4 AP (can still rest/hospital)', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.flags.burnoutActive = true;
      expect(getEffectiveAp(state, 'normal')).toBe(4);
    });

    it('grind locked does not add bonus', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.grindLockQuarters = 2;
      expect(getEffectiveAp(state, 'grind')).toBe(10); // no bonus when locked
    });
  });

  describe('getWorkModeCost', () => {
    it('coast/light = 3, normal = 4, grind/intense = 4', () => {
      expect(getWorkModeCost('coast')).toBe(3);
      expect(getWorkModeCost('light')).toBe(3);
      expect(getWorkModeCost('normal')).toBe(4);
      expect(getWorkModeCost('grind')).toBe(4);
      expect(getWorkModeCost('intense')).toBe(4);
    });
  });

  describe('processTurn', () => {
    it('advances turn counter', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      const next = processTurn(state, 'normal', ['rest']);
      expect(next.turn).toBe(1);
    });

    it('applies work mode effects', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      const next = processTurn(state, 'normal', []);
      // Normal academic mode: skills +5, mental -2
      expect(next.attributes.skills).toBeGreaterThan(state.attributes.skills);
    });

    it('applies action effects', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      const next = processTurn(state, 'normal', ['rest']);
      // Rest: health +10, mental +8 (minus decay)
      // Health starts at 64, rest +10, decay ~-2 = ~72
      expect(next.attributes.health).toBeGreaterThan(60);
    });

    it('records quarter in timeline', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      const next = processTurn(state, 'normal', []);
      expect(next.timeline).toHaveLength(1);
      expect(next.timeline[0].turn).toBe(1);
      expect(next.timeline[0].workMode).toBe('normal');
    });

    it('tracks consecutive grind quarters', () => {
      let state = createGameState({ constitution: 5, schoolRanking: 3, geoLocation: 2 });
      state = processTurn(state, 'intense', []);
      expect(state.career.grindConsecutive).toBe(1);
      state = processTurn(state, 'intense', []);
      expect(state.career.grindConsecutive).toBe(2);
      state = processTurn(state, 'normal', []);
      expect(state.career.grindConsecutive).toBe(0);
    });

    it('game ends at turn 148', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.turn = 147; // next processTurn will make it 148
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
      state.turn = 80; // age ~42
      const score = calculateFinalScore(state);
      // 1M * 1.5 + (59-42)*10000 = 1,500,000 + 170,000 = 1,670,000
      expect(score).toBe(1670000);
    });

    it('no GC = 1.0 multiplier, no early bonus', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.attributes.netWorth = 1000000;
      state.immigration.hasGreenCard = false;
      state.turn = 148;
      const score = calculateFinalScore(state);
      expect(score).toBe(1000000);
    });

    it('deportation = 0.8 penalty', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.attributes.netWorth = 1000000;
      state.immigration.hasGreenCard = false;
      state.endingType = 'deported';
      const score = calculateFinalScore(state);
      expect(score).toBe(800000);
    });
  });
});
