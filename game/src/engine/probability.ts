// Probability Engine — Foundation layer
// Universal resolver for all non-deterministic events

import type { GameState, EconomicPhase } from './types';
import { computeSicknessChance, computeBurnoutChance } from './attributes';

export interface EventTypeDef {
  base: number;
  attrKey?: string;
  attrWeight?: number;
  inverseAttr?: boolean; // higher attr = lower probability
  floor: number;
  cap: number;
  usesSchoolMod?: boolean;
  usesEconCycle?: boolean;
}

export interface RollResult {
  success: boolean;
  probability: number;
  rollValue: number;
}

export interface ProbabilityBreakdown {
  base: number;
  attributeContribution: number;
  schoolModifier: number;
  econModifier: number;
  situational: number;
  final: number;
}

// Event type definitions from Probability Engine GDD
const EVENT_TYPES: Record<string, EventTypeDef> = {
  promotion: { base: 0.15, attrKey: 'performance', attrWeight: 0.004, floor: 0.02, cap: 0.85, usesSchoolMod: true, usesEconCycle: true },
  pip: { base: 0.05, attrKey: 'performance', attrWeight: 0.003, inverseAttr: true, floor: 0.01, cap: 0.60, usesEconCycle: true },
  h1bLottery: { base: 0.27, floor: 0.27, cap: 0.27 }, // pure lottery
  h1bLotteryMasters: { base: 0.35, floor: 0.35, cap: 0.35 },
  permApproval: { base: 0.70, floor: 0.30, cap: 0.90, usesEconCycle: true },
  permAudit: { base: 0.10, floor: 0.05, cap: 0.30, usesEconCycle: true },
  i140Approval: { base: 0.85, attrKey: 'performance', attrWeight: 0.001, floor: 0.50, cap: 0.95 },
  niwApproval: { base: 0.10, attrKey: 'academicImpact', attrWeight: 0.008, floor: 0.02, cap: 0.80 },
  eb1aApproval: { base: 0.05, attrKey: 'academicImpact', attrWeight: 0.009, floor: 0.01, cap: 0.75 },
  sickness: { base: 0, floor: 0, cap: 0.80 }, // custom formula
  burnout: { base: 0, floor: 0, cap: 0.30 }, // custom formula
  internSearch: { base: 0.30, attrKey: 'skills', attrWeight: 0.003, floor: 0.05, cap: 0.90, usesSchoolMod: true, usesEconCycle: true },
  firstJob: { base: 0.40, attrKey: 'skills', attrWeight: 0.003, floor: 0.05, cap: 0.90, usesSchoolMod: true, usesEconCycle: true },
  jobOffer: { base: 0.20, attrKey: 'skills', attrWeight: 0.003, floor: 0.03, cap: 0.85, usesSchoolMod: true, usesEconCycle: true },
  layoff: { base: 0.05, attrKey: 'performance', attrWeight: 0.002, inverseAttr: true, floor: 0.01, cap: 0.40, usesEconCycle: true },
  i485Noid: { base: 0, floor: 0, cap: 0.80 }, // custom formula
};

// Promotion base rates by level
const PROMOTION_BASE_BY_LEVEL: Record<number, number> = {
  3: 0.30, 4: 0.22, 5: 0.15, 6: 0.08, 7: 0.03,
};

const PROMOTION_CAP_BY_LEVEL: Record<number, number> = {
  3: 0.85, 4: 0.75, 5: 0.55, 6: 0.30, 7: 0.0, // L7 can't promote
};

// Economic cycle modifiers per event type
const ECON_MODIFIERS: Record<string, Record<EconomicPhase, number>> = {
  promotion: { boom: 0.05, normal: 0, recession: -0.10, recovery: 0 },
  pip: { boom: -0.03, normal: 0, recession: 0.10, recovery: 0.03 },
  jobOffer: { boom: 0.10, normal: 0, recession: -0.15, recovery: 0.05 },
  layoff: { boom: -0.03, normal: 0, recession: 0.10, recovery: 0 },
  permApproval: { boom: 0.05, normal: 0, recession: -0.20, recovery: -0.05 },
  permAudit: { boom: -0.03, normal: 0, recession: 0.15, recovery: 0.05 },
  internSearch: { boom: 0.10, normal: 0, recession: -0.10, recovery: 0.05 },
  firstJob: { boom: 0.10, normal: 0, recession: -0.15, recovery: 0.05 },
};

export function getEventBreakdown(
  eventType: string,
  state: GameState,
  overrides: Record<string, number> = {}
): ProbabilityBreakdown {
  // Handle custom formulas
  if (eventType === 'sickness') {
    const p = computeSicknessChance(state);
    return { base: p, attributeContribution: 0, schoolModifier: 0, econModifier: 0, situational: 0, final: p };
  }
  if (eventType === 'burnout') {
    const p = computeBurnoutChance(state.attributes.mental);
    return { base: p, attributeContribution: 0, schoolModifier: 0, econModifier: 0, situational: 0, final: p };
  }
  if (eventType === 'i485Noid') {
    const uq = state.immigration.unemploymentQuarters;
    const p = uq >= 2 ? Math.min(0.8, 0.15 + (uq - 1) * 0.12) : 0;
    return { base: p, attributeContribution: 0, schoolModifier: 0, econModifier: 0, situational: 0, final: p };
  }

  const def = EVENT_TYPES[eventType];
  if (!def) return { base: 0, attributeContribution: 0, schoolModifier: 0, econModifier: 0, situational: 0, final: 0 };

  // Base — may be overridden by level for promotion
  let base = def.base;
  let cap = def.cap;
  if (eventType === 'promotion') {
    base = PROMOTION_BASE_BY_LEVEL[state.career.level] ?? 0.15;
    cap = PROMOTION_CAP_BY_LEVEL[state.career.level] ?? 0.85;
  }

  // Attribute contribution
  let attrContrib = 0;
  if (def.attrKey && def.attrWeight) {
    const attrVal = overrides[def.attrKey] ?? (state.attributes as Record<string, number>)[def.attrKey] ?? 0;
    attrContrib = def.inverseAttr
      ? -attrVal * def.attrWeight
      : attrVal * def.attrWeight;
  }

  // Skills secondary contribution for promotion
  if (eventType === 'promotion') {
    attrContrib += (state.attributes.skills) * 0.001;
  }

  // School modifier
  const schoolMod = def.usesSchoolMod ? state.schoolModifier : 0;

  // Economic cycle modifier
  const econMod = def.usesEconCycle
    ? (ECON_MODIFIERS[eventType]?.[state.economicPhase] ?? 0)
    : 0;

  // Situational modifiers
  let situational = 0;
  if (eventType === 'promotion' && state.career.company) {
    situational += state.career.company.promotionModifier;
    // Boss modifier
    if (state.career.bossType === 'supportive') situational += 0.05;
    if (state.career.bossType === 'toxic') situational -= 0.05;
  }
  if (eventType === 'pip') {
    situational += state.career.coastConsecutive * 0.08;
    if (state.career.company) situational += state.career.company.pipRateModifier;
  }
  if (eventType === 'layoff' && state.career.company) {
    situational += state.career.company.layoffModifier;
    situational -= Math.min(state.career.level - 3, 2) * 0.01;
  }
  if (eventType === 'jobOffer') {
    situational += Math.min(state.jobSearchQuarters * 0.10, 0.30);
  }
  if (eventType === 'firstJob') {
    if (state.academic.hadIntern) {
      situational += 0.25;
      if (state.academic.internQuality === 'top') situational += 0.15;
    } else {
      base = 0.15; // No intern penalty
    }
  }
  if (eventType === 'internSearch') {
    situational += state.geoBonus;
    const gpaBonus = (state.academic.gpa - 3.0) * 0.10;
    situational += gpaBonus;
  }

  const raw = base + attrContrib + schoolMod + econMod + situational;
  const final = Math.max(def.floor, Math.min(cap, raw));

  return {
    base,
    attributeContribution: attrContrib,
    schoolModifier: schoolMod,
    econModifier: econMod,
    situational,
    final,
  };
}

export function preview(eventType: string, state: GameState): number {
  return getEventBreakdown(eventType, state).final;
}

export function roll(eventType: string, state: GameState): RollResult {
  const probability = preview(eventType, state);
  const rollValue = Math.random();
  return {
    success: rollValue < probability,
    probability,
    rollValue,
  };
}
