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
    effects: { performance: -3, mental: 2 }, description: 'Slack off at work',
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
    id: 'prepJobChange', nameZh: '准备跳槽', apCost: 3, phase: 'career',
    effects: {}, description: 'Prepare for job change: leetcode + interviews',
    tipsZh: '✅ 每季度准备+10%拿offer概率 | ⚠️ 占3AP，工作可能只能躺平 | ⚠️ 跳槽会重置PERM（I-140前）',
    precondition: (s) => s.career.employed === 'employed' && !s.career.onPip,
    exclusive: ['travel', 'prepJobChangeIntensive'],
  },
  prepJobChangeIntensive: {
    id: 'prepJobChangeIntensive', nameZh: '全力求职', apCost: 5, phase: 'career',
    effects: {}, description: 'Intensive job search this quarter',
    tipsZh: '✅ 本季度+20%拿offer概率 | ⚠️ 占5AP，几乎没时间干别的 | ⚠️ 适合急需跳槽的情况',
    precondition: (s) => s.career.employed === 'employed' && !s.career.onPip,
    exclusive: ['travel', 'prepJobChange'],
  },
  entrepreneurship: {
    id: 'entrepreneurship', nameZh: '创业调研', apCost: 4, phase: 'career',
    effects: { skills: 3 }, description: 'Research startup opportunities',
    tipsZh: '✅ 技能+3，推进创业准备 | ⚠️ 需要净资产>$50K | ⚠️ 高风险高回报路线',
    precondition: (s) => s.attributes.netWorth > 50000,
  },
  urgentJobSearch: {
    id: 'urgentJobSearch', nameZh: '紧急求职', apCost: 5, phase: 'career',
    effects: { mental: -10 }, description: 'Desperate job search after layoff',
    tipsZh: '✅ +25%拿offer概率（紧急模式）| ⚠️ 精神-10 | ⚠️ 失业状态专用',
    precondition: (s) => s.career.employed === 'unemployed',
  },

  // Immigration actions
  prepH1b: {
    id: 'prepH1b', nameZh: '准备H-1B材料', apCost: 3, phase: 'career',
    effects: {}, description: 'Prepare H1B filing for Q2 lottery',
    tipsZh: '✅ 下个Q2参加H-1B抽签（硕士35%/本科27%）| ⚠️ 抽签是纯运气，准备只是入场券 | ⚠️ 需要在OPT期间提交',
    precondition: (s) => ['opt', 'optStem'].includes(s.immigration.visaType) && !s.immigration.h1bFiled,
    exclusive: ['researchNiw'],
  },
  researchNiw: {
    id: 'researchNiw', nameZh: '研究NIW/EB1A', apCost: 3, phase: 'career',
    effects: { academicImpact: 5 }, description: 'Work toward self-petition immigration route',
    tipsZh: '✅ 学术+5，推进自主绿卡 | ✅ 不绑雇主，自由度高 | ⚠️ 需要学术影响力>50(NIW)或>75(EB1A) | ⚠️ 和H-1B准备互斥',
    exclusive: ['prepH1b'],
  },
  publishPaper: {
    id: 'publishPaper', nameZh: '发论文（副业）', apCost: 4, phase: 'career',
    effects: { academicImpact: 10 }, description: 'Write and publish a paper as side project',
    tipsZh: '✅ 学术+10，大幅推进NIW/EB1A | ⚠️ 占4AP，代价很高 | ⚠️ RS职业自带论文产出，不需要这个',
    precondition: (s) => s.career.path !== 'rs',
  },
  consultLawyer: {
    id: 'consultLawyer', nameZh: '咨询移民律师', apCost: 2, phase: 'career',
    effects: {}, description: 'Get expert immigration advice ($500)',
    tipsZh: '✅ 了解当前最优移民路径 | ⚠️ 花费$500 | 💡 对复杂身份情况有帮助',
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
    precondition: (s) => (s.flags.gotSick as boolean) || s.attributes.health < 50,
  },
  travel: {
    id: 'travel', nameZh: '旅游度假', apCost: 3, phase: 'any',
    effects: { health: 20, mental: 25 }, description: 'Travel for recovery ($2K-5K, visa risk on H1B)',
    tipsZh: '✅ 健康+20，精神+25（最强恢复）| ⚠️ 花费$2K-5K | ⚠️ H-1B出境有5%签证被拒风险 | ✅ Combo卡/绿卡后无风险',
    exclusive: ['prepJobChange', 'prepJobChangeIntensive'],
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
    tipsZh: '✅ 搜索实习（立即判定成功/失败）| ✅ 有实习→找工作概率+25% | ⚠️ 没实习→找工作概率大幅下降 | 💡 Q3-Q4是实习季',
    precondition: (s) => {
      return s.turn >= 2 && s.turn <= 7 && !s.academic.hadIntern;
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
