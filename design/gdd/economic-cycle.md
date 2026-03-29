# Economic Cycle System

> **Status**: In Design
> **Author**: user + game-designer
> **Last Updated**: 2026-03-28
> **Implements Pillar**: Pillar 1 (Authenticity First), Pillar 4 (Emergent Stories)

## Overview

The Economic Cycle System models macroeconomic conditions as a global state machine that affects every major gameplay system simultaneously. The economy transitions between Boom, Normal, Recession, and Recovery phases on a semi-random schedule, influencing job market conditions, layoff rates, PERM processing, investment returns, and housing prices. Players cannot control or predict exact cycle transitions — they can only observe the current state and adapt. This creates the authentic experience of "the world doesn't wait for you" and generates emergent narratives like "I graduated right into a recession" or "the bull market saved my retirement."

Critically, the stock market within the cycle is not just a passive number — players can buy AND sell their S&P 500 positions. This creates a behavioral trap: panic selling during a downturn locks in losses, while holding through recovers. The system rewards patience and punishes emotional reactions, mirroring real investor psychology.

## Player Fantasy

The player should feel like they are **navigating forces beyond their control**. The economy is the weather — you can't change it, but you can dress for it. A skilled player reads the cycle and adapts: holds investments during a recession, delays job hopping until recovery, accelerates PERM during boom times. A panicked player sells stocks at the bottom, tries to jump ship during a downturn when nobody is hiring, and watches their green card timeline collapse.

Pillar 1 (Authenticity): Economic cycles mirror real history — the 2008 crash, 2020 COVID recession, 2022 tech layoffs. Players who lived through these will recognize the patterns.
Pillar 4 (Emergent Stories): The cycle is the single largest source of run variance. Two identical builds can have completely different outcomes based on when recessions hit.

## Detailed Design

### Core Rules

#### Cycle Phases

Four distinct economic phases, each with defined effects:

| Phase | Duration (quarters) | Description | Transition To |
|-------|-------------------|-------------|---------------|
| **Boom** | 6-16 | Strong economy, bull market, hiring sprees, low layoff risk | Normal (70%), Recession (30%) |
| **Normal** | 4-12 | Baseline conditions, moderate growth, stable employment | Boom (30%), Recession (25%), stays Normal (45%) |
| **Recession** | 3-8 | Bear market, mass layoffs, hiring freezes, PERM delays | Recovery (80%), deeper Recession (20%) |
| **Recovery** | 4-8 | Market rebounding, cautious hiring resumes, backlog clearing | Normal (60%), Boom (40%) |

#### Phase Transition Rules

Transitions are checked once per quarter at the start of each turn (Turn Manager Phase 1):

```
1. Increment quarters_in_current_phase
2. If quarters_in_current_phase < phase.min_duration: no transition possible
3. If quarters_in_current_phase >= phase.min_duration:
   - Roll for transition using phase.transition_probabilities
   - Transition probability increases by +5% per quarter beyond min_duration
     (prevents excessively long phases)
4. On transition: set new phase, reset quarters_in_current_phase
```

The player sees the current phase but NOT the transition probability or timing. They know a recession won't end instantly (minimum 3 quarters), but they don't know exactly when recovery begins.

#### Effects on Other Systems

| System | Boom | Normal | Recession | Recovery |
|--------|------|--------|-----------|----------|
| **Probability Engine** | See modifiers table in Probability Engine GDD | Baseline | See modifiers | See modifiers |
| **S&P 500 Returns** | +3% to +8% per quarter | +1% to +3% per quarter | -5% to -15% per quarter | +2% to +6% per quarter |
| **Housing Prices** | +2% to +5% per quarter | +0% to +2% per quarter | -3% to -8% per quarter | +1% to +3% per quarter |
| **Salary Offers** | +10% above band midpoint | Band midpoint | -5% below midpoint, fewer offers | Band midpoint |
| **Layoff Base Rate** | 2% per quarter | 5% per quarter | 15% per quarter | 5% per quarter |
| **PERM Processing** | Faster (base -1 quarter) | Normal | Slower (+2 quarters), audit +15% | Slow (+1 quarter), backlog clearing |
| **Job Market** | Abundant openings, multiple offers | Normal flow | Hiring freezes, very few openings | Cautious hiring, openings returning |

#### Stock Market Model

The S&P 500 is modeled as a portfolio the player can **buy into and sell out of** each quarter. This is NOT a passive auto-invest-and-forget system — it requires active management (though auto-invest is available as a convenience setting).

**Portfolio State:**
```
portfolio = {
    shares: int,              // number of "units" owned (abstract, not real shares)
    cost_basis: float,        // total $ invested (for gain/loss calculation)
    current_value: float      // shares × current_price_per_share
}
```

**Each Quarter:**
```
1. Market return for this quarter is determined:
   quarterly_return = random_in_range(phase.return_min, phase.return_max)

2. Current share price updates:
   share_price = share_price × (1 + quarterly_return)

3. Portfolio value updates:
   portfolio.current_value = portfolio.shares × share_price

4. Player actions (no AP cost):
   - BUY: spend $X from cash → receive X/share_price shares
   - SELL: sell N shares → receive N × share_price to cash
   - AUTO-INVEST: toggle on/off, auto-buys $X/quarter from salary
   - HOLD: do nothing
```

**Gain/Loss Tracking:**
```
unrealized_gain = portfolio.current_value - portfolio.cost_basis
realized_gain += (sell_price - avg_cost_basis_per_share) × shares_sold
```

**The Behavioral Trap:**
- During a recession, portfolio shows **red numbers** (unrealized loss of 20-40%)
- Player's instinct: SELL to "stop the bleeding"
- Reality: selling locks in the loss. Holding through recovery recovers value.
- The game displays unrealized P&L prominently — this is intentional psychological pressure
- Players who panic sell and then watch the recovery will learn the lesson for next run (Pillar 5)

**Auto-Invest:**
- Can be toggled on/off at any time (no AP cost)
- When on: automatically buys $X/quarter from salary (player sets amount)
- Dollar-cost averaging naturally buys more shares when prices are low
- The "correct" strategy is usually to auto-invest and never look at it — but the UI makes it very hard to ignore the red numbers

#### Housing Market

Housing prices fluctuate with the economic cycle:

```
home_value = purchase_price × cumulative_price_change_since_purchase
```

During recession: home value drops, player may be "underwater" (owe more than house is worth). This doesn't cause game over but:
- Can't sell without taking a loss
- If forced to relocate (job change to different city), must sell at current market value
- Emotional stress: Mental -5 for each quarter underwater

During boom: home value rises, building equity. Can sell for profit, or take home equity loan (future feature).

### States and Transitions

```
         ┌──────────┐
    ┌───→│   BOOM   │───┐
    │    └──────────┘   │
    │     70% ↓  30% ↓  │
    │    ┌──────────┐   │
    │    │  NORMAL  │←──┘
    │    └──────────┘
    │   30%↑  45%↺  25%↓
    │    ┌──────────┐
    └────│ RECOVERY │
    40%  └──────────┘
    ↑     60%↑
    │    ┌──────────┐
    └────│RECESSION │
    80%  └──────────┘
          20%↺ (deeper)
```

Each phase has minimum/maximum durations to prevent extreme oscillation:
- Boom: 6-16 quarters (1.5-4 years)
- Normal: 4-12 quarters (1-3 years)
- Recession: 3-8 quarters (9 months - 2 years)
- Recovery: 4-8 quarters (1-2 years)

A full cycle (Boom→Normal→Recession→Recovery→Boom) averages ~24-32 quarters (6-8 years), close to real-world business cycles.

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Turn Manager** | TM → Cycle | Signals quarter start; Cycle checks for phase transition |
| **Probability Engine** | Cycle → Probability | `get_cycle_modifier(event_type)` returns per-event modifier for current phase |
| **Economy System** | Cycle → Economy | `get_market_return()` returns this quarter's S&P return; `get_housing_change()` returns housing price delta |
| **Career System** | Cycle → Career | `get_salary_modifier()` affects new job offers; layoff base rate |
| **Immigration System** | Cycle → Immigration | `get_perm_modifier()` affects PERM processing time and audit probability |
| **Event System** | Cycle → Events | Phase determines which events are in the active pool (recession-only events, boom-only events) |
| **UI Systems** | Cycle → UI | Current phase displayed as market indicator; portfolio P&L display |
| **Game Data** | Data → Cycle | Phase definitions, duration ranges, transition probabilities, return ranges |

## Formulas

### Phase Transition Probability

```
transition_chance = base_transition_prob + max(0, (quarters_in_phase - min_duration) × 0.05)
transition_chance = min(transition_chance, 0.95)  // cap to prevent certainty

roll = random(0, 1)
if roll < transition_chance:
    next_phase = weighted_random(phase.transitions)
```

### S&P 500 Quarterly Return

```
base_return = random_uniform(phase.return_min, phase.return_max)
// Add slight momentum: if previous quarter was also same direction, amplify slightly
momentum = previous_quarter_return × 0.1
quarterly_return = base_return + momentum
// Clamp extreme values
quarterly_return = clamp(quarterly_return, -0.20, +0.15)  // max -20%, +15% per quarter
```

### Share Price Evolution

```
share_price_new = share_price_old × (1 + quarterly_return)
// Share price has a floor (market never goes to literally 0)
share_price_new = max(share_price_new, initial_share_price × 0.3)  // floor at 30% of starting price
```

### Portfolio Calculations

```
// Buying
shares_purchased = investment_amount / current_share_price
new_shares = portfolio.shares + shares_purchased
new_cost_basis = portfolio.cost_basis + investment_amount

// Selling
proceeds = shares_to_sell × current_share_price
avg_cost_per_share = portfolio.cost_basis / portfolio.shares
realized_gain = (current_share_price - avg_cost_per_share) × shares_to_sell
new_shares = portfolio.shares - shares_to_sell
new_cost_basis = portfolio.cost_basis × (new_shares / portfolio.shares)  // proportional

// Unrealized P&L
unrealized_pnl = (portfolio.shares × current_share_price) - portfolio.cost_basis
unrealized_pnl_percent = unrealized_pnl / portfolio.cost_basis × 100
```

### Housing Price Model

```
quarterly_housing_change = random_uniform(phase.housing_min, phase.housing_max)
cumulative_housing_multiplier *= (1 + quarterly_housing_change)
current_home_value = purchase_price × cumulative_housing_multiplier

// Underwater check
is_underwater = current_home_value < remaining_mortgage
```

### Long-Term Market Behavior

Over 37 years (148 quarters) with realistic cycle durations, the market should average ~7-8% annual return — matching real S&P 500 historical average. This emerges naturally from the phase return ranges:

```
Expected annual return ≈ (boom_avg × boom_pct) + (normal_avg × normal_pct) + (recession_avg × recession_pct) + (recovery_avg × recovery_pct)
≈ (5.5% × 0.35) + (2% × 0.25) + (-10% × 0.15) + (4% × 0.25)
≈ 1.925% + 0.5% + (-1.5%) + 1.0%
≈ 1.925% per quarter ≈ 7.9% annually
```

Players who hold through all cycles will see ~7-8% annual growth. Players who panic sell during recessions and buy back during booms will underperform.

## Edge Cases

### 1. Player sells entire portfolio at market bottom
Allowed — this is the core behavioral trap. Portfolio goes to 0 shares, realized loss is locked in. The cash sits earning nothing while the market recovers. Next run, the player will (hopefully) learn to hold. No safety net, no "are you sure?" confirmation beyond standard UI.

### 2. Recession lasts maximum 8 quarters (2 years)
Even the worst recession ends. The forced minimum/maximum duration prevents both unrealistically short and unrealistically long recessions. A 2-year recession with -10% per quarter = approximately -55% cumulative market decline — devastating but historically plausible (2008 was ~-57%).

### 3. Two recessions back-to-back
Possible via: Recession → Recovery (4 quarters) → Normal (4 quarters) → Recession. Minimum gap is ~8 quarters. Unlikely but possible (see: 2001 + 2008 in real history). Creates an extremely challenging run.

### 4. Player buys house at boom peak, recession hits
Home value drops 15-25%. Player is underwater. If they need to relocate for a job change, they must sell at a loss OR decline the job offer (and miss the career opportunity). Classic real-life dilemma.

### 5. Auto-invest during recession
Auto-invest continues buying shares at depressed prices. This is actually optimal (dollar-cost averaging), but the UI shows growing unrealized losses. Players may feel compelled to turn off auto-invest — which is the wrong move. The tension between "correct behavior" and "emotional behavior" is intentional.

### 6. Player has no cash and no portfolio
Net Worth = 0, no shares to sell, no cash to invest. The economic cycle still affects them through job market and layoff probability. They cannot participate in market upside. This is the poverty trap — no capital means no wealth building even during a boom.

### 7. Economic cycle at game start
The starting phase is randomized with weights: Normal (50%), Boom (30%), Recession (20%). This means some runs start with a headwind (recession during your intern search) and some with a tailwind (boom hiring season). Pillar 4 — emergent story from turn 1.

### 8. Sell house and reinvest in stocks
Allowed. Player sells house (if not underwater), receives cash, can invest in S&P. Loses the housing equity growth but gains market liquidity. A valid late-game strategy if confident in market returns vs. housing appreciation in their area.

## Dependencies

### Upstream

| System | Dependency Type | Interface Used |
|--------|----------------|----------------|
| **Turn Manager** | Hard | Quarter start signal to check phase transitions |
| **Game Data** | Hard | Phase definitions, duration ranges, return ranges from `economic_cycle.json` |

### Downstream

| System | Dependency Type | Interface |
|--------|----------------|-----------|
| **Probability Engine** | Hard | `get_cycle_modifier(event_type)` |
| **Economy System** | Hard | `get_market_return()`, `get_housing_change()`, `get_salary_modifier()` |
| **Career System** | Soft | Reads phase for flavor text and event pool filtering |
| **Immigration System** | Hard | `get_perm_modifier()` |
| **Event System** | Soft | Phase determines active event pool |
| **UI** | Hard | Current phase, portfolio value, market return display |

### Interface Contract

```
EconomicCycle.get_phase() → string                    // "boom", "normal", "recession", "recovery"
EconomicCycle.get_quarters_in_phase() → int           // how long current phase has lasted
EconomicCycle.get_cycle_modifier(event_type) → float  // probability modifier for Probability Engine
EconomicCycle.get_market_return() → float             // this quarter's S&P return (already rolled)
EconomicCycle.get_housing_change() → float            // this quarter's housing price change
EconomicCycle.get_salary_modifier() → float           // modifier for job offer salary calculation
EconomicCycle.get_perm_modifier() → int               // extra quarters added to PERM processing

// Portfolio management (player actions, no AP cost)
Portfolio.buy(amount) → { shares_purchased, new_total }
Portfolio.sell(shares) → { proceeds, realized_gain }
Portfolio.set_auto_invest(amount_per_quarter) → void
Portfolio.get_status() → { shares, cost_basis, current_value, unrealized_pnl, unrealized_pnl_pct }
```

## Tuning Knobs

| Knob | Default | Safe Range | Too Low | Too High | Affects |
|------|---------|------------|---------|----------|---------|
| `BOOM_DURATION_MIN` | 6 | 4-10 | Booms feel fleeting | Booms too long, game too easy | Boom enjoyment |
| `BOOM_DURATION_MAX` | 16 | 10-24 | Booms always short | Extended booms make recession feel unfair | Cycle pacing |
| `RECESSION_DURATION_MIN` | 3 | 2-5 | Recessions are trivial | Recessions feel devastating from the start | Recession severity |
| `RECESSION_DURATION_MAX` | 8 | 5-12 | Recessions can't be truly punishing | Multi-year recession may be unrecoverable | Survival difficulty |
| `RECESSION_RETURN_MIN` | -0.15 | -0.25 to -0.08 | Recessions are mild (boring) | Market crashes destroy portfolios (frustrating) | Financial drama |
| `RECESSION_RETURN_MAX` | -0.05 | -0.10 to -0.02 | Even "good" recession quarters are painful | Some recession quarters have positive returns (unrealistic) | Recession feel |
| `BOOM_RETURN_MAX` | +0.08 | +0.05 to +0.12 | Bull market is slow | Portfolio grows unrealistically fast | Wealth accumulation speed |
| `STARTING_PHASE_RECESSION_PROB` | 0.20 | 0.10-0.30 | Most runs start easy | Too many runs start brutally | Early game variance |
| `SHARE_PRICE_FLOOR_PCT` | 0.30 | 0.15-0.50 | Market can crash to near-zero (unrealistic) | Market crashes are mild | Downside risk |
| `MARKET_MOMENTUM` | 0.1 | 0.0-0.2 | Each quarter is independent | Strong autocorrelation, extends trends | Market behavior realism |
| `UNDERWATER_MENTAL_PENALTY` | -5/quarter | -2 to -10 | Being underwater is shrug | Being underwater is crushing | Housing stress |

## Acceptance Criteria

### Functional Tests
1. **Phase transition**: Start in Normal. Advance past min_duration. Verify transition can occur. Verify it cannot occur before min_duration.
2. **Phase duration bounds**: Run 100 cycles. Verify no phase lasts shorter than min or longer than max + reasonable buffer.
3. **Market return ranges**: During Boom, verify quarterly return is between +3% and +8%. During Recession, between -15% and -5%.
4. **Buy shares**: Buy $10,000 at share price $100. Verify 100 shares added, cost basis increased by $10,000.
5. **Sell shares**: Sell 50 shares at price $120 (bought at avg $100). Verify proceeds = $6,000, realized gain = $1,000.
6. **Sell all**: Sell entire portfolio. Verify shares = 0, cost basis = 0.
7. **Auto-invest**: Enable auto-invest at $2,000/quarter. Advance 4 quarters. Verify 4 purchases at varying prices.
8. **Unrealized P&L**: Buy at $100, price drops to $80. Verify unrealized PNL shows -20%.
9. **Housing underwater**: Buy house at $500K, housing drops 15%. Verify is_underwater = true when mortgage > current value.
10. **Share price floor**: Apply extreme recession returns. Verify share price never drops below 30% of initial price.

### Statistical Tests
11. **Long-term return average**: Simulate 1000 full games (148 quarters each). Verify average annual market return is 7-8%.
12. **Cycle frequency**: Over 1000 games, verify average number of recessions per game is 3-5 (roughly one per 7-10 years).
13. **Panic sell penalty**: Compare final portfolio value for "hold forever" vs "sell during recession, rebuy during recovery" across 1000 simulations. Verify hold strategy outperforms on average.

### Integration Tests
14. **Recession → layoff probability**: Enter recession. Verify layoff base rate increases from 5% to 15% in Probability Engine.
15. **Recession → PERM delay**: Enter recession. Verify PERM processing adds extra quarters.
16. **Cycle transition display**: Verify UI updates phase indicator when transition occurs.

## Open Questions

1. **Individual stock picking**: Should the player only have S&P 500, or also individual tech stocks (higher risk/reward)? Adds depth but also complexity. — Defer to Vertical Slice.
2. **401K / tax-advantaged accounts**: Model 401K separately from taxable investment? Adds realism but UI complexity. — Defer to Alpha.
3. **Interest rates**: Should the cycle also model interest rates (affecting mortgage rates and savings)? Adds a layer of realism for housing decisions. — Defer to Alpha.
4. **Crypto**: Add cryptocurrency as a high-volatility investment option? Authentic for the 2020s timeline but may feel gimmicky. — Probably not, but discuss.
5. **Player prediction**: Should there be any signal or indicator that hints at upcoming transitions? (e.g., "market sentiment" attribute). Real markets have leading indicators. — Playtest to decide.
