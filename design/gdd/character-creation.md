# Character Creation System

> **Status**: In Design
> **Author**: user + game-designer
> **Last Updated**: 2026-03-28
> **Implements Pillar**: Pillar 5 (Learnable Depth), Pillar 2 (Every Choice Costs)

## Overview

The Character Creation System is the game's opening screen — the player distributes 10 points across 3 creation attributes (Constitution, School Ranking, Geographic Location) before the game begins. This single decision shapes the entire run: starting health, permanent career modifier, and intern search probability. There are no "correct" builds — each allocation creates a different strategic landscape with distinct strengths, weaknesses, and risk profiles. Experienced players will develop favorite builds and discover that certain builds synergize with certain career paths and immigration strategies.

## Player Fantasy

The player should feel like they are **defining who they are before the journey begins**. "Am I the sickly genius from MIT? The healthy kid from a no-name school in Ohio? The well-rounded student from a decent school in a good city?" This is the moment of identity creation — and the first taste of Pillar 2, because you can already see you can't have everything. The 10-point budget is tight enough that every point placed is a point denied elsewhere.

For returning players, character creation becomes a meta-strategy layer: "Last run I went 5/5/0 and died in the Academic Phase because I couldn't find an intern. This time I'll try 3/4/3 and see if the balanced build survives." This serves Pillar 5 — knowledge from past runs directly informs build choices.

## Detailed Design

### Core Rules

#### Point Allocation

```
Total points: 10
Attributes: 3 (Constitution, School Ranking, Geographic Location)
Range per attribute: 0-5
Constraint: sum of all three must equal exactly 10
```

This means no attribute can be 0 unless the other two sum to 10 (e.g., 0/5/5). The player cannot leave points unspent.

#### Attribute Definitions

**Constitution (体质) — Range 0-5**

Your physical baseline. Determines starting Health and influences the sickness probability floor for the entire game.

| Value | Starting Health | Sickness Floor Modifier | Flavor |
|-------|----------------|------------------------|--------|
| 0 | 40 | +3% to all sickness checks | Chronically frail — any Grind Mode is a gamble |
| 1 | 48 | +2% | Below average — needs careful health management |
| 2 | 56 | +1% | Average — moderate headroom for Grind |
| 3 | 64 | 0% | Healthy — can sustain occasional Grind quarters |
| 4 | 72 | -1% | Robust — Grind Mode is viable for extended stretches |
| 5 | 80 | -2% | Iron constitution — can absorb significant punishment |

Formula: `starting_health = 40 + (constitution × 8)`
Sickness floor: `constitution_sickness_modifier = (2.5 - constitution) × 1%`

Constitution 5 gives you 40 extra health points over Constitution 0 — that's roughly 2-3 extra quarters of Grind Mode before hitting danger zone. Over 148 turns, this compounds massively.

**School Ranking (学校排名) — Range 0-5**

The prestige of your US graduate program. Applies a **permanent modifier** to every work-related probability roll for the entire game — promotion, job offers, intern search, first job.

| Value | Modifier | Equivalent School Tier |
|-------|----------|----------------------|
| 0 | -10% | Unranked / unknown program |
| 1 | -6% | Low-ranked state school |
| 2 | -2% | Mid-tier university |
| 3 | +2% | Good school (top 50) |
| 4 | +6% | Strong school (top 20) |
| 5 | +10% | Elite (MIT, Stanford, CMU, etc.) |

Formula: `school_modifier = (school_ranking - 2.5) × 4%`

This is the single most impactful long-term attribute. A 20% spread (-10% to +10%) on EVERY work roll across 148 turns is enormous. School 0 players must compensate through raw performance; School 5 players have a permanent tailwind.

**Geographic Location (地理位置) — Range 0-5**

Where your school is located. Affects intern search and first job probability during the Academic Phase. After securing your first job, you can relocate anywhere — the attribute's direct effect ends, but its cascading consequences (got intern or not, quality of first job) persist forever.

| Value | Intern Bonus | Flavor |
|-------|-------------|--------|
| 0 | -15% | Middle of nowhere — almost no tech companies nearby |
| 1 | -9% | Small college town — few opportunities |
| 2 | -3% | Mid-size city — some tech presence |
| 3 | +3% | Growing tech hub (Austin, Denver) |
| 4 | +9% | Strong tech city (Seattle, Boston) |
| 5 | +15% | Bay Area / NYC — surrounded by opportunities |

Formula: `intern_bonus = (geo_location - 2.5) × 6%`

**The Cascade**: Geographic Location 0 means -15% on intern search. No intern means first_job base drops from 40% to 15%. No first job within OPT window means visa expiry → game over. This makes Geo 0 the highest-variance starting condition — you might never make it to the career phase, but if you do, those 5 points are elsewhere helping you long-term.

#### Pre-built Archetypes (Suggested Builds)

For new players, offer named presets they can select or use as starting points:

| Archetype | Constitution | School | Geo | Strategy |
|-----------|-------------|--------|-----|----------|
| **学霸 (Scholar)** | 2 | 5 | 3 | Elite school + decent location. Strong career trajectory, but can't Grind hard. Best for: steady career + company PERM route. |
| **铁人 (Iron Man)** | 5 | 2 | 3 | Can sustain Grind Mode for extended periods. Mediocre school means harder promotions. Best for: out-working everyone through raw stamina. |
| **地头蛇 (Local Advantage)** | 2 | 3 | 5 | Almost guaranteed intern in Bay Area/NYC. Good school helps career. But fragile health. Best for: fast start, early career momentum. |
| **赌徒 (Gambler)** | 0 | 5 | 5 | Max career potential, zero health buffer. Can die from 2 quarters of Grind. One sickness event and you're in a spiral. Best for: experienced players who know how to manage health. |
| **均衡 (Balanced)** | 3 | 4 | 3 | No major weaknesses. Recommended for first playthrough. |
| **自定义 (Custom)** | ? | ? | ? | Full manual allocation. |

#### Creation Flow

```
1. Title screen → "New Game"
2. Display archetype cards with descriptions
3. Player picks archetype OR selects "Custom"
4. If custom: slider/stepper UI for 3 attributes, shared 10-point pool
   - Moving one slider up forces others down
   - Real-time display of derived values (starting health, school modifier, intern bonus)
5. Display build summary with strategy hints:
   - "Starting Health: 64 — can sustain moderate Grind"
   - "School modifier: +6% on all work rolls — strong career advantage"
   - "Intern bonus: +3% — average, prepare well"
6. Confirm → begin Academic Phase turn 1
```

### States and Transitions

Character Creation is a one-time flow with no state machine. Once confirmed, creation attributes are locked and cannot be changed for the run.

```
TITLE_SCREEN → CHARACTER_CREATION → CONFIRM → ACADEMIC_PHASE_START
```

No going back after confirmation. The permanence is part of the design — live with your choices (Pillar 2).

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Attribute System** | Creation → Attributes | Writes starting Health value; stores school_modifier as permanent modifier; stores geo_bonus for Academic Phase |
| **Academic Phase** | Creation → Academic | Geo bonus applied to intern search probability; School modifier applied to all academic rolls |
| **Probability Engine** | Creation → Probability (via Attributes) | school_modifier and constitution_sickness_modifier are permanent modifiers read by Probability Engine |
| **Game Data** | Data → Creation | Archetype definitions, attribute ranges, formula coefficients from `creation.json` |
| **UI** | Creation ↔ UI | Slider/stepper interface, archetype cards, derived value preview |

## Formulas

### Derived Values from Creation Attributes

```
starting_health = 40 + (constitution × 8)                    // 40-80
school_modifier = (school_ranking - 2.5) × 4%                // -10% to +10%
intern_bonus = (geo_location - 2.5) × 6%                     // -15% to +15%
constitution_sickness_modifier = (2.5 - constitution) × 1%   // -2% to +3%
```

### Starting Mental

Mental starting value is fixed at 70 for all builds — everyone starts grad school somewhat stressed but functional. Constitution and school don't affect starting mental.

```
starting_mental = 70
```

### Starting Skills, Performance, Academic Impact

```
starting_skills = 20 + (school_ranking × 4)    // 20-40 — better school = better education
starting_performance = 0                         // not working yet
starting_academic_impact = school_ranking × 2    // 0-10 — elite schools have research exposure
starting_net_worth = 0                           // everyone starts broke (on student loans)
```

### Build Viability Check

No build is mathematically unplayable, but some are extremely punishing:

```
// Geo 0 + School 0 intern probability:
intern_base(30%) + school(-10%) + geo(-15%) + skills_bonus(20 × 0.3% = 6%) = 11%
// Very low but nonzero. With 2-3 quarters of prep, can reach ~31-41%.

// Geo 0 + School 5 intern probability:
intern_base(30%) + school(+10%) + geo(-15%) + skills_bonus(40 × 0.3% = 12%) = 37%
// Manageable — school compensates for location somewhat.
```

## Edge Cases

### 1. All points in one attribute (0/0/10 — impossible)
Maximum per attribute is 5. The hardest valid min-max builds are 0/5/5 or 5/5/0 or 5/0/5. All are legal and playable (though painful in different ways).

### 2. Player spends too long on creation screen
No timer. Let them agonize. The deliberation IS the gameplay of this screen.

### 3. First-time player doesn't understand attributes
Archetype presets with strategy descriptions help. The "均衡 (Balanced)" preset is recommended for first playthrough via visual emphasis.

### 4. Player wants to restart and change build
Must start a new game. No respec. This is intentional — it encourages multiple playthroughs and build experimentation (Pillar 5).

### 5. Constitution 0 + immediate Grind in Academic Phase
Legal but suicidal. Starting Health 40, Grind (Intense Study) costs -10 Health → 28 after one quarter (with decay). Sickness probability: (100-28) × 0.004 × 1.0 + 3% = 31.8%. One unlucky roll and Academic Phase becomes a health crisis. The game does not prevent this — but experienced players know better.

### 6. School 5 but Geo 0
Scholarship at MIT but campus is in... well, MIT is in Boston which should be Geo 4-5. In game fiction: a top-ranked program but in a small college town (e.g., UIUC, Purdue — excellent CS programs but less tech industry nearby). This is a valid and interesting build.

## Dependencies

### Upstream

| System | Dependency Type | Interface Used |
|--------|----------------|----------------|
| **Attribute System** | Hard | `modify()` to set starting attribute values |
| **Game Data** | Hard | Archetype definitions, formula coefficients from `creation.json` |

### Downstream

| System | Dependency Type | Interface |
|--------|----------------|-----------|
| **Attribute System** | Hard | Starting values for Health, Skills, Mental, Academic Impact, Net Worth |
| **Probability Engine** | Hard (via Attributes) | school_modifier and constitution_sickness_modifier as permanent modifiers |
| **Academic Phase** | Hard | geo_bonus for intern search, school_modifier for academic rolls |

### Interface Contract

```
CharacterCreation.get_archetypes() → list[ArchetypeDef]       // preset builds for UI
CharacterCreation.allocate(constitution, school, geo) → bool   // returns false if sum ≠ 10 or out of range
CharacterCreation.confirm() → CreationResult                   // locks build, returns all derived starting values
CharacterCreation.preview(constitution, school, geo) → dict    // returns derived values without confirming (for UI)
```

## Tuning Knobs

| Knob | Default | Safe Range | Too Low | Too High | Affects |
|------|---------|------------|---------|----------|---------|
| `CREATION_TOTAL_POINTS` | 10 | 8-15 | Builds feel samey, forced to spread thin | Every build is strong, no tradeoffs | Build diversity |
| `CREATION_ATTR_MAX` | 5 | 3-7 | Can't specialize enough, builds converge | Extreme specialization possible, some starts trivial/impossible | Min-max range |
| `CONSTITUTION_HEALTH_BASE` | 40 | 30-50 | Constitution 0 is unplayably fragile | Constitution 0 is still comfortable | Constitution importance |
| `CONSTITUTION_HEALTH_SCALE` | 8 per point | 5-12 | Small gap between builds (Constitution less important) | Huge gap (Constitution dominates build decisions) | Health spread |
| `SCHOOL_MODIFIER_SCALE` | 4% per point | 2%-6% | School choice feels minor | School dominates every career roll | School importance |
| `GEO_BONUS_SCALE` | 6% per point | 3%-10% | Location doesn't affect intern search much | Geo 0 is nearly game-ending | Location importance |
| `STARTING_MENTAL` | 70 | 50-80 | Everyone starts stressed (harsh early game) | Everyone starts relaxed (slow ramp) | Early game difficulty |
| `STARTING_SKILLS_BASE` | 20 | 10-30 | Low starting skills, everyone struggles early | High starting skills, school matters less | Skill floor |
| `STARTING_SKILLS_SCHOOL_SCALE` | 4 per point | 2-6 | School gap in starting skills is small | Elite schools massively ahead in skills | School value in early game |
| `CONSTITUTION_SICKNESS_MODIFIER_SCALE` | 1% per point | 0.5%-2% | Constitution barely affects sickness rate | Constitution heavily affects sickness rate | Constitution long-term value |

## Acceptance Criteria

### Functional Tests
1. **Point validation**: Allocate 4/3/3 (sum = 10). Verify accepted. Allocate 4/3/4 (sum = 11). Verify rejected.
2. **Range validation**: Allocate 6/2/2. Verify rejected (max = 5). Allocate 0/5/5. Verify accepted.
3. **Derived values**: Constitution 3, School 4, Geo 3. Verify: Health = 64, school_modifier = +6%, intern_bonus = +3%, starting_skills = 36.
4. **Constitution 0**: Verify starting Health = 40, sickness modifier = +3%.
5. **Constitution 5**: Verify starting Health = 80, sickness modifier = -2%.
6. **Archetypes**: Select "学霸" preset. Verify attributes set to 2/5/3 and all derived values are correct.
7. **Custom build**: Use sliders to set 1/4/5. Verify real-time derived value preview updates.
8. **Confirm lock**: Confirm build. Verify attributes cannot be changed afterward.
9. **Preview without confirm**: Call `preview(3, 4, 3)`. Verify returns correct derived values. Verify no state change.

### Integration Tests
10. **Starting Health propagation**: Confirm build with Constitution 4. Start game. Verify Attribute System reports Health = 72.
11. **School modifier in Probability Engine**: Confirm build with School 5. During Career Phase, verify promotion probability includes +10% school modifier.
12. **Geo bonus in Academic Phase**: Confirm build with Geo 5. Search for intern. Verify probability includes +15% geo bonus.
13. **Constitution sickness modifier**: Confirm build with Constitution 0. Get Health to 50. Verify sickness probability = ((100-50) × 0.004 × age_factor) + 3%, not just (100-50) × 0.004 × age_factor.

### Balance Tests
14. **No unplayable build**: Simulate 1000 runs for each extreme build (0/5/5, 5/0/5, 5/5/0). Verify all have >10% chance of reaching age 59.
15. **No dominant build**: Simulate 1000 runs for each archetype. Verify no archetype has >60% green card rate. Verify score variance exists within each archetype.

## Open Questions

1. **Additional creation attributes**: Should there be a 4th attribute like "Family Wealth" (affects starting Net Worth)? Adds another dimension but dilutes the 10-point tension. — Defer to Alpha.
2. **Difficulty via creation points**: Hard mode = 8 points, Easy mode = 12 points? Simple difficulty slider. — Playtest after MVP.
3. **Background story**: Should each archetype come with a short narrative intro? ("You graduated from a small university in the midwest...") Adds flavor but costs content budget. — Defer to Vertical Slice.
4. **Unlockable archetypes**: After completing the game with certain achievements, unlock new preset builds? (e.g., "留学二代" — starts with better Network if we ever add that attribute). — Defer to Full Vision.
