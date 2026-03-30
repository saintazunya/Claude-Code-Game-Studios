// Attribute System — Foundation layer
// Manages 6 core attributes + creation-derived permanent modifiers

import type { CoreAttributes, CoreAttributeKey, CreationAttributes, ThresholdState, GameState } from './types';

const ATTR_MIN = 0;
const ATTR_MAX = 100;

export function createStartingAttributes(creation: CreationAttributes): {
  attributes: CoreAttributes;
  schoolModifier: number;
  geoBonus: number;
  constitutionSicknessModifier: number;
} {
  return {
    attributes: {
      performance: 0,
      skills: 20 + creation.schoolRanking * 4,
      academicImpact: creation.schoolRanking * 2,
      health: 90,
      mental: 70,
      netWorth: 0,
    },
    // School 0=-5%, 1=-1%, 2=+3%, 3=+7%, 4=+11%, 5=+15%
    schoolModifier: -0.05 + creation.schoolRanking * 0.04,
    // Geo 0=-10%, 1=-4%, 2=+2%, 3=+8%, 4=+14%, 5=+20%
    geoBonus: -0.10 + creation.geoLocation * 0.06,
    constitutionSicknessModifier: (2.5 - creation.constitution) * 0.01,
  };
}

export function clampAttribute(key: CoreAttributeKey, value: number): number {
  if (key === 'netWorth') return Math.max(0, value);
  if (key === 'skills') return Math.max(0, value); // skills uncapped — grows with career
  return Math.max(ATTR_MIN, Math.min(ATTR_MAX, value));
}

export function modifyAttribute(
  attrs: CoreAttributes,
  key: CoreAttributeKey,
  delta: number
): CoreAttributes {
  const newValue = clampAttribute(key, attrs[key] + delta);
  return { ...attrs, [key]: newValue };
}

export function applyDeltas(
  attrs: CoreAttributes,
  deltas: Partial<CoreAttributes>
): CoreAttributes {
  let result = { ...attrs };
  for (const [key, delta] of Object.entries(deltas)) {
    if (delta !== undefined) {
      result = modifyAttribute(result, key as CoreAttributeKey, delta);
    }
  }
  return result;
}

export function getHealthThreshold(health: number): ThresholdState {
  if (health <= 0) return 'hospitalized';
  if (health < 30) return 'critical';
  if (health < 70) return 'subhealthy';
  return 'healthy';
}

export function getMentalThreshold(mental: number): ThresholdState {
  if (mental < 10) return 'burnout';
  if (mental < 30) return 'atRisk';
  if (mental < 60) return 'stressed';
  return 'stable';
}

export function getPerformanceGainMultiplier(state: GameState): number {
  let mult = 1.0;
  if (state.attributes.mental < 30) mult *= 0.5;
  else if (state.attributes.mental < 60) mult *= 0.75;
  if (state.attributes.health < 20) mult *= 0.5;
  return mult;
}

export function computeNaturalDecay(state: GameState): Partial<CoreAttributes> {
  const age = 22 + Math.floor((state.turn - 1) / 4);
  const grindActive = state.career.grindConsecutive > 0 && state.turn > 0;
  const visaInsecure =
    !state.immigration.hasGreenCard && !state.immigration.hasComboCard;

  // Performance decays only if no work AP was spent (handled by caller)
  // Constitution reduces grind health cost: 0 = full penalty, 5 = 50% reduced
  const grindReduction = state.creation.constitution * 0.1; // 0% to 50% reduction
  const grindHealthPenalty = grindActive ? Math.round(-13 * (1 - grindReduction)) : 0;

  const healthDecay =
    -2 +
    (age > 40 ? -1 : 0) +
    grindHealthPenalty;

  // Mental decay: capped so single-turn total (decay + mode + actions) doesn't spiral
  // Visa stress reduced: -2 instead of -4 (was causing 40→0 in one turn)
  const mentalDecay =
    -3 +
    (visaInsecure ? -2 : 0) +
    (grindActive ? -4 : 0) +
    (state.attributes.health < 30 ? -3 : 0);

  // Boss effects
  const boss = state.career.bossType;
  const bossMentalDelta =
    boss === 'toxic' ? -5 : boss === 'demanding' ? -3 : boss === 'supportive' ? 2 : 0;

  return {
    skills: -1,
    health: healthDecay,
    mental: mentalDecay + bossMentalDelta,
  };
}

export function computeSicknessChance(state: GameState): number {
  const age = 22 + Math.floor((state.turn - 1) / 4);
  const ageFactor = 1.0 + Math.max(0, (age - 30) * 0.03);
  const baseChance = (100 - state.attributes.health) * 0.002 * ageFactor; // halved from 0.004
  return Math.min(0.8, Math.max(0, baseChance + state.constitutionSicknessModifier));
}

export function computeBurnoutChance(mental: number): number {
  if (mental >= 30) return 0;
  return (30 - mental) * 0.005; // halved: was 0.01
}
