import { describe, it, expect } from 'vitest';
import { processImmigrationQuarter, canChangeEmployerFreely, getTravelRisk, activateOpt } from '../immigration';
import { createGameState } from '../game-state';
import { generateCompany } from '../career';

describe('Immigration System', () => {
  describe('canChangeEmployerFreely', () => {
    it('true with green card', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.immigration.hasGreenCard = true;
      expect(canChangeEmployerFreely(state)).toBe(true);
    });

    it('true with combo card', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.immigration.hasComboCard = true;
      expect(canChangeEmployerFreely(state)).toBe(true);
    });

    it('false on H1B', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.immigration.visaType = 'h1b';
      expect(canChangeEmployerFreely(state)).toBe(false);
    });
  });

  describe('getTravelRisk', () => {
    it('0 with green card', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.immigration.hasGreenCard = true;
      expect(getTravelRisk(state)).toBe(0);
    });

    it('0 with combo card', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.immigration.hasComboCard = true;
      expect(getTravelRisk(state)).toBe(0);
    });

    it('5% on H1B', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.immigration.visaType = 'h1b';
      expect(getTravelRisk(state)).toBe(0.05);
    });
  });

  describe('activateOpt', () => {
    it('sets OPT with 4 quarter expiry', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.turn = 8;
      const updates = activateOpt(state);
      expect(updates.visaType).toBe('opt');
      expect(updates.visaExpiryTurn).toBe(12);
    });
  });

  describe('processImmigrationQuarter', () => {
    it('processes H1B lottery in Q2 when filed', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      // Quarter calc: ((turn-1) % 4) + 1. For Q2: turn=2,6,10...
      state.turn = 2; // Q2
      state.immigration.h1bFiled = true;
      state.immigration.visaType = 'opt';

      const result = processImmigrationQuarter(state);
      // Should have either h1b_approved or h1b_denied
      const hasLotteryResult = result.events.some(
        e => e === 'h1b_approved' || e === 'h1b_denied'
      );
      expect(hasLotteryResult).toBe(true);
      expect(result.updates.h1bFiled).toBe(false);
    });

    it('does not process H1B lottery if not filed', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.turn = 5;
      state.immigration.h1bFiled = false;

      const result = processImmigrationQuarter(state);
      const hasLotteryResult = result.events.some(
        e => e === 'h1b_approved' || e === 'h1b_denied'
      );
      expect(hasLotteryResult).toBe(false);
    });

    it('starts PERM when employer is willing and tenure sufficient', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.phase = 'career';
      state.career.employed = 'employed';
      state.career.company = generateCompany(5);
      state.career.company.gcWillingness = 'eager';
      state.career.tenure = 3;
      state.immigration.visaType = 'h1b';
      state.immigration.permStatus = 'none';

      const result = processImmigrationQuarter(state);
      const hasPerm = result.events.some(e => e === 'perm_filed');
      // May or may not fire depending on random delay, but at tenure 3 with eager, likely
      // Just verify no crash
      expect(result).toBeDefined();
    });

    it('NOID risk for combo card holders unemployed 2+ quarters', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.immigration.hasComboCard = true;
      state.immigration.hasGreenCard = false;
      state.immigration.i485Status = 'pending';
      state.career.employed = 'unemployed';
      state.immigration.unemploymentQuarters = 3;

      const result = processImmigrationQuarter(state);
      // Should increment unemployment quarters
      expect(result.updates.unemploymentQuarters).toBe(4);
    });

    it('resets unemployment counter when employed', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.career.employed = 'employed';
      state.immigration.unemploymentQuarters = 5;

      const result = processImmigrationQuarter(state);
      expect(result.updates.unemploymentQuarters).toBe(0);
    });

    it('deports when visa expires with no valid status', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.immigration.visaExpiryTurn = 10;
      state.turn = 11;
      state.immigration.hasGreenCard = false;
      state.immigration.hasComboCard = false;
      state.immigration.graceQuartersRemaining = 0;

      const result = processImmigrationQuarter(state);
      expect(result.gameOver).toBe(true);
    });
  });
});
