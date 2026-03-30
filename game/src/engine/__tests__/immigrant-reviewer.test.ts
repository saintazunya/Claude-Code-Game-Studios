// 5 Chinese tech immigrant reviewers, 20 games each = 100 total games
// Each reviewer has a different background/strategy and gives feedback
import { describe, it, expect } from 'vitest';
import { createGameState, processTurn, getTurnInfo, getMaxAp } from '../game-state';
import { getAvailableActions, canSelectAction, ACTIONS } from '../actions';
import type { GameState, ActionId, CreationAttributes } from '../types';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const ATTITUDE_IDS = new Set(['workNone', 'workSlack', 'workHard', 'workSuperHard', 'studySlack', 'studyNormal', 'studyHard']);

interface ReviewerProfile {
  name: string;
  background: string;
  build: CreationAttributes;
  strategy: (state: GameState) => ActionId[];
}

function selectActions(state: GameState, priorities: ActionId[]): ActionId[] {
  const available = getAvailableActions(state).filter(a => !ATTITUDE_IDS.has(a.id));
  const maxAp = getMaxAp(state);
  // Pick attitude (default normal = level 1)
  const attActions: ActionId[] = state.phase === 'academic'
    ? ['studySlack', 'studyNormal', 'studyHard']
    : ['workNone', 'workSlack', 'workHard', 'workSuperHard'];
  const attLevel = state.attributes.health < 40 || state.attributes.mental < 30 ? 0 :
    state.attributes.health > 70 && state.attributes.mental > 50 ? Math.min(2, attActions.length - 1) : 1;
  const attCost = ACTIONS[attActions[attLevel]]?.apCost || 0;

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

  // Fill remaining with random
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

  selected.push(attActions[attLevel]);
  return selected;
}

const REVIEWERS: ReviewerProfile[] = [
  {
    name: '小王 (SDE, 均衡型)',
    background: 'CMU CS硕士, 正常找工作路线, 稳扎稳打',
    build: { constitution: 3, schoolRanking: 4, geoLocation: 3 },
    strategy: (s) => {
      const p: ActionId[] = [];
      if (s.phase === 'academic') {
        if (!s.academic.hadIntern) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('networking', 'sideProject', 'exercise');
        const gradTurn = s.academic.isPhd ? 16 : 8;
        if (s.turn === gradTurn - 1) p.push('searchFullTimeJob');
      } else {
        p.push('workHard');
        if (s.attributes.health < 50) p.push('hospital', 'rest');
        if (s.attributes.mental < 40) p.push('therapist');
        p.push('upskill', 'exercise');
        if (s.career.employed === 'unemployed') p.push('normalJobSearch', 'urgentJobSearch');
      }
      return selectActions(s, p);
    },
  },
  {
    name: '小李 (卷王)',
    background: '清华本科, MIT硕士, 疯狂卷绩效冲升职',
    build: { constitution: 5, schoolRanking: 5, geoLocation: 0 },
    strategy: (s) => {
      const p: ActionId[] = [];
      if (s.phase === 'academic') {
        if (!s.academic.hadIntern) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('sideProject', 'networking');
        const gradTurn = s.academic.isPhd ? 16 : 8;
        if (s.turn === gradTurn - 1) p.push('searchFullTimeJob');
      } else {
        p.push('workSuperHard');
        if (s.attributes.health < 30) p.push('hospital');
        p.push('upskill');
        if (s.career.employed === 'unemployed') p.push('urgentJobSearch');
      }
      return selectActions(s, p);
    },
  },
  {
    name: '小张 (养生型)',
    background: '普通学校, 注重work-life balance, 不卷',
    build: { constitution: 4, schoolRanking: 3, geoLocation: 3 },
    strategy: (s) => {
      const p: ActionId[] = [];
      if (s.phase === 'academic') {
        if (!s.academic.hadIntern) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('exercise', 'rest', 'networking');
        const gradTurn = s.academic.isPhd ? 16 : 8;
        if (s.turn === gradTurn - 1) p.push('searchFullTimeJob');
      } else {
        p.push('workSlack');
        p.push('rest', 'exercise', 'therapist');
        if (s.career.employed === 'unemployed') p.push('normalJobSearch');
      }
      return selectActions(s, p);
    },
  },
  {
    name: '小陈 (学术型)',
    background: 'Stanford PhD, 发论文走EB1A/NIW路线',
    build: { constitution: 2, schoolRanking: 5, geoLocation: 3 },
    strategy: (s) => {
      const p: ActionId[] = [];
      if (s.phase === 'academic') {
        if (!s.academic.hadIntern) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('sideProject', 'networking');
        const gradTurn = s.academic.isPhd ? 16 : 8;
        if (s.turn === gradTurn - 1) p.push('searchFullTimeJob');
      } else {
        p.push('workHard', 'publishPaper', 'researchNiw');
        if (s.attributes.health < 40) p.push('rest');
        if (s.attributes.mental < 35) p.push('therapist');
        if (s.career.employed === 'unemployed') p.push('normalJobSearch');
      }
      return selectActions(s, p);
    },
  },
  {
    name: '小赵 (随机型)',
    background: '随便选, 模拟新手玩家',
    build: { constitution: 2, schoolRanking: 4, geoLocation: 4 },
    strategy: (s) => {
      return selectActions(s, []); // pure random
    },
  },
];

interface GameResult {
  turns: number;
  ending: string;
  level: number;
  netWorth: number;
  hasGC: boolean;
  hasCombo: boolean;
  maxMental: number;
  minMental: number;
  avgMental: number;
  events: string[];
  permApproved: boolean;
  i140Approved: boolean;
  h1bAttempts: number;
  promotions: number;
  sicknesses: number;
  burnouts: number;
}

function playGame(reviewer: ReviewerProfile): GameResult {
  let state = createGameState(reviewer.build);
  let maxMental = 70, minMental = 70, totalMental = 0, mentalSamples = 0;
  let promotions = 0, sicknesses = 0, burnouts = 0;
  const keyEvents: string[] = [];

  for (let t = 0; t < 148; t++) {
    const actions = reviewer.strategy(state);
    const prev = state;

    try {
      state = processTurn(state, 'normal', actions);
    } catch (e) {
      keyEvents.push(`CRASH@${t}`);
      break;
    }

    // Track stats
    const m = state.attributes.mental;
    maxMental = Math.max(maxMental, m);
    minMental = Math.min(minMental, m);
    totalMental += m;
    mentalSamples++;

    // Track key events
    const lastEvents = state.timeline[state.timeline.length - 1]?.events || [];
    for (const e of lastEvents) {
      if (['promoted', 'h1b_approved', 'h1b_denied', 'h1b_activated', 'green_card_approved',
           'i485_filed_combo_card', 'i140_approved', 'perm_approved', 'perm_rejected',
           'laid_off', 'layoff_survived', 'burnout', 'deported',
           'first_job_found', 'graduated_unemployed'].includes(e.id)) {
        keyEvents.push(`T${state.turn}:${e.id}`);
      }
      if (e.id === 'promoted') promotions++;
      if (e.id.startsWith('sickness_')) sicknesses++;
      if (e.id === 'burnout') burnouts++;
    }

    if (state.endingType) break;
  }

  return {
    turns: state.turn,
    ending: state.endingType || 'ongoing',
    level: state.career.level,
    netWorth: Math.round(state.attributes.netWorth),
    hasGC: state.immigration.hasGreenCard,
    hasCombo: state.immigration.hasComboCard,
    maxMental: Math.round(maxMental),
    minMental: Math.round(minMental),
    avgMental: mentalSamples > 0 ? Math.round(totalMental / mentalSamples) : 0,
    events: keyEvents,
    permApproved: state.immigration.permStatus === 'approved',
    i140Approved: state.immigration.i140Status === 'approved',
    h1bAttempts: state.immigration.h1bAttempts,
    promotions,
    sicknesses,
    burnouts,
  };
}

describe('5 Immigrant Reviewers × 20 Games = 100 Games', () => {
  it('runs all 100 games and produces review', () => {
    const allResults: Map<string, GameResult[]> = new Map();

    for (const reviewer of REVIEWERS) {
      const results: GameResult[] = [];
      for (let g = 0; g < 20; g++) {
        results.push(playGame(reviewer));
      }
      allResults.set(reviewer.name, results);
    }

    // === PRINT REVIEWS ===
    console.log('\n' + '='.repeat(80));
    console.log('100-GAME IMMIGRANT REVIEWER REPORT');
    console.log('='.repeat(80));

    for (const [name, results] of allResults) {
      const reviewer = REVIEWERS.find(r => r.name === name)!;
      const gcRate = results.filter(r => r.hasGC).length;
      const deportRate = results.filter(r => r.ending === 'deported').length;
      const bankruptRate = results.filter(r => r.ending === 'bankrupt').length;
      const avgTurns = Math.round(results.reduce((s, r) => s + r.turns, 0) / results.length);
      const avgNW = Math.round(results.reduce((s, r) => s + r.netWorth, 0) / results.length);
      const avgLevel = (results.reduce((s, r) => s + r.level, 0) / results.length).toFixed(1);
      const avgMental = Math.round(results.reduce((s, r) => s + r.avgMental, 0) / results.length);
      const avgPromos = (results.reduce((s, r) => s + r.promotions, 0) / results.length).toFixed(1);
      const avgSick = (results.reduce((s, r) => s + r.sicknesses, 0) / results.length).toFixed(1);
      const avgBurnout = (results.reduce((s, r) => s + r.burnouts, 0) / results.length).toFixed(1);
      const h1bSuccessRate = results.filter(r => r.events.some(e => e.includes('h1b_approved'))).length;
      const comboRate = results.filter(r => r.hasCombo || r.hasGC).length;
      const permRate = results.filter(r => r.permApproved).length;
      const i140Rate = results.filter(r => r.i140Approved).length;

      const endings = results.reduce((acc, r) => { acc[r.ending] = (acc[r.ending] || 0) + 1; return acc; }, {} as Record<string, number>);

      console.log(`\n${'─'.repeat(60)}`);
      console.log(`👤 ${name}`);
      console.log(`   ${reviewer.background}`);
      console.log(`   Build: ${reviewer.build.constitution}/${reviewer.build.schoolRanking}/${reviewer.build.geoLocation}`);
      console.log(`${'─'.repeat(60)}`);
      console.log(`   Endings: ${Object.entries(endings).map(([k,v]) => `${k}=${v}`).join(', ')}`);
      console.log(`   GC Rate: ${gcRate}/20 (${gcRate*5}%)`);
      console.log(`   Combo Card: ${comboRate}/20`);
      console.log(`   H1B Won: ${h1bSuccessRate}/20`);
      console.log(`   PERM Approved: ${permRate}/20`);
      console.log(`   I-140 Approved: ${i140Rate}/20`);
      console.log(`   Avg Turns: ${avgTurns} | Avg Level: L${avgLevel}`);
      console.log(`   Avg NW: $${avgNW.toLocaleString()} | Avg Mental: ${avgMental}`);
      console.log(`   Avg Promotions: ${avgPromos} | Sickness: ${avgSick} | Burnout: ${avgBurnout}`);
    }

    // === AGGREGATE STATS ===
    const all = [...allResults.values()].flat();
    const totalGC = all.filter(r => r.hasGC).length;
    const totalDeport = all.filter(r => r.ending === 'deported').length;
    const totalBankrupt = all.filter(r => r.ending === 'bankrupt').length;
    const total148 = all.filter(r => r.turns >= 148).length;
    const avgTurnsAll = Math.round(all.reduce((s, r) => s + r.turns, 0) / all.length);

    console.log(`\n${'='.repeat(60)}`);
    console.log('AGGREGATE (100 games)');
    console.log(`${'='.repeat(60)}`);
    console.log(`GC Rate: ${totalGC}/100 (${totalGC}%)`);
    console.log(`Deported: ${totalDeport}/100`);
    console.log(`Bankrupt: ${totalBankrupt}/100`);
    console.log(`Reached Age 59: ${total148}/100`);
    console.log(`Avg Game Length: ${avgTurnsAll} turns`);

    // === ISSUES ===
    console.log(`\n${'='.repeat(60)}`);
    console.log('BALANCE ASSESSMENT');
    console.log(`${'='.repeat(60)}`);

    if (totalGC < 15) console.log('❌ GC rate too low (<15%) — immigration pipeline needs tuning');
    else if (totalGC > 50) console.log('❌ GC rate too high (>50%) — game too easy');
    else console.log('✅ GC rate reasonable (15-50%)');

    if (totalDeport > 50) console.log('❌ Deportation too high (>50%) — game too punishing');
    else if (totalDeport < 10) console.log('⚠️ Deportation very rare — visa system may be too forgiving');
    else console.log('✅ Deportation rate reasonable');

    if (totalBankrupt > 20) console.log('❌ Bankruptcy too common — economy too harsh');
    else console.log('✅ Bankruptcy rate reasonable');

    if (avgTurnsAll < 30) console.log('❌ Games too short (avg <30 turns) — most end early');
    else if (avgTurnsAll > 120) console.log('⚠️ Games very long — pacing may drag');
    else console.log('✅ Game length reasonable');

    // No assertion — this is a review, not a pass/fail test
    expect(true).toBe(true);
  });
});
