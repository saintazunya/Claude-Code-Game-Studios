/**
 * 15-Agent Playtest: 10 veteran + 5 new agents × 10 games × 10 rounds
 * New agents have never played before — fresh perspectives on game design.
 */
import { describe, it, expect } from 'vitest';
import { createGameState, processTurn, getTurnInfo, getMaxAp } from '../game-state';
import { getAvailableActions, canSelectAction, ACTIONS } from '../actions';
import { EVENT_POOL } from '../events';
import { resolveEvent } from '../game-state';
import type { GameState, ActionId, CreationAttributes } from '../types';

const ATTITUDE_IDS = new Set([
  'workNone', 'workSlack', 'workHard', 'workSuperHard',
  'studySlack', 'studyNormal', 'studyHard',
]);

function selectActions(state: GameState, priorities: ActionId[], attLevel: number): ActionId[] {
  const available = getAvailableActions(state).filter(a => !ATTITUDE_IDS.has(a.id));
  const maxAp = getMaxAp(state);
  const attActions: ActionId[] = state.phase === 'academic'
    ? ['studySlack', 'studyNormal', 'studyHard']
    : ['workNone', 'workSlack', 'workHard', 'workSuperHard'];
  const clampedLevel = Math.min(attLevel, attActions.length - 1);
  const attCost = ACTIONS[attActions[clampedLevel]]?.apCost || 0;
  let remaining = maxAp - attCost;
  const selected: ActionId[] = [];
  for (const id of priorities) {
    if (remaining <= 0) break;
    const action = available.find(a => a.id === id);
    if (!action) continue;
    const check = canSelectAction(action, selected, remaining);
    if (check.allowed) { selected.push(action.id); remaining -= action.apCost; }
  }
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  for (const a of shuffled) {
    if (remaining <= 0) break;
    if (selected.includes(a.id)) continue;
    const check = canSelectAction(a, selected, remaining);
    if (check.allowed) { selected.push(a.id); remaining -= a.apCost; }
  }
  selected.push(attActions[clampedLevel]);
  return selected;
}

interface AgentProfile {
  name: string;
  background: string;
  build: CreationAttributes;
  strategy: (s: GameState) => ActionId[];
}

function stdAcademic(s: GameState, p: ActionId[]): void {
  if (!s.academic.hadIntern && s.turn >= 2) p.push('searchIntern');
  if (s.flags.internActiveThisQuarter) p.push('internWork');
  p.push('sideProject', 'networking');
  const gradTurn = s.academic.isPhd ? 16 : 8;
  if (s.turn >= gradTurn - 2) p.push('searchFullTimeJob');
}

// ── 10 VETERAN AGENTS (same as before) ──────────────────────────
const VETERANS: AgentProfile[] = [
  { name: '小王(均衡)', background: 'CMU CS硕士', build: { constitution: 3, schoolRanking: 4, geoLocation: 3 },
    strategy: (s) => { const p: ActionId[] = []; const att = s.phase === 'academic' ? 2 : s.attributes.health < 40 || s.attributes.mental < 30 ? 0 : s.attributes.mental > 60 ? 2 : 1;
      if (s.phase === 'academic') { stdAcademic(s, p); } else { if (!s.flags.lawyerConsulted) p.push('consultLawyer'); if (s.attributes.health < 40) p.push('hospital', 'rest'); if (s.attributes.mental < 35) p.push('therapist'); if (s.career.employed === 'unemployed') p.push('normalJobSearch'); p.push('upskill', 'exercise'); if (s.immigration.i140Status === 'approved' && s.career.tenure >= 8) p.push('prepJobChange'); } return selectActions(s, p, att); }},
  { name: '小李(卷王)', background: '清华MIT', build: { constitution: 4, schoolRanking: 5, geoLocation: 1 },
    strategy: (s) => { const p: ActionId[] = []; const att = s.phase === 'academic' ? 2 : s.flags.burnoutActive || s.attributes.health < 20 ? 0 : s.attributes.mental < 20 ? 1 : 3;
      if (s.phase === 'academic') { stdAcademic(s, p); if (s.attributes.mental < 40) p.push('exercise'); } else { if (!s.flags.lawyerConsulted) p.push('consultLawyer'); if (s.attributes.health < 30) p.push('hospital'); if (s.attributes.mental < 25) p.push('therapist', 'exercise'); if (s.career.employed === 'unemployed') p.push('urgentJobSearch'); p.push('upskill'); if (s.immigration.i140Status === 'approved' && s.career.tenure >= 6) p.push('prepJobChange'); } return selectActions(s, p, att); }},
  { name: '小张(养生)', background: '普通学校WLB', build: { constitution: 4, schoolRanking: 3, geoLocation: 3 },
    strategy: (s) => { const p: ActionId[] = []; const att = s.attributes.mental < 50 ? 0 : 1;
      if (s.phase === 'academic') { p.push('exercise', 'rest'); stdAcademic(s, p); } else { if (!s.flags.lawyerConsulted) p.push('consultLawyer'); p.push('exercise', 'rest'); if (s.attributes.mental < 50) p.push('therapist'); if (s.career.employed === 'unemployed') p.push('normalJobSearch'); } return selectActions(s, p, att); }},
  { name: '小陈(PhD)', background: 'Stanford PhD', build: { constitution: 2, schoolRanking: 5, geoLocation: 3 },
    strategy: (s) => { const p: ActionId[] = []; const att = s.attributes.mental < 30 ? 0 : 2;
      if (s.phase === 'academic') { stdAcademic(s, p); } else { if (!s.flags.lawyerConsulted) p.push('consultLawyer'); p.push('publishPaper', 'researchNiw'); if (s.attributes.health < 40) p.push('rest', 'hospital'); if (s.attributes.mental < 35) p.push('therapist'); if (s.career.employed === 'unemployed') p.push('normalJobSearch'); p.push('upskill'); } return selectActions(s, p, att); }},
  { name: '小赵(焦虑)', background: '普通硕士H1B', build: { constitution: 3, schoolRanking: 3, geoLocation: 4 },
    strategy: (s) => { const p: ActionId[] = []; const att = s.immigration.hasGreenCard ? 1 : s.attributes.mental < 25 ? 0 : 2;
      if (s.phase === 'academic') { stdAcademic(s, p); p.push('studyGpa'); } else { if (!s.flags.lawyerConsulted) p.push('consultLawyer'); if (s.attributes.health < 40) p.push('hospital', 'rest'); if (s.attributes.mental < 30) p.push('therapist'); if (s.career.employed === 'unemployed') p.push('urgentJobSearch'); p.push('upskill'); if (s.immigration.hasGreenCard && s.career.tenure >= 8) p.push('prepJobChange'); } return selectActions(s, p, att); }},
  { name: '小刘(老兵)', background: '5年无I-140', build: { constitution: 3, schoolRanking: 4, geoLocation: 2 },
    strategy: (s) => { const p: ActionId[] = []; const att = s.attributes.mental < 20 ? 0 : s.immigration.i140Status === 'approved' ? 1 : 2;
      if (s.phase === 'academic') { stdAcademic(s, p); } else { if (!s.flags.lawyerConsulted) p.push('consultLawyer'); if (s.attributes.health < 40) p.push('hospital', 'rest'); if (s.attributes.mental < 30) p.push('therapist'); if (s.career.employed === 'unemployed') p.push('urgentJobSearch'); if (s.immigration.permStatus === 'audited' || s.immigration.permStatus === 'none') p.push('publishPaper', 'researchNiw'); p.push('upskill'); if (s.immigration.i140Status === 'approved') p.push('prepJobChange'); } return selectActions(s, p, att); }},
  { name: '小周(攒钱)', background: '攒钱投资型', build: { constitution: 4, schoolRanking: 4, geoLocation: 4 },
    strategy: (s) => { const p: ActionId[] = []; const att = s.attributes.mental < 40 ? 1 : s.attributes.health > 60 ? 2 : 1;
      if (s.phase === 'academic') { stdAcademic(s, p); p.push('studyGpa'); } else { if (!s.flags.lawyerConsulted) p.push('consultLawyer'); if (s.attributes.health < 50) p.push('rest', 'hospital'); if (s.attributes.mental < 40) p.push('therapist'); if (s.career.employed === 'unemployed') p.push('normalJobSearch'); p.push('upskill', 'invest'); if (s.immigration.hasGreenCard && s.career.tenure >= 6) p.push('prepJobChange'); p.push('exercise'); } return selectActions(s, p, att); }},
  { name: '小吴(随机)', background: '新手随便选', build: { constitution: 2, schoolRanking: 3, geoLocation: 3 },
    strategy: (s) => selectActions(s, [], Math.floor(Math.random() * 3)) },
  { name: '小孙(跳槽)', background: '跳槽狂', build: { constitution: 3, schoolRanking: 4, geoLocation: 5 },
    strategy: (s) => { const p: ActionId[] = []; const att = s.attributes.mental < 25 ? 0 : 2;
      if (s.phase === 'academic') { stdAcademic(s, p); } else { if (!s.flags.lawyerConsulted) p.push('consultLawyer'); if (s.attributes.health < 30) p.push('hospital'); if (s.attributes.mental < 25) p.push('therapist'); if (s.career.employed === 'unemployed') p.push('urgentJobSearch'); p.push('upskill'); if (s.career.tenure >= 8) p.push('prepJobChange'); if (s.turn > 50 && s.immigration.i140Status !== 'approved') p.push('researchNiw', 'publishPaper'); } return selectActions(s, p, att); }},
  { name: '小马(逆袭)', background: 'SCH=0逆袭', build: { constitution: 5, schoolRanking: 0, geoLocation: 0 },
    strategy: (s) => { const p: ActionId[] = []; const att = s.attributes.mental < 20 ? 0 : s.attributes.health < 30 ? 1 : 3;
      if (s.phase === 'academic') { stdAcademic(s, p); p.push('studyGpa'); } else { if (!s.flags.lawyerConsulted) p.push('consultLawyer'); if (s.attributes.health < 25) p.push('hospital'); if (s.attributes.mental < 20) p.push('therapist', 'rest'); if (s.career.employed === 'unemployed') p.push('urgentJobSearch'); p.push('upskill'); if (s.career.tenure >= 10 && s.attributes.skills > 150) p.push('prepJobChange'); } return selectActions(s, p, att); }},
];

// ── 5 NEW AGENTS (fresh perspectives) ───────────────────────────
const NEWBIES: AgentProfile[] = [
  { name: '🆕阿明(稳健投资)', background: '毕业就开始投资S&P500，工作稳定不跳槽，靠复利攒钱',
    build: { constitution: 3, schoolRanking: 4, geoLocation: 4 },
    strategy: (s) => { const p: ActionId[] = []; const att = s.phase === 'academic' ? 2 : 1;
      if (s.phase === 'academic') { stdAcademic(s, p); p.push('studyGpa'); }
      else { if (!s.flags.lawyerConsulted) p.push('consultLawyer'); p.push('invest', 'upskill', 'exercise');
        if (s.career.employed === 'unemployed') p.push('normalJobSearch');
        if (s.attributes.mental < 40) p.push('therapist');
        // Never job hop — protect PERM
      } return selectActions(s, p, att); }},

  { name: '🆕小雪(NIW冲刺)', background: '一边工作一边疯狂发论文走NIW，不依赖雇主办绿卡',
    build: { constitution: 3, schoolRanking: 5, geoLocation: 2 },
    strategy: (s) => { const p: ActionId[] = []; const att = s.attributes.mental < 25 ? 0 : 2;
      if (s.phase === 'academic') { stdAcademic(s, p); p.push('studyGpa'); }
      else { if (!s.flags.lawyerConsulted) p.push('consultLawyer');
        p.push('publishPaper', 'researchNiw', 'upskill');
        if (s.career.employed === 'unemployed') p.push('urgentJobSearch');
        if (s.attributes.health < 35) p.push('rest', 'hospital');
        if (s.attributes.mental < 30) p.push('therapist');
      } return selectActions(s, p, att); }},

  { name: '🆕大壮(铁人卷)', background: 'CON=5体质好，疯狂卷但不容易倒，长期grind',
    build: { constitution: 5, schoolRanking: 3, geoLocation: 2 },
    strategy: (s) => { const p: ActionId[] = []; const att = s.phase === 'academic' ? 2 : s.attributes.mental < 15 ? 1 : 3;
      if (s.phase === 'academic') { stdAcademic(s, p); p.push('exercise'); }
      else { if (!s.flags.lawyerConsulted) p.push('consultLawyer');
        if (s.attributes.health < 30) p.push('hospital');
        if (s.career.employed === 'unemployed') p.push('urgentJobSearch');
        p.push('upskill', 'exercise');
        // Don't hop until I-140
        if (s.immigration.i140Status === 'approved' && s.career.tenure >= 8) p.push('prepJobChange');
      } return selectActions(s, p, att); }},

  { name: '🆕小美(精打细算)', background: '每个AP都算清楚，最优策略执行者，consultant律师先行',
    build: { constitution: 3, schoolRanking: 4, geoLocation: 3 },
    strategy: (s) => { const p: ActionId[] = []; let att = 1;
      if (s.phase === 'academic') { att = 2; stdAcademic(s, p); p.push('studyGpa', 'exercise'); }
      else {
        // Always consult lawyer first turn of career
        if (!s.flags.lawyerConsulted) { p.push('consultLawyer'); att = 1; }
        else {
          att = s.attributes.mental < 30 ? 0 : s.attributes.mental > 50 ? 2 : 1;
          if (s.career.employed === 'unemployed') { p.push('urgentJobSearch'); att = 0; }
          else {
            // Optimal: upskill + maintain health/mental
            if (s.attributes.health < 50) p.push('rest');
            if (s.attributes.mental < 40) p.push('therapist');
            p.push('upskill');
            if (s.economy.cash > 30000) p.push('invest');
            // Hop only after I-140 for max TC
            if (s.immigration.i140Status === 'approved' && s.career.tenure >= 8 && s.attributes.skills > 150) p.push('prepJobChange');
            // NIW as backup
            if (s.turn > 30 && s.immigration.permStatus !== 'approved') p.push('publishPaper', 'researchNiw');
          }
        }
      } return selectActions(s, p, att); }},

  { name: '🆕老张(CPT逃生)', background: '签证快到期就报CPT保命，永远不放弃',
    build: { constitution: 4, schoolRanking: 3, geoLocation: 3 },
    strategy: (s) => { const p: ActionId[] = []; const att = s.phase === 'academic' ? 1 : s.attributes.mental < 30 ? 0 : 1;
      if (s.phase === 'academic') { stdAcademic(s, p); p.push('exercise'); }
      else {
        if (!s.flags.lawyerConsulted) p.push('consultLawyer');
        // CPT escape when visa expiring
        const visaRemaining = s.immigration.visaExpiryTurn - s.turn;
        if (visaRemaining <= 3 && !s.immigration.hasGreenCard && !s.immigration.hasComboCard) p.push('day1Cpt');
        if (s.career.employed === 'unemployed') p.push('urgentJobSearch');
        if (s.attributes.health < 40) p.push('rest', 'hospital');
        if (s.attributes.mental < 35) p.push('therapist');
        p.push('upskill', 'exercise');
      } return selectActions(s, p, att); }},
];

const ALL_AGENTS = [...VETERANS, ...NEWBIES];

interface GameResult {
  turns: number; ending: string; hasGC: boolean; h1bWon: boolean;
  permApproved: boolean; i140Approved: boolean; hasCombo: boolean;
  promotions: number; burnouts: number; level: number; netWorth: number;
  lawyerUsed: boolean; cptUsed: boolean;
  feedback: string[];
}

function playGame(agent: AgentProfile): GameResult {
  let state = createGameState(agent.build);
  let promotions = 0, burnouts = 0;
  let lawyerUsed = false, cptUsed = false;
  const feedback: string[] = [];

  for (let t = 0; t < 72; t++) {
    const actions = agent.strategy(state);
    try { state = processTurn(state, 'normal', actions); } catch (e) { feedback.push(`CRASH@T${t}`); break; }

    // Track
    const events = state.timeline[state.timeline.length - 1]?.events || [];
    for (const e of events) {
      if (e.id === 'promoted') promotions++;
      if (e.id === 'burnout') burnouts++;
      if (e.id === 'lawyer_consulted') lawyerUsed = true;
      if (e.id === 'cpt_enrolled') cptUsed = true;
    }

    // Resolve pending events
    const pending = (state.flags.pendingRandomEvents as string[]) || [];
    for (const eid of pending) {
      const event = EVENT_POOL.find(e => e.id === eid);
      if (event && event.choices.length > 0) {
        try { state = resolveEvent(state, event, event.choices[0].id); } catch (_) {}
      }
    }

    // Agent feedback at key moments
    if (events.some(e => e.id === 'h1b_denied') && state.immigration.h1bAttempts >= 3) {
      feedback.push('3次H1B全没中，绝望');
    }
    if (events.some(e => e.id === 'priority_date_retrogression')) {
      feedback.push('排期倒退了，心态崩了');
    }
    if (state.attributes.mental <= 5 && !events.some(e => e.id === 'burnout')) {
      feedback.push(`T${state.turn}: 精神快崩了(${state.attributes.mental})但还没burnout`);
    }
    if (state.career.employed === 'unemployed' && ['h1b', 'h1bRenewal'].includes(state.immigration.visaType)) {
      feedback.push(`T${state.turn}: H1B失业，grace period紧迫`);
    }

    if (state.endingType) break;
  }

  return {
    turns: state.turn,
    ending: state.endingType || 'age40',
    hasGC: state.immigration.hasGreenCard,
    h1bWon: ['h1b', 'h1bRenewal', 'h1b7thYear', 'comboCard', 'greenCard'].includes(state.immigration.visaType),
    permApproved: state.immigration.permStatus === 'approved',
    i140Approved: state.immigration.i140Status === 'approved',
    hasCombo: state.immigration.hasComboCard,
    promotions, burnouts, level: state.career.level,
    netWorth: Math.round(state.attributes.netWorth),
    lawyerUsed, cptUsed, feedback,
  };
}

describe('15-Agent Playtest (10 veteran + 5 new × 10 games × 10 rounds)', () => {
  it('runs 10 rounds and collects feedback', () => {
    const allResults = new Map<string, GameResult[]>();

    for (let round = 1; round <= 10; round++) {
      for (const agent of ALL_AGENTS) {
        if (!allResults.has(agent.name)) allResults.set(agent.name, []);
        for (let g = 0; g < 10; g++) {
          allResults.get(agent.name)!.push(playGame(agent));
        }
      }
    }

    // Print results
    console.log('\n' + '═'.repeat(70));
    console.log('  15-AGENT PLAYTEST: 10 rounds × 10 games = 100 games per agent');
    console.log('═'.repeat(70));

    const allFeedback: string[] = [];

    for (const agent of ALL_AGENTS) {
      const results = allResults.get(agent.name) || [];
      const n = results.length;
      const gc = results.filter(r => r.hasGC).length;
      const dep = results.filter(r => r.ending === 'deported').length;
      const h1b = results.filter(r => r.h1bWon).length;
      const perm = results.filter(r => r.permApproved).length;
      const i140 = results.filter(r => r.i140Approved).length;
      const combo = results.filter(r => r.hasCombo).length;
      const lawyer = results.filter(r => r.lawyerUsed).length;
      const cpt = results.filter(r => r.cptUsed).length;
      const avgNW = Math.round(results.reduce((s, r) => s + r.netWorth, 0) / n);
      const avgLevel = (results.reduce((s, r) => s + r.level, 0) / n).toFixed(1);
      const avgBurnout = (results.reduce((s, r) => s + r.burnouts, 0) / n).toFixed(1);

      const isNew = agent.name.startsWith('🆕');
      console.log(`\n${isNew ? '🆕' : '  '} ${agent.name} (${agent.background})`);
      console.log(`   GC=${gc}/${n}(${(gc/n*100).toFixed(0)}%) | Deport=${dep} | H1B=${h1b} | PERM=${perm} | I-140=${i140} | Combo=${combo}`);
      console.log(`   Lawyer=${lawyer} | CPT=${cpt} | Avg L${avgLevel} | NW=$${avgNW.toLocaleString()} | Burnout=${avgBurnout}`);

      // Collect unique feedback
      const fb = results.flatMap(r => r.feedback);
      const unique = [...new Set(fb)].slice(0, 5);
      if (unique.length > 0) {
        console.log(`   Feedback: ${unique.join(' | ')}`);
        allFeedback.push(...unique.map(f => `[${agent.name}] ${f}`));
      }
    }

    // Summary
    const all = [...allResults.values()].flat();
    const total = all.length;
    console.log('\n' + '═'.repeat(70));
    console.log(`  TOTAL: ${total} games`);
    console.log(`  GC: ${all.filter(r => r.hasGC).length} (${(all.filter(r => r.hasGC).length / total * 100).toFixed(1)}%)`);
    console.log(`  Deported: ${all.filter(r => r.ending === 'deported').length} (${(all.filter(r => r.ending === 'deported').length / total * 100).toFixed(1)}%)`);
    console.log(`  Combo: ${all.filter(r => r.hasCombo).length} (${(all.filter(r => r.hasCombo).length / total * 100).toFixed(1)}%)`);
    console.log(`  Lawyer: ${all.filter(r => r.lawyerUsed).length} (${(all.filter(r => r.lawyerUsed).length / total * 100).toFixed(1)}%)`);
    console.log(`  CPT: ${all.filter(r => r.cptUsed).length}`);

    // Top feedback
    console.log('\n  Top feedback:');
    const fbCount: Record<string, number> = {};
    allFeedback.forEach(f => { const key = f.replace(/T\d+/g, 'T?'); fbCount[key] = (fbCount[key] || 0) + 1; });
    Object.entries(fbCount).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([f, c]) => {
      console.log(`    ${c}× ${f}`);
    });

    expect(true).toBe(true);
  }, 300000);
});
