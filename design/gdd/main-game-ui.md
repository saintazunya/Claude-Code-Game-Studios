# Main Game UI

> **Status**: In Design
> **Author**: user + game-designer
> **Last Updated**: 2026-03-28
> **Implements Pillar**: Pillar 5 (Learnable Depth)

## Overview

The Main Game UI is the primary screen the player interacts with every quarter — it displays the status dashboard (date, age, visa, attributes, AP), the work mode selector, and the action allocation panel. This screen IS the game for 90% of play time. It must be touch-first (mobile primary), information-dense but not overwhelming, and make the "Action → Attribute → Probability → Outcome" chain visible and learnable. All text is displayed in Chinese.

## Player Fantasy

The player should feel like they have a **command center for their life**. Every piece of information they need to make decisions is visible or one tap away. The dashboard should evoke the feeling of checking your bank account, visa status, and performance review all at once — the specific anxiety of immigrant life condensed into one screen.

## Detailed Design

### Screen Layout (Mobile Portrait)

```
┌─────────────────────────────┐
│ Header: Date | Age | Visa   │  ← Fixed top bar
├─────────────────────────────┤
│ Stats Grid (2×2)            │  ← Net Worth, Career, Income, GC Progress
│  ┌───────┐ ┌───────┐       │
│  │NW $38K│ │SDE L4 │       │
│  └───────┘ └───────┘       │
│  ┌───────┐ ┌───────┐       │
│  │$8.5K/m│ │GC:N/A │       │
│  └───────┘ └───────┘       │
├─────────────────────────────┤
│ Health Bar  ████████░░ 62%  │
│ Mental Bar  ██████░░░░ 45%  │
├─────────────────────────────┤
│ 卷王 Toggle [OFF/ON]        │  ← Grind Mode switch
├─────────────────────────────┤
│ Work Mode: 躺平/正常/卷王   │  ← Three-way selector
├─────────────────────────────┤
│ Action List (scrollable)    │  ← Available actions with AP costs
│  [x] 准备跳槽      3 AP    │
│  [ ] 休息调整       2 AP    │
│  [ ] 定投S&P       free    │
│  ...                        │
├─────────────────────────────┤
│ [  结束本季度 ➜  ] AP: 3/10 │  ← Confirm button + AP counter
└─────────────────────────────┘
```

### Key UI Components

**Header Bar**: Date (年/季度), Age, Visa type badge with color (green=safe, yellow=warning, red=critical), Turn counter (X/148).

**Stats Grid**: 4 cards showing the most critical numbers. Each card is tappable for detail popup. Net Worth shows quarterly delta (+/-). Career shows company + level. Income shows after-tax quarterly. GC Progress shows current stage or "未提交".

**Attribute Bars**: Health and Mental as horizontal bars with percentage and state label. Color gradient: green (>70) → yellow (30-70) → red (<30). Flash animation when entering Critical/At Risk state.

**Grind Mode Toggle**: Prominent toggle switch with red glow when active. Shows AP bonus (+3) and health/mental cost in tooltip. Disabled when Grind is locked (post-sickness cooldown) with lock icon and quarters remaining.

**Work Mode Selector**: Three large buttons (躺平/正常/卷王). Selected mode highlighted. AP cost and effects shown inline. 卷王 button is red-tinted. After selection, remaining AP updates immediately.

**Action List**: Scrollable list of available actions. Each action shows: icon, name (Chinese), AP cost, brief effect description. Selected actions have blue highlight border. Greyed out if insufficient AP or preconditions not met. Tooltip on tap shows full effects and probability previews (from Probability Engine). Free actions (S&P invest, review status) shown at bottom with "free" tag.

**Confirm Button**: Large bottom button "结束本季度 ➜". Shows remaining AP (warns if unspent). Disabled until work mode is selected. Tap triggers Turn Manager Phase 4-7.

### Information Hierarchy

1. **Always visible**: Date, age, visa status, Net Worth, career level, Health bar, Mental bar, AP remaining
2. **One tap away**: Attribute details, probability previews, financial breakdown, immigration status detail
3. **Deep dive**: Full event history, timeline, formula breakdowns

### Responsive Design

Mobile (primary): Single column, everything stacked vertically, large touch targets (min 44px).
Tablet/Web: Two-column layout — left column for status, right column for actions. More information visible simultaneously.

## Dependencies

| System | Direction | Data Displayed |
|--------|-----------|---------------|
| **Attribute System** | Reads | All 6 core attributes + school modifier |
| **Action Point System** | Reads/Writes | AP budget, available actions, selections |
| **Economy System** | Reads | Net Worth, quarterly income, cash on hand |
| **Career System** | Reads | Level, company name, city |
| **Immigration System** | Reads | Visa type, countdown, GC progress stage |
| **Health System** | Reads | Health value, sickness probability, Grind lock status |
| **Mental Health System** | Reads | Mental value, burnout risk |
| **Economic Cycle** | Reads | Current phase (displayed as market indicator) |
| **Turn Manager** | Events | Phase signals to update UI state |

## Acceptance Criteria

1. **All critical info visible**: Without scrolling, player can see date, age, visa, Net Worth, career, Health, Mental, AP.
2. **Touch targets**: All interactive elements ≥ 44×44px on mobile.
3. **AP updates in real-time**: Selecting/deselecting actions updates remaining AP counter immediately.
4. **Grind lock visible**: When Grind is locked, toggle shows lock icon with "X季度后解锁".
5. **Probability preview**: Tapping an action shows expected attribute changes and any probability rolls involved.
6. **Visa urgency colors**: Visa badge is green (>8 quarters), yellow (4-8), red (<4), flashing red (<2).
7. **Confirm requires work mode**: Confirm button is disabled until a work mode is selected.
8. **Unspent AP warning**: If player confirms with >2 AP unspent, show "确定不用剩余行动点?" confirmation.
9. **Chinese text**: All player-facing text displayed in Chinese.
10. **Responsive**: UI is usable on 375px wide screen (iPhone SE) and scales to tablet/desktop.
