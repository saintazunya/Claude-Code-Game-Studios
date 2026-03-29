// Auto-play: greedy rule-based action selection for each turn

import type { GameState, WorkMode, AcademicStudyMode, ActionId } from './types';
import { getEffectiveAp, getWorkModeCost } from './game-state';
import { getAvailableActions, canSelectAction } from './actions';
import { preview } from './probability';

export interface AutoPlayResult {
  workMode: WorkMode | AcademicStudyMode;
  actions: ActionId[];
  reasoning: string[];
}

export function autoSelectTurn(state: GameState): AutoPlayResult {
  const reasoning: string[] = [];
  const isAcademic = state.phase === 'academic';

  // === WORK MODE SELECTION ===
  let workMode: WorkMode | AcademicStudyMode;
  const grindLocked = state.grindLockQuarters > 0;

  if (isAcademic) {
    if (state.attributes.health > 70 && state.attributes.mental > 50 && !grindLocked) {
      workMode = 'intense';
      reasoning.push('拼命模式：健康精神充足，多拿AP');
    } else if (state.attributes.mental < 30 || state.attributes.health < 40) {
      workMode = 'light';
      reasoning.push('轻松模式：身体或精神状态差，需要恢复');
    } else {
      workMode = 'normal';
      reasoning.push('正常模式：平衡学习');
    }
  } else {
    // Career phase
    if (state.career.onPip) {
      // PIP: must grind to survive
      if (!grindLocked && state.attributes.health > 40) {
        workMode = 'grind';
        reasoning.push('卷王模式：PIP中必须全力提升绩效');
      } else {
        workMode = 'normal';
        reasoning.push('正常模式：PIP中但健康不允许卷');
      }
    } else if (state.attributes.performance < 30 && state.attributes.health > 50 && !grindLocked) {
      workMode = 'grind';
      reasoning.push('卷王模式：绩效太低有PIP风险');
    } else if (state.attributes.health > 75 && state.attributes.mental > 55 && !grindLocked && state.attributes.performance < 70) {
      workMode = 'grind';
      reasoning.push('卷王模式：身体精神好，冲绩效');
    } else if (state.attributes.mental < 30 || state.attributes.health < 35) {
      workMode = 'coast';
      reasoning.push('躺平模式：需要恢复身体/精神');
    } else {
      workMode = 'normal';
      reasoning.push('正常模式：稳健工作');
    }
  }

  // === ACTION SELECTION ===
  let remainingAp = getEffectiveAp(state, workMode) - getWorkModeCost(workMode);
  const available = getAvailableActions(state);
  const selected: ActionId[] = [];

  function trySelect(id: ActionId, reason: string): boolean {
    const action = available.find(a => a.id === id);
    if (!action) return false;
    const check = canSelectAction(action, selected, remainingAp);
    if (!check.allowed) return false;
    selected.push(id);
    remainingAp -= action.apCost;
    reasoning.push(`${action.nameZh}：${reason}`);
    return true;
  }

  // Priority 1: SURVIVAL — immigration critical actions
  if (isAcademic) {
    // Intern search (if don't have one and in season)
    if (!state.academic.hadIntern) {
      trySelect('searchIntern', '还没有实习，必须尽快找到');
    }
    // Intern work (if active)
    if (state.flags.internActiveThisQuarter) {
      trySelect('internWork', '实习期间努力表现，争取return offer');
    }
  } else {
    // H1B filing (critical for OPT holders)
    if (['opt', 'optStem'].includes(state.immigration.visaType) && !state.immigration.h1bFiled) {
      trySelect('prepH1b', 'OPT身份必须准备H1B抽签');
    }
    // Urgent job search if unemployed
    if (state.career.employed === 'unemployed') {
      trySelect('urgentJobSearch', '失业中，紧急找工作');
    }
  }

  // Priority 2: HEALTH EMERGENCY
  if (state.attributes.health < 30) {
    trySelect('hospital', '健康危险，必须就医');
    trySelect('rest', '健康低，需要休息');
  } else if (state.attributes.health < 50) {
    trySelect('rest', '健康偏低，休息恢复');
  }

  // Priority 3: MENTAL EMERGENCY
  if (state.attributes.mental < 25) {
    trySelect('therapist', '精神状态危险，看心理医生');
    if (!selected.includes('rest')) trySelect('rest', '精神低，休息恢复');
  } else if (state.attributes.mental < 40) {
    trySelect('therapist', '精神压力大，心理咨询');
  }

  // Priority 4: CAREER DEVELOPMENT
  if (!isAcademic && state.career.employed === 'employed') {
    // If performance is low and not already grinding
    if (state.attributes.performance < 40 && !selected.includes('rest')) {
      trySelect('upskill', '技能偏低，进修提升');
    }

    // NIW/EB1A research if academic impact is building
    if (state.attributes.academicImpact > 30 && state.immigration.permStatus === 'none') {
      trySelect('researchNiw', '学术积累足够，研究自主绿卡路线');
    }

    // Job change prep if conditions are right
    if (state.career.tenure > 8 && state.immigration.i140Status === 'approved' && state.attributes.skills > 50) {
      trySelect('prepJobChange', 'I-140已批准，可以安全跳槽涨薪');
    }
  }

  // Priority 5: ACADEMIC
  if (isAcademic) {
    if (state.academic.gpa < 3.3) {
      trySelect('studyGpa', 'GPA偏低，刷分');
    }
    trySelect('networking', '参加招聘会，积累人脉');
    if (state.academic.isPhd && state.turn >= 8) {
      trySelect('thesisResearch', '博士论文研究');
    }
    trySelect('sideProject', '做Side Project提升简历');
  }

  // Priority 6: SKILL BUILDING (fill remaining AP)
  trySelect('upskill', '技能进修');
  trySelect('exercise', '锻炼身体');

  // Priority 7: WEALTH BUILDING
  if (!isAcademic && state.attributes.netWorth > 50000) {
    trySelect('entrepreneurship', '探索创业机会');
  }

  // Priority 8: WELLNESS (if still have AP)
  if (state.attributes.health < 70) {
    trySelect('exercise', '保持锻炼');
  }
  if (state.attributes.mental < 55 && !selected.includes('therapist')) {
    trySelect('therapist', '精神保养');
  }

  // If travel is safe and health/mental need it
  if (state.attributes.health < 60 && state.attributes.mental < 50 &&
      (state.immigration.hasComboCard || state.immigration.hasGreenCard)) {
    trySelect('travel', '有Combo卡/绿卡，旅游安全且恢复大');
  }

  return { workMode, actions: selected, reasoning };
}
