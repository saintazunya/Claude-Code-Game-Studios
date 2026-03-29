// Action Reasonability Simulator: validates that available actions make sense for current state
import { describe, it, expect } from 'vitest';
import { createGameState, processTurn, getTurnInfo, getEffectiveAp, getWorkModeCost } from '../game-state';
import { getAvailableActions, canSelectAction, ACTIONS } from '../actions';
import type { GameState, WorkMode, AcademicStudyMode, ActionId, CreationAttributes } from '../types';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface ActionIssue {
  turn: number;
  age: number;
  phase: string;
  issue: string;
}

function validateAvailableActions(state: GameState): ActionIssue[] {
  const issues: ActionIssue[] = [];
  const ti = getTurnInfo(state.turn);
  const available = getAvailableActions(state);
  const availableIds = available.map(a => a.id);

  // === ACTIONS THAT SHOULD NOT BE AVAILABLE ===

  // Career actions during academic phase
  if (state.phase === 'academic') {
    // urgentJobSearch is allowed in last academic quarter (before graduation)
    const careerOnly: ActionId[] = ['upskill', 'prepJobChange', 'prepJobChangeIntensive', 'entrepreneurship'];
    for (const id of careerOnly) {
      if (availableIds.includes(id)) {
        issues.push({ turn: state.turn, age: ti.age, phase: state.phase, issue: `Career action "${id}" available during academic phase` });
      }
    }
  }

  // Academic actions during career phase
  if (state.phase === 'career') {
    const academicOnly: ActionId[] = ['studyGpa', 'searchIntern', 'thesisResearch', 'taRaWork', 'sideProject'];
    for (const id of academicOnly) {
      if (availableIds.includes(id)) {
        // networking is 'academic' phase only — check it
        issues.push({ turn: state.turn, age: ti.age, phase: state.phase, issue: `Academic action "${id}" available during career phase` });
      }
    }
  }

  // searchIntern should NOT be available if already has intern
  if (state.academic.hadIntern && availableIds.includes('searchIntern')) {
    issues.push({ turn: state.turn, age: ti.age, phase: state.phase, issue: 'searchIntern available but already has intern' });
  }

  // internWork should ONLY be available during intern quarter
  if (availableIds.includes('internWork') && !state.flags.internActiveThisQuarter) {
    issues.push({ turn: state.turn, age: ti.age, phase: state.phase, issue: 'internWork available but not in intern quarter' });
  }

  // prepH1b should NOT be available if already filed
  if (state.immigration.h1bFiled && availableIds.includes('prepH1b')) {
    issues.push({ turn: state.turn, age: ti.age, phase: state.phase, issue: 'prepH1b available but H1B already filed this year' });
  }

  // prepH1b should NOT be available if not on OPT/OPT STEM
  if (!['opt', 'optStem'].includes(state.immigration.visaType) && availableIds.includes('prepH1b')) {
    issues.push({ turn: state.turn, age: ti.age, phase: state.phase, issue: `prepH1b available but visa is ${state.immigration.visaType}, not OPT` });
  }

  // prepJobChange should NOT be available during PIP
  if (state.career.onPip && (availableIds.includes('prepJobChange') || availableIds.includes('prepJobChangeIntensive'))) {
    issues.push({ turn: state.turn, age: ti.age, phase: state.phase, issue: 'Job change prep available during PIP' });
  }

  // urgentJobSearch: available when unemployed OR in last academic quarter without return offer
  if (availableIds.includes('urgentJobSearch')) {
    const gradTurn = state.academic.isPhd ? 16 : 8;
    const isLastAcademicQ = state.phase === 'academic' && state.turn === gradTurn - 1 && !state.academic.hasReturnOffer;
    const isUnemployed = state.career.employed === 'unemployed';
    if (!isUnemployed && !isLastAcademicQ) {
      issues.push({ turn: state.turn, age: ti.age, phase: state.phase, issue: 'urgentJobSearch available but not unemployed or pre-graduation' });
    }
  }

  // entrepreneurship should NOT be available if net worth < 50K
  if (state.attributes.netWorth < 50000 && availableIds.includes('entrepreneurship')) {
    issues.push({ turn: state.turn, age: ti.age, phase: state.phase, issue: `entrepreneurship available but NW=$${Math.round(state.attributes.netWorth)}` });
  }

  // publishPaper should NOT be available for RS career path
  if (state.career.path === 'rs' && availableIds.includes('publishPaper')) {
    issues.push({ turn: state.turn, age: ti.age, phase: state.phase, issue: 'publishPaper available for RS (should get papers for free)' });
  }

  // thesisResearch should ONLY be available for PhD students after turn 8
  if (availableIds.includes('thesisResearch')) {
    if (!state.academic.isPhd) {
      issues.push({ turn: state.turn, age: ti.age, phase: state.phase, issue: 'thesisResearch available but not PhD student' });
    }
    if (state.turn < 8) {
      issues.push({ turn: state.turn, age: ti.age, phase: state.phase, issue: 'thesisResearch available before turn 8' });
    }
  }

  // taRaWork should ONLY be available for PhD students
  if (availableIds.includes('taRaWork') && !state.academic.isPhd) {
    issues.push({ turn: state.turn, age: ti.age, phase: state.phase, issue: 'taRaWork available but not PhD student' });
  }

  // hospital should only be available when sick or health < 50
  if (availableIds.includes('hospital')) {
    if (!state.flags.gotSick && state.attributes.health >= 50) {
      issues.push({ turn: state.turn, age: ti.age, phase: state.phase, issue: `hospital available but not sick and health=${Math.round(state.attributes.health)}` });
    }
  }

  // === ACTIONS THAT SHOULD BE AVAILABLE BUT AREN'T ===

  // rest should ALWAYS be available
  if (!availableIds.includes('rest')) {
    issues.push({ turn: state.turn, age: ti.age, phase: state.phase, issue: 'rest NOT available (should always be)' });
  }

  // exercise should ALWAYS be available
  if (!availableIds.includes('exercise')) {
    issues.push({ turn: state.turn, age: ti.age, phase: state.phase, issue: 'exercise NOT available (should always be)' });
  }

  // === AP COST REASONABILITY ===

  // When sick, rest/hospital/exercise should be free (0 AP)
  const isSick = (state.flags.sicknessApPenalty as number) > 0 || state.flags.burnoutActive || state.attributes.health <= 0;
  if (isSick) {
    const restAction = available.find(a => a.id === 'rest');
    if (restAction && restAction.apCost !== 0) {
      issues.push({ turn: state.turn, age: ti.age, phase: state.phase, issue: `rest costs ${restAction.apCost} AP when sick (should be 0)` });
    }
    const exerciseAction = available.find(a => a.id === 'exercise');
    if (exerciseAction && exerciseAction.apCost !== 0) {
      issues.push({ turn: state.turn, age: ti.age, phase: state.phase, issue: `exercise costs ${exerciseAction.apCost} AP when sick (should be 0)` });
    }
    const hospitalAction = available.find(a => a.id === 'hospital');
    if (hospitalAction && hospitalAction.apCost !== 0) {
      issues.push({ turn: state.turn, age: ti.age, phase: state.phase, issue: `hospital costs ${hospitalAction.apCost} AP when sick (should be 0)` });
    }
  }

  // === MUTUAL EXCLUSION CHECKS ===
  // Verify exclusive actions can't both be selected
  for (const action of available) {
    if (action.exclusive) {
      for (const exclId of action.exclusive) {
        // Both should be available, but selecting one should block the other
        if (availableIds.includes(exclId as ActionId)) {
          const check = canSelectAction(ACTIONS[exclId as ActionId], [action.id], 20);
          if (check.allowed) {
            issues.push({ turn: state.turn, age: ti.age, phase: state.phase,
              issue: `Mutual exclusion broken: ${action.id} and ${exclId} can both be selected` });
          }
        }
      }
    }
  }

  return issues;
}

function runActionValidationGame(build: CreationAttributes, name: string): { issues: ActionIssue[]; summary: string } {
  let state = createGameState(build);
  const allIssues: ActionIssue[] = [];

  for (let t = 0; t < 148; t++) {
    // Validate actions BEFORE selecting
    const issues = validateAvailableActions(state);
    allIssues.push(...issues);

    // Play the turn with smart strategy
    const isAcademic = state.phase === 'academic';
    const modes = isAcademic
      ? ['light', 'normal', 'intense'] as AcademicStudyMode[]
      : ['coast', 'normal', 'grind'] as WorkMode[];
    const filtered = modes.filter(m => !((m === 'grind' || m === 'intense') && state.grindLockQuarters > 0));
    const wm = pick(filtered.length > 0 ? filtered : ['normal' as any]);

    const available = getAvailableActions(state);
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    let rem = getEffectiveAp(state, wm) - getWorkModeCost(wm);
    const sel: ActionId[] = [];
    // Prioritize survival
    const priorities: ActionId[] = ['searchIntern', 'internWork', 'prepH1b', 'rest', 'exercise'];
    for (const id of priorities) {
      const a = available.find(x => x.id === id);
      if (a && rem >= a.apCost) {
        const check = canSelectAction(a, sel, rem);
        if (check.allowed) { sel.push(a.id); rem -= a.apCost; }
      }
    }
    // Fill remaining with random
    for (const a of shuffled) {
      if (rem <= 0) break;
      const check = canSelectAction(a, sel, rem);
      if (check.allowed) { sel.push(a.id); rem -= a.apCost; }
    }

    try {
      state = processTurn(state, wm, sel);
    } catch (e: any) {
      allIssues.push({ turn: t + 1, age: 22 + Math.floor(t / 4), phase: state.phase, issue: `CRASH: ${e.message}` });
      break;
    }

    if (state.endingType) break;
  }

  const ti = getTurnInfo(state.turn);
  const summary = `${state.turn}t age=${ti.age} ending=${state.endingType || 'none'} visa=${state.immigration.visaType}`;
  return { issues: allIssues, summary };
}

describe('Action Reasonability Simulator', () => {
  const configs = [
    { name: 'Balanced (3/4/3)', build: { constitution: 3, schoolRanking: 4, geoLocation: 3 } as CreationAttributes },
    { name: 'Glass Cannon (0/5/5)', build: { constitution: 0, schoolRanking: 5, geoLocation: 5 } as CreationAttributes },
    { name: 'Iron Man (5/2/3)', build: { constitution: 5, schoolRanking: 2, geoLocation: 3 } as CreationAttributes },
    { name: 'No Geo (5/5/0)', build: { constitution: 5, schoolRanking: 5, geoLocation: 0 } as CreationAttributes },
    { name: 'Random (2/4/4)', build: { constitution: 2, schoolRanking: 4, geoLocation: 4 } as CreationAttributes },
  ];

  it('all 5 games have reasonable action availability', () => {
    const allIssues: ActionIssue[] = [];

    console.log('\n=== ACTION REASONABILITY TEST ===');
    for (const config of configs) {
      const { issues, summary } = runActionValidationGame(config.build, config.name);
      const status = issues.length === 0 ? '✅' : `❌ (${issues.length})`;
      console.log(`${status} ${config.name}: ${summary}`);

      if (issues.length > 0) {
        // Deduplicate similar issues
        const seen = new Set<string>();
        for (const issue of issues) {
          const key = issue.issue;
          if (!seen.has(key)) {
            seen.add(key);
            console.log(`     T${issue.turn} age=${issue.age} [${issue.phase}]: ${issue.issue}`);
          }
        }
      }

      allIssues.push(...issues);
    }

    const uniqueIssues = [...new Set(allIssues.map(i => i.issue))];
    console.log(`\nTotal: ${allIssues.length} issues (${uniqueIssues.length} unique types)`);
    if (uniqueIssues.length > 0) {
      console.log('Unique issue types:');
      uniqueIssues.forEach(i => console.log(`  - ${i}`));
    }

    expect(allIssues.length).toBe(0);
  });
});
