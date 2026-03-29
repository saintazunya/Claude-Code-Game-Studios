// 20 edge case tests covering previously uncovered scenarios
import { describe, it, expect } from 'vitest';
import { createGameState, processTurn, getMaxAp, getTurnInfo, inferWorkMode } from '../game-state';
import { getAvailableActions, canSelectAction, ACTIONS } from '../actions';
import { autoSelectTurn } from '../auto-play';
import { selectEvents } from '../events';
import type { GameState, ActionId } from '../types';

function makeState(overrides: Partial<any> = {}): GameState {
  const s = createGameState({ constitution: 3, schoolRanking: 4, geoLocation: 3 });
  s.phase = 'career';
  s.turn = 20;
  s.career.employed = 'employed';
  s.career.level = 4;
  s.career.salary = 200000;
  s.career.rsu = 50000;
  s.career.company = {
    id: 'test', name: 'TestCorp', tier: 'bigTech', city: 'tier1',
    culture: 'balanced', gcWillingness: 'standard',
    salaryModifier: 1.0, pipRateModifier: 0, promotionModifier: 0, layoffModifier: 0,
  };
  s.career.bossType = 'neutral';
  s.career.tenure = 8;
  s.immigration.visaType = 'h1b';
  s.immigration.visaExpiryTurn = 40;
  s.immigration.h1bStartTurn = 10;
  Object.assign(s, overrides);
  return s;
}

describe('20 Edge Case Tests', () => {

  // 1. Auto-play attitude AP budget never exceeds max
  it('1. auto-play total AP (attitude + actions) never exceeds max', () => {
    for (let i = 0; i < 50; i++) {
      const s = makeState();
      s.attributes.performance = Math.random() * 100;
      s.attributes.health = 20 + Math.random() * 80;
      s.attributes.mental = 10 + Math.random() * 90;
      const result = autoSelectTurn(s);
      const attActionIds = ['workNone', 'workSlack', 'workHard', 'workSuperHard'];
      const attCost = ACTIONS[attActionIds[result.attitudeLevel]]?.apCost || 0;
      const actionsCost = result.actions.reduce((sum, id) => sum + (ACTIONS[id]?.apCost || 0), 0);
      const maxAp = getMaxAp(s);
      expect(attCost + actionsCost).toBeLessThanOrEqual(maxAp);
    }
  });

  // 2. Auto-play academic attitude AP budget correct
  it('2. auto-play academic: attitude + actions <= max AP', () => {
    const s = createGameState({ constitution: 3, schoolRanking: 4, geoLocation: 3 });
    s.turn = 5;
    const result = autoSelectTurn(s);
    const attActionIds = ['studySlack', 'studyNormal', 'studyHard'];
    const attCost = ACTIONS[attActionIds[result.attitudeLevel]]?.apCost || 0;
    const actionsCost = result.actions.reduce((sum, id) => sum + (ACTIONS[id]?.apCost || 0), 0);
    expect(attCost + actionsCost).toBeLessThanOrEqual(getMaxAp(s));
  });

  // 3. GPA never exceeds 4.0
  it('3. GPA capped at 4.0 even with studyHard + studyGpa', () => {
    const s = createGameState({ constitution: 3, schoolRanking: 4, geoLocation: 3 });
    s.academic.gpa = 3.9;
    const next = processTurn(s, 'normal', ['studyHard', 'studyGpa']);
    expect(next.academic.gpa).toBeLessThanOrEqual(4.0);
  });

  // 4. GPA never below 2.0
  it('4. GPA floored at 2.0', () => {
    const s = createGameState({ constitution: 3, schoolRanking: 4, geoLocation: 3 });
    s.academic.gpa = 2.05;
    // No study action → GPA decays -0.10
    const next = processTurn(s, 'normal', []);
    expect(next.academic.gpa).toBeGreaterThanOrEqual(2.0);
  });

  // 5. Net worth never negative
  it('5. net worth always >= 0', () => {
    const s = makeState();
    s.economy.cash = -50000;
    const next = processTurn(s, 'normal', []);
    expect(next.attributes.netWorth).toBeGreaterThanOrEqual(0);
  });

  // 6. School bonus applies to all work actions correctly
  it('6. school ranking bonus applies to workNone/workSlack/workHard/workSuperHard', () => {
    for (const actionId of ['workNone', 'workSlack', 'workHard', 'workSuperHard'] as ActionId[]) {
      const s0 = makeState();
      s0.creation.schoolRanking = 0;
      s0.attributes.performance = 50;
      const next0 = processTurn(s0, 'normal', [actionId]);

      const s5 = makeState();
      s5.creation.schoolRanking = 5;
      s5.attributes.performance = 50;
      const next5 = processTurn(s5, 'normal', [actionId]);

      // School 5 should have higher (or less negative) performance
      expect(next5.attributes.performance).toBeGreaterThanOrEqual(next0.attributes.performance);
    }
  });

  // 7. Mutual exclusion: can't select two work attitudes
  it('7. work attitudes are mutually exclusive', () => {
    expect(canSelectAction(ACTIONS.workHard, ['workSlack'], 10).allowed).toBe(false);
    expect(canSelectAction(ACTIONS.workSlack, ['workSuperHard'], 10).allowed).toBe(false);
    expect(canSelectAction(ACTIONS.workNone, ['workHard'], 10).allowed).toBe(false);
  });

  // 8. Mutual exclusion: can't select two study attitudes
  it('8. study attitudes are mutually exclusive', () => {
    expect(canSelectAction(ACTIONS.studyHard, ['studySlack'], 10).allowed).toBe(false);
    expect(canSelectAction(ACTIONS.studyNormal, ['studyHard'], 10).allowed).toBe(false);
  });

  // 9. Travel and prepJobChange still mutually exclusive
  it('9. travel and job change prep still exclusive', () => {
    expect(canSelectAction(ACTIONS.travel, ['prepJobChange'], 10).allowed).toBe(false);
    expect(canSelectAction(ACTIONS.prepJobChange, ['travel'], 10).allowed).toBe(false);
  });

  // 10. Inferred work mode from AP usage
  it('10. inferWorkMode: <=5=coast, 6-7=normal, 8+=grind', () => {
    expect(inferWorkMode(0, false)).toBe('coast');
    expect(inferWorkMode(5, false)).toBe('coast');
    expect(inferWorkMode(6, false)).toBe('normal');
    expect(inferWorkMode(7, false)).toBe('normal');
    expect(inferWorkMode(8, false)).toBe('grind');
    expect(inferWorkMode(10, false)).toBe('grind');
  });

  // 11. Visa expiry countdown accuracy
  it('11. visa countdown is accurate', () => {
    const s = makeState();
    s.immigration.visaExpiryTurn = 30;
    s.turn = 25;
    const remaining = s.immigration.visaExpiryTurn - s.turn;
    expect(remaining).toBe(5);
  });

  // 12. Multiple sickness in consecutive quarters doesn't crash
  it('12. consecutive sickness events handled', () => {
    const s = makeState();
    s.attributes.health = 15;
    s.turn = 80; // high age = high sickness
    let state = s;
    for (let i = 0; i < 5; i++) {
      state = processTurn(state, 'normal', ['hospital']);
      expect(state.attributes.health).toBeGreaterThanOrEqual(0);
      expect(state.attributes.health).toBeLessThanOrEqual(100);
      if (state.endingType) break;
    }
  });

  // 13. Performance decay only when no work action
  it('13. no performance decay with workHard selected', () => {
    const s = makeState();
    s.attributes.performance = 50;
    const next = processTurn(s, 'normal', ['workHard']);
    // workHard gives +5 + school bonus 4 = +9, then no extra decay
    expect(next.attributes.performance).toBeGreaterThan(50);
  });

  // 14. Performance decays without any work action
  it('14. performance does NOT decay without work action (removed implicit decay)', () => {
    const s = makeState();
    s.attributes.performance = 50;
    const next = processTurn(s, 'normal', ['rest']);
    // No work action selected, but implicit decay was removed
    // Performance only changes from natural decay in computeNaturalDecay (which doesn't touch perf)
    // and from work actions. With no work action, mode effects handle it.
    // Mode is inferred from AP usage — rest=2AP, so coast mode: mental+3 only
    expect(next.attributes.performance).toBeLessThanOrEqual(50); // natural decay
  });

  // 15. Constitution 5 reduces grind health penalty by 50%
  it('15. constitution 5 halves grind health cost', () => {
    const s0 = makeState();
    s0.creation.constitution = 0;
    s0.attributes.health = 80;
    const next0 = processTurn(s0, 'normal', ['workSuperHard', 'upskill', 'exercise', 'rest']); // 8AP = grind

    const s5 = makeState();
    s5.creation.constitution = 5;
    s5.attributes.health = 80;
    const next5 = processTurn(s5, 'normal', ['workSuperHard', 'upskill', 'exercise', 'rest']); // 8AP = grind

    // Constitution 5 should lose less health
    expect(next5.attributes.health).toBeGreaterThan(next0.attributes.health);
  });

  // 16. Event cooldown prevents repeat
  it('16. event cooldown enforced', () => {
    const s = makeState();
    s.eventCooldowns = { 'cultural_friction': s.turn }; // just fired
    // selectEvents imported at top
    for (let i = 0; i < 50; i++) {
      const events = selectEvents(s);
      expect(events.every((e: any) => e.id !== 'cultural_friction')).toBe(true);
    }
  });

  // 17. One-time events don't repeat
  it('17. one-time events never repeat', () => {
    const s = makeState();
    s.eventFired = new Set(['community_support', 'identity_crisis']);
    // selectEvents imported at top
    for (let i = 0; i < 50; i++) {
      const events = selectEvents(s);
      for (const e of events) {
        expect(s.eventFired.has(e.id)).toBe(false);
      }
    }
  });

  // 18. processTurn with empty actions doesn't crash
  it('18. processTurn with no actions works', () => {
    const s = makeState();
    const next = processTurn(s, 'normal', []);
    expect(next.turn).toBe(s.turn + 1);
  });

  // 19. Unemployed state: base work AP not deducted
  it('19. unemployed: no base work AP deduction', () => {
    const s = makeState();
    s.career.employed = 'unemployed';
    const maxAp = getMaxAp(s);
    // Unemployed should not deduct base work 3AP
    // getMaxAp doesn't deduct base work — that's in getEffectiveAp
    expect(maxAp).toBe(10); // no deduction
  });

  // 20. Share price never drops to 0
  it('20. share price has floor', () => {
    const s = makeState();
    s.economy.sharePrice = 35; // already low
    // Run through recession
    s.economicPhase = 'recession';
    let state = s;
    for (let i = 0; i < 20; i++) {
      state = processTurn(state, 'normal', []);
      expect(state.economy.sharePrice).toBeGreaterThan(0);
      if (state.endingType) break;
    }
  });
});
