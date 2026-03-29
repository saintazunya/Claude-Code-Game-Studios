# Event Database

> **Status**: In Design
> **Author**: user + game-designer
> **Last Updated**: 2026-03-28
> **Implements Pillar**: Pillar 4 (Emergent Stories), Pillar 1 (Authenticity First)

## Overview

The Event Database is the content layer that feeds the Event System framework. It defines all 30 MVP events with their preconditions, weights, choices, and consequences. Every event is grounded in real immigrant experiences — layoffs during recessions, H1B anxiety, PERM audits, toxic boss encounters, cultural isolation, and the small victories that keep people going. Events are stored in `data/events.json` and referenced by text_key for localization.

## Player Fantasy

Each event should feel like a moment the player (or someone they know) has actually lived. "Oh no, my company just froze all green card processing" should trigger a visceral reaction because the player knows (or IS) someone this happened to. The event pool is curated for maximum authenticity and emotional impact.

## Detailed Design

### MVP Event Pool (30 Events)

#### Crisis Events (8)

**1. layoff_wave**
- Type: crisis | Phase: career
- Preconditions: economic_cycle = recession OR random (5% in normal)
- Weight: 1.0 (×3.0 in recession)
- Immediate: Mental -25
- Choices:
  - Panic apply (stable): force job search mode 2 quarters, accept any offer
  - Selective apply (risky): higher salary target but 40% chance of running out of time
  - Day-1 CPT (desperate): return to student status, costs $15K/year, buys time

**2. h1b_denial**
- Type: crisis | Phase: career
- Preconditions: h1b_filed = true, quarter = Q2
- Weight: automatic (H1B lottery result — 73% chance of triggering)
- Immediate: Mental -20
- Choices:
  - Try again next year (stable): continue on OPT/STEM extension
  - Explore O1 (risky): requires Academic Impact >30, costs $5K legal fees
  - Enroll in CPT program (desperate): costs $15K/year, maintains status

**3. perm_audit**
- Type: crisis | Phase: career
- Preconditions: perm_status = pending
- Weight: triggered by Probability Engine (10% base)
- Immediate: Mental -10, PERM processing +2-6 quarters
- Choices:
  - Wait it out (stable): no action, just delay
  - Hire premium lawyer (costly): $5,000, reduces audit duration by 1-2 quarters

**4. pip_warning**
- Type: crisis | Phase: career
- Preconditions: performance < 30 AND pip_roll succeeds
- Weight: automatic (PIP probability roll)
- Immediate: Mental -20, 2-quarter PIP countdown starts
- Choices:
  - Grind to recover (risky): switch to Grind Mode, Performance focus
  - Start quiet job search (risky): search while on PIP (hidden, lower success rate)
  - Accept and coast (desperate): give up, prepare for termination, save Mental

**5. market_crash**
- Type: crisis/economic | Phase: any
- Preconditions: economic_cycle transitioning to recession
- Weight: automatic (on recession entry)
- Immediate: S&P 500 drops 15-25% this quarter, Mental -10
- Choices:
  - Hold steady (stable): do nothing, ride it out
  - Panic sell (risky): sell all shares (locks in loss but preserves cash)
  - Buy the dip (risky): invest extra cash (could recover big or drop further)

**6. company_gc_freeze**
- Type: crisis | Phase: career
- Preconditions: perm_status = "employer_delay" or "filing", economic_cycle = recession
- Weight: 2.0 during recession
- Immediate: PERM processing paused indefinitely, Mental -15
- Choices:
  - Wait and hope (stable): company may unfreeze in 2-4 quarters
  - Confront HR (risky): 40% chance they resume, 30% chance of being flagged
  - Start job search (risky): find a company still processing GC (harder in recession)

**7. family_medical_emergency**
- Type: crisis/life | Phase: any
- Preconditions: none (can happen anytime)
- Weight: 0.5
- Cooldown: 12 quarters
- Immediate: Mental -15
- Choices:
  - Send money (costly): Net Worth -$10,000-$20,000, Mental partially recovers +5
  - Fly home (risky): if H1B, visa re-entry risk 5%. If no valid stamp, higher risk. Travel costs + lost AP.
  - Stay and feel guilty (neutral): Mental -5 per quarter for 2 quarters

**8. visa_stamp_rejection**
- Type: crisis | Phase: career
- Preconditions: player traveled internationally on H1B, no combo card
- Weight: automatic (5% on re-entry)
- Immediate: Stuck abroad 1-2 quarters, cannot work, Mental -20
- Choices:
  - Wait for administrative processing (stable): 1-2 quarters delay
  - Apply at another consulate (risky): costs $2,000, 70% success
  - Employer emergency petition (costly): $5,000, faster resolution

#### Opportunity Events (7)

**9. recruiter_call**
- Type: opportunity | Phase: career
- Preconditions: skills > 40, employed
- Weight: 1.5 (×2.0 in boom)
- Immediate: none
- Choices:
  - Explore the offer (neutral): starts job search without AP cost, but only this one company
  - Decline (stable): no change
  - Negotiate retention (risky): 50% chance current employer gives raise +10-15%

**10. conference_invitation**
- Type: opportunity | Phase: career
- Preconditions: academic_impact > 20 OR skills > 60
- Weight: 1.0
- Immediate: none
- Choices:
  - Attend and present (costly): $1,500 travel, Academic Impact +5, Skills +3, networking bonus
  - Attend only (neutral): $1,000 travel, Skills +2
  - Decline (stable): no cost, no benefit

**11. priority_date_jump**
- Type: opportunity/immigration | Phase: career
- Preconditions: has_priority_date, in_queue
- Weight: 0.8
- Immediate: Priority date advances 4-8 quarters suddenly, Mental +10
- Choices: none (automatic good news)

**12. mentor_connection**
- Type: opportunity | Phase: any
- Preconditions: none
- Weight: 1.0
- Cooldown: 8 quarters
- One-time: false
- Immediate: none
- Choices:
  - Accept mentorship (stable): +5% to next promotion or job search, Skills +3
  - Too busy (neutral): no effect

**13. open_source_viral**
- Type: opportunity | Phase: career
- Preconditions: skills > 50
- Weight: 0.5
- One-time: true
- Immediate: Academic Impact +8, Skills +5
- Choices:
  - Lean into it (risky): spend extra AP next quarter on the project, Academic Impact +10 more but Performance -5
  - Let it simmer (stable): keep the base gains, no extra investment

**14. startup_acquisition_offer**
- Type: opportunity | Phase: career
- Preconditions: level >= L5, at startup company
- Weight: 0.5
- Immediate: none
- Choices:
  - Accept buyout (costly/opportunity): large cash payout ($50K-200K), job may or may not continue
  - Negotiate equity (risky): potentially bigger payout but only if acquisition closes
  - Decline (stable): keep current position

**15. housing_deal**
- Type: opportunity/economic | Phase: career
- Preconditions: net_worth > down_payment_minimum, renter
- Weight: 0.8 (×0.3 in recession, ×1.5 in recovery)
- Immediate: none
- Choices:
  - Buy the house (costly): enter homeownership at slightly below market price
  - Pass (stable): stay renter, keep liquidity

#### Career Events (5)

**16. team_reorg**
- Type: career | Phase: career
- Preconditions: tenure > 4 quarters at current company
- Weight: 1.5
- Immediate: new boss assigned (random)
- Choices:
  - Adapt (stable): no action, accept new boss
  - Request transfer (risky): 60% chance of getting a better team, 40% chance of worse

**17. project_cancellation**
- Type: career | Phase: career
- Preconditions: employed
- Weight: 1.0 (×2.0 in recession)
- Immediate: Performance -10 (work wasted), Mental -5
- Choices:
  - Find new project quickly (stable): Performance partially recovers +5 next quarter
  - Use downtime to upskill (neutral): Skills +5, Performance stays low
  - Coast through the chaos (risky): save AP but risk being seen as unproductive

**18. performance_bonus**
- Type: career | Phase: career
- Preconditions: performance > 70, Q4
- Weight: automatic (at Q4 review if performance warrants)
- Immediate: Net Worth +$5,000-$20,000 (level dependent), Mental +5
- Choices: none (automatic reward)

**19. competing_offer_while_employed**
- Type: career | Phase: career
- Preconditions: job_search_active, employed
- Weight: triggered by job_offer roll
- Immediate: received offer with details
- Choices:
  - Accept new offer (risky): new company with all job change consequences
  - Use as leverage (risky): 60% chance current employer matches salary, 40% chance of souring relationship
  - Decline (stable): stay at current company

**20. toxic_incident**
- Type: career | Phase: career
- Preconditions: boss_type = "demanding" or "toxic"
- Weight: 1.5
- Immediate: Mental -10
- Choices:
  - Report to HR (risky): 30% chance boss is replaced, 30% retaliation (Performance judged unfairly), 40% nothing changes
  - Endure silently (stable): Mental -3/quarter ongoing
  - Start job search (neutral): triggers job search mode

#### Immigration Events (5)

**21. immigration_policy_change**
- Type: immigration | Phase: any
- Preconditions: none
- Weight: 0.5
- Cooldown: 8 quarters
- Immediate: random policy shift
- Effects (randomly selected):
  - H1B cap increase (+5% lottery rate for 2 years)
  - H1B cap decrease (-5% lottery rate for 2 years)
  - PERM processing speedup (-2 quarters for all pending)
  - PERM processing slowdown (+2 quarters for all pending)
  - EB priority date jump (all categories advance 4 quarters)
  - New visa category discussion (flavor text, no mechanical effect)

**22. rfe_on_i485**
- Type: immigration | Phase: career
- Preconditions: i485_status = "pending"
- Weight: automatic (20% chance triggered by Probability Engine)
- Immediate: Mental -15, I-485 processing +2-4 quarters
- Choices:
  - Standard response (stable): respond with existing documentation, wait
  - Hire specialist lawyer (costly): $3,000-5,000, reduces delay by 1-2 quarters

**23. priority_date_retrogression**
- Type: immigration | Phase: career
- Preconditions: in_priority_date_queue
- Weight: 0.15 per quarter (built into priority date movement formula)
- Immediate: Mental -15, queue position moves backward
- Choices: none (pure RNG suffering — authentic to real experience)

**24. combo_card_received**
- Type: immigration | Phase: career
- Preconditions: i485_filed, processing_time elapsed
- Weight: automatic
- Immediate: Mental +20, visa_insecure = false, employer_tied = false, travel_risk = 0
- Choices: none (pure celebration moment)

**25. green_card_approved**
- Type: immigration | Phase: career
- Preconditions: i485_status = "pending", processing complete, no RFE pending
- Weight: automatic
- Immediate: Mental +30, visa_insecure = false, permanent resident status
- Choices: none (the moment the entire game has been building toward)

#### Life Events (5)

**26. cultural_friction**
- Type: life | Phase: any
- Preconditions: none
- Weight: 1.0
- Cooldown: 6 quarters
- Immediate: Mental -5
- Text: workplace misunderstanding, social isolation, language barrier moment
- Choices:
  - Reflect and adapt (stable): Mental recovers +3 next quarter, Skills +1 (cultural learning)
  - Vent to friends (neutral): Mental +3 this quarter
  - Withdraw (risky): Mental -3/quarter for 2 quarters but save AP

**27. holiday_loneliness**
- Type: life | Phase: career
- Preconditions: quarter = Q4 (holiday season), no family nearby
- Weight: 1.5
- Immediate: Mental -8
- Choices:
  - Video call family (stable): Mental +5, costs nothing
  - Host gathering with immigrant friends (neutral): Mental +8, costs $500
  - Work through it (risky): Performance +3 but Mental stays low

**28. community_support**
- Type: life | Phase: any
- Preconditions: none
- Weight: 1.0
- Immediate: Mental +5
- Text: finding a community group, immigrant support network, new friend
- Choices:
  - Get involved (stable): Mental +5/quarter for 3 quarters, costs 1 AP per quarter
  - Appreciate but stay focused (neutral): one-time +5 only

**29. parent_visit**
- Type: life | Phase: career
- Preconditions: visa allows visitors (not gameplay restricted, flavor event)
- Weight: 0.8
- Cooldown: 8 quarters
- Immediate: Mental +10
- Choices:
  - Take time off (costly): Mental +15 more, but costs 2 AP and $3,000
  - Brief visit while working (stable): just the base +10

**30. identity_crisis**
- Type: life | Phase: career
- Preconditions: age > 30, mental < 50
- Weight: 1.0
- One-time: true
- Immediate: Mental -10
- Text: "Am I still the same person who got on that plane? Is this worth it?"
- Choices:
  - Recommit to the plan (stable): Mental +5, renewed focus (Performance +5 next quarter)
  - Question everything (risky): if Mental > 30: breakthrough insight (+10 Mental, new perspective). If Mental < 30: spiral deeper (-10 Mental)
  - Call home (neutral): Mental +8, no other effect

### Event Balance Distribution

| Category | Count | % of Pool | Average per Run (~133 events) |
|----------|-------|-----------|-------------------------------|
| Crisis | 8 | 27% | ~20 crisis events (more in recession runs) |
| Opportunity | 7 | 23% | ~25 opportunity events |
| Career | 5 | 17% | ~30 career events (most common) |
| Immigration | 5 | 17% | ~25 immigration events |
| Life | 5 | 17% | ~33 life events |

### Data Format

All events stored in `data/events.json` following the schema defined in Event System GDD. Player-facing text stored via text_keys in localization files.

## Edge Cases

### 1. Event references system not yet active
Academic Phase event tries to reference career system. Precondition filtering prevents this — events are phase-gated.

### 2. All crisis events on cooldown during recession
If a recession lasts many quarters, crisis events may all be on cooldown. The system falls through to other categories. This is acceptable — not every recession quarter needs a crisis event.

### 3. Event choice references a state that changed
Player receives job offer event but gets laid off before resolving it. The event should check validity of choices at resolution time, not at trigger time. Invalid choices are greyed out with explanation.

## Tuning Knobs

Defined per-event in `data/events.json`. Global event system knobs are in the Event System GDD.

Key balance levers:
- Event weights determine frequency
- Cooldowns prevent repetition fatigue
- Preconditions ensure events are contextually appropriate
- Choice tags guide player toward understanding risk/reward

## Acceptance Criteria

### Content Tests
1. **All 30 events parseable**: Load `events.json`. Verify all 30 events parse without validation errors.
2. **All events have text_keys**: Verify every event and every choice has a valid text_key.
3. **Preconditions are valid**: Verify all precondition fields reference existing game state variables.
4. **Effect targets are valid**: Verify all effect targets reference existing attributes or system interfaces.
5. **No orphaned choices**: Every event has at least 2 choices (except automatic events).

### Balance Tests
6. **Event distribution**: Simulate 100 full runs. Verify each non-one-time event fires at least once across 100 runs.
7. **Crisis frequency in recession**: During recession quarters, verify crisis events fire ~50% more frequently than during normal quarters.
8. **No event dominance**: Verify no single event fires more than 5 times in one run (cooldown enforcement).
9. **Life events provide emotional pacing**: Verify life events fire regularly between crisis/career events, preventing relentless negativity.
