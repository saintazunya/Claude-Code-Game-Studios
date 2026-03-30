// QA: Verify probability distributions match configured rates
import { describe, it, expect } from 'vitest';
import { roll, preview, getEventBreakdown } from '../probability';
import { createGameState } from '../game-state';

const RUNS = 10000;
const TOLERANCE = 0.03; // ±3% tolerance for statistical tests

function runMany(eventType: string, stateSetup: () => ReturnType<typeof createGameState>): number {
  let successes = 0;
  for (let i = 0; i < RUNS; i++) {
    const state = stateSetup();
    if (roll(eventType, state).success) successes++;
  }
  return successes / RUNS;
}

describe('Probability Distribution Tests', () => {

  describe('H1B Lottery', () => {
    it('bachelor rate ~18% (±5% variance per year)', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.hasUsMasters = false;
      state.turn = 12; // specific year for deterministic variance

      const prob = preview('h1bLottery', state);
      console.log(`H1B bachelor preview: ${(prob * 100).toFixed(1)}%`);
      expect(prob).toBeGreaterThanOrEqual(0.13);
      expect(prob).toBeLessThanOrEqual(0.23);

      // Run distribution test
      const actual = runMany('h1bLottery', () => {
        const s = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
        s.hasUsMasters = false;
        s.turn = 12;
        return s;
      });
      console.log(`H1B bachelor actual rate: ${(actual * 100).toFixed(1)}% (expected ~${(prob * 100).toFixed(1)}%)`);
      expect(actual).toBeCloseTo(prob, 1); // within 0.05
    });

    it('masters rate ~23% (±5% variance per year)', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.turn = 12;

      const prob = preview('h1bLotteryMasters', state);
      console.log(`H1B masters preview: ${(prob * 100).toFixed(1)}%`);
      expect(prob).toBeGreaterThanOrEqual(0.18);
      expect(prob).toBeLessThanOrEqual(0.28);

      const actual = runMany('h1bLotteryMasters', () => {
        const s = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
        s.turn = 12;
        return s;
      });
      console.log(`H1B masters actual rate: ${(actual * 100).toFixed(1)}% (expected ~${(prob * 100).toFixed(1)}%)`);
      expect(actual).toBeCloseTo(prob, 1);
    });

    it('H1B rate varies by year', () => {
      const rates: number[] = [];
      for (let year = 0; year < 10; year++) {
        const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
        state.turn = year * 4 + 1; // different years
        rates.push(preview('h1bLottery', state));
      }
      console.log('H1B rates by year:', rates.map(r => (r * 100).toFixed(1) + '%').join(', '));
      // Should have some variance (not all the same)
      const unique = new Set(rates.map(r => r.toFixed(3)));
      expect(unique.size).toBeGreaterThan(1);
    });
  });

  describe('Sickness', () => {
    it('health 80, age 25: ~4%', () => {
      const actual = runMany('sickness', () => {
        const s = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
        s.attributes.health = 80;
        s.turn = 12;
        s.constitutionSicknessModifier = 0;
        return s;
      });
      console.log(`Sickness (health=80, age=25): ${(actual * 100).toFixed(1)}%`);
      expect(actual).toBeCloseTo(0.04, 1);
    });

    it('health 50, age 25: ~10%', () => {
      const actual = runMany('sickness', () => {
        const s = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
        s.attributes.health = 50;
        s.turn = 12;
        s.constitutionSicknessModifier = 0;
        return s;
      });
      console.log(`Sickness (health=50, age=25): ${(actual * 100).toFixed(1)}%`);
      expect(actual).toBeCloseTo(0.10, 1);
    });

    it('health 30, age 45: ~22%', () => {
      const actual = runMany('sickness', () => {
        const s = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
        s.attributes.health = 30;
        s.turn = 92;
        s.constitutionSicknessModifier = 0;
        return s;
      });
      console.log(`Sickness (health=30, age=45): ${(actual * 100).toFixed(1)}%`);
      expect(actual).toBeCloseTo(0.22, 1);
    });
  });

  describe('Burnout', () => {
    it('mental 20: ~5%', () => {
      const actual = runMany('burnout', () => {
        const s = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
        s.attributes.mental = 20;
        return s;
      });
      console.log(`Burnout (mental=20): ${(actual * 100).toFixed(1)}%`);
      expect(actual).toBeCloseTo(0.05, 1);
    });

    it('mental 10: ~10%', () => {
      const actual = runMany('burnout', () => {
        const s = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
        s.attributes.mental = 10;
        return s;
      });
      console.log(`Burnout (mental=10): ${(actual * 100).toFixed(1)}%`);
      expect(actual).toBeCloseTo(0.10, 1);
    });

    it('mental 30+: 0%', () => {
      const actual = runMany('burnout', () => {
        const s = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
        s.attributes.mental = 50;
        return s;
      });
      expect(actual).toBe(0);
    });
  });

  describe('Promotion', () => {
    it('L3 with skills=80 (above threshold 60): good chance', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 4, geoLocation: 3 });
      state.career.level = 3;
      state.career.tenure = 8;
      state.attributes.performance = 70;
      state.attributes.skills = 80; // above threshold 60
      state.career.bossType = 'neutral';
      state.career.company = {
        id: 't', name: 'T', tier: 'bigTech', city: 'tier1',
        culture: 'balanced', gcWillingness: 'standard',
        salaryModifier: 1, pipRateModifier: 0, promotionModifier: 0, layoffModifier: 0,
      };
      const prob = preview('promotion', state);
      console.log(`Promotion L3 (skills=80, thresh=60): ${(prob * 100).toFixed(1)}%`);
      expect(prob).toBeGreaterThan(0.3);
      expect(prob).toBeLessThanOrEqual(0.80);
    });

    it('L5→L6 with skills=200 (below threshold 280): low chance', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 5, geoLocation: 3 });
      state.career.level = 5;
      state.career.tenure = 20;
      state.attributes.performance = 80;
      state.attributes.skills = 200; // below threshold 280
      state.career.bossType = 'neutral';
      state.career.company = {
        id: 't', name: 'T', tier: 'faang', city: 'tier1',
        culture: 'balanced', gcWillingness: 'standard',
        salaryModifier: 1, pipRateModifier: 0, promotionModifier: 0, layoffModifier: 0,
      };
      const prob = preview('promotion', state);
      console.log(`Promotion L5→L6 (skills=200, thresh=280): ${(prob * 100).toFixed(1)}%`);
      expect(prob).toBeLessThan(0.30); // below threshold = hard
    });

    it('L5→L6 with skills=350 (above threshold 280): decent chance', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 5, geoLocation: 3 });
      state.career.level = 5;
      state.career.tenure = 20;
      state.attributes.performance = 80;
      state.attributes.skills = 350; // above threshold 280
      state.career.bossType = 'neutral';
      state.career.company = {
        id: 't', name: 'T', tier: 'faang', city: 'tier1',
        culture: 'balanced', gcWillingness: 'standard',
        salaryModifier: 1, pipRateModifier: 0, promotionModifier: 0, layoffModifier: 0,
      };
      const prob = preview('promotion', state);
      console.log(`Promotion L5→L6 (skills=350, thresh=280): ${(prob * 100).toFixed(1)}%`);
      expect(prob).toBeGreaterThan(0.25);
      expect(prob).toBeLessThanOrEqual(0.50);
    });
  });

  describe('Layoff', () => {
    it('normal economy, high perf: ~2-5%', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.career.level = 5;
      state.attributes.performance = 80;
      state.economicPhase = 'normal';
      state.career.company = {
        id: 't', name: 'T', tier: 'bigTech', city: 'tier1',
        culture: 'balanced', gcWillingness: 'standard',
        salaryModifier: 1, pipRateModifier: 0, promotionModifier: 0, layoffModifier: 0,
      };
      const prob = preview('layoff', state);
      console.log(`Layoff (normal, perf=80): ${(prob * 100).toFixed(1)}%`);
      expect(prob).toBeLessThan(0.10);
    });

    it('recession, low perf: ~15-25%', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.career.level = 4;
      state.attributes.performance = 30;
      state.economicPhase = 'recession';
      state.career.company = {
        id: 't', name: 'T', tier: 'bigTech', city: 'tier1',
        culture: 'balanced', gcWillingness: 'standard',
        salaryModifier: 1, pipRateModifier: 0, promotionModifier: 0, layoffModifier: 0,
      };
      const prob = preview('layoff', state);
      console.log(`Layoff (recession, perf=30): ${(prob * 100).toFixed(1)}%`);
      expect(prob).toBeGreaterThan(0.05);
      expect(prob).toBeLessThan(0.40);
    });
  });

  describe('Job Offer', () => {
    it('normal economy, mid skills: ~20-35%', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.attributes.skills = 50;
      state.economicPhase = 'normal';
      state.jobSearchQuarters = 0;
      const prob = preview('jobOffer', state);
      console.log(`Job offer (normal, skills=50): ${(prob * 100).toFixed(1)}%`);
      expect(prob).toBeGreaterThan(0.15);
      expect(prob).toBeLessThan(0.50);
    });
  });

  describe('Intern Search', () => {
    it('school 5, geo 5, GPA 3.5, skills 30: ~35-50%', () => {
      const state = createGameState({ constitution: 0, schoolRanking: 5, geoLocation: 5 });
      state.attributes.skills = 30;
      state.academic.gpa = 3.5;
      state.economicPhase = 'normal';
      const prob = preview('internSearch', state);
      console.log(`Intern (school=5, geo=5, GPA=3.5): ${(prob * 100).toFixed(1)}%`);
      expect(prob).toBeGreaterThan(0.25);
      expect(prob).toBeLessThan(0.60);
    });

    it('school 0, geo 0, GPA 3.0: ~5-10%', () => {
      const state = createGameState({ constitution: 5, schoolRanking: 0, geoLocation: 0 });
      state.attributes.skills = 20;
      state.academic.gpa = 3.0;
      state.economicPhase = 'normal';
      const prob = preview('internSearch', state);
      console.log(`Intern (school=0, geo=0, GPA=3.0): ${(prob * 100).toFixed(1)}%`);
      expect(prob).toBeLessThan(0.15);
    });
  });

  describe('First Job', () => {
    it('with intern: ~40-60%', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 4, geoLocation: 3 });
      state.academic.hadIntern = true;
      state.academic.internQuality = 'mid';
      state.attributes.skills = 30;
      const prob = preview('firstJob', state);
      console.log(`First job (with intern): ${(prob * 100).toFixed(1)}%`);
      expect(prob).toBeGreaterThan(0.30);
    });

    it('without intern: base 15% + modifiers', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 4, geoLocation: 3 });
      state.academic.hadIntern = false;
      state.attributes.skills = 30;
      const prob = preview('firstJob', state);
      console.log(`First job (no intern): ${(prob * 100).toFixed(1)}%`);
      expect(prob).toBeLessThan(0.50); // base 15% + school + skills
    });
  });
});
