// Extended simulator: 20 targeted test runs designed to find edge cases
import { describe, it, expect } from 'vitest';
import { createGameState, processTurn, getTurnInfo, getEffectiveAp, getWorkModeCost } from '../game-state';
import { getAvailableActions, canSelectAction } from '../actions';
import type { GameState, WorkMode, AcademicStudyMode, ActionId, CreationAttributes } from '../types';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface RunConfig {
  name: string;
  build: CreationAttributes;
  strategy: (state: GameState) => { workMode: WorkMode | AcademicStudyMode; actions: ActionId[] };
  validate: (state: GameState, turn: number) => string[]; // return error messages
  finalCheck: (state: GameState) => string[]; // post-game validation
}

function selectFromAvailable(state: GameState, workMode: WorkMode | AcademicStudyMode, priorities: ActionId[]): ActionId[] {
  const effectiveAp = getEffectiveAp(state, workMode);
  const workCost = getWorkModeCost(workMode);
  let remaining = effectiveAp - workCost;
  const available = getAvailableActions(state);
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
  return selected;
}

function getWorkMode(state: GameState, preferred: WorkMode | AcademicStudyMode): WorkMode | AcademicStudyMode {
  const isGrind = preferred === 'grind' || preferred === 'intense';
  if (isGrind && state.grindLockQuarters > 0) {
    return state.phase === 'academic' ? 'normal' : 'normal';
  }
  return preferred;
}

const runs: RunConfig[] = [
  // 1. Glass Cannon: 0 constitution, max school+geo, grind every turn
  {
    name: '1. Glass Cannon Grinder (0/5/5)',
    build: { constitution: 0, schoolRanking: 5, geoLocation: 5 },
    strategy: (s) => ({
      workMode: getWorkMode(s, s.phase === 'academic' ? 'intense' : 'grind'),
      actions: selectFromAvailable(s, getWorkMode(s, s.phase === 'academic' ? 'intense' : 'grind'),
        ['searchIntern', 'internWork', 'prepH1b', 'upskill', 'exercise']),
    }),
    validate: (s) => {
      const errs: string[] = [];
      if (s.attributes.health < 0) errs.push(`Health negative: ${s.attributes.health}`);
      if (s.attributes.mental < 0) errs.push(`Mental negative: ${s.attributes.mental}`);
      return errs;
    },
    finalCheck: (s) => [],
  },
  // 2. Iron Man: max constitution, grind non-stop
  {
    name: '2. Iron Man Perma-Grind (5/3/2)',
    build: { constitution: 5, schoolRanking: 3, geoLocation: 2 },
    strategy: (s) => ({
      workMode: getWorkMode(s, s.phase === 'academic' ? 'intense' : 'grind'),
      actions: selectFromAvailable(s, getWorkMode(s, s.phase === 'academic' ? 'intense' : 'grind'),
        ['searchIntern', 'internWork', 'prepH1b', 'upskill']),
    }),
    validate: (s) => {
      const errs: string[] = [];
      if (isNaN(s.attributes.health)) errs.push('Health NaN');
      return errs;
    },
    finalCheck: (s) => {
      // Iron man should have higher health than glass cannon on average
      return [];
    },
  },
  // 3. Pure Coaster: coast every turn, never work hard
  {
    name: '3. Pure Coaster (3/4/3)',
    build: { constitution: 3, schoolRanking: 4, geoLocation: 3 },
    strategy: (s) => ({
      workMode: s.phase === 'academic' ? 'light' as AcademicStudyMode : 'coast' as WorkMode,
      actions: selectFromAvailable(s, s.phase === 'academic' ? 'light' : 'coast',
        ['searchIntern', 'rest', 'prepH1b', 'exercise', 'networking']),
    }),
    validate: (s) => {
      const errs: string[] = [];
      if (s.attributes.performance > 100) errs.push(`Perf > 100: ${s.attributes.performance}`);
      return errs;
    },
    finalCheck: (s) => {
      const errs: string[] = [];
      // Coaster should have low performance
      if (s.turn > 20 && s.attributes.performance > 30) errs.push(`Coaster perf too high: ${s.attributes.performance}`);
      return errs;
    },
  },
  // 4. PhD Path: choose PhD, focus on research
  {
    name: '4. PhD Researcher (2/5/3)',
    build: { constitution: 2, schoolRanking: 5, geoLocation: 3 },
    strategy: (s) => {
      // Force PhD at turn 8 (handled by not graduating — need to check if PhD is auto)
      const wm = getWorkMode(s, s.phase === 'academic' ? 'normal' : 'normal');
      const priorities: ActionId[] = s.academic.isPhd
        ? ['thesisResearch', 'searchIntern', 'internWork', 'prepH1b', 'researchNiw', 'rest']
        : ['searchIntern', 'internWork', 'studyGpa', 'networking', 'prepH1b', 'rest'];
      return { workMode: wm, actions: selectFromAvailable(s, wm, priorities) };
    },
    validate: (s) => {
      const errs: string[] = [];
      if (s.academic.gpa > 4.01) errs.push(`GPA > 4.0: ${s.academic.gpa}`);
      if (s.academic.gpa < 0) errs.push(`GPA < 0: ${s.academic.gpa}`);
      return errs;
    },
    finalCheck: (s) => [],
  },
  // 5. No Intern Build: geo 0, struggle to find intern
  {
    name: '5. No Geo Struggle (5/5/0)',
    build: { constitution: 5, schoolRanking: 5, geoLocation: 0 },
    strategy: (s) => {
      const wm = getWorkMode(s, 'normal');
      return {
        workMode: wm,
        actions: selectFromAvailable(s, wm, ['searchIntern', 'internWork', 'prepH1b', 'studyGpa', 'upskill', 'rest']),
      };
    },
    validate: (s) => [],
    finalCheck: (s) => [],
  },
  // 6. Health Death Spiral: grind + never rest
  {
    name: '6. Health Death Spiral (0/5/5)',
    build: { constitution: 0, schoolRanking: 5, geoLocation: 5 },
    strategy: (s) => ({
      workMode: getWorkMode(s, s.phase === 'academic' ? 'intense' : 'grind'),
      actions: selectFromAvailable(s, getWorkMode(s, s.phase === 'academic' ? 'intense' : 'grind'),
        ['searchIntern', 'internWork', 'prepH1b', 'upskill', 'prepJobChange']),
    }),
    validate: (s) => {
      const errs: string[] = [];
      if (s.attributes.health < 0) errs.push(`Health < 0: ${s.attributes.health}`);
      if (isNaN(s.economy.cash)) errs.push('Cash NaN');
      return errs;
    },
    finalCheck: (s) => [],
  },
  // 7. Mental Breakdown: never rest, ignore mental
  {
    name: '7. Mental Breakdown (3/4/3)',
    build: { constitution: 3, schoolRanking: 4, geoLocation: 3 },
    strategy: (s) => ({
      workMode: getWorkMode(s, s.phase === 'academic' ? 'intense' : 'grind'),
      actions: selectFromAvailable(s, getWorkMode(s, s.phase === 'academic' ? 'intense' : 'grind'),
        ['searchIntern', 'internWork', 'prepH1b', 'upskill', 'publishPaper', 'prepJobChange']),
    }),
    validate: (s) => {
      const errs: string[] = [];
      if (s.attributes.mental < 0) errs.push(`Mental < 0: ${s.attributes.mental}`);
      return errs;
    },
    finalCheck: (s) => [],
  },
  // 8. Smart Optimal: do everything right
  {
    name: '8. Smart Optimal Play (3/4/3)',
    build: { constitution: 3, schoolRanking: 4, geoLocation: 3 },
    strategy: (s) => {
      const wm = getWorkMode(s, 'normal');
      const priorities: ActionId[] = [];
      if (!s.academic.hadIntern && s.phase === 'academic') priorities.push('searchIntern');
      if (s.flags.internActiveThisQuarter) priorities.push('internWork');
      if (['opt', 'optStem'].includes(s.immigration.visaType) && !s.immigration.h1bFiled) priorities.push('prepH1b');
      if (s.attributes.health < 50) priorities.push('hospital', 'rest');
      if (s.attributes.mental < 40) priorities.push('therapist');
      priorities.push('upskill', 'exercise', 'studyGpa', 'networking');
      return { workMode: wm, actions: selectFromAvailable(s, wm, priorities) };
    },
    validate: (s) => {
      const errs: string[] = [];
      for (const key of ['performance', 'skills', 'academicImpact', 'health', 'mental'] as const) {
        if (s.attributes[key] < 0) errs.push(`${key} < 0: ${s.attributes[key]}`);
        if (key !== 'skills' && s.attributes[key] > 100) errs.push(`${key} > 100: ${s.attributes[key]}`);
        if (isNaN(s.attributes[key])) errs.push(`${key} NaN`);
      }
      return errs;
    },
    finalCheck: (s) => [],
  },
  // 9. Economy Stress: never invest, spend on travel every turn
  {
    name: '9. Big Spender (2/5/3)',
    build: { constitution: 2, schoolRanking: 5, geoLocation: 3 },
    strategy: (s) => {
      const wm = getWorkMode(s, 'normal');
      return {
        workMode: wm,
        actions: selectFromAvailable(s, wm, ['travel', 'searchIntern', 'internWork', 'prepH1b', 'therapist']),
      };
    },
    validate: (s) => {
      const errs: string[] = [];
      if (isNaN(s.economy.cash)) errs.push('Cash NaN');
      if (isNaN(s.attributes.netWorth)) errs.push('NW NaN');
      return errs;
    },
    finalCheck: (s) => [],
  },
  // 10. Max School: permanent +10% modifier stress test
  {
    name: '10. Elite School (0/5/5)',
    build: { constitution: 0, schoolRanking: 5, geoLocation: 5 },
    strategy: (s) => {
      const wm = getWorkMode(s, 'normal');
      return {
        workMode: wm,
        actions: selectFromAvailable(s, wm, ['searchIntern', 'internWork', 'prepH1b', 'upskill', 'rest']),
      };
    },
    validate: (s) => [],
    finalCheck: (s) => [],
  },
  // 11. Zero School: permanent -10% modifier
  {
    name: '11. No-Name School (5/0/5)',
    build: { constitution: 5, schoolRanking: 0, geoLocation: 5 },
    strategy: (s) => {
      const wm = getWorkMode(s, 'normal');
      return {
        workMode: wm,
        actions: selectFromAvailable(s, wm, ['searchIntern', 'internWork', 'prepH1b', 'upskill', 'exercise']),
      };
    },
    validate: (s) => [],
    finalCheck: (s) => [],
  },
  // 12. Rapid job hopper
  {
    name: '12. Job Hopper (3/4/3)',
    build: { constitution: 3, schoolRanking: 4, geoLocation: 3 },
    strategy: (s) => {
      const wm = getWorkMode(s, 'normal');
      const priorities: ActionId[] = [];
      if (!s.academic.hadIntern && s.phase === 'academic') priorities.push('searchIntern');
      if (s.flags.internActiveThisQuarter) priorities.push('internWork');
      if (['opt', 'optStem'].includes(s.immigration.visaType) && !s.immigration.h1bFiled) priorities.push('prepH1b');
      // Always try to job hop
      if (s.phase === 'career' && s.career.employed === 'employed') priorities.push('prepJobChange');
      priorities.push('upskill', 'exercise', 'rest');
      return { workMode: wm, actions: selectFromAvailable(s, wm, priorities) };
    },
    validate: (s) => [],
    finalCheck: (s) => [],
  },
  // 13. NIW/EB1A focus: publish papers constantly
  {
    name: '13. Academic Publisher (2/5/3)',
    build: { constitution: 2, schoolRanking: 5, geoLocation: 3 },
    strategy: (s) => {
      const wm = getWorkMode(s, 'normal');
      const priorities: ActionId[] = [];
      if (!s.academic.hadIntern && s.phase === 'academic') priorities.push('searchIntern');
      if (s.flags.internActiveThisQuarter) priorities.push('internWork');
      if (['opt', 'optStem'].includes(s.immigration.visaType) && !s.immigration.h1bFiled) priorities.push('prepH1b');
      priorities.push('publishPaper', 'researchNiw', 'upskill', 'rest');
      return { workMode: wm, actions: selectFromAvailable(s, wm, priorities) };
    },
    validate: (s) => {
      const errs: string[] = [];
      if (s.attributes.academicImpact > 100) errs.push(`AI > 100: ${s.attributes.academicImpact}`);
      return errs;
    },
    finalCheck: (s) => [],
  },
  // 14. Unemployed survival: what if first job fails
  {
    name: '14. No Job Survival (3/2/2)',
    build: { constitution: 3, schoolRanking: 2, geoLocation: 2 },
    strategy: (s) => {
      const wm = getWorkMode(s, 'normal');
      // Don't search for intern — test the no-intern path
      const priorities: ActionId[] = ['studyGpa', 'prepH1b', 'networking', 'rest', 'upskill'];
      if (s.career.employed === 'unemployed') priorities.unshift('urgentJobSearch');
      return { workMode: wm, actions: selectFromAvailable(s, wm, priorities) };
    },
    validate: (s) => [],
    finalCheck: (s) => [],
  },
  // 15. All random actions
  {
    name: '15. Pure Random (4/3/3)',
    build: { constitution: 4, schoolRanking: 3, geoLocation: 3 },
    strategy: (s) => {
      const modes = s.phase === 'academic'
        ? ['light', 'normal', 'intense'] as AcademicStudyMode[]
        : ['coast', 'normal', 'grind'] as WorkMode[];
      const wm = getWorkMode(s, pick(modes));
      const available = getAvailableActions(s);
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      let rem = getEffectiveAp(s, wm) - getWorkModeCost(wm);
      const sel: ActionId[] = [];
      for (const a of shuffled) {
        if (rem <= 0) break;
        const check = canSelectAction(a, sel, rem);
        if (check.allowed) { sel.push(a.id); rem -= a.apCost; }
      }
      return { workMode: wm, actions: sel };
    },
    validate: (s) => {
      const errs: string[] = [];
      if (isNaN(s.economy.sharePrice)) errs.push('sharePrice NaN');
      if (s.economy.sharePrice <= 0) errs.push(`sharePrice ${s.economy.sharePrice}`);
      return errs;
    },
    finalCheck: (s) => [],
  },
  // 16-20: Repeat pure random with different builds for max coverage
  ...([
    { c: 1, s: 4, g: 5, name: '16' },
    { c: 5, s: 0, g: 5, name: '17' },
    { c: 0, s: 5, g: 5, name: '18' },
    { c: 5, s: 5, g: 0, name: '19' },
    { c: 2, s: 4, g: 4, name: '20' },
  ]).map(b => ({
    name: `${b.name}. Random Extreme (${b.c}/${b.s}/${b.g})`,
    build: { constitution: b.c, schoolRanking: b.s, geoLocation: b.g },
    strategy: (s: GameState) => {
      const modes = s.phase === 'academic'
        ? ['light', 'normal', 'intense'] as AcademicStudyMode[]
        : ['coast', 'normal', 'grind'] as WorkMode[];
      const filtered = modes.filter(m => !((m === 'grind' || m === 'intense') && s.grindLockQuarters > 0));
      const wm = pick(filtered.length > 0 ? filtered : ['normal' as any]);
      const available = getAvailableActions(s);
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      let rem = getEffectiveAp(s, wm) - getWorkModeCost(wm);
      const sel: ActionId[] = [];
      for (const a of shuffled) {
        if (rem <= 0) break;
        const check = canSelectAction(a, sel, rem);
        if (check.allowed) { sel.push(a.id); rem -= a.apCost; }
      }
      return { workMode: wm, actions: sel };
    },
    validate: (s: GameState) => {
      const errs: string[] = [];
      for (const key of ['performance', 'skills', 'academicImpact', 'health', 'mental'] as const) {
        if (s.attributes[key] < 0) errs.push(`${key} < 0: ${s.attributes[key]}`);
        if (key !== 'skills' && s.attributes[key] > 100) errs.push(`${key} > 100: ${s.attributes[key]}`);
        if (isNaN(s.attributes[key])) errs.push(`${key} NaN`);
      }
      if (isNaN(s.economy.cash)) errs.push('cash NaN');
      if (isNaN(s.economy.sharePrice)) errs.push('sharePrice NaN');
      if (s.economy.sharePrice <= 0) errs.push(`sharePrice ${s.economy.sharePrice}`);
      return errs;
    },
    finalCheck: () => [] as string[],
  })),
];

function runGame(config: RunConfig): { errors: string[]; summary: string } {
  let state = createGameState(config.build);
  const errors: string[] = [];

  for (let t = 0; t < 148; t++) {
    let result;
    try {
      result = config.strategy(state);
    } catch (e: any) {
      errors.push(`T${t + 1} strategy crash: ${e.message}`);
      break;
    }

    let prev = state;
    try {
      state = processTurn(state, result.workMode, result.actions);
    } catch (e: any) {
      errors.push(`T${t + 1} processTurn crash: ${e.message}`);
      break;
    }

    const turnErrors = config.validate(state, t + 1);
    errors.push(...turnErrors.map(e => `T${t + 1}: ${e}`));

    if (state.endingType) break;
  }

  const finalErrors = config.finalCheck(state);
  errors.push(...finalErrors.map(e => `FINAL: ${e}`));

  const ti = getTurnInfo(state.turn);
  const summary = `${state.turn}t age=${ti.age} ending=${state.endingType || 'none'} ` +
    `NW=$${Math.round(state.attributes.netWorth)} L${state.career.level} ` +
    `H=${Math.round(state.attributes.health)} M=${Math.round(state.attributes.mental)} ` +
    `visa=${state.immigration.visaType} GC=${state.immigration.hasGreenCard}`;

  return { errors, summary };
}

describe('Extended Simulator: 20 Targeted Runs', () => {
  const allResults: { name: string; errors: string[]; summary: string }[] = [];

  it('all 20 runs complete without errors', () => {
    for (const config of runs) {
      const { errors, summary } = runGame(config);
      allResults.push({ name: config.name, errors, summary });
    }

    console.log('\n=== 20-RUN EXTENDED SIMULATOR ===');
    for (const r of allResults) {
      const status = r.errors.length === 0 ? '✅' : `❌ (${r.errors.length} errors)`;
      console.log(`${status} ${r.name}: ${r.summary}`);
      if (r.errors.length > 0) {
        for (const e of r.errors.slice(0, 5)) {
          console.log(`     ${e}`);
        }
      }
    }

    const totalErrors = allResults.reduce((s, r) => s + r.errors.length, 0);
    console.log(`\nTotal: ${totalErrors} errors across ${runs.length} runs`);

    expect(totalErrors).toBe(0);
  });
});
