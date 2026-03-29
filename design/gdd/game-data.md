# Game Data System

> **Status**: In Design
> **Author**: user + game-designer
> **Last Updated**: 2026-03-28
> **Implements Pillar**: Pillar 1 (Authenticity First)

## Overview

The Game Data System is the single source of truth for all configurable game values. Every number in the game — salary tables, probability weights, decay rates, event definitions, visa processing times — lives in external data files rather than hardcoded in game logic. This enables rapid balance iteration without code changes, supports data-driven design, and ensures the Attribute System tuning knobs, Probability Engine event definitions, and Economy System parameters can all be adjusted from one place. The system loads data at game start and provides read-only access to all other systems.

## Player Fantasy

The player never interacts with or sees the Game Data System. It is pure infrastructure. Its quality is measured by how authentic the game feels (Pillar 1) — if salary ranges feel wrong, if H1B odds don't match reality, if housing prices are absurd, the data is bad. Good data is invisible; bad data breaks immersion.

## Detailed Design

### Core Rules

#### Data Organization

All game data is organized into config files by domain:

```
data/
├── attributes.json         # Decay rates, thresholds, cross-attribute rules
├── creation.json           # Character creation point pools, attribute ranges
├── careers.json            # Job roles, levels, salary bands, promotion bases
├── immigration.json        # Visa types, processing times, status transitions
├── economy.json            # Tax brackets, cost of living, S&P returns, housing
├── events.json             # Event pool definitions, triggers, consequences
├── probability.json        # Event type definitions (base, weights, floors, caps)
├── economic_cycle.json     # Cycle phase definitions, transition probabilities, modifiers
└── actions.json            # Action definitions, AP costs, attribute deltas
```

#### Data Access Pattern

```
1. Game Start: GameData.load_all() reads all config files
2. Runtime: Systems call GameData.get(domain, key) for read-only access
3. No runtime writes — data is immutable during a game session
4. Hot-reload support for development: reload configs without restarting
```

#### Data Validation

On load, the system validates:
- All required fields are present
- Numeric values are within declared safe ranges (from Tuning Knobs)
- Cross-references are valid (e.g., events referencing existing attribute names)
- No duplicate IDs

Validation failures log warnings in development and prevent game start if critical fields are missing.

### States and Transitions

The Game Data System is stateless — it loads once and serves reads. No transitions, no mutations during gameplay.

### Interactions with Other Systems

| System | Direction | Data Provided |
|--------|-----------|---------------|
| **Attribute System** | Data → Attributes | Decay rates, thresholds, cross-attribute penalty rules, creation attribute ranges |
| **Probability Engine** | Data → Probability | Event type definitions (base probabilities, attribute weights, floors, caps) |
| **Turn Manager** | Data → TM | Timeline config (total turns, academic phase length, special quarter definitions) |
| **Economic Cycle** | Data → Cycle | Phase definitions, transition probabilities, per-event modifiers |
| **Career System** | Data → Career | Job role definitions, level salary bands, promotion base rates per level |
| **Immigration System** | Data → Immigration | Visa type definitions, processing time ranges, status transition rules |
| **Economy System** | Data → Economy | Tax brackets, cost of living by city, historical S&P return model, housing price ranges |
| **Action Point System** | Data → AP | Action definitions with AP costs and attribute delta mappings |
| **Event System** | Data → Events | Full event pool with triggers, text, choices, and consequences |
| **Character Creation** | Data → Creation | Total points, attribute min/max, starting value formulas |

## Formulas

No runtime formulas — the Game Data System is a data store. All formulas live in the systems that consume the data. However, the data files define the **parameters** those formulas use:

### Example: careers.json structure

```json
{
  "sde": {
    "display_name": "Software Development Engineer",
    "levels": {
      "L3": { "salary_min": 120000, "salary_max": 160000, "rsu_annual": 30000, "promotion_base": 0.25 },
      "L4": { "salary_min": 150000, "salary_max": 200000, "rsu_annual": 60000, "promotion_base": 0.20 },
      "L5": { "salary_min": 200000, "salary_max": 280000, "rsu_annual": 100000, "promotion_base": 0.15 },
      "L6": { "salary_min": 280000, "salary_max": 400000, "rsu_annual": 180000, "promotion_base": 0.08 },
      "L7": { "salary_min": 400000, "salary_max": 600000, "rsu_annual": 300000, "promotion_base": 0.03 }
    },
    "pip_base": 0.05,
    "h1b_friendly": true,
    "academic_impact_per_quarter": 0
  }
}
```

### Example: immigration.json structure

```json
{
  "visa_types": {
    "f1": { "duration_quarters": null, "work_authorized": false, "tied_to_school": true },
    "opt": { "duration_quarters": 4, "stem_extension_quarters": 8, "work_authorized": true },
    "h1b": { "duration_quarters": 12, "renewable": true, "tied_to_employer": true },
    "combo_card": { "work_authorized": true, "tied_to_employer": false, "travel_authorized": true }
  },
  "perm_processing": {
    "base_quarters": 3,
    "audit_extra_quarters_min": 2,
    "audit_extra_quarters_max": 6
  },
  "green_card_queues": {
    "eb2_china": { "base_wait_quarters": 32, "variance_quarters": 12 },
    "eb3_china": { "base_wait_quarters": 40, "variance_quarters": 16 }
  }
}
```

### Example: events.json structure

```json
{
  "layoff_wave": {
    "id": "layoff_wave",
    "type": "crisis",
    "trigger": { "economic_cycle": "recession", "probability": 0.15 },
    "text_key": "event_layoff_wave",
    "effects_immediate": [
      { "attribute": "mental", "delta": -25 }
    ],
    "choices": [
      {
        "id": "panic_apply",
        "text_key": "event_layoff_panic_apply",
        "tag": "stable",
        "effects": [ { "flag": "job_hunting_urgent", "duration_quarters": 2 } ]
      },
      {
        "id": "selective_apply",
        "text_key": "event_layoff_selective",
        "tag": "risky",
        "effects": [ { "flag": "job_hunting_selective", "duration_quarters": 2 } ]
      },
      {
        "id": "day1_cpt",
        "text_key": "event_layoff_cpt",
        "tag": "desperate",
        "effects": [ { "attribute": "net_worth", "delta": -15000 }, { "visa_change": "f1" } ]
      }
    ]
  }
}
```

### Localization Integration

All player-facing text is referenced by `text_key`, not stored directly in data files. A separate localization layer (out of scope for this GDD) maps text_keys to Chinese strings. This keeps game data language-independent.

## Edge Cases

### 1. Missing data file
Game refuses to start. Displays error: "Missing required data file: [filename]". No fallback defaults — explicit failure is safer than silent wrong values.

### 2. Invalid cross-reference
Event references attribute "charisma" which doesn't exist. Caught at validation. Logged as error, event is disabled for the session.

### 3. Salary band overlap between levels
L4 max ($200K) overlaps with L5 min ($200K). This is intentional — promotion doesn't always mean immediate raise. The actual salary within the band is determined by the Career System.

### 4. Balance patch mid-session
Data is loaded once at game start. Changing config files mid-session has no effect unless hot-reload is triggered (development only). Players complete a run with the data they started with.

### 5. Version migration
If data format changes between game versions, a migration script converts old saves. Data version number is stored in each config file header.

## Dependencies

### Upstream
None — Foundation layer. Reads from filesystem only.

### Downstream
Every system in the game reads from Game Data. It is a universal dependency.

### Interface Contract

```
GameData.load_all() → void                    // called once at game start
GameData.get(domain, key) → value             // e.g., get("careers", "sde.levels.L5.salary_min")
GameData.get_list(domain) → list              // e.g., get_list("events") returns all events
GameData.get_event(event_id) → EventDef       // convenience for event lookup
GameData.validate() → list[ValidationError]   // run on load, returns any issues found
GameData.reload() → void                      // development only: hot-reload all files
```

## Tuning Knobs

The Game Data System itself has minimal tuning knobs — it IS the tuning knobs for every other system. Its own configuration:

| Knob | Default | Safe Range | Affects |
|------|---------|------------|---------|
| `DATA_DIRECTORY` | "data/" | any valid path | Where config files are located |
| `VALIDATE_ON_LOAD` | true | true/false | Whether to run validation at startup |
| `HOT_RELOAD_ENABLED` | false (true in dev) | true/false | Allow runtime config reload |

All gameplay tuning knobs are defined in their respective system GDDs and stored in the corresponding data files. See:
- `attributes.json` → Attribute System tuning knobs (19 knobs)
- `probability.json` → Probability Engine tuning knobs (10 knobs)
- `turn_manager.json` → Turn Manager tuning knobs (7 knobs)

## Acceptance Criteria

### Functional Tests
1. **Load all**: Call `load_all()` with valid data files. Verify no errors, all domains accessible.
2. **Missing file**: Remove one data file. Verify game refuses to start with clear error message.
3. **Get value**: Load data, call `get("careers", "sde.levels.L5.salary_min")`. Verify returns 200000.
4. **Get list**: Call `get_list("events")`. Verify returns all event definitions.
5. **Validation - missing field**: Remove "base" from a probability event definition. Verify validation catches it.
6. **Validation - invalid cross-reference**: Add event referencing nonexistent attribute. Verify validation catches it.
7. **Immutability**: Attempt to modify a value returned by `get()`. Verify the source data is unchanged on next `get()`.
8. **Hot reload (dev)**: Modify a data file, call `reload()`. Verify new values are returned by subsequent `get()` calls.

### Integration Tests
9. **Attribute System reads config**: Verify Attribute System reads decay rates from `attributes.json` and applies them correctly.
10. **Probability Engine reads config**: Verify Probability Engine reads event type definitions from `probability.json` and computes correct probabilities.
11. **Salary authenticity**: Verify SDE L5 salary range ($200K-$280K) is in the correct real-world ballpark for 2024 US tech.
12. **H1B lottery rate**: Verify H1B lottery base probability is 0.27, matching real-world 2024 data.

### Data Quality Tests
13. **All events have text_keys**: Every event in `events.json` references a valid text_key.
14. **All careers have all levels**: Every career path in `careers.json` defines L3 through L7.
15. **No salary inversions**: For each career, verify L(N+1) salary_min >= L(N) salary_min.

## Open Questions

1. **Data file format**: JSON is simple and readable. Should we use a more structured format (TOML, YAML) for better comments and organization? — Decide at implementation.
2. **Real-world data sourcing**: Where do we get authoritative salary, visa processing time, and housing price data? Levels.fyi for salaries, USCIS data for visa times, Zillow/Redfin for housing. — Research task before Alpha.
3. **Mod support**: Should data files be player-editable for custom scenarios? ("What if H1B was 50%?") — Fun feature, defer to Full Vision.
4. **Data compression**: For web/mobile, should data files be compressed? At current scope (< 100KB total) probably not needed. — Revisit if content grows.
