# Event System V2 — State-Driven Events

## Design Philosophy

Events should not all be one-shot popups. Many immigration/career situations
are **persistent states** that unfold over multiple quarters. The event system
should support:

1. **Instant events**: One popup, choose now, effects applied immediately
2. **State events**: Set a flag, persist for N quarters, resolve automatically or via player action
3. **Notification events**: Inform player of something, no choice needed (auto-dismiss)

## Event Audit & Redesign

### KEEP AS INSTANT (popup with meaningful choice)

These events have real tradeoffs and work as one-shot decisions:

| Event | Why it works | Suggested changes |
|-------|-------------|-------------------|
| 裁员预警 | 3 real choices, consequence next quarter | Keep as-is |
| 股市暴跌 | Hold/sell/buy — real financial decision | Keep as-is |
| 职场冲突 | HR/endure/leave — classic dilemma | Keep as-is |
| 文化冲突 | 3 distinct coping strategies | Keep as-is |
| 家人生病 | Money/travel/guilt — emotional + practical | Keep as-is |
| 身份认同危机 | Deep choice with conditional outcome | Keep as-is |
| 收到Offer | Accept/decline with green card impact | Add: show salary comparison + GC risk |
| 签证stamp过期 | Travel/don't travel — real risk assessment | Keep as-is |
| 公司收购影响移民 | Stay/leave with immigration consequences | Keep as-is |
| EB2/EB3降级 | Strategic immigration choice | Keep as-is |
| H1B多家注册 | Risk/reward gambling | Keep as-is |

### CONVERT TO STATE EVENTS (persistent, resolve over time)

These should become ongoing states shown in the Event Tracker, not popups:

| Event | Current | Proposed State | Duration | Resolution |
|-------|---------|---------------|----------|------------|
| PERM审批中 | Already a state | Add sub-events: prevailing wage issue, recruitment issue, company withdrawal | Until approved/rejected | Probability per quarter |
| I-140审批中 | Already a state | Add: RFE sub-event, premium processing option | 2-4 quarters | Probability roll |
| I-485审批中 | Already a state | Add: medical RFE, interview notice as milestones | 4-12 quarters | Probability roll |
| USCIS延迟 | One-shot event | Becomes a global modifier: all processing times +1-2 quarters when active | 4-8 quarters | Auto-resolves |
| 加急暂停 | One-shot event | Becomes modifier: premium processing unavailable | 2-4 quarters | Auto-resolves |

### CONVERT TO NOTIFICATIONS (no choice, just inform)

These have no meaningful choice. Show as summary notifications, not popup:

| Event | Current | Proposed |
|-------|---------|----------|
| 排期前进 | Popup with "太好了" button | Notification in quarter summary |
| 排期大幅前进 | Popup | Notification with mental +15 |
| 排期大幅倒退 | Popup with weak choice | Notification with mental -20 |
| I-485面试通知 | Popup with 1 choice | Notification with mental +5 |
| 绩效奖金 | Popup with save/invest | Notification + auto-add cash |
| 同事拿绿卡 | Popup | Notification |
| 论坛Timeline | Popup | Notification |
| 猎头来电 | Popup | Notification (market signal) |

### REMOVE (low gameplay value, clutters event system)

| Event | Why remove |
|-------|-----------|
| I-140补件 | Only 1 choice (pay $2000), no real decision |
| I-485体检补件 | Only 1 choice (pay $500), no real decision |
| 加急审理暂停 | Only 1 choice, better as state modifier |
| Prevailing Wage | Choices too similar, better as PERM sub-event |
| PERM招聘问题 | Same — fold into PERM probability system |
| H1B工资要求 | Choices too similar |
| H1B转换危机 | No real choice (already in crisis) |

### ADD NEW EVENTS

Based on 一亩三分地 research, these common situations are missing:

| Event | Description | Choices |
|-------|-------------|---------|
| 同事被裁你没事 | Survivor's guilt + increased workload | Absorb work(绩效+,精神-) / Set boundaries / Start looking |
| 绿卡排期快到了 | Prepare I-485 materials, hire lawyer | DIY($500) / Hire lawyer($3000,faster) / Wait |
| 公司换移民律师 | New law firm takes over your case, possible delays | Trust new firm / Hire own lawyer / Do nothing |
| OPT即将到期 | No H1B yet, must make a decision | CPT($15K) / Try O1 / Give up and go home |
| 收到USCIS Receipt | Application received, waiting begins | Just a notification with mild mental relief |

## Implementation Priority

Phase 1: Convert low-value popups to notifications
Phase 2: Remove no-choice events
Phase 3: Add state event system
Phase 4: Add new meaningful events
