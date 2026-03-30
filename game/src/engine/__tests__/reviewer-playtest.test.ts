// Comprehensive Game Reviewer Playtest — 20 full games with detailed gameplay analysis
import { describe, it, expect } from 'vitest';
import { createGameState, processTurn, getTurnInfo, getEffectiveAp, calculateFinalScore } from '../game-state';
import { getAvailableActions, canSelectAction } from '../actions';
import type { GameState, WorkMode, AcademicStudyMode, ActionId, CreationAttributes, EndingType } from '../types';

interface GameResult {
  gameNum: number;
  creation: CreationAttributes;
  turns: number;
  endingType: EndingType | null;
  maxLevel: number;
  maxHealth: number;
  maxMental: number;
  finalHealth: number;
  finalMental: number;
  finalPerformance: number;
  finalSkills: number;
  maxNetWorth: number;
  finalNetWorth: number;
  gcObtained: boolean;
  turnGcObtained?: number;
  daysGcObtained?: string;
  startCash: number;
  finalCash: number;
  keyEvents: { turn: number; event: string }[];
  phase: 'academic' | 'career';
  finalPhase: 'academic' | 'career';
  employmentStatus: string;
  careerLevel: number;
  visaType: string;
  sicknessBouts: number;
  burnoutBouts: number;
  promotions: number;
  jobChanges: number;
  finallScore: number;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const CHARACTER_BUILDS: CreationAttributes[] = [
  { constitution: 3, schoolRanking: 4, geoLocation: 3 },
  { constitution: 5, schoolRanking: 2, geoLocation: 3 },
  { constitution: 2, schoolRanking: 5, geoLocation: 3 },
  { constitution: 2, schoolRanking: 3, geoLocation: 5 },
  { constitution: 0, schoolRanking: 5, geoLocation: 5 },
  { constitution: 5, schoolRanking: 5, geoLocation: 0 },
  { constitution: 4, schoolRanking: 3, geoLocation: 3 },
  { constitution: 1, schoolRanking: 4, geoLocation: 5 },
];

function selectSmartActions(state: GameState): ActionId[] {
  const effectiveAp = getEffectiveAp(state);
  let remainingAp = effectiveAp;
  const available = getAvailableActions(state);
  const selected: ActionId[] = [];

  // Survival-priority strategy
  const priorities: ActionId[] = [];

  // Health critical: hospital/rest first
  if (state.attributes.health < 20) {
    if (available.find(a => a.id === 'hospital')) priorities.push('hospital');
    if (available.find(a => a.id === 'rest')) priorities.push('rest');
  }

  // Mental critical: therapist/rest
  if (state.attributes.mental < 25) {
    if (available.find(a => a.id === 'therapist')) priorities.push('therapist');
    if (available.find(a => a.id === 'rest')) priorities.push('rest');
  }

  // Exercise: free mental health maintenance
  if (available.find(a => a.id === 'exercise') && state.attributes.mental < 60) {
    priorities.push('exercise');
  }

  // Academic phase: get internship, maximize GPA
  if (state.phase === 'academic') {
    if (!state.academic.hadIntern && state.turn >= 2 && available.find(a => a.id === 'searchIntern')) {
      priorities.push('searchIntern');
    }
    if (state.flags.internActiveThisQuarter && available.find(a => a.id === 'internWork')) {
      priorities.push('internWork');
    }
    // Study actions based on remaining quarters
    const gradTurn = 8;
    const quartersLeft = gradTurn - state.turn;
    if (quartersLeft > 2 && state.academic.gpa < 3.8) {
      priorities.push('studyHard', 'studyNormal');
    }
    if (quartersLeft === 1 && available.find(a => a.id === 'searchFullTimeJob')) {
      priorities.push('searchFullTimeJob');
    }
  }

  // Career phase: maintain green card progress
  if (state.phase === 'career') {
    // Keep performance up for PIP avoidance
    if (state.attributes.performance < 40 && available.find(a => a.id === 'workHard')) {
      priorities.push('workHard', 'workSuperHard');
    }
    // Maintain skills for job mobility
    if (state.attributes.skills < 50) {
      priorities.push('upskill');
    }
    // Immigration: research NIW/EB1A if academic impact is building
    if (state.attributes.academicImpact > 20 && available.find(a => a.id === 'researchNiw')) {
      priorities.push('researchNiw');
    }
  }

  // Default fillers
  if (state.phase === 'academic') {
    priorities.push('studyNormal', 'networking', 'sideProject');
  } else {
    priorities.push('upskill', 'networking');
  }

  for (const actionId of priorities) {
    if (remainingAp <= 0) break;
    const action = available.find(a => a.id === actionId);
    if (!action) continue;
    const check = canSelectAction(action, selected, remainingAp);
    if (check.allowed) {
      selected.push(action.id);
      remainingAp -= action.apCost;
    }
  }

  return selected;
}

function simulateGameForReview(gameNum: number): GameResult {
  const creation = CHARACTER_BUILDS[gameNum % CHARACTER_BUILDS.length];
  let state = createGameState(creation);
  const events: { turn: number; event: string }[] = [];
  let sicknessBouts = 0;
  let burnoutBouts = 0;
  let promotions = 0;
  let jobChanges = 0;
  let maxNetWorth = state.attributes.netWorth;
  let maxHealth = state.attributes.health;
  let maxMental = state.attributes.mental;

  for (let t = 0; t < 148; t++) {
    if (state.endingType) break;

    const isAcademic = state.phase === 'academic';
    const workModes = isAcademic
      ? (['light', 'normal', 'intense'] as AcademicStudyMode[])
      : (['coast', 'normal', 'grind'] as WorkMode[]);

    const availableModes = workModes.filter(m => {
      if ((m === 'grind' || m === 'intense') && state.grindLockQuarters > 0) return false;
      return true;
    });

    const workMode = pick(availableModes);
    const selectedActions = selectSmartActions(state);

    const prevPhase = state.phase;
    const prevLevel = state.career.level;
    const prevVisa = state.immigration.visaType;
    const prevCash = state.economy.cash;

    state = processTurn(state, workMode, selectedActions);

    // Track events
    const record = state.timeline[state.timeline.length - 1];
    if (record && record.events.length > 0) {
      for (const evt of record.events) {
        if (evt.id.includes('sickness')) {
          sicknessBouts++;
          events.push({ turn: state.turn, event: `Sickness (${evt.id})` });
        }
        if (evt.id === 'burnout') {
          burnoutBouts++;
          events.push({ turn: state.turn, event: 'Burnout' });
        }
        if (evt.id === 'promoted') {
          promotions++;
          events.push({ turn: state.turn, event: `Promoted to L${state.career.level}` });
        }
        if (evt.id === 'job_offer_received' || evt.id === 'found_job_while_unemployed') {
          jobChanges++;
          events.push({ turn: state.turn, event: 'Job change' });
        }
        if (evt.id === 'h1b_activated' || evt.id === 'green_card_obtained') {
          events.push({ turn: state.turn, event: `Visa: ${evt.id}` });
        }
        if (evt.id === 'graduation') {
          events.push({ turn: state.turn, event: 'Graduation' });
        }
      }
    }

    // Track max attributes
    maxNetWorth = Math.max(maxNetWorth, state.attributes.netWorth);
    maxHealth = Math.max(maxHealth, state.attributes.health);
    maxMental = Math.max(maxMental, state.attributes.mental);

    // Check phase transition
    if (prevPhase !== state.phase) {
      events.push({ turn: state.turn, event: `Phase: ${prevPhase} → ${state.phase}` });
    }
  }

  const turnGcObtained = state.immigration.hasGreenCard
    ? state.timeline.findIndex(r => r.events.some(e => e.id.includes('green_card'))) + 1
    : undefined;

  const daysGcObtained = turnGcObtained ? getTurnInfo(turnGcObtained).year + '-' + getTurnInfo(turnGcObtained).quarter : undefined;

  return {
    gameNum,
    creation,
    turns: state.turn,
    endingType: state.endingType,
    maxLevel: state.career.level,
    maxHealth,
    maxMental,
    finalHealth: state.attributes.health,
    finalMental: state.attributes.mental,
    finalPerformance: state.attributes.performance,
    finalSkills: state.attributes.skills,
    maxNetWorth,
    finalNetWorth: state.attributes.netWorth,
    gcObtained: state.immigration.hasGreenCard,
    turnGcObtained,
    daysGcObtained,
    startCash: 50000,
    finalCash: state.economy.cash,
    keyEvents: events,
    phase: state.phase,
    finalPhase: state.phase,
    employmentStatus: state.career.employed,
    careerLevel: state.career.level,
    visaType: state.immigration.visaType,
    sicknessBouts,
    burnoutBouts,
    promotions,
    jobChanges,
    finallScore: calculateFinalScore(state),
  };
}

describe('Game Reviewer Playtest — 20 Full Games', () => {
  it('Plays 20 full games with smart strategy and produces comprehensive review', () => {
    const results: GameResult[] = [];

    console.log('\n========== PLAYTEST SIMULATION: 20 FULL GAMES ==========\n');
    console.log('Strategy: Smart/Survival-focused');
    console.log('Time per game: ~37 years (turn 0-147, 1 turn = 1 quarter)\n');

    for (let g = 0; g < 20; g++) {
      const result = simulateGameForReview(g);
      results.push(result);
      console.log(`[Game ${g + 1}] Turns: ${result.turns}, Ending: ${result.endingType}, GC: ${result.gcObtained ? 'YES' : 'NO'}, Final NW: $${Math.round(result.finalNetWorth)}`);
    }

    // === ANALYSIS ===
    console.log('\n\n========== DETAILED GAME ANALYSIS ==========\n');

    // (a) BALANCE ISSUES
    console.log('📊 (A) BALANCE & DIFFICULTY ANALYSIS');
    console.log('=====================================');

    const endingBreakdown = results.reduce(
      (acc, r) => {
        acc[r.endingType || 'unknown'] = (acc[r.endingType || 'unknown'] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    console.log('\nEnding Type Distribution:');
    Object.entries(endingBreakdown).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}/20 (${(count / 20 * 100).toFixed(1)}%)`);
    });

    const survived = results.filter(r => r.turns >= 100).length;
    const gcSuccessRate = results.filter(r => r.gcObtained).length;

    console.log(`\nSurvival Rate (turn 100+): ${survived}/20 (${(survived / 20 * 100).toFixed(1)}%)`);
    console.log(`Green Card Rate: ${gcSuccessRate}/20 (${(gcSuccessRate / 20 * 100).toFixed(1)}%)`);

    const avgNetWorth = results.reduce((sum, r) => sum + r.finalNetWorth, 0) / results.length;
    const avgScore = results.reduce((sum, r) => sum + r.finallScore, 0) / results.length;
    const maxScore = Math.max(...results.map(r => r.finallScore));
    const minScore = Math.min(...results.map(r => r.finallScore));

    console.log(`\nAverage Final Net Worth: $${Math.round(avgNetWorth).toLocaleString()}`);
    console.log(`Average Final Score: ${Math.round(avgScore).toLocaleString()}`);
    console.log(`Score Range: ${Math.round(minScore).toLocaleString()} - ${Math.round(maxScore).toLocaleString()}`);

    // Check for dominant strategies
    const coasters = results.filter(r => r.careerLevel <= 4);
    const grinders = results.filter(r => r.careerLevel >= 6);
    console.log(`\nCareer Level Distribution:`);
    console.log(`  Coasters (L3-4): ${coasters.length}/20`);
    console.log(`  Mid-level (L5): ${results.filter(r => r.careerLevel === 5).length}/20`);
    console.log(`  Grinders (L6-7): ${grinders.length}/20`);

    const moneyEarners = results.filter(r => r.finalNetWorth > 500000);
    console.log(`\nWealthy outcomes ($500K+): ${moneyEarners.length}/20`);
    if (moneyEarners.length > 0) {
      console.log(`  Avg NW of wealthy: $${Math.round(moneyEarners.reduce((s, r) => s + r.finalNetWorth, 0) / moneyEarners.length).toLocaleString()}`);
    }

    // (b) PACING
    console.log('\n\n⏱️ (B) PACING ANALYSIS');
    console.log('=======================');

    const avgTurns = results.reduce((sum, r) => sum + r.turns, 0) / results.length;
    const avgYears = avgTurns / 4;
    const turnsToGc = results
      .filter(r => r.turnGcObtained)
      .map(r => r.turnGcObtained!)
      .reduce((sum, t) => sum + t, 0) / gcSuccessRate;

    console.log(`\nAverage Game Length: ${Math.round(avgTurns)} turns (${Math.round(avgYears)} years)`);
    console.log(`Turns to GC (when achieved): ${Math.round(turnsToGc)} turns (${Math.round(turnsToGc / 4)} years)`);

    // Check for pacing issues
    const quickEndings = results.filter(r => r.turns < 20);
    const fastEndings = results.filter(r => r.turns >= 20 && r.turns < 50);
    const mediumEndings = results.filter(r => r.turns >= 50 && r.turns < 100);
    const lateEndings = results.filter(r => r.turns >= 100);

    console.log(`\nGame Duration Buckets:`);
    console.log(`  0-20 turns (very early): ${quickEndings.length}/20`);
    console.log(`  20-50 turns (early): ${fastEndings.length}/20`);
    console.log(`  50-100 turns (mid): ${mediumEndings.length}/20`);
    console.log(`  100+ turns (late): ${lateEndings.length}/20`);

    if (quickEndings.length > 5) {
      console.log('\n⚠️ PACING ISSUE: Many games end very early. Possible causes:');
      quickEndings.slice(0, 3).forEach(r => {
        console.log(`   G${r.gameNum}: ${r.endingType} @ turn ${r.turns}`);
      });
    }

    // (c) EVENT QUALITY
    console.log('\n\n🎲 (C) EVENT QUALITY & CHOICE MEANINGFULNESS');
    console.log('=============================================');

    const eventCounts = results.map(r => r.keyEvents.length);
    const avgEvents = eventCounts.reduce((s, n) => s + n, 0) / results.length;

    console.log(`\nAverage events per game: ${Math.round(avgEvents)}`);
    console.log(`Events per turn ratio: ${(avgEvents / avgTurns).toFixed(3)}`);

    if (avgEvents / avgTurns < 0.1) {
      console.log('⚠️ EVENT DENSITY LOW: Players may not feel events are impactful');
    } else if (avgEvents / avgTurns > 0.5) {
      console.log('⚠️ EVENT DENSITY HIGH: May feel overwhelming');
    } else {
      console.log('✅ EVENT DENSITY GOOD: Events feel regular but not overwhelming');
    }

    // (d) IMMIGRATION REALISM
    console.log('\n\n🛂 (D) IMMIGRATION SYSTEM REALISM');
    console.log('====================================');

    const h1bPlayers = results.filter(r => r.visaType.includes('h1b')).length;
    const optPlayers = results.filter(r => r.visaType === 'opt' || r.visaType === 'optStem').length;
    const deportations = results.filter(r => r.endingType === 'deported').length;
    const bankruptcies = results.filter(r => r.endingType === 'bankrupt').length;

    console.log(`\nVisa Distribution (final state):`);
    console.log(`  On H1B: ${h1bPlayers}/20`);
    console.log(`  On OPT/STEM: ${optPlayers}/20`);
    console.log(`  With GC: ${gcSuccessRate}/20`);

    console.log(`\nImmigration Failure Rate: ${deportations}/20 (${(deportations / 20 * 100).toFixed(1)}%)`);

    if (gcSuccessRate === 0) {
      console.log('⚠️ GC ACCESSIBILITY: No one obtained a green card. System may be too hard.');
    } else if (gcSuccessRate >= 15) {
      console.log('⚠️ GC TOO EASY: Most players get green card. System may lack challenge.');
    } else {
      console.log('✅ GC BALANCE: Green card is achievable but not guaranteed (~50% success)');
    }

    // Timeline realism
    if (turnsToGc) {
      const yearsToGc = turnsToGc / 4;
      if (yearsToGc < 2) {
        console.log('⚠️ TIMELINE TOO FAST: GC obtained in <2 years (unrealistic)');
      } else if (yearsToGc > 8) {
        console.log('⚠️ TIMELINE TOO SLOW: GC obtained in >8 years (may frustrate players)');
      } else {
        console.log(`✅ TIMELINE REALISTIC: GC typically obtained in ${Math.round(yearsToGc)}-${Math.round(yearsToGc + 1)} years`);
      }
    }

    // (e) ECONOMY & MONEY
    console.log('\n\n💰 (E) ECONOMY & FINANCIAL SYSTEMS');
    console.log('====================================');

    const poorPlayers = results.filter(r => r.finalNetWorth < 50000).length;
    const middleClass = results.filter(r => r.finalNetWorth >= 50000 && r.finalNetWorth < 500000).length;
    const wealthy = results.filter(r => r.finalNetWorth >= 500000).length;

    console.log(`\nWealth Distribution (final):`);
    console.log(`  Poor (<$50K): ${poorPlayers}/20`);
    console.log(`  Middle ($50K-500K): ${middleClass}/20`);
    console.log(`  Wealthy (>$500K): ${wealthy}/20`);

    const cashFlow = results.reduce((sum, r) => sum + (r.finalCash - r.startCash), 0) / results.length;
    console.log(`\nAverage cash flow over game: $${Math.round(cashFlow).toLocaleString()}`);

    if (bankruptcies > 5) {
      console.log('⚠️ FINANCIAL PRESSURE: Multiple bankruptcies suggest economy is punishing');
    } else if (results.filter(r => r.finalCash > 1000000).length > 0) {
      console.log('⚠️ MONEY TOO EASY: Some players accumulate excessive wealth');
    } else {
      console.log('✅ ECONOMY BALANCED: Most players struggle but survive');
    }

    // (f) MENTAL HEALTH SYSTEM
    console.log('\n\n🧠 (F) MENTAL HEALTH SYSTEM');
    console.log('=============================');

    console.log(`\nMental Health Incidents:`);
    const totalSickness = results.reduce((s, r) => s + r.sicknessBouts, 0);
    const totalBurnout = results.reduce((s, r) => s + r.burnoutBouts, 0);
    const avgSickness = totalSickness / results.length;
    const avgBurnout = totalBurnout / results.length;

    console.log(`  Total sickness incidents: ${totalSickness} (avg ${avgSickness.toFixed(1)}/game)`);
    console.log(`  Total burnout incidents: ${totalBurnout} (avg ${avgBurnout.toFixed(1)}/game)`);

    const finalMentalStates = results.map(r => r.finalMental);
    const avgFinalMental = finalMentalStates.reduce((s, m) => s + m, 0) / results.length;
    const mentalFatalCrises = results.filter(r => r.finalMental <= 0).length;

    console.log(`\nAverage final mental state: ${Math.round(avgFinalMental)}/100`);
    console.log(`Games ending with mental at 0 (crisis): ${mentalFatalCrises}/20`);

    if (avgBurnout > 2) {
      console.log('⚠️ BURNOUT RATE HIGH: System may be too punishing on mental health');
    } else if (avgBurnout < 0.3) {
      console.log('⚠️ BURNOUT RARE: System may not pose enough mental health threat');
    } else {
      console.log('✅ BURNOUT BALANCED: Meaningful but not overwhelming threat');
    }

    // (g) SPECIFIC BUGS & ANOMALIES
    console.log('\n\n🐛 (G) OBSERVED BUGS & ANOMALIES');
    console.log('==================================');

    const anomalies: string[] = [];

    // Check for impossible states
    results.forEach((r, idx) => {
      if (r.finalHealth < 0) anomalies.push(`G${r.gameNum}: Health < 0 (${r.finalHealth})`);
      if (r.finalMental < 0) anomalies.push(`G${r.gameNum}: Mental < 0 (${r.finalMental})`);
      if (r.finalPerformance < 0) anomalies.push(`G${r.gameNum}: Performance < 0 (${r.finalPerformance})`);
      if (isNaN(r.finalNetWorth)) anomalies.push(`G${r.gameNum}: Net worth is NaN`);
      if (r.finalCash < -100000) anomalies.push(`G${r.gameNum}: Cash very negative ($${Math.round(r.finalCash)})`);
      if (r.endingType === 'bankrupt' && r.finalCash > 0) anomalies.push(`G${r.gameNum}: Bankrupt but cash > 0`);
      if (r.gcObtained && !r.visaType.includes('greenCard') && r.visaType !== 'comboCard') {
        anomalies.push(`G${r.gameNum}: GC flag set but visa is ${r.visaType}`);
      }
    });

    if (anomalies.length === 0) {
      console.log('✅ No anomalies detected in 20 games.');
    } else {
      console.log(`Found ${anomalies.length} anomalies:`);
      anomalies.slice(0, 10).forEach(a => console.log(`  ${a}`));
    }

    // (h) MISSING FEATURES & GAPS
    console.log('\n\n❌ (H) MISSING FEATURES & GAMEPLAY GAPS');
    console.log('=========================================');

    const hasInternship = results.filter(r => r.keyEvents.some(e => e.event.includes('found'))).length > 0;
    const hasPromotion = results.reduce((s, r) => s + r.promotions, 0) > 0;
    const hasJobChanges = results.reduce((s, r) => s + r.jobChanges, 0) > 0;

    console.log(`\nFeature Adoption:`);
    console.log(`  Internships obtained: ${hasInternship ? 'Yes' : 'No'}`);
    console.log(`  Promotions achieved: ${hasPromotion ? 'Yes' : 'No'}`);
    console.log(`  Job changes made: ${hasJobChanges ? 'Yes' : 'No'}`);

    const avgLevel = results.reduce((s, r) => s + r.careerLevel, 0) / results.length;
    console.log(`\nAverage career level: ${Math.round(avgLevel * 10) / 10}`);

    console.log('\nPotential Missing Features:');
    if (results.every(r => r.phase === 'academic' || (r.phase === 'career' && r.careerLevel === 3))) {
      console.log('  - Limited career progression opportunities (stuck at L3?)');
    }
    if (results.every(r => !r.gcObtained)) {
      console.log('  - Green card path may be obscured or too difficult to discover');
    }
    if (!results.some(r => r.visaType === 'o1' || r.visaType === 'eb1a' || r.visaType === 'niw')) {
      console.log('  - Alternative visa paths (O1, EB1A, NIW) not explored or unavailable');
    }

    // (i) TOP 5 RECOMMENDATIONS
    console.log('\n\n🎯 (I) TOP 5 RECOMMENDATIONS TO IMPROVE GAMEPLAY');
    console.log('=================================================\n');

    const recommendations = [];

    // Rec 1
    if (gcSuccessRate === 0) {
      recommendations.push([
        '1. MAKE GREEN CARD OBTAINABLE',
        'Currently 0/20 games achieved GC. The immigration system needs either:',
        '   • Lower PERM approval timeline (currently ~3 quarters)',
        '   • More visible alternative paths (NIW/EB1A)',
        '   • Starter PERM/I-140 filing at graduation with OPT',
        'Impact: High. GC is the marquee goal; unreachable goals demotivate players.',
      ]);
    } else if (gcSuccessRate >= 15) {
      recommendations.push([
        '1. INCREASE GREEN CARD DIFFICULTY',
        'Too many players (${gcSuccessRate}/20) reach GC. Add:',
        '   • RFE (Request for Evidence) audit chance on PERM (~15%)',
        '   • Priority date backlog simulation (EB2 wait longer than EB3)',
        '   • Job change penalties (PERM restarts if no I-140)',
        'Impact: High. Success should feel earned.',
      ]);
    } else {
      recommendations.push([
        '1. REFINE GREEN CARD TIMELINE',
        `Currently ${gcSuccessRate}/20 players achieve GC in ~${Math.round(turnsToGc / 4)}-${Math.round(turnsToGc / 4 + 1)} years.`,
        '   • Add visual milestone tracking (PERM filing → I-140 approval → priority date)',
        '   • Clearer UI feedback on which step is blocking progress',
        'Impact: Medium. Reduces frustration from invisible progress.',
      ]);
    }

    // Rec 2
    if (avgBurnout > 1.5) {
      recommendations.push([
        '2. REBALANCE MENTAL HEALTH DIFFICULTY',
        `Players hit burnout ${avgBurnout.toFixed(1)} times per game on average.`,
        '   • Increase mental recovery from therapist (+12 → +15)',
        '   • Add "vacation day" action (free 3 weeks, +20 mental)',
        '   • Reduce grind mode mental penalty by 25%',
        'Impact: High. Mental health spiral too severe reduces decision-making fun.',
      ]);
    } else {
      recommendations.push([
        '2. INCREASE MENTAL HEALTH CONSEQUENCES',
        `Burnout occurs only ${avgBurnout.toFixed(1)}/game. Players feel risk is too low.`,
        '   • Increase burnout probability when mental < 30 (currently triggers at 0)',
        '   • Add "stress" threshold warning (mental 40-60) that hints at burnout risk',
        '   • Performance penalty scales with mental state (not binary)',
        'Impact: Medium. Adds strategic tension to mental health choices.',
      ]);
    }

    // Rec 3
    if (deportations > 3) {
      recommendations.push([
        '3. IMPROVE VISA DEADLINE VISIBILITY',
        `${deportations}/20 games ended in deportation, often unexpectedly.`,
        '   • Add "VISA EXPIRING IN 2 QUARTERS" warning event',
        '   • Show visa expiry date prominently in UI',
        '   • Auto-file H1B reminder if on OPT past optimal filing window',
        'Impact: High. Visa mechanics are too opaque; players need signposting.',
      ]);
    } else {
      recommendations.push([
        '3. ADD VISA SYSTEM DEPTH',
        'Immigration feels linear (F1 → OPT → H1B → GC). Add:',
        '   • Visa lottery luck variance (player skill doesn\'t guarantee H1B)',
        '   • Employer visa sponsorship attitudes (eager/standard/reluctant affects timeline)',
        '   • Visa cap/retrogression events that increase urgency',
        'Impact: Medium. Adds thematic depth to immigration narrative.',
      ]);
    }

    // Rec 4
    const avgMoneyPerYear = cashFlow / avgYears;
    if (avgMoneyPerYear < 10000) {
      recommendations.push([
        '4. INCREASE SALARY PROGRESSION',
        `Players earn only $${Math.round(avgMoneyPerYear)}/year on average.`,
        '   • Increase base salary by 15-20% across all levels',
        '   • Add signing bonus to job changes (+$10-20K)',
        '   • Increase internship pay ($7.5K → $12K per quarter)',
        'Impact: Medium. Money feels tight; should be tight but not strangling.',
      ]);
    } else {
      recommendations.push([
        '4. ADD INVESTMENT MECHANICS',
        `Players accumulate $${Math.round(avgNetWorth)} average net worth but limited ways to grow it.`,
        '   • Add crypto/growth stock option (higher risk, +30% upside)',
        '   • Home purchase mechanics with mortgage/equity build',
        '   • Early stock option grants from companies (RSU vesting)',
        'Impact: Medium. Richer late-game player expression.',
      ]);
    }

    // Rec 5
    recommendations.push([
      '5. IMPROVE NARRATIVE PACING & FEEDBACK',
      `Average game length: ${Math.round(avgTurns)} turns (${Math.round(avgYears)} years).`,
      '   • Add "chapter" system: highlight major milestones (graduation, first job, H1B, GC)',
      '   • More event variety: dating/relationship events, team changes, mentors',
      '   • Personal narrative voice in events ("Your manager says..." vs. generic)',
      'Impact: Medium. Makes long 30+ year game feel like a story, not a grind.',
    ]);

    recommendations.forEach(rec => {
      rec.forEach(line => console.log(line));
      console.log();
    });

    // Final summary
    console.log('\n========== FINAL VERDICT ==========\n');

    const masterStats = {
      gcRate: (gcSuccessRate / 20 * 100).toFixed(1),
      avgNetWorth: Math.round(avgNetWorth),
      survivalRate: (survived / 20 * 100).toFixed(1),
      avgGameLength: Math.round(avgYears),
      mentalHealthStress: (avgBurnout > 1 ? 'HIGH' : avgBurnout > 0.5 ? 'MEDIUM' : 'LOW'),
      economicBalance: (bankruptcies > 2 ? 'PUNISHING' : bankruptcies === 0 ? 'FORGIVING' : 'BALANCED'),
      immigrationClarity: (deportations > 3 ? 'CONFUSING' : 'CLEAR'),
    };

    console.log('KEY METRICS:');
    Object.entries(masterStats).forEach(([k, v]) => {
      console.log(`  ${k.toUpperCase().padEnd(25)}: ${v}`);
    });

    console.log('\n\nOVERALL ASSESSMENT:');
    if (gcSuccessRate >= 5 && gcSuccessRate <= 15) {
      console.log('✅ Green card system is WELL-BALANCED (achievable but challenging)');
    } else if (gcSuccessRate < 5) {
      console.log('❌ Green card is TOO DIFFICULT to obtain');
    } else {
      console.log('⚠️ Green card is TOO EASY to obtain');
    }

    if (avgBurnout < 0.5 && avgSickness < 1) {
      console.log('✅ Health systems pose appropriate challenge');
    } else if (avgBurnout > 2) {
      console.log('❌ Health system is too punishing');
    } else {
      console.log('⚠️ Health system could create more tension');
    }

    if (poorPlayers < 3 && wealthy >= 3) {
      console.log('✅ Economy rewards skilled play');
    } else if (poorPlayers > 10) {
      console.log('❌ Economy is too harsh');
    }

    if (avgTurns >= 80 && avgTurns <= 140) {
      console.log('✅ Game length feels reasonable for narrative scope');
    } else if (avgTurns < 50) {
      console.log('❌ Game ends too quickly (feels rushed)');
    } else {
      console.log('⚠️ Game may feel long for some players (>140 turns)');
    }

    console.log('\n\nRECOMMENDED NEXT STEPS:');
    console.log('1. Implement recommendation #1 (Green Card obtainability)');
    console.log('2. Add visual/UI improvements for visa deadline tracking');
    console.log('3. Rebalance mental health difficulty based on burnout rates');
    console.log('4. Add more event variety to improve narrative engagement');
    console.log('5. Playtest with real players to validate findings');

    console.log('\n========== END OF REVIEW ==========\n');

    expect(results.length).toBe(20);
  });
});
