// Action definitions — all available player actions with AP costs and effects

import type { ActionDef, ActionId, GameState } from './types';

export const ACTIONS: Record<ActionId, ActionDef> = {
  // Career actions
  workNone: {
    id: 'workNone', nameZh: '完全不工作', apCost: 0, phase: 'career',
    effects: { performance: -5, mental: 5 }, description: 'Take the quarter off',
    tipsZh: '⚠️ 绩效-5 | ✅ 精神+5 | 💡 0AP但绩效大降',
    precondition: (s) => s.career.employed === 'employed',
    exclusive: ['workSlack', 'workHard', 'workSuperHard'],
  },
  workSlack: {
    id: 'workSlack', nameZh: '摸鱼工作', apCost: 1, phase: 'career',
    effects: { performance: -5, mental: 2 }, description: 'Slack off at work',
    tipsZh: '⚠️ 绩效-3 | ✅ 精神+2 | 💡 摸鱼省精力但绩效下降',
    precondition: (s) => s.career.employed === 'employed',
    exclusive: ['workNone', 'workHard', 'workSuperHard'],
  },
  workHard: {
    id: 'workHard', nameZh: '努力工作', apCost: 2, phase: 'career',
    effects: { performance: 5, mental: -1 }, description: 'Put in extra effort at work',
    tipsZh: '✅ 绩效+5 | ⚠️ 精神-1 | 💡 稳步积累绩效',
    precondition: (s) => s.career.employed === 'employed',
    exclusive: ['workNone', 'workSlack', 'workSuperHard'],
  },
  workSuperHard: {
    id: 'workSuperHard', nameZh: '超级努力工作', apCost: 3, phase: 'career',
    effects: { performance: 12, mental: -3 }, description: 'Go above and beyond',
    tipsZh: '✅ 绩效+12 | ⚠️ 精神-3 | 💡 冲绩效升职用',
    precondition: (s) => s.career.employed === 'employed',
    exclusive: ['workNone', 'workSlack', 'workHard'],
  },
  upskill: {
    id: 'upskill', nameZh: '技能进修', apCost: 2, phase: 'career',
    effects: { skills: 8 }, description: 'Study and improve technical skills',
    tipsZh: '✅ 技能+8，提高跳槽和升职概率 | ⚠️ 不直接影响绩效',
  },
  prepJobChange: {
    id: 'prepJobChange', nameZh: '跳槽面试', apCost: 3, phase: 'career',
    effects: { mental: -3 }, description: 'Interview for new jobs this quarter',
    tipsZh: '✅ 本季度判定是否拿到offer | ✅ 技能越高offer越大 | ⚠️ 没有I-140跳槽会重置绿卡进度！ | ⚠️ 精神-3 | 💡 PIP期间也可以面试（推荐）',
    precondition: (s) => s.career.employed === 'employed',
    exclusive: ['travel'],
  },
  // entrepreneurship removed — not yet designed
  normalJobSearch: {
    id: 'normalJobSearch', nameZh: '找工作', apCost: 3, phase: 'career',
    effects: { mental: -3 }, description: 'Normal job search',
    tipsZh: '✅ 基础offer概率 | ⚠️ 精神-3 | 💡 失业时找工作',
    precondition: (s) => s.career.employed === 'unemployed',
    exclusive: ['urgentJobSearch'],
  },
  urgentJobSearch: {
    id: 'urgentJobSearch', nameZh: '紧急求职', apCost: 5, phase: 'career',
    effects: { mental: -10 }, description: 'Desperate job search',
    tipsZh: '✅ +25%拿offer概率（紧急模式）| ⚠️ 精神-10 | 💡 概率更高但AP更贵',
    precondition: (s) => s.career.employed === 'unemployed',
    exclusive: ['normalJobSearch'],
  },

  // Immigration actions
  // prepH1b removed — employer auto-files H1B each Q1 when on OPT/STEM
  consultLawyer: {
    id: 'consultLawyer', nameZh: '咨询移民律师', apCost: 1, phase: 'career',
    effects: { mental: 3 }, description: 'Consult immigration lawyer ($500)',
    tipsZh: '✅ 精神+3（安心感）| ✅ 了解身份选项 | ⚠️ 花费$500 | 💡 危机时第一件事',
  },
  day1Cpt: {
    id: 'day1Cpt', nameZh: '报名Day1-CPT学校', apCost: 2, phase: 'career',
    effects: { mental: 10 }, description: 'Enroll in CPT school to maintain work authorization ($3K/quarter)',
    tipsZh: '✅ 保持合法身份+工作许可 | ✅ 可以继续找工作/抽H1B | ⚠️ $3K/季度学费 | ⚠️ 有风险（USCIS审查）| 💡 签证快到期时的救命稻草',
    precondition: (s) => {
      // Available when visa is expiring within 2 quarters or unemployed on OPT
      const expiryClose = s.immigration.visaExpiryTurn - s.turn <= 2;
      const unemployedOnOpt = s.career.employed === 'unemployed' &&
        ['opt', 'optStem'].includes(s.immigration.visaType);
      const h1bExpiring = expiryClose && ['h1b', 'h1bRenewal', 'h1b7thYear'].includes(s.immigration.visaType);
      return !s.immigration.hasGreenCard && !s.immigration.hasComboCard && (unemployedOnOpt || h1bExpiring || expiryClose);
    },
  },
  researchNiw: {
    id: 'researchNiw', nameZh: '研究NIW/EB1A', apCost: 3, phase: 'career',
    effects: { academicImpact: 5 }, description: 'Work toward self-petition immigration route',
    tipsZh: '✅ 学术+5，推进自主绿卡 | ✅ 不绑雇主，自由度高 | ⚠️ 需要学术影响力>50(NIW)或>75(EB1A)',
  },
  publishPaper: {
    id: 'publishPaper', nameZh: '发论文（副业）', apCost: 3, phase: 'career',
    effects: { academicImpact: 10 }, description: 'Write and publish a paper as side project',
    tipsZh: '✅ 学术+10，大幅推进NIW/EB1A | ⚠️ 占3AP | ⚠️ RS职业自带论文产出，不需要这个',
    precondition: (s) => s.career.path !== 'rs',
  },
  // consultLawyer removed — not yet designed

  // Investment
  invest: {
    id: 'invest', nameZh: '投资理财', apCost: 1, phase: 'any',
    effects: {}, description: 'Invest in S&P500 or adjust auto-invest settings',
    tipsZh: '✅ 一次性投资或调整定投金额 | ✅ 长期年化~8% | ⚠️ 经济衰退期可能亏损 | 💡 越早开始复利越大',
    precondition: (s) => s.economy.cash > 1000,
  },

  // Health & wellness
  rest: {
    id: 'rest', nameZh: '休息调整', apCost: 2, phase: 'any',
    effects: { health: 10, mental: 8 }, description: 'Rest and recover',
    tipsZh: '✅ 健康+10，精神+8 | ✅ 免费，性价比不错 | 💡 健康低于50%时建议休息',
  },
  hospital: {
    id: 'hospital', nameZh: '去医院看病', apCost: 3, phase: 'any',
    effects: { health: 25, mental: 5 }, description: 'Visit hospital for treatment ($3,000)',
    tipsZh: '✅ 健康+25（最强治疗）| ✅ 清除生病状态，减少下季度AP惩罚 | ⚠️ 花费$3,000',
    precondition: (s) => (s.flags.gotSick as boolean) || (s.flags.sicknessApPenalty as number) > 0 || s.attributes.health < 50,
  },
  travel: {
    id: 'travel', nameZh: '旅游度假', apCost: 3, phase: 'any',
    effects: { health: 20, mental: 25 }, description: 'Travel for recovery ($2K-5K, visa risk on H1B)',
    tipsZh: '✅ 健康+20，精神+25（最强恢复）| ⚠️ 花费$2K-5K | ⚠️ H-1B出境有5%签证被拒风险 | ✅ Combo卡/绿卡后无风险',
    exclusive: ['prepJobChange'],
  },
  exercise: {
    id: 'exercise', nameZh: '锻炼身体', apCost: 1, phase: 'any',
    effects: { health: 5, mental: 3 }, description: 'Regular exercise routine',
    tipsZh: '✅ 健康+5，精神+3 | ✅ 只花1AP，可以和其他行动叠加 | 💡 每季度坚持效果积累',
  },
  therapist: {
    id: 'therapist', nameZh: '心理咨询', apCost: 2, phase: 'any',
    effects: { mental: 12 }, description: 'See a therapist ($800/quarter)',
    tipsZh: '✅ 精神+12（最强精神恢复）| ⚠️ 花费$800 | 💡 精神低于40%时强烈建议',
  },

  // Academic phase actions
  studySlack: {
    id: 'studySlack', nameZh: '摸鱼学习', apCost: 1, phase: 'academic',
    effects: { skills: 1 }, description: 'Minimal study effort',
    tipsZh: '✅ GPA+0.05 | ✅ 技能+1 | 💡 省AP但GPA涨得慢',
    exclusive: ['studyNormal', 'studyHard'],
  },
  studyNormal: {
    id: 'studyNormal', nameZh: '正常学习', apCost: 2, phase: 'academic',
    effects: { skills: 3 }, description: 'Regular study effort',
    tipsZh: '✅ GPA+0.15 | ✅ 技能+3 | 💡 稳步提升',
    exclusive: ['studySlack', 'studyHard'],
  },
  studyHard: {
    id: 'studyHard', nameZh: '努力学习', apCost: 3, phase: 'academic',
    effects: { skills: 5, mental: -2 }, description: 'Intensive study',
    tipsZh: '✅ GPA+0.30 | ✅ 技能+5 | ⚠️ 精神-2 | 💡 快速刷GPA',
    exclusive: ['studySlack', 'studyNormal'],
  },
  studyGpa: {
    id: 'studyGpa', nameZh: '刷GPA', apCost: 3, phase: 'academic',
    effects: {}, description: 'Extra GPA study session (+0.1)',
    tipsZh: '✅ 额外GPA+0.1 | 💡 可以和学习行动叠加',
  },
  searchIntern: {
    id: 'searchIntern', nameZh: '找实习', apCost: 3, phase: 'academic',
    effects: {}, description: 'Search for internship opportunities',
    tipsZh: '✅ 搜索实习（立即判定成功/失败）| ✅ 有实习→找工作概率+25% | ✅ 已有实习可以再找更好的 | 💡 第二年开始可用',
    precondition: (s) => {
      const gradTurn = s.academic.isPhd ? 16 : 8;
      // Available from turn 3 until second-to-last quarter (last quarter is for full-time job search)
      return s.turn >= 2 && s.turn < gradTurn - 1 && !s.flags.internActiveThisQuarter;
    },
  },
  searchFullTimeJob: {
    id: 'searchFullTimeJob', nameZh: '找全职工作', apCost: 4, phase: 'academic',
    effects: { mental: -5 }, description: 'Search for full-time job before graduation',
    tipsZh: '✅ 毕业前找全职 | ✅ 概率受实习经历/学校/GPA影响 | ⚠️ 精神-5 | 💡 毕业前最后机会',
    precondition: (s) => {
      const gradTurn = s.academic.isPhd ? 16 : 8;
      return s.turn === gradTurn - 1;
    },
  },
  thesisResearch: {
    id: 'thesisResearch', nameZh: '论文研究', apCost: 4, phase: 'academic',
    effects: { academicImpact: 8 }, description: 'PhD thesis research',
    tipsZh: '✅ 学术+8，40%概率发论文额外+5 | ✅ 推进毕业进度 | ⚠️ 博士至少需要5次论文研究才能毕业',
    precondition: (s) => s.academic.isPhd && s.turn >= 8,
  },
  taRaWork: {
    id: 'taRaWork', nameZh: 'TA/RA工作', apCost: 2, phase: 'academic',
    effects: { skills: 2 }, description: 'Teaching/research assistantship ($7K/quarter)',
    tipsZh: '✅ 技能+2，赚$7,000/季度 | ✅ 博士补贴减少学贷 | 💡 博士专属',
    precondition: (s) => s.academic.isPhd,
  },
  internWork: {
    id: 'internWork', nameZh: '实习努力表现', apCost: 3, phase: 'academic',
    effects: { skills: 5 }, description: 'Work hard at internship for return offer',
    tipsZh: '✅ 技能+5 | ✅ 大幅提高拿return offer概率（base 40%→70%）| ⚠️ 仅实习期间可用',
    precondition: (s) => s.flags.internActiveThisQuarter as boolean,
  },
  networking: {
    id: 'networking', nameZh: '社交/招聘会', apCost: 2, phase: 'academic',
    effects: { skills: 3 }, description: 'Network at career fairs (+5% to next search)',
    tipsZh: '✅ 技能+3，下次找实习/工作+5% | 💡 多参加几次效果累计',
  },
  sideProject: {
    id: 'sideProject', nameZh: '做Side Project', apCost: 3, phase: 'academic',
    effects: { skills: 6, academicImpact: 2 }, description: 'Build a side project',
    tipsZh: '✅ 技能+6，学术+2 | ✅ 提升简历竞争力 | 💡 适合有余力的时候做',
  },
};

export function getAvailableActions(state: GameState): ActionDef[] {
  const isSick = (state.flags.sicknessApPenalty as number) > 0 || state.flags.burnoutActive || state.attributes.health <= 0;

  return Object.values(ACTIONS).filter((action) => {
    if (action.phase !== 'any' && action.phase !== state.phase) return false;
    if (action.precondition && !action.precondition(state)) return false;
    return true;
  }).map((action) => {
    // Rest and hospital are free when sick/burnout
    if (isSick && (action.id === 'rest' || action.id === 'hospital' || action.id === 'exercise')) {
      return { ...action, apCost: 0, tipsZh: (action.tipsZh || '') + ' | 🏥 生病期间免费' };
    }
    return action;
  });
}

export function canSelectAction(
  action: ActionDef,
  selectedActions: ActionId[],
  remainingAp: number
): { allowed: boolean; reason?: string } {
  if (action.apCost > remainingAp) return { allowed: false, reason: '行动点不足' };
  if (selectedActions.includes(action.id)) return { allowed: false, reason: '已选择' };
  if (action.id !== 'exercise' && selectedActions.includes(action.id)) {
    return { allowed: false, reason: '每季度只能选一次' };
  }
  if (action.exclusive) {
    for (const excl of action.exclusive) {
      if (selectedActions.includes(excl as ActionId)) {
        return { allowed: false, reason: `与${ACTIONS[excl as ActionId]?.nameZh}冲突` };
      }
    }
  }
  return { allowed: true };
}
