# Probability Engine

> **Status**: In Design
> **Author**: user + game-designer
> **Last Updated**: 2026-03-28
> **Implements Pillar**: Pillar 5 (Learnable Depth), Pillar 2 (Every Choice Costs)

## Overview

The Probability Engine is the universal resolver for all non-deterministic events in the game. It takes attribute values from the Attribute System, applies modifiers (permanent like School Ranking, situational like Economic Cycle), computes a final success probability, and executes a roll. Every gameplay system that needs a "will this succeed?" answer calls the Probability Engine rather than implementing its own random logic. This centralizes all randomness, making the game easier to balance, debug, and tune.

The engine is invisible infrastructure — the player never sees "Probability Engine" in the UI. They see "Promotion chance: 45%" on a career action, which is the engine's output formatted by the UI.

## Player Fantasy

The player should feel that **the system is fair but unpredictable**. When they invest AP to raise Performance and see promotion odds go from 20% to 45%, that feedback loop is satisfying. When they still fail at 45%, it stings — but they understand why. When they succeed at 15% on a longshot H1B lottery, the relief is enormous.

The Probability Engine serves Pillar 5 (Learnable Depth) by making odds **visible and learnable** — players who understand which attributes feed which probabilities can optimize their builds. It serves Pillar 2 (Every Choice Costs) by ensuring nothing is guaranteed — even the best preparation can fail, forcing players to always have backup plans.

## Detailed Design

### Core Rules

#### Roll Resolution

Every probability check follows the same pipeline:

```
1. Identify the event type (promotion, job_change, h1b_lottery, sickness, etc.)
2. Look up the base probability for that event type (from Game Data)
3. Gather relevant attribute values from Attribute System
4. Apply attribute-based modifiers (additive)
5. Apply permanent modifiers (School Ranking — additive)
6. Apply situational modifiers (Economic Cycle, visa status — additive)
7. Clamp final probability to [FLOOR, CAP] range
8. Roll: generate random float 0.0-1.0, compare to final probability
9. Return result + final probability used (for UI display and logging)
```

#### Event Type Registry

Each event type defines:
- `base_probability`: starting chance before any modifiers
- `attribute_weights`: which attributes affect this event and by how much
- `modifier_slots`: which situational modifiers apply
- `floor`: minimum probability (0% unless specified — some events can be impossible)
- `cap`: maximum probability (prevents 100% certainty — preserves tension)

Example event type definition:
```
promotion = {
    base: 0.15,
    attributes: {
        performance: { weight: 0.004, source: "performance" },  // +0.4% per point
        skills: { weight: 0.001, source: "skills" },            // +0.1% per point
    },
    modifiers: ["school_ranking", "economic_cycle"],
    floor: 0.02,
    cap: 0.85
}
```

#### Modifier Stacking

All modifiers are **additive** to keep the system transparent and predictable:

```
final_probability = clamp(
    base + Σ(attribute × weight) + Σ(modifiers),
    floor,
    cap
)
```

Additive stacking means: +10% from Performance + 10% from School Ranking = +20% total. No multiplicative surprises. Players can mentally calculate "I need X more Performance to reach Y% odds."

#### Probability Display

The engine provides a `preview(event_type) → float` method that computes the probability without rolling. This powers the UI — players see their current odds before committing to an action. Transparency is a core design principle: **no hidden rolls**.

### States and Transitions

The Probability Engine is stateless — it performs pure calculations with no internal memory. Each call is independent. The "state" lives in the Attribute System and modifier sources (Economic Cycle, visa status).

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Attribute System** | Engine ← Attributes | `get(attr)` to read attribute values; `get_modifier("school")` for permanent modifiers |
| **Economic Cycle** | Engine ← Cycle | `get_cycle_modifier(event_type)` — returns +/- modifier for current economic phase |
| **Career System** | Career → Engine | Calls `roll("promotion")`, `roll("pip")`, `preview("promotion")` |
| **Immigration System** | Immigration → Engine | Calls `roll("h1b_lottery")`, `roll("perm_approval")`, `roll("i140_approval")` |
| **Job Change System** | Job Change → Engine | Calls `roll("job_offer")`, `preview("job_offer")` |
| **Health System** | Health → Engine | Calls `roll("sickness")` using formula from Attribute System GDD |
| **Mental Health System** | Mental → Engine | Calls `roll("burnout")` |
| **Academic Phase** | Academic → Engine | Calls `roll("intern_search")`, `roll("first_job")` |
| **Event System** | Events → Engine | Calls `roll(event_specific_type)` for event-triggered probability checks |
| **UI Systems** | UI ← Engine | Calls `preview(event_type)` to display odds to player before decisions |

## Formulas

### General Roll Formula

```
final_prob = base_probability
           + Σ(attribute_value × attribute_weight)
           + school_modifier                          // from Attribute System: -10% to +10%
           + economic_cycle_modifier                  // from Economic Cycle: varies by event
           + situational_modifiers                    // event-specific bonuses/penalties

final_prob = clamp(final_prob, event.floor, event.cap)

success = (random(0.0, 1.0) < final_prob)
```

### Event Type Definitions (MVP)

| Event Type | Base | Primary Attribute | Weight | Floor | Cap | Notes |
|-----------|------|-------------------|--------|-------|-----|-------|
| `promotion` | 0.15 | Performance | +0.4%/pt | 0.02 | 0.85 | Annual Q4 review. Skills adds +0.1%/pt. Level-dependent: base drops at higher levels (L5→L6: base 0.08, L6→L7: base 0.03) |
| `pip` | 0.05 | Performance (inverse) | -0.3%/pt (higher perf = lower risk) | 0.01 | 0.60 | Triggered when Performance < 30. Consecutive 躺平 quarters add +10% each |
| `h1b_lottery` | 0.27 | None | N/A | 0.27 | 0.27 | Pure lottery — no attribute affects this. Fixed 27% based on real odds. |
| `perm_approval` | 0.70 | None | N/A | 0.30 | 0.90 | Mostly procedural, but economic recession adds -20%. Audit chance separate roll. |
| `perm_audit` | 0.10 | None | N/A | 0.05 | 0.30 | Higher during recession (+15%). Audit delays PERM by 2-6 quarters. |
| `i140_approval` | 0.85 | Performance | +0.1%/pt | 0.50 | 0.95 | Usually approved if PERM passed. Weak attribute effect. |
| `niw_approval` | 0.10 | Academic Impact | +0.8%/pt | 0.02 | 0.80 | Heavy Academic Impact dependency. Threshold: AI < 50 almost impossible. |
| `eb1a_approval` | 0.05 | Academic Impact | +0.9%/pt | 0.01 | 0.75 | Hardest immigration route. AI > 75 needed for reasonable odds. |
| `sickness` | 0.00 | Health (inverse) | (100-health)×0.004 | 0.00 | 0.80 | Uses age_factor from Attribute System GDD. Not a standard roll — custom formula. |
| `burnout` | 0.00 | Mental (inverse) | (30-mental)×0.01 | 0.00 | 0.30 | Only checked when Mental < 30. |
| `intern_search` | 0.30 | Skills | +0.3%/pt | 0.05 | 0.90 | geo_location bonus applies (+/-15%). School modifier applies. |
| `first_job` | 0.40 | Skills | +0.3%/pt | 0.05 | 0.90 | Has_intern bonus: +25%. School modifier applies. No intern → base drops to 0.15. |
| `job_offer` | 0.20 | Skills | +0.3%/pt | 0.03 | 0.85 | Preparation quarters add +10% each (max +20%). School modifier applies. Economic recession: -15%. |
| `layoff` | 0.05 | Performance (inverse) | -0.2%/pt | 0.01 | 0.40 | Economic recession: base jumps to 0.15. Low performers first. |
| `i485_noid` | 0.00 | None | N/A | 0.00 | 0.80 | Only checked when I-485 pending + unemployed 2+ quarters. Prob = 0.15 + (unemployment_quarters - 1) × 0.12. 1 quarter grace period, then escalating risk. NOID gives 1 quarter to respond with employment. |

### Economic Cycle Modifiers

| Event Type | Boom | Normal | Recession | Recovery |
|-----------|------|--------|-----------|----------|
| `promotion` | +5% | 0% | -10% | 0% |
| `pip` | -3% | 0% | +10% | +3% |
| `job_offer` | +10% | 0% | -15% | +5% |
| `layoff` | -3% | 0% | +10% | 0% |
| `perm_approval` | +5% | 0% | -20% | -5% |
| `perm_audit` | -3% | 0% | +15% | +5% |
| `intern_search` | +10% | 0% | -10% | +5% |
| `first_job` | +10% | 0% | -15% | +5% |

### H1B Lottery — Special Case

The H1B lottery is the **only event with no attribute influence**. It is a pure 27% random chance reflecting the real lottery system. No amount of skill, preparation, or networking changes the odds. This is intentional — it's the single most frustrating and authentic mechanic in the game. The player's only strategic lever is having backup plans ready.

## Edge Cases

### 1. Probability exceeds cap
Clamped to cap value. Even a perfect character cannot achieve 100% promotion. Preserves uncertainty per Pillar 4 (Emergent Stories).

### 2. Probability below floor
Clamped to floor value. Even the worst situation has a nonzero chance of success (except where floor = 0.00, like sickness at health 100). Preserves hope.

### 3. Multiple rolls in the same quarter
Each roll is independent. Getting sick (Health roll) and getting laid off (layoff roll) in the same quarter is possible if both probabilities are high. This is intentional — bad luck compounds, just like in real life.

### 4. Preview differs from actual roll
The preview shows the probability at preview time. If an event fires between preview and roll that changes attributes, the actual roll uses updated values. Edge case: player previews promotion at 45%, a sickness event fires mid-quarter dropping Performance, actual roll uses 38%. Solution: UI should note "odds may change based on events this quarter."

### 5. H1B lottery with 0 preparation
If the player didn't spend AP on H1B preparation, the lottery cannot be entered. The 27% only applies if the application was filed. No AP spent = 0% (not rolled at all).

### 6. Economic cycle changes mid-event
Economic cycle transitions happen at quarter boundaries, not mid-quarter. All rolls within a quarter use the same cycle state. No mid-roll cycle changes.

### 7. Stacking school modifier on already-capped probability
School modifier is applied before clamping. If base + attributes = 82% and school adds +10% = 92%, but cap is 85%, result is 85%. The excess is wasted. Players cannot bypass caps.

## Dependencies

### Upstream (this system depends on)

| System | Dependency Type | Interface Used |
|--------|----------------|----------------|
| **Attribute System** | Hard | `get(attr)` for attribute values, `get_modifier("school")` for permanent modifier |
| **Economic Cycle System** | Hard | `get_cycle_modifier(event_type)` for situational modifier |
| **Game Data System** | Hard | Event type definitions (base probability, weights, floors, caps) loaded from config |

### Downstream (systems that depend on this)

All gameplay systems that resolve non-deterministic outcomes: Career, Immigration, Job Change, Health, Mental Health, Academic Phase, Event System. See Interactions table above.

### Interface Contract

The Probability Engine exposes:
- `preview(event_type, overrides?) → float` — compute probability without rolling. Optional overrides dict to simulate "what if" scenarios.
- `roll(event_type) → { success: bool, probability: float, roll_value: float }` — execute the full pipeline and return result with metadata for logging/display.
- `get_event_breakdown(event_type) → { base, attribute_contributions, modifiers, final }` — detailed breakdown for UI tooltip ("Base 15% + Performance 32% + School +6% - Recession -10% = 43%")

## Tuning Knobs

| Knob | Default | Safe Range | Too Low | Too High | Affects |
|------|---------|------------|---------|----------|---------|
| `H1B_LOTTERY_RATE` | 0.27 | 0.15-0.40 | H1B feels impossible, discourages play | H1B is trivial, removes tension | H1B drama |
| `PROMOTION_BASE` | 0.15 | 0.08-0.25 | Promotion feels impossible without extreme stats | Promotion is too easy, career progresses too fast | Career pacing |
| `PROMOTION_PERF_WEIGHT` | 0.004 | 0.002-0.008 | Performance matters less, feels random | Performance dominates, high-perf guarantees promotion | Skill vs luck balance |
| `PROMOTION_CAP` | 0.85 | 0.70-0.95 | Even perfect characters feel uncertain (may be too frustrating) | Near-guaranteed with high stats (removes tension) | Ceiling on player agency |
| `JOB_OFFER_PREP_BONUS` | 0.10/quarter | 0.05-0.15 | Preparation feels unrewarding | One quarter of prep is enough (too easy) | Preparation investment value |
| `RECESSION_LAYOFF_BASE` | 0.15 | 0.08-0.25 | Recessions feel mild | Recessions feel devastating (may be too punishing) | Economic drama |
| `NO_INTERN_FIRST_JOB_BASE` | 0.15 | 0.05-0.25 | No intern = almost guaranteed game over | No intern penalty is mild, Geo Location doesn't matter | Cascading consequence severity |
| `FIRST_JOB_INTERN_BONUS` | 0.25 | 0.15-0.35 | Intern matters less | Intern nearly guarantees first job | Intern value |
| `NIW_ACADEMIC_WEIGHT` | 0.008 | 0.004-0.012 | NIW requires extreme Academic Impact | NIW is achievable with moderate academic effort | Self-directed immigration viability |
| `GLOBAL_FLOOR` | varies | 0.00-0.05 | Some events truly impossible (may frustrate) | Always a miracle chance (may feel unrealistic) | Hope factor |

## Acceptance Criteria

### Functional Tests
1. **Standard roll pipeline**: For event type "promotion" with Performance 60, Skills 40, School 4: verify final probability = 0.15 + (60×0.004) + (40×0.001) + 0.06 = 0.15 + 0.24 + 0.04 + 0.06 = 0.49. Clamped within [0.02, 0.85] = 0.49.
2. **Clamping**: Create a scenario where raw probability exceeds cap. Verify clamped to cap. Create a scenario below floor. Verify clamped to floor.
3. **H1B is attribute-independent**: Verify H1B lottery returns exactly 27% regardless of any attribute values.
4. **Economic cycle modifiers**: In recession, verify job_offer probability includes -15% modifier. In boom, verify +10%.
5. **Preview matches roll probability**: Call `preview()` then `roll()` with no intervening state changes. Verify both return the same probability value.
6. **Breakdown accuracy**: Call `get_event_breakdown()` and verify all components sum to the final probability (before clamping).
7. **No intern penalty**: Verify `first_job` base drops from 0.40 to 0.15 when has_intern = false.

### Statistical Tests
8. **Distribution validation**: Execute 10,000 rolls at 50% probability. Verify success rate is 50% ± 2%.
9. **Cap enforcement over many rolls**: Execute 10,000 rolls at raw probability 120% (exceeds cap 85%). Verify success rate converges to 85% ± 2%.
10. **Floor enforcement**: Execute 10,000 rolls at raw probability -5% (below floor 2%). Verify success rate converges to 2% ± 1%.

### Integration Tests
11. **Attribute change → probability change**: Increase Performance by 20 points, verify promotion preview increases by ~8% (20 × 0.004).
12. **School modifier applied**: Compare promotion preview for School Ranking 0 vs 5. Verify ~20% difference.
13. **Economic cycle transition**: Transition from Normal to Recession mid-game. Verify all affected event probabilities shift by their recession modifiers.

## Open Questions

1. **Weighted random vs pure random**: Should the engine use weighted random (pseudo-random distribution that prevents long streaks of failure)? Pure random is more authentic but can create frustrating 5x H1B failure streaks. — Playtest to decide.
2. **Critical success / critical failure**: Should extreme rolls (top/bottom 5%) have bonus effects beyond pass/fail? E.g., promotion critical success = skip a level. — Defer to Career System GDD.
3. **Player-visible probability breakdown**: Should the UI show the full `get_event_breakdown()` (Base 15% + Performance 32% + School +6% = 53%) or just the final number? Full breakdown is more learnable but more complex UI. — Resolve at UI design phase.
4. **Seed control for replays**: Should the player be able to set a random seed for repeatable runs? Useful for strategy sharing ("try seed 42, it's brutal"). — Defer to Full Vision.
