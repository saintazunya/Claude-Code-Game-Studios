// Event System — event pool, selection, and resolution

import type { GameState, GameEvent, CoreAttributes } from './types';
import { rollEventCount } from './economic-cycle';

function weightedPick<T>(options: { value: T; weight: number }[]): T {
  const total = options.reduce((s, o) => s + o.weight, 0);
  if (total === 0) return options[0]?.value;
  let r = Math.random() * total;
  for (const o of options) {
    r -= o.weight;
    if (r <= 0) return o.value;
  }
  return options[options.length - 1].value;
}

// MVP Event pool — 15 core events for initial playability
export const EVENT_POOL: GameEvent[] = [
  // CRISIS
  {
    id: 'layoff_wave', type: 'crisis', nameZh: '公司大裁员', phase: 'career',
    descZh: '你的公司宣布裁员15%。作为签证持有者，你面临着失去工作和身份的双重危机。',
    weight: 1.0,
    weightModifiers: [{ condition: (s) => s.economicPhase === 'recession', multiplier: 3.0 }],
    cooldownQuarters: 6, oneTime: false,
    precondition: (s) => s.career.employed === 'employed',
    immediateEffects: { mental: -15 },
    choices: [
      { id: 'panic', textKey: '', nameZh: '海投求职', descZh: '花2个季度全力找工作，可能降薪。', tag: 'stable', effects: { mental: -5 }, flags: { urgentJobSearch: true } },
      { id: 'selective', textKey: '', nameZh: '精准投递大厂', descZh: '只投头部公司，薪资更高但40%概率来不及。', tag: 'risky', effects: {}, probabilityRoll: 'jobOffer' },
      { id: 'cpt', textKey: '', nameZh: '挂靠学校 (Day-1 CPT)', descZh: '花$15,000/年学费，转F1保身份。', tag: 'desperate', effects: { mental: -10 }, flags: { cptFallback: true } },
    ],
  },
  {
    id: 'market_crash', type: 'economic', nameZh: '股市暴跌', phase: 'any',
    descZh: '市场突然暴跌，你的S&P 500投资组合一夜之间缩水了20%。',
    weight: 0.8,
    weightModifiers: [{ condition: (s) => s.economicPhase === 'recession', multiplier: 2.0 }],
    cooldownQuarters: 8, oneTime: false,
    immediateEffects: { mental: -10 },
    choices: [
      { id: 'hold', textKey: '', nameZh: '坚持持有', descZh: '长期来看市场会恢复。忍住不卖。', tag: 'stable', effects: { mental: 5 } },
      { id: 'sell', textKey: '', nameZh: '恐慌抛售', descZh: '卖掉所有股票，锁定亏损但保住现金。', tag: 'risky', effects: {}, flags: { panicSell: true } },
      { id: 'buy_dip', textKey: '', nameZh: '抄底加仓', descZh: '别人恐惧我贪婪。投入更多资金。', tag: 'risky', effects: {}, flags: { buyDip: true } },
    ],
  },
  {
    id: 'pip_warning', type: 'career', nameZh: '收到PIP警告', phase: 'career',
    descZh: '你的经理通知你：你被放入绩效改进计划(PIP)。你有2个季度来证明自己。',
    weight: 0, // triggered by PIP system, not random pool
    cooldownQuarters: 8, oneTime: false,
    precondition: () => false, // manual trigger only
    immediateEffects: { mental: -20 },
    choices: [
      { id: 'grind_recover', textKey: '', nameZh: '拼命卷绩效', descZh: '全力投入工作，争取翻盘。', tag: 'risky', effects: { performance: 10 } },
      { id: 'accept', textKey: '', nameZh: '接受现实', descZh: '开始准备后路。精神打击较小。', tag: 'neutral', effects: { mental: 5 } },
    ],
  },
  // OPPORTUNITY
  {
    id: 'recruiter_call', type: 'opportunity', nameZh: '猎头来电', phase: 'career',
    descZh: '一个猎头联系你，说有一个大厂的机会，薪资比你现在高30%以上。',
    weight: 1.5,
    weightModifiers: [
      { condition: (s) => s.economicPhase === 'boom', multiplier: 2.0 },
      { condition: (s) => s.attributes.skills > 50, multiplier: 1.5 },
    ],
    cooldownQuarters: 4, oneTime: false,
    precondition: (s) => s.career.employed === 'employed' && !s.career.onPip,
    immediateEffects: {},
    choices: [
      { id: 'explore', textKey: '', nameZh: '了解一下', descZh: '开始面试流程，不占用行动点。', tag: 'neutral', effects: {}, flags: { recruiterOffer: true } },
      { id: 'negotiate', textKey: '', nameZh: '用来谈加薪', descZh: '50%概率现雇主加薪10-15%。', tag: 'risky', effects: {}, probabilityRoll: 'jobOffer' },
      { id: 'decline', textKey: '', nameZh: '婉拒', descZh: '现在不是跳槽的好时机。', tag: 'stable', effects: {} },
    ],
  },
  {
    id: 'conference_invite', type: 'opportunity', nameZh: '受邀参加技术大会', phase: 'career',
    descZh: '你收到了一个知名技术大会的演讲邀请。这是提升影响力的好机会。',
    weight: 0.8,
    precondition: (s) => s.attributes.skills > 40 || s.attributes.academicImpact > 20,
    cooldownQuarters: 6, oneTime: false,
    immediateEffects: {},
    choices: [
      { id: 'attend_speak', textKey: '', nameZh: '出席并演讲', descZh: '花$1,500，学术影响力+5，技能+3。', tag: 'costly', effects: { academicImpact: 5, skills: 3 } },
      { id: 'attend_only', textKey: '', nameZh: '只去旁听', descZh: '花$1,000，技能+2。', tag: 'neutral', effects: { skills: 2 } },
      { id: 'decline_conf', textKey: '', nameZh: '太忙了，下次吧', descZh: '不花时间不花钱。', tag: 'stable', effects: {} },
    ],
  },
  {
    id: 'priority_date_jump', type: 'immigration', nameZh: '排期大幅前进', phase: 'career',
    descZh: '签证公告牌显示你的类别排期突然大幅前进了6个月！',
    weight: 0.6,
    precondition: (s) => s.immigration.i140Status === 'approved' && s.immigration.i485Status === 'none',
    cooldownQuarters: 8, oneTime: false,
    immediateEffects: { mental: 10 },
    choices: [
      { id: 'celebrate', textKey: '', nameZh: '太好了！', descZh: '心情大好，继续等待。', tag: 'stable', effects: { mental: 5 } },
    ],
  },
  // CAREER
  {
    id: 'team_reorg', type: 'career', nameZh: '团队重组', phase: 'career',
    descZh: '公司宣布组织架构调整，你的团队被合并了。你将迎来一个新老板。',
    weight: 1.5,
    precondition: (s) => s.career.employed === 'employed' && s.career.tenure > 4,
    cooldownQuarters: 6, oneTime: false,
    immediateEffects: { mental: -5 },
    choices: [
      { id: 'adapt', textKey: '', nameZh: '适应变化', descZh: '接受新领导，重新开始。', tag: 'stable', effects: {}, flags: { newBoss: true } },
      { id: 'transfer', textKey: '', nameZh: '申请转组', descZh: '60%概率去更好的团队。', tag: 'risky', effects: {}, probabilityRoll: 'jobOffer', flags: { internalTransfer: true } },
    ],
  },
  {
    id: 'performance_bonus', type: 'career', nameZh: '绩效奖金', phase: 'career',
    descZh: '年度评估结果出来了，你获得了一笔丰厚的绩效奖金！',
    weight: 1.0,
    precondition: (s) => s.attributes.performance > 70 && ((s.turn % 4) === 0),
    cooldownQuarters: 4, oneTime: false,
    immediateEffects: { mental: 5 },
    choices: [
      { id: 'save', textKey: '', nameZh: '存起来', descZh: '加到存款里。', tag: 'stable', effects: {}, flags: { bonusSave: true } },
      { id: 'invest', textKey: '', nameZh: '全部投资', descZh: '买入S&P 500。', tag: 'neutral', effects: {}, flags: { bonusInvest: true } },
      { id: 'treat', textKey: '', nameZh: '犒劳自己', descZh: '花掉一半，精神+10。', tag: 'costly', effects: { mental: 10 } },
    ],
  },
  {
    id: 'toxic_incident', type: 'career', nameZh: '职场冲突', phase: 'career',
    descZh: '你的老板在会议上当众批评了你的方案，让你非常难堪。',
    weight: 1.2,
    precondition: (s) => s.career.bossType === 'demanding' || s.career.bossType === 'toxic',
    cooldownQuarters: 4, oneTime: false,
    immediateEffects: { mental: -10 },
    choices: [
      { id: 'report_hr', textKey: '', nameZh: '向HR投诉', descZh: '30%换老板，30%被报复，40%没变化。', tag: 'risky', effects: {}, flags: { reportedHr: true } },
      { id: 'endure', textKey: '', nameZh: '默默忍受', descZh: '精神持续消耗但不惹事。', tag: 'stable', effects: { mental: -3 } },
      { id: 'start_search', textKey: '', nameZh: '开始找下家', descZh: '忍无可忍，不如跳槽。', tag: 'neutral', effects: {}, flags: { startJobSearch: true } },
    ],
  },
  // LIFE
  {
    id: 'holiday_loneliness', type: 'life', nameZh: '节日里的孤独', phase: 'career',
    descZh: '感恩节和圣诞节，朋友们都回家团聚了，而你一个人对着空荡荡的房间。',
    weight: 1.5,
    precondition: (s) => ((s.turn % 4) + 1) === 4, // Q4 only
    cooldownQuarters: 4, oneTime: false,
    immediateEffects: { mental: -8 },
    choices: [
      { id: 'video_call', textKey: '', nameZh: '视频连线家人', descZh: '隔着屏幕，但聊胜于无。', tag: 'stable', effects: { mental: 5 } },
      { id: 'gathering', textKey: '', nameZh: '和移民朋友聚会', descZh: '花$500，一起吃顿火锅。', tag: 'neutral', effects: { mental: 8 } },
      { id: 'work_through', textKey: '', nameZh: '加班度过', descZh: '绩效+3但精神更差。', tag: 'risky', effects: { performance: 3, mental: -3 } },
    ],
  },
  {
    id: 'cultural_friction', type: 'life', nameZh: '文化冲突', phase: 'any',
    descZh: '在一次团队讨论中，你的意见被忽视了。你不确定是文化差异还是偏见。',
    weight: 1.0,
    cooldownQuarters: 6, oneTime: false,
    immediateEffects: { mental: -5 },
    choices: [
      { id: 'reflect', textKey: '', nameZh: '反思并适应', descZh: '下次改变沟通方式。技能+1。', tag: 'stable', effects: { mental: 3, skills: 1 } },
      { id: 'vent', textKey: '', nameZh: '和朋友吐槽', descZh: '情绪释放一下。', tag: 'neutral', effects: { mental: 3 } },
      { id: 'withdraw', textKey: '', nameZh: '封闭自己', descZh: '减少社交，专注工作。', tag: 'risky', effects: { mental: -3, performance: 2 } },
    ],
  },
  {
    id: 'family_emergency', type: 'life', nameZh: '家人生病', phase: 'career',
    descZh: '国内的父母突然生病住院了。你心急如焚，但签证身份让回国变得复杂。',
    weight: 0.5,
    cooldownQuarters: 12, oneTime: false,
    immediateEffects: { mental: -15 },
    choices: [
      { id: 'send_money', textKey: '', nameZh: '汇钱回去', descZh: '花$15,000，精神稍缓。', tag: 'costly', effects: { mental: 5 }, flags: { familyExpense: 15000 } },
      { id: 'fly_home', textKey: '', nameZh: '请假回国', descZh: 'H1B有签证被拒风险。花$3,000+机票。', tag: 'risky', effects: { mental: 10, health: 5 }, flags: { travelHome: true } },
      { id: 'stay_guilty', textKey: '', nameZh: '留下来，内心愧疚', descZh: '什么都做不了的无力感。', tag: 'stable', effects: { mental: -5 } },
    ],
  },
  {
    id: 'community_support', type: 'life', nameZh: '找到了组织', phase: 'any',
    descZh: '你发现了一个当地的华人互助社群，大家分享经验、互相支持。',
    weight: 1.0,
    cooldownQuarters: 8, oneTime: true,
    immediateEffects: { mental: 5 },
    choices: [
      { id: 'join', textKey: '', nameZh: '积极参与', descZh: '每季度花1AP，但精神+5持续3季度。', tag: 'stable', effects: { mental: 5 }, flags: { communityActive: 3 } },
      { id: 'appreciate', textKey: '', nameZh: '偶尔参加', descZh: '不额外花时间。', tag: 'neutral', effects: { mental: 3 } },
    ],
  },
  {
    id: 'identity_crisis', type: 'life', nameZh: '身份认同危机', phase: 'career',
    descZh: '半夜醒来，你问自己："来美国这些年，值得吗？我还是当初那个人吗？"',
    weight: 0.8,
    precondition: (s) => {
      const age = 22 + Math.floor((s.turn - 1) / 4);
      return age > 30 && s.attributes.mental < 50;
    },
    cooldownQuarters: 20, oneTime: true,
    immediateEffects: { mental: -10 },
    choices: [
      { id: 'recommit', textKey: '', nameZh: '重新坚定信念', descZh: '想清楚了为什么来这里。精神+5，绩效+5。', tag: 'stable', effects: { mental: 5, performance: 5 } },
      { id: 'question', textKey: '', nameZh: '深入思考', descZh: '精神>30则顿悟(+10)，否则更迷茫(-10)。', tag: 'risky', effects: {} },
      { id: 'call_home', textKey: '', nameZh: '打电话回家', descZh: '和家人聊了很久。精神+8。', tag: 'neutral', effects: { mental: 8 } },
    ],
  },
  // IMMIGRATION
  {
    id: 'immigration_policy_change', type: 'immigration', nameZh: '移民政策变动', phase: 'any',
    descZh: '新的移民政策法案通过，将影响签证和绿卡处理。',
    weight: 0.5,
    cooldownQuarters: 8, oneTime: false,
    immediateEffects: {},
    choices: [
      { id: 'accept_policy', textKey: '', nameZh: '关注并适应', descZh: '了解新政策对你的影响。', tag: 'stable', effects: { mental: -3 } },
    ],
  },
];

export function selectEvents(state: GameState): GameEvent[] {
  const count = rollEventCount();
  if (count === 0) return [];

  const eligible = EVENT_POOL.filter((event) => {
    // Phase check
    if (event.phase !== 'any' && event.phase !== state.phase) return false;
    // Precondition
    if (event.precondition && !event.precondition(state)) return false;
    // Cooldown
    const lastFired = state.eventCooldowns[event.id] || 0;
    if (state.turn - lastFired < event.cooldownQuarters) return false;
    // One-time
    if (event.oneTime && state.eventFired.has(event.id)) return false;
    // Skip manually-triggered events (weight 0)
    if (event.weight <= 0) return false;
    return true;
  });

  if (eligible.length === 0) return [];

  const selected: GameEvent[] = [];
  const used = new Set<string>();

  for (let i = 0; i < count && eligible.length > 0; i++) {
    const weighted = eligible
      .filter((e) => !used.has(e.id))
      .map((event) => {
        let w = event.weight;
        if (event.weightModifiers) {
          for (const mod of event.weightModifiers) {
            if (mod.condition(state)) w *= mod.multiplier;
          }
        }
        return { value: event, weight: Math.max(0.01, w) };
      });

    if (weighted.length === 0) break;
    const picked = weightedPick(weighted);
    selected.push(picked);
    used.add(picked.id);
  }

  return selected;
}

export function applyEventChoice(
  state: GameState,
  event: GameEvent,
  choiceId: string
): { effects: Partial<CoreAttributes>; flags: Record<string, unknown> } {
  const choice = event.choices.find((c) => c.id === choiceId);
  if (!choice) return { effects: {}, flags: {} };

  const effects = { ...choice.effects };

  // Special handling for risky choices
  if (choice.id === 'question' && event.id === 'identity_crisis') {
    if (state.attributes.mental > 30) {
      effects.mental = 10;
    } else {
      effects.mental = -10;
    }
  }

  return {
    effects: { ...event.immediateEffects, ...effects },
    flags: choice.flags || {},
  };
}
