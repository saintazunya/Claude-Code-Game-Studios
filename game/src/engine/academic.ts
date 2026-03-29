// Academic Phase — intern search, first job, PhD decision, graduation

import type { GameState, AcademicState, CareerState } from './types';
import { roll } from './probability';
import { generateCompany, computeSalary, rollBossType } from './career';

export function isInternSeason(turn: number): boolean {
  return turn >= 2 && turn <= 7; // turns 3-8 (Q3 year 1 through Q4 year 2)
}

export function processInternSearch(state: GameState): {
  found: boolean;
  quality: 'none' | 'mid' | 'top';
  mentalDelta: number;
} {
  const result = roll('internSearch', state);
  if (result.success) {
    const quality = Math.random() < 0.3 ? 'top' as const : 'mid' as const;
    return { found: true, quality, mentalDelta: 15 };
  }
  return { found: false, quality: 'none', mentalDelta: -5 };
}

export function processFirstJobSearch(state: GameState): {
  found: boolean;
  company: ReturnType<typeof generateCompany> | null;
  level: number;
  salary: number;
  rsu: number;
  mentalDelta: number;
} {
  // Return offer = guaranteed job (skip the roll)
  if (state.academic.hasReturnOffer) {
    const level = state.academic.isPhd ? 4 : 3;
    const company = generateCompany(level);
    const salaryBonus = state.academic.internQuality === 'top' ? 1.15 : 1.05;
    const { salary, rsu } = computeSalary(level, company, 55);
    return { found: true, company, level, salary: Math.round(salary * salaryBonus), rsu, mentalDelta: 25 };
  }

  const result = roll('firstJob', state);
  if (!result.success) {
    return { found: false, company: null, level: 3, salary: 0, rsu: 0, mentalDelta: -15 };
  }

  const level = state.academic.isPhd ? 4 : 3;
  const company = generateCompany(level);

  // Return offer from intern
  let salaryBonus = 1.0;
  if (state.academic.internQuality === 'top') salaryBonus = 1.1;

  const { salary, rsu } = computeSalary(level, company, 50);

  return {
    found: true,
    company,
    level,
    salary: Math.round(salary * salaryBonus),
    rsu,
    mentalDelta: 20,
  };
}

export function canChoosePhd(turn: number): boolean {
  return turn === 8; // End of Master's
}

export function applyPhdChoice(state: GameState): Partial<AcademicState> {
  return {
    isPhd: true,
    thesisPoints: 0,
  };
}

export function graduateMasters(state: GameState): {
  academicUpdates: Partial<AcademicState>;
  studentDebt: number;
} {
  return {
    academicUpdates: {},
    studentDebt: 50000,
  };
}

export function graduatePhd(state: GameState): {
  academicUpdates: Partial<AcademicState>;
  studentDebt: number;
} {
  return {
    academicUpdates: {},
    studentDebt: 20000,
  };
}

export function getGpaGain(studyMode: string): number {
  switch (studyMode) {
    case 'light': return -0.10;
    case 'normal': return 0.15;
    case 'intense': return 0.15; // same GPA as normal — grind benefit is +3 AP, not better grades
    default: return 0.10;
  }
}

export function isGraduationTurn(state: GameState): boolean {
  if (!state.academic.isPhd && state.turn === 8) return true;
  if (state.academic.isPhd && state.turn === 16) return true;
  return false;
}

export function processGraduation(state: GameState): {
  newPhase: 'career';
  careerUpdates: Partial<CareerState>;
  studentDebt: number;
  mentalDelta: number;
  events: string[];
} {
  const isPhd = state.academic.isPhd;
  const events: string[] = [];
  const debt = isPhd ? 20000 : 50000;
  const level = isPhd ? 4 : 3;

  events.push(isPhd ? 'phd_graduated' : 'masters_graduated');

  // Auto-search for first job
  const jobResult = processFirstJobSearch(state);

  if (jobResult.found && jobResult.company) {
    events.push('first_job_found');
    return {
      newPhase: 'career',
      careerUpdates: {
        path: 'sde',
        level,
        company: jobResult.company,
        bossType: rollBossType(),
        tenure: 0,
        onPip: false,
        pipQuartersRemaining: 0,
        coastConsecutive: 0,
        grindConsecutive: 0,
        employed: 'employed',
        salary: jobResult.salary,
        rsu: jobResult.rsu,
      },
      studentDebt: debt,
      mentalDelta: jobResult.mentalDelta,
      events,
    };
  }

  // No job found — enter career phase unemployed (OPT ticking)
  events.push('first_job_search_failed');
  return {
    newPhase: 'career',
    careerUpdates: {
      path: 'sde',
      level,
      company: null,
      bossType: 'neutral',
      tenure: 0,
      onPip: false,
      pipQuartersRemaining: 0,
      coastConsecutive: 0,
      grindConsecutive: 0,
      employed: 'unemployed',
      salary: 0,
      rsu: 0,
    },
    studentDebt: debt,
    mentalDelta: -20,
    events,
  };
}
