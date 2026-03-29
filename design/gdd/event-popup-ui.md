# Event Popup UI

> **Status**: In Design
> **Author**: user + game-designer
> **Last Updated**: 2026-03-28
> **Implements Pillar**: Pillar 4 (Emergent Stories)

## Overview

The Event Popup UI is the modal overlay that appears during Turn Manager Phase 6 when a random event fires. It presents the event narrative, immediate effects, and 2-3 player choices. Events are the game's storytelling vehicle — the popup must create emotional impact through clear writing, visible consequences, and meaningful choice framing. All event text is in Chinese.

## Detailed Design

### Popup Structure

```
┌─────────────────────────────┐
│ [Event Icon]                │
│ EVENT TYPE (突发事件)        │
│ EVENT TITLE (公司大裁员)     │
│ Date — Age                  │
├─────────────────────────────┤
│ Narrative text box          │
│ (2-4 sentences describing   │
│  the situation in Chinese)  │
├─────────────────────────────┤
│ Immediate Effects:          │
│ ● 精神状态 -25              │
│ ● 60天倒计时开始            │
├─────────────────────────────┤
│ Choice 1 [稳妥]             │
│   海投求职                   │
│   描述...                    │
│                              │
│ Choice 2 [冒险]             │
│   精准投递                   │
│   描述...                    │
│                              │
│ Choice 3 [孤注一掷]         │
│   挂靠学校                   │
│   描述...                    │
├─────────────────────────────┤
│ ⏰ 必须做出选择             │
└─────────────────────────────┘
```

### Visual Design

- **Background**: Dimmed game screen with modal card overlay
- **Event icon**: 64px themed icon (💥 crisis, ✨ opportunity, 🏢 career, 📋 immigration, 🏠 life)
- **Event type badge**: Color-coded (red=crisis, blue=opportunity, gray=career, purple=immigration, warm=life)
- **Narrative box**: Left-bordered with event type color. Chinese text, 14px, 1.7 line height.
- **Effects**: Red dots for negative, green for positive, yellow for neutral. Clear attribute name + delta.
- **Choice buttons**: Full-width, with tag badge (稳妥/冒险/孤注一掷/花钱). Tap to select. Effects preview on long-press.
- **Animation**: Slide-up entrance (300ms ease-out). Cannot be dismissed without making a choice (no X button).

### Choice Tags (Chinese)

| Tag | Color | English Equivalent |
|-----|-------|--------------------|
| 稳妥 | Blue | Stable |
| 冒险 | Purple | Risky |
| 孤注一掷 | Red | Desperate |
| 花钱 | Gold | Costly |
| 中立 | Gray | Neutral |

### Multiple Events

If 2 events fire in one quarter, they are shown sequentially. Second popup appears after first is resolved. Player cannot see the second event before resolving the first.

## Dependencies

| System | Direction | Data |
|--------|-----------|------|
| **Event System** | Reads | Event definition, choices, effects |
| **Game Data** | Reads | Text keys → Chinese localization strings |

## Acceptance Criteria

1. **Modal blocking**: Player cannot interact with main game UI while event popup is active.
2. **All text in Chinese**: Event title, narrative, effects, choices, tags all display in Chinese.
3. **Choice selection**: Tapping a choice highlights it. Tapping again confirms. Effects applied.
4. **Effects visible**: Immediate effects shown before choices. Choice effects shown in choice description.
5. **Cannot skip**: No close/dismiss button. Player must select a choice.
6. **Sequential events**: Two events in one quarter shown one after another.
7. **Responsive**: Popup fits on 375px screen. Scrollable if content exceeds viewport.
8. **Probability display**: Risky choices show success probability (e.g., "40%概率成功").
