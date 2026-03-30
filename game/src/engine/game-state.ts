// Game State — initializes and manages the central game state

import type { CreationAttributes, GameState, WorkMode, ActionId, CoreAttributes, AcademicStudyMode } from './types';
import { createStartingAttributes, applyDeltas, computeNaturalDecay, computeSicknessChance, computeBurnoutChance, getPerformanceGainMultiplier } from './attributes';
import { roll, preview } from './probability';
import { rollInitialPhase, checkPhaseTransition, rollMarketReturn, rollHousingChange, updateSharePrice, rollEventCount, INITIAL_SHARE_PRICE } from './economic-cycle';
import { ACTIONS, getAvailableActions } from './actions';
import { processAnnualReview, checkPip, processPipQuarter, checkLayoff, shouldRotateBoss, rollBossType, computeSalary, generateCompany } from './career';
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
      h1bPending: false,
      h1bStartTurn: 0,
      unemploymentQuarters: 0,
      graceQuartersRemaining: 0,
    },
    economy: {
      cash: 80000,

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
      hasReturnOffer: false,
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

// Max AP is always 10 (can overdraft from base 7 up to 10 = grind territory)
// Base AP = 7, overdraft to 10 allowed but triggers grind health penalty
export function getMaxAp(state: GameState): number {
  let max = 10;

  // Grind locked: can't overdraft, cap at 7
  if (state.grindLockQuarters > 0) max = 7;

  // Sickness reduces max
  const sicknessPenalty = (state.flags.sicknessApPenalty as number) || 0;
  max -= sicknessPenalty;
  max = Math.max(max, 4);

  // Burnout / hospitalized
  if (state.flags.burnoutActive || state.attributes.health <= 0) return 4;

  return max;
}

export function getBaseAp(state: GameState): number {
  return 7;
}

// Determine work mode from AP actually used
export function inferWorkMode(apUsed: number, hasUrgentJobSearch: boolean): WorkMode {
  if (hasUrgentJobSearch) {
    // Urgent job search forces at least normal mode
    return apUsed > 7 ? 'grind' : 'normal';
  }
  if (apUsed > 7) return 'grind';
  if (apUsed <= 5) return 'coast';
  return 'normal';
}

export function getEffectiveAp(state: GameState, workMode?: WorkMode | AcademicStudyMode): number {
  // workMode parameter kept for compatibility but now ignored
  // Always return max AP — player decides how much to use
  return getMaxAp(state);

  return Math.max(0, base);
}

export function getWorkModeCost(mode: WorkMode | AcademicStudyMode): number {
  switch (mode) {
    case 'coast': case 'light': return 0;
    case 'normal': return 0;
    case 'grind': case 'intense': return 0;
  }
}

// Mode effects: only lifestyle impact (mental/health). Performance/skills come from actions.
export function getWorkModeEffects(mode: WorkMode | AcademicStudyMode, state: GameState): Partial<CoreAttributes> {
  const grindReduction = state.creation.constitution * 0.1;

  switch (mode) {
    case 'coast': case 'light':
      return { mental: 5 }; // relaxed, good recovery
    case 'normal':
      return { mental: -1 }; // baseline stress
    case 'grind': case 'intense':
      return { mental: -5, health: Math.round(-10 * (1 - grindReduction)) }; // burnout risk
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

  // 2b. Intern work: one quarter only, then resolve return offer
  if (s.phase === 'academic' && s.flags.internActiveThisQuarter) {
    s.economy.cash += 15000;
    s.attributes = applyDeltas(s.attributes, { skills: 5 });
    s.flags.internActiveThisQuarter = false; // intern ends after 1 quarter

    // Return offer probability: base 15%, +15% if worked hard
    const workedHard = selectedActions.includes('internWork');
    const returnOfferProb = workedHard ? 0.30 : 0.15;
    const topCompanyBonus = s.academic.internQuality === 'top' ? 0.05 : 0;
    if (Math.random() < returnOfferProb + topCompanyBonus) {
      s.academic.hasReturnOffer = true;
      turnEvents.push({ id: 'return_offer_received', choiceId: '' });
    } else {
      turnEvents.push({ id: 'return_offer_not_received', choiceId: '' });
    }
  }

  // 3. Calculate total AP used and infer work mode
  const totalApUsed = selectedActions.reduce((sum, id) => {
    const action = ACTIONS[id];
    return sum + (action?.apCost || 0);
  }, 0);
  const hasUrgentJob = selectedActions.includes('urgentJobSearch');
  const inferredMode = inferWorkMode(totalApUsed, hasUrgentJob);
  // Use inferred mode for effects (workMode param now ignored)
  const actualWorkMode = inferredMode;
  const workEffects = getWorkModeEffects(actualWorkMode, s);
  s.attributes = applyDeltas(s.attributes, workEffects);

  // Track consecutive modes
  if (actualWorkMode === 'grind') {
    s.career.grindConsecutive++;
    s.career.coastConsecutive = 0;
  } else if (actualWorkMode === 'coast') {
    s.career.coastConsecutive++;
    s.career.grindConsecutive = 0;
  } else {
    s.career.coastConsecutive = 0;
    s.career.grindConsecutive = 0;
  }

  // 4. Apply selected action effects
  // School ranking bonus: +1 performance per school point for work actions
  const schoolPerfBonus = s.creation.schoolRanking;
  for (const actionId of selectedActions) {
    const action = ACTIONS[actionId];
    if (action) {
      let effects = { ...action.effects };
      // School ranking adds +1 per point to all work performance actions
      if (['workNone', 'workSlack', 'workHard', 'workSuperHard'].includes(actionId) && effects.performance !== undefined) {
        effects.performance = (effects.performance as number) + schoolPerfBonus;
      }
      s.attributes = applyDeltas(s.attributes, effects);

      // Handle special action side-effects
      if (actionId === 'prepJobChange') {
        // Roll for job offer this quarter
        const offerRoll = roll('jobOffer', s);
        if (offerRoll.success) {
          // Generate offer details (capped by salary band)
          const currentTC = s.career.salary + s.career.rsu;
          const skillsBonus = Math.min(s.attributes.skills * 0.002, 0.30); // cap skills bonus at 30%
          const hopPremium = 0.15 + Math.random() * 0.25 + skillsBonus;
          const targetTC = Math.round(currentTC * (1 + hopPremium));
          const externalPromo = Math.random() < 0.15;
          const offerLevel = externalPromo ? Math.min(s.career.level + 1, 7) : s.career.level;

          // Cap salary at band maximum (imported from career.ts salary bands)
          const BAND_MAX: Record<number, { salary: number; rsu: number }> = {
            3: { salary: 180000, rsu: 30000 }, 4: { salary: 250000, rsu: 60000 },
            5: { salary: 350000, rsu: 100000 }, 6: { salary: 500000, rsu: 180000 },
            7: { salary: 700000, rsu: 300000 },
          };
          const band = BAND_MAX[offerLevel] || BAND_MAX[3];
          s.flags.pendingJobOffer = {
            salary: Math.round(Math.min(band.salary, targetTC * 0.7)),
            rsu: Math.round(Math.min(band.rsu, targetTC * 0.3)),
            level: offerLevel,
            premium: Math.round(hopPremium * 100),
            signingBonus: Math.round(Math.min(band.salary * 0.3, targetTC * 0.1)),
          };
          turnEvents.push({ id: 'job_offer_received', choiceId: '' });
        } else {
          turnEvents.push({ id: 'job_offer_rejected', choiceId: '' });
        }
      }
      if (actionId === 'prepH1b') {
        s.immigration.h1bFiled = true;
      }
      if (actionId === 'searchIntern') {
        const internRoll = roll('internSearch', s);
        if (internRoll.success) {
          const newQuality = Math.random() < 0.3 ? 'top' : 'mid';
          // Upgrade if found better, or first intern
          if (!s.academic.hadIntern || (newQuality === 'top' && s.academic.internQuality !== 'top')) {
            s.academic.internQuality = newQuality as 'mid' | 'top';
          }
          s.academic.hadIntern = true;
          s.flags.internActiveThisQuarter = true;
          s.academic.hasReturnOffer = false; // reset — new intern, new chance
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
      // Study actions affect GPA
      if (actionId === 'studySlack') {
        s.academic.gpa = Math.min(4.0, s.academic.gpa + 0.05);
      }
      if (actionId === 'studyNormal') {
        s.academic.gpa = Math.min(4.0, s.academic.gpa + 0.15);
      }
      if (actionId === 'studyHard') {
        s.academic.gpa = Math.min(4.0, s.academic.gpa + 0.30);
      }
      if (actionId === 'studyGpa') {
        s.academic.gpa = Math.min(4.0, s.academic.gpa + 0.10);
      }
      if (actionId === 'urgentJobSearch' && s.phase === 'academic') {
        s.flags.urgentJobSearch = true;
      }
      if ((actionId === 'normalJobSearch' || (actionId === 'urgentJobSearch' && s.phase === 'career')) && s.career.employed === 'unemployed') {
        // Job search while unemployed
        const isUrgent = actionId === 'urgentJobSearch';
        const searchRoll = roll('jobOffer', s);
        // Urgent gives +25% bonus effectively (already in probability via jobSearchQuarters)
        const effectiveSuccess = isUrgent ? (searchRoll.success || Math.random() < 0.25) : searchRoll.success;
        if (effectiveSuccess) {
          // Found a job!
          const company = generateCompany(s.career.level);
          const { salary, rsu } = computeSalary(s.career.level, company, 50);
          s.career.company = company;
          s.career.salary = salary;
          s.career.rsu = rsu;
          s.career.employed = 'employed';
          s.career.tenure = 0;
          s.career.bossType = rollBossType();
          s.attributes.performance = 50;
          turnEvents.push({ id: 'found_job_while_unemployed', choiceId: '' });
        } else {
          turnEvents.push({ id: 'job_search_failed', choiceId: '' });
        }
      }
      if (actionId === 'searchFullTimeJob') {
        s.flags.searchedFullTimeJob = true; // triggers job roll at graduation
      }
      if (actionId === 'consultLawyer') {
        s.economy.cash -= 500;
        // Lawyer consultation gives a small networking bonus for next job search
        s.flags.networkingBonus = ((s.flags.networkingBonus as number) || 0) + 0.02;
      }
      if (actionId === 'day1Cpt') {
        s.economy.cash -= 3000; // CPT school tuition
        // Convert to F-1/CPT status — extends visa, allows work
        if (!s.immigration.hasGreenCard && !s.immigration.hasComboCard) {
          s.immigration.visaType = 'cptDay1';
          s.immigration.visaExpiryTurn = s.turn + 8; // 2 years of CPT
          // Can still enter H1B lottery while on CPT
          s.flags.onCpt = true;
          turnEvents.push({ id: 'cpt_enrolled', choiceId: '' });
        }
      }
      if (actionId === 'invest') {
        // Lump sum: invest 20% of available cash (or use pending invest amount from UI)
        const investAmount = (s.flags.pendingInvestAmount as number) || Math.round(s.economy.cash * 0.20);
        if (investAmount > 0 && s.economy.cash >= investAmount) {
          const shares = investAmount / s.economy.sharePrice;
          s.economy.portfolioShares += shares;
          s.economy.portfolioCostBasis += investAmount;
          s.economy.cash -= investAmount;
        }
        // Apply auto-invest setting change if pending
        if (s.flags.pendingAutoInvestAmount !== undefined) {
          s.economy.autoInvestAmount = s.flags.pendingAutoInvestAmount as number;
          s.flags.pendingAutoInvestAmount = undefined;
        }
        s.flags.pendingInvestAmount = undefined;
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
        s.flags.networkingBonus = ((s.flags.networkingBonus as number) || 0) + 0.025; // halved
      }
    }
  }

  // 5. Apply natural decay
  const decay = computeNaturalDecay(s);
  // Performance change is now fully handled by work actions (workNone/workSlack/workHard/workSuperHard)
  s.attributes = applyDeltas(s.attributes, {
    skills: decay.skills,
    health: decay.health,
    mental: decay.mental,
  });

  // 6. Process passive economy
  // Living costs: always apply
  if (s.phase === 'academic') {
    // Academic: based on geo location. Geo 5 = $3K/month = $9K/quarter, Geo 0 = $1.5K/month = $4.5K/quarter
    const monthlyRent = 1000 + s.creation.geoLocation * 250; // $1000 (geo 0) to $2250 (geo 5)
    s.economy.cash -= monthlyRent * 3;
  } else {
    // Career: $3K/month = $9K/quarter base (was $12K — too harsh)
    s.economy.cash -= 9000;
  }

  // Salary (career phase only)
  if (s.career.employed === 'employed') {
    const quarterlySalary = (s.career.salary + s.career.rsu) / 4;
    const afterTax = quarterlySalary * 0.65;
    s.economy.cash += afterTax;
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

  // 6b. Grind lock countdown (before new locks can be set by sickness/burnout)
  if (s.grindLockQuarters > 0) s.grindLockQuarters--;

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
      apPenalty = 5; medicalCost = 3000 + Math.random() * 5000; grindLock = 1; mentalHit = -10;
    } else if (severity < (isUpgraded ? 0.90 : 0.97)) {
      apPenalty = 8; medicalCost = 8000 + Math.random() * 12000; grindLock = 1; mentalHit = -15;
    } else {
      apPenalty = 10; medicalCost = 15000 + Math.random() * 15000; grindLock = 1; mentalHit = -20;
      s.attributes.health = 40; // hospitalized reset
    }

    s.flags.sicknessApPenalty = apPenalty;
    s.flags.sicknessSeverity = apPenalty <= 2 ? 'mild' : apPenalty <= 5 ? 'moderate' : apPenalty <= 8 ? 'severe' : 'hospitalized';
    s.economy.cash -= medicalCost;
    s.grindLockQuarters = Math.max(s.grindLockQuarters, grindLock);
    s.attributes = applyDeltas(s.attributes, { mental: mentalHit, health: 5 }); // forced minor recovery
    turnEvents.push({ id: `sickness_${s.flags.sicknessSeverity}`, choiceId: '' });
  }

  // Burnout: guaranteed at mental 0, probability-based below 30
  // Burnout protection: can't burnout two quarters in a row
  const burnoutProtected = s.flags.burnoutProtection as boolean;
  if (burnoutProtected) {
    s.flags.burnoutProtection = false; // consume protection
    s.flags.burnoutActive = false;
  } else if (s.attributes.mental <= 0) {
    // Mental hit 0 = automatic burnout
    s.flags.burnoutActive = true;
    s.attributes.mental = 20; // recover to 20 (not 30 — was too high)
    s.attributes = applyDeltas(s.attributes, { performance: -10 });
    s.grindLockQuarters = Math.max(s.grindLockQuarters, 1);
    s.flags.burnoutProtection = true; // next quarter immune
    turnEvents.push({ id: 'burnout', choiceId: '' });
  } else if (s.attributes.mental < 30) {
    const burnoutRoll = roll('burnout', s);
    if (burnoutRoll.success) {
      s.flags.burnoutActive = true;
      s.attributes.mental = 20;
      s.attributes = applyDeltas(s.attributes, { performance: -10 });
      s.grindLockQuarters = Math.max(s.grindLockQuarters, 1);
      s.flags.burnoutProtection = true; // next quarter immune
      turnEvents.push({ id: 'burnout', choiceId: '' });
    }
  } else {
    s.flags.burnoutActive = false;
  }

  // Grind lock countdown (moved after sickness/burnout can set new locks)

  // Career tenure
  if (s.career.employed === 'employed') s.career.tenure++;

  // 7b. Academic phase: graduation check (GPA now comes from study actions above)
  if (s.phase === 'academic') {
    // GPA decay if no study action was taken this turn
    const studiedThisTurn = selectedActions.some(id => ['studySlack', 'studyNormal', 'studyHard', 'studyGpa'].includes(id));
    if (!studiedThisTurn) {
      s.academic.gpa = Math.max(2.0, s.academic.gpa - 0.10); // GPA decays without study
    }

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

    // Layoff: warning system (event sets flag, next quarter resolves)
    if (s.flags.layoffWarningActive && !s.career.onPip) {
      // Resolve layoff from last quarter's warning
      const layoffCheck = checkLayoff(s);
      if (layoffCheck.laidOff) {
        s.career.employed = 'unemployed';
        s.economy.cash += layoffCheck.severance;
        s.flags.justLaidOff = true;
        s.attributes = applyDeltas(s.attributes, { mental: -25 });
        turnEvents.push({ id: 'laid_off', choiceId: '' });
      } else {
        // Survived! Relief.
        s.attributes = applyDeltas(s.attributes, { mental: 3 });
        turnEvents.push({ id: 'layoff_survived', choiceId: '' });
      }
      s.flags.layoffWarningActive = false;
      s.flags.layoffPrepared = false;
    } else if (!s.flags.layoffWarningActive && !s.career.onPip) {
      // Normal background layoff check (lower probability, no warning)
      // Only during recession for surprise layoffs
      if (s.economicPhase === 'recession') {
        const layoffCheck = checkLayoff(s);
        if (layoffCheck.laidOff) {
          s.career.employed = 'unemployed';
          s.economy.cash += layoffCheck.severance;
          s.flags.justLaidOff = true;
          s.attributes = applyDeltas(s.attributes, { mental: -25 });
          turnEvents.push({ id: 'laid_off', choiceId: '' });
        }
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
  const pendingIds = randomEvents.map(e => e.id);
  // Add job offer event if one was generated this turn
  if (s.flags.pendingJobOffer) {
    pendingIds.unshift('job_offer_received'); // show first
  }
  s.flags.pendingRandomEvents = pendingIds;
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
  s.attributes.netWorth = Math.max(0, s.economy.cash + portfolioValue + homeEquity - s.economy.studentLoanRemaining);

  // 9. Record quarter
  const record = {
    turn: s.turn,
    year: getTurnInfo(s.turn).year,
    quarter: getTurnInfo(s.turn).quarter,
    age: getTurnInfo(s.turn).age,
    attributesBefore: attrsBefore,
    attributesAfter: { ...s.attributes },
    events: turnEvents,
    workMode: actualWorkMode,
    actions: selectedActions,
  };
  s.timeline.push(record);

  // 10. Check game over
  if (s.economy.cash < -30000 && !s.endingType) {
    // Bankruptcy: cash below -$30K
    s.endingType = 'bankrupt';
  }
  if (s.turn >= 72 && !s.endingType) {
    s.endingType = s.immigration.hasGreenCard ? 'gcBeforeDeadline' : 'age59WithoutGc';
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

  // Handle job offer: always clear the pending offer after resolution
  if (event.id === 'job_offer_received') {
    // Clear regardless of accept or decline
    if (!result.flags?.acceptJobOffer) {
      s.flags.pendingJobOffer = null; // declined
    }
  }
  if (result.flags?.acceptJobOffer && s.flags.pendingJobOffer) {
    const offer = s.flags.pendingJobOffer as { salary: number; rsu: number; level: number; signingBonus: number };
    // Apply job change
    s.career.salary = offer.salary;
    s.career.rsu = offer.rsu;
    s.career.level = offer.level;
    s.career.tenure = 0;
    s.career.coastConsecutive = 0;
    s.career.grindConsecutive = 0;
    s.career.onPip = false;
    s.career.pipQuartersRemaining = 0;
    s.career.bossType = rollBossType();
    s.career.company = generateCompany(offer.level);
    s.attributes.performance = 50; // new job baseline
    s.economy.cash += offer.signingBonus;

    // Green card impact: reset if no I-140
    if (s.immigration.i140Status !== 'approved') {
      // No I-140 = total green card reset
      if (s.immigration.permStatus !== 'none') {
        s.immigration.permStatus = 'none';
        s.immigration.permStartTurn = 0;
      }
      s.immigration.i140Status = 'none';
      // No priority date without I-140
    }
    // If I-140 approved: priority date preserved (locked at approval time)
    // New company will need new PERM + I-140 but old priority date carries over

    s.flags.pendingJobOffer = null;
  }

  // Update net worth after event effects
  const portfolioValue = s.economy.portfolioShares * s.economy.sharePrice;
  const homeEquity = s.economy.ownsHome
    ? Math.max(0, s.economy.homeValue - s.economy.homeMortgageRemaining)
    : 0;
  s.attributes.netWorth = Math.max(0, s.economy.cash + portfolioValue + homeEquity - s.economy.studentLoanRemaining);

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
  const gcMult = state.immigration.hasGreenCard ? 1.5 : (state.endingType === 'deported' || state.endingType === 'bankrupt') ? 0.8 : 1.0;
  const age = getTurnInfo(state.turn).age;
  const earlyBonus = state.immigration.hasGreenCard ? Math.max(0, (40 - age) * 10000) : 0;
  return Math.round(nw * gcMult + earlyBonus);
}
