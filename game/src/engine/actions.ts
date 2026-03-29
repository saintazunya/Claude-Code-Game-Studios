// Action definitions — all available player actions with AP costs and effects

import type { ActionDef, ActionId, GameState } from './types';

export const ACTIONS: Record<ActionId, ActionDef> = {
  // Career actions
  upskill: {
    id: 'upskill', nameZh: '技能进修', apCost: 2, phase: 'career',
    effects: { skills: 8 }, description: 'Study and improve technical skills',
  },
  prepJobChange: {
    id: 'prepJobChange', nameZh: '准备跳槽', apCost: 3, phase: 'career',
    effects: {}, description: 'Prepare for job change: leetcode + interviews',
    precondition: (s) => s.career.employed === 'employed' && !s.career.onPip,
    exclusive: ['travel'],
  },
  prepJobChangeIntensive: {
    id: 'prepJobChangeIntensive', nameZh: '全力求职', apCost: 5, phase: 'career',
    effects: {}, description: 'Intensive job search this quarter',
    precondition: (s) => s.career.employed === 'employed' && !s.career.onPip,
    exclusive: ['travel', 'prepJobChange'],
  },
  entrepreneurship: {
    id: 'entrepreneurship', nameZh: '创业调研', apCost: 4, phase: 'career',
    effects: { skills: 3 }, description: 'Research startup opportunities',
    precondition: (s) => s.attributes.netWorth > 50000,
  },
  urgentJobSearch: {
    id: 'urgentJobSearch', nameZh: '紧急求职', apCost: 5, phase: 'career',
    effects: { mental: -10 }, description: 'Desperate job search after layoff',
    precondition: (s) => s.career.employed === 'unemployed',
  },

  // Immigration actions
  prepH1b: {
    id: 'prepH1b', nameZh: '准备H-1B材料', apCost: 3, phase: 'career',
    effects: {}, description: 'Prepare H1B filing for Q2 lottery',
    precondition: (s) => ['opt', 'optStem'].includes(s.immigration.visaType) && !s.immigration.h1bFiled,
    exclusive: ['researchNiw'],
  },
  researchNiw: {
    id: 'researchNiw', nameZh: '研究NIW/EB1A', apCost: 3, phase: 'career',
    effects: { academicImpact: 5 }, description: 'Work toward self-petition immigration route',
    exclusive: ['prepH1b'],
  },
  publishPaper: {
    id: 'publishPaper', nameZh: '发论文（副业）', apCost: 4, phase: 'career',
    effects: { academicImpact: 10 }, description: 'Write and publish a paper as side project',
    precondition: (s) => s.career.path !== 'rs', // RS gets this for free through work
  },
  consultLawyer: {
    id: 'consultLawyer', nameZh: '咨询移民律师', apCost: 2, phase: 'career',
    effects: {}, description: 'Get expert immigration advice ($500)',
  },

  // Health & wellness
  rest: {
    id: 'rest', nameZh: '休息调整', apCost: 2, phase: 'any',
    effects: { health: 10, mental: 8 }, description: 'Rest and recover',
  },
  travel: {
    id: 'travel', nameZh: '旅游度假', apCost: 3, phase: 'any',
    effects: { health: 20, mental: 25 }, description: 'Travel for recovery ($2K-5K, visa risk on H1B)',
    exclusive: ['prepJobChange', 'prepJobChangeIntensive'],
  },
  exercise: {
    id: 'exercise', nameZh: '锻炼身体', apCost: 1, phase: 'any',
    effects: { health: 5, mental: 3 }, description: 'Regular exercise routine',
  },
  therapist: {
    id: 'therapist', nameZh: '心理咨询', apCost: 2, phase: 'any',
    effects: { mental: 12 }, description: 'See a therapist ($800/quarter)',
  },

  // Academic phase actions
  studyGpa: {
    id: 'studyGpa', nameZh: '刷GPA', apCost: 3, phase: 'academic',
    effects: {}, description: 'Study to improve GPA (+0.2)',
  },
  searchIntern: {
    id: 'searchIntern', nameZh: '找实习', apCost: 3, phase: 'academic',
    effects: {}, description: 'Search for internship opportunities',
    precondition: (s) => {
      const q = (s.turn % 4) + 1;
      return s.turn >= 2 && s.turn <= 7; // turns 3-7 (intern season)
    },
  },
  thesisResearch: {
    id: 'thesisResearch', nameZh: '论文研究', apCost: 4, phase: 'academic',
    effects: { academicImpact: 8 }, description: 'PhD thesis research',
    precondition: (s) => s.academic.isPhd && s.turn >= 8,
  },
  taRaWork: {
    id: 'taRaWork', nameZh: 'TA/RA工作', apCost: 2, phase: 'academic',
    effects: { skills: 2 }, description: 'Teaching/research assistantship ($7K/quarter)',
    precondition: (s) => s.academic.isPhd,
  },
  networking: {
    id: 'networking', nameZh: '社交/招聘会', apCost: 2, phase: 'academic',
    effects: { skills: 3 }, description: 'Network at career fairs (+5% to next search)',
  },
  sideProject: {
    id: 'sideProject', nameZh: '做Side Project', apCost: 3, phase: 'academic',
    effects: { skills: 6, academicImpact: 2 }, description: 'Build a side project',
  },
};

export function getAvailableActions(state: GameState): ActionDef[] {
  return Object.values(ACTIONS).filter((action) => {
    // Phase check
    if (action.phase !== 'any' && action.phase !== state.phase) return false;
    // Precondition check
    if (action.precondition && !action.precondition(state)) return false;
    return true;
  });
}

export function canSelectAction(
  action: ActionDef,
  selectedActions: ActionId[],
  remainingAp: number
): { allowed: boolean; reason?: string } {
  // AP check
  if (action.apCost > remainingAp) return { allowed: false, reason: '行动点不足' };
  // Already selected
  if (selectedActions.includes(action.id)) return { allowed: false, reason: '已选择' };
  // No duplicate actions (except exercise)
  if (action.id !== 'exercise' && selectedActions.includes(action.id)) {
    return { allowed: false, reason: '每季度只能选一次' };
  }
  // Mutual exclusion
  if (action.exclusive) {
    for (const excl of action.exclusive) {
      if (selectedActions.includes(excl as ActionId)) {
        return { allowed: false, reason: `与${ACTIONS[excl as ActionId]?.nameZh}冲突` };
      }
    }
  }
  return { allowed: true };
}
