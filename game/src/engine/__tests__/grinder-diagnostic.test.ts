/**
 * Diagnostic: trace why 卷王 (grinder) NEVER gets GC across 100 games
 * Track turn-by-turn: mental, health, burnout, visa status, PERM progress, job hops
 */
import { describe, it, expect } from 'vitest';
import { createGameState, processTurn, getTurnInfo, getMaxAp } from '../game-state';
import { getAvailableActions, canSelectAction, ACTIONS } from '../actions';
import type { GameState, ActionId } from '../types';

const ATTITUDE_IDS = new Set([
  'workNone', 'workSlack', 'workHard', 'workSuperHard',
  'studySlack', 'studyNormal', 'studyHard',
]);

function selectActions(state: GameState, priorities: ActionId[], attitudeLevel: number): ActionId[] {
  const available = getAvailableActions(state).filter(a => !ATTITUDE_IDS.has(a.id));
  const maxAp = getMaxAp(state);
  const attActions: ActionId[] = state.phase === 'academic'
    ? ['studySlack', 'studyNormal', 'studyHard']
    : ['workNone', 'workSlack', 'workHard', 'workSuperHard'];
  const clampedLevel = Math.min(attitudeLevel, attActions.length - 1);
  const attCost = ACTIONS[attActions[clampedLevel]]?.apCost || 0;

  let remaining = maxAp - attCost;
  const selected: ActionId[] = [];

  for (const id of priorities) {
    if (remaining <= 0) break;
    const action = available.find(a => a.id === id);
    if (!action) continue;
    const check = canSelectAction(action, selected, remaining);
    if (check.allowed) {
      selected.push(action.id);
      remaining -= action.apCost;
    }
  }

  const shuffled = [...available].sort(() => Math.random() - 0.5);
  for (const a of shuffled) {
    if (remaining <= 0) break;
    if (selected.includes(a.id)) continue;
    const check = canSelectAction(a, selected, remaining);
    if (check.allowed) {
      selected.push(a.id);
      remaining -= a.apCost;
    }
  }

  selected.push(attActions[clampedLevel]);
  return selected;
}

// Smart grinder strategy: conserve in school, grind at work, protect PERM
function grinderStrategy(s: GameState): ActionId[] {
  const p: ActionId[] = [];
  let attLvl: number;

  if (s.phase === 'academic') {
    attLvl = 2; // studyHard, not insane — save energy for career
    if (!s.academic.hadIntern && s.turn >= 2) p.push('searchIntern');
    if (s.flags.internActiveThisQuarter) p.push('internWork');
    p.push('sideProject', 'studyGpa', 'networking');
    if (s.attributes.mental < 40) p.push('exercise');
    const gradTurn = s.academic.isPhd ? 16 : 8;
    if (s.turn === gradTurn - 1) p.push('searchFullTimeJob');
  } else {
    attLvl = s.flags.burnoutActive || s.attributes.health < 20 ? 0 :
      s.attributes.mental < 20 ? 1 : 3;
    if (s.attributes.health < 30) p.push('hospital');
    if (s.attributes.mental < 25) p.push('therapist', 'exercise');
    if (s.career.employed === 'unemployed') p.push('urgentJobSearch');
    p.push('upskill');
    // Only job hop AFTER I-140 approved
    if (s.immigration.i140Status === 'approved' && s.career.tenure >= 6) p.push('prepJobChange');
  }
  return selectActions(s, p, attLvl);
}

describe('Grinder Diagnostic', () => {
  it('traces 20 grinder games turn-by-turn', () => {
    const summaries: string[] = [];
    let totalBurnouts = 0;
    let totalLayoffs = 0;
    let totalJobHops = 0;
    let h1bWins = 0;
    let permApprovals = 0;
    let permResets = 0;
    let timesH1bAttempted = 0;
    let firstBurnoutTurns: number[] = [];
    let deathCauses: Record<string, number> = {};

    for (let g = 0; g < 20; g++) {
      let state = createGameState({ constitution: 4, schoolRanking: 5, geoLocation: 1 });
      let burnouts = 0, layoffs = 0, jobHops = 0;
      let firstBurnout = -1;
      let permResetCount = 0;
      const milestones: string[] = [];

      for (let t = 0; t < 72; t++) {
        const prevPerm = state.immigration.permStatus;
        const actions = grinderStrategy(state);

        try { state = processTurn(state, 'normal', actions); } catch (e) { break; }

        const events = state.timeline[state.timeline.length - 1]?.events || [];
        for (const e of events) {
          if (e.id === 'burnout') {
            burnouts++;
            if (firstBurnout < 0) firstBurnout = state.turn;
          }
          if (e.id === 'laid_off' || e.id === 'pip_terminated') layoffs++;
          if (e.id === 'job_offer_received') jobHops++;
          if (e.id === 'h1b_approved') milestones.push(`T${state.turn}:H1B✓`);
          if (e.id === 'h1b_denied') milestones.push(`T${state.turn}:H1B✗`);
          if (e.id === 'perm_filed') milestones.push(`T${state.turn}:PERM-filed`);
          if (e.id === 'perm_approved') milestones.push(`T${state.turn}:PERM✓`);
          if (e.id === 'perm_rejected') milestones.push(`T${state.turn}:PERM✗`);
          if (e.id === 'perm_voided_layoff') { milestones.push(`T${state.turn}:PERM-VOIDED`); permResetCount++; }
          if (e.id === 'i140_approved') milestones.push(`T${state.turn}:I140✓`);
          if (e.id === 'green_card_approved') milestones.push(`T${state.turn}:GC!!!`);
          if (e.id === 'h1b_6year_expired') milestones.push(`T${state.turn}:H1B-6yr-expired`);
          if (e.id === 'visa_expired_deported') milestones.push(`T${state.turn}:DEPORTED`);
        }

        // Track PERM reset from job hop (not layoff)
        if (prevPerm !== 'none' && state.immigration.permStatus === 'none' && !events.some(e => e.id === 'perm_voided_layoff')) {
          milestones.push(`T${state.turn}:PERM-RESET(hop)`);
          permResetCount++;
        }

        if (state.endingType) break;
      }

      totalBurnouts += burnouts;
      totalLayoffs += layoffs;
      totalJobHops += jobHops;
      if (state.immigration.h1bAttempts > 0) timesH1bAttempted++;
      if (state.timeline.some(r => r.events.some(e => e.id === 'h1b_approved'))) h1bWins++;
      if (state.immigration.permStatus === 'approved') permApprovals++;
      permResets += permResetCount;
      if (firstBurnout >= 0) firstBurnoutTurns.push(firstBurnout);
      deathCauses[state.endingType || 'survived'] = (deathCauses[state.endingType || 'survived'] || 0) + 1;

      // Print game trace
      console.log(`Game ${g + 1}: ${state.endingType || 'survived'} @ T${state.turn} | ` +
        `burnouts=${burnouts} layoffs=${layoffs} hops=${jobHops} | ` +
        `mental-avg=${Math.round(state.timeline.reduce((s, r) => s + r.attributesAfter.mental, 0) / Math.max(1, state.timeline.length))} | ` +
        `PERM-resets=${permResetCount}`);
      console.log(`  Milestones: ${milestones.join(' → ') || 'none'}`);
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log('GRINDER DIAGNOSTIC SUMMARY (20 games)');
    console.log(`${'═'.repeat(60)}`);
    console.log(`Deaths: ${Object.entries(deathCauses).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    console.log(`H1B attempted: ${timesH1bAttempted}/20`);
    console.log(`H1B won: ${h1bWins}/20 (${(h1bWins / 20 * 100).toFixed(0)}%)`);
    console.log(`PERM approved: ${permApprovals}/20`);
    console.log(`PERM resets: ${permResets} total (${(permResets / 20).toFixed(1)} avg)`);
    console.log(`Total burnouts: ${totalBurnouts} (${(totalBurnouts / 20).toFixed(1)} avg)`);
    console.log(`Total layoffs: ${totalLayoffs} (${(totalLayoffs / 20).toFixed(1)} avg)`);
    console.log(`Total job hops: ${totalJobHops} (${(totalJobHops / 20).toFixed(1)} avg)`);
    console.log(`First burnout avg turn: ${firstBurnoutTurns.length > 0 ? (firstBurnoutTurns.reduce((a, b) => a + b, 0) / firstBurnoutTurns.length).toFixed(1) : 'N/A'}`);

    // Identify root cause
    console.log(`\n── ROOT CAUSE ANALYSIS ──`);
    if (h1bWins < 5) console.log(`❌ H1B bottleneck: only ${h1bWins}/20 won lottery`);
    if (permResets > 10) console.log(`❌ PERM resets too frequent: ${permResets} total — job hopping destroys GC progress`);
    if (totalBurnouts / 20 > 5) console.log(`❌ Burnout epidemic: ${(totalBurnouts / 20).toFixed(1)} avg per game — grinder can't sustain`);
    if (totalLayoffs / 20 > 2) console.log(`❌ Layoff cascade: ${(totalLayoffs / 20).toFixed(1)} avg — burnout → low perf → PIP → fired`);
    if (firstBurnoutTurns.length > 0 && firstBurnoutTurns.reduce((a, b) => a + b, 0) / firstBurnoutTurns.length < 15) {
      console.log(`❌ Early burnout: first burnout at avg T${(firstBurnoutTurns.reduce((a, b) => a + b, 0) / firstBurnoutTurns.length).toFixed(1)} — grinder crashes before career even starts`);
    }

    expect(true).toBe(true);
  });
});
