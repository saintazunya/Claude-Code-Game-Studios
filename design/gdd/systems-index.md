# Systems Index: Green Card Odyssey (绿卡之路)

> **Status**: Draft
> **Created**: 2026-03-28
> **Last Updated**: 2026-03-28
> **Source Concept**: design/gdd/game-concept.md

---

## Overview

绿卡之路是一个回合制人生模拟器，核心循环是"每季度分配行动点 → 概率结算 → 随机事件 → 下一季度"。
系统围绕三条主线展开：**职业发展**、**移民身份**、**经济/健康管理**。所有关键事件（升职、跳槽、
签证审批、生病）都由属性驱动的概率引擎决定，强调"努力提高概率但不保证结果"。游戏从角色创建和
学业阶段（序章）开始，经济周期作为全局变量持续影响所有系统。

---

## Systems Enumeration

| # | System Name | Category | Priority | Status | Design Doc | Depends On |
|---|-------------|----------|----------|--------|------------|------------|
| 1 | 属性系统 (Attribute System) | Core | MVP | Designed | design/gdd/attribute-system.md | — |
| 2 | 概率引擎 (Probability Engine) | Core | MVP | Designed | design/gdd/probability-engine.md | 属性系统 |
| 3 | 回合管理系统 (Turn Manager) | Core | MVP | Designed | design/gdd/turn-manager.md | — |
| 4 | 游戏配置/数据系统 (Game Data) | Core | MVP | Designed | design/gdd/game-data.md | — |
| 5 | 经济周期系统 (Economic Cycle) | Core | MVP | Designed | design/gdd/economic-cycle.md | 回合管理 |
| 6 | 行动点系统 (Action Point System) | Core | MVP | Designed | design/gdd/action-point-system.md | 属性系统, 回合管理 |
| 7 | 角色创建系统 (Character Creation) | Core | MVP | Designed | design/gdd/character-creation.md | 属性系统, 游戏配置 |
| 8 | 经济系统 (Economy System) | Gameplay | MVP | Designed | design/gdd/economy-system.md | 属性系统, 回合管理, 经济周期, 游戏配置 |
| 9 | 职业系统 (Career System) | Gameplay | MVP | Designed | design/gdd/career-system.md | 属性系统, 行动点, 概率引擎, 经济周期 |
| 10 | 移民身份系统 (Immigration System) | Gameplay | MVP | Designed | design/gdd/immigration-system.md | 属性系统, 职业系统, 概率引擎, 经济周期 |
| 11 | 健康系统 (Health System) | Gameplay | MVP | Designed | design/gdd/health-system.md | 属性系统, 行动点, 概率引擎 |
| 12 | 精神状态系统 (Mental Health System) | Gameplay | MVP | Designed | design/gdd/mental-health-system.md | 属性系统, 行动点 |
| 13 | 学业阶段系统 (Academic Phase) | Gameplay | MVP | Designed | design/gdd/academic-phase.md | 角色创建, 行动点, 概率引擎, 经济周期 |
| 14 | 随机事件系统 (Event System) | Gameplay | MVP | Designed | design/gdd/event-system.md | 回合管理, 属性系统, 概率引擎, 经济周期 |
| 15 | 事件内容库 (Event Database) | Content | MVP | Designed | design/gdd/event-database.md | 随机事件系统, 游戏配置 |
| 16 | 跳槽系统 (Job Change System) | Gameplay | Vertical Slice | Not Started | — | 职业系统, 移民身份, 概率引擎, 经济周期 |
| 17 | 自主移民路线 (Self-Directed Immigration) | Gameplay | Alpha | Not Started | — | 移民身份, 属性系统(学术影响力), 概率引擎 |
| 18 | 主界面UI (Main Game UI) | UI | MVP | Designed | design/gdd/main-game-ui.md | 属性系统, 行动点, 经济, 健康, 精神 |
| 19 | 事件弹窗UI (Event Popup UI) | UI | MVP | Designed | design/gdd/event-popup-ui.md | 随机事件系统 |
| 20 | 季度结算动画 (Quarter Summary UI) | UI | MVP | Designed | design/gdd/quarter-summary-ui.md | 回合管理, 属性系统 |
| 21 | 结算画面UI (Endgame Score UI) | UI | MVP | Designed | design/gdd/endgame-score-ui.md | 经济系统, 职业系统, 移民身份 |
| 22 | 存档系统 (Save/Load) | Persistence | Vertical Slice | Not Started | — | 全部游戏状态系统 |
| 23 | 新手引导 (Tutorial/Onboarding) | Meta | Alpha | Not Started | — | 全部UI系统 |
| 24 | 评分/排行系统 (Scoring/Leaderboard) | Meta | Alpha | Not Started | — | 经济系统, 移民身份 |
| 25 | 解锁/成就系统 (Unlock/Achievement) | Meta | Full Vision | Not Started | — | 职业系统, 移民身份 |

---

## Categories

| Category | Description |
|----------|-------------|
| **Core** | 基础框架系统，所有玩法系统依赖它们：属性、概率、回合、行动点、数据配置 |
| **Gameplay** | 核心玩法机制：职业、移民、经济、健康、精神、学业、跳槽、事件 |
| **Content** | 数据驱动的内容：事件库、数值表 |
| **UI** | 玩家界面：主界面、事件弹窗、结算画面、季度结算 |
| **Persistence** | 存档和状态持久化 |
| **Meta** | 核心循环之外的系统：新手引导、排行榜、成就 |

---

## Priority Tiers

| Tier | Definition | Systems Count |
|------|------------|---------------|
| **MVP** | 核心循环运转所需的最小系统集。没有这些，无法验证"这个游戏好不好玩" | 19 |
| **Vertical Slice** | 完整体验所需：跳槽+存档让一局游戏有完整的策略深度和持久化 | 2 |
| **Alpha** | 所有玩法就位：自主移民路线、新手引导、评分系统 | 3 |
| **Full Vision** | 内容完整、打磨到位：成就解锁、多路线、完整事件库 | 1 |

---

## Dependency Map

### Foundation层（无依赖）

1. **回合管理系统** — 季度推进引擎，驱动一切时间流逝
2. **属性系统** — 7个核心属性的存储/读写，被15个系统依赖（最高风险瓶颈）
3. **游戏配置/数据系统** — 外部数值表，所有系统从这里读取可调参数

### Core层（依赖Foundation）

4. **概率引擎** — 依赖：属性系统。通用的"属性→概率→掷骰→结果"框架
5. **经济周期系统** — 依赖：回合管理。繁荣/衰退/复苏状态机，全局修正因子
6. **行动点系统** — 依赖：属性系统, 回合管理。AP分配、工作模式、卷王加成
7. **角色创建系统** — 依赖：属性系统, 游戏配置。开局10点分配（体质/学校/地理）

### Feature层（依赖Core）

8. **经济系统** — 依赖：属性, 回合管理, 经济周期, 游戏配置
9. **健康系统** — 依赖：属性, 行动点, 概率引擎
10. **精神状态系统** — 依赖：属性, 行动点
11. **学业阶段系统** — 依赖：角色创建, 行动点, 概率引擎, 经济周期
12. **职业系统** — 依赖：属性, 行动点, 概率引擎, 经济周期
13. **移民身份系统** — 依赖：属性, 职业系统, 概率引擎, 经济周期
14. **跳槽系统** — 依赖：职业, 移民身份, 概率引擎, 经济周期
15. **自主移民路线** — 依赖：移民身份, 属性(学术影响力), 概率引擎
16. **随机事件系统** — 依赖：回合管理, 属性, 概率引擎, 经济周期
17. **事件内容库** — 依赖：随机事件系统, 游戏配置

### Presentation层（依赖Feature）

18. **主界面UI** — 依赖：属性, 行动点, 经济, 健康, 精神
19. **事件弹窗UI** — 依赖：随机事件系统
20. **季度结算动画** — 依赖：回合管理, 属性系统
21. **结算画面UI** — 依赖：经济, 职业, 移民身份

### Polish层（依赖一切）

22. **存档系统** — 依赖：全部游戏状态
23. **新手引导** — 依赖：全部UI
24. **评分/排行系统** — 依赖：经济, 移民身份
25. **解锁/成就系统** — 依赖：职业, 移民身份

---

## Recommended Design Order

| Order | System | Priority | Layer | Complexity | Rationale |
|-------|--------|----------|-------|------------|-----------|
| 1 | 属性系统 | MVP | Foundation | S | 一切的基础，定义7个属性的规则和接口 |
| 2 | 概率引擎 | MVP | Foundation | S | 属性→概率的通用公式框架 |
| 3 | 回合管理系统 | MVP | Foundation | S | 季度推进、年度事件触发、结束条件 |
| 4 | 游戏配置/数据系统 | MVP | Foundation | S | 所有数值外部化的架构 |
| 5 | 经济周期系统 | MVP | Foundation | M | 繁荣/衰退/复苏状态机，影响全局 |
| 6 | 行动点系统 | MVP | Core | M | AP分配规则、工作模式三选一、卷王机制 |
| 7 | 角色创建系统 | MVP | Core | S | 10点分配规则（体质/学校/地理） |
| 8 | 经济系统 | MVP | Core | M | 工资/税/S&P500/房产数值模型 |
| 9 | 职业系统 | MVP | Feature | L | 职级/升职概率/PIP/公司属性 — 最复杂之一 |
| 10 | 移民身份系统 | MVP | Feature | L | 签证状态机/PERM/I-140 — 并列最复杂 |
| 11 | 健康系统 | MVP | Feature | M | 健康衰减/恢复/生病概率/卷王联动 |
| 12 | 精神状态系统 | MVP | Feature | S | 精神值/burnout触发/签证压力 |
| 13 | 学业阶段系统 | MVP | Feature | M | 序章：intern/GPA/读博决策/经济周期同步 |
| 14 | 随机事件系统 | MVP | Feature | M | 事件框架：触发条件/选择分支/后果链 |
| 15 | 事件内容库 | MVP | Content | L | 20-30个具体事件编写（裁员/H1B/市场等） |
| 16 | 跳槽系统 | V.Slice | Feature | M | 准备面试/offer生成/薪资谈判/绿卡影响 |
| 17 | 自主移民路线 | Alpha | Feature | M | NIW/EB1A/O1路线/学术影响力门槛 |

Complexity: S = 1 session, M = 2-3 sessions, L = 4+ sessions

---

## Circular Dependencies

- **职业系统 ↔ 移民身份系统**: 职业影响签证（H1B需要雇主担保、PERM需要在职），签证影响职业（身份限制换工作自由度、combo卡解锁雇主独立性）。**解决方案**：定义接口契约 — 职业系统暴露"当前雇主ID/在职状态"，移民系统暴露"当前身份类型/是否可自由换工作"。两个系统同步设计（顺序9和10），GDD中互相引用对方的接口。

---

## High-Risk Systems

| System | Risk Type | Risk Description | Mitigation |
|--------|-----------|-----------------|------------|
| 移民身份系统 | Design + Scope | 签证状态转换极其复杂（10+状态、大量边界条件、PERM多阶段流程）；现实规则复杂度可能超出游戏承载 | 先设计核心路径(F1→OPT→H1B→PERM→GC)，边缘路径后续扩展；用状态机严格建模 |
| 职业系统 | Balance | 多职业路径×多职级×升职概率×薪资曲线 = 大量数值需要平衡；一个数字偏差导致某路线统治 | MVP只做SDE一条路线，验证后再扩展；用真实薪资数据作为锚点 |
| 经济系统 | Balance | S&P500回报率+房价+工资增长的长期模拟可能出现不合理的数值爆炸或通缩 | 用历史真实数据校准；设置合理上下限；需要多次playtest迭代 |
| 概率引擎 | Design | "努力提高概率但不保证结果"的手感很难调 — 太随机玩家觉得不公平，太确定失去紧张感 | 早期prototype快速迭代概率曲线；参考成熟roguelike的概率设计 |
| 属性系统 | Technical | 作为被15个系统依赖的瓶颈，接口设计如果出错，后续所有系统都要改 | 第一个设计、第一个review、第一个prototype |

---

## Progress Tracker

| Metric | Count |
|--------|-------|
| Total systems identified | 25 |
| Design docs started | 19 |
| Design docs reviewed | 0 |
| Design docs approved | 0 |
| MVP systems designed | 19/19 |
| Vertical Slice systems designed | 0/2 |
| Alpha systems designed | 0/3 |
| Full Vision systems designed | 0/1 |

---

## Next Steps

- [ ] Design MVP systems in order (use `/design-system [system-name]`)
- [ ] First: 属性系统 → 概率引擎 → 回合管理 → 游戏配置
- [ ] Then: 经济周期 → 行动点 → 角色创建 → 经济
- [ ] Then: 职业 + 移民身份（同步设计）→ 健康 → 精神 → 学业 → 事件
- [ ] Run `/design-review` on each completed GDD
- [ ] Prototype the core loop after first 8 systems are designed
- [ ] Run `/gate-check pre-production` when MVP systems are designed
