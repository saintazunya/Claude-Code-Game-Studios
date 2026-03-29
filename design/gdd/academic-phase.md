# Academic Phase System

> **Status**: In Design
> **Author**: user + game-designer
> **Last Updated**: 2026-03-28
> **Implements Pillar**: Pillar 2 (Every Choice Costs), Pillar 5 (Learnable Depth)

## Overview

The Academic Phase is the game's prologue — turns 1-8 (Master's) or 1-16 (PhD). It operates as a distinct game mode within the Turn Manager where the player navigates graduate school: maintaining GPA, searching for internships, building skills, and making the critical PhD decision. The Academic Phase introduces game systems gradually (no immigration actions, no full career system) while establishing the cascading consequences that define the rest of the game. The intern outcome and PhD choice made here ripple through all 148 turns.

The world does NOT pause during the Academic Phase — the Economic Cycle runs, market prices move, and immigration policy shifts happen. A player who starts grad school during a recession faces a brutal intern market. A player who chooses PhD may emerge into a completely different economy than when they enrolled.

## Player Fantasy

The player should feel the **optimistic anxiety of a fresh-off-the-plane grad student** — everything is new, the stakes aren't fully visible yet, but the decisions made now will echo for decades. Getting that first FAANG internship should feel like a breakthrough. Failing to find an intern should feel like the ground shifting under your feet.

## Detailed Design

### Core Rules

#### Academic Phase Timeline
```
Master's Track: Turns 1-8 (8 quarters, 2 years)
  - Turns 1-4: First year (coursework focus)
  - Turns 5-7: Second year (intern search + job search)
  - Turn 8: Graduation → PhD decision point → Career Phase

PhD Track: Turns 1-16 (16 quarters, 4 years additional)
  - Turns 1-8: Same as Master's
  - Turn 8: Player chooses PhD instead of graduating
  - Turns 9-16: PhD research (thesis work, publications, teaching)
  - Turn 16: PhD graduation → Career Phase
```

#### Academic Work Modes (replaces career work modes)

| Mode | AP Cost | Effects | Risk |
|------|---------|---------|------|
| **轻松 (Light)** | 2 | GPA +0.05, Skills +2, Mental +3 | Low output, more AP for other activities |
| **正常 (Normal)** | 4 | GPA +0.15, Skills +5, Mental -2 | Balanced |
| **拼命 (Intense)** | 6 | GPA +0.30, Skills +8, Mental -8, Health -10, +3 bonus AP | Academic equivalent of Grind Mode |

#### Academic-Specific Attributes
- **GPA**: Tracked during Academic Phase only. Range 2.0-4.0. Starting value 3.0. Affects intern search and first job probability.
- GPA is displayed to player but is NOT one of the 6 core attributes — it folds into Skills and school reputation effects at graduation.

#### Available Actions (Academic Phase)

| Action | AP Cost | Effects | Available |
|--------|---------|---------|-----------|
| Study GPA | 3 | GPA +0.20 | Always |
| Search for Intern | 3 | Triggers intern probability roll | Turns 3-7 (intern season) |
| Networking / Career Fair | 2 | Skills +3, +5% to next intern/job roll | Always |
| Thesis Research (PhD) | 4 | Academic Impact +8, PhD progress | PhD track, turns 9-16 |
| TA/RA Work (PhD) | 2 | Net Worth +$3,000/quarter (stipend), Skills +2 | PhD track |
| Side Project | 3 | Skills +6, Academic Impact +2 | Always |
| Rest | 2 | Health +10, Mental +8 | Always |
| Exercise | 1 | Health +5, Mental +3 | Always |

#### Intern Search

Intern search is the Academic Phase's highest-stakes probability roll:

```
intern_probability = INTERN_BASE (0.30)
                   + school_modifier                    // -10% to +10%
                   + geo_bonus                          // -15% to +15%
                   + skills × 0.003                     // skill contribution
                   + gpa_bonus                          // (GPA - 3.0) × 10%
                   + networking_bonus                   // +5% per networking action
                   + economic_cycle_modifier             // boom +10%, recession -10%

intern_probability = clamp(intern_probability, 0.05, 0.90)
```

**Intern outcomes:**
- **No intern by end of turn 7**: first_job base drops from 0.40 to 0.15. Severe disadvantage.
- **Intern at mid-tier company**: first_job base stays at 0.40. Normal start.
- **Intern at top company**: first_job base increases to 0.55. +15% return offer probability. Possible higher starting level (L4 instead of L3).

#### First Job Search

Triggered at graduation (turn 8 for Master's, turn 16 for PhD):

```
first_job_probability = FIRST_JOB_BASE
                      + school_modifier
                      + skills × 0.003
                      + has_intern_bonus                  // +25% if had intern, or -25% if no intern (base drops)
                      + intern_quality_bonus               // +15% if top-tier intern
                      + economic_cycle_modifier
                      + networking_bonus

// If had intern with return offer: 60-75% chance of return offer (bypasses search)
```

If first job search fails:
- OPT 90-day unemployment clock starts ticking
- Player gets 3 more quarters of OPT to find a job
- Each quarter can re-roll job search
- If still unemployed when OPT expires (and no STEM extension): must leave → game over

#### PhD Decision Point (Turn 8)

At the end of turn 8 (Master's completion), the player faces the game's first major fork:

```
Option A: Graduate and enter Career Phase
  - Start working immediately
  - Earlier salary, earlier PERM, more career turns remaining
  - Lower Academic Impact (harder to self-petition NIW/EB1A)

Option B: Continue to PhD (4 more years)
  - Academic Impact accumulates significantly (+8/quarter from thesis)
  - TA/RA stipend (low income but covers basic expenses, lower student debt)
  - PhD graduates enter at L4 (not L3) with higher starting salary
  - BUT: 8 fewer career turns, enter job market later
  - World keeps moving: economy may boom or crash during PhD years
  - If recession hits during PhD year 4: brutal job market at graduation
```

The decision is presented with current economic cycle state visible but future unpredictable — just like real life.

#### PhD-Specific Mechanics (Turns 9-16)
- **Thesis Progress**: Must accumulate enough thesis work to graduate. Minimum 5 Thesis Research actions across 8 quarters.
- **Publications**: Each Thesis Research action has 40% chance of producing a publication (Academic Impact +5 bonus on top of base +8).
- **Advisor**: Randomly assigned (similar to boss system). Supportive advisor: Mental +2/quarter, extra publications. Demanding advisor: Mental -3/quarter, faster thesis. Absent advisor: no Mental effect, slower thesis but more freedom.
- **PhD stipend**: $6,000-8,000/quarter (TA/RA). Covers basic expenses. Much less student debt at graduation.

### States and Transitions

```
MASTER_YEAR_1 (turns 1-4) → MASTER_YEAR_2 (turns 5-8) → PHD_DECISION
  PHD_DECISION → CAREER_PHASE (Master's graduate)
  PHD_DECISION → PHD_PHASE (turns 9-16) → CAREER_PHASE (PhD graduate)
```

#### Graduation Outputs (fed into Career Phase)

| Attribute | Master's Graduate | PhD Graduate |
|-----------|------------------|-------------|
| Starting Level | L3 | L4 |
| Skills | Current Skills value | Current Skills value (higher from 4 extra years) |
| Academic Impact | Current AI (likely 0-15) | Current AI (likely 40-70, strong NIW/EB1A candidate) |
| Student Debt | ~$50,000 | ~$20,000 (stipend covered most) |
| Age at career start | 24 | 28 |
| Remaining career turns | 140 | 124 |

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Turn Manager** | TM ↔ Academic | TM operates in academic mode for turns 1-8/16; triggers PhD decision at turn 8 |
| **Attribute System** | Academic → Attributes | Writes Skills, Academic Impact, Health, Mental deltas |
| **Action Point System** | Academic ↔ AP | Academic work modes replace career work modes; academic actions available |
| **Probability Engine** | Academic → Probability | Rolls for intern_search, first_job |
| **Economic Cycle** | Cycle → Academic | Recession affects intern availability; market conditions at graduation |
| **Character Creation** | Creation → Academic | School Ranking and Geo Location directly affect intern/job probability |
| **Economy System** | Academic → Economy | Student loan accumulation; PhD stipend; no real salary |
| **Career System** | Academic → Career | Graduation outputs (level, skills, AI) feed into Career Phase start |
| **Immigration System** | Academic → Immigration | F1 status throughout; OPT activation at graduation |

## Formulas

### GPA Model
```
starting_gpa = 3.0
gpa_delta = study_mode_gain + study_action_gain
// Light: +0.05/quarter, Normal: +0.15/quarter, Intense: +0.30/quarter
// Study GPA action: +0.20
// Clamped to [2.0, 4.0]
gpa_bonus_for_intern = (gpa - 3.0) × 0.10  // -10% at 2.0, +10% at 4.0
```

### PhD Thesis Progress
```
thesis_points = 0 at PhD start
thesis_research_action = +1 thesis point + Academic Impact +8
required_thesis_points = 5 (out of 8 possible quarters)
publication_roll = 0.40 per thesis action → Academic Impact +5 bonus if successful
```

### PhD vs Master's Expected Outcomes (age 35)

```
Master's (11 career years by age 35):
  - Salary: L5 level ($220K-$350K range)
  - Net Worth: $200K-$600K (depending on market + savings rate)
  - Academic Impact: 0-20 (only if side-projected)
  - GC status: PERM likely filed, I-140 possibly approved

PhD (7 career years by age 35):
  - Salary: L5 level ($220K-$350K — entered at L4, faster initial promotion)
  - Net Worth: $100K-$400K (fewer earning years)
  - Academic Impact: 50-80 (strong NIW/EB1A candidate)
  - GC status: May have filed EB1A (no queue!) or NIW, possibly already approved
```

## Edge Cases

### 1. Failed intern search all attempts
Player searched turns 3-7 (5 attempts, each with separate rolls). All failed. First job base drops to 0.15. Possible early game over if first job also fails during OPT period. This is the Geo 0 nightmare scenario.

### 2. PhD student runs out of thesis points
If player spends all PhD quarters on non-thesis actions (rest, networking, side projects) and has < 5 thesis points at turn 16: forced thesis extension (+2 quarters, delaying career start further). Rare but punishing.

### 3. Economic recession starts during PhD year 3
Player committed to PhD, can't leave early. Graduation into a recession means brutal first job market. The player can see the recession unfolding but can't act on it career-wise. Maximum "world doesn't wait" energy.

### 4. Intense study mode all 8 quarters (Master's)
GPA maxes out at 4.0 quickly. Health tanks from -10/quarter. Player may get sick during intern season and miss the search window. Academic Grind has the same risks as career Grind.

### 5. PhD with Absent advisor + never does thesis
If player never takes Thesis Research action during PhD: no thesis points, no publications, no Academic Impact gains from thesis (though other sources still work). At turn 16: forced extension. Wasted 4 years.

## Tuning Knobs

| Knob | Default | Safe Range | Affects |
|------|---------|------------|---------|
| `INTERN_BASE_PROBABILITY` | 0.30 | 0.20-0.45 | Overall intern difficulty |
| `FIRST_JOB_BASE` | 0.40 | 0.25-0.55 | First job difficulty |
| `NO_INTERN_FIRST_JOB_BASE` | 0.15 | 0.05-0.25 | No-intern penalty severity |
| `INTERN_BONUS_TO_FIRST_JOB` | +0.25 | +0.15 to +0.35 | Intern value |
| `PHD_STARTING_LEVEL` | L4 | L3-L5 | PhD career advantage |
| `PHD_THESIS_REQUIRED` | 5 | 3-7 | PhD thesis workload |
| `PHD_PUBLICATION_CHANCE` | 0.40 | 0.25-0.60 | Academic Impact accumulation speed |
| `PHD_STIPEND_QUARTERLY` | $7,000 | $5K-$10K | PhD financial comfort |
| `MASTER_STUDENT_DEBT` | $50,000 | $30K-$80K | Post-graduation financial burden |
| `PHD_STUDENT_DEBT` | $20,000 | $0-$40K | PhD financial advantage |
| `GPA_STARTING` | 3.0 | 2.5-3.5 | Starting academic position |

## Acceptance Criteria

### Functional Tests
1. **Master's timeline**: Start game. Verify Academic Phase lasts 8 turns, then transitions to Career Phase.
2. **PhD timeline**: Choose PhD at turn 8. Verify Academic Phase extends to turn 16.
3. **GPA tracking**: Use Normal study mode for 4 quarters + Study GPA action twice. Verify GPA = 3.0 + (0.15×4) + (0.20×2) = 4.0 (capped).
4. **Intern probability**: School 4, Geo 4, Skills 30, GPA 3.5, normal economy. Calculate expected probability. Verify correct.
5. **No intern cascade**: Fail all intern searches. Verify first_job base = 0.15.
6. **PhD Academic Impact**: Take Thesis Research 6 times during PhD. Verify Academic Impact ≥ 48 (6×8) + publication bonuses.
7. **PhD thesis minimum**: Complete PhD with exactly 5 thesis actions. Verify graduation proceeds normally.
8. **PhD thesis failure**: Complete PhD with only 3 thesis actions. Verify forced extension.
9. **PhD graduation outputs**: Graduate PhD. Verify starting level L4, low student debt, high Academic Impact.
10. **Economic cycle during academic**: Start game during recession. Verify intern search probability reduced by 10%.

### Integration Tests
11. **Character Creation → Academic**: Create character with Geo 0. Search for intern. Verify -15% penalty applied.
12. **Academic → Career transition**: Graduate Master's. Verify Career Phase starts, work modes change, immigration actions unlock.
13. **Academic → Immigration**: Graduate. Verify OPT status activated with countdown.
14. **Recession at PhD graduation**: Set economic cycle to recession at turn 16. Verify first job probability heavily reduced.
