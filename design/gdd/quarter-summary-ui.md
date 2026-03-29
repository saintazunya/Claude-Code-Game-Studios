# Quarter Summary UI

> **Status**: In Design
> **Author**: user + game-designer
> **Last Updated**: 2026-03-28
> **Implements Pillar**: Pillar 5 (Learnable Depth)

## Overview

The Quarter Summary UI appears at the end of each turn (Turn Manager Phase 7) showing what changed this quarter: attribute deltas, financial changes, event outcomes, immigration progress, and any milestones. This screen is the player's feedback loop — it shows the consequences of their decisions and helps them learn the system. All text in Chinese.

## Detailed Design

### Summary Screen Layout

```
┌─────────────────────────────┐
│ 2028年 Q1 季度总结           │
├─────────────────────────────┤
│ Attribute Changes:          │
│ 绩效  65 → 72  (+7) ↑      │
│ 技能  45 → 47  (+2) ↑      │
│ 健康  70 → 53  (-17) ↓↓    │
│ 精神  55 → 48  (-7) ↓      │
├─────────────────────────────┤
│ Financial Summary:          │
│ 收入: +$18,500              │
│ 支出: -$12,300              │
│ 净流入: +$6,200             │
│ 净资产: $142,000 (+$8,400)  │
│ S&P: $85,000 (+$2,200)     │
├─────────────────────────────┤
│ Events This Quarter:        │
│ 🏢 团队重组 — 选择了适应    │
├─────────────────────────────┤
│ Immigration:                │
│ 📋 H-1B 有效 (剩余8季度)   │
│ PERM: 审批中 (第3季度)      │
├─────────────────────────────┤
│ [继续 ➜]                    │
└─────────────────────────────┘
```

### Visual Design

- **Attribute deltas**: Green for positive, red for negative. Double arrows (↑↑/↓↓) for large changes (>10). Flash animation on critical changes.
- **Financial**: Clean accounting format. Net flow highlighted green/red.
- **Events**: Compact summary with icon + title + choice made. Tappable for full event review.
- **Immigration**: Current status with countdown. Milestone achievements highlighted with gold.
- **Milestones**: Special callout for significant events (promotion, H1B approved, green card, etc.) with celebration animation.

### Auto-advance Option

Player can enable "auto-continue" in settings to skip the summary screen and go straight to the next quarter. Useful for experienced players who don't need to review every quarter. Default: off (show summary).

## Dependencies

| System | Direction | Data |
|--------|-----------|------|
| **Attribute System** | Reads | Before/after values for all attributes |
| **Economy System** | Reads | Income, expenses, net worth change |
| **Event System** | Reads | Events that fired and choices made |
| **Immigration System** | Reads | Current visa status, processing progress |
| **Turn Manager** | Reads | QuarterRecord data |

## Acceptance Criteria

1. **All deltas shown**: Every attribute that changed this quarter shows old → new value with delta.
2. **Financial breakdown**: Income, expenses, and net flow shown separately. Net worth shows total + change.
3. **Event summary**: Each event shows icon, title, and which choice the player made.
4. **Immigration status**: Current visa type and countdown always shown. Processing milestones highlighted.
5. **Milestone celebration**: Promotion, H1B approval, combo card, green card get special visual treatment (larger text, animation, distinct color).
6. **Continue button**: Single button to proceed to next quarter. No other navigation from this screen.
7. **Chinese text**: All labels and descriptions in Chinese.
8. **Performance**: Screen loads in <200ms. No lag between Turn Manager Phase 7 and summary display.
