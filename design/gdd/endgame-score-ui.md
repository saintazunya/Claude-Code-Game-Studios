# Endgame Score UI

> **Status**: In Design
> **Author**: user + game-designer
> **Last Updated**: 2026-03-28
> **Implements Pillar**: Pillar 4 (Emergent Stories), Pillar 5 (Learnable Depth)

## Overview

The Endgame Score UI is the final screen of each run. It presents the player's complete life story in three sections: the score breakdown, life statistics, and a visual timeline of major milestones. This screen serves dual purposes — it's the emotional payoff (or gut-punch) of the run AND the analytical feedback that informs the next run's strategy. All text in Chinese.

## Detailed Design

### Screen Sections (Scrollable)

**1. Victory/Defeat Banner**
- Green card obtained: "🏆 美国梦达成" with gold gradient text
- Deported: "✈️ 被迫回国" with red text
- Age 59 without GC: "⏰ 时间到" with yellow text
- Voluntary departure: "🏠 选择回国" with neutral text
- Subtitle: key achievement (e.g., "41岁拿到绿卡 — 比截止期限早了18年")

**2. Score Section**
```
最终得分: 2,847,500
├── 净资产: $1,200,000
├── 绿卡加成: ×1.5
└── 提前奖励: +$190,000 (19年 × $10,000)
```

**3. Life Statistics (2×2 grid)**
- 职业巅峰: Staff SDE (L6)
- 最终净资产: $1,247,000
- 跳槽次数: 4
- 经历危机: 7

**4. Net Worth Chart**
Bar chart showing net worth at each year from 22 to 59. Color-coded: blue (pre-GC), green (post-GC), red bars for years where net worth dropped. X-axis: age. Y-axis: dollars.

**5. Life Timeline**
Vertical timeline with milestone dots (colored by category):
- 🔵 Blue: career milestones (graduation, promotion, job changes)
- 🟢 Green: immigration wins (H1B, combo card, green card)
- 🔴 Red: crises (layoff, H1B denial, sickness)
- 🟡 Yellow: financial milestones (first $100K, bought house)
- 🟣 Purple: immigration process steps (PERM filed, I-140 approved)

Each milestone shows age + one-line description. Tappable for full detail.

**6. Bottom Buttons**
- "分享 📤": Generate shareable image card (timeline + score) for social media
- "再来一局": Return to character creation for new run

### Share Card Generation

One-tap generates a static image (~1080×1920) containing:
- Title: "绿卡之路 — 我的移民故事"
- Final score
- 5-6 key timeline milestones
- Net worth chart (simplified)
- Build info (Constitution/School/Geo)

Designed for sharing on WeChat, Twitter, 一亩三分地, etc. The share card is the game's primary viral mechanic.

### Ending Variants

| Ending | Banner | Tone | Score Modifier |
|--------|--------|------|---------------|
| GC before 59 | 美国梦达成 | Triumphant | ×1.5 + early bonus |
| Age 59 with GC | 安全着陆 | Satisfied | ×1.5, no early bonus |
| Age 59 without GC | 时间到 | Bittersweet | ×1.0 |
| Deported (visa expiry) | 被迫回国 | Devastating | ×0.8 (penalty) |
| Voluntary departure | 选择回国 | Reflective | ×0.9 |

## Dependencies

| System | Direction | Data |
|--------|-----------|------|
| **Economy System** | Reads | Final Net Worth, score calculation |
| **Career System** | Reads | Peak level, companies worked at, total job changes |
| **Immigration System** | Reads | GC status, age at GC approval, visa history |
| **Turn Manager** | Reads | Full timeline (QuarterRecords), ending type |
| **Event System** | Reads | All events for milestone extraction |
| **Character Creation** | Reads | Original build for share card |

## Acceptance Criteria

1. **Correct ending banner**: Each ending type displays the correct banner text and tone.
2. **Score calculation**: Verify score matches Economy System formula (Net Worth × GC multiplier + early bonus).
3. **Timeline completeness**: All milestone events from QuarterRecords appear in timeline.
4. **Net worth chart**: Chart has one bar per year (37 bars for full run). Values match recorded history.
5. **Share card generation**: Tap share → image generated in <2 seconds. Image contains score, timeline highlights, and build info.
6. **Play again flow**: "再来一局" returns to character creation screen. Previous run data is preserved in run history.
7. **Chinese text**: All text in Chinese.
8. **Emotional impact**: GC approval ending should display celebration animation (confetti, glow). Deportation ending should be subdued (no celebration, muted colors).
9. **Responsive**: Full timeline is scrollable on mobile. Chart scales to screen width.
10. **Run history**: After completing a run, it's added to a "历史记录" list accessible from title screen (stores: build, score, ending type, GC age).
