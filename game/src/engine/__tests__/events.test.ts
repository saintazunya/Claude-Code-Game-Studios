import { describe, it, expect } from 'vitest';
import { EVENT_POOL, selectEvents, applyEventChoice } from '../events';
import { createGameState } from '../game-state';
import { generateCompany } from '../career';

describe('Event System', () => {
  describe('EVENT_POOL', () => {
    it('has at least 15 events', () => {
      expect(EVENT_POOL.length).toBeGreaterThanOrEqual(15);
    });

    it('all events have required fields', () => {
      for (const event of EVENT_POOL) {
        expect(event.id).toBeDefined();
        expect(event.nameZh).toBeDefined();
        expect(event.descZh).toBeDefined();
        expect(event.type).toBeDefined();
        expect(event.choices.length).toBeGreaterThan(0);
      }
    });

    it('all choices have required fields', () => {
      for (const event of EVENT_POOL) {
        for (const choice of event.choices) {
          expect(choice.id).toBeDefined();
          expect(choice.nameZh).toBeDefined();
          expect(choice.tag).toBeDefined();
        }
      }
    });
  });

  describe('selectEvents', () => {
    it('returns 0-2 events', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.phase = 'career';
      state.career.employed = 'employed';
      state.career.company = generateCompany(5);
      state.career.bossType = 'toxic'; // enables toxic_incident event
      state.career.tenure = 5;
      state.turn = 50;
      state.attributes.performance = 50;
      state.attributes.skills = 50;
      state.attributes.mental = 40;

      let maxEvents = 0;
      for (let i = 0; i < 500; i++) {
        // Reset cooldowns each iteration to keep events eligible
        state.eventCooldowns = {};
        const events = selectEvents(state);
        maxEvents = Math.max(maxEvents, events.length);
      }
      // Should see at least some events over 500 iterations
      expect(maxEvents).toBeGreaterThan(0);
      expect(maxEvents).toBeLessThanOrEqual(2);
    });

    it('respects cooldowns', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.phase = 'career';
      state.career.employed = 'employed';
      state.career.company = generateCompany(5);
      state.career.tenure = 5;
      state.turn = 50;

      // Fire all events recently
      for (const event of EVENT_POOL) {
        state.eventCooldowns[event.id] = 49; // fired last turn
      }

      const events = selectEvents(state);
      expect(events.length).toBe(0); // all on cooldown
    });

    it('respects one-time flags', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.phase = 'career';

      // Mark all one-time events as fired
      for (const event of EVENT_POOL) {
        if (event.oneTime) {
          state.eventFired.add(event.id);
        }
      }

      const events = selectEvents(state);
      for (const event of events) {
        expect(event.oneTime).toBe(false);
      }
    });

    it('does not return academic events during career phase', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.phase = 'career';
      state.career.employed = 'employed';

      for (let i = 0; i < 100; i++) {
        const events = selectEvents(state);
        for (const event of events) {
          expect(event.phase).not.toBe('academic');
        }
      }
    });
  });

  describe('applyEventChoice', () => {
    it('applies choice effects', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      const event = EVENT_POOL.find(e => e.id === 'holiday_loneliness')!;
      const result = applyEventChoice(state, event, 'gathering');
      expect(result.effects.mental).toBeDefined();
    });

    it('identity crisis risky choice depends on mental', () => {
      const event = EVENT_POOL.find(e => e.id === 'identity_crisis')!;

      // Mental > 30: should get +10
      const stateHigh = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      stateHigh.attributes.mental = 50;
      const resultHigh = applyEventChoice(stateHigh, event, 'question');
      expect(resultHigh.effects.mental).toBe(10);

      // Mental < 30: should get -10
      const stateLow = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      stateLow.attributes.mental = 20;
      const resultLow = applyEventChoice(stateLow, event, 'question');
      expect(resultLow.effects.mental).toBe(-10);
    });
  });
});
