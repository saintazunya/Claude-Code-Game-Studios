// Game Logger — records all player decisions and game state for replay/analysis

import type { GameState, WorkMode, AcademicStudyMode, ActionId, CreationAttributes } from './types';
import { getTurnInfo } from './game-state';

export interface TurnLog {
  turn: number;
  year: number;
  quarter: number;
  age: number;
  phase: string;
  workMode: WorkMode | AcademicStudyMode;
  actionsSelected: ActionId[];
  attributesBefore: Record<string, number>;
  attributesAfter: Record<string, number>;
  attributeDeltas: Record<string, number>;
  economySnapshot: {
    cash: number;
    portfolioValue: number;
    homeEquity: number;
    netWorth: number;
    studentLoan: number;
  };
  careerSnapshot: {
    employed: string;
    level: number;
    company: string | null;
    bossType: string;
    salary: number;
    onPip: boolean;
  };
  immigrationSnapshot: {
    visaType: string;
    visaExpiryTurns: number;
    permStatus: string;
    i140Status: string;
    i485Status: string;
    hasComboCard: boolean;
    hasGreenCard: boolean;
  };
  economicPhase: string;
  events: { id: string; choiceId: string }[];
  gpa?: number;
  hadIntern?: boolean;
}

export interface GameLog {
  startTime: string;
  creation: CreationAttributes;
  schoolModifier: number;
  geoBonus: number;
  turns: TurnLog[];
  endingType: string | null;
  finalScore: number | null;
}

let currentLog: GameLog | null = null;

export function startLog(creation: CreationAttributes, schoolMod: number, geoBonus: number) {
  currentLog = {
    startTime: new Date().toISOString(),
    creation,
    schoolModifier: schoolMod,
    geoBonus,
    turns: [],
    endingType: null,
    finalScore: null,
  };
  console.log('[GameLog] New game started', creation);
}

export function logTurn(
  stateBefore: GameState,
  stateAfter: GameState,
  workMode: WorkMode | AcademicStudyMode,
  actions: ActionId[]
) {
  if (!currentLog) return;

  const ti = getTurnInfo(stateAfter.turn);
  const before = stateBefore.attributes;
  const after = stateAfter.attributes;

  const deltas: Record<string, number> = {};
  for (const key of Object.keys(after) as Array<keyof typeof after>) {
    const d = Math.round((after[key] as number) - (before[key] as number));
    if (d !== 0) deltas[key] = d;
  }

  const portfolioValue = stateAfter.economy.portfolioShares * stateAfter.economy.sharePrice;
  const homeEquity = stateAfter.economy.ownsHome
    ? Math.max(0, stateAfter.economy.homeValue - stateAfter.economy.homeMortgageRemaining)
    : 0;

  const lastRecord = stateAfter.timeline[stateAfter.timeline.length - 1];

  const turnLog: TurnLog = {
    turn: stateAfter.turn,
    year: ti.year,
    quarter: ti.quarter,
    age: ti.age,
    phase: stateAfter.phase,
    workMode,
    actionsSelected: actions,
    attributesBefore: { ...before },
    attributesAfter: { ...after },
    attributeDeltas: deltas,
    economySnapshot: {
      cash: Math.round(stateAfter.economy.cash),
      portfolioValue: Math.round(portfolioValue),
      homeEquity: Math.round(homeEquity),
      netWorth: Math.round(stateAfter.attributes.netWorth),
      studentLoan: Math.round(stateAfter.economy.studentLoanRemaining),
    },
    careerSnapshot: {
      employed: stateAfter.career.employed,
      level: stateAfter.career.level,
      company: stateAfter.career.company?.name || null,
      bossType: stateAfter.career.bossType,
      salary: stateAfter.career.salary,
      onPip: stateAfter.career.onPip,
    },
    immigrationSnapshot: {
      visaType: stateAfter.immigration.visaType,
      visaExpiryTurns: stateAfter.immigration.visaExpiryTurn - stateAfter.turn,
      permStatus: stateAfter.immigration.permStatus,
      i140Status: stateAfter.immigration.i140Status,
      i485Status: stateAfter.immigration.i485Status,
      hasComboCard: stateAfter.immigration.hasComboCard,
      hasGreenCard: stateAfter.immigration.hasGreenCard,
    },
    economicPhase: stateAfter.economicPhase,
    events: lastRecord?.events || [],
  };

  if (stateAfter.phase === 'academic') {
    turnLog.gpa = stateAfter.academic.gpa;
    turnLog.hadIntern = stateAfter.academic.hadIntern;
  }

  currentLog.turns.push(turnLog);

  // Console log for real-time monitoring
  const eventSummary = turnLog.events.length > 0
    ? ` | Events: ${turnLog.events.map(e => e.id).join(', ')}`
    : '';
  const deltaSummary = Object.entries(deltas).map(([k, v]) => `${k}:${v > 0 ? '+' : ''}${v}`).join(' ');
  console.log(`[Turn ${turnLog.turn}] ${ti.year} Q${ti.quarter} Age ${ti.age} | ${workMode} | ${deltaSummary}${eventSummary}`);
}

export function logEventChoice(eventId: string, choiceId: string) {
  console.log(`[Event] ${eventId} → chose: ${choiceId}`);
}

export function endLog(endingType: string, finalScore: number) {
  if (!currentLog) return;
  currentLog.endingType = endingType;
  currentLog.finalScore = finalScore;
  console.log(`[GameLog] Game ended: ${endingType}, score: ${finalScore}`);
}

export function getLog(): GameLog | null {
  return currentLog;
}

export function exportLog(): string {
  if (!currentLog) return '{}';
  return JSON.stringify(currentLog, null, 2);
}

export function downloadLog() {
  const data = exportLog();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `greencard-odyssey-${currentLog?.startTime?.replace(/[:.]/g, '-') || 'game'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
