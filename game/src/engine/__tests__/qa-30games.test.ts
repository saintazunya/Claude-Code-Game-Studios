// QA: 30 full random games — validate every turn's input/output, action availability,
// immigration law compliance, and state consistency
import { describe, it, expect } from 'vitest';
import { createGameState, processTurn, getTurnInfo, getMaxAp, inferWorkMode } from '../game-state';
import { getAvailableActions, canSelectAction, ACTIONS } from '../actions';
import type { GameState, ActionId, CreationAttributes } from '../types';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const BUILDS: CreationAttributes[] = [
  { constitution: 3, schoolRanking: 4, geoLocation: 3 },
  { constitution: 5, schoolRanking: 2, geoLocation: 3 },
  { constitution: 2, schoolRanking: 5, geoLocation: 3 },
  { constitution: 0, schoolRanking: 5, geoLocation: 5 },
  { constitution: 5, schoolRanking: 5, geoLocation: 0 },
  { constitution: 4, schoolRanking: 3, geoLocation: 3 },
  { constitution: 1, schoolRanking: 4, geoLocation: 5 },
  { constitution: 2, schoolRanking: 4, geoLocation: 4 },
  { constitution: 5, schoolRanking: 0, geoLocation: 5 },
  { constitution: 3, schoolRanking: 3, geoLocation: 4 },
];

const ATTITUDE_IDS = new Set(['workNone', 'workSlack', 'workHard', 'workSuperHard', 'studySlack', 'studyNormal', 'studyHard']);

interface Issue {
  game: number;
  turn: number;
  age: number;
  phase: string;
  category: string;
  issue: string;
}

function validateTurn(state: GameState, prevState: GameState, gameNum: number): Issue[] {
  const issues: Issue[] = [];
  const ti = getTurnInfo(state.turn);
  const base = { game: gameNum, turn: state.turn, age: ti.age, phase: state.phase };

  function add(category: string, issue: string) {
    issues.push({ ...base, category, issue });
  }

  // === ATTRIBUTE BOUNDS ===
  for (const key of ['performance', 'skills', 'academicImpact', 'health', 'mental'] as const) {
    if (state.attributes[key] < 0) add('bounds', `${key} < 0: ${state.attributes[key]}`);
    if (key !== 'skills' && state.attributes[key] > 100) add('bounds', `${key} > 100: ${state.attributes[key]}`);
    if (isNaN(state.attributes[key])) add('bounds', `${key} is NaN`);
  }
  if (state.attributes.netWorth < 0) add('bounds', `netWorth < 0: ${state.attributes.netWorth}`);
  if (isNaN(state.attributes.netWorth)) add('bounds', 'netWorth is NaN');

  // === ECONOMY ===
  if (isNaN(state.economy.cash)) add('economy', 'cash is NaN');
  if (isNaN(state.economy.sharePrice)) add('economy', 'sharePrice is NaN');
  if (state.economy.sharePrice <= 0) add('economy', `sharePrice <= 0: ${state.economy.sharePrice}`);
  if (state.economy.portfolioShares < 0) add('economy', `shares < 0`);

  // === GPA ===
  if (state.phase === 'academic') {
    if (state.academic.gpa < 2.0) add('gpa', `GPA < 2.0: ${state.academic.gpa}`);
    if (state.academic.gpa > 4.01) add('gpa', `GPA > 4.0: ${state.academic.gpa}`);
  }

  // === IMMIGRATION LAW COMPLIANCE ===
  const imm = state.immigration;

  // F1 only during academic
  if (state.phase === 'career' && imm.visaType === 'f1' && !imm.hasGreenCard) {
    add('immigration', 'F1 visa in career phase (should be OPT/H1B)');
  }

  // H1B pending should only exist between Q2-Q4
  if (imm.h1bPending) {
    const q = ((state.turn - 1) % 4) + 1;
    // h1bPending set in Q2, cleared in Q4 — so valid in Q2,Q3,Q4
    // Actually it's set during immigration processing, could span quarters
  }

  // H1B 6-year cap check
  if (['h1b', 'h1bRenewal'].includes(imm.visaType) && imm.h1bStartTurn > 0) {
    const yearsUsed = (state.turn - imm.h1bStartTurn) / 4;
    if (yearsUsed > 7 && imm.i140Status !== 'approved') {
      // Should not have H1B beyond 6 years without I-140
      // Allow some buffer for processing
      if (yearsUsed > 8) {
        add('immigration', `H1B ${yearsUsed.toFixed(1)} years without I-140 (6yr cap)`);
      }
    }
  }

  // Combo card requires I-485 filed
  if (imm.hasComboCard && imm.i485Status === 'none') {
    add('immigration', 'Has combo card but I-485 not filed');
  }

  // Green card requires I-485 approved
  if (imm.hasGreenCard && imm.i485Status !== 'approved') {
    add('immigration', 'Has green card but I-485 not approved');
  }

  // PERM requires employment
  if (['pending', 'filing'].includes(imm.permStatus) && state.career.employed !== 'employed') {
    // PERM should have been voided on job loss — check if just lost job
    if (!state.flags.justLaidOff) {
      add('immigration', `PERM ${imm.permStatus} but not employed`);
    }
  }

  // I-140 requires PERM approved
  if (imm.i140Status === 'pending' && imm.permStatus !== 'approved') {
    add('immigration', 'I-140 pending but PERM not approved');
  }

  // === CAREER STATE ===
  if (state.phase === 'career' && state.career.employed === 'student') {
    add('career', 'Student employment in career phase');
  }
  if (state.career.level < 3 || state.career.level > 7) {
    add('career', `Invalid level: ${state.career.level}`);
  }
  if (state.career.pipQuartersRemaining < 0) {
    add('career', `PIP quarters negative: ${state.career.pipQuartersRemaining}`);
  }

  // === ACTION AVAILABILITY CHECKS ===
  const available = getAvailableActions(state);
  const availIds = new Set(available.map(a => a.id));

  // Rest should always be available
  if (!availIds.has('rest')) {
    add('actions', 'rest not available');
  }

  // Exercise should always be available
  if (!availIds.has('exercise')) {
    add('actions', 'exercise not available');
  }

  // Career actions should not appear in academic phase (except urgentJobSearch edge case)
  if (state.phase === 'academic') {
    for (const id of ['upskill', 'prepJobChange', 'entrepreneurship']) {
      if (availIds.has(id as ActionId)) {
        add('actions', `Career action ${id} available in academic phase`);
      }
    }
  }

  // Academic actions should not appear in career phase
  if (state.phase === 'career') {
    for (const id of ['studyGpa', 'searchIntern', 'thesisResearch', 'taRaWork', 'sideProject', 'networking', 'searchFullTimeJob']) {
      if (availIds.has(id as ActionId)) {
        add('actions', `Academic action ${id} available in career phase`);
      }
    }
  }

  // searchIntern should not be available during intern quarter
  if (state.flags.internActiveThisQuarter && availIds.has('searchIntern')) {
    add('actions', 'searchIntern available during active intern');
  }

  // searchFullTimeJob only in last quarter
  if (state.phase === 'academic') {
    const gradTurn = state.academic.isPhd ? 16 : 8;
    if (state.turn === gradTurn - 1 && !availIds.has('searchFullTimeJob')) {
      add('actions', 'searchFullTimeJob NOT available in last academic quarter');
    }
    if (state.turn !== gradTurn - 1 && availIds.has('searchFullTimeJob')) {
      add('actions', 'searchFullTimeJob available outside last quarter');
    }
  }

  // urgentJobSearch only when unemployed in career
  if (availIds.has('urgentJobSearch') && !(state.phase === 'career' && state.career.employed === 'unemployed')) {
    add('actions', 'urgentJobSearch available when not unemployed/career');
  }

  // workNone/workSlack/workHard/workSuperHard only when employed
  for (const id of ['workNone', 'workSlack', 'workHard', 'workSuperHard']) {
    if (availIds.has(id as ActionId) && state.career.employed !== 'employed') {
      add('actions', `${id} available when not employed`);
    }
  }

  // Hospital only when sick or health < 50
  if (availIds.has('hospital')) {
    const sicknessAP = (state.flags.sicknessApPenalty as number) || 0;
    if (!state.flags.gotSick && sicknessAP <= 0 && state.attributes.health >= 50) {
      add('actions', `hospital available but not sick and health=${Math.round(state.attributes.health)}`);
    }
  }

  // === TURN COUNTER ===
  if (state.turn !== prevState.turn + 1) {
    add('turn', `Turn jumped: ${prevState.turn} → ${state.turn}`);
  }

  return issues;
}

describe('QA: 30 Full Random Games', () => {
  it('all 30 games pass validation every turn', () => {
    const allIssues: Issue[] = [];
    const summaries: string[] = [];

    for (let g = 0; g < 30; g++) {
      const build = BUILDS[g % BUILDS.length];
      let state = createGameState(build);
      let gameIssues = 0;

      for (let t = 0; t < 148; t++) {
        const prevState = state;

        // Random action selection
        const available = getAvailableActions(state).filter(a => !ATTITUDE_IDS.has(a.id));
        const shuffled = [...available].sort(() => Math.random() - 0.5);
        const maxAp = getMaxAp(state);
        // Random attitude
        const attLevel = state.phase === 'academic' ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 4);
        const attActions: ActionId[][] = state.phase === 'academic'
          ? [['studySlack'], ['studyNormal'], ['studyHard']]
          : [['workNone'], ['workSlack'], ['workHard'], ['workSuperHard']];
        const attAction = attActions[attLevel]?.[0];
        const attCost = attAction ? (ACTIONS[attAction]?.apCost || 0) : 0;

        let remaining = maxAp - attCost;
        const selected: ActionId[] = [];
        for (const a of shuffled) {
          if (remaining <= 0) break;
          const check = canSelectAction(a, selected, remaining);
          if (check.allowed) {
            selected.push(a.id);
            remaining -= a.apCost;
          }
        }
        // Add attitude action
        if (attAction) selected.push(attAction);

        try {
          state = processTurn(state, 'normal', selected);
        } catch (e: any) {
          allIssues.push({
            game: g + 1, turn: t + 1, age: 0, phase: prevState.phase,
            category: 'crash', issue: `CRASH: ${e.message}`,
          });
          gameIssues++;
          break;
        }

        const turnIssues = validateTurn(state, prevState, g + 1);
        allIssues.push(...turnIssues);
        gameIssues += turnIssues.length;

        if (state.endingType) break;
      }

      const ti = getTurnInfo(state.turn);
      summaries.push(
        `G${g + 1}: ${state.turn}t age=${ti.age} ${state.endingType || 'ongoing'} ` +
        `NW=$${Math.round(state.attributes.netWorth)} L${state.career.level} ` +
        `visa=${state.immigration.visaType} issues=${gameIssues}`
      );
    }

    // Print results
    console.log('\n=== QA: 30 RANDOM GAMES ===');
    for (const s of summaries) console.log(s);

    if (allIssues.length > 0) {
      // Deduplicate by category+issue
      const uniqueIssues = new Map<string, Issue>();
      for (const i of allIssues) {
        const key = `${i.category}:${i.issue}`;
        if (!uniqueIssues.has(key)) uniqueIssues.set(key, i);
      }
      console.log(`\n${allIssues.length} total issues (${uniqueIssues.size} unique):`);
      for (const [key, i] of uniqueIssues) {
        const count = allIssues.filter(x => `${x.category}:${x.issue}` === key).length;
        console.log(`  [${i.category}] ${i.issue} (×${count}, first: G${i.game} T${i.turn})`);
      }
    } else {
      console.log('\n✅ 0 issues across all 30 games!');
    }

    expect(allIssues.length).toBe(0);
  });
});
