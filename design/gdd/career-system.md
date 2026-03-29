# Career System

> **Status**: In Design
> **Author**: user + game-designer
> **Last Updated**: 2026-03-28
> **Implements Pillar**: Pillar 1 (Authenticity First), Pillar 2 (Every Choice Costs)

## Overview

The Career System models the player's professional life in the US tech industry: career path selection, company employment, level/title progression (L3→L7), performance reviews, promotion probability, PIP (Performance Improvement Plan) risk, and termination. It is one of the two most complex systems in the game (alongside Immigration) and tightly coupled with it — your job determines your visa sponsor, your visa constrains your job mobility, and your level determines your salary and green card eligibility.

The system operates on a realistic tech industry model: levels have expected tenures, promotions are probability-based and never guaranteed, PIP is a real threat for underperformers, and the higher you climb the harder it gets. Every company has different characteristics — some are prestigious but grinding, some are relaxed but slow to promote, some sponsor green cards eagerly and some drag their feet.

## Player Fantasy

The player should feel the **specific anxiety and ambition of a tech worker climbing the ladder while handcuffed to a visa**. The promotion from L5 to L6 should feel like a genuine achievement. Getting PIP'd should feel like a punch in the gut — not just because of career damage, but because losing your job means losing your visa. The decision to stay at a bad company because they're sponsoring your green card vs. jumping to a better company and restarting the process should be genuinely agonizing.

Pillar 1 (Authenticity): Level definitions, salary bands, and promotion timelines mirror real FAANG/big tech structures. A player who works at Google should recognize the system.
Pillar 2 (Every Choice Costs): Every career decision has an immigration consequence. Promotion brings higher expectations. Job hopping resets PERM. Staying put means lower salary growth.

## Detailed Design

### Core Rules

#### Career Paths (MVP: SDE only; others added in later tiers)

| Career Path | Description | H1B Friendly | Academic Impact/Quarter | Salary Tier | GC Route Advantage |
|-------------|-------------|--------------|------------------------|-------------|-------------------|
| **SDE** (Software Dev Engineer) | Core software engineering | Yes | 0 (must side-project) | High | Standard EB2/EB3 |
| **MLE** (Machine Learning Engineer) | ML/AI engineering | Yes | +1 (some papers) | Very High | Possible EB1 with publications |
| **RS** (Research Scientist) | Industry research | Yes | +5 (papers are the job) | High | Strong EB1A/NIW path |
| **Data Engineer** | Data infrastructure | Yes | 0 | Medium-High | Standard EB2/EB3 |
| **Data Scientist** | Analytics + modeling | Yes | +2 (some publications) | Medium-High | Possible NIW |
| **Applied Scientist** | Research + engineering hybrid | Yes | +3 | Very High | Strong EB1 with PhD |
| **Startup Founder** | Own company | E2/O1 required | Varies | Unstable | EB1C if successful |

MVP implements SDE only. Each additional path is a data extension in `careers.json` with unique salary bands, promotion curves, and academic impact generation.

#### Level System

Modeled after standard big tech leveling (Google/Meta/Amazon scale):

| Level | Title | Typical Tenure | Salary Range (TC) | Expectations | Promotion Base Rate |
|-------|-------|---------------|-------------------|-------------|-------------------|
| **L3** | Junior SDE | 1-2 years | $120K - $180K | Learn and contribute | 0.30 (expected to promote) |
| **L4** | SDE | 2-3 years | $160K - $250K | Independent contributor | 0.22 |
| **L5** | Senior SDE | 3-5 years | $220K - $350K | Technical leadership, mentoring | 0.15 |
| **L6** | Staff SDE | 4-8 years | $300K - $500K | Org-level impact, cross-team influence | 0.08 |
| **L7** | Principal SDE | 5-10+ years | $450K - $700K | Company-wide impact, industry thought leader | 0.03 |

Key design points:
- L3→L4 is "expected" — high base rate, most people get there
- L5 is where most careers plateau ("Senior is terminal level")
- L5→L6 is the great filter — base rate drops to 8%, requires sustained top performance
- L6→L7 is exceptional — 3% base, realistically only achievable with Performance near cap + luck
- Each level has a wider salary band — within-level raises happen without promotion

#### Company Model

Each company the player works at has attributes that affect their experience:

```json
{
  "company_id": "big_tech_a",
  "display_name": "TechCorp",
  "tier": "faang",           // faang, big_tech, mid_tech, startup
  "city": "tier_1",
  "culture": "grind",        // grind, balanced, relaxed
  "gc_willingness": "eager", // eager, standard, reluctant
  "perm_speed": "fast",      // fast, normal, slow
  "pip_rate_modifier": 0.0,  // added to base PIP probability
  "promotion_modifier": 0.0, // added to base promotion probability
  "salary_modifier": 1.0,    // multiplier on salary band
  "layoff_modifier": 0.0     // added to base layoff probability
}
```

Company culture effects:

| Culture | Performance Gain Modifier | Mental Drain | PIP Aggression | Promotion Speed |
|---------|--------------------------|-------------|----------------|-----------------|
| **Grind** | Normal work +7 (vs +5), Grind +18 (vs +15) | Extra -3 Mental/quarter | +5% PIP rate | +3% promotion |
| **Balanced** | Normal values | Normal | Normal | Normal |
| **Relaxed** | Normal work +3 (vs +5), Grind +12 (vs +15) | -2 Mental/quarter (less stress) | -3% PIP rate | -3% promotion |

Green card willingness:

| Willingness | PERM Start Delay | PERM Processing Modifier | Behavior |
|-------------|-----------------|-------------------------|----------|
| **Eager** | 0-2 quarters after hire | -1 quarter processing | Starts PERM proactively; supports premium processing |
| **Standard** | 2-4 quarters after hire | Normal | Starts PERM when asked; standard timeline |
| **Reluctant** | 4-8 quarters after hire | +2 quarters processing | Drags feet; may freeze during recession; 15% chance of "not right now" per quarter asked |

#### Company Generation

At game start and during job searches, companies are procedurally generated from templates:

```
1. Select company tier (weighted by economic cycle + player level)
2. Assign city (weighted by player's current city + job market)
3. Roll culture (weighted by tier — startups more likely "grind", big corps more varied)
4. Roll GC willingness (weighted by tier — FAANG usually "eager", smaller companies vary)
5. Apply salary band based on tier + city + level
6. Generate company name (from name pool)
```

The player doesn't get to pick their dream company — they get offers from whatever's available, and must weigh the tradeoffs.

#### Performance Review Cycle

Performance is evaluated at Q4 each year (Turn Manager triggers this):

```
1. Calculate promotion eligibility:
   - Must have been at current level for minimum tenure (L3: 4 quarters, L4: 8, L5: 12, L6: 16)
   - Must not be on PIP

2. Calculate promotion probability:
   promotion_prob = promotion_base_rate[level]
                  + performance × PROMOTION_PERF_WEIGHT
                  + skills × PROMOTION_SKILL_WEIGHT
                  + school_modifier
                  + company.promotion_modifier
                  + economic_cycle_modifier
   promotion_prob = clamp(promotion_prob, PROMOTION_FLOOR, PROMOTION_CAP)

3. Roll for promotion via Probability Engine

4. If promoted:
   - Level increases
   - Salary jumps to new level's band (low end + performance-based positioning)
   - Mental +15 (accomplishment high)
   - Performance resets to 60 (new baseline expectations — the bar is higher now)
   - RSU refresh grant

5. If not promoted:
   - No level change
   - Possible within-level raise (3-8% based on performance)
   - If denied 2+ years in a row: Mental -10 ("am I stuck?")
   - If Performance < 40 at review: enters PIP track
```

#### PIP (Performance Improvement Plan)

PIP is triggered when Performance drops below 30 (checked each quarter, not just Q4):

```
PIP Flow:
1. Performance < 30 → PIP probability check (base 5% + modifiers)
2. If PIP triggered:
   - Player receives "PIP Warning" event
   - 2-quarter countdown begins
   - Must raise Performance above 50 within 2 quarters
   - During PIP: cannot job search (too risky to interview while on PIP)
   - Mental -20 immediately (PIP is devastating)

3. After 2 quarters:
   - If Performance >= 50: PIP resolved, back to normal
   - If Performance < 50: Terminated
     → Triggers unemployment state
     → If on H1B: 60-day countdown to find new sponsor
     → Severance: 2-4 months salary (company-dependent)
```

PIP probability modifiers:
```
pip_prob = PIP_BASE (0.05)
         + max(0, (30 - performance) × 0.01)    // lower performance = higher risk
         + coast_consecutive × 0.08               // consecutive 躺平 quarters
         + company.pip_rate_modifier
         + economic_cycle_modifier                 // recession: companies PIP more aggressively
         - performance × 0.002                     // higher performance = lower risk (inverse)
```

#### Job Change Flow

When the player spends AP on "Prepare Job Change":

```
1. Job Search Phase (1-2 quarters of AP investment):
   - Each quarter of prep adds to offer probability
   - Skills, school_modifier, and economic cycle all factor in
   - Probability Engine rolls for "job_offer" each quarter searched

2. Offer Generation (if roll succeeds):
   - Generate 1-3 company offers (more in boom, fewer in recession)
   - Each offer has: company attributes, level (current or +1), salary, city, GC willingness
   - Level-up offer: rare (15% chance), means external promotion
   - Salary typically 15-40% above current (job hopping premium)

3. Player Decision:
   - Accept one offer → triggers job change
   - Decline all → stay at current company (search continues or stops)

4. Job Change Consequences:
   - New company, new salary, possible new city
   - Performance resets to 50 (new job baseline)
   - Signing bonus received
   - PERM impact (see Immigration System):
     * Pre-I-140: PERM resets completely
     * Post-I-140: priority date preserved, but new PERM needed
   - Tenure resets to 0 (affects next promotion eligibility)
   - Mental +10 (fresh start) or Mental -5 (if forced move, e.g., layoff)
```

#### Layoff Mechanics

Layoffs are checked each quarter (more frequent during recession):

```
layoff_prob = LAYOFF_BASE
            + economic_cycle_modifier               // recession: +10%
            + company.layoff_modifier
            - performance × LAYOFF_PERF_PROTECTION  // high performers are safer
            - level × 0.01                           // senior people slightly safer (more expensive to replace)

layoff_prob = clamp(layoff_prob, LAYOFF_FLOOR, LAYOFF_CAP)
```

If laid off:
- Receive severance (level-dependent: L3 = 2 months, L5 = 4 months, L7 = 6 months)
- Enter unemployment state
- If on H1B: 60-day grace period countdown begins
- Performance preserved (for resume/next job search)
- PERM impact same as voluntary job change

#### Boss System (Simplified)

Each job comes with a randomly-assigned boss type that modifies the work experience:

| Boss Type | Probability | Performance Modifier | Mental Effect | Promotion Effect | PIP Behavior |
|-----------|------------|---------------------|---------------|-----------------|-------------|
| **Supportive** | 25% | Normal gains | Mental +2/quarter | +5% promotion chance | Coaches before PIP, gives extra quarter |
| **Neutral** | 40% | Normal | Normal | Normal | Standard PIP process |
| **Demanding** | 25% | +3 extra Performance if Normal/Grind | Mental -3/quarter | +3% promotion (rewards results) | Quick to PIP, strict timeline |
| **Toxic** | 10% | Normal gains but Mental -5/quarter | Mental -5/quarter | -5% promotion (takes credit) | PIPs unfairly, 2x PIP probability |

Boss is reassigned on:
- Job change (new company, new boss)
- Every 6-8 quarters at same company (reorg, team change)
- Event-driven (random reorg event)

A toxic boss is one of the most realistic sources of misery in the game — and creates a genuine dilemma when your company is sponsoring your green card. Do you endure the toxic boss for the PERM, or leave and restart?

### States and Transitions

```
STUDENT → EMPLOYED → [promotion cycle] → EMPLOYED (higher level)
                  → PIP → EMPLOYED (if recovered) or TERMINATED
                  → LAID_OFF → UNEMPLOYED
                  → VOLUNTARY_QUIT → JOB_SEARCH → EMPLOYED (new company)

UNEMPLOYED → JOB_SEARCH → EMPLOYED
           → VISA_EXPIRY (if H1B 60-day countdown expires)
           → STARTUP (if entrepreneurship route)
```

Player always has exactly one employment state. No moonlighting or dual employment (realistic for H1B — you can only work for your sponsor).

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Attribute System** | Career ↔ Attributes | Reads Performance, Skills for promotion/PIP. Writes Performance resets on job change/promotion. |
| **Probability Engine** | Career → Probability | Calls `roll("promotion")`, `roll("pip")`, `roll("layoff")`, `roll("job_offer")` |
| **Immigration System** | Career ↔ Immigration | Career provides employer ID for PERM; Immigration constrains job mobility (H1B tied to employer). Circular dependency resolved via interface contract. |
| **Economy System** | Career → Economy | Provides salary, RSU, signing bonus, severance. Updates on promotion/job change. |
| **Action Point System** | AP → Career | Work mode selection (躺平/正常/卷王) feeds Performance delta. Job search AP triggers search flow. |
| **Economic Cycle** | Cycle → Career | Recession modifies layoff rate, promotion rate, job offer availability, salary offers. |
| **Event System** | Events ↔ Career | Career events (reorg, acquisition, team change) modify company or boss. |
| **Turn Manager** | TM → Career | Q4 trigger for annual performance review. |
| **Game Data** | Data → Career | Career paths, level definitions, salary bands, company templates from `careers.json` |
| **Mental Health System** | Career → Mental | Promotion/PIP/boss type affect Mental via attribute deltas. |

## Formulas

### Promotion Probability

```
promotion_prob = PROMOTION_BASE[level]                         // L3:0.30, L4:0.22, L5:0.15, L6:0.08, L7:0.03
               + performance × 0.004                           // +0.4% per performance point
               + skills × 0.001                                // +0.1% per skill point
               + school_modifier                                // -10% to +10%
               + company.promotion_modifier                     // company-specific
               + economic_cycle_modifier                        // boom +5%, recession -10%
               + boss_promotion_modifier                        // supportive +5%, toxic -5%

promotion_prob = clamp(promotion_prob, 0.02, PROMOTION_CAP[level])
// Caps per level: L3→L4: 0.85, L4→L5: 0.75, L5→L6: 0.55, L6→L7: 0.30
```

Example: L5 SDE, Performance 75, Skills 60, School 4, balanced company, normal economy, neutral boss:
```
0.15 + (75 × 0.004) + (60 × 0.001) + 0.06 + 0 + 0 + 0
= 0.15 + 0.30 + 0.06 + 0.06 = 0.57 → clamped to 0.55 (L5→L6 cap)
```

A very strong L5 tops out at 55% — even the best candidate has nearly a coin-flip chance of being denied. This is painfully realistic.

### PIP Probability (per quarter, when Performance < 30)

```
pip_prob = 0.05
         + max(0, (30 - performance) × 0.01)
         + coast_consecutive × 0.08
         + company.pip_rate_modifier
         + economic_cycle_modifier("pip")
pip_prob = clamp(pip_prob, 0.01, 0.60)
```

### Layoff Probability (per quarter)

```
layoff_prob = LAYOFF_BASE                                      // 0.05 normal, see Economic Cycle
            + company.layoff_modifier
            - performance × 0.002                               // high performers protected
            - min(level - 3, 2) × 0.01                         // seniority protection (small)
            + economic_cycle_modifier("layoff")

layoff_prob = clamp(layoff_prob, 0.01, 0.40)
```

### Salary on Promotion

```
new_salary_base = SALARY_MIN[new_level]
performance_positioning = (performance - 50) / 50              // -1.0 to +1.0
salary_range = SALARY_MAX[new_level] - SALARY_MIN[new_level]
new_salary = new_salary_base + (salary_range × max(0, performance_positioning) × 0.5)
// Strong performers start higher in the band; weak performers start at minimum
```

### Salary on Job Hop

```
current_tc = current_salary + current_rsu
hop_premium = random_uniform(0.15, 0.40)                      // 15-40% raise
offer_salary = current_tc × (1 + hop_premium) × city_salary_modifier × company.salary_modifier
// Clamped to new company's salary band for the offered level
```

### Severance on Layoff

```
severance_months = 2 + (level - 3)                             // L3:2, L4:3, L5:4, L6:5, L7:6
severance_amount = (current_salary / 4) × (severance_months / 3)  // convert to quarterly
```

## Edge Cases

### 1. L7 promotion attempt
L7 is the highest level. At L7, no further promotion is possible. Annual review at L7 results in within-level raise only. Performance still matters (PIP/layoff protection) but the promotion carrot is gone.

### 2. Promoted while on H1B — does visa need update?
Yes. H1B is tied to a specific job description. Significant title change (L5→L6) may require an H1B amendment. This is a 1-quarter process costing $2,000, handled automatically (no AP) but adds immigration complexity. If amendment is denied (rare, 5%): stays at old level on paper, salary increase still applies.

### 3. Laid off 1 quarter before I-140 approval
The worst timing. PERM and pending I-140 are both voided. Everything resets. This is the "green card trap" scenario — and it's realistic. Many immigrants have lived this nightmare.

### 4. Job search during PIP
Blocked. The design prevents job searching while on PIP — the player is assumed to be too stressed and under too much scrutiny to interview. They must either recover Performance or face termination. After PIP resolution (success or failure), job search becomes available again.

### 5. External promotion (level-up offer from new company)
15% of job offers come with a level bump (e.g., current L4, offered L5 at new company). This is the fastest way to promote but:
- Performance resets to 50 (new expectations)
- PERM resets (pre-I-140)
- New boss, new culture, new adjustment period

### 6. Startup founder returns to employment
If the startup fails, the player can return to employment. They re-enter at the level they left minus 1 (cap penalty for gap on resume). Skills partially preserved. This makes startup a genuine risk.

### 7. Coast for too long
3+ consecutive 躺平 quarters: PIP probability increases significantly (+24% from coast_consecutive alone). Even at a relaxed company, sustained coasting will eventually trigger performance scrutiny.

### 8. Toxic boss + PERM in progress
The quintessential immigrant dilemma. Toxic boss drains Mental -5/quarter, but your company is 2 quarters away from I-140 approval. Quitting means restarting PERM. Staying means potential burnout. No good option — exactly as designed.

### 9. Multiple job offers
If the player receives 2-3 offers simultaneously, they must choose. Each offer shows: company tier, culture, salary, city, GC willingness, boss type (hidden until accepted). The player weighs salary vs. green card willingness vs. city preference with incomplete information.

### 10. Company acquired / reorg
Random event: company is acquired. Effects:
- 30% chance: culture changes (rolled new culture)
- 20% chance: layoff wave (acquisition redundancy)
- 50% chance: business as usual but new boss
- PERM in progress: may be transferred to new entity (80%) or voided (20%)

## Dependencies

### Upstream

| System | Dependency Type | Interface Used |
|--------|----------------|----------------|
| **Attribute System** | Hard | Reads Performance, Skills; writes Performance resets |
| **Probability Engine** | Hard | Rolls for promotion, PIP, layoff, job_offer |
| **Action Point System** | Hard | Receives work mode selection and job search actions |
| **Economic Cycle** | Hard | Modifiers for promotion, layoff, job availability, salary |
| **Turn Manager** | Hard | Q4 annual review trigger |
| **Game Data** | Hard | Career paths, levels, salary bands, company templates |

### Downstream

| System | Dependency Type | Interface |
|--------|----------------|-----------|
| **Economy System** | Hard | Salary, RSU, signing bonus, severance |
| **Immigration System** | Hard | Employer ID, employment status, level (for PERM, H1B) |
| **Mental Health System** | Soft | Promotion/PIP/boss effects on Mental |
| **Event System** | Soft | Career events (reorg, acquisition) |

### Interface Contract (Career ↔ Immigration)

This is the circular dependency between Career and Immigration. Resolved via explicit interface:

**Career exposes to Immigration:**
```
Career.get_employer_id() → string          // current employer for PERM/H1B
Career.get_employment_status() → string    // "employed", "unemployed", "student", "startup"
Career.get_level() → int                   // current level (affects EB1C eligibility)
Career.get_tenure_quarters() → int         // quarters at current company
Career.is_on_pip() → bool                  // PIP status
```

**Immigration exposes to Career:**
```
Immigration.get_visa_type() → string       // current visa (affects job change freedom)
Immigration.can_change_employer() → bool   // false on H1B without transfer, true with GC/EAD
Immigration.get_perm_status() → string     // "none", "filing", "pending", "approved", affects job change decision
Immigration.get_i140_status() → string     // "none", "pending", "approved" — critical for job change risk
Immigration.has_combo_card() → bool        // EAD/AP — unlocks employer independence
```

## Tuning Knobs

| Knob | Default | Safe Range | Too Low | Too High | Affects |
|------|---------|------------|---------|----------|---------|
| `PROMOTION_BASE_L3` | 0.30 | 0.20-0.45 | L3 stuck too long, slow start | L3→L4 trivial, no early tension | Junior career pacing |
| `PROMOTION_BASE_L5` | 0.15 | 0.08-0.25 | L5→L6 feels impossible | L6 too common, devalues achievement | Mid-career wall |
| `PROMOTION_BASE_L6` | 0.08 | 0.03-0.12 | Staff is nearly unattainable | Staff is too easy, L7 becomes the real wall | Senior career pacing |
| `PROMOTION_CAP_L5_L6` | 0.55 | 0.40-0.70 | Even perfect candidates have low odds | High performers can almost guarantee L6 | Ceiling on effort |
| `PIP_BASE` | 0.05 | 0.02-0.10 | PIP is rare (low performance has no consequence) | PIP is constant threat (too stressful) | Performance pressure |
| `COAST_PIP_ESCALATION` | 0.08 per quarter | 0.04-0.12 | Coasting is safe (no reason to work normally) | 2 quarters of coast triggers PIP (too punishing) | Coast viability |
| `LAYOFF_BASE_NORMAL` | 0.05 | 0.02-0.08 | Layoffs are rare (no job security anxiety) | Layoffs too frequent (feels unfair) | Baseline job anxiety |
| `JOB_HOP_SALARY_PREMIUM_MIN` | 0.15 | 0.10-0.25 | Job hopping barely pays more | Minimum hop is a huge raise | Job change incentive |
| `JOB_HOP_SALARY_PREMIUM_MAX` | 0.40 | 0.25-0.50 | Best offers are moderate | Massive salary jumps on every hop | Job change reward ceiling |
| `EXTERNAL_PROMOTION_CHANCE` | 0.15 | 0.05-0.25 | Level-up offers are very rare | Too easy to promote by hopping | Internal vs external promotion balance |
| `BOSS_TOXIC_PROBABILITY` | 0.10 | 0.05-0.20 | Toxic bosses are rare (less drama) | Too many toxic bosses (game feels unfair) | Workplace drama frequency |
| `BOSS_ROTATION_QUARTERS` | 6-8 | 4-12 | Bosses change too quickly (less attachment) | Stuck with bad boss too long (frustrating) | Boss impact duration |
| `PERFORMANCE_RESET_PROMOTION` | 60 | 50-70 | Bar raises a lot on promotion (harsh) | Promotion barely raises bar (easy ride) | Post-promotion pressure |
| `PERFORMANCE_RESET_JOB_CHANGE` | 50 | 40-60 | New job is comfortable quickly | New job is a hard restart | Job change adjustment |

## Acceptance Criteria

### Functional Tests
1. **Level progression**: Start at L3. Promote to L4. Verify level, salary band, and Performance reset.
2. **Promotion probability**: L5, Performance 80, Skills 50, School 4. Calculate expected probability. Verify Probability Engine returns correct value.
3. **Promotion cap**: L5→L6 with maximum possible modifiers. Verify probability is capped at 0.55.
4. **PIP trigger**: Set Performance to 25, coast for 2 quarters. Verify PIP probability is significantly elevated.
5. **PIP resolution**: Enter PIP. Raise Performance to 55 within 2 quarters. Verify PIP resolved.
6. **PIP termination**: Enter PIP. Fail to raise Performance above 50 in 2 quarters. Verify termination event fires.
7. **Layoff**: Set economic cycle to recession. Verify layoff probability increases. Roll layoff. Verify unemployment state, severance paid, 60-day countdown if on H1B.
8. **Job search**: Spend AP on Prepare Job Change for 2 quarters. Verify offer probability includes +20% bonus.
9. **Job offer generation**: Trigger successful job_offer roll. Verify 1-3 offers generated with valid company attributes.
10. **Job change**: Accept offer. Verify new company, new salary, Performance reset to 50, tenure reset.
11. **Boss assignment**: Start new job. Verify boss type assigned from weighted distribution.
12. **Boss rotation**: Stay at company for 8 quarters. Verify boss may change.
13. **Work mode → Performance**: Select 卷王. Verify Performance +15. Select 躺平. Verify Performance -5.

### Integration Tests
14. **Career → Immigration**: Change jobs while PERM is pending (pre-I-140). Verify PERM resets via Immigration System.
15. **Career → Economy**: Promote from L4 to L5. Verify salary increases in Economy System next quarter.
16. **Recession → Career**: Enter recession. Verify promotion odds decrease, layoff odds increase, fewer job offers generated.
17. **Toxic boss → Mental**: Assigned toxic boss. Verify Mental receives extra -5/quarter drain.
18. **PIP → Job search blocked**: Enter PIP. Verify "Prepare Job Change" action is unavailable.
19. **Layoff → Visa crisis**: Get laid off on H1B. Verify Immigration System starts 60-day countdown.

### Balance Tests
20. **Career pacing**: Simulate 1000 SDE careers from L3. Verify median reaches L5 by age 30-33. Verify <20% reach L6 by age 40. Verify <5% reach L7.
21. **Job hop advantage**: Compare average salary at age 35 for "stays at one company" vs "hops every 2-3 years" across 1000 simulations. Verify hoppers earn 15-30% more but have lower green card completion rate.
22. **Coast viability**: Coast for 3 consecutive quarters. Verify PIP probability exceeds 25%.

## Open Questions

1. **IC vs Manager track**: Should there be a management track (L5 → M1 → M2 → Senior Manager)? Different promotion dynamics, different stress profile, different visa implications (EB1C for managers). — Defer to Alpha.
2. **Company switching cost beyond PERM**: Should there be a "ramp-up period" at new companies where Performance gains are halved for 1-2 quarters? Realistic but may feel too punishing stacked with PERM reset. — Playtest.
3. **Performance review: stack ranking**: Should some companies use stack ranking (forced distribution — bottom 10% PIP'd regardless of absolute performance)? Very realistic for certain companies but adds complexity. — Defer to Vertical Slice.
4. **Remote work**: Should remote work be an option that allows living in a cheaper city while earning Tier 1 salary (at a discount)? Very relevant post-2020 but adds city system complexity. — Defer to Alpha.
5. **Side projects / open source**: Should there be career-building actions beyond the main job? (Contributing to open source, speaking at conferences) — Could tie into Academic Impact for non-RS careers. Defer to Vertical Slice.
