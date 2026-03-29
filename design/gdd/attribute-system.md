# 属性系统 (Attribute System)

> **Status**: In Design
> **Author**: user + game-designer
> **Last Updated**: 2026-03-28
> **Implements Pillar**: Pillar 5 (可学习的深度), Pillar 2 (每个选择都有代价)

## Overview

The Attribute System manages the character's 7 core attributes and serves as the central data source for all gameplay systems. Attribute values accumulate or decay passively based on the player's action point allocation each quarter, and are read by the Probability Engine to determine success rates for key events (promotion, job change, visa approval, sickness, PIP, etc.). Players never manipulate attribute values directly — they shape attributes indirectly through action choices, and attributes in turn influence outcomes through the probability system. This "Action → Attribute → Probability → Outcome" chain is the foundational loop of the entire game.

Additionally, 3 creation-phase attributes (Constitution, School Ranking, Geographic Location) set starting conditions that influence the Academic Phase, then fold into or decay toward the long-term attribute baselines once the career phase begins.

## Player Fantasy

The player should feel like they are "managing themselves as a resource." Each attribute represents an investment in a dimension of their life — and they cannot max everything simultaneously. High Performance people get promoted fast but burn out; high Academic Impact people get green cards faster but earn less; high Network people get more opportunities but spend precious AP maintaining connections.

Core emotional loop: **alternating agency and helplessness**. Attributes give the player a sense that "my effort matters" (Performance went up, promotion odds are visibly higher), but the probability system reminds them "effort ≠ guarantee" (Performance 90 can still fail promotion). This design gives players strategic motivation while preserving the authentic uncertainty of immigrant life.

Pillar alignment:
- **Pillar 2 (Every Choice Costs)**: Attributes are inherently zero-sum with AP — time spent on work cannot be spent on health, energy spent on academics cannot be spent on networking.
- **Pillar 5 (Learnable Depth)**: Understanding hidden attribute interactions (Grind Mode → Performance↑ Health↓ → Sickness → Performance↓) is the key to mastering the game.

## Detailed Design

### Core Rules

#### Creation Attributes (Set once at game start)

The player distributes **10 points** across 3 creation attributes (each 0-5):

| Attribute | Range | Permanent? | Effect |
|-----------|-------|------------|--------|
| **Constitution** | 0-5 | Folds into Health | Maps to starting Health value. Constitution 5 → Health starts at 80. Constitution 0 → Health starts at 40. Formula: `starting_health = 40 + (constitution × 8)` |
| **School Ranking** | 0-5 | **Permanent** | Applies a modifier to ALL work-related probability rolls for the entire game. Formula: `school_modifier = (school_ranking - 2.5) × 4%`, yielding -10% at 0, +10% at 5. This represents the lifelong resume signal of your university. |
| **Geographic Location** | 0-5 | Academic Phase only (but cascading) | Directly affects intern search probability during Academic Phase. No intern → drastically reduced first job probability → potential early game over (OPT expiry with no job). Formula: `intern_probability_bonus = (geo_location - 2.5) × 6%`, yielding -15% at 0, +15% at 5. After securing first job, this attribute has no further direct effect — but its cascading consequences are permanent. |

**Design intent**: School Ranking is a long-term investment (permanent +/- on every work roll). Geographic Location is a high-stakes early gamble (cascading failure can end the game, but irrelevant once you survive). Constitution is a backend insurance policy (only matters when you push hard). This creates meaningful tension: safe builds (3/4/3) have no standout advantage; min-max builds (0/5/5 or 5/5/0) create dramatically different early games.

#### Core Attributes (Evolve throughout the game)

6 core attributes tracked throughout the game, range 0-100:

| # | Attribute | Range | Natural Decay | Primary Gain Source | Primary Drain Source |
|---|-----------|-------|---------------|--------------------|--------------------|
| 1 | **Performance** | 0-100 | -3/quarter (if no work AP spent) | Work actions (Normal +5, Grind +15) | Sickness, absence, job change reset |
| 2 | **Skills** | 0-100 | -1/quarter | Study/upskill actions, on-the-job learning (slow) | Career change penalty (partial reset when switching fields) |
| 3 | **Academic Impact** | 0-100 | None (cumulative) | Publishing papers, patents, conference talks, citations | Never decreases — papers are permanent |
| 4 | **Health** | 0-100 | -2/quarter (natural aging) | Rest, travel, exercise, medical spending | Grind Mode (-15/quarter), overwork, stress spillover |
| 5 | **Mental** | 0-100 | -3/quarter (baseline stress from visa/work) | Rest, travel, green card milestones (combo card, GC approval) | Visa uncertainty, PIP, layoff, H1B denial, Grind Mode (-8/quarter) |
| 6 | **Net Worth** | $0-∞ | None (managed by Economy System) | Salary, investment returns, RSU vesting | Living expenses, taxes, medical bills, tuition, housing |

**Net Worth** is technically managed by the Economy System, but stored as an attribute for unified access by the Probability Engine and UI. It has no cap and no natural decay — it is purely the output of economic decisions.

#### Attribute Update Cycle

Each quarter follows this sequence:

1. **Pre-turn**: Display current attribute values to player
2. **Player action**: Player allocates AP (actions modify attributes via deltas)
3. **Natural decay**: Apply per-quarter decay to Performance, Skills, Health, Mental
4. **Event phase**: Random events may apply additional attribute modifiers
5. **Clamp**: Enforce 0-100 bounds on all attributes (except Net Worth)
6. **Post-turn**: Display attribute changes as delta summary (+/-) to player

Attribute changes from actions are **deterministic** (spend AP on work → Performance always goes up by the defined amount). Randomness lives in the Probability Engine which *reads* attributes, not in the attribute changes themselves.

#### Attribute Interactions (Cross-attribute effects)

Some attributes have passive effects on others:

- **Health < 30** → Mental decays an extra -5/quarter (being sick is depressing)
- **Mental < 20** → triggers Burnout event (forced rest, lose 1 quarter of AP)
- **Mental < 30** → Performance gains are halved (can't focus when stressed)
- **Health < 20** → Performance gains are halved (can't work when sick)
- **Grind Mode active** → Health -15, Mental -8, but grants +3 AP and Performance +15

These cross-attribute effects create the core feedback loops:
- **Positive spiral**: Good health → full Mental → full Performance gains → promotion → Mental boost from career progress
- **Death spiral**: Grind Mode → Health drops → sickness → forced rest → Performance drops → PIP risk → Mental drops → worse Performance → deeper hole

### States and Transitions

Attributes themselves are continuous values (0-100), not state machines. However, certain **threshold states** trigger gameplay effects:

| Attribute | Threshold | State | Effect |
|-----------|-----------|-------|--------|
| Health | > 70 | Healthy | No penalties, Grind Mode available |
| Health | 30-70 | Sub-healthy | Sickness probability active: `(100 - health) × 0.6%` per quarter |
| Health | < 30 | Critical | Sickness probability > 42%; Performance/Skills gains halved |
| Health | = 0 | Hospitalized | Forced 1-quarter rest, massive medical bill, Grind Mode locked 3 quarters |
| Mental | > 60 | Stable | No penalties |
| Mental | 30-60 | Stressed | Performance gains reduced by 25% |
| Mental | < 30 | At Risk | Performance gains halved; Burnout event probability 30%/quarter |
| Mental | < 10 | Burnout | Forced rest 1 quarter, all AP lost, Mental resets to 30 |
| Performance | > 80 | Top Performer | Promotion probability bonus +15% |
| Performance | < 30 | Underperforming | PIP probability active |
| Performance | < 15 | PIP | 2-quarter countdown: improve or termination |
| Academic Impact | > 50 | Notable | NIW application unlocked |
| Academic Impact | > 75 | Distinguished | EB1A application unlocked |

### Interactions with Other Systems

| System | Direction | Data Interface |
|--------|-----------|---------------|
| **Probability Engine** | Attribute → Probability | Reads all 6 core attributes + School Ranking modifier to compute event success rates |
| **Action Point System** | Action → Attribute | AP actions produce attribute deltas (e.g., "Work Normal" → Performance +5, Mental -2) |
| **Character Creation** | Creation → Attribute | Constitution → starting Health; School Ranking stored as permanent modifier; Geo Location → Academic Phase bonus |
| **Career System** | Reads Performance, Skills | Promotion probability, PIP trigger, job change eligibility |
| **Immigration System** | Reads Academic Impact, Performance | PERM processing (employer-based), NIW/EB1A eligibility thresholds |
| **Health System** | Reads/Writes Health | Sickness events read Health for probability; sickness consequences write Health deltas |
| **Mental Health System** | Reads/Writes Mental | Stress sources write Mental deltas; Mental thresholds trigger burnout |
| **Economy System** | Reads/Writes Net Worth | Salary/expenses modify Net Worth; Net Worth read for score and housing eligibility |
| **Event System** | Reads all attributes | Events use attribute values as trigger conditions and probability modifiers |
| **Academic Phase** | Reads School Ranking, Geo Location | Intern probability, first job probability |
| **UI Systems** | Reads all attributes | Displays current values, thresholds, and delta changes |

## Formulas

### 1. Creation Attribute Mapping

```
starting_health = 40 + (constitution × 8)
school_modifier = (school_ranking - 2.5) × 4%        // range: -10% to +10%
intern_bonus    = (geo_location - 2.5) × 6%           // range: -15% to +15%
```

| Constitution | Starting Health | School Ranking | Work Roll Modifier | Geo Location | Intern Bonus |
|---|---|---|---|---|---|
| 0 | 40 | 0 | -10% | 0 | -15% |
| 1 | 48 | 1 | -6% | 1 | -9% |
| 2 | 56 | 2 | -2% | 2 | -3% |
| 3 | 64 | 3 | +2% | 3 | +3% |
| 4 | 72 | 4 | +6% | 4 | +9% |
| 5 | 80 | 5 | +10% | 5 | +15% |

### 2. Per-Quarter Natural Decay

```
performance_decay = -3 if no work AP spent this quarter, else 0
skills_decay      = -1
health_decay      = -2 - (age > 40 ? 1 : 0) - (grind_active ? 13 : 0)
mental_decay      = -3 - (visa_insecure ? 3 : 0) - (grind_active ? 5 : 0)
academic_impact_decay = 0  // cumulative, never decays
```

Notes:
- `age > 40`: Health decays 1 extra per quarter (physical aging)
- `visa_insecure`: True when on F1/OPT/H1B (not yet green card or combo card). Mental takes extra -3 from chronic visa anxiety.
- `grind_active`: Grind Mode is the dominant source of Health and Mental drain.

### 3. Cross-Attribute Penalties

```
if health < 30:
    mental_decay_extra = -5          // being sick is depressing
if mental < 30:
    performance_gain_mult = 0.5      // can't focus when stressed
if health < 20:
    performance_gain_mult = 0.5      // can't work when sick
if mental < 30 AND health < 20:
    performance_gain_mult = 0.25     // multiplicative stacking
```

### 4. Sickness Probability (per quarter)

```
age_factor = 1.0 + max(0, (age - 30) × 0.03)
sickness_chance = min(0.8, (100 - health) × 0.004 × age_factor)
```

Reference table:

| Health | Age 25 | Age 35 | Age 45 | Age 55 |
|--------|--------|--------|--------|--------|
| 80 | 5% | 5.6% | 8.4% | 13.2% |
| 50 | 20% | 23% | 32% | 44% |
| 30 | 28% | 32.2% | 44.8% | 61.6% |
| 20 | 32% | 36.8% | 51.2% | 70.4% |

Design intent: Age 25 with health 80 is near-safe (5%). Young players can afford to Grind. By age 45+, health maintenance becomes non-negotiable. Cap at 80% ensures there's always a chance of dodging sickness (luck factor preserved).

### 5. Attribute Clamping

```
for attr in [performance, skills, academic_impact, health, mental]:
    attr = clamp(attr, 0, 100)
// net_worth: no upper bound, floor at 0 (debt not modeled in MVP)
```

### 6. Burnout Probability (per quarter, when Mental < 30)

```
burnout_chance = (30 - mental) × 0.01      // 0% at mental 30, 30% at mental 0
```

When triggered: forced 1-quarter rest, all AP lost, Mental resets to 30.

## Edge Cases

### 1. Multiple attributes hit 0 simultaneously
Health = 0 AND Mental = 0: Hospitalized takes priority (forced rest 1 quarter). Mental resets to 30 during recovery. Both events don't stack — one forced rest resolves both.

### 2. Grind Mode while Health < 30
Allowed but extremely dangerous. Sickness probability already high, Grind decay (-15 health) could push Health to 0 → hospitalization. Game does not block the choice — Pillar 2 says the player bears the consequences.

### 3. Performance at 100 — overflow
Gains above 100 are wasted (clamped). No overflow banking. Incentivizes diversifying AP once Performance is near cap.

### 4. School Ranking 0 permanent -10%
Intentionally punishing. This is the "hard mode" build. Compensated by having 10 points elsewhere (Constitution 5 + Geo 5). The -10% is on every work roll for the entire game — a real permanent handicap, like graduating from an unknown school in real life.

### 5. Net Worth reaches 0
MVP: No debt modeling. Net Worth floors at 0. If expenses exceed income and savings are gone, trigger "financial crisis" event (forced to take any available job, sell house at loss, etc.)

### 6. Academic Impact for non-research careers
SDE/MLE/DE etc. can still accumulate Academic Impact through side projects, open source, patents, and conference talks — but at much higher AP cost than RS roles. Not locked, just expensive.

### 7. Age > 40 health decay + Grind Mode
Total health drain: -2 (base) - 1 (age) - 13 (grind) = -16/quarter. From health 80 to 0 in 5 quarters of sustained grind. Intentional — middle-aged grind has severe consequences.

### 8. Visa becomes secure (green card approved)
`visa_insecure` flag flips to false. Mental natural decay drops by 3/quarter. Immigration System fires a one-time Mental +30 boost event. This should feel like a weight lifted — one of the most emotionally satisfying moments in the game.

### 9. Career change resets
Switching career fields (e.g., SDE → DS) applies a partial Skills reset (Skills × 0.6) representing the learning curve. Performance resets to 50 (new job baseline). Academic Impact is unaffected.

## Dependencies

### Upstream (this system depends on)
None — the Attribute System is a Foundation-layer system with zero dependencies.

### Downstream (systems that depend on this)

| System | Dependency Type | Interface |
|--------|----------------|-----------|
| **Probability Engine** | Hard | Reads all 6 core attributes + school_modifier to compute event probabilities |
| **Action Point System** | Hard | Writes attribute deltas when AP actions are resolved |
| **Character Creation** | Hard | Writes initial attribute values from creation point allocation |
| **Career System** | Hard | Reads Performance (promotion/PIP), Skills (job eligibility) |
| **Immigration System** | Hard | Reads Academic Impact (NIW/EB1A thresholds), Performance (employer standing) |
| **Self-Directed Immigration** | Hard | Reads Academic Impact for application eligibility and success probability |
| **Job Change System** | Hard | Reads Skills (interview success), Performance (current standing) |
| **Health System** | Hard | Reads/writes Health; reads age for sickness formula |
| **Mental Health System** | Hard | Reads/writes Mental; reads visa_insecure flag |
| **Economy System** | Hard | Reads/writes Net Worth |
| **Event System** | Hard | Reads all attributes as trigger conditions and probability modifiers |
| **Academic Phase** | Hard | Reads school_ranking, geo_location for intern/first job probability |
| **All UI Systems** | Hard | Reads all attributes for display |

### Interface Contract

The Attribute System exposes:
- `get(attribute_name) → int` — returns current value (0-100, or uncapped for Net Worth)
- `modify(attribute_name, delta) → int` — applies delta, clamps, returns new value
- `get_modifier(modifier_name) → float` — returns permanent modifiers (school_modifier)
- `get_threshold_state(attribute_name) → string` — returns current threshold state (e.g., "critical", "stressed")
- `get_all() → dict` — snapshot of all attributes for save/display

All writes go through `modify()` which enforces clamping and triggers threshold state recalculation. No system should write attribute values directly.

## Tuning Knobs

| Knob | Default | Safe Range | Too Low | Too High | Affects |
|------|---------|------------|---------|----------|---------|
| `CREATION_POINTS_TOTAL` | 10 | 8-15 | Builds feel samey, no differentiation | Every build is strong, no tradeoff tension | Character Creation |
| `CREATION_ATTR_MAX` | 5 | 3-7 | Forces spread builds, less strategic variety | Extreme min-max, some starts become trivially easy/hard | Character Creation |
| `CONSTITUTION_TO_HEALTH_BASE` | 40 | 30-50 | Constitution 0 starts at dangerously low health | Constitution matters less | Starting conditions |
| `CONSTITUTION_TO_HEALTH_SCALE` | 8 | 5-12 | Constitution matters less, gap narrows | Gap between 0 and 5 too extreme | Starting conditions |
| `SCHOOL_MODIFIER_SCALE` | 4% per point | 2%-6% | School choice feels irrelevant | School dominates all work outcomes | Permanent career modifier |
| `INTERN_BONUS_SCALE` | 6% per point | 3%-10% | Geo location doesn't matter | Geo 0 is nearly unplayable | Academic Phase |
| `PERFORMANCE_DECAY_RATE` | -3/quarter | -1 to -5 | Performance is sticky, less urgency | Must constantly invest AP to not fall behind | Work pressure |
| `SKILLS_DECAY_RATE` | -1/quarter | 0 to -3 | Skills permanent once earned | Constant upskill pressure | Skill maintenance |
| `HEALTH_DECAY_BASE` | -2/quarter | -1 to -4 | Health is easy to maintain | Health requires constant AP investment | Health maintenance cost |
| `HEALTH_DECAY_AGE_THRESHOLD` | 40 | 35-50 | Late-career pressure starts earlier | Players feel safe longer, less mid-game tension | Age curve |
| `MENTAL_DECAY_BASE` | -3/quarter | -1 to -5 | Mental is easy to maintain | Mental constantly drains, game feels punishing | Baseline stress |
| `MENTAL_VISA_INSECURE_PENALTY` | -3/quarter | -1 to -5 | Visa anxiety is mild | Visa pressure dominates mental health | Immigration pressure |
| `GRIND_HEALTH_COST` | -15/quarter | -8 to -20 | Grind Mode is too cheap | Grind Mode is never worth the cost | Risk/reward balance |
| `GRIND_MENTAL_COST` | -8/quarter | -3 to -12 | Grind Mode is too cheap | Grind Mode is never worth the cost | Risk/reward balance |
| `SICKNESS_HEALTH_COEFF` | 0.004 | 0.002-0.008 | Sickness is rare even at low health | Players get sick too frequently | Health system tension |
| `SICKNESS_AGE_COEFF` | 0.03 | 0.01-0.05 | Age has little effect on sickness | Old age becomes unplayable | Late-game difficulty |
| `SICKNESS_CAP` | 0.80 | 0.6-0.95 | Always a realistic chance of getting sick | Near-guaranteed sickness removes player agency | Luck factor |
| `BURNOUT_THRESHOLD` | Mental 30 | 20-40 | Burnout is rare, mental pressure is mild | Burnout is frequent, game feels too punishing | Mental health severity |
| `GC_APPROVAL_MENTAL_BOOST` | +30 | +15 to +50 | Green card approval feels underwhelming | Too much of a reset, removes late-game tension | Emotional payoff |

## Acceptance Criteria

### Functional Tests
1. **Creation points**: Allocating 10 points across 3 attributes (each 0-5) correctly initializes all starting values. Verify: Constitution 5 → Health 80, Constitution 0 → Health 40.
2. **School modifier**: School Ranking 5 adds +10% to a work probability roll; School Ranking 0 subtracts -10%. Verify across multiple Career System calls.
3. **Natural decay**: After a quarter with no actions, Performance drops by 3, Skills by 1, Health by 2, Mental by 3. Verify values are correct.
4. **Clamping**: Attribute cannot go below 0 or above 100. Apply +50 to an attribute at 80; verify result is 100. Apply -50 to attribute at 20; verify result is 0.
5. **Grind Mode costs**: Activating Grind Mode applies -15 Health and -8 Mental per quarter on top of natural decay. Verify cumulative decay is correct.
6. **Cross-attribute penalties**: When Health < 30, Mental decay increases by 5. When Mental < 30, Performance gains are halved. Verify both independently and stacked.
7. **Sickness probability**: At Health 80, Age 25: sickness chance = 5%. At Health 50, Age 45: sickness chance = 32%. Verify formula output matches reference table within ±1%.
8. **Age decay acceleration**: At age 41+, Health decay increases by 1 per quarter. Verify at age 40 (no extra) vs age 41 (extra -1).
9. **Threshold states**: Health dropping below 30 returns "critical" state. Mental dropping below 30 returns "at_risk". Verify state transitions are correct in both directions.
10. **Net Worth uncapped**: Net Worth can exceed 100 and has no upper bound. Verify Net Worth of $2,000,000 stores and retrieves correctly.

### Integration Tests
11. **Action → Attribute → Probability chain**: Spending AP on "Work Normal" increases Performance by expected delta; next quarter's promotion probability reflects the new Performance value.
12. **Death spiral**: Grind Mode for 3 consecutive quarters from Health 60 should result in Health near 0 and trigger hospitalization. Verify the cascade.
13. **Visa security transition**: When green card is approved, verify `visa_insecure` flips to false, Mental decay drops by 3, and one-time +30 Mental boost is applied.

### Balance Tests
14. **No dominant build**: Simulate 100 runs each for builds (5/5/0), (5/0/5), (0/5/5), (3/4/3). No single build should have >70% green card success rate. Verify via automated playthrough.
15. **Grind Mode risk/reward**: Grind Mode should be viable for 2-3 consecutive quarters in youth (age < 30) without high sickness risk, but dangerous for >4 consecutive quarters at any age.

## Open Questions

1. **Should Skills have sub-categories?** Currently Skills is one number, but SDE skills vs DS skills vs MLE skills are different. Should this split when multiple career paths are added? — Resolve at Career System GDD.
2. **Debt modeling**: Net Worth floors at 0 in MVP. Should negative Net Worth (student loans, mortgage underwater) be added in Vertical Slice? — Resolve at Economy System GDD.
3. **Attribute visibility**: Should the player see exact numbers (Performance: 73) or descriptive labels (Performance: Strong)? Exact numbers favor the optimization player type but may feel gamey. — Resolve at UI design phase.
4. **Diminishing returns on gains**: Should Performance gains diminish as Performance approaches 100? (e.g., going from 90→95 is harder than 40→45). Current design uses flat gains. — Playtest to decide.
5. **Marriage/partner effects on attributes**: Out of scope for MVP, but a partner could provide Mental stability bonuses or create new obligations. — Defer to Full Vision.
