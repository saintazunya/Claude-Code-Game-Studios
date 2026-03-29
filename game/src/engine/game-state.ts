// Game State — initializes and manages the central game state

import type { CreationAttributes, GameState, WorkMode, ActionId, CoreAttributes, AcademicStudyMode } from './types';
import { createStartingAttributes, applyDeltas, computeNaturalDecay, computeSicknessChance, computeBurnoutChance, getPerformanceGainMultiplier } from './attributes';
import { roll, preview } from './probability';
import { rollInitialPhase, checkPhaseTransition, rollMarketReturn, rollHousingChange, updateSharePrice, rollEventCount, INITIAL_SHARE_PRICE } from './economic-cycle';
import { ACTIONS, getAvailableActions } from './actions';
import { processAnnualReview, checkPip, processPipQuarter, checkLayoff, shouldRotateBoss, rollBossType, computeSalary } from './career';
import { processImmigrationQuarter, activateOpt } from './immigration';
import { isGraduationTurn, processGraduation, getGpaGain } from './academic';
import { selectEvents, applyEventChoice } from './events';

export function createGameState(creation: CreationAttributes): GameState {
  const { attributes, schoolModifier, geoBonus, constitutionSicknessModifier } =
    createStartingAttributes(creation);

  const initialPhase = rollInitialPhase();

  return {
    turn: 0,
    phase: 'academic',
    creation,
    attributes,
    career: {
      path: 'sde',
      level: 3,
      company: null,
      bossType: 'neutral',
      tenure: 0,
      onPip: false,
      pipQuartersRemaining: 0,
      coastConsecutive: 0,
      grindConsecutive: 0,
      employed: 'student',
      salary: 0,
      rsu: 0,
    },
    immigration: {
      visaType: 'f1',
      visaExpiryTurn: 999, // F1 valid for duration of study
      permStatus: 'none',
      permStartTurn: 0,
      i140Status: 'none',
      i485Status: 'none',
      priorityDate: null,
      priorityDateCurrent: 0,
      gcTrack: 'none',
      hasComboCard: false,
      hasGreenCard: false,
      h1bAttempts: 0,
      h1bFiled: false,
      unemploymentQuarters: 0,
      graceQuartersRemaining: 0,
    },
    economy: {
      cash: 20000,
      portfolioShares: 0,
      portfolioCostBasis: 0,
      sharePrice: INITIAL_SHARE_PRICE,
      autoInvestAmount: 0,
      ownsHome: false,
      homePurchasePrice: 0,
      homeMortgageRemaining: 0,
      homeValue: 0,
      studentLoanRemaining: 0,
      city: 'tier1',
    },
    academic: {
      gpa: 3.0,
      hadIntern: false,
      internQuality: 'none',
      isPhd: false,
      thesisPoints: 0,
    },
    economicPhase: initialPhase,
    economicPhaseQuarters: 0,
    timeline: [],
    eventCooldowns: {},
    eventFired: new Set(),
    flags: {},
    schoolModifier,
    geoBonus,
    constitutionSicknessModifier,
    grindLockQuarters: 0,
    jobSearchQuarters: 0,
    endingType: null,
    hasUsMasters: true,
  };
}

export function getTurnInfo(turn: number) {
  const year = 2024 + Math.floor(turn / 4);
  const quarter = (turn % 4) + 1;
  const age = 22 + Math.floor(turn / 4);
  return { year, quarter, age };
}

export function getEffectiveAp(state: GameState, workMode?: WorkMode | AcademicStudyMode): number {
  let base = 10;
  const isGrind = workMode === 'grind' || workMode === 'intense';
  if (isGrind && state.grindLockQuarters <= 0) base += 3;

  // Intern work takes 3AP automatically
  if (state.phase === 'academic' && state.academic.hadIntern) {
    base -= 3;
  }

  // Sickness reduces AP but never below 4 (enough for rest + hospital visit)
  const sicknessPenalty = (state.flags.sicknessApPenalty as number) || 0;
  base -= sicknessPenalty;
  base = Math.max(base, 4);

  // Burnout = minimum AP (can still rest)
  if (state.flags.burnoutActive) return 4;
  // Hospitalized = minimum AP
  if (state.attributes.health <= 0) return 4;

  return Math.max(0, base);
}

export function getWorkModeCost(mode: WorkMode | AcademicStudyMode): number {
  switch (mode) {
    case 'coast': case 'light': return 3;
    case 'normal': return 4;
    case 'grind': case 'intense': return 4;
  }
}

export function getWorkModeEffects(mode: WorkMode | AcademicStudyMode, state: GameState): Partial<CoreAttributes> {
  const perfMult = getPerformanceGainMultiplier(state);

  // Constitution reduces grind/intense health cost: 0 = full, 5 = 50% reduced
  const grindReduction = state.creation.constitution * 0.1;

  if (state.phase === 'academic') {
    switch (mode as AcademicStudyMode) {
      case 'light': return { skills: 2, mental: 3 };
      case 'normal': return { skills: 5, mental: -2 };
      case 'intense': return { skills: 8, mental: -8, health: Math.round(-10 * (1 - grindReduction)) };
    }
  }

  switch (mode as WorkMode) {
    case 'coast': return { performance: Math.round(-5 * perfMult), mental: 3 };
    case 'normal': return { performance: Math.round(5 * perfMult), mental: -2 };
    case 'grind': return { performance: Math.round(15 * perfMult), mental: -8, health: Math.round(-15 * (1 - grindReduction)) };
  }
}

// Process a full turn given player's selections
export function processTurn(
  state: GameState,
  workMode: WorkMode | AcademicStudyMode,
  selectedActions: ActionId[]
): GameState {
  let s = structuredClone(state);
  // Convert Set back after structuredClone (it becomes a plain object)
  s.eventFired = new Set(state.eventFired);

  const turnInfo = getTurnInfo(s.turn);
  const attrsBefore = { ...s.attributes };
  const turnEvents: { id: string; choiceId: string }[] = [];

  // 1. Advance turn
  s.turn++;

  // 2. Economic cycle transition
  s.economicPhaseQuarters++;
  const transition = checkPhaseTransition(s.economicPhase, s.economicPhaseQuarters);
  if (transition.transitioned) {
    s.economicPhase = transition.newPhase;
    s.economicPhaseQuarters = 0;
  }

  // 2b. Intern work: if student has intern, auto-deduct 3AP and earn $15K
  if (s.phase === 'academic' && s.academic.hadIntern) {
    s.economy.cash += 15000;
    s.attributes = applyDeltas(s.attributes, { skills: 5 }); // intern experience
  }

  // 3. Apply work mode effects
  const workEffects = getWorkModeEffects(workMode, s);
  s.attributes = applyDeltas(s.attributes, workEffects);

  // Track consecutive modes
  if (workMode === 'grind' || workMode === 'intense') {
    s.career.grindConsecutive++;
    s.career.coastConsecutive = 0;
  } else if (workMode === 'coast' || workMode === 'light') {
    s.career.coastConsecutive++;
    s.career.grindConsecutive = 0;
  } else {
    s.career.coastConsecutive = 0;
    s.career.grindConsecutive = 0;
  }

  // 4. Apply selected action effects
  for (const actionId of selectedActions) {
    const action = ACTIONS[actionId];
    if (action) {
      s.attributes = applyDeltas(s.attributes, action.effects);

      // Handle special action side-effects
      if (actionId === 'prepJobChange' || actionId === 'prepJobChangeIntensive') {
        s.jobSearchQuarters++;
      }
      if (actionId === 'prepH1b') {
        s.immigration.h1bFiled = true;
      }
      if (actionId === 'searchIntern') {
        const internRoll = roll('internSearch', s);
        if (internRoll.success) {
          s.academic.hadIntern = true;
          s.academic.internQuality = Math.random() < 0.3 ? 'top' : 'mid';
          turnEvents.push({ id: 'intern_found', choiceId: s.academic.internQuality });
        } else {
          turnEvents.push({ id: 'intern_not_found', choiceId: '' });
        }
      }
      if (actionId === 'thesisResearch') {
        s.academic.thesisPoints++;
        if (Math.random() < 0.4) {
          s.attributes = applyDeltas(s.attributes, { academicImpact: 5 }); // Publication bonus
        }
      }
      if (actionId === 'travel') {
        s.economy.cash -= 2000 + Math.random() * 3000;
      }
      if (actionId === 'hospital') {
        s.economy.cash -= 3000;
        // Hospital visit reduces next quarter's sickness AP penalty
        s.flags.hospitalVisited = true;
      }
      if (actionId === 'therapist') {
        s.economy.cash -= 800;
      }
      if (actionId === 'consultLawyer') {
        s.economy.cash -= 500;
      }
      // Academic GPA gain
      if (actionId === 'studyGpa') {
        s.academic.gpa = Math.min(4.0, s.academic.gpa + 0.2);
      }
      if (actionId === 'networking') {
        // bonus is applied through probability system via flags
        s.flags.networkingBonus = ((s.flags.networkingBonus as number) || 0) + 0.05;
      }
    }
  }

  // 5. Apply natural decay
  const decay = computeNaturalDecay(s);
  // Don't apply performance decay if player worked this turn
  const workedThisTurn = workMode !== 'coast' && workMode !== 'light';
  if (!workedThisTurn && decay.performance !== undefined) {
    // Performance decays when coasting (already handled in work mode effects)
  }
  s.attributes = applyDeltas(s.attributes, {
    skills: decay.skills,
    health: decay.health,
    mental: decay.mental,
  });

  // 6. Process passive economy
  // Salary
  if (s.career.employed === 'employed') {
    const quarterlySalary = (s.career.salary + s.career.rsu) / 4;
    // Simplified tax: ~35% effective rate
    const afterTax = quarterlySalary * 0.65;
    // Living expenses (simplified by city tier)
    const livingCosts: Record<string, number> = { tier1: 14000, tier2: 10000, tier3: 7000, tier4: 5500 };
    const expenses = livingCosts[s.economy.city] || 10000;
    s.economy.cash += afterTax - expenses;
  }

  // Student loan payment
  if (s.economy.studentLoanRemaining > 0) {
    const payment = Math.min(1500, s.economy.studentLoanRemaining);
    s.economy.cash -= payment;
    s.economy.studentLoanRemaining -= payment;
  }

  // Mortgage payment
  if (s.economy.ownsHome) {
    const mortgageQuarterly = s.economy.homePurchasePrice * 0.065 / 4; // simplified 6.5% annual
    s.economy.cash -= mortgageQuarterly;
    s.economy.homeMortgageRemaining -= mortgageQuarterly * 0.3; // ~30% goes to principal
  }

  // Auto-invest S&P
  if (s.economy.autoInvestAmount > 0 && s.economy.cash > s.economy.autoInvestAmount) {
    const amount = s.economy.autoInvestAmount;
    const shares = amount / s.economy.sharePrice;
    s.economy.portfolioShares += shares;
    s.economy.portfolioCostBasis += amount;
    s.economy.cash -= amount;
  }

  // Market returns
  const marketReturn = rollMarketReturn(s.economicPhase);
  s.economy.sharePrice = updateSharePrice(s.economy.sharePrice, marketReturn);

  // Housing value update
  if (s.economy.ownsHome) {
    const housingChange = rollHousingChange(s.economicPhase);
    s.economy.homeValue *= (1 + housingChange);
  }

  // 7. Probability checks
  // Sickness (immune during first year — turns 1-4)
  s.flags.sicknessApPenalty = 0;
  s.flags.gotSick = false;
  const sicknessImmune = s.turn <= 4;
  const sicknessRoll = sicknessImmune ? { success: false, probability: 0, rollValue: 1 } : roll('sickness', s);
  if (sicknessRoll.success) {
    s.flags.gotSick = true;
    const severity = Math.random();
    let apPenalty: number;
    let medicalCost: number;
    let grindLock: number;
    let mentalHit: number;
    const isUpgraded = s.attributes.health < 20;

    if (severity < (isUpgraded ? 0.30 : 0.50)) {
      apPenalty = 2; medicalCost = 1000 + Math.random() * 2000; grindLock = 1; mentalHit = -5;
    } else if (severity < (isUpgraded ? 0.70 : 0.85)) {
      apPenalty = 5; medicalCost = 3000 + Math.random() * 5000; grindLock = 2; mentalHit = -10;
    } else if (severity < (isUpgraded ? 0.90 : 0.97)) {
      apPenalty = 8; medicalCost = 8000 + Math.random() * 12000; grindLock = 3; mentalHit = -15;
    } else {
      apPenalty = 10; medicalCost = 15000 + Math.random() * 15000; grindLock = 4; mentalHit = -20;
      s.attributes.health = 40; // hospitalized reset
    }

    s.flags.sicknessApPenalty = apPenalty;
    s.flags.sicknessSeverity = apPenalty <= 2 ? 'mild' : apPenalty <= 5 ? 'moderate' : apPenalty <= 8 ? 'severe' : 'hospitalized';
    s.economy.cash -= medicalCost;
    s.grindLockQuarters = Math.max(s.grindLockQuarters, grindLock);
    s.attributes = applyDeltas(s.attributes, { mental: mentalHit, health: 5 }); // forced minor recovery
    turnEvents.push({ id: `sickness_${s.flags.sicknessSeverity}`, choiceId: '' });
  }

  // Burnout
  if (s.attributes.mental < 30) {
    const burnoutRoll = roll('burnout', s);
    if (burnoutRoll.success) {
      s.flags.burnoutActive = true;
      s.attributes.mental = 30;
      s.attributes = applyDeltas(s.attributes, { performance: -10 });
      s.grindLockQuarters = Math.max(s.grindLockQuarters, 2);
      turnEvents.push({ id: 'burnout', choiceId: '' });
    }
  } else {
    s.flags.burnoutActive = false;
  }

  // Grind lock countdown
  if (s.grindLockQuarters > 0) s.grindLockQuarters--;

  // Career tenure
  if (s.career.employed === 'employed') s.career.tenure++;

  // 7b. Academic phase: GPA gain from study mode, graduation check
  if (s.phase === 'academic') {
    const gpaGain = getGpaGain(workMode);
    s.academic.gpa = Math.min(4.0, s.academic.gpa + gpaGain);

    if (isGraduationTurn(s)) {
      const grad = processGraduation(s);
      s.phase = grad.newPhase;
      Object.assign(s.career, grad.careerUpdates);
      s.economy.studentLoanRemaining = grad.studentDebt;
      s.attributes = applyDeltas(s.attributes, { mental: grad.mentalDelta });

      // Activate OPT
      const optUpdates = activateOpt(s);
      Object.assign(s.immigration, optUpdates);

      turnEvents.push(...grad.events.map(id => ({ id, choiceId: '' })));
    }
  }

  // 7c. Career system: annual review (Q4), PIP check, layoff check, boss rotation
  if (s.phase === 'career' && s.career.employed === 'employed') {
    const currentQ = ((s.turn - 1) % 4) + 1;

    // Q4: Annual performance review
    if (currentQ === 4) {
      const review = processAnnualReview(s);
      if (review.promoted) {
        s.career.level = review.newLevel;
        s.attributes.performance = review.performanceReset ?? 60;
        if (review.salaryChange) {
          s.career.salary = review.salaryChange.salary;
          s.career.rsu = review.salaryChange.rsu;
        }
        turnEvents.push({ id: 'promoted', choiceId: '' });
      }
      s.attributes = applyDeltas(s.attributes, { mental: review.mentalDelta });
    }

    // PIP check
    if (s.career.onPip) {
      s.career.pipQuartersRemaining--;
      const pipResult = processPipQuarter(s);
      if (pipResult.terminated) {
        s.career.employed = 'unemployed';
        s.career.onPip = false;
        s.flags.justLaidOff = true;
        s.attributes = applyDeltas(s.attributes, { mental: -25 });
        turnEvents.push({ id: 'pip_terminated', choiceId: '' });
      } else if (pipResult.resolved) {
        s.career.onPip = false;
        s.attributes = applyDeltas(s.attributes, { mental: 10 });
        turnEvents.push({ id: 'pip_resolved', choiceId: '' });
      }
    } else {
      const pipCheck = checkPip(s);
      if (pipCheck.pipTriggered) {
        s.career.onPip = true;
        s.career.pipQuartersRemaining = 2;
        s.attributes = applyDeltas(s.attributes, { mental: -20 });
        turnEvents.push({ id: 'pip_started', choiceId: '' });
      }
    }

    // Layoff check
    if (!s.career.onPip) {
      const layoffCheck = checkLayoff(s);
      if (layoffCheck.laidOff) {
        s.career.employed = 'unemployed';
        s.economy.cash += layoffCheck.severance;
        s.flags.justLaidOff = true;
        s.attributes = applyDeltas(s.attributes, { mental: -25 });
        turnEvents.push({ id: 'laid_off', choiceId: '' });
      }
    }

    // Boss rotation
    if (shouldRotateBoss(s.career.tenure)) {
      s.career.bossType = rollBossType();
      turnEvents.push({ id: 'boss_changed', choiceId: '' });
    }
  }

  // 7d. Immigration processing
  if (s.phase === 'career') {
    const immResult = processImmigrationQuarter(s);
    Object.assign(s.immigration, immResult.updates);
    s.attributes = applyDeltas(s.attributes, { mental: immResult.mentalDelta });
    s.economy.cash -= immResult.economyCost;
    turnEvents.push(...immResult.events.map(id => ({ id, choiceId: '' })));

    if (immResult.gameOver) {
      s.endingType = 'deported';
    }
  }
  s.flags.justLaidOff = false;

  // 7e. Random events — select but don't resolve (UI handles interactive choice)
  const randomEvents = selectEvents(s);
  // Store pending events on the state for the UI to present
  s.flags.pendingRandomEvents = randomEvents.map(e => e.id);
  // Mark cooldowns and one-time flags now (selection is committed)
  for (const event of randomEvents) {
    s.eventCooldowns[event.id] = s.turn;
    if (event.oneTime) s.eventFired.add(event.id);
  }

  // 8. Update net worth
  const portfolioValue = s.economy.portfolioShares * s.economy.sharePrice;
  const homeEquity = s.economy.ownsHome
    ? Math.max(0, s.economy.homeValue - s.economy.homeMortgageRemaining)
    : 0;
  s.attributes.netWorth = s.economy.cash + portfolioValue + homeEquity - s.economy.studentLoanRemaining;

  // 9. Record quarter
  const record = {
    turn: s.turn,
    year: getTurnInfo(s.turn).year,
    quarter: getTurnInfo(s.turn).quarter,
    age: getTurnInfo(s.turn).age,
    attributesBefore: attrsBefore,
    attributesAfter: { ...s.attributes },
    events: turnEvents,
    workMode,
    actions: selectedActions,
  };
  s.timeline.push(record);

  // 10. Check game over
  if (s.turn >= 148) {
    s.endingType = s.immigration.hasGreenCard ? 'age59WithGc' : 'age59WithoutGc';
  }

  return s;
}

// Apply a player's event choice to the game state (called by UI after event popup)
export function resolveEvent(state: GameState, event: import('./types').GameEvent, choiceId: string): GameState {
  const s = structuredClone(state);
  s.eventFired = new Set(state.eventFired);

  const result = applyEventChoice(s, event, choiceId);
  s.attributes = applyDeltas(s.attributes, result.effects);
  if (result.flags) {
    Object.assign(s.flags, result.flags);
  }

  // Update net worth after event effects
  const portfolioValue = s.economy.portfolioShares * s.economy.sharePrice;
  const homeEquity = s.economy.ownsHome
    ? Math.max(0, s.economy.homeValue - s.economy.homeMortgageRemaining)
    : 0;
  s.attributes.netWorth = s.economy.cash + portfolioValue + homeEquity - s.economy.studentLoanRemaining;

  // Add to timeline
  const lastRecord = s.timeline[s.timeline.length - 1];
  if (lastRecord) {
    lastRecord.events.push({ id: event.id, choiceId });
    lastRecord.attributesAfter = { ...s.attributes };
  }

  // Remove from pending
  const pending = (s.flags.pendingRandomEvents as string[]) || [];
  s.flags.pendingRandomEvents = pending.filter(id => id !== event.id);

  return s;
}

export function calculateFinalScore(state: GameState): number {
  const nw = Math.max(0, state.attributes.netWorth);
  const gcMult = state.immigration.hasGreenCard ? 1.5 : state.endingType === 'deported' ? 0.8 : 1.0;
  const age = getTurnInfo(state.turn).age;
  const earlyBonus = state.immigration.hasGreenCard ? Math.max(0, (59 - age) * 10000) : 0;
  return Math.round(nw * gcMult + earlyBonus);
}
