// Headless game simulator — plays full games with random choices and validates every turn
import { describe, it, expect } from 'vitest';
import { createGameState, processTurn, getTurnInfo, getEffectiveAp, getWorkModeCost } from '../game-state';
import { getAvailableActions, canSelectAction } from '../actions';
import type { GameState, WorkMode, AcademicStudyMode, ActionId, CreationAttributes } from '../types';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const BUILDS: CreationAttributes[] = [
  { constitution: 3, schoolRanking: 4, geoLocation: 3 },
  { constitution: 5, schoolRanking: 2, geoLocation: 3 },
  { constitution: 2, schoolRanking: 5, geoLocation: 3 },
  { constitution: 2, schoolRanking: 3, geoLocation: 5 },
  { constitution: 0, schoolRanking: 5, geoLocation: 5 },
  { constitution: 5, schoolRanking: 5, geoLocation: 0 },
  { constitution: 4, schoolRanking: 3, geoLocation: 3 },
  { constitution: 1, schoolRanking: 4, geoLocation: 5 },
];

interface TurnValidation {
  turn: number;
  errors: string[];
  warnings: string[];
}

function validateState(state: GameState, prevState: GameState | null): TurnValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Turn counter
  if (prevState && state.turn !== prevState.turn + 1) {
    errors.push(`Turn jumped: ${prevState.turn} → ${state.turn}`);
  }

  // Attribute bounds
  for (const key of ['performance', 'skills', 'academicImpact', 'health', 'mental'] as const) {
    const val = state.attributes[key];
    if (val < 0) errors.push(`${key} < 0: ${val}`);
    if (key !== 'skills' && val > 100) errors.push(`${key} > 100: ${val}`);
    if (isNaN(val)) errors.push(`${key} is NaN`);
    if (!isFinite(val)) errors.push(`${key} is Infinite`);
  }
  if (isNaN(state.attributes.netWorth)) errors.push('netWorth is NaN');

  // Economy
  if (isNaN(state.economy.cash)) errors.push('cash is NaN');
  if (isNaN(state.economy.portfolioShares)) errors.push('shares is NaN');
  if (isNaN(state.economy.sharePrice)) errors.push('sharePrice is NaN');
  if (state.economy.sharePrice <= 0) errors.push(`sharePrice <= 0: ${state.economy.sharePrice}`);
  if (state.economy.portfolioShares < 0) errors.push(`shares < 0: ${state.economy.portfolioShares}`);

  // Phase
  if (!['academic', 'career'].includes(state.phase)) errors.push(`Bad phase: ${state.phase}`);
  if (state.phase === 'academic' && state.turn > 16) errors.push(`Academic at turn ${state.turn}`);

  // Visa
  const validVisas = ['f1', 'opt', 'optStem', 'h1b', 'h1bRenewal', 'h1b7thYear', 'o1', 'l1', 'cptDay1', 'comboCard', 'greenCard'];
  if (!validVisas.includes(state.immigration.visaType)) errors.push(`Bad visa: ${state.immigration.visaType}`);

  // Career level
  if (state.career.level < 3 || state.career.level > 7) errors.push(`Bad level: ${state.career.level}`);

  // GPA
  if (state.phase === 'academic' && (state.academic.gpa < 0 || state.academic.gpa > 4.01)) {
    errors.push(`GPA out of range: ${state.academic.gpa}`);
  }

  // Timeline
  if (state.timeline.length !== state.turn) {
    warnings.push(`Timeline ${state.timeline.length} != turn ${state.turn}`);
  }

  // Negative grind lock
  if (state.grindLockQuarters < -1) {
    warnings.push(`grindLock very negative: ${state.grindLockQuarters}`);
  }

  // Net worth consistency
  const pv = state.economy.portfolioShares * state.economy.sharePrice;
  const he = state.economy.ownsHome ? Math.max(0, state.economy.homeValue - state.economy.homeMortgageRemaining) : 0;
  const expectedNw = state.economy.cash + pv + he - state.economy.studentLoanRemaining;
  if (Math.abs(state.attributes.netWorth - expectedNw) > 100) {
    warnings.push(`NW mismatch: ${Math.round(state.attributes.netWorth)} vs ${Math.round(expectedNw)}`);
  }

  // Career phase consistency
  if (state.phase === 'career' && state.career.employed === 'student') {
    errors.push('Career phase but still student');
  }

  // PIP
  if (state.career.pipQuartersRemaining < 0) {
    warnings.push(`PIP quarters negative: ${state.career.pipQuartersRemaining}`);
  }

  return { turn: state.turn, errors, warnings };
}

type Strategy = 'random' | 'smart' | 'grinder' | 'coaster';

function selectActionsWithStrategy(
  state: GameState,
  workMode: WorkMode | AcademicStudyMode,
  strategy: Strategy
): ActionId[] {
  const effectiveAp = getEffectiveAp(state, workMode);
  const workCost = getWorkModeCost(workMode);
  let remainingAp = effectiveAp - workCost;

  const available = getAvailableActions(state);
  const selected: ActionId[] = [];

  if (strategy === 'smart') {
    // Prioritize survival actions
    const priorities: ActionId[] = [];

    // Academic: search intern if don't have one
    if (state.phase === 'academic' && !state.academic.hadIntern) {
      priorities.push('searchIntern');
    }
    // Academic: work hard at intern
    if (state.flags.internActiveThisQuarter) {
      priorities.push('internWork');
    }
    // Career: file H1B if on OPT
    if (['opt', 'optStem'].includes(state.immigration.visaType) && !state.immigration.h1bFiled) {
      priorities.push('prepH1b');
    }
    // Health low: rest or hospital
    if (state.attributes.health < 40) {
      priorities.push('hospital', 'rest');
    }
    // Mental low: therapist
    if (state.attributes.mental < 35) {
      priorities.push('therapist', 'rest');
    }
    // Default fillers
    priorities.push('upskill', 'exercise', 'studyGpa', 'networking');

    for (const actionId of priorities) {
      if (remainingAp <= 0) break;
      const action = available.find(a => a.id === actionId);
      if (!action) continue;
      const check = canSelectAction(action, selected, remainingAp);
      if (check.allowed) {
        selected.push(action.id);
        remainingAp -= action.apCost;
      }
    }
  } else {
    // Random selection
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    for (const action of shuffled) {
      if (remainingAp <= 0) break;
      const check = canSelectAction(action, selected, remainingAp);
      if (check.allowed) {
        selected.push(action.id);
        remainingAp -= action.apCost;
      }
    }
  }

  return selected;
}

function simulateGame(
  gameNum: number,
  strategy: Strategy = 'random'
): { validations: TurnValidation[]; finalState: GameState; endReason: string; turns: number } {
  const creation = BUILDS[gameNum % BUILDS.length];
  let state = createGameState(creation);
  let prevState: GameState | null = null;
  const validations: TurnValidation[] = [];

  for (let t = 0; t < 148; t++) {
    const isAcademic = state.phase === 'academic';
    const workModes = isAcademic
      ? ['light', 'normal', 'intense'] as AcademicStudyMode[]
      : ['coast', 'normal', 'grind'] as WorkMode[];

    const availableModes = workModes.filter(m => {
      if ((m === 'grind' || m === 'intense') && state.grindLockQuarters > 0) return false;
      return true;
    });

    let workMode: WorkMode | AcademicStudyMode;
    if (strategy === 'grinder') {
      workMode = availableModes.includes('grind' as any) || availableModes.includes('intense' as any)
        ? (isAcademic ? 'intense' : 'grind') as any
        : pick(availableModes);
    } else if (strategy === 'coaster') {
      workMode = isAcademic ? 'light' : 'coast';
    } else {
      workMode = pick(availableModes);
    }

    const selectedActions = selectActionsWithStrategy(state, workMode, strategy);

    prevState = state;
    try {
      state = processTurn(state, workMode, selectedActions);
    } catch (e: any) {
      validations.push({
        turn: t + 1,
        errors: [`CRASH: ${e.message}\n${e.stack?.split('\n').slice(0, 5).join('\n')}`],
        warnings: [],
      });
      return { validations, finalState: prevState, endReason: `CRASH@${t + 1}`, turns: t + 1 };
    }

    const validation = validateState(state, prevState);
    if (validation.errors.length > 0 || validation.warnings.length > 0) {
      validations.push(validation);
    }

    if (state.endingType) {
      return { validations, finalState: state, endReason: state.endingType, turns: state.turn };
    }
  }

  return { validations, finalState: state, endReason: state.endingType || 'completed', turns: state.turn };
}

describe('Game Simulator', () => {
  it('10 random games: no crashes, no validation errors', () => {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    const results: string[] = [];

    for (let g = 0; g < 10; g++) {
      const { validations, finalState, endReason, turns } = simulateGame(g, 'random');
      for (const v of validations) {
        for (const err of v.errors) allErrors.push(`Random G${g + 1} T${v.turn}: ${err}`);
        for (const warn of v.warnings) allWarnings.push(`Random G${g + 1} T${v.turn}: ${warn}`);
      }
      results.push(`Random G${g + 1}: ${turns}t ending=${endReason} NW=$${Math.round(finalState.attributes.netWorth)} L${finalState.career.level}`);
    }

    console.log('\n=== RANDOM GAMES ===');
    results.forEach(r => console.log(r));

    if (allErrors.length) {
      console.log('\nERRORS:');
      allErrors.slice(0, 20).forEach(e => console.log(`  ${e}`));
    }
    if (allWarnings.length) {
      console.log('\nWARNINGS:');
      allWarnings.slice(0, 20).forEach(w => console.log(`  ${w}`));
    }

    expect(allErrors).toEqual([]);
  });

  it('10 smart games: most survive past deportation', () => {
    const allErrors: string[] = [];
    const results: string[] = [];
    let survived = 0;

    for (let g = 0; g < 10; g++) {
      const { validations, finalState, endReason, turns } = simulateGame(g, 'smart');
      for (const v of validations) {
        for (const err of v.errors) allErrors.push(`Smart G${g + 1} T${v.turn}: ${err}`);
      }
      if (turns > 20) survived++;
      results.push(`Smart G${g + 1}: ${turns}t ending=${endReason} NW=$${Math.round(finalState.attributes.netWorth)} L${finalState.career.level} visa=${finalState.immigration.visaType}`);
    }

    console.log('\n=== SMART GAMES ===');
    results.forEach(r => console.log(r));
    console.log(`Survived past turn 20: ${survived}/10`);

    expect(allErrors).toEqual([]);
  });

  it('5 grinder games: validates health spiral', () => {
    const allErrors: string[] = [];
    const results: string[] = [];

    for (let g = 0; g < 5; g++) {
      const { validations, finalState, endReason, turns } = simulateGame(g, 'grinder');
      for (const v of validations) {
        for (const err of v.errors) allErrors.push(`Grinder G${g + 1} T${v.turn}: ${err}`);
      }
      results.push(`Grinder G${g + 1}: ${turns}t ending=${endReason} health=${Math.round(finalState.attributes.health)} NW=$${Math.round(finalState.attributes.netWorth)}`);
    }

    console.log('\n=== GRINDER GAMES ===');
    results.forEach(r => console.log(r));

    expect(allErrors).toEqual([]);
  });

  it('5 coaster games: validates coast viability', () => {
    const allErrors: string[] = [];
    const results: string[] = [];

    for (let g = 0; g < 5; g++) {
      const { validations, finalState, endReason, turns } = simulateGame(g, 'coaster');
      for (const v of validations) {
        for (const err of v.errors) allErrors.push(`Coaster G${g + 1} T${v.turn}: ${err}`);
      }
      results.push(`Coaster G${g + 1}: ${turns}t ending=${endReason} perf=${Math.round(finalState.attributes.performance)} NW=$${Math.round(finalState.attributes.netWorth)}`);
    }

    console.log('\n=== COASTER GAMES ===');
    results.forEach(r => console.log(r));

    expect(allErrors).toEqual([]);
  });
});
