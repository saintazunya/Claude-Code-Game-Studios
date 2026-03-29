# Health System

> **Status**: In Design
> **Author**: user + game-designer
> **Last Updated**: 2026-03-28
> **Implements Pillar**: Pillar 2 (Every Choice Costs)

## Overview

The Health System manages the player's physical well-being through the Health attribute (0-100) and its consequences. It is the enforcement arm of the 卷王 (Grind Mode) tradeoff — Grind produces career results but destroys the body. Health decays naturally with age, drops sharply with overwork, and recovers through rest, travel, and exercise. When Health drops low, the sickness probability formula activates, potentially triggering sickness events that cost AP, money, and force Grind Mode cooldown. At Health 0, the player is hospitalized (loses an entire quarter). The system creates a "debt cycle" — borrowed productivity now must be repaid with interest later.

## Player Fantasy

The player should feel the **physical cost of ambition**. Young and healthy players can push hard with few consequences — mirroring the real experience of grinding in your 20s. But as age increases and Health deteriorates, the body starts collecting its debts. The 45-year-old player who Grinded through their 30s and never rested is now spending 2 AP per quarter just to stay functional. Health is the game's interest rate on borrowed time.

## Detailed Design

### Core Rules

#### Health Attribute
- Range: 0-100
- Starting value: determined by Constitution (40-80)
- Natural decay: -2/quarter base, -3/quarter after age 40
- Grind Mode drain: -15/quarter (on top of natural decay)
- Constitution sickness modifier: -2% to +3% permanent modifier on sickness checks

#### Sickness Check (every quarter)
```
age_factor = 1.0 + max(0, (age - 30) × 0.03)
sickness_chance = min(0.80, (100 - health) × 0.004 × age_factor) + constitution_sickness_modifier
sickness_chance = max(0, sickness_chance)
```

#### Sickness Severity (if sickness triggered)
```
severity_roll = random_uniform(0, 1)
severity = "mild"    if severity_roll < 0.50
         = "moderate" if severity_roll < 0.85
         = "severe"   if severity_roll < 0.97
         = "hospital"  if severity_roll >= 0.97

// Lower health increases severity weighting
if health < 20:
    severity upgrades one tier (mild→moderate, moderate→severe, etc.)
```

| Severity | AP Penalty | Medical Cost | Health Recovery | Grind Lock | Mental Impact |
|----------|-----------|-------------|-----------------|-----------|--------------|
| **Mild** | -3 next quarter | $1,000-3,000 | Health +5 (forced minor rest) | 1 quarter | Mental -5 |
| **Moderate** | -5 next quarter | $3,000-8,000 | Health +10 (forced rest) | 2 quarters | Mental -10 |
| **Severe** | -8 next quarter | $8,000-20,000 | Health +15 (extended recovery) | 3 quarters | Mental -15 |
| **Hospitalized** | -10 (entire quarter lost) | $15,000-30,000 | Health resets to 40 | 4 quarters | Mental -20 |

#### Grind Mode Cooldown
After sickness, Grind Mode is locked for N quarters (severity-dependent). Attempting to Grind while locked is not possible. This forces the player out of the death spiral — temporarily.

#### Recovery Actions
| Action | AP Cost | Health Gain | Notes |
|--------|---------|-------------|-------|
| Rest | 2 | +10 | Always available |
| Exercise | 1 | +5 | Stackable with other actions |
| Travel | 3 | +20 | Costs $2K-5K, visa travel risk |
| See Doctor (preventive) | 2 | +8, reduces next sickness severity by 1 tier | Costs $1,500; proactive healthcare |

### States and Transitions

| State | Health Range | Effects |
|-------|-------------|---------|
| **Healthy** | 71-100 | No penalties; Grind available; sickness probability low |
| **Sub-healthy** | 31-70 | Sickness probability active; warnings shown in UI |
| **Critical** | 1-30 | High sickness probability; Performance/Skills gains halved; UI flashes warning |
| **Hospitalized** | 0 | Quarter lost; massive medical bill; Health resets to 40; Grind locked 4 quarters |

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Attribute System** | Health ↔ Attributes | Reads/writes Health value; reads Constitution modifier |
| **Action Point System** | Health → AP | Sickness penalties reduce effective AP; Grind lock enforced |
| **Probability Engine** | Health → Probability | Sickness chance formula called each quarter |
| **Economy System** | Health → Economy | Medical costs deducted on sickness events |
| **Mental Health System** | Health → Mental | Low health drains Mental; sickness events reduce Mental |
| **Turn Manager** | TM → Health | Quarter signal triggers sickness check |
| **Career System** | Health → Career | Health < 20 halves Performance gains |
| **Game Data** | Data → Health | Sickness severity tables, medical costs, recovery values |

## Formulas

### Quarterly Health Change
```
health_delta = natural_decay + action_gains + sickness_recovery
natural_decay = -2 - (age > 40 ? 1 : 0) - (grind_active ? 13 : 0)
action_gains = sum of health gains from selected actions (rest, exercise, travel, doctor)
sickness_recovery = forced health gain from sickness event (if triggered)

new_health = clamp(health + health_delta, 0, 100)
```

### Grind Mode Total Health Cost Over Time
```
// Starting at Health 80 with Grind every quarter:
// Quarter 1: 80 - 2(base) - 15(grind) = 63
// Quarter 2: 63 - 2 - 15 = 46
// Quarter 3: 46 - 2 - 15 = 29 (CRITICAL)
// Quarter 4: 29 - 2 - 15 = 12 (sickness almost certain)
// Quarter 5: likely hospitalized

// With age > 40:
// Quarter 1: 80 - 3 - 15 = 62
// Quarter 2: 62 - 3 - 15 = 44
// Quarter 3: 44 - 3 - 15 = 26 (CRITICAL one quarter sooner)
```

## Edge Cases

### 1. Hospitalized while on PIP
PIP 2-quarter countdown continues during hospitalization. Player loses a quarter of recovery time. If PIP expires during hospital stay: terminated. This is the worst-case cascade — Grind to avoid PIP → hospitalized → PIP expires → fired → visa crisis.

### 2. Sickness during Academic Phase
Same mechanics apply. Sickness in Academic Phase can cost AP needed for intern search or thesis work. A Constitution 0 player who Grinds through grad school may get sick and miss intern season.

### 3. Multiple sickness events in consecutive quarters
Possible if Health stays low. Each sickness event has its own severity roll. A player stuck in the Critical zone can get sick repeatedly — this is the death spiral.

### 4. Travel while sick (Grind locked)
Allowed. Travel gives +20 Health which helps recovery. But costs money and has visa travel risk. A strategic choice for wealthy players recovering from sickness.

### 5. Health at 100 — continue resting?
Gains above 100 are wasted (clamped). Player should stop resting and allocate AP elsewhere. UI should indicate "Health is full" to prevent AP waste.

## Tuning Knobs

| Knob | Default | Safe Range | Affects |
|------|---------|------------|---------|
| `HEALTH_DECAY_BASE` | -2/quarter | -1 to -4 | How fast health degrades naturally |
| `HEALTH_DECAY_AGE_40_EXTRA` | -1/quarter | 0 to -3 | Mid-life health acceleration |
| `GRIND_HEALTH_COST` | -15/quarter | -8 to -20 | Grind Mode punishment |
| `SICKNESS_COEFF` | 0.004 | 0.002-0.008 | Overall sickness frequency |
| `SICKNESS_AGE_COEFF` | 0.03 | 0.01-0.05 | Age impact on sickness |
| `SICKNESS_CAP` | 0.80 | 0.60-0.95 | Maximum sickness probability |
| `HOSPITAL_HEALTH_RESET` | 40 | 30-50 | Health after hospitalization |
| `GRIND_LOCK_MILD` | 1 quarter | 0-2 | Grind cooldown after mild sickness |
| `GRIND_LOCK_HOSPITAL` | 4 quarters | 2-6 | Grind cooldown after hospitalization |
| `MEDICAL_COST_SEVERE_MAX` | $20,000 | $10K-$30K | Financial impact of severe illness |

## Acceptance Criteria

### Functional Tests
1. **Natural decay**: No actions, age 25. Verify Health decreases by 2/quarter.
2. **Age decay**: Age 41, no actions. Verify Health decreases by 3/quarter.
3. **Grind drain**: Grind Mode active, age 25. Verify Health decreases by 17/quarter (2+15).
4. **Sickness probability**: Health 50, age 25. Verify sickness chance ≈ 20%.
5. **Sickness probability with age**: Health 50, age 45. Verify sickness chance ≈ 32%.
6. **Constitution modifier**: Constitution 0 (+3%). Health 80, age 25. Verify sickness chance ≈ 8% (5% + 3%).
7. **Severity roll**: Trigger sickness at Health 15. Verify severity upgrades one tier.
8. **Hospitalization**: Health reaches 0. Verify quarter lost, Health resets to 40, Grind locked 4 quarters.
9. **Grind lock**: Trigger moderate sickness (2-quarter lock). Verify Grind Mode unavailable for 2 quarters.
10. **Recovery actions**: Rest (+10), Exercise (+5), Travel (+20). Verify correct Health gains.
11. **Medical costs**: Severe sickness. Verify $8K-$20K deducted from Economy System.

### Integration Tests
12. **Grind → Sickness → PIP cascade**: Grind 4 quarters straight. Verify sickness triggers, AP reduced, Performance drops, PIP risk increases.
13. **Health < 20 → Performance halved**: Set Health to 15. Select Normal work. Verify Performance gain is +2.5 (not +5).
14. **Hospitalization during PIP**: Trigger hospitalization while PIP is active. Verify PIP countdown continues.
