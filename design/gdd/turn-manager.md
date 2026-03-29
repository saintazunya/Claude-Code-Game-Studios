# Turn Manager

> **Status**: In Design
> **Author**: user + game-designer
> **Last Updated**: 2026-03-28
> **Implements Pillar**: Pillar 3 (Time Is the Ultimate Currency)

## Overview

The Turn Manager is the heartbeat of the game — it drives the quarterly cycle from age 22 to age 59 (148 turns). It owns the game clock, orchestrates the phase sequence within each turn, triggers annual events (Q4 performance review, Q2 H1B lottery), detects game-over conditions, and manages the transition between the Academic Phase (prologue) and the Career Phase (main game). The player never interacts with the Turn Manager directly; they experience it as the rhythm of "allocate → resolve → events → next quarter."

## Player Fantasy

The player should feel **relentless forward momentum**. Time never pauses, never rewinds. Every quarter that passes is gone forever. The Turn Manager delivers Pillar 3 (Time Is the Ultimate Currency) — the constant ticking of the game clock creates urgency. When the player sees "Turn 120/148 — Age 52" they should feel the weight of years spent and years remaining. The quarterly pace means each turn carries real consequence — a wasted quarter at age 50 hurts far more than one at age 25.

## Detailed Design

### Core Rules

#### Game Timeline

```
Academic Phase:  Age 22-24 (turns 1-8, or 1-16 if PhD)
Career Phase:    Age 24-59 (turns 9-148, or 17-148 if PhD)
Game End:        Turn 148 (age 59) OR early termination
```

Total: 148 quarterly turns. PhD extends Academic Phase by 8 additional turns (2 years) but does NOT add turns to the total — the game always ends at age 59. PhD players enter Career Phase later, with fewer turns remaining.

#### Turn Structure (Phase Sequence)

Each turn executes these phases in strict order:

```
1. QUARTER START
   - Advance game clock (quarter++, update age/year/Q)
   - Update Economic Cycle state (may transition)
   - Check: is this a special quarter? (Q2 = H1B season, Q4 = performance review)

2. STATUS DISPLAY
   - Show player: current date, age, visa status, all attributes, AP available
   - Show any pending deadlines (visa expiry countdown, PERM processing, etc.)

3. PLAYER ACTION PHASE
   - Player selects work mode (躺平/正常/卷王)
   - Player allocates remaining AP to available actions
   - Player confirms selections

4. ACTION RESOLUTION
   - Apply deterministic attribute changes from actions (Performance +X, Health -Y, etc.)
   - Apply natural decay to attributes (Performance, Skills, Health, Mental)
   - Process passive systems (S&P 500 auto-invest, mortgage payment, salary deposit)
   - Advance immigration status timers (PERM processing quarters, I-140 wait, etc.)

5. PROBABILITY CHECKS
   - Execute scheduled probability rolls for this quarter:
     * Sickness check (every quarter)
     * PIP check (if Performance < 30)
     * Burnout check (if Mental < 30)
     * Layoff check (if economic recession active)
     * Promotion check (Q4 only)
     * H1B lottery (Q2, if application filed)
     * Other immigration milestone checks

6. EVENT PHASE
   - Roll for random events (0-2 events per quarter)
   - Present events to player with choices
   - Apply event consequences (attribute changes, state changes)

7. QUARTER END
   - Clamp all attributes to valid ranges
   - Update visa countdown timers
   - Record quarter summary (deltas, events, decisions) for timeline
   - Check game-over conditions
   - If not game over: return to Phase 1
```

#### Special Quarters

| Quarter | Annual Event | Triggered System |
|---------|-------------|-----------------|
| Q2 (Apr-Jun) | H1B lottery results | Immigration System |
| Q4 (Oct-Dec) | Annual performance review | Career System |
| Q4 | Visa bulletin update (green card priority date movement) | Immigration System |
| Q1 (Jan-Mar) | Tax season — annual tax calculation | Economy System |
| Any | Random events (0-2 per quarter) | Event System |

#### Academic Phase vs Career Phase

The Turn Manager operates in two modes:

**Academic Phase (turns 1-8/16)**:
- Available actions are different: GPA study, intern search, networking, thesis work (PhD)
- Work mode selection is replaced by study intensity (轻松/正常/拼命)
- No immigration actions available (on F1 student visa)
- PhD decision point: at end of Master's (turn 8), player chooses to enter Career Phase or continue to PhD

**Career Phase (turns 9+/17+)**:
- Full action set available
- Work mode selection (躺平/正常/卷王)
- Immigration actions unlocked
- Economic system fully active

The transition is a one-time event: Academic Phase → Career Phase. No going back (unless Day-1 CPT event forces return to student status, handled by Immigration System).

#### Game-Over Conditions

Checked at Phase 7 (Quarter End) every turn:

| Condition | Trigger | Result |
|-----------|---------|--------|
| **Visa Expiry** | Visa countdown reaches 0 with no valid status and no pending application | Deportation — game ends, score with penalty |
| **Age 59 Reached** | Turn 148 completed | Normal ending — score based on Net Worth + green card status |
| **Voluntary Departure** | Player chooses to return to China (event option) | Early ending — score with current Net Worth |

There is NO health-based game over. Hospitalization is punishing (lose a quarter) but not fatal. The game is about immigration, not survival.

#### Timeline Recording

Every turn, the Turn Manager records a `QuarterRecord`:
```
{
    turn_number: int,
    year: int,
    quarter: int (1-4),
    age: int,
    attribute_deltas: dict,
    events: list[Event],
    decisions: list[Decision],
    milestone: string? (e.g., "H1B approved", "Promoted to L5")
}
```

This powers the end-game timeline visualization. Milestone events are flagged for prominent display.

### States and Transitions

The Turn Manager itself is a simple state machine:

```
GAME_START → ACADEMIC_PHASE → [PhD decision] → CAREER_PHASE → GAME_END
                                    ↓
                              ACADEMIC_PHASE_PHD → CAREER_PHASE → GAME_END
```

Within each phase, the turn cycle repeats (phases 1-7) until a game-over condition or phase transition is triggered.

Game-end substates:
- `END_VISA_EXPIRY` — deportation
- `END_AGE_59` — normal completion
- `END_VOLUNTARY_DEPARTURE` — player chose to leave

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Attribute System** | TM → Attributes | Triggers natural decay at Phase 4; triggers clamp at Phase 7 |
| **Action Point System** | TM → AP | Signals start of Player Action Phase (Phase 3); collects resolved actions |
| **Probability Engine** | TM → Probability | Triggers scheduled probability checks at Phase 5 |
| **Economic Cycle** | TM → Cycle | Signals quarter start; Cycle may transition state |
| **Economy System** | TM → Economy | Triggers passive economic processing at Phase 4 (salary, invest, expenses) |
| **Career System** | TM → Career | Triggers Q4 performance review |
| **Immigration System** | TM → Immigration | Triggers Q2 H1B lottery, advances processing timers, checks visa countdown |
| **Health System** | TM → Health | Triggers sickness probability check at Phase 5 |
| **Mental Health System** | TM → Mental | Triggers burnout check at Phase 5 |
| **Event System** | TM → Events | Triggers random event roll at Phase 6 |
| **Academic Phase** | TM → Academic | Manages academic-specific turn logic for turns 1-8/16 |
| **UI Systems** | TM → UI | Signals phase transitions for UI state changes (action phase, event popup, summary) |

## Formulas

### Game Clock

```
year = 2024 + (turn_number - 1) / 4      // starts 2024 Q1 (age 22)
quarter = ((turn_number - 1) % 4) + 1     // 1-4
age = 22 + (turn_number - 1) / 4          // integer division
```

### PhD Timeline Adjustment

```
if chose_phd:
    career_start_turn = 17                // 4 extra years of academic phase
    career_start_age = 26
else:
    career_start_turn = 9                 // 2 years of master's
    career_start_age = 24

remaining_career_turns = 148 - career_start_turn
```

PhD gives 131 career turns vs Master's 139 career turns — 8 fewer quarters (2 years) to achieve green card and accumulate wealth.

### Visa Countdown

```
visa_quarters_remaining = visa_expiry_turn - current_turn
if visa_quarters_remaining <= 4:
    ui_urgency = "critical"               // red warning
elif visa_quarters_remaining <= 8:
    ui_urgency = "warning"                // yellow warning
```

### Random Event Count Per Quarter

```
event_count = weighted_random({
    0: 0.30,    // 30% chance: quiet quarter
    1: 0.50,    // 50% chance: one event
    2: 0.20     // 20% chance: eventful quarter
})
```

## Edge Cases

### 1. PhD decision at turn 8 when visa expiry is near
F1 visa covers the full study period. Choosing PhD automatically extends F1. No conflict — Academic Phase is always visa-safe.

### 2. Multiple game-over conditions trigger simultaneously
Priority order: Visa Expiry > Age 59 > Voluntary Departure. Only the highest-priority ending fires. E.g., if visa expires on the same turn as age 59, the ending is "Deportation" not "Normal completion."

### 3. Event at Phase 6 changes attributes that affect Phase 5 rolls
Phase 5 (probability checks) runs BEFORE Phase 6 (events). Events cannot retroactively affect this turn's probability rolls. They affect next turn's state.

### 4. Player has no valid actions (all AP consumed by work mode)
If work mode consumes all AP (卷王 = 6 AP, but base is 10, leaving 4-7), the player can always take at least one additional action. If health/mental penalties reduce effective AP to 0 (via sickness/burnout forced rest), the turn auto-resolves with no player actions.

### 5. Turn 148 with pending immigration application
Green card application still pending at age 59 = not approved. Score calculated without green card bonus. "So close, yet so far" ending variant.

### 6. Academic Phase event forces early Career Phase entry
If a player drops out of school (event or choice), they enter Career Phase early with incomplete degree. Massive Skills penalty, no OPT, severely limited job options. Effectively a death spiral — possible but extremely punishing.

## Dependencies

### Upstream
None — the Turn Manager is a Foundation-layer system. It reads the Game Data System for timeline configuration but has no hard runtime dependencies.

### Downstream
Every system in the game depends on the Turn Manager's phase signals. It is the orchestrator — all other systems are responders.

### Interface Contract

The Turn Manager exposes:
- `get_turn() → int` — current turn number (1-148)
- `get_date() → { year, quarter, age }` — current game date
- `get_phase() → string` — current game phase ("academic", "career")
- `get_turn_phase() → string` — current phase within the turn ("action", "resolution", "events", etc.)
- `is_special_quarter(type) → bool` — check if current quarter triggers a specific event type
- `get_timeline() → list[QuarterRecord]` — full history for endgame display

Events emitted:
- `on_quarter_start(turn_number, year, quarter)`
- `on_phase_change(new_phase)` — academic → career transition
- `on_game_end(end_type, final_state)`

## Tuning Knobs

| Knob | Default | Safe Range | Too Low | Too High | Affects |
|------|---------|------------|---------|----------|---------|
| `TOTAL_TURNS` | 148 | 100-200 | Game feels rushed, not enough time to execute strategies | Sessions too long for mobile, pacing drags | Session length |
| `ACADEMIC_TURNS_MASTER` | 8 | 4-12 | Academic phase too brief, intern feels trivial | Too long before "real game" starts | Early game pacing |
| `ACADEMIC_TURNS_PHD` | 16 | 12-24 | PhD too short, doesn't feel like a real commitment | PhD penalty too severe, nobody picks it | PhD viability |
| `EVENT_PROB_0` | 0.30 | 0.20-0.50 | Too many events, overwhelming | Too quiet, game feels static | Event density |
| `EVENT_PROB_1` | 0.50 | 0.30-0.60 | — | — | Event density |
| `EVENT_PROB_2` | 0.20 | 0.05-0.30 | Double events are rare | Double events too frequent, chaotic | Chaos factor |
| `GAME_START_YEAR` | 2024 | 2020-2030 | Historical period may not match current player experience | Future setting feels speculative | Immersion |

## Acceptance Criteria

### Functional Tests
1. **148 turns**: Start a game, skip through all turns. Verify game ends at turn 148 with age 59.
2. **Clock accuracy**: At turn 1: year 2024, Q1, age 22. At turn 48: year 2035, Q4, age 33. Verify formula.
3. **Phase sequence**: Verify each turn executes phases 1-7 in strict order. No phase is skipped.
4. **Q2 H1B trigger**: At turns where quarter = 2, verify H1B lottery check is triggered (if application was filed).
5. **Q4 performance review**: At turns where quarter = 4, verify performance review is triggered.
6. **PhD timeline**: Choose PhD. Verify Academic Phase lasts 16 turns, Career Phase starts at turn 17, remaining career turns = 131.
7. **Game-over: visa expiry**: Set visa countdown to 0 with no valid status. Verify game ends with deportation ending.
8. **Game-over: age 59**: Play through turn 148. Verify normal ending triggers with score screen.
9. **Timeline recording**: Play 10 turns. Verify `get_timeline()` returns 10 QuarterRecords with correct data.
10. **Event count distribution**: Run 1000 quarters. Verify event counts approximate 30%/50%/20% distribution.

### Integration Tests
11. **Full turn cycle**: Execute one complete turn with work action, verify: AP consumed → attributes updated → decay applied → probability checks run → events generated → attributes clamped → quarter recorded.
12. **Academic → Career transition**: Complete Master's (8 turns). Verify available actions change, work mode unlocks, immigration actions appear.
13. **Forced rest override**: Trigger hospitalization. Verify next turn's Player Action Phase is skipped (auto-resolved with rest).

## Open Questions

1. **Speed controls**: Should the player be able to "fast-forward" through quarters with preset actions? Useful for late-game when strategy is set. — Defer to UI design.
2. **Flashback/rewind**: Should there be a limited undo (go back 1 quarter)? Reduces frustration but undermines Pillar 3. — Probably no, but playtest.
3. **Variable turn count by difficulty**: Easy mode = 160 turns (more time), Hard mode = 120 turns (less time)? — Defer to after MVP balance testing.
4. **Mid-career PhD**: Can the player go back to school mid-career (not just Day-1 CPT for visa, but a real PhD)? Adds complexity. — Defer to Alpha.
