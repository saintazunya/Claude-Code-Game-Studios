# Random Event System

> **Status**: In Design
> **Author**: user + game-designer
> **Last Updated**: 2026-03-28
> **Implements Pillar**: Pillar 4 (Emergent Stories), Pillar 1 (Authenticity First)

## Overview

The Random Event System is the narrative engine of the game — it selects, triggers, and resolves events that disrupt and enrich the player's carefully laid plans. Events range from crises (layoff, H1B denial, market crash) to opportunities (acqui-hire offer, priority date jump, boss change) to life moments (cultural friction, family events, community encounters). Each event presents the player with 2-3 choices that have meaningful consequences. Events are the primary source of emergent storytelling — two runs with identical builds will diverge wildly based on which events fire and what the player chooses.

The system is a framework — it defines HOW events work. The Event Database (separate GDD) defines WHAT events exist.

## Player Fantasy

The player should feel that **life keeps happening whether they're ready or not**. A perfectly planned quarter can be derailed by a layoff wave. A desperate situation can be saved by an unexpected opportunity. Events are the game saying "you're not in full control" — and that's what makes each run a unique story worth telling.

## Detailed Design

### Core Rules

#### Event Trigger Flow (Turn Manager Phase 6)

```
1. Determine event count for this quarter:
   event_count = weighted_random({ 0: 0.30, 1: 0.50, 2: 0.20 })

2. For each event slot:
   a. Build eligible event pool:
      - Filter by preconditions (economic cycle, career state, visa status, etc.)
      - Filter by cooldown (events have minimum quarters between repeats)
      - Filter by phase (academic vs career events)
      - Remove events the player has already seen this run (if one-time)
   b. Weight eligible events by current context:
      - Crisis events weighted higher during recession
      - Career events weighted higher at review time (Q4)
      - Immigration events weighted higher near visa deadlines
   c. Select one event via weighted random from eligible pool
   d. Present event to player with choices
   e. Apply chosen consequence

3. Record events in QuarterRecord for timeline
```

#### Event Structure

Each event is defined in the Event Database with this structure:

```
Event {
    id: string
    type: "crisis" | "opportunity" | "life" | "immigration" | "career" | "economic"
    preconditions: list[Condition]       // must ALL be true to enter eligible pool
    weight: float                        // base selection weight
    weight_modifiers: list[WeightMod]    // contextual weight adjustments
    cooldown_quarters: int               // minimum quarters before this event can fire again
    one_time: bool                       // if true, only fires once per run
    phase: "academic" | "career" | "any"
    text_key: string                     // localization key for event description
    immediate_effects: list[Effect]      // applied before player choice
    choices: list[Choice]                // 2-3 options for the player
}

Choice {
    id: string
    text_key: string
    tag: "stable" | "risky" | "desperate" | "costly" | "neutral"
    effects: list[Effect]
    probability_effects: list[ProbEffect]  // some choices trigger probability rolls
}

Effect {
    type: "attribute" | "flag" | "economy" | "career" | "immigration" | "event_chain"
    target: string
    value: varies
}
```

#### Event Categories

| Category | Frequency | Examples | Purpose |
|----------|-----------|---------|---------|
| **Crisis** | Low (higher in recession) | Layoff wave, H1B denial, PERM audit, market crash, sickness | Create dramatic tension and test backup plans |
| **Opportunity** | Low-Medium | Acqui-hire offer, conference invitation, priority date jump, recruiter call | Reward and present tempting choices |
| **Career** | Medium | Reorg, new boss, project cancellation, performance bonus, team conflict | Keep workplace dynamic and unpredictable |
| **Immigration** | Medium | Policy change, priority date shift, visa bulletin update, lawyer recommendation | Drive immigration drama |
| **Life** | Medium | Cultural friction, holiday loneliness, family news from China, community connection | Inject emotional resonance |
| **Economic** | Low-Medium | Housing market shift, tech bubble, crypto event, tax law change | Affect financial strategy |

#### Event Chaining

Some events can trigger follow-up events in subsequent quarters:

```
Event "Layoff Warning" (Q1) → if not resolved → Event "Actual Layoff" (Q2)
Event "Company Acquisition Rumor" → 50% → "Acquisition Confirmed" (next quarter)
Event "Family Emergency in China" → if player travels → "Visa Stamp Issue at Consulate"
```

Chains create multi-quarter narrative arcs within the emergent story framework.

#### Choice Tags and UI

Each choice has a tag that affects UI presentation:
- **stable**: Blue accent — lower risk, lower reward
- **risky**: Purple accent — higher reward but chance of failure
- **desperate**: Red accent — last resort option with severe tradeoffs
- **costly**: Gold accent — spend money to solve the problem
- **neutral**: Gray accent — a lateral move, neither good nor bad

### States and Transitions

The Event System is stateless per-quarter — it selects and resolves events within Phase 6 of each turn. Persistent state is managed through:
- **Event cooldowns**: tracked per event ID (quarters since last fire)
- **One-time flags**: track which one-time events have already fired
- **Active chains**: track which event chains are in progress

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Turn Manager** | TM → Events | Phase 6 signal to run event selection and resolution |
| **Attribute System** | Events ↔ Attributes | Events read attributes for preconditions; event effects modify attributes |
| **Probability Engine** | Events → Probability | Some choices trigger probability rolls (e.g., "risky" choices) |
| **Economic Cycle** | Cycle → Events | Phase determines which events are in the eligible pool and weights |
| **Career System** | Career ↔ Events | Career state affects preconditions; career events modify company/boss |
| **Immigration System** | Immigration ↔ Events | Visa status affects preconditions; immigration events modify status |
| **Economy System** | Economy ↔ Events | Net worth/financial state affects preconditions; events have financial effects |
| **Health System** | Health ↔ Events | Health triggers sickness events; event choices can affect health |
| **Mental Health System** | Mental ↔ Events | Events produce mental deltas; mental state affects some preconditions |
| **Game Data** | Data → Events | Event definitions loaded from `events.json` |

## Formulas

### Event Count Per Quarter
```
event_count = weighted_random({ 0: 0.30, 1: 0.50, 2: 0.20 })
// Average: 0.9 events per quarter
// Over 148 turns: ~133 total events
// With 50-80 unique events in pool: most events fire 1-2 times per run
```

### Event Selection Weight
```
base_weight = event.weight
contextual_weight = base_weight × Π(applicable weight_modifiers)
// Example: "Layoff Wave" has base_weight 1.0
// During recession: weight_modifier 3.0 → effective weight 3.0
// Not in recession: weight_modifier 0.3 → effective weight 0.3

selection_probability = contextual_weight / Σ(all eligible event weights)
```

### Risky Choice Resolution
```
// When player picks a "risky" choice:
success = Probability Engine roll(choice.probability_event)
if success:
    apply choice.success_effects
else:
    apply choice.failure_effects
```

## Edge Cases

### 1. No eligible events
All events filtered out by preconditions/cooldowns. Quarter has 0 events. This is fine — quiet quarters exist.

### 2. Two conflicting events in same quarter
Two events fire that have contradictory effects (e.g., "Promotion" and "Layoff"). Resolution order: events are resolved sequentially. Second event sees the state AFTER first event's effects. If the first event makes the second's preconditions invalid, the second is replaced with a new roll.

### 3. Event fires during Academic Phase
Only events with `phase: "academic"` or `phase: "any"` are eligible. Career-specific events cannot fire during Academic Phase.

### 4. One-time event already fired
Filtered out of eligible pool. Guaranteed to never repeat.

### 5. Player ignores event consequences
Some events have no "ignore" option — all choices have consequences. The player must choose. If all choices are bad, that's intentional (Pillar 2).

## Tuning Knobs

| Knob | Default | Safe Range | Affects |
|------|---------|------------|---------|
| `EVENT_PROB_0` | 0.30 | 0.20-0.50 | Quiet quarter frequency |
| `EVENT_PROB_1` | 0.50 | 0.30-0.60 | Single event frequency |
| `EVENT_PROB_2` | 0.20 | 0.05-0.30 | Double event frequency (chaos) |
| `CRISIS_RECESSION_WEIGHT_MULT` | 3.0 | 2.0-5.0 | How much recession amplifies crisis events |
| `DEFAULT_COOLDOWN` | 4 quarters | 2-8 | Minimum gap between repeats of same event |
| `MAX_CHAIN_LENGTH` | 3 | 2-5 | Maximum events in a chain sequence |

## Acceptance Criteria

### Functional Tests
1. **Event count distribution**: Run 1000 quarters. Verify 0/1/2 event distribution matches weights (30%/50%/20% ±3%).
2. **Precondition filtering**: Set career phase. Verify academic-only events are excluded.
3. **Cooldown enforcement**: Fire event X. Verify event X cannot fire again for cooldown_quarters turns.
4. **One-time event**: Fire one-time event. Verify it never appears in eligible pool again.
5. **Weight modification**: Set economic cycle to recession. Verify crisis event weights are multiplied.
6. **Choice resolution**: Select a "risky" choice. Verify probability roll occurs and correct effects applied.
7. **Event chain**: Trigger chain event. Verify follow-up event fires in the specified future quarter.
8. **Event recording**: Fire 2 events. Verify both appear in QuarterRecord for timeline.

### Integration Tests
9. **Event → Attribute**: Fire event with attribute effect (Mental -20). Verify Attribute System reflects change.
10. **Event → Economy**: Fire event with financial cost ($5,000). Verify Economy System deducts amount.
11. **Event → Career**: Fire "Reorg" event. Verify boss type changes in Career System.
12. **Event → Immigration**: Fire "Policy Change" event. Verify Immigration System modifiers update.
