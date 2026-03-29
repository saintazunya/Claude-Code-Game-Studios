import { describe, it, expect } from 'vitest';
import { generateCompany, computeSalary, processAnnualReview, checkPip, checkLayoff, rollBossType, shouldRotateBoss, generateJobOffers, applyJobChange } from '../career';
import { createGameState } from '../game-state';

describe('Career System', () => {
  describe('generateCompany', () => {
    it('generates a company with all required fields', () => {
      const company = generateCompany(5);
      expect(company.id).toBeDefined();
      expect(company.name).toBeDefined();
      expect(company.tier).toBeDefined();
      expect(company.city).toBeDefined();
      expect(company.culture).toBeDefined();
      expect(company.gcWillingness).toBeDefined();
      expect(company.salaryModifier).toBeGreaterThan(0);
    });
  });

  describe('computeSalary', () => {
    it('returns salary within band for level', () => {
      const company = generateCompany(5);
      const { salary, rsu } = computeSalary(5, company, 60);
      expect(salary).toBeGreaterThan(0);
      expect(rsu).toBeGreaterThan(0);
    });

    it('higher performance = higher salary within band', () => {
      const company = generateCompany(5);
      company.salaryModifier = 1.0;
      const low = computeSalary(5, company, 30);
      const high = computeSalary(5, company, 80);
      expect(high.salary).toBeGreaterThanOrEqual(low.salary);
    });
  });

  describe('processAnnualReview', () => {
    it('cannot promote from L7', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 4, geoLocation: 3 });
      state.career.level = 7;
      const result = processAnnualReview(state);
      expect(result.promoted).toBe(false);
      expect(result.newLevel).toBe(7);
    });

    it('cannot promote before minimum tenure', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 4, geoLocation: 3 });
      state.career.level = 4;
      state.career.tenure = 2; // need 8 for L4
      const result = processAnnualReview(state);
      expect(result.promoted).toBe(false);
    });

    it('cannot promote while on PIP', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 4, geoLocation: 3 });
      state.career.level = 3;
      state.career.tenure = 10;
      state.career.onPip = true;
      state.attributes.performance = 90;
      const result = processAnnualReview(state);
      expect(result.promoted).toBe(false);
    });
  });

  describe('checkPip', () => {
    it('no PIP risk when performance >= 30', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.attributes.performance = 50;
      expect(checkPip(state).pipTriggered).toBe(false);
    });

    it('PIP possible when performance < 30', () => {
      // Run many times to catch the probabilistic trigger
      let triggered = false;
      for (let i = 0; i < 200; i++) {
        const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
        state.attributes.performance = 10;
        state.career.coastConsecutive = 3;
        state.career.company = generateCompany(4);
        if (checkPip(state).pipTriggered) { triggered = true; break; }
      }
      expect(triggered).toBe(true);
    });
  });

  describe('checkLayoff', () => {
    it('not laid off when unemployed', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.career.employed = 'unemployed';
      expect(checkLayoff(state).laidOff).toBe(false);
    });

    it('layoff more likely during recession', () => {
      let normalLayoffs = 0;
      let recessionLayoffs = 0;
      for (let i = 0; i < 1000; i++) {
        const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
        state.career.employed = 'employed';
        state.career.company = generateCompany(4);
        state.attributes.performance = 50;
        state.economicPhase = 'normal';
        if (checkLayoff(state).laidOff) normalLayoffs++;

        state.economicPhase = 'recession';
        if (checkLayoff(state).laidOff) recessionLayoffs++;
      }
      expect(recessionLayoffs).toBeGreaterThan(normalLayoffs);
    });
  });

  describe('rollBossType', () => {
    it('returns valid boss types', () => {
      const validTypes = ['supportive', 'neutral', 'demanding', 'toxic'];
      for (let i = 0; i < 50; i++) {
        expect(validTypes).toContain(rollBossType());
      }
    });
  });

  describe('shouldRotateBoss', () => {
    it('never rotates before tenure 6', () => {
      for (let i = 0; i < 50; i++) {
        expect(shouldRotateBoss(3)).toBe(false);
      }
    });
  });

  describe('generateJobOffers', () => {
    it('generates correct number of offers', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.career.level = 5;
      state.career.salary = 250000;
      state.career.rsu = 100000;
      const offers = generateJobOffers(state, 3);
      expect(offers).toHaveLength(3);
      for (const offer of offers) {
        expect(offer.company).toBeDefined();
        expect(offer.salary).toBeGreaterThan(0);
        expect(offer.level).toBeGreaterThanOrEqual(5);
        expect(offer.level).toBeLessThanOrEqual(7);
      }
    });
  });

  describe('applyJobChange', () => {
    it('resets PERM if pre-I-140', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.immigration.permStatus = 'pending';
      state.immigration.i140Status = 'none';
      const offer = generateJobOffers(state, 1)[0];
      const result = applyJobChange(state, offer);
      expect(result.permReset).toBe(true);
    });

    it('preserves priority date if post-I-140', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.immigration.permStatus = 'approved';
      state.immigration.i140Status = 'approved';
      const offer = generateJobOffers(state, 1)[0];
      const result = applyJobChange(state, offer);
      expect(result.permReset).toBe(false);
    });
  });
});
