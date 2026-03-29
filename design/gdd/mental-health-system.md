# Mental Health System

> **Status**: In Design
> **Author**: user + game-designer
> **Last Updated**: 2026-03-28
> **Implements Pillar**: Pillar 1 (Authenticity First), Pillar 2 (Every Choice Costs)

## Overview

The Mental Health System tracks the player's psychological well-being through the Mental attribute (0-100). Unlike Health (which is primarily about Grind Mode costs), Mental is driven by **systemic stressors that the player often cannot control** — visa uncertainty, work pressure from demanding bosses, PIP anxiety, H1B lottery results, priority date retrogression, and the chronic baseline stress of being an immigrant. Mental affects Performance gains (stressed workers are less productive), triggers Burnout at critically low levels, and interacts with Health through the cross-attribute penalty (low Health → extra Mental drain).

The Mental Health System is the game's emotional barometer — it translates the immigration experience into a mechanical pressure that the player must actively manage or suffer cascading consequences.

## Player Fantasy

The player should feel the **invisible weight that every immigrant carries**. The -3 Mental per quarter from `visa_insecure` is small but relentless — a background hum of anxiety that never stops until green card or combo card. When H1B gets denied: Mental crashes. When green card is approved: Mental surges. The system makes the emotional journey visible and mechanically meaningful.

## Detailed Design

### Core Rules

#### Mental Attribute
- Range: 0-100
- Starting value: 70 (everyone starts grad school somewhat stressed)
- Natural decay: -3/quarter (baseline life stress)
- Visa insecurity drain: -3/quarter (when on F1/OPT/H1B, not on combo card or GC)
- Grind Mode drain: -8/quarter
- Boss drain: -3 to -5/quarter (demanding/toxic boss)

#### Mental Threshold Effects

| Threshold | State | Gameplay Effect |
|-----------|-------|----------------|
| Mental > 60 | **Stable** | No penalties. Full Performance gains. |
| Mental 30-60 | **Stressed** | Performance gains reduced by 25%. UI shows stress indicator. |
| Mental 10-30 | **At Risk** | Performance gains halved. Burnout probability active: `(30 - mental) × 0.01` per quarter. |
| Mental < 10 | **Burnout** | Forced rest 1 quarter (all AP lost). Mental resets to 30. Grind locked 2 quarters. |

#### Burnout Mechanics
```
if mental < 30:
    burnout_chance = (30 - mental) × 0.01   // 0% at 30, 30% at 0
    if Probability Engine roll("burnout"):
        trigger Burnout Event:
            - All AP lost this quarter (or next, if mid-resolution)
            - Mental resets to 30
            - Grind Mode locked for 2 quarters
            - Performance -10 (work suffered during breakdown)
            - Economy: possible $2,000-5,000 therapy/medical costs
```

#### Mental Boost Events (positive)

| Event | Mental Change | Trigger |
|-------|-------------|---------|
| Promotion | +15 | Career System: promotion approved |
| H1B approved | +20 | Immigration: H1B lottery success |
| Combo card issued | +20 | Immigration: I-485 filed, EAD/AP received |
| Green card approved | +30 | Immigration: I-485 approved |
| New job (voluntary) | +10 | Career: accepted job offer |
| Travel/Vacation | +25 | Action Point: Travel action |
| Rest | +8 | Action Point: Rest action |
| Therapist | +12 | Action Point: See Therapist action ($800) |

#### Mental Drain Events (negative)

| Event | Mental Change | Trigger |
|-------|-------------|---------|
| H1B lottery denied | -20 | Immigration: lottery failed |
| Laid off | -25 | Career: layoff event |
| PIP started | -20 | Career: entered PIP |
| Priority date retrogression | -15 | Immigration: date moved backward |
| NOID received | -25 | Immigration: I-485 NOID |
| Sickness (any) | -5 to -20 | Health System: severity-dependent |
| Toxic boss (ongoing) | -5/quarter | Career: boss type = toxic |
| Demanding boss (ongoing) | -3/quarter | Career: boss type = demanding |
| Underwater mortgage | -5/quarter | Economy: home value < mortgage |
| Failed promotion (2+ consecutive) | -10 | Career: denied promotion again |
| PERM voided (job change/layoff) | -15 | Immigration: PERM reset |

#### Recovery Actions
| Action | AP Cost | Mental Gain | Notes |
|--------|---------|-------------|-------|
| Rest | 2 | +8 | Always available |
| Travel | 3 | +25 | Costs $2K-5K + visa risk |
| See Therapist | 2 | +12 | Costs $800/quarter |
| Exercise | 1 | +3 | Stackable; minor mental benefit |

### States and Transitions

```
STABLE (>60) → STRESSED (30-60) → AT_RISK (10-30) → BURNOUT (<10)
    ↑               ↑                  ↑                  ↓
    └───────────────┴──────────────────┴──── resets to 30 ─┘
```

Burnout is the only forced state transition — it resets Mental to 30 (Stressed) with a forced rest quarter.

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Attribute System** | Mental ↔ Attributes | Reads/writes Mental value |
| **Immigration System** | Immigration → Mental | Visa events produce Mental deltas; `visa_insecure` flag drives ongoing drain |
| **Career System** | Career → Mental | Promotion/PIP/boss type/layoff produce Mental deltas |
| **Health System** | Health → Mental | Health < 30 adds -5/quarter to Mental drain; sickness events reduce Mental |
| **Action Point System** | Mental → AP | Burnout sets effective AP to 0 for 1 quarter |
| **Economy System** | Economy → Mental | Underwater mortgage drains Mental; therapy costs money |
| **Probability Engine** | Mental → Probability | Burnout check when Mental < 30 |
| **Turn Manager** | TM → Mental | Quarter signal triggers Mental decay and burnout check |

## Formulas

### Quarterly Mental Change
```
mental_delta = base_decay + visa_drain + boss_drain + grind_drain
             + health_penalty + action_gains + event_deltas

base_decay = -3
visa_drain = visa_insecure ? -3 : 0
boss_drain = boss_type == "toxic" ? -5 : boss_type == "demanding" ? -3 : boss_type == "supportive" ? +2 : 0
grind_drain = grind_active ? -8 : 0
health_penalty = health < 30 ? -5 : 0
action_gains = sum of mental gains from rest/travel/therapist/exercise
event_deltas = sum of mental changes from events this quarter

new_mental = clamp(mental + mental_delta, 0, 100)
```

### Worst Case Scenario
```
// Toxic boss + Grind + visa insecure + low health + no recovery actions:
mental_delta = -3 (base) - 3 (visa) - 5 (toxic) - 8 (grind) - 5 (health<30) = -24/quarter
// From Mental 70 to 0 in ~3 quarters. Burnout almost certain.
```

### Best Case Scenario
```
// Supportive boss + no grind + green card + travel:
mental_delta = -3 (base) + 0 (no visa drain) + 2 (supportive) + 0 (no grind) + 25 (travel) = +24/quarter
// Full recovery from Stressed to Stable in ~2 quarters.
```

## Edge Cases

### 1. Burnout while on PIP
PIP countdown continues during burnout rest quarter. Same as hospitalization — PIP doesn't pause. If burnout rest quarter is PIP's final quarter: terminated.

### 2. Multiple negative events in one quarter
H1B denied (-20) + sickness (-10) in same quarter: Mental takes both hits. Can crash from 60 to 30 in one quarter. All deltas are additive.

### 3. Mental above 100 after green card approval
Clamped to 100. Excess is wasted. Green card at Mental 85 → 100 (not 115).

### 4. Visa becomes secure mid-quarter
If combo card or green card is received during the quarter, `visa_insecure` changes immediately. The -3 drain is not applied for that quarter. The boost event (+20 or +30) fires in the Event Phase.

### 5. Therapist every quarter
Legal and effective. $800/quarter × 4 = $3,200/year for +12 Mental/quarter. For wealthy players under chronic stress, this is a valid ongoing strategy. No diminishing returns.

## Tuning Knobs

| Knob | Default | Safe Range | Affects |
|------|---------|------------|---------|
| `MENTAL_DECAY_BASE` | -3/quarter | -1 to -5 | Baseline stress level |
| `MENTAL_VISA_DRAIN` | -3/quarter | -1 to -5 | Visa anxiety intensity |
| `MENTAL_GRIND_DRAIN` | -8/quarter | -3 to -12 | Grind Mode mental cost |
| `BURNOUT_THRESHOLD` | 30 | 20-40 | When burnout risk activates |
| `BURNOUT_RESET_VALUE` | 30 | 20-40 | Mental after burnout recovery |
| `BURNOUT_GRIND_LOCK` | 2 quarters | 1-4 | Post-burnout grind cooldown |
| `GC_APPROVAL_BOOST` | +30 | +15 to +50 | Emotional payoff of green card |
| `COMBO_CARD_BOOST` | +20 | +10 to +30 | Combo card relief |
| `H1B_DENIAL_HIT` | -20 | -10 to -30 | H1B lottery failure impact |
| `LAYOFF_MENTAL_HIT` | -25 | -15 to -35 | Layoff psychological impact |
| `THERAPIST_GAIN` | +12 | +6 to +20 | Therapy effectiveness |
| `TRAVEL_MENTAL_GAIN` | +25 | +15 to +35 | Vacation mental recovery |

## Acceptance Criteria

### Functional Tests
1. **Base decay**: No actions, no special conditions. Verify Mental decreases by 3/quarter.
2. **Visa drain**: On H1B (visa_insecure=true). Verify Mental decreases by 6/quarter (3+3).
3. **Grind drain**: Grind active + visa insecure. Verify Mental decreases by 14/quarter (3+3+8).
4. **Toxic boss**: Toxic boss + normal work + visa insecure. Verify Mental decreases by 11/quarter (3+3+5).
5. **Burnout trigger**: Set Mental to 15. Verify burnout probability = 15%. Roll burnout. Verify forced rest, Mental resets to 30, Grind locked 2 quarters.
6. **Performance penalty at Stressed**: Mental = 45 (Stressed). Select Normal work. Verify Performance gain = 3.75 (5 × 0.75).
7. **Performance penalty at At Risk**: Mental = 20 (At Risk). Select Normal work. Verify Performance gain = 2.5 (5 × 0.5).
8. **Green card boost**: Trigger green card approval. Verify Mental +30, visa_insecure = false.
9. **Combo card boost**: Trigger combo card. Verify Mental +20, visa_insecure = false.
10. **H1B denial hit**: Trigger H1B lottery failure. Verify Mental -20.
11. **Therapist recovery**: See Therapist action. Verify Mental +12, $800 deducted.

### Integration Tests
12. **Health → Mental cascade**: Health drops below 30. Verify Mental drain increases by 5/quarter.
13. **Burnout → Career impact**: Burnout triggers. Verify AP = 0, Performance -10 applied.
14. **Visa secure transition**: Get combo card mid-career. Verify visa drain stops, ongoing Mental improves.
