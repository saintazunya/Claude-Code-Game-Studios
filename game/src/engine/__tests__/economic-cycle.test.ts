import { describe, it, expect } from 'vitest';
import {
  checkPhaseTransition,
  rollMarketReturn,
  updateSharePrice,
  buyShares,
  sellShares,
  getPortfolioStatus,
  INITIAL_SHARE_PRICE,
} from '../economic-cycle';
import { createGameState } from '../game-state';

describe('Economic Cycle System', () => {
  describe('phase transition', () => {
    it('cannot transition before min duration', () => {
      const { transitioned } = checkPhaseTransition('recession', 1);
      expect(transitioned).toBe(false);
    });

    it('can transition after min duration', () => {
      // Run many times to ensure at least one transition
      let transitioned = false;
      for (let i = 0; i < 100; i++) {
        const result = checkPhaseTransition('recession', 5);
        if (result.transitioned) { transitioned = true; break; }
      }
      expect(transitioned).toBe(true);
    });
  });

  describe('market returns', () => {
    it('boom returns are positive', () => {
      const returns: number[] = [];
      for (let i = 0; i < 100; i++) {
        returns.push(rollMarketReturn('boom'));
      }
      const avg = returns.reduce((a, b) => a + b) / returns.length;
      expect(avg).toBeGreaterThan(0);
    });

    it('recession returns are negative', () => {
      const returns: number[] = [];
      for (let i = 0; i < 100; i++) {
        returns.push(rollMarketReturn('recession'));
      }
      const avg = returns.reduce((a, b) => a + b) / returns.length;
      expect(avg).toBeLessThan(0);
    });

    it('returns are clamped to [-20%, +15%]', () => {
      for (let i = 0; i < 200; i++) {
        const r = rollMarketReturn('boom', 0.15);
        expect(r).toBeLessThanOrEqual(0.15);
        expect(r).toBeGreaterThanOrEqual(-0.20);
      }
    });
  });

  describe('share price', () => {
    it('updates with quarterly return', () => {
      const newPrice = updateSharePrice(100, 0.05);
      expect(newPrice).toBeCloseTo(105, 1);
    });

    it('has floor at 30% of initial', () => {
      const newPrice = updateSharePrice(35, -0.50);
      expect(newPrice).toBe(INITIAL_SHARE_PRICE * 0.30);
    });
  });

  describe('portfolio operations', () => {
    it('buy shares correctly', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.economy.cash = 10000;
      state.economy.sharePrice = 100;

      const { sharesAdded, newCash } = buyShares(state, 5000);
      expect(sharesAdded).toBe(50);
      expect(newCash).toBe(5000);
    });

    it('cannot buy more than cash on hand', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.economy.cash = 1000;
      const { sharesAdded } = buyShares(state, 5000);
      expect(sharesAdded).toBe(0);
    });

    it('sell shares calculates realized gain', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.economy.portfolioShares = 100;
      state.economy.portfolioCostBasis = 10000; // avg $100/share
      state.economy.sharePrice = 120; // current $120

      const { proceeds, realizedGain } = sellShares(state, 50);
      expect(proceeds).toBe(6000); // 50 * $120
      expect(realizedGain).toBe(1000); // 50 * ($120 - $100)
    });

    it('sell all shares', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.economy.portfolioShares = 100;
      state.economy.portfolioCostBasis = 10000;
      state.economy.sharePrice = 80; // at a loss

      const { proceeds, realizedGain } = sellShares(state, 100);
      expect(proceeds).toBe(8000);
      expect(realizedGain).toBe(-2000); // loss
    });

    it('portfolio status shows unrealized P&L', () => {
      const state = createGameState({ constitution: 3, schoolRanking: 3, geoLocation: 4 });
      state.economy.portfolioShares = 100;
      state.economy.portfolioCostBasis = 10000;
      state.economy.sharePrice = 80;

      const status = getPortfolioStatus(state);
      expect(status.currentValue).toBe(8000);
      expect(status.unrealizedPnl).toBe(-2000);
      expect(status.unrealizedPnlPercent).toBeCloseTo(-20, 0);
    });
  });
});
