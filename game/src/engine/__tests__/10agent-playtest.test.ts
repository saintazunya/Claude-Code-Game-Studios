/**
 * 10-Agent Playtest: 10 diverse immigrant personas × 10 games × 10 rounds = 1000 games
 *
 * Each agent has a unique background, personality, and decision-making strategy.
 * Agents inspect game state each turn and flag unreasonable situations.
 * After each round, feedback is collected and issues are reported.
 */
import { describe, it, expect } from 'vitest';
import { createGameState, processTurn, getTurnInfo, getMaxAp, inferWorkMode, resolveEvent } from '../game-state';
import { getAvailableActions, canSelectAction, ACTIONS } from '../actions';
import { EVENT_POOL } from '../events';
import type { GameState, ActionId, CreationAttributes, GameEvent } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const ATTITUDE_IDS = new Set([
  'workNone', 'workSlack', 'workHard', 'workSuperHard',
  'studySlack', 'studyNormal', 'studyHard',
]);

// Smart action selector: picks from priority list, then fills remaining AP
function selectActions(state: GameState, priorities: ActionId[], attitudeLevel: number): ActionId[] {
  const available = getAvailableActions(state).filter(a => !ATTITUDE_IDS.has(a.id));
  const maxAp = getMaxAp(state);

  // Attitude selection
  const attActions: ActionId[] = state.phase === 'academic'
    ? ['studySlack', 'studyNormal', 'studyHard']
    : ['workNone', 'workSlack', 'workHard', 'workSuperHard'];
  const clampedLevel = Math.min(attitudeLevel, attActions.length - 1);
  const attCost = ACTIONS[attActions[clampedLevel]]?.apCost || 0;

  let remaining = maxAp - attCost;
  const selected: ActionId[] = [];

  // Pick from priorities first
  for (const id of priorities) {
    if (remaining <= 0) break;
    const action = available.find(a => a.id === id);
    if (!action) continue;
    const check = canSelectAction(action, selected, remaining);
    if (check.allowed) {
      selected.push(action.id);
      remaining -= action.apCost;
    }
  }

  // Fill remaining with random available actions
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  for (const a of shuffled) {
    if (remaining <= 0) break;
    if (selected.includes(a.id)) continue;
    const check = canSelectAction(a, selected, remaining);
    if (check.allowed) {
      selected.push(a.id);
      remaining -= a.apCost;
    }
  }

  selected.push(attActions[clampedLevel]);
  return selected;
}

// ─── Issue Tracking ─────────────────────────────────────────────────

interface GameIssue {
  agent: string;
  turn: number;
  category: 'unreasonable' | 'bug' | 'balance' | 'design' | 'ux';
  description: string;
  stateSnapshot?: string;
}

function checkForIssues(state: GameState, prevState: GameState, agent: AgentProfile, actions: ActionId[]): GameIssue[] {
  const issues: GameIssue[] = [];
  const turn = state.turn;
  const info = getTurnInfo(turn);

  // 1. Health drops too fast in a single turn
  const healthDrop = prevState.attributes.health - state.attributes.health;
  if (healthDrop > 40) {
    issues.push({
      agent: agent.name, turn, category: 'balance',
      description: `Health dropped ${healthDrop} in one turn (${prevState.attributes.health}→${state.attributes.health}). Too punishing?`,
    });
  }

  // 2. Mental drops too fast in a single turn
  const mentalDrop = prevState.attributes.mental - state.attributes.mental;
  if (mentalDrop > 35) {
    issues.push({
      agent: agent.name, turn, category: 'balance',
      description: `Mental dropped ${mentalDrop} in one turn (${prevState.attributes.mental}→${state.attributes.mental}). Spiral too fast?`,
    });
  }

  // 3. Cash swing too extreme
  const cashChange = state.economy.cash - prevState.economy.cash;
  if (cashChange < -30000 && state.phase === 'career') {
    issues.push({
      agent: agent.name, turn, category: 'balance',
      description: `Lost $${Math.abs(Math.round(cashChange)).toLocaleString()} in one quarter. Medical + living cost stacking?`,
    });
  }

  // 4. Stuck unemployed too long
  if (state.career.employed === 'unemployed' && state.immigration.unemploymentQuarters > 3) {
    issues.push({
      agent: agent.name, turn, category: 'design',
      description: `Unemployed for ${state.immigration.unemploymentQuarters} quarters. Death spiral — no job, visa expiring, can't recover.`,
    });
  }

  // 5. H1B: filed but never get lottery result
  if (state.immigration.h1bFiled && state.immigration.h1bAttempts === 0 && state.turn > 16) {
    issues.push({
      agent: agent.name, turn, category: 'bug',
      description: `H1B filed flag set but h1bAttempts still 0 after turn 16. Lottery not processing?`,
    });
  }

  // 6. Performance at 0 while employed and working hard
  if (state.career.employed === 'employed' && state.attributes.performance <= 0 &&
      actions.some(a => ['workHard', 'workSuperHard'].includes(a))) {
    issues.push({
      agent: agent.name, turn, category: 'balance',
      description: `Performance=0 despite working hard. Decay too aggressive or work gains too small?`,
    });
  }

  // 7. GPA stuck at 2.0 despite studying
  if (state.phase === 'academic' && state.academic.gpa <= 2.1 &&
      actions.some(a => ['studyNormal', 'studyHard', 'studyGpa'].includes(a)) && state.turn > 4) {
    issues.push({
      agent: agent.name, turn, category: 'balance',
      description: `GPA stuck at ${state.academic.gpa.toFixed(2)} despite studying. Decay outpacing gain?`,
    });
  }

  // 8. Visa expired but game didn't end
  if (state.immigration.visaExpiryTurn < state.turn &&
      !state.immigration.hasGreenCard && !state.immigration.hasComboCard &&
      !state.endingType &&
      !['f1', 'greenCard', 'comboCard'].includes(state.immigration.visaType)) {
    // Grace period check
    if (state.immigration.graceQuartersRemaining <= 0) {
      issues.push({
        agent: agent.name, turn, category: 'bug',
        description: `Visa expired (expiry=${state.immigration.visaExpiryTurn}, current=${state.turn}, type=${state.immigration.visaType}) but no deportation. Missing check?`,
      });
    }
  }

  // 9. Employed but salary is 0
  if (state.career.employed === 'employed' && state.career.salary === 0 && state.turn > 12) {
    issues.push({
      agent: agent.name, turn, category: 'bug',
      description: `Employed but salary=0. Job assignment missing salary?`,
    });
  }

  // 10. PERM started but no company
  if (state.immigration.permStatus !== 'none' && !state.career.company) {
    issues.push({
      agent: agent.name, turn, category: 'bug',
      description: `PERM status=${state.immigration.permStatus} but no company. PERM should require employer.`,
    });
  }

  // 11. Green card but still tracking visa expiry worries
  if (state.immigration.hasGreenCard && state.immigration.visaType !== 'greenCard') {
    issues.push({
      agent: agent.name, turn, category: 'bug',
      description: `Has green card but visaType=${state.immigration.visaType}. Should be 'greenCard'.`,
    });
  }

  // 12. Net worth negative but not bankrupt
  if (state.economy.cash < -15000 && !state.endingType) {
    issues.push({
      agent: agent.name, turn, category: 'design',
      description: `Cash at $${Math.round(state.economy.cash).toLocaleString()}, close to bankruptcy threshold (-$20K). Feels punishing.`,
    });
  }

  // 13. Burnout consecutive (should be protected)
  if (state.flags.burnoutActive && prevState.flags.burnoutActive && !prevState.flags.burnoutProtection) {
    issues.push({
      agent: agent.name, turn, category: 'bug',
      description: `Burnout two turns in a row without protection. Protection mechanism broken?`,
    });
  }

  return issues;
}

// ─── Agent Profiles ─────────────────────────────────────────────────

interface AgentProfile {
  name: string;
  background: string;
  personality: string;
  build: CreationAttributes;
  /** 0=coast, 1=normal, 2=hard, 3=superhard */
  attitudeLevel: (state: GameState) => number;
  strategy: (state: GameState) => ActionId[];
}

const AGENTS: AgentProfile[] = [
  // ── Agent 1: Fresh CS Masters ──
  {
    name: '小王 (Fresh CS Masters)',
    background: 'CMU CS硕士刚毕业, 正常找工路线, 稳扎稳打型',
    personality: 'Methodical, risk-averse, follows the standard path. Prioritizes stability.',
    build: { constitution: 3, schoolRanking: 4, geoLocation: 3 },
    attitudeLevel: (s) => {
      if (s.attributes.health < 40 || s.attributes.mental < 30) return 0;
      if (s.attributes.mental > 60 && s.attributes.health > 60) return 2;
      return 1;
    },
    strategy: (s) => {
      const p: ActionId[] = [];
      const att = s.attributes;
      if (s.phase === 'academic') {
        if (!s.academic.hadIntern && s.turn >= 2) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('networking', 'sideProject', 'exercise');
        const gradTurn = s.academic.isPhd ? 16 : 8;
        if (s.turn === gradTurn - 1) p.push('searchFullTimeJob');
      } else {
        if (att.health < 40) p.push('hospital', 'rest');
        if (att.mental < 35) p.push('therapist');
        if (s.career.employed === 'unemployed') {
          p.push(s.immigration.graceQuartersRemaining > 0 ? 'urgentJobSearch' : 'normalJobSearch');
        }
        p.push('upskill', 'exercise');
        if (att.health > 70 && att.mental > 60 && s.career.tenure >= 8) p.push('prepJobChange');
      }
      const attLvl = s.attributes.health < 40 || s.attributes.mental < 30 ? 0 :
        s.attributes.mental > 60 && s.attributes.health > 60 ? 2 : 1;
      return selectActions(s, p, attLvl);
    },
  },

  // ── Agent 2: 卷王 (Grinder) ──
  {
    name: '小李 (卷王 Grinder)',
    background: '清华→MIT, 拼命卷绩效冲L5/L6, 愿意牺牲健康但懂得节奏',
    personality: 'Aggressive but strategic. Conserves energy in school, grinds hard at work. Knows when to back off.',
    build: { constitution: 4, schoolRanking: 5, geoLocation: 1 },
    attitudeLevel: (s) => {
      // Smart grinder: don't burn out in school, save energy for career
      if (s.phase === 'academic') return 2; // studyHard, not insane
      if (s.flags.burnoutActive || s.attributes.health < 20) return 0;
      if (s.attributes.mental < 20) return 1; // back off before burnout
      return 3; // super hard at work
    },
    strategy: (s) => {
      const p: ActionId[] = [];
      if (s.phase === 'academic') {
        if (!s.academic.hadIntern && s.turn >= 2) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('sideProject', 'studyGpa', 'networking');
        // Rest if mental getting low in school
        if (s.attributes.mental < 40) p.push('exercise');
        const gradTurn = s.academic.isPhd ? 16 : 8;
        if (s.turn === gradTurn - 1) p.push('searchFullTimeJob');
      } else {
        if (s.attributes.health < 30) p.push('hospital');
        if (s.attributes.mental < 25) p.push('therapist', 'exercise');
        if (s.career.employed === 'unemployed') p.push('urgentJobSearch');
        p.push('upskill');
        // Only job hop AFTER I-140 approved (protect GC progress)
        if (s.immigration.i140Status === 'approved' && s.career.tenure >= 6) p.push('prepJobChange');
      }
      const attLvl = s.phase === 'academic' ? 2 :
        s.flags.burnoutActive || s.attributes.health < 20 ? 0 :
        s.attributes.mental < 20 ? 1 : 3;
      return selectActions(s, p, attLvl);
    },
  },

  // ── Agent 3: Work-Life Balance ──
  {
    name: '小张 (养生 WLB)',
    background: '普通学校, 注重work-life balance, 绝不加班',
    personality: 'Relaxed, health-first. Will coast at work. Prioritizes exercise and rest.',
    build: { constitution: 4, schoolRanking: 3, geoLocation: 3 },
    attitudeLevel: (s) => {
      if (s.attributes.mental < 50) return 0;
      return 1; // never goes above normal
    },
    strategy: (s) => {
      const p: ActionId[] = [];
      if (s.phase === 'academic') {
        p.push('exercise', 'rest');
        if (!s.academic.hadIntern && s.turn >= 2) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('networking');
        const gradTurn = s.academic.isPhd ? 16 : 8;
        if (s.turn === gradTurn - 1) p.push('searchFullTimeJob');
      } else {
        p.push('exercise', 'rest');
        if (s.attributes.mental < 50) p.push('therapist');
        if (s.attributes.health < 60) p.push('hospital');
        if (s.career.employed === 'unemployed') p.push('normalJobSearch');
        if (s.career.tenure > 12) p.push('prepJobChange'); // only if stable
      }
      const attLvl = s.attributes.mental < 50 ? 0 : 1;
      return selectActions(s, p, attLvl);
    },
  },

  // ── Agent 4: PhD Academic ──
  {
    name: '小陈 (PhD学术型)',
    background: 'Stanford PhD, 发论文走EB1A/NIW路线, 不走PERM',
    personality: 'Academic-focused, publishes papers, builds academic impact for self-petition GC.',
    build: { constitution: 2, schoolRanking: 5, geoLocation: 3 },
    attitudeLevel: (s) => {
      if (s.attributes.mental < 30) return 0;
      return 2; // study/work hard
    },
    strategy: (s) => {
      const p: ActionId[] = [];
      if (s.phase === 'academic') {
        if (s.academic.isPhd && s.turn >= 8) p.push('thesisResearch');
        if (!s.academic.hadIntern && s.turn >= 2) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('sideProject', 'networking');
        const gradTurn = s.academic.isPhd ? 16 : 8;
        if (s.turn === gradTurn - 1) p.push('searchFullTimeJob');
      } else {
        p.push('publishPaper', 'researchNiw');
        if (s.attributes.health < 40) p.push('rest', 'hospital');
        if (s.attributes.mental < 35) p.push('therapist');
        if (s.career.employed === 'unemployed') p.push('normalJobSearch');
        p.push('upskill');
      }
      const attLvl = s.attributes.mental < 30 ? 0 : 2;
      return selectActions(s, p, attLvl);
    },
  },

  // ── Agent 5: 2-Year H1B Engineer (mid-career start) ──
  {
    name: '小赵 (H1B 2年工程师)',
    background: '普通硕士, 已工作2年在H1B上, 等抽签结果, 焦虑型',
    personality: 'Anxious about visa status, works hard to keep job, afraid of layoff.',
    build: { constitution: 3, schoolRanking: 3, geoLocation: 4 },
    attitudeLevel: (s) => {
      // Works hard when on visa, relaxes after GC
      if (s.immigration.hasGreenCard) return 1;
      if (s.attributes.mental < 25) return 0;
      return 2; // stay safe, work hard
    },
    strategy: (s) => {
      const p: ActionId[] = [];
      if (s.phase === 'academic') {
        if (!s.academic.hadIntern && s.turn >= 2) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('studyGpa', 'networking', 'sideProject');
        const gradTurn = s.academic.isPhd ? 16 : 8;
        if (s.turn === gradTurn - 1) p.push('searchFullTimeJob');
      } else {
        // Anxious: focus on keeping job, don't rock the boat
        if (s.attributes.health < 40) p.push('hospital', 'rest');
        if (s.attributes.mental < 30) p.push('therapist');
        if (s.career.employed === 'unemployed') p.push('urgentJobSearch');
        p.push('upskill');
        // Only job hop after GC
        if (s.immigration.hasGreenCard && s.career.tenure >= 8) p.push('prepJobChange');
        if (s.attributes.mental < 50) p.push('exercise');
      }
      const attLvl = s.immigration.hasGreenCard ? 1 :
        s.attributes.mental < 25 ? 0 : 2;
      return selectActions(s, p, attLvl);
    },
  },

  // ── Agent 6: 5-Year Veteran, No I-140 ──
  {
    name: '小刘 (5年老兵 无I-140)',
    background: '工作5年还没拿到I-140, PERM一直被audit, 绝望中',
    personality: 'Desperate, frustrated with immigration system. Considers self-petition routes.',
    build: { constitution: 3, schoolRanking: 4, geoLocation: 2 },
    attitudeLevel: (s) => {
      if (s.attributes.mental < 20) return 0;
      if (s.immigration.i140Status === 'approved') return 1; // relax once I-140 approved
      return 2; // work hard to stay competitive
    },
    strategy: (s) => {
      const p: ActionId[] = [];
      if (s.phase === 'academic') {
        if (!s.academic.hadIntern && s.turn >= 2) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('sideProject', 'networking');
        const gradTurn = s.academic.isPhd ? 16 : 8;
        if (s.turn === gradTurn - 1) p.push('searchFullTimeJob');
      } else {
        if (s.attributes.health < 40) p.push('hospital', 'rest');
        if (s.attributes.mental < 30) p.push('therapist');
        if (s.career.employed === 'unemployed') p.push('urgentJobSearch');
        // Try self-petition if PERM is stuck
        if (s.immigration.permStatus === 'audited' || s.immigration.permStatus === 'none') {
          p.push('publishPaper', 'researchNiw');
        }
        p.push('upskill');
        // Avoid job hopping — would reset PERM!
        if (s.immigration.i140Status === 'approved') p.push('prepJobChange');
      }
      const attLvl = s.attributes.mental < 20 ? 0 :
        s.immigration.i140Status === 'approved' ? 1 : 2;
      return selectActions(s, p, attLvl);
    },
  },

  // ── Agent 7: Green Card Holder, Wealth Builder ──
  {
    name: '小周 (绿卡后攒钱型)',
    background: '运气好早拿绿卡, 现在专注升职加薪攒钱',
    personality: 'Lucky with immigration, now focused on career growth and wealth accumulation.',
    build: { constitution: 4, schoolRanking: 4, geoLocation: 4 },
    attitudeLevel: (s) => {
      if (s.attributes.mental < 40) return 1;
      if (s.attributes.health > 60) return 2;
      return 1;
    },
    strategy: (s) => {
      const p: ActionId[] = [];
      if (s.phase === 'academic') {
        if (!s.academic.hadIntern && s.turn >= 2) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('sideProject', 'networking', 'studyGpa');
        const gradTurn = s.academic.isPhd ? 16 : 8;
        if (s.turn === gradTurn - 1) p.push('searchFullTimeJob');
      } else {
        if (s.attributes.health < 50) p.push('rest', 'hospital');
        if (s.attributes.mental < 40) p.push('therapist');
        if (s.career.employed === 'unemployed') p.push('normalJobSearch');
        p.push('upskill');
        // Invest whenever possible — wealth builder
        if (s.economy.cash > 20000) p.push('invest');
        // Aggressive job hopping for TC — no GC penalty since already have it
        if (s.immigration.hasGreenCard && s.career.tenure >= 6) p.push('prepJobChange');
        p.push('exercise');
      }
      const attLvl = s.attributes.mental < 40 ? 1 :
        s.attributes.health > 60 ? 2 : 1;
      return selectActions(s, p, attLvl);
    },
  },

  // ── Agent 8: Random Newbie ──
  {
    name: '小吴 (新手随机玩家)',
    background: '第一次玩, 不懂策略, 随便选行动',
    personality: 'Clueless, picks randomly. Tests if the game is playable without strategy.',
    build: { constitution: 2, schoolRanking: 3, geoLocation: 3 },
    attitudeLevel: () => Math.floor(Math.random() * 3),
    strategy: (s) => {
      // Pure random — whatever is available
      const attLvl = Math.floor(Math.random() * 3);
      return selectActions(s, [], attLvl);
    },
  },

  // ── Agent 9: Job Hopper ──
  {
    name: '小孙 (跳槽狂魔)',
    background: '每8-12个季度换一家公司, 薪资涨最快但绿卡进度全丢',
    personality: 'Career-driven, chases TC. Doesn\'t care about GC until it\'s too late.',
    build: { constitution: 3, schoolRanking: 4, geoLocation: 5 },
    attitudeLevel: (s) => {
      if (s.attributes.mental < 25) return 0;
      return 2;
    },
    strategy: (s) => {
      const p: ActionId[] = [];
      if (s.phase === 'academic') {
        if (!s.academic.hadIntern && s.turn >= 2) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('sideProject', 'networking');
        const gradTurn = s.academic.isPhd ? 16 : 8;
        if (s.turn === gradTurn - 1) p.push('searchFullTimeJob');
      } else {
        if (s.attributes.health < 30) p.push('hospital');
        if (s.attributes.mental < 25) p.push('therapist');
        if (s.career.employed === 'unemployed') p.push('urgentJobSearch');
        p.push('upskill');
        // Job hop every 2 years regardless of GC status
        if (s.career.tenure >= 8) p.push('prepJobChange');
        // Only realize GC matters late game
        if (s.turn > 50 && s.immigration.i140Status !== 'approved') {
          p.push('researchNiw', 'publishPaper');
        }
      }
      const attLvl = s.attributes.mental < 25 ? 0 : 2;
      return selectActions(s, p, attLvl);
    },
  },

  // ── Agent 10: Low-Tier School Survivor ──
  {
    name: '小马 (普通学校逆袭)',
    background: '学校排名0, 地理位置0, 全靠自己卷skills和刷面试翻盘',
    personality: 'Underdog, works extra hard to compensate for bad starting stats.',
    build: { constitution: 5, schoolRanking: 0, geoLocation: 0 },
    attitudeLevel: (s) => {
      if (s.attributes.mental < 20) return 0;
      if (s.attributes.health < 30) return 1;
      return 3; // grind mode always — must compensate
    },
    strategy: (s) => {
      const p: ActionId[] = [];
      if (s.phase === 'academic') {
        // Must get intern to have any chance
        if (!s.academic.hadIntern && s.turn >= 2) p.push('searchIntern');
        if (s.flags.internActiveThisQuarter) p.push('internWork');
        p.push('sideProject', 'studyGpa', 'networking');
        const gradTurn = s.academic.isPhd ? 16 : 8;
        if (s.turn === gradTurn - 1) p.push('searchFullTimeJob');
      } else {
        if (s.attributes.health < 25) p.push('hospital');
        if (s.attributes.mental < 20) p.push('therapist', 'rest');
        if (s.career.employed === 'unemployed') p.push('urgentJobSearch');
        p.push('upskill', 'upskill'); // double down on skills
        if (s.career.tenure >= 10 && s.attributes.skills > 150) p.push('prepJobChange');
      }
      const attLvl = s.attributes.mental < 20 ? 0 :
        s.attributes.health < 30 ? 1 : 3;
      return selectActions(s, p, attLvl);
    },
  },
];

// ─── Game Runner ────────────────────────────────────────────────────

interface GameResult {
  turns: number;
  ending: string;
  level: number;
  netWorth: number;
  hasGC: boolean;
  hasCombo: boolean;
  maxLevel: number;
  h1bWon: boolean;
  permApproved: boolean;
  i140Approved: boolean;
  h1bAttempts: number;
  promotions: number;
  sicknesses: number;
  burnouts: number;
  jobHops: number;
  avgMental: number;
  avgHealth: number;
  issues: GameIssue[];
  keyMilestones: string[];
}

function playGame(agent: AgentProfile): GameResult {
  let state = createGameState(agent.build);
  let promotions = 0, sicknesses = 0, burnouts = 0, jobHops = 0;
  let maxLevel = 3;
  let totalMental = 0, totalHealth = 0, samples = 0;
  const issues: GameIssue[] = [];
  const keyMilestones: string[] = [];

  for (let t = 0; t < 72; t++) {
    const prevState = { ...state, attributes: { ...state.attributes }, economy: { ...state.economy }, immigration: { ...state.immigration }, career: { ...state.career }, flags: { ...state.flags } };
    const actions = agent.strategy(state);

    try {
      state = processTurn(state, 'normal', actions);
    } catch (e) {
      issues.push({
        agent: agent.name, turn: t, category: 'bug',
        description: `CRASH: ${(e as Error).message}`,
      });
      break;
    }

    // Track stats
    totalMental += state.attributes.mental;
    totalHealth += state.attributes.health;
    samples++;
    maxLevel = Math.max(maxLevel, state.career.level);

    // Check for issues
    const turnIssues = checkForIssues(state, prevState as GameState, agent, actions);
    issues.push(...turnIssues);

    // Track milestones
    const lastEvents = state.timeline[state.timeline.length - 1]?.events || [];
    for (const e of lastEvents) {
      if (e.id === 'promoted') { promotions++; keyMilestones.push(`T${state.turn}: Promoted to L${state.career.level}`); }
      if (e.id === 'h1b_approved') keyMilestones.push(`T${state.turn}: H1B approved`);
      if (e.id === 'perm_approved') keyMilestones.push(`T${state.turn}: PERM approved`);
      if (e.id === 'i140_approved') keyMilestones.push(`T${state.turn}: I-140 approved`);
      if (e.id === 'green_card_approved') keyMilestones.push(`T${state.turn}: GREEN CARD!`);
      if (e.id === 'i485_filed_combo_card') keyMilestones.push(`T${state.turn}: Combo card`);
      if (e.id === 'laid_off') keyMilestones.push(`T${state.turn}: Laid off`);
      if (e.id === 'burnout') burnouts++;
      if (e.id.startsWith('sickness_')) sicknesses++;
      if (e.id === 'found_job_while_unemployed') keyMilestones.push(`T${state.turn}: Found new job`);
      if (e.id === 'job_offer_received') jobHops++;
    }

    // Resolve pending events automatically (pick first choice)
    const pendingEvents = (state.flags.pendingRandomEvents as string[]) || [];
    for (const eventId of pendingEvents) {
      const allEvents = EVENT_POOL;
      const event = allEvents.find(e => e.id === eventId);
      if (event && event.choices.length > 0) {
        // Smart choice: pick based on personality
        const choiceIdx = pickEventChoice(agent, state, event);
        try {
          state = resolveEvent(state, event, event.choices[choiceIdx].id);
        } catch (_) { /* ignore event resolution errors */ }
      }
    }

    if (state.endingType) break;
  }

  return {
    turns: state.turn,
    ending: state.endingType || 'ongoing',
    level: state.career.level,
    netWorth: Math.round(state.attributes.netWorth),
    hasGC: state.immigration.hasGreenCard,
    hasCombo: state.immigration.hasComboCard,
    maxLevel,
    h1bWon: state.immigration.h1bAttempts > 0 && ['h1b', 'h1bRenewal', 'h1b7thYear', 'comboCard', 'greenCard'].includes(state.immigration.visaType),
    permApproved: state.immigration.permStatus === 'approved',
    i140Approved: state.immigration.i140Status === 'approved',
    h1bAttempts: state.immigration.h1bAttempts,
    promotions,
    sicknesses,
    burnouts,
    jobHops,
    avgMental: samples > 0 ? Math.round(totalMental / samples) : 0,
    avgHealth: samples > 0 ? Math.round(totalHealth / samples) : 0,
    issues,
    keyMilestones,
  };
}

// Pick event choice based on agent personality
function pickEventChoice(agent: AgentProfile, state: GameState, event: GameEvent): number {
  if (event.choices.length === 0) return 0;
  if (event.choices.length === 1) return 0;

  // Job offer: accept if it's good, grinder/hopper always accept
  if (event.id === 'job_offer_received') {
    if (agent.name.includes('跳槽')) return 0; // hopper always accepts
    if (agent.name.includes('无I-140') && state.immigration.i140Status !== 'approved') {
      return event.choices.length > 1 ? 1 : 0; // decline — would reset GC
    }
    return 0; // most accept
  }

  // Risk-averse agents pick 'stable' choices, grinders pick 'risky'
  const isRiskAverse = agent.name.includes('养生') || agent.name.includes('焦虑') || agent.name.includes('Fresh');
  const isAggressive = agent.name.includes('卷王') || agent.name.includes('跳槽');

  if (isRiskAverse) {
    const stableIdx = event.choices.findIndex(c => c.tag === 'stable');
    if (stableIdx >= 0) return stableIdx;
  }
  if (isAggressive) {
    const riskyIdx = event.choices.findIndex(c => c.tag === 'risky');
    if (riskyIdx >= 0) return riskyIdx;
  }

  // Default: pick first choice
  return 0;
}

// ─── Report Generation ──────────────────────────────────────────────

interface RoundReport {
  round: number;
  agentResults: Map<string, GameResult[]>;
  allIssues: GameIssue[];
  stats: {
    gcRate: number;
    deportRate: number;
    bankruptRate: number;
    avgTurns: number;
    avgNW: number;
    jobFoundRate: number;
    h1bRate: number;
  };
}

function runRound(roundNum: number): RoundReport {
  const agentResults = new Map<string, GameResult[]>();
  const allIssues: GameIssue[] = [];

  for (const agent of AGENTS) {
    const results: GameResult[] = [];
    for (let g = 0; g < 10; g++) {
      const result = playGame(agent);
      results.push(result);
      allIssues.push(...result.issues);
    }
    agentResults.set(agent.name, results);
  }

  const all = [...agentResults.values()].flat();
  const total = all.length;

  return {
    round: roundNum,
    agentResults,
    allIssues,
    stats: {
      gcRate: all.filter(r => r.hasGC).length / total,
      deportRate: all.filter(r => r.ending === 'deported').length / total,
      bankruptRate: all.filter(r => r.ending === 'bankrupt').length / total,
      avgTurns: Math.round(all.reduce((s, r) => s + r.turns, 0) / total),
      avgNW: Math.round(all.reduce((s, r) => s + r.netWorth, 0) / total),
      jobFoundRate: all.filter(r => r.ending !== 'bankrupt' && r.turns > 10).length / total,
      h1bRate: all.filter(r => r.h1bWon).length / total,
    },
  };
}

function printAgentReport(name: string, results: GameResult[], agent: AgentProfile) {
  const n = results.length;
  const gcRate = results.filter(r => r.hasGC).length;
  const deportRate = results.filter(r => r.ending === 'deported').length;
  const bankruptRate = results.filter(r => r.ending === 'bankrupt').length;
  const avgTurns = Math.round(results.reduce((s, r) => s + r.turns, 0) / n);
  const avgNW = Math.round(results.reduce((s, r) => s + r.netWorth, 0) / n);
  const avgLevel = (results.reduce((s, r) => s + r.level, 0) / n).toFixed(1);
  const maxLevel = Math.max(...results.map(r => r.maxLevel));
  const avgMental = Math.round(results.reduce((s, r) => s + r.avgMental, 0) / n);
  const avgHealth = Math.round(results.reduce((s, r) => s + r.avgHealth, 0) / n);
  const avgPromos = (results.reduce((s, r) => s + r.promotions, 0) / n).toFixed(1);
  const avgBurnouts = (results.reduce((s, r) => s + r.burnouts, 0) / n).toFixed(1);
  const avgSick = (results.reduce((s, r) => s + r.sicknesses, 0) / n).toFixed(1);
  const h1bWon = results.filter(r => r.h1bWon).length;
  const permApproved = results.filter(r => r.permApproved).length;
  const i140Approved = results.filter(r => r.i140Approved).length;
  const avgJobHops = (results.reduce((s, r) => s + r.jobHops, 0) / n).toFixed(1);
  const endings = results.reduce((acc, r) => { acc[r.ending] = (acc[r.ending] || 0) + 1; return acc; }, {} as Record<string, number>);
  const issueCount = results.reduce((s, r) => s + r.issues.length, 0);

  console.log(`  ┌─ ${name}`);
  console.log(`  │  ${agent.personality}`);
  console.log(`  │  Build: CON=${agent.build.constitution} SCH=${agent.build.schoolRanking} GEO=${agent.build.geoLocation}`);
  console.log(`  │  Endings: ${Object.entries(endings).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`  │  GC: ${gcRate}/${n} | H1B: ${h1bWon}/${n} | PERM: ${permApproved}/${n} | I-140: ${i140Approved}/${n}`);
  console.log(`  │  Avg: turns=${avgTurns} level=L${avgLevel} (max L${maxLevel}) NW=$${avgNW.toLocaleString()}`);
  console.log(`  │  Health: avg=${avgHealth} | Mental: avg=${avgMental}`);
  console.log(`  │  Promos=${avgPromos} Burnouts=${avgBurnouts} Sick=${avgSick} Hops=${avgJobHops}`);
  if (issueCount > 0) console.log(`  │  ⚠️ ${issueCount} issues flagged`);
  console.log(`  └────`);
}

// ─── Main Test ──────────────────────────────────────────────────────

describe('10-Agent Playtest (10 agents × 10 games × 10 rounds)', () => {
  it('runs 10 rounds and collects feedback', () => {
    const allRounds: RoundReport[] = [];
    const issueCounts: Record<string, number> = {};
    const issueExamples: Record<string, string[]> = {};

    for (let round = 1; round <= 10; round++) {
      const report = runRound(round);
      allRounds.push(report);

      console.log(`\n${'═'.repeat(70)}`);
      console.log(`  ROUND ${round}/10 — ${report.stats.gcRate * 100}% GC | ${report.stats.deportRate * 100}% Deport | ${report.stats.bankruptRate * 100}% Bankrupt`);
      console.log(`  Avg Turns: ${report.stats.avgTurns} | Avg NW: $${report.stats.avgNW.toLocaleString()}`);
      console.log(`${'═'.repeat(70)}`);

      // Per-agent summary
      for (const agent of AGENTS) {
        const results = report.agentResults.get(agent.name) || [];
        printAgentReport(agent.name, results, agent);
      }

      // Aggregate issues
      for (const issue of report.allIssues) {
        const key = `[${issue.category}] ${issue.description.substring(0, 80)}`;
        issueCounts[key] = (issueCounts[key] || 0) + 1;
        if (!issueExamples[key]) issueExamples[key] = [];
        if (issueExamples[key].length < 3) {
          issueExamples[key].push(`${issue.agent} T${issue.turn}`);
        }
      }

      // Round issues summary
      if (report.allIssues.length > 0) {
        console.log(`\n  📋 Round ${round} Issues: ${report.allIssues.length} total`);
        const categorized = report.allIssues.reduce((acc, i) => {
          acc[i.category] = (acc[i.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log(`     ${Object.entries(categorized).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      }
    }

    // ─── Final Summary ────────────────────────────────────────────

    console.log(`\n${'█'.repeat(70)}`);
    console.log(`  FINAL SUMMARY — 10 ROUNDS × 100 GAMES = 1000 TOTAL`);
    console.log(`${'█'.repeat(70)}`);

    // Aggregate stats across all rounds
    const avgGC = (allRounds.reduce((s, r) => s + r.stats.gcRate, 0) / 10 * 100).toFixed(1);
    const avgDeport = (allRounds.reduce((s, r) => s + r.stats.deportRate, 0) / 10 * 100).toFixed(1);
    const avgBankrupt = (allRounds.reduce((s, r) => s + r.stats.bankruptRate, 0) / 10 * 100).toFixed(1);
    const avgTurns = Math.round(allRounds.reduce((s, r) => s + r.stats.avgTurns, 0) / 10);
    const avgNW = Math.round(allRounds.reduce((s, r) => s + r.stats.avgNW, 0) / 10);

    console.log(`\n  Avg GC Rate: ${avgGC}%`);
    console.log(`  Avg Deportation: ${avgDeport}%`);
    console.log(`  Avg Bankruptcy: ${avgBankrupt}%`);
    console.log(`  Avg Game Length: ${avgTurns} turns`);
    console.log(`  Avg Net Worth: $${avgNW.toLocaleString()}`);

    // Per-agent across all rounds
    console.log(`\n  ── Per-Agent Lifetime Stats ──`);
    for (const agent of AGENTS) {
      const allResults = allRounds.flatMap(r => [...(r.agentResults.get(agent.name) || [])]);
      const n = allResults.length;
      if (n === 0) continue;
      const gc = allResults.filter(r => r.hasGC).length;
      const dep = allResults.filter(r => r.ending === 'deported').length;
      const bnk = allResults.filter(r => r.ending === 'bankrupt').length;
      const avgNW = Math.round(allResults.reduce((s, r) => s + r.netWorth, 0) / n);
      console.log(`  ${agent.name}: GC=${gc}/${n} (${(gc/n*100).toFixed(0)}%) | Deport=${dep} | Bankrupt=${bnk} | Avg NW=$${avgNW.toLocaleString()}`);
    }

    // Top issues across all rounds
    console.log(`\n  ── Top Issues (across all 1000 games) ──`);
    const sortedIssues = Object.entries(issueCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
    for (const [desc, count] of sortedIssues) {
      const examples = issueExamples[desc]?.join(', ') || '';
      console.log(`  ${count}× ${desc}`);
      if (examples) console.log(`       Examples: ${examples}`);
    }

    // Balance assessment
    console.log(`\n  ── Balance Assessment ──`);
    const gcNum = parseFloat(avgGC);
    const depNum = parseFloat(avgDeport);
    const bnkNum = parseFloat(avgBankrupt);

    if (gcNum < 10) console.log('  ❌ GC rate too low (<10%) — nearly impossible');
    else if (gcNum > 40) console.log('  ❌ GC rate too high (>40%) — too easy');
    else if (gcNum >= 15 && gcNum <= 25) console.log('  ✅ GC rate in target range (15-25%)');
    else console.log(`  ⚠️ GC rate ${avgGC}% — outside ideal 15-25% but acceptable`);

    if (depNum > 70) console.log('  ❌ Deportation too high (>70%) — game feels hopeless');
    else if (depNum < 30) console.log('  ⚠️ Deportation low (<30%) — visa system may be too forgiving');
    else console.log('  ✅ Deportation rate reasonable');

    if (bnkNum > 25) console.log('  ❌ Bankruptcy too high (>25%) — economy too harsh');
    else if (bnkNum < 5) console.log('  ⚠️ Bankruptcy very rare — money too easy?');
    else console.log('  ✅ Bankruptcy rate reasonable');

    // Agent diversity check
    const gcRates = AGENTS.map(a => {
      const results = allRounds.flatMap(r => [...(r.agentResults.get(a.name) || [])]);
      return results.filter(r => r.hasGC).length / results.length;
    });
    const gcSpread = Math.max(...gcRates) - Math.min(...gcRates);
    if (gcSpread < 0.05) console.log('  ⚠️ All agents have similar GC rates — strategy doesn\'t matter enough');
    else if (gcSpread > 0.40) console.log('  ⚠️ Huge GC rate spread between agents — some builds may be unviable');
    else console.log(`  ✅ Agent GC spread ${(gcSpread * 100).toFixed(0)}% — strategies matter`);

    // No hard assertion — this is observational
    expect(true).toBe(true);
  }, 120000); // 2 minute timeout
});
