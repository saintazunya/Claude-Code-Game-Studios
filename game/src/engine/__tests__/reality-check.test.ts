/**
 * Reality Check: Run 1000 games, log states, sample 100 turns,
 * then verify against real-world immigrant forum (一亩三分地) data.
 *
 * Phase 1: Simulate & Log
 * Phase 2: Sample diverse situations
 * Phase 3: Output situations for web research
 */
import { describe, it, expect } from 'vitest';
import { createGameState, processTurn, getTurnInfo, getMaxAp } from '../game-state';
import { getAvailableActions, canSelectAction, ACTIONS } from '../actions';
import { EVENT_POOL } from '../events';
import { resolveEvent } from '../game-state';
import type { GameState, ActionId, CreationAttributes, GameEvent } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────

const ATTITUDE_IDS = new Set([
  'workNone', 'workSlack', 'workHard', 'workSuperHard',
  'studySlack', 'studyNormal', 'studyHard',
]);

function selectActions(state: GameState, priorities: ActionId[], attitudeLevel: number): ActionId[] {
  const available = getAvailableActions(state).filter(a => !ATTITUDE_IDS.has(a.id));
  const maxAp = getMaxAp(state);
  const attActions: ActionId[] = state.phase === 'academic'
    ? ['studySlack', 'studyNormal', 'studyHard']
    : ['workNone', 'workSlack', 'workHard', 'workSuperHard'];
  const clampedLevel = Math.min(attitudeLevel, attActions.length - 1);
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

// ─── Agent Definitions (same 10 from playtest) ─────────────────────

interface AgentDef {
  name: string;
  build: CreationAttributes;
  strategy: (s: GameState) => { actions: ActionId[]; attLevel: number };
}

const AGENTS: AgentDef[] = [
  {
    name: '小王-均衡型',
    build: { constitution: 3, schoolRanking: 4, geoLocation: 3 },
    strategy: (s) => {
      const p: ActionId[] = [];
      let att = 1;
      if (s.phase === 'academic') {
        att = 2;
        if (!s.academic.hadIntern && s.turn >= 2) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('networking', 'sideProject', 'exercise');
        if (s.turn === (s.academic.isPhd ? 15 : 7)) p.push('searchFullTimeJob');
      } else {
        att = s.attributes.health < 40 || s.attributes.mental < 30 ? 0 : s.attributes.mental > 60 ? 2 : 1;
        if (s.attributes.health < 40) p.push('hospital', 'rest');
        if (s.attributes.mental < 35) p.push('therapist');
        if (s.career.employed === 'unemployed') p.push('normalJobSearch');
        p.push('upskill', 'exercise');
        if (s.career.tenure >= 8 && s.immigration.i140Status === 'approved') p.push('prepJobChange');
      }
      return { actions: selectActions(s, p, att), attLevel: att };
    },
  },
  {
    name: '小李-卷王',
    build: { constitution: 4, schoolRanking: 5, geoLocation: 1 },
    strategy: (s) => {
      const p: ActionId[] = [];
      let att = s.phase === 'academic' ? 2 : (s.flags.burnoutActive || s.attributes.health < 20 ? 0 : s.attributes.mental < 20 ? 1 : 3);
      if (s.phase === 'academic') {
        if (!s.academic.hadIntern && s.turn >= 2) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('sideProject', 'studyGpa', 'networking');
        if (s.attributes.mental < 40) p.push('exercise');
        if (s.turn === (s.academic.isPhd ? 15 : 7)) p.push('searchFullTimeJob');
      } else {
        if (s.attributes.health < 30) p.push('hospital');
        if (s.attributes.mental < 25) p.push('therapist', 'exercise');
        if (s.career.employed === 'unemployed') p.push('urgentJobSearch');
        p.push('upskill');
        if (s.immigration.i140Status === 'approved' && s.career.tenure >= 6) p.push('prepJobChange');
      }
      return { actions: selectActions(s, p, att), attLevel: att };
    },
  },
  {
    name: '小张-养生',
    build: { constitution: 4, schoolRanking: 3, geoLocation: 3 },
    strategy: (s) => {
      const p: ActionId[] = [];
      let att = s.attributes.mental < 50 ? 0 : 1;
      if (s.phase === 'academic') {
        p.push('exercise', 'rest');
        if (!s.academic.hadIntern && s.turn >= 2) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('networking');
        if (s.turn === (s.academic.isPhd ? 15 : 7)) p.push('searchFullTimeJob');
      } else {
        p.push('exercise', 'rest');
        if (s.attributes.mental < 50) p.push('therapist');
        if (s.career.employed === 'unemployed') p.push('normalJobSearch');
        if (s.career.tenure > 12) p.push('prepJobChange');
      }
      return { actions: selectActions(s, p, att), attLevel: att };
    },
  },
  {
    name: '小陈-学术PhD',
    build: { constitution: 2, schoolRanking: 5, geoLocation: 3 },
    strategy: (s) => {
      const p: ActionId[] = [];
      let att = s.attributes.mental < 30 ? 0 : 2;
      if (s.phase === 'academic') {
        if (s.academic.isPhd && s.turn >= 8) p.push('thesisResearch');
        if (!s.academic.hadIntern && s.turn >= 2) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('sideProject', 'networking');
        if (s.turn === (s.academic.isPhd ? 15 : 7)) p.push('searchFullTimeJob');
      } else {
        p.push('publishPaper', 'researchNiw');
        if (s.attributes.health < 40) p.push('rest', 'hospital');
        if (s.attributes.mental < 35) p.push('therapist');
        if (s.career.employed === 'unemployed') p.push('normalJobSearch');
        p.push('upskill');
      }
      return { actions: selectActions(s, p, att), attLevel: att };
    },
  },
  {
    name: '小赵-焦虑H1B',
    build: { constitution: 3, schoolRanking: 3, geoLocation: 4 },
    strategy: (s) => {
      const p: ActionId[] = [];
      let att = s.immigration.hasGreenCard ? 1 : s.attributes.mental < 25 ? 0 : 2;
      if (s.phase === 'academic') {
        if (!s.academic.hadIntern && s.turn >= 2) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('studyGpa', 'networking', 'sideProject');
        if (s.turn === (s.academic.isPhd ? 15 : 7)) p.push('searchFullTimeJob');
      } else {
        if (s.attributes.health < 40) p.push('hospital', 'rest');
        if (s.attributes.mental < 30) p.push('therapist');
        if (s.career.employed === 'unemployed') p.push('urgentJobSearch');
        p.push('upskill');
        if (s.immigration.hasGreenCard && s.career.tenure >= 8) p.push('prepJobChange');
        if (s.attributes.mental < 50) p.push('exercise');
      }
      return { actions: selectActions(s, p, att), attLevel: att };
    },
  },
  {
    name: '小刘-老兵',
    build: { constitution: 3, schoolRanking: 4, geoLocation: 2 },
    strategy: (s) => {
      const p: ActionId[] = [];
      let att = s.attributes.mental < 20 ? 0 : s.immigration.i140Status === 'approved' ? 1 : 2;
      if (s.phase === 'academic') {
        if (!s.academic.hadIntern && s.turn >= 2) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('sideProject', 'networking');
        if (s.turn === (s.academic.isPhd ? 15 : 7)) p.push('searchFullTimeJob');
      } else {
        if (s.attributes.health < 40) p.push('hospital', 'rest');
        if (s.attributes.mental < 30) p.push('therapist');
        if (s.career.employed === 'unemployed') p.push('urgentJobSearch');
        if (s.immigration.permStatus === 'audited' || s.immigration.permStatus === 'none') {
          p.push('publishPaper', 'researchNiw');
        }
        p.push('upskill');
        if (s.immigration.i140Status === 'approved') p.push('prepJobChange');
      }
      return { actions: selectActions(s, p, att), attLevel: att };
    },
  },
  {
    name: '小周-攒钱',
    build: { constitution: 4, schoolRanking: 4, geoLocation: 4 },
    strategy: (s) => {
      const p: ActionId[] = [];
      let att = s.attributes.mental < 40 ? 1 : s.attributes.health > 60 ? 2 : 1;
      if (s.phase === 'academic') {
        if (!s.academic.hadIntern && s.turn >= 2) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('sideProject', 'networking', 'studyGpa');
        if (s.turn === (s.academic.isPhd ? 15 : 7)) p.push('searchFullTimeJob');
      } else {
        if (s.attributes.health < 50) p.push('rest', 'hospital');
        if (s.attributes.mental < 40) p.push('therapist');
        if (s.career.employed === 'unemployed') p.push('normalJobSearch');
        p.push('upskill');
        if (s.economy.cash > 20000) p.push('invest');
        if (s.immigration.hasGreenCard && s.career.tenure >= 6) p.push('prepJobChange');
        p.push('exercise');
      }
      return { actions: selectActions(s, p, att), attLevel: att };
    },
  },
  {
    name: '小吴-随机',
    build: { constitution: 2, schoolRanking: 3, geoLocation: 3 },
    strategy: (s) => {
      const att = Math.floor(Math.random() * 3);
      return { actions: selectActions(s, [], att), attLevel: att };
    },
  },
  {
    name: '小孙-跳槽',
    build: { constitution: 3, schoolRanking: 4, geoLocation: 5 },
    strategy: (s) => {
      const p: ActionId[] = [];
      let att = s.attributes.mental < 25 ? 0 : 2;
      if (s.phase === 'academic') {
        if (!s.academic.hadIntern && s.turn >= 2) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('sideProject', 'networking');
        if (s.turn === (s.academic.isPhd ? 15 : 7)) p.push('searchFullTimeJob');
      } else {
        if (s.attributes.health < 30) p.push('hospital');
        if (s.attributes.mental < 25) p.push('therapist');
        if (s.career.employed === 'unemployed') p.push('urgentJobSearch');
        p.push('upskill');
        if (s.career.tenure >= 8) p.push('prepJobChange');
        if (s.turn > 50 && s.immigration.i140Status !== 'approved') {
          p.push('researchNiw', 'publishPaper');
        }
      }
      return { actions: selectActions(s, p, att), attLevel: att };
    },
  },
  {
    name: '小马-逆袭',
    build: { constitution: 5, schoolRanking: 0, geoLocation: 0 },
    strategy: (s) => {
      const p: ActionId[] = [];
      let att = s.attributes.mental < 20 ? 0 : s.attributes.health < 30 ? 1 : 3;
      if (s.phase === 'academic') {
        if (!s.academic.hadIntern && s.turn >= 2) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('sideProject', 'studyGpa', 'networking');
        if (s.turn === (s.academic.isPhd ? 15 : 7)) p.push('searchFullTimeJob');
      } else {
        if (s.attributes.health < 25) p.push('hospital');
        if (s.attributes.mental < 20) p.push('therapist', 'rest');
        if (s.career.employed === 'unemployed') p.push('urgentJobSearch');
        p.push('upskill');
        if (s.career.tenure >= 10 && s.attributes.skills > 150) p.push('prepJobChange');
      }
      return { actions: selectActions(s, p, att), attLevel: att };
    },
  },
];

// ─── Turn Snapshot ──────────────────────────────────────────────────

interface TurnSnapshot {
  gameId: number;
  agent: string;
  turn: number;
  year: number;
  quarter: number;
  age: number;
  phase: string;
  // Status
  visaType: string;
  visaExpiryTurn: number;
  employed: string;
  level: number;
  salary: number;
  companyTier: string;
  bossType: string;
  onPip: boolean;
  // Immigration
  h1bAttempts: number;
  h1bPending: boolean;
  permStatus: string;
  i140Status: string;
  hasComboCard: boolean;
  hasGreenCard: boolean;
  gcTrack: string;
  // Attributes
  health: number;
  mental: number;
  performance: number;
  skills: number;
  academicImpact: number;
  cash: number;
  netWorth: number;
  gpa: number;
  // Game state
  economicPhase: string;
  burnoutActive: boolean;
  grindLocked: boolean;
  hadIntern: boolean;
  internActive: boolean;
  // Actions
  availableActionIds: string[];
  chosenActions: string[];
  attitudeLevel: number;
  maxAp: number;
  // Events this turn
  events: string[];
  // Situation description (for search)
  situationZh: string;
}

function describeVisaZh(s: GameState): string {
  const labels: Record<string, string> = {
    f1: 'F1学生签证', opt: 'OPT工作许可', optStem: 'OPT STEM延期',
    h1b: 'H1B工签', h1bRenewal: 'H1B续签', h1b7thYear: 'H1B第7年延期',
    comboCard: 'Combo卡(EAD/AP)', greenCard: '绿卡',
  };
  return labels[s.immigration.visaType] || s.immigration.visaType;
}

function describeSituationZh(s: GameState, events: string[]): string {
  const info = getTurnInfo(s.turn);
  const parts: string[] = [];

  // Basic
  parts.push(`${info.year}年Q${info.quarter}`);
  parts.push(`${info.age}岁`);
  parts.push(describeVisaZh(s));

  // Phase
  if (s.phase === 'academic') {
    parts.push(`在读硕士 GPA=${s.academic.gpa.toFixed(1)}`);
    if (s.academic.hadIntern) parts.push('有实习经历');
    else parts.push('无实习');
  } else {
    if (s.career.employed === 'employed') {
      parts.push(`L${s.career.level}工程师 在职${Math.floor(s.career.tenure / 4)}年`);
      parts.push(`年薪$${Math.round((s.career.salary + s.career.rsu) / 1000)}K`);
      if (s.career.onPip) parts.push('正在PIP');
    } else {
      parts.push('失业中');
      if (s.immigration.unemploymentQuarters > 0) parts.push(`已失业${s.immigration.unemploymentQuarters}个季度`);
    }
  }

  // Immigration progress
  if (s.immigration.permStatus === 'pending') parts.push('PERM审批中');
  if (s.immigration.permStatus === 'approved') parts.push('PERM已批');
  if (s.immigration.i140Status === 'pending') parts.push('I-140审批中');
  if (s.immigration.i140Status === 'approved') parts.push('I-140已批');
  if (s.immigration.hasComboCard) parts.push('有Combo卡');
  if (s.immigration.hasGreenCard) parts.push('绿卡到手');

  // Health/mental
  if (s.attributes.health < 30) parts.push('健康很差');
  if (s.attributes.mental < 20) parts.push('精神崩溃边缘');
  else if (s.attributes.mental < 40) parts.push('精神压力大');
  if (s.flags.burnoutActive) parts.push('burnout中');

  // Economy
  if (s.economicPhase === 'recession') parts.push('经济衰退期');
  if (s.economicPhase === 'boom') parts.push('经济繁荣期');

  // Key events
  for (const e of events) {
    if (e === 'h1b_denied') parts.push('H1B抽签未中');
    if (e === 'h1b_approved') parts.push('H1B抽签中了!');
    if (e === 'laid_off') parts.push('刚被裁员');
    if (e === 'perm_rejected') parts.push('PERM被拒');
    if (e === 'perm_approved') parts.push('PERM通过了');
    if (e === 'pip_started') parts.push('被放入PIP');
    if (e.startsWith('sickness_')) parts.push('生病了');
    if (e === 'burnout') parts.push('精神崩溃了');
    if (e === 'visa_expiry_warning_4q') parts.push('签证还有1年到期');
    if (e === 'visa_expiry_warning_2q') parts.push('签证还有半年到期!');
  }

  return parts.join(' | ');
}

function generateSearchQuery(snap: TurnSnapshot): string {
  // Generate a 一亩三分地-style search query for this situation
  const parts: string[] = [];

  if (snap.phase === 'academic') {
    if (snap.turn >= 6) parts.push('硕士毕业找工作');
    else if (snap.internActive) parts.push('实习 return offer');
    else if (!snap.hadIntern) parts.push('CS硕士找实习');
    else parts.push('硕士在读');
  } else {
    // Visa situation
    if (snap.visaType === 'opt' || snap.visaType === 'optStem') {
      if (snap.employed === 'unemployed') parts.push('OPT失业找工作');
      else parts.push('OPT期间');
    }
    if (snap.visaType.startsWith('h1b')) {
      if (snap.employed === 'unemployed') parts.push('H1B被裁 找工作');
      else if (snap.permStatus === 'pending') parts.push('H1B PERM等待');
      else if (snap.i140Status === 'approved') parts.push('I-140批准后 跳槽');
      else parts.push('H1B工作');
    }

    // Key decisions
    if (snap.events.includes('laid_off')) parts.push('裁员 grace period');
    if (snap.events.includes('pip_started')) parts.push('PIP 怎么办');
    if (snap.events.includes('h1b_denied')) parts.push('H1B没抽中 下一步');
    if (snap.events.includes('h1b_approved')) parts.push('H1B中签');
    if (snap.onPip) parts.push('PIP期间');
    if (snap.burnoutActive) parts.push('burnout 工作压力大');
    if (snap.health < 30) parts.push('身体不好 工作');
    if (snap.mental < 20) parts.push('抑郁焦虑 移民压力');
    if (snap.economicPhase === 'recession' && snap.employed === 'employed') parts.push('经济衰退 裁员风险');
    if (snap.hasComboCard && snap.employed === 'unemployed') parts.push('combo卡 失业');
    if (snap.i140Status === 'approved' && !snap.hasGreenCard) parts.push('I-140批准 等排期');
  }

  if (parts.length === 0) parts.push('一代移民 身份 职业规划');
  return parts.join(' ');
}

// ─── Situation Categories for Diverse Sampling ──────────────────────

type SituationCategory =
  | 'academic_no_intern'
  | 'academic_with_intern'
  | 'academic_graduation_search'
  | 'opt_job_hunting'
  | 'opt_employed_waiting_h1b'
  | 'h1b_denied'
  | 'h1b_approved'
  | 'h1b_employed_perm_pending'
  | 'h1b_employed_perm_approved'
  | 'h1b_i140_approved'
  | 'combo_card'
  | 'green_card'
  | 'unemployed_on_visa'
  | 'pip'
  | 'layoff_event'
  | 'burnout'
  | 'sickness'
  | 'recession_employed'
  | 'job_hop_decision'
  | 'low_mental'
  | 'low_health'
  | 'visa_expiring_soon'
  | 'h1b_6th_year'
  | 'general';

function categorizeTurn(snap: TurnSnapshot): SituationCategory {
  if (snap.events.includes('laid_off') || snap.events.includes('pip_terminated')) return 'layoff_event';
  if (snap.events.includes('h1b_denied')) return 'h1b_denied';
  if (snap.events.includes('h1b_approved')) return 'h1b_approved';
  if (snap.events.includes('pip_started') || snap.onPip) return 'pip';
  if (snap.events.some(e => e.startsWith('sickness_'))) return 'sickness';
  if (snap.burnoutActive || snap.events.includes('burnout')) return 'burnout';

  if (snap.phase === 'academic') {
    if (snap.turn >= 6 && snap.chosenActions.includes('searchFullTimeJob')) return 'academic_graduation_search';
    if (snap.internActive) return 'academic_with_intern';
    if (!snap.hadIntern && snap.turn >= 2) return 'academic_no_intern';
    return 'general';
  }

  if (snap.hasGreenCard) return 'green_card';
  if (snap.hasComboCard) return 'combo_card';
  if (snap.i140Status === 'approved') return 'h1b_i140_approved';
  if (snap.permStatus === 'approved') return 'h1b_employed_perm_approved';
  if (snap.permStatus === 'pending') return 'h1b_employed_perm_pending';

  if (snap.employed === 'unemployed') return 'unemployed_on_visa';
  if (snap.visaType === 'opt' || snap.visaType === 'optStem') {
    if (snap.employed === 'employed') return 'opt_employed_waiting_h1b';
    return 'opt_job_hunting';
  }

  if (snap.visaExpiryTurn - snap.turn <= 4 && snap.visaType.startsWith('h1b')) return 'visa_expiring_soon';
  if (snap.economicPhase === 'recession') return 'recession_employed';
  if (snap.chosenActions.includes('prepJobChange')) return 'job_hop_decision';
  if (snap.mental < 25) return 'low_mental';
  if (snap.health < 30) return 'low_health';

  return 'general';
}

// ─── Main Simulation ────────────────────────────────────────────────

describe('Reality Check: 1000 Games → 100 Sampled Turns', () => {
  it('simulates and samples diverse situations', () => {
    const allSnapshots: TurnSnapshot[] = [];
    let gameId = 0;

    // Run 100 games per agent = 1000 total
    for (const agent of AGENTS) {
      for (let g = 0; g < 100; g++) {
        gameId++;
        let state = createGameState(agent.build);

        for (let t = 0; t < 72; t++) {
          const { actions, attLevel } = agent.strategy(state);
          const availableActs = getAvailableActions(state).map(a => a.id);

          let prevState = state;
          try { state = processTurn(state, 'normal', actions); } catch (_) { break; }

          const turnEvents = state.timeline[state.timeline.length - 1]?.events.map(e => e.id) || [];

          // Resolve pending events
          const pending = (state.flags.pendingRandomEvents as string[]) || [];
          for (const eventId of pending) {
            const event = EVENT_POOL.find(e => e.id === eventId);
            if (event && event.choices.length > 0) {
              try { state = resolveEvent(state, event, event.choices[0].id); } catch (_) {}
            }
          }

          const info = getTurnInfo(state.turn);
          const snap: TurnSnapshot = {
            gameId,
            agent: agent.name,
            turn: state.turn,
            year: info.year,
            quarter: info.quarter,
            age: info.age,
            phase: state.phase,
            visaType: state.immigration.visaType,
            visaExpiryTurn: state.immigration.visaExpiryTurn,
            employed: state.career.employed,
            level: state.career.level,
            salary: state.career.salary + state.career.rsu,
            companyTier: state.career.company?.tier || 'none',
            bossType: state.career.bossType,
            onPip: state.career.onPip,
            h1bAttempts: state.immigration.h1bAttempts,
            h1bPending: state.immigration.h1bPending,
            permStatus: state.immigration.permStatus,
            i140Status: state.immigration.i140Status,
            hasComboCard: state.immigration.hasComboCard,
            hasGreenCard: state.immigration.hasGreenCard,
            gcTrack: state.immigration.gcTrack,
            health: state.attributes.health,
            mental: state.attributes.mental,
            performance: state.attributes.performance,
            skills: state.attributes.skills,
            academicImpact: state.attributes.academicImpact,
            cash: Math.round(state.economy.cash),
            netWorth: Math.round(state.attributes.netWorth),
            gpa: state.academic.gpa,
            economicPhase: state.economicPhase,
            burnoutActive: !!state.flags.burnoutActive,
            grindLocked: state.grindLockQuarters > 0,
            hadIntern: state.academic.hadIntern,
            internActive: !!state.flags.internActiveThisQuarter,
            availableActionIds: availableActs,
            chosenActions: actions,
            attitudeLevel: attLevel,
            maxAp: getMaxAp(state),
            events: turnEvents,
            situationZh: describeSituationZh(state, turnEvents),
          };

          allSnapshots.push(snap);
          if (state.endingType) break;
        }
      }
    }

    console.log(`\nTotal snapshots: ${allSnapshots.length} turns across 1000 games`);

    // ─── Sample 100 Diverse Turns ───────────────────────────────

    const categoryBuckets = new Map<SituationCategory, TurnSnapshot[]>();
    for (const snap of allSnapshots) {
      const cat = categorizeTurn(snap);
      if (!categoryBuckets.has(cat)) categoryBuckets.set(cat, []);
      categoryBuckets.get(cat)!.push(snap);
    }

    console.log('\n── Category Distribution ──');
    const sortedCats = [...categoryBuckets.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [cat, snaps] of sortedCats) {
      console.log(`  ${cat}: ${snaps.length} turns`);
    }

    // Sample up to 5 per category, fill rest with general
    const sampled: TurnSnapshot[] = [];
    const targetPerCat = 5;
    for (const [cat, snaps] of sortedCats) {
      if (cat === 'general') continue;
      const shuffled = [...snaps].sort(() => Math.random() - 0.5);
      const take = Math.min(targetPerCat, shuffled.length);
      for (let i = 0; i < take && sampled.length < 100; i++) {
        sampled.push(shuffled[i]);
      }
    }
    // Fill remaining with general
    const generals = (categoryBuckets.get('general') || []).sort(() => Math.random() - 0.5);
    for (let i = 0; sampled.length < 100 && i < generals.length; i++) {
      sampled.push(generals[i]);
    }

    console.log(`\nSampled ${sampled.length} diverse turns`);

    // ─── Output Sampled Situations for Web Research ─────────────

    console.log('\n' + '═'.repeat(80));
    console.log('  100 SAMPLED SITUATIONS FOR 一亩三分地 VERIFICATION');
    console.log('═'.repeat(80));

    for (let i = 0; i < sampled.length; i++) {
      const s = sampled[i];
      const cat = categorizeTurn(s);
      const query = generateSearchQuery(s);
      console.log(`\n── #${i + 1} [${cat}] Game ${s.gameId} Turn ${s.turn} (${s.agent}) ──`);
      console.log(`  状况: ${s.situationZh}`);
      console.log(`  搜索: ${query}`);
      console.log(`  可用行动: ${s.availableActionIds.join(', ')}`);
      console.log(`  选择行动: ${s.chosenActions.join(', ')}`);
      console.log(`  事件: ${s.events.length > 0 ? s.events.join(', ') : '无'}`);
    }

    // ─── Missing Action Analysis ────────────────────────────────

    console.log('\n' + '═'.repeat(80));
    console.log('  POTENTIAL MISSING ACTIONS ANALYSIS');
    console.log('═'.repeat(80));

    // For each category, identify what real people might want to do but can't
    const missingAnalysis: Record<string, string[]> = {
      'h1b_denied': [
        '申请其他签证类型(O1/L1)', '考虑Day1-CPT', '考虑回国',
        '申请加拿大/其他国家', '找不需要sponsor的公司',
      ],
      'layoff_event': [
        '联系移民律师', '申请unemployment benefits', '考虑startH1B transfer',
        '用severance维持身份', '紧急networking',
      ],
      'pip': [
        '开始面试其他公司', '咨询劳动法律师', '收集PIP不公平证据',
        '考虑voluntary departure', '要求转组',
      ],
      'burnout': [
        '请假休息(FMLA)', '看心理医生', '考虑减少工作量',
        '和manager谈workload', '短期disability leave',
      ],
      'unemployed_on_visa': [
        '考虑contractor/freelance', '申请学校保持身份',
        '考虑配偶签证', '联系headhunter', '降低要求接受任何offer',
      ],
      'combo_card': [
        '自由换工作', '开始创业', '做freelance/consulting',
        '放心travel', '终于可以休息了',
      ],
      'visa_expiring_soon': [
        '联系律师加急', '考虑premium processing', '准备备选方案',
        '开始面试以防万一', '咨询是否可以延期',
      ],
    };

    for (const [cat, suggestions] of Object.entries(missingAnalysis)) {
      const catSnaps = categoryBuckets.get(cat as SituationCategory) || [];
      if (catSnaps.length === 0) continue;

      // Check which suggestions are NOT in available actions
      const sampleSnap = catSnaps[0];
      const availableIds = new Set(sampleSnap.availableActionIds);
      const missing = suggestions.filter(s => {
        // Map Chinese suggestion to action IDs
        const mapping: Record<string, string> = {
          '看心理医生': 'therapist',
          '联系移民律师': 'consultLawyer',
          '开始面试其他公司': 'prepJobChange',
        };
        const mapped = mapping[s];
        return !mapped || !availableIds.has(mapped);
      });

      if (missing.length > 0) {
        console.log(`\n  [${cat}] (${catSnaps.length} occurrences)`);
        console.log(`    现实中可能的行动但游戏中缺失:`);
        for (const m of missing) {
          console.log(`    ❌ ${m}`);
        }
      }
    }

    expect(sampled.length).toBeGreaterThanOrEqual(50);
  }, 120000);
});
