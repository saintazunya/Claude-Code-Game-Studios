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
  h1bLottery: { base: 0.12, floor: 0.08, cap: 0.16 }, // 25% base, ±5% annual variance
  h1bLotteryMasters: { base: 0.18, floor: 0.14, cap: 0.22 }, // masters gets +7% base
  permApproval: { base: 0.70, floor: 0.30, cap: 0.90, usesEconCycle: true },
  permAudit: { base: 0.10, floor: 0.05, cap: 0.30, usesEconCycle: true },
  i140Approval: { base: 0.85, attrKey: 'performance', attrWeight: 0.001, floor: 0.50, cap: 0.95 },
  niwApproval: { base: 0.10, attrKey: 'academicImpact', attrWeight: 0.008, floor: 0.02, cap: 0.80 },
  eb1aApproval: { base: 0.05, attrKey: 'academicImpact', attrWeight: 0.009, floor: 0.01, cap: 0.75 },
  sickness: { base: 0, floor: 0, cap: 0.80 }, // custom formula
  burnout: { base: 0, floor: 0, cap: 0.30 }, // custom formula
  internSearch: { base: 0.06, attrKey: 'skills', attrWeight: 0.0015, floor: 0.05, cap: 0.90, usesSchoolMod: true, usesEconCycle: true },
  firstJob: { base: 0.05, attrKey: 'skills', attrWeight: 0.001, floor: 0.02, cap: 0.30, usesSchoolMod: true, usesEconCycle: true },
  jobOffer: { base: 0.20, attrKey: 'skills', attrWeight: 0.003, floor: 0.03, cap: 0.85, usesSchoolMod: true, usesEconCycle: true },
  layoff: { base: 0.05, attrKey: 'performance', attrWeight: 0.002, inverseAttr: true, floor: 0.01, cap: 0.40, usesEconCycle: true },
  i485Noid: { base: 0, floor: 0, cap: 0.80 }, // custom formula
};

// Promotion: skill-threshold based system
// Each level requires a skill threshold. Probability scales with how far above threshold.
// Approximate timelines:
// L3→L4: grind 1yr, coast 2.5yr (threshold ~60)
// L4→L5: grind 2.5yr, coast 5yr (threshold ~150)
// L5→L6: grind 3yr, coast 7yr (threshold ~280)
// L6→L7: grind only, coast nearly impossible (threshold ~450)
const PROMOTION_SKILL_THRESHOLD: Record<number, number> = {
  3: 60,   // L3→L4
  4: 150,  // L4→L5
  5: 280,  // L5→L6
  6: 450,  // L6→L7
  7: 9999, // L7 can't promote
};

const PROMOTION_CAP_BY_LEVEL: Record<number, number> = {
  3: 0.80, 4: 0.65, 5: 0.50, 6: 0.30, 7: 0.0,
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
  firstJob: { boom: 0.15, normal: 0, recession: -0.20, recovery: 0.08 },
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

  // Base — may be overridden by level for promotion or H1B annual variance
  let base = def.base;
  let cap = def.cap;

  // H1B annual variance: ±5% based on year (deterministic per year)
  if (eventType === 'h1bLottery' || eventType === 'h1bLotteryMasters') {
    const year = 2024 + Math.floor(state.turn / 4);
    // Simple hash: same year always gives same variance
    const yearHash = ((year * 2654435761) >>> 0) / 4294967296; // 0-1 deterministic
    const variance = (yearHash - 0.5) * 0.10; // -5% to +5%
    base = Math.max(def.floor, Math.min(def.cap, def.base + variance));
  }

  if (eventType === 'promotion') {
    // Skill-threshold based: probability scales with skills relative to threshold
    const threshold = PROMOTION_SKILL_THRESHOLD[state.career.level] ?? 9999;
    const skillsOverThreshold = state.attributes.skills - threshold;
    // Below threshold: very low base (0-5%), at threshold: ~25%, well above: approaches cap
    if (skillsOverThreshold < 0) {
      // Below threshold: low cap, performance/school can't fully compensate
      base = Math.max(0.02, 0.05 + skillsOverThreshold * 0.0005);
      cap = Math.min(0.15, PROMOTION_CAP_BY_LEVEL[state.career.level] ?? 0.15); // hard cap at 15% when below threshold
    } else {
      // Above threshold: 0.25 + diminishing returns toward level cap
      base = 0.25 + skillsOverThreshold * 0.003;
      cap = PROMOTION_CAP_BY_LEVEL[state.career.level] ?? 0.65;
    }
  }

  // Attribute contribution
  let attrContrib = 0;
  if (def.attrKey && def.attrWeight) {
    const attrVal = overrides[def.attrKey] ?? (state.attributes as Record<string, number>)[def.attrKey] ?? 0;
    attrContrib = def.inverseAttr
      ? -attrVal * def.attrWeight
      : attrVal * def.attrWeight;
  }

  // Promotion: performance still contributes (high performer = better review)
  if (eventType === 'promotion') {
    attrContrib += state.attributes.performance * 0.002; // perf 80 = +16%
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
      situational += 0.10; // intern helps but not game-changing
      if (state.academic.internQuality === 'top') situational += 0.05;
    }
    // No intern = base stays at 8% (very hard)
  }
  if (eventType === 'internSearch') {
    situational += state.geoBonus;
    const gpaBonus = (state.academic.gpa - 3.0) * 0.05; // halved
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
