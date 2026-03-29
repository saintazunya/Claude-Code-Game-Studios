# Action Point System

> **Status**: In Design
> **Author**: user + game-designer
> **Last Updated**: 2026-03-28
> **Implements Pillar**: Pillar 2 (Every Choice Costs), Pillar 3 (Time Is the Ultimate Currency)

## Overview

The Action Point System is the player's primary input mechanism — every quarter, they receive a budget of Action Points (AP) and must decide how to spend them. AP is scarce by design: there is never enough to do everything the player wants. The system enforces the core tension of the game through two sequential decisions: first, choose a work mode (躺平/正常/卷王) that consumes a fixed AP amount; then allocate remaining AP to other life actions (immigration prep, skill building, rest, travel, job hunting, entrepreneurship research). The work mode is mandatory — you must work — but everything else is a choice about what NOT to do this quarter.

## Player Fantasy

The player should feel like they are **negotiating with their own limited time**, exactly as a real immigrant does. "I need to prepare for H1B filing, but I also need to study for promotion, and I haven't rested in 3 quarters..." The AP budget makes this negotiation concrete and visible. Every point spent is a point not spent elsewhere. The most agonizing turns are when the player has 4 remaining AP and three 3-AP actions they desperately need.

Pillar 2 (Every Choice Costs): AP IS the cost. Every action's price tag is measured in "what else could I have done."
Pillar 3 (Time Is the Ultimate Currency): AP represents time. 148 quarters × 10 AP = 1,480 total lifetime AP. That's all you get.

## Detailed Design

### Core Rules

#### AP Budget

```
base_ap = 10
grind_bonus = 3 (if Grind Mode active)
sickness_penalty = varies (-3 to -8, if sick this quarter)
burnout_penalty = -10 (all AP lost, forced rest)
hospitalization_penalty = -10 (all AP lost, forced rest)

effective_ap = base_ap + grind_bonus - sickness_penalty - burnout/hospitalization_penalty
effective_ap = max(effective_ap, 0)
```

#### Turn Sequence (within Turn Manager Phase 3)

```
1. Display effective AP for this quarter
2. MANDATORY: Player selects work mode (consumes fixed AP)
3. Display remaining AP after work mode
4. OPTIONAL: Player allocates remaining AP to available actions
5. Player may leave AP unspent (no penalty, but wasted time)
6. Player confirms all selections
7. All selected actions are queued for resolution (Turn Manager Phase 4)
```

#### Work Modes (Mandatory — choose exactly one)

| Mode | AP Cost | Effects | Risk |
|------|---------|---------|------|
| **躺平 (Coast)** | 2 | Performance -5, Mental +3, low visible output | PIP risk if consecutive; frees up 8 AP for other activities |
| **正常 (Normal)** | 4 | Performance +5, Mental -2 | Balanced default; leaves 6 AP |
| **卷王 (Grind)** | 6 | Performance +15, Mental -8, Health -15, but grants +3 bonus AP (total 13) | High reward but devastating health/mental cost; net remaining AP = 7 |

**Note on Grind Mode AP math:**
- Base 10 + Grind bonus 3 = 13 total AP
- Grind work mode costs 6
- Remaining: 7 AP for other actions
- vs. Normal: 10 - 4 = 6 remaining
- vs. Coast: 10 - 2 = 8 remaining

So Grind gives 1 more remaining AP than Normal but at massive health/mental cost. Coast gives the most free AP but tanks Performance. This is the core tradeoff triangle.

#### Available Actions (Optional — spend remaining AP)

Actions are grouped by category. Some actions are only available under certain conditions.

**Career Actions:**

| Action | AP Cost | Effects | Conditions |
|--------|---------|---------|------------|
| Upskill / Study | 2 | Skills +8 | Always available |
| Prepare Job Change | 3 | Starts job search; +10% offer probability per quarter of prep | Career Phase only; stacks up to 2 quarters |
| Prepare Job Change (intensive) | 5 | +20% offer probability this quarter | Career Phase only; does not stack |
| Entrepreneurship Research | 4 | Progress toward startup readiness | Career Phase; requires Net Worth > $50K |

**Immigration Actions:**

| Action | AP Cost | Effects | Conditions |
|--------|---------|---------|------------|
| Prepare H1B Filing | 3 | Enables H1B lottery entry next Q2 | Must be on OPT; once per year |
| Research NIW/EB1A | 3 | Academic Impact +5; progress toward self-filing | Career Phase; RS roles get this for free via work |
| Publish Paper (side project) | 4 | Academic Impact +10 | Non-RS roles only; RS gain this through work |
| Consult Immigration Lawyer | 2 | Reveals hidden information: current priority date estimate, best route suggestion | Once per year; costs $500 (Economy System) |

**Health & Wellness:**

| Action | AP Cost | Effects | Conditions |
|--------|---------|---------|------------|
| Rest | 2 | Health +10, Mental +8 | Always available |
| Travel / Vacation | 3 | Health +20, Mental +25, Net Worth -$2,000 to -$5,000 | Visa must allow travel (risky on H1B, safe with combo card/GC) |
| Exercise Routine | 1 | Health +5 | Always available; can combine with other actions |
| See Therapist | 2 | Mental +12 | Always available; costs $800/quarter (Economy) |

**Academic Phase Actions (replaces Career actions during turns 1-8/16):**

| Action | AP Cost | Effects | Conditions |
|--------|---------|---------|------------|
| Study GPA | 3 | GPA +0.2 (tracked during academic phase) | Academic Phase |
| Search for Intern | 3 | Triggers intern probability roll | Academic Phase; Q3-Q4 optimal |
| Thesis Research (PhD) | 4 | Academic Impact +8, PhD progress | PhD track only |
| Networking / Career Fair | 2 | Skills +3, +5% intern/job probability bonus | Academic Phase |

**Free Actions (no AP cost):**

| Action | Effects | Notes |
|--------|---------|-------|
| Adjust S&P 500 investment | Buy/sell shares, toggle auto-invest | Managed by Economic Cycle System |
| Review visa status | View current status, deadlines | Information only |
| Review financial summary | View income/expenses/net worth | Information only |

#### Action Stacking Rules

- Player may select multiple optional actions as long as total AP cost ≤ remaining AP
- Same action CANNOT be selected twice in one quarter (no double-resting)
- Exception: Exercise Routine (1 AP) can stack with any other action
- Some actions are mutually exclusive:
  - Cannot do Travel AND Prepare Job Change in same quarter (you're out of the country)
  - Cannot do Prepare H1B AND Research NIW in same quarter (different legal strategies)

#### Unemployed State

If the player loses their job (layoff, PIP termination):
- Work mode selection is SKIPPED (no job = no work)
- All 10 AP are available for other actions
- BUT: no salary income this quarter (Economy System)
- New action unlocked: **Urgent Job Search** (5 AP, +25% offer probability, desperation mode)
- 60-day (2/3 quarter) countdown starts on H1B; must find sponsoring employer or lose status

### States and Transitions

The AP system itself is stateless per-quarter — it resets every turn. However, some actions create persistent flags that affect future quarters:

| Flag | Set By | Duration | Effect |
|------|--------|----------|--------|
| `job_search_active` | Prepare Job Change | Until job found or cancelled | +10% per prep quarter to offer probability |
| `h1b_filed` | Prepare H1B Filing | Until Q2 lottery | Enables lottery entry |
| `startup_research` | Entrepreneurship Research | Cumulative | Progress counter toward startup launch |
| `grind_consecutive` | Grind Mode | Counts consecutive quarters | Used by Health System for escalating penalties |
| `coast_consecutive` | Coast Mode | Counts consecutive quarters | Used by Career System for PIP escalation |

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Attribute System** | AP → Attributes | Actions produce attribute deltas resolved at Turn Manager Phase 4 |
| **Turn Manager** | TM → AP | Signals Player Action Phase start/end; provides effective AP |
| **Health System** | Health → AP | Sickness/hospitalization reduces effective AP |
| **Mental Health System** | Mental → AP | Burnout sets effective AP to 0 |
| **Career System** | Career ↔ AP | Work mode feeds Performance; unemployment changes available actions |
| **Immigration System** | Immigration ↔ AP | H1B prep, NIW research actions; visa status determines travel risk |
| **Economy System** | Economy ↔ AP | Travel/therapist/lawyer costs deducted; unemployed = no salary |
| **Probability Engine** | AP → Probability | Job search prep quarters feed into offer probability modifiers |
| **Academic Phase** | Academic ↔ AP | Different action set during academic turns |
| **Game Data** | Data → AP | Action definitions, AP costs, effect values from `actions.json` |
| **UI** | AP → UI | Available actions, remaining AP, cost previews, conflict warnings |

## Formulas

### Effective AP Calculation

```
effective_ap = BASE_AP                              // 10
             + (grind_active ? GRIND_BONUS : 0)     // +3
             - sickness_ap_penalty                   // 0 to -8
             - (burnout_active ? BASE_AP : 0)        // -10 (all)
             - (hospitalized ? BASE_AP : 0)          // -10 (all)

effective_ap = max(effective_ap, 0)
```

### Remaining AP After Work Mode

```
remaining_ap = effective_ap - work_mode_cost
// Coast: effective_ap - 2
// Normal: effective_ap - 4
// Grind: effective_ap - 6 (but effective_ap is 13 due to bonus)
```

### Job Search Probability Accumulation

```
offer_base = Probability Engine base for "job_offer"
prep_bonus = quarters_preparing × JOB_PREP_BONUS_PER_QUARTER   // +10% per quarter
intensive_bonus = (intensive_this_quarter ? 0.20 : 0)
total_prep_modifier = min(prep_bonus + intensive_bonus, JOB_PREP_CAP)  // cap at +30%
```

### Action Value Efficiency

For player reference (not displayed in-game, but useful for balance):

```
// AP efficiency = total attribute gain per AP spent
Rest:           (10 health + 8 mental) / 2 AP = 9.0 per AP (free)
Exercise:       5 health / 1 AP = 5.0 per AP (free, stackable)
Travel:         (20 health + 25 mental) / 3 AP = 15.0 per AP (costs $2K-$5K + visa risk)
Upskill:        8 skills / 2 AP = 4.0 per AP
Normal Work:    5 performance / 4 AP = 1.25 per AP (but mandatory)
Grind Work:     15 performance / 6 AP = 2.5 per AP (but health/mental cost)
```

Travel and Rest have similar AP efficiency, but Travel costs money and adds health. This creates a wealth-dependent optimization: rich players prefer Travel, poor players Rest.

## Edge Cases

### 1. Effective AP = 0 (burnout or hospitalization)
Turn auto-resolves. No work mode selection, no actions. The quarter is lost. Attribute natural decay still applies. Economy System still processes (salary if employed, expenses always). This is the maximum punishment.

### 2. Grind Mode while sick (reduced AP)
Grind Mode grants +3 bonus AP but sickness may have already reduced base. Example: base 10 - sickness 5 + grind 3 = 8 total. Grind costs 6 → only 2 remaining. The player chose Grind while sick — legal but foolish. No guard rails (Pillar 2).

### 3. Player selects no optional actions
Legal. After work mode, player may confirm with unspent AP. This represents a quarter with nothing but work. Unspent AP is not banked — use it or lose it.

### 4. Unemployed + Grind Mode
Cannot select Grind Mode while unemployed (no job to grind at). Work mode is skipped entirely. All 10 AP are available.

### 5. Travel on H1B
Travel action is available but displays a warning: "Traveling on H1B requires valid visa stamp. Re-entry is not guaranteed. Risk: 5% chance of visa rejection at consulate, causing 1-quarter delay." The player can still choose it — but the risk is real. With combo card (I-485 pending), travel risk drops to 0%.

### 6. Action unlocks mid-game
When player reaches certain states, new actions appear:
- Net Worth > $50K → Entrepreneurship Research unlocks
- Academic Impact > 30 → Research NIW becomes worthwhile (shown in action list)
- I-140 approved → "Relax" bonus: Mental decay reduced (passive, not an action)

### 7. Academic Phase with Grind equivalent
During Academic Phase, "拼命 (Intense Study)" replaces Grind Mode: costs 6 AP, GPA +0.4, Mental -8, Health -10. Same risk/reward pattern but for grades instead of performance.

### 8. Two mandatory quarters with reduced AP
If player is sick for 2 consecutive quarters (AP reduced both times), they may not have enough AP for even the cheapest work mode (Coast = 2). If effective_ap < 2: work mode is forced to "On Leave" (0 AP, Performance -10, but keeps job for 1 quarter). If on leave for 2+ consecutive quarters: termination risk.

## Dependencies

### Upstream

| System | Dependency Type | Interface Used |
|--------|----------------|----------------|
| **Attribute System** | Hard | Reads attributes for action unlock conditions; writes attribute deltas |
| **Turn Manager** | Hard | Receives phase signal to start/end player action phase |
| **Health System** | Hard | Receives sickness AP penalty |
| **Mental Health System** | Hard | Receives burnout flag (AP = 0) |
| **Game Data** | Hard | Action definitions, AP costs, attribute deltas from `actions.json` |

### Downstream

| System | Dependency Type | Interface |
|--------|----------------|-----------|
| **Attribute System** | Hard | Queued attribute deltas from selected actions |
| **Probability Engine** | Soft | Job search prep quarters feed into probability modifiers |
| **Immigration System** | Soft | H1B filing flag, NIW research progress |
| **Career System** | Hard | Work mode selection (Performance delta, PIP risk) |
| **Economy System** | Soft | Travel/therapist costs; unemployed state |

### Interface Contract

```
ActionPointSystem.get_effective_ap() → int                    // AP available this quarter
ActionPointSystem.get_available_actions() → list[ActionDef]   // actions the player CAN take (filtered by conditions)
ActionPointSystem.select_work_mode(mode) → int                // returns remaining AP after work mode
ActionPointSystem.select_action(action_id) → int              // returns remaining AP after action; fails if insufficient AP
ActionPointSystem.deselect_action(action_id) → int            // undo a selection; returns updated remaining AP
ActionPointSystem.confirm() → list[ActionResult]              // lock in selections, return queued deltas for resolution
ActionPointSystem.get_selected() → list[ActionDef]            // current selections for UI display
ActionPointSystem.preview_action(action_id) → ActionPreview   // show effects without selecting (for UI tooltip)
```

## Tuning Knobs

| Knob | Default | Safe Range | Too Low | Too High | Affects |
|------|---------|------------|---------|----------|---------|
| `BASE_AP` | 10 | 8-14 | Too few actions per quarter, game feels constrained | Too many actions, no meaningful tradeoffs | Core tension level |
| `GRIND_BONUS_AP` | 3 | 1-5 | Grind barely worth the health cost | Grind is always dominant (too much free AP) | Grind Mode value proposition |
| `COAST_AP_COST` | 2 | 1-3 | Coast is nearly free (everyone coasts) | Coast doesn't free up enough AP to be useful | Coast viability |
| `NORMAL_AP_COST` | 4 | 3-5 | Normal is cheap (no reason to coast) | Normal is expensive (everyone coasts or grinds) | Work mode balance |
| `GRIND_AP_COST` | 6 | 5-8 | Grind is too cheap for its benefits | Grind leaves almost no remaining AP | Grind opportunity cost |
| `UPSKILL_AP_COST` | 2 | 1-3 | Skill growth is too easy | Skills too expensive to maintain | Skill investment cost |
| `JOB_PREP_AP_COST` | 3 | 2-5 | Job searching is cheap (everyone job hops freely) | Job searching is so expensive it locks out other actions | Job change friction |
| `JOB_PREP_BONUS_PER_QUARTER` | 0.10 | 0.05-0.15 | Preparation feels unrewarding | One quarter of prep is enough | Preparation patience reward |
| `JOB_PREP_CAP` | 0.30 | 0.20-0.40 | Cap reached too quickly | Uncapped prep would be too powerful | Job search ceiling |
| `REST_AP_COST` | 2 | 1-3 | Rest is too easy, health/mental trivially maintained | Rest competes too heavily with productive actions | Health maintenance cost |
| `TRAVEL_AP_COST` | 3 | 2-4 | Travel is too cheap (best action every quarter) | Travel is too expensive to justify | Travel value proposition |
| `PUBLISH_PAPER_AP_COST` | 4 | 3-6 | Side papers too easy for SDE (undermines RS advantage) | Side papers nearly impossible (NIW locked for non-RS) | Academic path accessibility |
| `SICKNESS_AP_PENALTY_MIN` | 3 | 2-5 | Sickness is mild | Mild sickness is devastating | Sickness severity floor |
| `SICKNESS_AP_PENALTY_MAX` | 8 | 5-10 | Severe sickness is manageable | Severe sickness = nearly lost quarter | Sickness severity ceiling |

## Acceptance Criteria

### Functional Tests
1. **Base AP**: New quarter starts with 10 AP. Verify `get_effective_ap()` returns 10.
2. **Work mode mandatory**: Player cannot confirm turn without selecting a work mode. UI enforces this.
3. **AP deduction**: Select Normal (4 AP). Verify remaining = 6. Select Upskill (2 AP). Verify remaining = 4.
4. **Grind bonus**: Select Grind. Verify effective AP = 13, remaining after Grind = 7.
5. **Insufficient AP**: With 3 AP remaining, attempt to select action costing 4. Verify rejection.
6. **Deselect**: Select Upskill, then deselect. Verify AP returns to pre-selection value.
7. **Sickness penalty**: Health System reports sickness penalty of 5. Verify effective AP = 5 (10 - 5).
8. **Burnout**: Mental Health System reports burnout. Verify effective AP = 0, no actions available.
9. **Unemployed**: Set employment status to false. Verify work mode is skipped, full 10 AP available.
10. **Mutual exclusion**: Select Travel. Verify Prepare Job Change is greyed out. Deselect Travel. Verify it's available again.
11. **Stacking rule**: Select Rest. Verify Rest cannot be selected again. Verify Exercise CAN still be selected.
12. **Confirm and resolve**: Select Normal + Upskill + Rest. Confirm. Verify 3 ActionResults returned with correct attribute deltas.

### Integration Tests
13. **Action → Attribute**: Select Grind + Upskill. Confirm. After resolution, verify Performance +15, Skills +8, Health -(15 + decay), Mental -(8 + decay).
14. **Job search accumulation**: Prepare Job Change for 2 quarters. Verify offer probability includes +20% prep bonus.
15. **Academic Phase action set**: During turn 1-8, verify career actions are unavailable and academic actions appear.
16. **Conditional unlock**: Net Worth crosses $50K. Verify Entrepreneurship Research appears in available actions next quarter.

### UX Tests
17. **Preview**: Hover/tap an action. Verify tooltip shows AP cost, attribute effects, and any conditions.
18. **Remaining AP display**: Verify remaining AP updates in real-time as player selects/deselects actions.
19. **Warning on risky actions**: Select Travel on H1B. Verify warning message appears about re-entry risk.

## Open Questions

1. **AP banking**: Should unspent AP carry over (even partially) to next quarter? Current design: no. Use it or lose it. This prevents hoarding but may feel wasteful. — Playtest.
2. **Action discovery**: Should all actions be visible from the start, or unlock gradually? Showing everything may overwhelm new players. Hiding actions reduces transparency. — Resolve at Tutorial/Onboarding design.
3. **Seasonal actions**: Should certain actions only be available in specific quarters? (e.g., "Holiday travel" in Q4 with extra Mental bonus) — Nice flavor, defer to Alpha.
4. **Multi-quarter actions**: Should some actions span multiple quarters? (e.g., "Write a book" = 4 AP × 3 quarters for large Academic Impact boost). Current design has only single-quarter actions with persistent flags. — Defer to Vertical Slice.
5. **Action efficiency transparency**: Should the game show AP efficiency metrics (attribute gain per AP)? Helps optimization players but may make the game feel like a spreadsheet. — Resolve at UI design.
