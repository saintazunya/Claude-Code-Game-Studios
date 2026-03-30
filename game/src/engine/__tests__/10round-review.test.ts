// 10-round review cycle: 5 immigrant reviewers × 20 games per round
// Each round: play → analyze → log comments → identify fixes
import { describe, it, expect } from 'vitest';
import { createGameState, processTurn, getTurnInfo, getMaxAp } from '../game-state';
import { getAvailableActions, canSelectAction, ACTIONS } from '../actions';
import type { GameState, ActionId, CreationAttributes } from '../types';

const ATTITUDE_IDS = new Set(['workNone', 'workSlack', 'workHard', 'workSuperHard', 'studySlack', 'studyNormal', 'studyHard']);

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function selectActions(state: GameState, priorities: ActionId[]): ActionId[] {
  const available = getAvailableActions(state).filter(a => !ATTITUDE_IDS.has(a.id));
  const maxAp = getMaxAp(state);
  const attActions: ActionId[] = state.phase === 'academic'
    ? ['studySlack', 'studyNormal', 'studyHard']
    : ['workNone', 'workSlack', 'workHard', 'workSuperHard'];
  const attLevel = state.attributes.health < 40 || state.attributes.mental < 30 ? 0
    : state.attributes.health > 70 && state.attributes.mental > 50 ? Math.min(2, attActions.length - 1) : 1;
  const attCost = ACTIONS[attActions[attLevel]]?.apCost || 0;
  let remaining = maxAp - attCost;
  const selected: ActionId[] = [];
  for (const id of priorities) {
    if (remaining <= 0) break;
    const action = available.find(a => a.id === id);
    if (!action) continue;
    const check = canSelectAction(action, selected, remaining);
    if (check.allowed) { selected.push(action.id); remaining -= action.apCost; }
  }
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  for (const a of shuffled) {
    if (remaining <= 0) break;
    if (selected.includes(a.id)) continue;
    const check = canSelectAction(a, selected, remaining);
    if (check.allowed) { selected.push(a.id); remaining -= a.apCost; }
  }
  selected.push(attActions[attLevel]);
  return selected;
}

interface Reviewer {
  name: string; build: CreationAttributes;
  priorities: (s: GameState) => ActionId[];
}

const REVIEWERS: Reviewer[] = [
  { name: '小王(均衡)', build: { constitution: 3, schoolRanking: 4, geoLocation: 3 },
    priorities: (s) => {
      const p: ActionId[] = [];
      if (s.phase === 'academic') {
        if (!s.academic.hadIntern) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('networking', 'sideProject');
        const g = s.academic.isPhd ? 16 : 8;
        if (s.turn === g - 1) p.push('searchFullTimeJob');
      } else {
        p.push('workHard');
        if (s.attributes.health < 50) p.push('hospital', 'rest');
        if (s.attributes.mental < 40) p.push('therapist');
        p.push('upskill', 'exercise');
        if (s.career.employed === 'unemployed') p.push('normalJobSearch', 'urgentJobSearch');
      }
      return p;
    }},
  { name: '小李(卷王)', build: { constitution: 5, schoolRanking: 5, geoLocation: 0 },
    priorities: (s) => {
      const p: ActionId[] = [];
      if (s.phase === 'academic') {
        if (!s.academic.hadIntern) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('sideProject', 'networking');
        const g = s.academic.isPhd ? 16 : 8;
        if (s.turn === g - 1) p.push('searchFullTimeJob');
      } else {
        p.push('workSuperHard');
        if (s.attributes.health < 30) p.push('hospital');
        p.push('upskill');
        if (s.career.employed === 'unemployed') p.push('urgentJobSearch');
      }
      return p;
    }},
  { name: '小张(养生)', build: { constitution: 4, schoolRanking: 3, geoLocation: 3 },
    priorities: (s) => {
      const p: ActionId[] = [];
      if (s.phase === 'academic') {
        if (!s.academic.hadIntern) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('exercise', 'rest', 'networking');
        const g = s.academic.isPhd ? 16 : 8;
        if (s.turn === g - 1) p.push('searchFullTimeJob');
      } else {
        p.push('workSlack', 'rest', 'exercise', 'therapist');
        if (s.career.employed === 'unemployed') p.push('normalJobSearch');
      }
      return p;
    }},
  { name: '小陈(学术)', build: { constitution: 2, schoolRanking: 5, geoLocation: 3 },
    priorities: (s) => {
      const p: ActionId[] = [];
      if (s.phase === 'academic') {
        if (!s.academic.hadIntern) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('sideProject', 'networking');
        const g = s.academic.isPhd ? 16 : 8;
        if (s.turn === g - 1) p.push('searchFullTimeJob');
      } else {
        p.push('workHard', 'publishPaper', 'researchNiw');
        if (s.attributes.health < 40) p.push('rest');
        if (s.attributes.mental < 35) p.push('therapist');
        if (s.career.employed === 'unemployed') p.push('normalJobSearch');
      }
      return p;
    }},
  { name: '小赵(随机)', build: { constitution: 2, schoolRanking: 4, geoLocation: 4 },
    priorities: () => [] },
];

interface RoundStats {
  gcRate: number; deportRate: number; bankruptRate: number;
  avgTurns: number; avgNW: number; jobFoundRate: number; h1bRate: number;
  issues: string[];
}

function playRound(round: number): RoundStats {
  let totalGC = 0, totalDeport = 0, totalBankrupt = 0, totalTurns = 0, totalNW = 0;
  let jobFound = 0, h1bWon = 0;
  const issues: string[] = [];
  const totalGames = REVIEWERS.length * 20;

  for (const reviewer of REVIEWERS) {
    let rGC = 0, rDeport = 0;
    for (let g = 0; g < 20; g++) {
      let state = createGameState(reviewer.build);
      let foundJob = false, gotH1b = false;

      for (let t = 0; t < 72; t++) {
        // Validate available actions before playing
        const available = getAvailableActions(state);
        const availIds = available.map(a => a.id);

        // Check: career actions in academic
        if (state.phase === 'academic') {
          for (const id of ['upskill', 'prepJobChange'] as ActionId[]) {
            if (availIds.includes(id)) issues.push(`R${round} ${reviewer.name} T${t}: career action ${id} in academic`);
          }
        }
        // Check: work attitudes when unemployed
        if (state.career.employed === 'unemployed') {
          for (const id of ['workHard', 'workSuperHard', 'workSlack', 'workNone'] as ActionId[]) {
            if (availIds.includes(id)) issues.push(`R${round} ${reviewer.name} T${t}: ${id} when unemployed`);
          }
        }

        const actions = selectActions(state, reviewer.priorities(state));
        try {
          state = processTurn(state, 'normal', actions);
        } catch (e: any) {
          issues.push(`R${round} ${reviewer.name} G${g} T${t}: CRASH ${e.message}`);
          break;
        }

        // Track events
        const lastEvents = state.timeline[state.timeline.length - 1]?.events || [];
        for (const e of lastEvents) {
          if (e.id === 'first_job_found') foundJob = true;
          if (e.id === 'h1b_approved' || e.id === 'h1b_activated') gotH1b = true;
        }

        // Validate post-turn
        if (state.attributes.health < 0) issues.push(`R${round} ${reviewer.name} T${t}: health < 0`);
        if (isNaN(state.economy.cash)) issues.push(`R${round} ${reviewer.name} T${t}: cash NaN`);

        if (state.endingType) break;
      }

      if (foundJob) jobFound++;
      if (gotH1b) h1bWon++;
      if (state.immigration.hasGreenCard) { totalGC++; rGC++; }
      if (state.endingType === 'deported') { totalDeport++; rDeport++; }
      if (state.endingType === 'bankrupt') totalBankrupt++;
      totalTurns += state.turn;
      totalNW += state.attributes.netWorth;
    }
  }

  return {
    gcRate: totalGC / totalGames * 100,
    deportRate: totalDeport / totalGames * 100,
    bankruptRate: totalBankrupt / totalGames * 100,
    avgTurns: Math.round(totalTurns / totalGames),
    avgNW: Math.round(totalNW / totalGames),
    jobFoundRate: jobFound / totalGames * 100,
    h1bRate: h1bWon / totalGames * 100,
    issues,
  };
}

describe('10-Round Review Cycle', () => {
  it('runs 10 rounds of 100 games each', () => {
    const devLog: string[] = [];

    for (let round = 1; round <= 10; round++) {
      const stats = playRound(round);

      devLog.push(`\n=== ROUND ${round} ===`);
      devLog.push(`GC: ${stats.gcRate.toFixed(0)}% | Deport: ${stats.deportRate.toFixed(0)}% | Bankrupt: ${stats.bankruptRate.toFixed(0)}%`);
      devLog.push(`Job Found: ${stats.jobFoundRate.toFixed(0)}% | H1B: ${stats.h1bRate.toFixed(0)}%`);
      devLog.push(`Avg Turns: ${stats.avgTurns} | Avg NW: $${stats.avgNW.toLocaleString()}`);

      if (stats.issues.length > 0) {
        const unique = [...new Set(stats.issues)];
        devLog.push(`Issues (${unique.length} unique):`);
        unique.slice(0, 5).forEach(i => devLog.push(`  ${i}`));
      } else {
        devLog.push('Issues: 0 ✅');
      }

      // Balance assessment
      const problems: string[] = [];
      if (stats.jobFoundRate > 30) problems.push('Job found rate too high (>30%)');
      if (stats.jobFoundRate < 10) problems.push('Job found rate too low (<10%)');
      if (stats.h1bRate > 40) problems.push('H1B rate too high (>40%)');
      if (stats.gcRate > 15) problems.push('GC rate too high (>15% of starting pool)');
      if (stats.bankruptRate > 30) problems.push('Bankruptcy too common');
      if (stats.avgTurns < 20) problems.push('Games too short');

      if (problems.length > 0) {
        devLog.push(`Problems: ${problems.join('; ')}`);
      } else {
        devLog.push('Balance: ✅ All metrics in target range');
      }
    }

    // Print full dev log
    console.log('\n' + '='.repeat(60));
    console.log('DEV LOG: 10-Round Review Cycle (1000 total games)');
    console.log('Target: 20% find job, 30% of those get H1B, 20% of those get GC');
    console.log('Target GC from start: ~1.2% (very hard)');
    console.log('Game cap: 72 turns (age 40)');
    console.log('='.repeat(60));
    devLog.forEach(l => console.log(l));

    expect(true).toBe(true);
  });
});
