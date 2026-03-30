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
    ['opt', 'optStem'].includes(imm.visaType) &&
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

  // --- OPT Expiry tracking + auto STEM extension ---
  if (imm.visaType === 'opt' && state.turn >= 8) {
    // OPT: 4 quarters from graduation (turn 8)
    if (!updates.visaExpiryTurn && imm.visaExpiryTurn === 999) {
      updates.visaExpiryTurn = 8 + 4; // 12
    }
  }

  // Auto-apply OPT STEM extension when OPT is about to expire (all players have STEM degree)
  if (imm.visaType === 'opt' && state.career.employed === 'employed') {
    const remaining = imm.visaExpiryTurn - state.turn;
    if (remaining <= 1 && remaining > 0) {
      updates.visaType = 'optStem';
      updates.visaExpiryTurn = imm.visaExpiryTurn + 10; // ~30 month extension (slightly longer than real 24mo to give 3 lottery attempts)
      events.push('opt_stem_activated');
      mentalDelta += 5;
    }
  }

  // --- PERM Processing (probability-based) ---
  if (imm.permStatus === 'pending') {
    const permQuarters = state.turn - imm.permStartTurn;

    // First 4 quarters: cannot be approved
    if (permQuarters < 4) {
      // Rejection check: Q1=20%, Q2=10%, Q3+=2%
      let rejectChance = 0;
      if (permQuarters === 0) rejectChance = 0.20;
      else if (permQuarters === 1) rejectChance = 0.10;
      else rejectChance = 0.02;

      if (Math.random() < rejectChance) {
        updates.permStatus = 'none'; // rejected, must refile
        updates.permStartTurn = 0;
        mentalDelta -= 15;
        events.push('perm_rejected');
      }
    } else {
      // From Q5 onwards: each quarter +12% approval chance
      const approvalChance = Math.min(0.95, (permQuarters - 6) * 0.12);
      if (Math.random() < approvalChance) {
        updates.permStatus = 'approved';
        mentalDelta += 5;
        events.push('perm_approved');
      }
      // Still pending — keep waiting
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
    // Premium processing: approve this quarter
    const result = roll('i140Approval', state);
    if (result.success) {
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

  // --- Priority Date Queue ---
  if (imm.i140Status === 'approved' && imm.priorityDate !== null && imm.i485Status === 'none') {
    // Advance priority date cursor — avg ~1.5 quarters advance per quarter
    const baseAdvance = 0.5;
    const variance = -1.5 + Math.random() * 4; // -1.5 to +2.5
    const movement = Math.max(-3, Math.min(6, baseAdvance + variance));

    const newCurrent = imm.priorityDateCurrent + movement;
    updates.priorityDateCurrent = newCurrent;

    if (variance < -1) {
      mentalDelta -= 15;
      events.push('priority_date_retrogression');
    }

    // Check if priority date is current
    if (newCurrent >= (imm.priorityDate || 0)) {
      // Can file I-485!
      updates.i485Status = 'pending';
      updates.hasComboCard = true;
      economyCost += 5000; // I-485 + legal fees
      mentalDelta += 20; // Combo card!
      events.push('i485_filed_combo_card');
    }
  }

  // --- I-485 Processing ---
  if (imm.i485Status === 'pending') {
    // Check for RFE
    if (Math.random() < 0.05) { // 5% per quarter chance
      updates.i485Status = 'rfe';
      mentalDelta -= 15;
      economyCost += 3000;
      events.push('i485_rfe');
    } else {
      // Processing progress — approve after random 4-12 quarters
      const processingStart = state.timeline.findIndex(
        (r) => r.events?.some((e) => e.id === 'i485_filed_combo_card')
      );
      const quartersProcessing = processingStart >= 0 ? state.turn - processingStart : 0;
      const requiredQuarters = randomInt(I485_PROCESSING_MIN, I485_PROCESSING_MAX);

      if (quartersProcessing >= requiredQuarters) {
        // GREEN CARD APPROVED!
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
    // RFE response — resolve in 1-2 quarters
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
    visaExpiryTurn: state.turn + 4, // 12 months
  };
}

export function activateOptStem(state: GameState): Partial<ImmigrationState> {
  return {
    visaType: 'optStem',
    visaExpiryTurn: state.turn + 8, // 24 months extension
  };
}
