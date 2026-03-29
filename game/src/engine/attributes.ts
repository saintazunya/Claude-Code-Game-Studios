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
      health: 40 + creation.constitution * 8,
      mental: 70,
      netWorth: 0,
    },
    schoolModifier: (creation.schoolRanking - 2.5) * 0.04,
    geoBonus: (creation.geoLocation - 2.5) * 0.06,
    constitutionSicknessModifier: (2.5 - creation.constitution) * 0.01,
  };
}

export function clampAttribute(key: CoreAttributeKey, value: number): number {
  if (key === 'netWorth') return Math.max(0, value);
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
  const healthDecay =
    -2 +
    (age > 40 ? -1 : 0) +
    (grindActive ? -13 : 0);

  const mentalDecay =
    -3 +
    (visaInsecure ? -3 : 0) +
    (grindActive ? -5 : 0) +
    (state.attributes.health < 30 ? -5 : 0);

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
  const baseChance = (100 - state.attributes.health) * 0.004 * ageFactor;
  return Math.min(0.8, Math.max(0, baseChance + state.constitutionSicknessModifier));
}

export function computeBurnoutChance(mental: number): number {
  if (mental >= 30) return 0;
  return (30 - mental) * 0.01;
}
