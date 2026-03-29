import { describe, it, expect } from 'vitest';
import { ACTIONS, getAvailableActions, canSelectAction } from '../actions';
import { createGameState } from '../game-state';

describe('Action Point System', () => {
  describe('action definitions', () => {
    it('all actions have required fields', () => {
      for (const action of Object.values(ACTIONS)) {
        expect(action.id).toBeDefined();
        expect(action.nameZh).toBeDefined();
        expect(action.apCost).toBeGreaterThanOrEqual(0);
        expect(action.phase).toBeDefined();
        expect(action.effects).toBeDefined();
      }
    });

    it('travel costs more AP but has higher gains than rest', () => {
      const travel = ACTIONS.travel;
      const rest = ACTIONS.rest;
      expect(travel.apCost).toBeGreaterThan(rest.apCost);
      expect((travel.effects.health ?? 0) + (travel.effects.mental ?? 0))
        .toBeGreaterThan((rest.effects.health ?? 0) + (rest.effects.mental ?? 0));
    });

    it('travel AP efficiency > rest AP efficiency', () => {
      const travel = ACTIONS.travel;
      const rest = ACTIONS.rest;
      const travelEff = ((travel.effects.health ?? 0) + (travel.effects.mental ?? 0)) / travel.apCost;
      const restEff = ((rest.effects.health ?? 0) + (rest.effects.mental ?? 0)) / rest.apCost;
      expect(travelEff).toBeGreaterThan(restEff);
    });
  });

  describe('getAvailableActions', () => {
    it('returns academic actions during academic phase', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.phase = 'academic';
      const available = getAvailableActions(state);
      const ids = available.map(a => a.id);
      expect(ids).toContain('rest');
      expect(ids).toContain('exercise');
      expect(ids).toContain('studyGpa');
      expect(ids).not.toContain('upskill'); // career only
      expect(ids).not.toContain('prepJobChange'); // career only
    });

    it('returns career actions during career phase', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.phase = 'career';
      state.career.employed = 'employed';
      state.career.onPip = false;
      state.immigration.visaType = 'opt';
      state.immigration.h1bFiled = false;
      const available = getAvailableActions(state);
      const ids = available.map(a => a.id);
      expect(ids).toContain('upskill');
      expect(ids).toContain('prepJobChange');
      expect(ids).toContain('prepH1b');
      expect(ids).not.toContain('studyGpa'); // academic only
    });

    it('blocks prepJobChange during PIP', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.phase = 'career';
      state.career.employed = 'employed';
      state.career.onPip = true;
      const available = getAvailableActions(state);
      const ids = available.map(a => a.id);
      expect(ids).not.toContain('prepJobChange');
    });

    it('entrepreneurship requires net worth > 50K', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.phase = 'career';
      state.attributes.netWorth = 30000;
      let available = getAvailableActions(state);
      expect(available.map(a => a.id)).not.toContain('entrepreneurship');

      state.attributes.netWorth = 60000;
      available = getAvailableActions(state);
      expect(available.map(a => a.id)).toContain('entrepreneurship');
    });
  });

  describe('canSelectAction', () => {
    it('rejects if insufficient AP', () => {
      const result = canSelectAction(ACTIONS.travel, [], 2);
      expect(result.allowed).toBe(false);
    });

    it('allows if enough AP', () => {
      const result = canSelectAction(ACTIONS.rest, [], 5);
      expect(result.allowed).toBe(true);
    });

    it('enforces mutual exclusion: travel and prepJobChange', () => {
      const result = canSelectAction(ACTIONS.travel, ['prepJobChange'], 10);
      expect(result.allowed).toBe(false);
    });

    it('allows exercise to stack (always allowed)', () => {
      const result = canSelectAction(ACTIONS.exercise, [], 5);
      expect(result.allowed).toBe(true);
    });

    it('enforces mutual exclusion: prepH1b and researchNiw', () => {
      const result = canSelectAction(ACTIONS.prepH1b, ['researchNiw'], 10);
      expect(result.allowed).toBe(false);
    });
  });
});
