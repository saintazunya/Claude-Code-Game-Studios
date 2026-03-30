// Economic Cycle System — Foundation layer
// Manages boom/normal/recession/recovery phases and market simulation

import type { EconomicPhase, GameState } from './types';

interface PhaseConfig {
  minDuration: number;
  maxDuration: number;
  returnMin: number;
  returnMax: number;
  housingMin: number;
  housingMax: number;
  transitions: { phase: EconomicPhase; weight: number }[];
}

// S&P500 model: target 8% annual (~2% quarterly) with ±10% annual variance
// Quarterly returns = annual / 4, with random noise
const PHASE_CONFIG: Record<EconomicPhase, PhaseConfig> = {
  boom: {
    minDuration: 6, maxDuration: 16,
    returnMin: 0.03, returnMax: 0.06, // 12-24% annual
    housingMin: 0.01, housingMax: 0.03,
    transitions: [
      { phase: 'normal', weight: 0.70 },
      { phase: 'recession', weight: 0.30 },
    ],
  },
  normal: {
    minDuration: 4, maxDuration: 12,
    returnMin: 0.01, returnMax: 0.03, // 4-12% annual (centered ~8%)
    housingMin: 0.00, housingMax: 0.015,
    transitions: [
      { phase: 'boom', weight: 0.30 },
      { phase: 'recession', weight: 0.25 },
      { phase: 'normal', weight: 0.45 },
    ],
  },
  recession: {
    minDuration: 3, maxDuration: 8,
    returnMin: -0.08, returnMax: -0.02, // -8% to -32% annual
    housingMin: -0.04, housingMax: -0.01,
    transitions: [
      { phase: 'recovery', weight: 0.80 },
      { phase: 'recession', weight: 0.20 },
    ],
  },
  recovery: {
    minDuration: 4, maxDuration: 8,
    returnMin: 0.02, returnMax: 0.04, // 8-16% annual
    housingMin: 0.005, housingMax: 0.02,
    transitions: [
      { phase: 'normal', weight: 0.60 },
      { phase: 'boom', weight: 0.40 },
    ],
  },
};

const INITIAL_SHARE_PRICE = 10;
const SHARE_PRICE_FLOOR_PCT = 0.30;

function randomUniform(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function weightedRandom<T>(options: { value: T; weight: number }[]): T {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let r = Math.random() * total;
  for (const opt of options) {
    r -= opt.weight;
    if (r <= 0) return opt.value;
  }
  return options[options.length - 1].value;
}

export function rollInitialPhase(): EconomicPhase {
  return weightedRandom([
    { value: 'normal' as EconomicPhase, weight: 0.50 },
    { value: 'boom' as EconomicPhase, weight: 0.30 },
    { value: 'recession' as EconomicPhase, weight: 0.20 },
  ]);
}

export function checkPhaseTransition(
  currentPhase: EconomicPhase,
  quartersInPhase: number
): { transitioned: boolean; newPhase: EconomicPhase } {
  const config = PHASE_CONFIG[currentPhase];

  if (quartersInPhase < config.minDuration) {
    return { transitioned: false, newPhase: currentPhase };
  }

  const baseProb = 0.3;
  const extraProb = Math.max(0, (quartersInPhase - config.minDuration) * 0.05);
  const transitionChance = Math.min(baseProb + extraProb, 0.95);

  if (Math.random() < transitionChance) {
    const newPhase = weightedRandom(
      config.transitions.map((t) => ({ value: t.phase, weight: t.weight }))
    );
    return { transitioned: true, newPhase };
  }

  return { transitioned: false, newPhase: currentPhase };
}

export function rollMarketReturn(phase: EconomicPhase, prevReturn: number = 0): number {
  const config = PHASE_CONFIG[phase];
  const base = randomUniform(config.returnMin, config.returnMax);
  const momentum = prevReturn * 0.1;
  return Math.max(-0.20, Math.min(0.15, base + momentum));
}

export function rollHousingChange(phase: EconomicPhase): number {
  const config = PHASE_CONFIG[phase];
  return randomUniform(config.housingMin, config.housingMax);
}

export function updateSharePrice(currentPrice: number, quarterlyReturn: number): number {
  const newPrice = currentPrice * (1 + quarterlyReturn);
  return Math.max(newPrice, INITIAL_SHARE_PRICE * SHARE_PRICE_FLOOR_PCT);
}

export function buyShares(
  state: GameState,
  amount: number
): { sharesAdded: number; newCash: number } {
  if (amount <= 0 || amount > state.economy.cash) return { sharesAdded: 0, newCash: state.economy.cash };
  const shares = amount / state.economy.sharePrice;
  return {
    sharesAdded: shares,
    newCash: state.economy.cash - amount,
  };
}

export function sellShares(
  state: GameState,
  sharesToSell: number
): { proceeds: number; realizedGain: number } {
  const actual = Math.min(sharesToSell, state.economy.portfolioShares);
  if (actual <= 0) return { proceeds: 0, realizedGain: 0 };
  const proceeds = actual * state.economy.sharePrice;
  const avgCost = state.economy.portfolioShares > 0
    ? state.economy.portfolioCostBasis / state.economy.portfolioShares
    : 0;
  const realizedGain = (state.economy.sharePrice - avgCost) * actual;
  return { proceeds, realizedGain };
}

export function getPortfolioStatus(state: GameState) {
  const currentValue = state.economy.portfolioShares * state.economy.sharePrice;
  const unrealizedPnl = currentValue - state.economy.portfolioCostBasis;
  const unrealizedPnlPercent =
    state.economy.portfolioCostBasis > 0
      ? (unrealizedPnl / state.economy.portfolioCostBasis) * 100
      : 0;
  return { currentValue, unrealizedPnl, unrealizedPnlPercent };
}

export function rollEventCount(): number {
  return weightedRandom([
    { value: 0, weight: 0.30 },
    { value: 1, weight: 0.50 },
    { value: 2, weight: 0.20 },
  ]);
}

export { INITIAL_SHARE_PRICE, PHASE_CONFIG };
