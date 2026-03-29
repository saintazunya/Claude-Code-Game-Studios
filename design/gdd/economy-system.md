# Economy System

> **Status**: In Design
> **Author**: user + game-designer
> **Last Updated**: 2026-03-28
> **Implements Pillar**: Pillar 1 (Authenticity First), Pillar 2 (Every Choice Costs)

## Overview

The Economy System tracks all money flowing in and out of the player's life: salary, taxes, living expenses, investment returns, housing costs, and miscellaneous spending. Net Worth is the primary scoring metric and the accumulation of every financial decision across 148 turns. The system is designed around real US financial structures — W2 income, federal/state tax brackets, 401K contributions, cost of living variation by city, and realistic salary bands by career level. Most economic processing is passive (no AP cost) — money flows in and out automatically each quarter. The player's economic decisions are: where to live (city choice affects salary AND expenses), whether to buy a house, how much to invest in S&P 500, and when to spend money on health/travel/lawyers.

## Player Fantasy

The player should feel the **specific financial anxiety of an immigrant tech worker**: high salary on paper but crushed by taxes, rent, student loans, and the constant knowledge that losing your job means losing your visa. Watching Net Worth climb from $0 to six figures feels rewarding. Watching it crater during a recession + medical emergency feels devastating. The end-game score is denominated in dollars — the universal scorecard of the American Dream.

Pillar 1 (Authenticity): Salary bands, tax rates, and cost of living must feel real. A player who is actually an SDE L5 at Google should look at the game's numbers and think "yeah, that's about right."
Pillar 2 (Every Choice Costs): Bay Area pays more but costs more. Buying a house builds equity but locks up cash. Every financial decision has a tradeoff.

## Detailed Design

### Core Rules

#### Income Sources

**Salary (quarterly)**:
```
quarterly_salary = (annual_base + annual_rsu/4) / 4
// Paid automatically each quarter while employed
// Unemployed = $0 salary
```

Salary is determined by Career System based on career path, level, company, and city. Economy System receives the number and deposits it.

**Signing Bonus (one-time on job change)**:
```
signing_bonus = varies by level and company (defined in careers.json)
// Typically 1-3 months of salary equivalent
// Received in the quarter the player starts a new job
```

**Investment Returns (quarterly, passive)**:
```
// Managed by Economic Cycle System
// S&P 500 portfolio grows/shrinks each quarter
// Player can buy/sell (no AP cost) — see Economic Cycle GDD
```

**Home Equity (passive)**:
```
// Home value changes with Economic Cycle housing modifier
// Equity = home_value - remaining_mortgage
// Realized only on sale
```

#### Expense Categories

**Fixed Expenses (automatic, every quarter):**

| Category | Quarterly Cost | Notes |
|----------|---------------|-------|
| Federal + State Tax | Progressive brackets (see Formulas) | Based on salary + RSU |
| Rent | $3,000 - $9,000/quarter by city | Waived if homeowner (replaced by mortgage) |
| Food & Basics | $2,000 - $4,000/quarter by city | Scales with city cost of living |
| Health Insurance | $500 - $1,500/quarter | Employer-subsidized while employed; COBRA $4,500/quarter if unemployed |
| Student Loans | $1,000 - $3,000/quarter | For 5-10 years after graduation; PhD may have less |
| Car / Transport | $800 - $2,000/quarter by city | Lower in NYC (public transit), higher in car-dependent cities |

**Housing Expenses (if homeowner):**

| Category | Quarterly Cost | Notes |
|----------|---------------|-------|
| Mortgage Payment | Calculated from purchase price, down payment, interest rate | Fixed for life of loan |
| Property Tax | ~1.0-2.5% of home value annually / 4 | Varies by state |
| Maintenance | ~1% of home value annually / 4 | Random spikes (roof, HVAC — event-driven) |
| HOA (if applicable) | $500 - $2,000/quarter | Condos and some communities |

**Variable Expenses (player-triggered, from AP actions):**

| Category | Cost | Trigger |
|----------|------|---------|
| Travel | $2,000 - $5,000 | Travel action |
| Therapist | $800/quarter | See Therapist action |
| Immigration Lawyer | $500 | Consult Lawyer action |
| H1B Filing Fee | $2,000 - $5,000 | H1B prep action (employer may cover) |
| Green Card Filing Fees | $5,000 - $15,000 | Various immigration milestones |
| Medical Emergency | $3,000 - $20,000 | Sickness event (varies by severity) |

#### City System

The player's city affects both income and expenses. City is determined by job location (set by Career System / Job Change System).

| City Tier | Example Cities | Salary Modifier | Cost of Living Multiplier | Rent/Quarter |
|-----------|---------------|-----------------|--------------------------|-------------|
| **Tier 1 (VHCOL)** | San Francisco, NYC, Seattle | ×1.0 (baseline) | ×1.0 | $7,500 - $9,000 |
| **Tier 2 (HCOL)** | Los Angeles, Boston, DC | ×0.92 | ×0.85 | $5,500 - $7,000 |
| **Tier 3 (MCOL)** | Austin, Denver, Chicago | ×0.85 | ×0.65 | $3,500 - $5,000 |
| **Tier 4 (LCOL)** | Phoenix, Dallas, Raleigh | ×0.78 | ×0.50 | $3,000 - $4,000 |

**Key Insight**: Tier 1 cities pay most but cost most. Tier 3/4 cities have lower salary but much lower expenses → potentially higher savings rate. This creates a real strategic choice: Bay Area for career (more jobs, higher salary, better networking) vs. lower-cost city for wealth accumulation.

#### Housing Purchase

Buying a home is a major financial decision:

```
Requirements:
- Net Worth sufficient for down payment (typically 20% of purchase price)
- Stable employment (employer verified — H1B/GC status)
- Credit assumed good (simplified for MVP)

Purchase Flow:
1. Player chooses "Buy House" (free action, no AP)
2. Select from available homes in current city (price range based on city tier)
3. Pay down payment from cash reserves
4. Monthly mortgage calculated and added to fixed expenses
5. Home value tracked, fluctuates with Economic Cycle housing modifier

Selling:
1. Player chooses "Sell House" (free action, no AP)
2. Receives: current_home_value - remaining_mortgage - selling_costs(6%)
3. If underwater: must pay the difference from cash (or cannot sell)
4. If relocating to new city (job change): forced to sell (or rent out — future feature)
```

Housing prices by city tier:

| City Tier | Median Home Price | Range |
|-----------|------------------|-------|
| Tier 1 | $1,200,000 | $800K - $2M |
| Tier 2 | $750,000 | $500K - $1.2M |
| Tier 3 | $450,000 | $300K - $700K |
| Tier 4 | $300,000 | $200K - $500K |

#### Net Worth Calculation

```
net_worth = cash_on_hand
          + portfolio_current_value          // S&P 500 shares × current price
          + home_equity                       // home_value - remaining_mortgage (0 if not owner)
          - student_loan_remaining
```

Net Worth is displayed to the player every quarter and is the primary component of the final score.

### States and Transitions

The Economy System tracks financial state which evolves continuously:

| State | Condition | Effects |
|-------|-----------|--------|
| **Student** | Academic Phase | No salary; may have stipend (PhD TA/RA); student loan accumulating |
| **Employed** | Has active job | Regular salary; employer health insurance; employer may sponsor visa |
| **Unemployed** | Lost job / between jobs | No salary; COBRA insurance ($4,500/quarter); burning cash reserves |
| **Homeowner** | Purchased a house | Mortgage replaces rent; equity building; property tax + maintenance |
| **Renter** | No house owned | Rent expenses; full liquidity; easy to relocate |

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Attribute System** | Economy → Attributes | Writes Net Worth updates each quarter |
| **Career System** | Career → Economy | Provides salary, RSU, signing bonus based on level/company/city |
| **Economic Cycle** | Cycle → Economy | Market returns (portfolio), housing price changes, salary modifiers |
| **Turn Manager** | TM → Economy | Triggers quarterly income/expense processing at Phase 4 |
| **Action Point System** | AP → Economy | Variable expenses from player actions (travel, lawyer, therapist) |
| **Immigration System** | Immigration → Economy | Filing fees, legal costs at immigration milestones |
| **Health System** | Health → Economy | Medical expenses from sickness events |
| **Event System** | Events → Economy | Financial consequences of random events (layoff severance, unexpected costs) |
| **Game Data** | Data → Economy | Tax brackets, cost of living, salary bands from `economy.json` |
| **UI** | Economy → UI | Net Worth display, income/expense breakdown, portfolio status |

## Formulas

### Tax Calculation (Quarterly)

Simplified progressive federal tax + flat state tax:

```
annual_income = quarterly_salary × 4    // annualize for bracket calculation

// Federal brackets (simplified 2024):
federal_tax_annual =
    (min(annual_income, 11,600) × 0.10) +
    (clamp(annual_income - 11,600, 0, 35,550) × 0.12) +
    (clamp(annual_income - 47,150, 0, 53,375) × 0.22) +
    (clamp(annual_income - 100,525, 0, 91,150) × 0.24) +
    (clamp(annual_income - 191,950, 0, 51,800) × 0.32) +
    (clamp(annual_income - 243,725, 0, 365,600) × 0.35) +
    (max(annual_income - 609,350, 0) × 0.37)

// State tax (simplified by city):
state_tax_rate = { "CA": 0.093, "WA": 0.0, "NY": 0.0685, "TX": 0.0, ... }
state_tax_annual = annual_income × state_tax_rate[current_state]

// FICA (Social Security + Medicare):
fica_annual = min(annual_income, 168,600) × 0.0765 + max(annual_income - 200,000, 0) × 0.009

total_tax_quarterly = (federal_tax_annual + state_tax_annual + fica_annual) / 4
```

**Strategic implication**: Washington (Seattle) and Texas (Austin/Dallas) have 0% state income tax. California (Bay Area) has 9.3%. A $300K salary in Seattle takes home ~$8K more per quarter than the same salary in SF. This is a real factor in city choice.

### Mortgage Calculation

```
loan_amount = purchase_price - down_payment
monthly_rate = annual_interest_rate / 12
num_payments = 30 × 12                              // 30-year fixed
monthly_payment = loan_amount × (monthly_rate × (1 + monthly_rate)^num_payments)
                  / ((1 + monthly_rate)^num_payments - 1)
quarterly_mortgage = monthly_payment × 3

// Interest rate affected by Economic Cycle (future feature, MVP uses fixed 6.5%)
```

### Quarterly Cash Flow

```
income = quarterly_salary + signing_bonus(if any) + investment_dividends(0 for MVP)
expenses = total_tax + rent_or_mortgage + food + insurance + transport
         + student_loan + variable_expenses(travel, medical, legal)
         + investment_purchases(if buying S&P)

quarterly_cash_flow = income - expenses
cash_on_hand += quarterly_cash_flow

// If cash_on_hand < 0: trigger financial crisis event
```

### Savings Rate

```
savings_rate = (income - expenses) / income × 100
// Displayed to player as a health metric for their finances
// Target: >30% is strong, <10% is precarious, negative is crisis
```

### Cost of Living by City

```
quarterly_living_cost = (BASE_RENT[city_tier] + BASE_FOOD + BASE_TRANSPORT[city_tier]
                        + BASE_INSURANCE) × city_cost_multiplier

// Example: Tier 1 (SF)
// ($8,000 + $3,500 + $1,500 + $1,000) × 1.0 = $14,000/quarter
// Example: Tier 3 (Austin)
// ($4,000 + $2,500 + $1,200 + $1,000) × 0.65 = $5,655/quarter
```

### Student Loan Amortization

```
initial_loan = $50,000 (Master's) or $20,000 (PhD with stipend)
quarterly_payment = ~$1,500 (Master's) or ~$600 (PhD)
loan_duration = 10 years (40 quarters)
remaining_loan = max(0, initial_loan - (quarters_since_graduation × quarterly_payment))
```

### Final Score Calculation

```
base_score = net_worth

// Green card multiplier
if green_card_obtained:
    gc_bonus = 1.5
    early_bonus = (59 - age_at_gc_approval) × 10,000  // $10K per year early
else:
    gc_bonus = 1.0
    early_bonus = 0

final_score = (base_score × gc_bonus) + early_bonus
```

## Edge Cases

### 1. Cash goes negative
Trigger "Financial Crisis" event. Player must immediately take action next quarter:
- Sell S&P 500 shares (if any) to cover deficit
- Sell house (if owned and not underwater)
- If no assets: take a personal loan ($10,000, 8% interest, adds to quarterly expenses)
- If still negative after 2 quarters: forced to take any available job (worst offer) or voluntary departure

### 2. Unemployed with no savings
No salary, COBRA insurance at $4,500/quarter, ongoing expenses. Cash burns fast. This is the true death spiral — and the most realistic scenario for an immigrant who gets laid off during a recession with no emergency fund.

### 3. Buy house then get laid off
Mortgage payments continue. No salary income. Must sell house (possibly at loss) or burn through savings. If on H1B: losing job means losing visa → 60-day countdown → may need to sell house in a rush at discount.

### 4. City change with owned home
Job change to a different city: must sell current home. Selling costs 6% of sale price. If market is down: forced to sell at a loss. This is why buying a house on H1B is risky — you might be forced to relocate.

### 5. Student paying tuition (Day-1 CPT)
If player returns to student status (Day-1 CPT after layoff), tuition of ~$15,000/year is added to expenses. No salary, but no COBRA needed (student insurance). Cash drain is real but survivable if they have savings.

### 6. Tax refund / underpayment
MVP simplification: taxes are calculated exactly each quarter. No refund/underpayment mechanic. Actual rate is the effective rate.

### 7. S&P 500 position is the only asset
Player never bought a house, all savings in S&P. During recession: Net Worth plummets on paper (unrealized loss). Score calculation uses current market value, not cost basis. A player who enters the end-game during a recession may have artificially low score. This is fair — it mirrors real retirement timing risk.

### 8. Extremely high Net Worth late game
A Staff engineer (L6-L7) with 15+ years of S&P 500 investing and a Bay Area house can reach $3-5M Net Worth. This is realistic for the top end. No cap on Net Worth.

## Dependencies

### Upstream

| System | Dependency Type | Interface Used |
|--------|----------------|----------------|
| **Attribute System** | Hard | Reads/writes Net Worth |
| **Career System** | Hard | Provides salary, RSU, signing bonus, employment status, city |
| **Economic Cycle** | Hard | Market returns, housing price changes, salary modifiers |
| **Turn Manager** | Hard | Quarter signal for processing |
| **Action Point System** | Soft | Variable expenses from player actions |
| **Immigration System** | Soft | Filing fees at milestones |
| **Health System** | Soft | Medical expenses from sickness |
| **Game Data** | Hard | Tax brackets, cost of living, salary bands from `economy.json` |

### Downstream

| System | Dependency Type | Interface |
|--------|----------------|-----------|
| **Attribute System** | Hard | Net Worth updates |
| **Character Creation** | Soft | Entrepreneurship unlock check (Net Worth > $50K) |
| **UI** | Hard | Full financial dashboard, Net Worth display, income/expense breakdown |
| **Score System** | Hard | Final score calculation at game end |

### Interface Contract

```
Economy.process_quarter() → QuarterFinancialSummary    // called by Turn Manager; processes all income/expenses
Economy.get_net_worth() → float                         // current total net worth
Economy.get_cash() → float                              // liquid cash on hand
Economy.get_quarterly_income() → float                  // this quarter's gross income
Economy.get_quarterly_expenses() → float                // this quarter's total expenses
Economy.get_savings_rate() → float                      // current savings rate percentage
Economy.get_city() → CityDef                            // current city with cost of living data
Economy.buy_house(house_option) → BuyResult             // purchase a home
Economy.sell_house() → SellResult                       // sell current home
Economy.get_house_status() → HouseStatus | null         // current home value, equity, mortgage, underwater flag
Economy.add_expense(category, amount) → void            // other systems add variable expenses
Economy.get_financial_summary() → FullFinancialReport   // detailed breakdown for UI
```

## Tuning Knobs

| Knob | Default | Safe Range | Too Low | Too High | Affects |
|------|---------|------------|---------|----------|---------|
| `BASE_RENT_TIER1` | $8,000/quarter | $6K-$12K | Tier 1 cities too cheap (everyone lives in SF) | Tier 1 unaffordable (nobody stays) | City choice tension |
| `COST_OF_LIVING_TIER3_MULT` | 0.65 | 0.50-0.80 | Tier 3 is absurdly cheap (always optimal) | Tier 3 not enough cheaper to justify salary cut | City choice balance |
| `STUDENT_LOAN_MASTER` | $50,000 | $30K-$80K | Loans are trivial | Loans dominate early finances too heavily | Early game financial pressure |
| `STUDENT_LOAN_PHD` | $20,000 | $0-$40K | PhD is financially free (too attractive) | PhD has similar debt to Master's (diminishes PhD benefit) | PhD value proposition |
| `DOWN_PAYMENT_PCT` | 0.20 | 0.10-0.30 | Easy to buy house (less financial gating) | Hard to save for house (delays home buying) | Housing accessibility |
| `MORTGAGE_RATE` | 0.065 | 0.03-0.09 | Cheap mortgages (housing too attractive) | Expensive mortgages (nobody buys) | Rent vs buy balance |
| `SELLING_COST_PCT` | 0.06 | 0.04-0.08 | Easy to trade houses (too liquid) | Selling is punishing (locks people into homes) | Housing mobility |
| `COBRA_QUARTERLY` | $4,500 | $3,000-$6,000 | Unemployment insurance cost is mild | Unemployment burns cash devastatingly fast | Layoff financial pressure |
| `MEDICAL_EMERGENCY_MIN` | $3,000 | $1K-$5K | Sickness is financially trivial | Minor illness is financially devastating | Health-finance coupling |
| `MEDICAL_EMERGENCY_MAX` | $20,000 | $10K-$30K | Major illness is manageable | Major illness is financially catastrophic | Worst-case medical cost |
| `FINANCIAL_CRISIS_LOAN` | $10,000 | $5K-$20K | Loan too small to help | Loan removes urgency of financial crisis | Safety net size |
| `GC_SCORE_MULTIPLIER` | 1.5 | 1.2-2.0 | Green card doesn't boost score enough | Green card score bonus overshadows net worth | Green card incentive strength |
| `EARLY_GC_BONUS_PER_YEAR` | $10,000 | $5K-$20K | Early green card isn't rewarded enough | Early green card dominates score | Speed vs wealth balance |

## Acceptance Criteria

### Functional Tests
1. **Quarterly salary deposit**: Employed at $300K/year. Verify $75K deposited each quarter before tax.
2. **Tax calculation**: $300K salary in California. Verify effective tax rate ~35-38% (federal + state + FICA).
3. **Tax: WA vs CA**: Same salary, compare WA (0% state) vs CA (9.3%). Verify ~$7K/year difference.
4. **Rent by city**: Living in Tier 1 city. Verify rent is in $7,500-$9,000/quarter range.
5. **Student loan**: Master's graduate, quarter 1 of career. Verify student loan payment deducted.
6. **Buy house**: Cash $300K, buy $1.2M house (20% down = $240K). Verify cash decreases by $240K, mortgage payments begin.
7. **Sell house**: Own house bought at $1M, current value $1.1M, remaining mortgage $750K. Sell. Verify proceeds = $1.1M - $750K - $66K(6%) = $284K.
8. **Sell underwater**: House value $800K, mortgage $900K. Verify sale blocked (cannot cover difference) unless player adds cash.
9. **Net Worth**: Cash $50K, portfolio $200K, home equity $150K, student loans $30K. Verify Net Worth = $370K.
10. **Unemployment**: Lose job. Verify salary stops, COBRA begins at $4,500/quarter.
11. **Financial crisis**: Cash goes below $0. Verify Financial Crisis event triggers.
12. **Final score with GC**: Net Worth $1M, green card at age 40. Verify score = ($1M × 1.5) + (19 × $10K) = $1,690,000.
13. **Final score without GC**: Net Worth $1M, no green card. Verify score = $1M × 1.0 = $1,000,000.

### Integration Tests
14. **Career → Economy**: Promote from L4 to L5. Verify salary increase reflected in next quarter's income.
15. **Economic Cycle → expenses**: Recession hits. Verify no direct expense change (recession affects salary offers and layoffs, not current salary).
16. **Sickness → medical bill**: Sickness event fires. Verify medical expense deducted from cash.
17. **City change**: Job change from SF to Austin. Verify rent drops, salary adjusts, cost of living changes.

### Balance Tests
18. **Savings rate realistic**: SDE L4 in Tier 1 city with Master's loans. Verify savings rate is 15-30% (realistic for early career).
19. **Millionaire achievability**: L6 engineer, 15 years of S&P investing, Bay Area homeowner. Verify Net Worth can reach $2-3M by age 55. Realistic per real data.
20. **Student loan payoff**: Verify Master's student loan is fully paid off within 10 years (40 quarters).

## Open Questions

1. **401K modeling**: Should 401K be separate from taxable S&P investment? Adds tax advantage complexity but is very real for tech workers. — Defer to Vertical Slice.
2. **RSU vesting schedule**: Should RSUs vest on a 4-year cliff/grading schedule? Currently simplified as annual grant. — Defer to Career System GDD.
3. **Inflation**: Should cost of living increase over the 37-year game span? Realistic but adds complexity. Could just bake it into Economic Cycle housing/rent increases. — Defer to Alpha.
4. **Dual income**: If marriage/partner is ever added, dual income dramatically changes finances. — Defer to Full Vision.
5. **Rental income**: Can the player rent out their house instead of selling when relocating? Adds an income stream but complexity. — Defer to Alpha.
6. **Emergency fund advice**: Should the game hint that keeping 6 months of expenses in cash is wise? Or let players learn the hard way? — Pillar 5 says let them learn.
