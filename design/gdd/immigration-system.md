# Immigration System

> **Status**: In Design
> **Author**: user + game-designer
> **Last Updated**: 2026-03-28
> **Implements Pillar**: Pillar 1 (Authenticity First), Pillar 3 (Time Is the Ultimate Currency)

## Overview

The Immigration System is the defining system of the game — it models the complete US immigration journey from F1 student visa to green card. It operates as a state machine with 10+ visa states, each with unique rules, timelines, countdown timers, and transition conditions. The system tracks two parallel tracks: the visa status track (your legal right to be in the US) and the green card track (your path to permanent residency). These tracks interact but are separate — you can have a valid H1B visa while your green card application is stuck in a 10-year queue.

The system is designed around the real USCIS process with all its bureaucratic complexity, randomness, and cruelty. H1B is a literal lottery. PERM can be audited for no reason. Priority dates move forward and backward unpredictably. I-485 can be pending for years. Every step has a failure mode that can cascade into crisis.

## Player Fantasy

The player should feel the **weight of living under a system they cannot control**. Every visa deadline is a ticking clock. Every PERM milestone is a sigh of relief that can be undone by a layoff. The H1B lottery should produce genuine anxiety — 27% odds with your entire American life on the line. And when the green card finally arrives, it should feel like the single most satisfying moment in the game.

Pillar 1 (Authenticity): Every visa type, processing time, and transition rule maps to real USCIS procedures. Players who've lived this will recognize every detail.
Pillar 3 (Time Is the Ultimate Currency): The immigration system is the ultimate time pressure — visa countdowns, OPT expiry, green card queue years. Time is always running out.

## Detailed Design

### Core Rules

#### Visa Status State Machine

```
F1 (Student) → OPT → OPT STEM Extension → H1B (lottery) → H1B Renewal
                                         → CPT (Day-1, emergency fallback)
                                         → O1 (extraordinary ability)

H1B → Green Card Track:
  PERM → PERM Audit (possible) → I-140 → Priority Date Queue → I-485 → GREEN CARD
                                                                → Combo Card (EAD/AP)

Alternative paths:
  F1 → PhD → OPT → H1B or O1 or direct EB1A/NIW
  Any → Marriage Green Card (event-driven, not player-controlled)
  H1B → L1 (company internal transfer — special case)
```

#### Visa Types and Rules

| Visa | Duration | Work Auth | Tied To | Can Travel | Key Constraint |
|------|----------|-----------|---------|------------|---------------|
| **F1** | Duration of study | CPT only (limited) | School enrollment | Yes (with valid visa stamp) | Must maintain full-time student status |
| **OPT** | 4 quarters (12 months) | Yes | Field of study | Yes (risky without valid stamp) | Must find job in field within 90 days of start |
| **OPT STEM** | +8 quarters (24 months) | Yes | STEM employer (E-Verify) | Yes (risky) | Extension of OPT for STEM degrees |
| **H1B** | 12 quarters (3 years) | Yes | Specific employer | Yes (requires valid stamp) | Lottery entry required; tied to sponsoring employer |
| **H1B Renewal** | 12 quarters (3 years) | Yes | Specific employer | Yes | No lottery needed if extending with same or new employer |
| **H1B 7th Year+** | Indefinite (1yr renewals) | Yes | Specific employer | Yes | Only if I-140 approved or PERM filed >365 days ago |
| **O1** | 12 quarters (3 years) | Yes | Petitioning employer | Yes | Requires extraordinary ability evidence; no lottery |
| **L1** | 12-28 quarters | Yes | Same company (transfer) | Yes | Must have worked at company's foreign office 1+ year |
| **CPT (Day-1)** | Duration of program | Yes (tied to school) | School enrollment | Yes | Emergency fallback — costs tuition, keeps you legal |
| **Combo Card (EAD/AP)** | Until I-485 decision | Yes (any employer) | Pending I-485 | Yes (with AP) | Freedom from employer tie — game changer |
| **Green Card** | Permanent | Yes (any) | None | Yes (freely) | Game objective achieved |

#### Green Card Tracks

**Track A: Employer-Sponsored (PERM → I-140 → I-485)**

This is the most common path. The employer drives the process; the player waits.

```
Stage 1: PERM Labor Certification
  - Employer initiates (delay depends on gc_willingness)
  - Processing time: 3-6 quarters (normal) or 5-12 quarters (if audited)
  - Audit probability: 10% base + economic modifiers
  - During recession: processing slows, audit rate increases
  - If employer lays you off during PERM: PERM is VOIDED
  - If you quit during PERM: PERM is VOIDED
  - PERM approval → proceed to I-140

Stage 2: I-140 Immigrant Petition
  - Filed by employer after PERM approval
  - Processing time: 2-4 quarters (normal) or 2 weeks (Premium Processing, $2,500)
  - Approval rate: 85% + performance modifier
  - *** CRITICAL CHECKPOINT ***
    - Pre-I-140 approval: changing jobs VOIDS everything (PERM + I-140)
    - Post-I-140 approval: PRIORITY DATE IS LOCKED
    - This is the most important milestone before green card
  - I-140 approval → enter priority date queue

Stage 3: Priority Date Queue
  - Your priority date = the date your PERM was filed
  - You wait until your priority date becomes "current" (visa bulletin)
  - Wait time depends on category and country of birth:
    * EB2 China: 20-40 quarters (5-10 years)
    * EB3 China: 28-48 quarters (7-12 years)
  - Priority date movement: +/- each quarter (random with trend)
  - During wait: must maintain valid visa status (H1B renewals)
  - I-140 approved + PERM filed >365 days → eligible for H1B 7th year extensions

Stage 4: I-485 Adjustment of Status
  - Filed when priority date becomes current
  - Filing fee: $1,225 + legal fees (~$3,000-5,000)
  - Processing time: 4-12 quarters
  - Upon filing: receive COMBO CARD (EAD + AP)
    * EAD: work authorization independent of employer
    * AP: advance parole for travel
    * THIS CHANGES EVERYTHING — no longer tied to employer
  - I-485 approval = GREEN CARD
  - Possible RFE (Request for Evidence): 20% chance, delays 2-4 quarters
```

**Track B: Self-Petitioned (NIW or EB1A)**

Player drives the process. Costs AP but not tied to employer.

```
NIW (National Interest Waiver — EB2 subcategory):
  - Requirements: Academic Impact > 50 (threshold)
  - Filing: player-initiated, costs $2,000-5,000 in legal fees
  - Approval probability: attribute-driven (see Probability Engine GDD)
  - Processing time: 4-8 quarters
  - No PERM required, no employer sponsorship needed
  - Same priority date queue as EB2 (but self-petitioned)
  - Advantage: can file while on any valid visa; not employer-dependent

EB1A (Extraordinary Ability):
  - Requirements: Academic Impact > 75 (threshold)
  - Filing: player-initiated, costs $3,000-8,000 in legal fees
  - Approval probability: attribute-driven (highest threshold)
  - Processing time: 4-8 quarters (Premium Processing available)
  - NO PRIORITY DATE QUEUE — EB1 is current for all countries
  - This is the fastest path to green card if you qualify
  - Advantage: no employer needed, no queue wait
  - Disadvantage: extremely hard to qualify unless RS career path
```

**Track C: Other Paths (Event-Driven)**

```
Marriage Green Card:
  - Random event: "Meet someone" (probability increases with age and Mental > 50)
  - If triggered and player accepts: marriage GC process begins
  - Processing time: 4-8 quarters
  - No employer dependency, no priority date queue
  - Player cannot actively pursue this — it happens or it doesn't

EB1C (Multinational Manager):
  - Requires: Level L6+ at a multinational company
  - Company-initiated, similar to PERM track but faster queue
  - Rare path — only for players who reach senior management at the right company
```

#### Priority Date Movement

The priority date queue is modeled as a slowly-advancing cursor:

```
Each quarter:
  priority_date_movement = base_movement + random_variance + policy_modifier

  base_movement = +1 quarter advanced (on average)
  random_variance = random_uniform(-2, +3) quarters
  policy_modifier = varies by random immigration policy events

  // Priority date can move BACKWARD (retrogression)
  // This is one of the cruelest real-world mechanics
  if random_variance < -1:
      trigger "Priority Date Retrogression" event
      Mental -15 (devastating psychological blow)
```

Expected wait times:
- EB2 China: 20-40 quarters (5-10 years) — high variance
- EB3 China: 28-48 quarters (7-12 years) — even longer
- EB1: 0-4 quarters — essentially current (huge advantage)

#### Visa Countdown Timer

Every non-permanent visa has a countdown:

```
visa_quarters_remaining = visa_expiry_turn - current_turn

// Countdown warnings:
// > 8 quarters: green (safe)
// 4-8 quarters: yellow (plan ahead)
// 1-4 quarters: red (urgent action needed)
// 0: EXPIRED — if no valid status, game over (deportation)
```

When a visa is about to expire, the player must take action:
- H1B expiring → renew (if eligible) or change status
- OPT expiring → H1B lottery, CPT, O1, or leave
- No valid next status → grace period (60 days/~1 quarter) → deportation

#### Status Change Rules

| From | To | Condition | Cost | Risk |
|------|-----|-----------|------|------|
| F1 | OPT | Graduate + apply | $410 filing | 90-day unemployment gap limit |
| OPT | OPT STEM | STEM degree + E-Verify employer | $410 filing | Must apply before OPT expires |
| OPT/STEM | H1B | Win H1B lottery + employer sponsor | $2,000-5,000 | 27% lottery odds |
| H1B | H1B Transfer | New employer files | $2,000-5,000 | Can start working on receipt |
| H1B | H1B Renewal | Same or new employer | $2,000-5,000 | Usually approved if employed |
| Any | O1 | Extraordinary ability evidence + employer | $5,000-10,000 | Academic Impact threshold |
| Any | CPT (Day-1) | Enroll in school program | $15,000/year tuition | Maintains status, buys time |
| H1B | I-485 pending | Priority date current + I-485 filed | $1,225 + legal | Combo card issued |
| I-485 | Green Card | I-485 approved | — | 20% RFE chance |
| Any valid | Deportation | Status expires with no valid transition | — | Game over |

### States and Transitions

Complete state machine:

```
┌─────────────────────────────────────────────────────────────┐
│                     ACADEMIC PHASE                          │
│  F1 ──→ OPT ──→ OPT STEM Extension                        │
│                   ↓ (lottery)                                │
│         ┌────────────────────────┐                          │
│         │      H1B LOTTERY       │                          │
│         │   27% → H1B            │                          │
│         │   73% → try again /    │                          │
│         │         fallback       │                          │
│         └────────────────────────┘                          │
│              ↓ success         ↓ failure                    │
│           ┌──────┐       ┌──────────┐                      │
│           │ H1B  │       │ Fallback │                      │
│           └──────┘       │ CPT/O1/  │                      │
│              ↓           │ try again│                      │
│         ┌──────────┐     └──────────┘                      │
│  GC Track│  PERM   │                                       │
│         └──────────┘                                       │
│              ↓                                              │
│         ┌──────────┐                                       │
│         │  I-140   │ ← CRITICAL CHECKPOINT                 │
│         └──────────┘                                       │
│              ↓                                              │
│    ┌───────────────────┐                                   │
│    │ Priority Date Wait│ (5-10 years EB2, 7-12 years EB3) │
│    └───────────────────┘                                   │
│              ↓ (date becomes current)                       │
│         ┌──────────┐                                       │
│         │  I-485   │ → Combo Card (EAD/AP) issued          │
│         └──────────┘                                       │
│              ↓                                              │
│      ┌────────────┐                                        │
│      │ GREEN CARD  │ ← GAME OBJECTIVE                      │
│      └────────────┘                                        │
│                                                             │
│  Parallel: NIW/EB1A track (self-petitioned, no PERM)       │
│  Parallel: Marriage GC (event-driven)                       │
└─────────────────────────────────────────────────────────────┘
```

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Career System** | Immigration ↔ Career | Reads employer ID, employment status, level. Provides visa type, employer mobility constraints. (See Career GDD interface contract) |
| **Attribute System** | Immigration ← Attributes | Reads Academic Impact for NIW/EB1A eligibility. Writes Mental deltas on visa events (+30 on GC approval, -15 on retrogression). |
| **Probability Engine** | Immigration → Probability | Calls `roll("h1b_lottery")`, `roll("perm_approval")`, `roll("perm_audit")`, `roll("i140_approval")`, `roll("niw_approval")`, `roll("eb1a_approval")`, `roll("i485_rfe")`, `roll("i485_noid")` |
| **Economy System** | Immigration → Economy | Filing fees, legal costs at each milestone |
| **Economic Cycle** | Cycle → Immigration | Recession slows PERM, increases audit rate, may freeze employer GC initiation |
| **Turn Manager** | TM → Immigration | Quarter signal to advance processing timers, check countdowns, Q2 for H1B lottery |
| **Action Point System** | AP → Immigration | H1B prep, NIW/EB1A research actions |
| **Event System** | Events ↔ Immigration | Immigration policy changes, priority date shifts, marriage GC trigger |
| **Mental Health System** | Immigration → Mental | Visa events have massive Mental impact (GC approval +30, H1B denial -20, retrogression -15) |
| **Game Data** | Data → Immigration | Visa definitions, processing times, fee schedules from `immigration.json` |

## Formulas

### H1B Lottery

```
h1b_success = Probability Engine roll("h1b_lottery")
// Fixed 27% — no attribute influence
// Must have filed (AP action) to be eligible
// If Master's degree from US university: gets entered in both caps
//   (simplified: effective rate ~35% for Master's holders)
masters_rate = 0.35
bachelors_rate = 0.27
h1b_rate = has_us_masters ? masters_rate : bachelors_rate
```

### PERM Processing Time

```
base_quarters = 3
employer_delay = gc_willingness_delay[company.gc_willingness]  // eager:0-2, standard:2-4, reluctant:4-8
audit_extra = is_audited ? random_uniform(2, 6) : 0
recession_extra = economic_cycle.get_perm_modifier()            // recession: +2

total_perm_quarters = base_quarters + employer_delay + audit_extra + recession_extra
```

### Priority Date Movement (per quarter)

```
base_advance = 1.0        // quarters of dates that become current
variance = random_uniform(-2.0, 3.0)
policy_shift = current_policy_modifier    // set by random immigration policy events

quarterly_movement = base_advance + variance + policy_shift
// Can be negative (retrogression)
// Clamped to prevent absurd values: clamp(quarterly_movement, -4, +6)

// Player's wait estimate:
estimated_wait = (priority_date_position - current_date_position) / avg_quarterly_movement
```

### I-140 Premium Processing Decision

```
normal_processing_time = random_uniform(2, 4) quarters
premium_processing_time = 0 quarters (2 weeks → effectively instant)
premium_cost = $2,500

// Strategic decision: pay $2,500 to lock in I-140 immediately
// vs. risk being laid off during the 2-4 quarter normal processing window
// Expected value calculation:
//   layoff_risk_during_wait = 1 - (1 - quarterly_layoff_prob)^processing_quarters
//   if laid off pre-I-140: EVERYTHING resets (value of premium processing is enormous)
```

### Combo Card Impact on Mental

```
on_combo_card_issued:
    mental += 20                          // huge relief
    visa_insecure = false                 // removes -3/quarter mental drain
    // From this point: player can change employers freely
    // Travel is safe (Advance Parole)
    // The golden handcuffs are off
```

### Green Card Approval Impact

```
on_green_card_approved:
    mental += 30                          // life-changing relief
    visa_insecure = false                 // already false if had combo card
    // No more visa countdowns
    // No more employer dependency
    // Free to travel, change jobs, start a company
    // The game's primary objective is achieved
```

## Edge Cases

### 1. H1B lottery failed 3 years in a row
OPT STEM extension runs out after year 3. If all 3 lottery attempts fail:
- Must find alternative status: O1 (if Academic Impact high enough), CPT (emergency), L1 (if multinational company), or leave the US
- This is a real scenario that happens to thousands of people every year
- Game may offer "unlucky" event with empathetic text acknowledging this

### 2. PERM approved but I-140 denied
Rare (I-140 approval rate is ~85%+) but possible. PERM is still valid — employer can refile I-140. Player loses 2-4 quarters of processing time. Priority date may shift depending on refiling rules.

### 3. I-485 filed, then priority date retrogresses
One of the cruelest real-world edge cases. If priority date retrogresses AFTER I-485 filing:
- I-485 remains pending (not withdrawn)
- Combo card (EAD/AP) may still be valid if already issued
- But no new combo cards issued until date is current again
- Player is in limbo — technically pending but frozen

### 4. Job change with I-140 approved, new employer won't file PERM
Priority date is preserved (portability). But player needs a NEW I-140 from new employer, which requires a new PERM from new employer. If new employer is "reluctant" or recession hits: PERM may never be filed. Priority date exists but is orphaned — useless without a new I-140 to attach to.

### 5. Laid off after I-485 filed (with combo card)
Combo card holder is NOT tied to a specific employer for work authorization. However, **prolonged unemployment threatens the I-485 itself**. The green card is filed under an employment-based category — USCIS expects the applicant to have a job (or credible intent to work) in the sponsored field.

**Mechanics:**
- Quarter 1 of unemployment: No immigration impact. Player is assumed to be actively searching. Mental -10 (financial stress, not visa panic).
- Quarter 2+ of unemployment: NOID (Notice of Intent to Deny) probability activates:
  ```
  noid_probability = 0.15 + (unemployment_quarters - 1) × 0.12
  // Q2: 15%, Q3: 27%, Q4: 39%, Q5: 51%, etc.
  ```
- If NOID triggered:
  - Player has 1 quarter to respond (must be employed or show strong evidence of job search)
  - If employed by response deadline: NOID resolved, I-485 continues
  - If still unemployed: I-485 DENIED. Combo card invalidated. Must find new status or face deportation.
  - Mental -25 on NOID receipt (the rug being pulled when you thought you were safe)

**Design intent:** Combo card is still a massive upgrade over H1B (no 60-day death clock, can work for any employer, can travel freely). But it is NOT a free pass to be unemployed indefinitely. This creates urgency to find a new job even with combo card, while giving the player more breathing room than the H1B 60-day nightmare. The NOID mechanic teaches players that "safe" is relative — and injects late-game tension even after the combo card milestone.

**Emotional arc:** Combo card arrival → relief and freedom → layoff → "wait, I'm still not truly safe" → scramble to find work → find job → resume waiting for GC. This is authentic to real immigrant experience.

### 6. Laid off before I-485 filed (H1B only)
60-day grace period. Must find new H1B sponsor or change to another valid status. If PERM was pending: VOIDED. If I-140 was approved: priority date preserved but need new PERM + I-140 from new employer.

### 7. Two green card tracks simultaneously
Player can have PERM track AND NIW/EB1A track running in parallel. This is a real strategy: hedge your bets. Whichever approves first wins. The AP cost of maintaining both tracks is high but the risk reduction is significant.

### 8. O1 visa as H1B alternative
If Academic Impact is sufficient (>50 for O1), player can apply for O1 instead of H1B. O1 has no lottery — it's merit-based. But approval probability depends heavily on Academic Impact. For RS career: O1 is often easier than H1B lottery. For SDE: O1 is very hard to qualify for.

### 9. Green card approved at age 58 (1 year before game end)
Still counts! GC multiplier (1.5×) applies to final score. Early bonus is only 1 year × $10K = $10K. Barely made it — but made it.

### 10. Immigration policy change event
Random event: "Immigration Reform Act" — can affect:
- H1B lottery rate (increase or decrease cap)
- PERM processing time
- Priority date movement speed
- New visa categories
These are low-frequency high-impact events that affect ALL ongoing applications.

### 11. Player on multiple visa clocks simultaneously
Example: H1B expiring in 2 quarters, PERM just filed, I-140 not yet filed. The player needs H1B renewal to stay while PERM processes. H1B renewal is usually straightforward but costs money and requires employer participation. If employer is reluctant: potential crisis.

## Dependencies

### Upstream

| System | Dependency Type | Interface Used |
|--------|----------------|----------------|
| **Career System** | Hard | Employer ID, employment status, level (via interface contract) |
| **Attribute System** | Hard | Academic Impact for NIW/EB1A thresholds; writes Mental deltas |
| **Probability Engine** | Hard | All immigration probability rolls |
| **Economy System** | Soft | Filing fees deducted at milestones |
| **Economic Cycle** | Hard | PERM processing modifiers, employer GC initiation freeze |
| **Turn Manager** | Hard | Quarter signal, Q2 H1B lottery trigger |
| **Action Point System** | Soft | H1B prep, NIW research actions |
| **Game Data** | Hard | Visa definitions, processing times, fees from `immigration.json` |

### Downstream

| System | Dependency Type | Interface |
|--------|----------------|-----------|
| **Career System** | Hard | Visa type, employer mobility constraints (via interface contract) |
| **Mental Health System** | Hard | Visa events produce massive Mental deltas |
| **Action Point System** | Soft | Travel action risk depends on visa type |
| **Economy System** | Soft | Combo card unlocks employer independence (affects job change calculus) |

### Interface Contract

Exposed to other systems (especially Career):
```
Immigration.get_visa_type() → string              // "f1", "opt", "h1b", "combo_card", "green_card", etc.
Immigration.get_visa_expiry_quarters() → int       // quarters until current visa expires
Immigration.can_change_employer() → bool           // false on H1B without transfer; true with EAD/GC
Immigration.has_combo_card() → bool                // EAD + AP issued
Immigration.has_green_card() → bool                // game objective
Immigration.get_perm_status() → string             // "none", "employer_delay", "filing", "pending", "audited", "approved"
Immigration.get_i140_status() → string             // "none", "pending", "approved"
Immigration.get_i485_status() → string             // "none", "pending", "rfe", "approved"
Immigration.get_priority_date() → int | null       // turn number when PERM was filed (null if not filed)
Immigration.get_priority_date_current() → int      // current cutoff turn for the visa bulletin
Immigration.get_estimated_wait() → int | null      // estimated quarters until priority date is current
Immigration.get_gc_track() → string                // "perm", "niw", "eb1a", "marriage", "none"
Immigration.is_visa_insecure() → bool              // true if not on green card or combo card
Immigration.travel_risk() → float                  // 0.0 (safe: GC/combo) to 0.05 (risky: H1B needs stamp)
```

## Tuning Knobs

| Knob | Default | Safe Range | Too Low | Too High | Affects |
|------|---------|------------|---------|----------|---------|
| `H1B_LOTTERY_RATE_BACHELORS` | 0.27 | 0.15-0.40 | H1B feels impossible | H1B is trivial | Core H1B drama |
| `H1B_LOTTERY_RATE_MASTERS` | 0.35 | 0.20-0.50 | Master's advantage is minor | Master's nearly guarantees H1B | Education value |
| `PERM_BASE_QUARTERS` | 3 | 2-6 | PERM is fast (less tension) | PERM is very slow (frustrating wait) | PERM timeline |
| `PERM_AUDIT_RATE` | 0.10 | 0.05-0.25 | Audits are rare (PERM feels smooth) | Audits are frequent (PERM feels unreliable) | PERM uncertainty |
| `I140_APPROVAL_RATE` | 0.85 | 0.70-0.95 | I-140 denial is a real risk | I-140 is nearly automatic | I-140 tension |
| `I140_PREMIUM_COST` | $2,500 | $1,000-$5,000 | Premium processing is trivially cheap | Premium processing is a major expense | Premium processing value |
| `EB2_WAIT_BASE_QUARTERS` | 30 | 16-48 | Green card comes relatively quickly | Wait is extremely long (discouraging) | GC timeline pacing |
| `EB2_WAIT_VARIANCE` | 12 | 4-20 | Wait is predictable (less dramatic) | Wait is wildly unpredictable | GC queue drama |
| `EB3_WAIT_BASE_QUARTERS` | 38 | 24-56 | EB3 is only slightly worse than EB2 | EB3 is devastatingly longer | EB2 vs EB3 decision |
| `PRIORITY_DATE_RETROGRESSION_CHANCE` | 0.15 | 0.05-0.25 | Retrogression is rare (less drama) | Retrogression is constant (feels broken) | Queue frustration |
| `COMBO_CARD_MENTAL_BOOST` | +20 | +10 to +30 | Combo card feels underwhelming | Combo card feels too transformative | Milestone satisfaction |
| `GREEN_CARD_MENTAL_BOOST` | +30 | +15 to +50 | GC approval feels flat | GC is too much of a reset | Ultimate milestone payoff |
| `NIW_ACADEMIC_THRESHOLD` | 50 | 30-70 | NIW too easy (everyone self-files) | NIW impossible for non-RS (limits strategy) | Self-petition accessibility |
| `EB1A_ACADEMIC_THRESHOLD` | 75 | 60-90 | EB1A too easy (devalues the achievement) | EB1A impossible even for RS (useless path) | EB1A exclusivity |
| `MARRIAGE_EVENT_BASE_PROB` | 0.02/quarter | 0.01-0.05 | Marriage is extremely rare | Marriage happens to everyone | Marriage GC availability |
| `RFE_PROBABILITY` | 0.20 | 0.10-0.35 | I-485 is smooth (less late-game drama) | RFE is frequent (feels punishing when so close) | Late-game tension |
| `GRACE_PERIOD_QUARTERS` | 1 (60 days) | 1-2 | Very little time to find new status | Generous buffer (less urgency) | Layoff crisis severity |

## Acceptance Criteria

### Functional Tests
1. **F1 → OPT transition**: Graduate from Academic Phase. Verify OPT status activated with 4-quarter countdown.
2. **OPT STEM extension**: On OPT with STEM degree and E-Verify employer. Apply for extension. Verify countdown extends by 8 quarters.
3. **H1B lottery — success**: File H1B, roll lottery with 27%. On success: verify H1B status with 12-quarter duration.
4. **H1B lottery — failure**: Roll lottery, fail. Verify remains on OPT/STEM, can try again next Q2.
5. **H1B lottery — 3 failures**: Fail 3 consecutive lotteries. Verify OPT STEM expires, player must find alternative status or face deportation.
6. **PERM filing**: Employer with "eager" willingness. Verify PERM starts within 0-2 quarters of hire.
7. **PERM audit**: Trigger PERM audit. Verify processing time extends by 2-6 quarters.
8. **PERM voided on job change**: PERM pending, player changes jobs. Verify PERM status resets to "none".
9. **I-140 approval**: PERM approved, I-140 filed. Roll approval. Verify I-140 approved status and priority date locked.
10. **I-140 — job change preserves priority date**: I-140 approved. Change jobs. Verify priority date preserved but new PERM needed.
11. **Priority date movement**: Advance 10 quarters. Verify priority date cursor moves with variance (some quarters forward, some backward).
12. **Priority date retrogression**: Trigger retrogression event. Verify cursor moves backward and Mental penalty applied.
13. **I-485 filing**: Priority date becomes current. Verify I-485 can be filed. Verify combo card issued.
14. **Combo card effects**: I-485 pending with combo card. Verify `can_change_employer() = true`, `travel_risk() = 0.0`, `is_visa_insecure() = false`.
15. **Green card approval**: I-485 approved. Verify `has_green_card() = true`, Mental +30 boost, all visa countdowns removed.
16. **NIW filing**: Academic Impact > 50. File NIW. Verify processing begins, no PERM required.
17. **EB1A filing**: Academic Impact > 75. File EB1A. Verify no priority date queue (essentially immediate).
18. **Visa expiry → deportation**: H1B expires with no pending applications and no valid next status. Verify game over (deportation).
19. **Grace period**: Laid off on H1B. Verify 1-quarter grace period starts. If new job found within grace: H1B transferred. If not: deportation.

### Integration Tests
20. **Layoff + PERM cascade**: PERM pending (pre-I-140). Get laid off. Verify: PERM voided, unemployment state, 60-day countdown, Mental crash.
21. **Career → Immigration flow**: Start job at company with "reluctant" GC willingness. Verify PERM initiation is delayed 4-8 quarters.
22. **Economic recession → PERM**: Enter recession. Verify PERM processing slows, audit rate increases.
23. **Parallel tracks**: File PERM track AND NIW track simultaneously. Verify both process independently, first approval wins.
24. **Combo card → job hop**: Get combo card. Change jobs. Verify no PERM reset (I-485 is independent of employer change).

### Balance Tests
25. **Green card timeline**: Simulate 1000 SDE runs taking PERM route. Verify median GC approval is age 34-40 (10-16 years after starting work). Verify >80% get GC before age 59.
26. **EB1A viability**: Simulate 1000 RS runs. Verify >40% qualify for EB1A by age 35 (Academic Impact > 75).
27. **H1B failure rate**: Simulate 1000 lottery sequences. Verify ~20% of players fail all 3 OPT-period attempts.

## Open Questions

1. **EB2 → EB3 downgrade**: In real life, EB3 has a longer queue but in some periods EB3 China moves faster than EB2 China. Should we model this cross-over? Adds strategic decision but complexity. — Defer to Alpha.
2. **H4 EAD (spouse work permit)**: If marriage system is added, should spouse be able to work? Affects household income significantly. — Defer to Full Vision with marriage system.
3. **Country of birth**: Currently assumes China-born. Should Indian-born be an option? (Even longer queues, different strategy). — Interesting for replayability, defer to Full Vision.
4. **Immigration lawyer quality**: Should hiring a more expensive lawyer improve odds? Adds a spending decision. — Defer to Vertical Slice.
5. **USCIS processing time variance**: Real processing times vary wildly by service center. Should we model this? — Probably too granular, captured by variance in processing time ranges.
6. **Concurrent I-485 filing**: If both spouses file I-485 and one gets approved, the other also gets approved (derivative). — Only relevant with marriage system, defer.
