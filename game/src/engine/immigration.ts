// Immigration System — visa state machine, PERM, I-140, I-485, green card

import type { GameState, VisaType, PermStatus, I140Status, I485Status, ImmigrationState } from './types';
import { roll } from './probability';

// Processing time ranges (in quarters)
const PERM_BASE_QUARTERS = 3;
const PERM_AUDIT_EXTRA_MIN = 2;
const PERM_AUDIT_EXTRA_MAX = 6;
const I140_NORMAL_MIN = 2;
const I140_NORMAL_MAX = 4;
const I140_PREMIUM_COST = 2500;
const I485_PROCESSING_MIN = 4;
const I485_PROCESSING_MAX = 12;
const EB2_WAIT_BASE = 30;
const EB2_WAIT_VARIANCE = 12;

const GC_WILLINGNESS_DELAY: Record<string, [number, number]> = {
  eager: [0, 2],
  standard: [2, 4],
  reluctant: [4, 8],
};

function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function processImmigrationQuarter(state: GameState): {
  updates: Partial<ImmigrationState>;
  mentalDelta: number;
  economyCost: number;
  events: string[];
  gameOver: boolean;
} {
  const imm = state.immigration;
  const updates: Partial<ImmigrationState> = {};
  let mentalDelta = 0;
  let economyCost = 0;
  const events: string[] = [];
  let gameOver = false;

  const quarter = ((state.turn - 1) % 4) + 1;

  // --- Visa countdown + warnings ---
  if (!imm.hasGreenCard && !imm.hasComboCard) {
    const remaining = imm.visaExpiryTurn - state.turn;
    // Warning at 4 quarters and 2 quarters
    if (remaining === 4) {
      events.push('visa_expiry_warning_4q');
      mentalDelta -= 5;
    } else if (remaining === 2) {
      events.push('visa_expiry_warning_2q');
      mentalDelta -= 10;
    }
    if (remaining <= 0) {
      // Check grace period
      if (imm.graceQuartersRemaining > 0) {
        updates.graceQuartersRemaining = imm.graceQuartersRemaining - 1;
        events.push('grace_period_ticking');
      } else {
        // Deportation
        gameOver = true;
        events.push('visa_expired_deported');
      }
    }
  }

  // --- Auto-file H1B: employer files for you if on OPT/STEM and employed ---
  if (
    !imm.h1bFiled && !imm.h1bPending &&
    ['opt', 'optStem', 'cptDay1'].includes(imm.visaType) &&
    state.career.employed === 'employed' &&
    quarter === 1 // File in Q1 for Q2 lottery
  ) {
    updates.h1bFiled = true;
    economyCost += 2000; // Filing fee (employer pays most, you pay some)
    events.push('h1b_auto_filed');
  }

  // --- H1B Lottery (Q2) ---
  if (quarter === 2 && imm.h1bFiled) {
    const eventType = state.hasUsMasters ? 'h1bLotteryMasters' : 'h1bLottery';
    const result = roll(eventType, state);
    updates.h1bFiled = false;
    updates.h1bAttempts = imm.h1bAttempts + 1;

    if (result.success) {
      // H1B selected but doesn't activate until Q4 (Oct 1)
      // Store as pending — layoff before Q4 cancels it
      updates.visaType = imm.visaType; // stay on current visa
      mentalDelta += 20;
      events.push('h1b_approved');
      updates.h1bPending = true;
    } else {
      mentalDelta -= 20;
      events.push('h1b_denied');
    }
  }

  // --- H1B Pending → Active (Q4) ---
  if (quarter === 4 && imm.h1bPending) {
    if (state.career.employed === 'employed') {
      updates.visaType = 'h1b';
      updates.visaExpiryTurn = state.turn + 12; // first 3-year term
      updates.h1bPending = false;
      updates.h1bStartTurn = state.turn; // track start for 6-year cap
      events.push('h1b_activated');
      mentalDelta += 5;
    } else {
      updates.h1bPending = false;
      mentalDelta -= 20;
      events.push('h1b_pending_lost');
    }
  }

  // --- OPT: 36 months total (OPT + STEM combined), 12-month unemployment limit ---
  // optUnemployedQuarters is tracked/incremented in processTurn, just read it here
  if (imm.visaType === 'opt' || imm.visaType === 'optStem') {
    const optUnemployedQ = (state.flags.optUnemployedQuarters as number) || 0;
    if (optUnemployedQ >= 3) {
      gameOver = true;
      events.push('opt_unemployment_exceeded');
      mentalDelta -= 20;
    } else if (optUnemployedQ >= 2) {
      events.push('opt_unemployment_warning');
      mentalDelta -= 10;
    }
  }

  // --- Lawyer boost: +10% to immigration rolls this quarter ---
  const lawyerBoost = state.flags.lawyerImmigrationBoost ? 0.10 : 0;

  // --- PERM Processing (probability-based) ---
  if (imm.permStatus === 'pending') {
    const permQuarters = state.turn - imm.permStartTurn;

    // PERM processing: ~4-6 quarters (1-1.5 years) realistic
    // First 3 quarters: processing, small audit/reject risk
    if (permQuarters < 3) {
      // Audit risk: 5% per quarter (lawyer reduces)
      const auditChance = Math.max(0, 0.05 - lawyerBoost);
      if (Math.random() < auditChance) {
        updates.permStatus = 'none'; // audited → must refile
        updates.permStartTurn = 0;
        mentalDelta -= 15;
        events.push('perm_rejected');
      }
    } else {
      // From Q4 onwards: high approval chance, most PERMs get approved
      // Q4: 40%, Q5: 65%, Q6: 85%, Q7+: 95%
      const approvalChance = Math.min(0.95, 0.40 + (permQuarters - 3) * 0.25 + lawyerBoost);
      if (Math.random() < approvalChance) {
        updates.permStatus = 'approved';
        mentalDelta += 5;
        events.push('perm_approved');
      }
    }
  }

  // --- Auto-start PERM: company files as soon as you have H1B ---
  if (
    imm.permStatus === 'none' &&
    state.career.employed === 'employed' &&
    ['h1b', 'h1bRenewal', 'h1b7thYear'].includes(imm.visaType)
  ) {
    updates.permStatus = 'pending';
    updates.permStartTurn = state.turn;
    updates.gcTrack = 'perm';
    economyCost += 3000;
    events.push('perm_filed');
  }

  // --- I-140 Processing ---
  if (imm.permStatus === 'approved' && imm.i140Status === 'none') {
    // File I-140
    updates.i140Status = 'pending';
    economyCost += I140_PREMIUM_COST; // Use premium processing by default (smart play)
    events.push('i140_filed');
  }

  if (imm.i140Status === 'pending') {
    // Premium processing: approve this quarter (lawyer boost = +10%)
    const result = roll('i140Approval', state);
    if (result.success || (lawyerBoost > 0 && Math.random() < lawyerBoost)) {
      updates.i140Status = 'approved';
      updates.priorityDate = imm.permStartTurn; // Priority date = when PERM was filed
      mentalDelta += 10;
      events.push('i140_approved');
    } else {
      mentalDelta -= 10;
      events.push('i140_denied');
      updates.i140Status = 'none'; // Can refile
    }
  }

  // --- Priority Date Queue: Table A + Table B ---
  // Table B (filing date): advances faster, when current → can file I-485 + get combo card
  // Table A (final action date): advances slower, when current → I-485 can be approved
  if (imm.i140Status === 'approved' && imm.priorityDate !== null) {
    const pd = imm.priorityDate;

    // Table B: avg ~1.2/quarter → PD 14 in ~12Q (3 years) → combo card
    const bVariance = -0.5 + Math.random() * 1.5; // -0.5 to +1.0
    const bMovement = Math.max(-1, Math.min(3, 1.0 + bVariance));
    const newB = imm.chartBCurrent + bMovement;
    updates.chartBCurrent = newB;

    // Table A: avg ~0.8/quarter → PD 14 in ~18Q (4.5 years) → GC eligible
    // After Table B reached, Table A still ~6-8Q behind = 1.5-2 year gap
    const aVariance = -0.8 + Math.random() * 1.5; // -0.8 to +0.7
    const aMovement = Math.max(-1.5, Math.min(2.5, 0.6 + aVariance));
    const newA = imm.priorityDateCurrent + aMovement;
    updates.priorityDateCurrent = newA;

    // Retrogression event (either table moves backwards significantly)
    if (aVariance < -0.8 || bVariance < -0.6) {
      mentalDelta -= 15;
      events.push('priority_date_retrogression');
    }

    // Table B reached: file I-485 + combo card
    if (imm.i485Status === 'none' && newB >= pd) {
      updates.i485Status = 'pending';
      updates.hasComboCard = true;
      economyCost += 5000;
      mentalDelta += 20;
      events.push('i485_filed_combo_card');
    }
  }

  // --- I-485 Processing (requires Table A to be current) ---
  if (imm.i485Status === 'pending') {
    // Check for RFE
    if (Math.random() < 0.05) {
      updates.i485Status = 'rfe';
      mentalDelta -= 15;
      economyCost += 3000;
      events.push('i485_rfe');
    } else {
      // Must have been pending 4+ quarters AND Table A must be current
      const processingStart = state.timeline.findIndex(
        (r) => r.events?.some((e) => e.id === 'i485_filed_combo_card')
      );
      const quartersProcessing = processingStart >= 0 ? state.turn - processingStart : 0;
      const tableACurrent = (updates.priorityDateCurrent ?? imm.priorityDateCurrent) >= (imm.priorityDate || 0);

      if (quartersProcessing >= 4 && tableACurrent) {
        // Table A current + 1 year processing = GREEN CARD!
        updates.i485Status = 'approved';
        updates.hasGreenCard = true;
        updates.visaType = 'greenCard';
        updates.visaExpiryTurn = 9999;
        mentalDelta += 30;
        events.push('green_card_approved');
      }
    }
  }

  if (imm.i485Status === 'rfe') {
    if (Math.random() < 0.5) {
      updates.i485Status = 'pending';
      events.push('rfe_resolved');
    }
  }

  // --- NOID check for combo card holders who are unemployed ---
  if (imm.hasComboCard && !imm.hasGreenCard && state.career.employed === 'unemployed') {
    updates.unemploymentQuarters = imm.unemploymentQuarters + 1;
    if (imm.unemploymentQuarters >= 1) { // 1 quarter grace, then risk
      const noidResult = roll('i485Noid', state);
      if (noidResult.success) {
        mentalDelta -= 25;
        events.push('noid_received');
        // Player has 1 quarter to find employment or I-485 denied
        if (imm.unemploymentQuarters >= 3) {
          // If already been unemployed 3+ quarters and NOID fires, very bad
          updates.i485Status = 'none';
          updates.hasComboCard = false;
          mentalDelta -= 10;
          events.push('i485_denied_noid');
        }
      }
    }
  } else if (state.career.employed === 'employed') {
    updates.unemploymentQuarters = 0;
  }

  // --- H1B Renewal (6-year cap without I-140) ---
  // Skip if green card was just approved this quarter
  if (
    !updates.hasGreenCard &&
    ['h1b', 'h1bRenewal', 'h1b7thYear'].includes(imm.visaType) &&
    state.career.employed === 'employed' &&
    imm.visaExpiryTurn - state.turn <= 2 &&
    imm.visaExpiryTurn - state.turn > 0
  ) {
    const h1bYearsUsed = imm.h1bStartTurn > 0 ? (state.turn - imm.h1bStartTurn) / 4 : 0;
    const hasI140OrPendingPerm = imm.i140Status === 'approved' ||
      (imm.permStatus !== 'none' && state.turn - imm.permStartTurn > 4);

    if (hasI140OrPendingPerm) {
      // Eligible for 7th year extension (1-year renewals indefinitely)
      updates.visaType = 'h1b7thYear';
      updates.visaExpiryTurn = state.turn + 4; // 1-year renewal
      economyCost += 2000;
      events.push('h1b_7th_year_extension');
    } else if (h1bYearsUsed < 6) {
      // Standard renewal within 6-year cap
      const remainingQuarters = Math.min(12, (6 - h1bYearsUsed) * 4);
      updates.visaType = 'h1bRenewal';
      updates.visaExpiryTurn = state.turn + Math.max(4, Math.round(remainingQuarters));
      economyCost += 2000;
      events.push('h1b_renewed');
    } else {
      // 6 years used, no I-140 → cannot renew. H1B will expire → deportation.
      mentalDelta -= 30;
      events.push('h1b_6year_expired');
    }
  }

  // --- Layoff impact on immigration ---
  if (state.flags.justLaidOff) {
    // Cancel pending H1B if laid off before activation
    if (imm.h1bPending) {
      updates.h1bPending = false;
      mentalDelta -= 20;
      events.push('h1b_pending_lost');
    }
    if (!imm.hasComboCard && !imm.hasGreenCard) {
      // H1B holder laid off: 60-day grace (1 quarter)
      updates.graceQuartersRemaining = 1;
      events.push('h1b_grace_period_started');
    }

    // PERM reset if pre-I-140
    if (imm.permStatus !== 'none' && imm.permStatus !== 'approved' && imm.i140Status !== 'approved') {
      updates.permStatus = 'none';
      updates.permStartTurn = 0;
      mentalDelta -= 15;
      events.push('perm_voided_layoff');
    }
  }

  return { updates, mentalDelta, economyCost, events, gameOver };
}

export function getVisaLabel(type: VisaType): string {
  const labels: Record<VisaType, string> = {
    f1: 'F-1 学生', opt: 'OPT', optStem: 'OPT STEM',
    h1b: 'H-1B', h1bRenewal: 'H-1B', h1b7thYear: 'H-1B 7th+',
    o1: 'O-1', l1: 'L-1', cptDay1: 'Day-1 CPT',
    comboCard: 'Combo卡 (EAD/AP)', greenCard: '绿卡 (永久居民)',
  };
  return labels[type] || type;
}

export function canChangeEmployerFreely(state: GameState): boolean {
  return state.immigration.hasGreenCard || state.immigration.hasComboCard;
}

export function getTravelRisk(state: GameState): number {
  if (state.immigration.hasGreenCard) return 0;
  if (state.immigration.hasComboCard) return 0;
  if (['h1b', 'h1bRenewal', 'h1b7thYear'].includes(state.immigration.visaType)) return 0.05;
  if (['opt', 'optStem'].includes(state.immigration.visaType)) return 0.03;
  return 0;
}

export function activateOpt(state: GameState): Partial<ImmigrationState> {
  return {
    visaType: 'opt',
    visaExpiryTurn: state.turn + 12, // 36 months (OPT + STEM combined)
  };
}
