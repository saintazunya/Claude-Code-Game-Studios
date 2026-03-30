// Immigration-specific events based on 一亩三分地 forum experiences
// Only events with meaningful player choices are included here.
// Single-choice or notification events are handled by the immigration state machine directly.

import type { GameEvent } from './types';

export const IMMIGRATION_EVENTS: GameEvent[] = [
  // === H1B ===
  {
    id: 'h1b_multiple_registrations',
    type: 'immigration', nameZh: 'H1B多家公司注册', phase: 'career',
    descZh: '你听说有人让多家公司同时帮忙注册H1B来提高中签概率。但USCIS在打击这种行为，被查到会取消资格。',
    weight: 0.4,
    precondition: (s) => ['opt', 'optStem'].includes(s.immigration.visaType) && s.immigration.h1bAttempts >= 1,
    cooldownQuarters: 20, oneTime: true,
    immediateEffects: {},
    choices: [
      { id: 'safe', textKey: '', nameZh: '合规操作', descZh: '只用一家公司注册，概率不变但安全。', tag: 'stable', effects: { mental: 2 } },
      { id: 'risky_multi', textKey: '', nameZh: '铤而走险', descZh: '多家注册，中签概率翻倍。但5%概率被查→取消资格→遣返。', tag: 'desperate', effects: {}, flags: { h1bMultiReg: true } },
    ],
  },

  // === PRIORITY DATE ===
  {
    id: 'eb2_eb3_downgrade',
    type: 'immigration', nameZh: 'EB2降级到EB3？', phase: 'career',
    descZh: '论坛上讨论激烈——最近EB3排期居然比EB2快了。有人建议降级到EB3。但EB3的工资要求低，可能影响未来跳槽。你的律师也说不好判断。',
    weight: 0.4,
    precondition: (s) => s.immigration.i140Status === 'approved' && s.immigration.i485Status === 'none',
    cooldownQuarters: 20, oneTime: true,
    immediateEffects: {},
    choices: [
      { id: 'stay_eb2', textKey: '', nameZh: '留在EB2', descZh: '排期虽慢但长远来看更稳。', tag: 'stable', effects: { mental: -3 } },
      { id: 'downgrade', textKey: '', nameZh: '降级到EB3', descZh: '排期可能快1-2年，但有风险且不可逆。', tag: 'risky', effects: { mental: 5 }, flags: { eb3Downgrade: true } },
    ],
  },

  {
    id: 'visa_bulletin_retrogression',
    type: 'immigration', nameZh: '排期突然大幅倒退', phase: 'career',
    descZh: '签证公告牌排期突然倒退了两年！已经准备好的I-485材料全部白费。一亩三分地论坛上一片哀嚎。有人说可以考虑走NIW自主路线。',
    weight: 0.3,
    precondition: (s) => s.immigration.i140Status === 'approved' && s.immigration.i485Status === 'none',
    cooldownQuarters: 12, oneTime: false,
    immediateEffects: { mental: -20 },
    choices: [
      { id: 'endure', textKey: '', nameZh: '继续熬', descZh: '除了等没有别的办法。精神继续消耗。', tag: 'stable', effects: { mental: -5 } },
      { id: 'consider_niw', textKey: '', nameZh: '开始研究NIW', descZh: '花AP研究自主绿卡路线，作为Plan B。学术+3。', tag: 'neutral', effects: { academicImpact: 3, mental: -2 } },
      { id: 'rage_quit', textKey: '', nameZh: '认真考虑回国', descZh: '这么等下去值得吗？精神恢复+5但开始动摇。', tag: 'risky', effects: { mental: 5 }, flags: { consideringReturn: true } },
    ],
  },

  // === TRAVEL ===
  {
    id: 'travel_visa_stamp_expired',
    type: 'immigration', nameZh: '想回国但签证stamp过期了', phase: 'career',
    descZh: '父母想让你回家过年，但你的H1B签证stamp已经过期了。在美国境内合法，但出境后需要去大使馆重新贴签才能回来。贴签有被check的风险。',
    weight: 0.4,
    precondition: (s) => ['h1b', 'h1bRenewal', 'h1b7thYear'].includes(s.immigration.visaType) && !s.immigration.hasComboCard,
    cooldownQuarters: 12, oneTime: false,
    immediateEffects: { mental: -5 },
    choices: [
      { id: 'dont_travel', textKey: '', nameZh: '不回去了', descZh: '放弃回国计划。父母失望，你也难过。', tag: 'stable', effects: { mental: -8 } },
      { id: 'risk_travel', textKey: '', nameZh: '冒险回国贴签', descZh: '90%顺利通过。10%被行政审查(check)，滞留1-3个月无法工作。', tag: 'risky', effects: { mental: 10, health: 10 }, flags: { travelRisk: true } },
      { id: 'third_country', textKey: '', nameZh: '去第三国贴签', descZh: '去加拿大/墨西哥大使馆贴签，风险较低但花$3000。', tag: 'costly', effects: { mental: 5 }, flags: { thirdCountryStamp: true } },
    ],
  },

  // === COMPANY ===
  {
    id: 'company_merger_immigration',
    type: 'career', nameZh: '公司被收购了', phase: 'career',
    descZh: '你的公司被一家大公司收购了。HR说移民案件会转到新公司名下，但需要时间。有些同事选择趁机跳槽拿更高薪资。',
    weight: 0.3,
    precondition: (s) => s.career.employed === 'employed' && s.immigration.permStatus !== 'none' && s.career.company !== null,
    cooldownQuarters: 20, oneTime: true,
    immediateEffects: { mental: -10 },
    choices: [
      { id: 'stay', textKey: '', nameZh: '留在新公司', descZh: '案件大概率能顺利转移，但可能延迟1-2季度。', tag: 'stable', effects: { mental: -3 } },
      { id: 'leave', textKey: '', nameZh: '趁机跳槽', descZh: '反正要重新办了，不如找薪资更好的。但绿卡进度可能归零。', tag: 'risky', effects: { mental: 5 }, flags: { startJobSearch: true } },
      { id: 'negotiate', textKey: '', nameZh: '和新公司谈条件', descZh: '要求retention bonus和加速办理移民。可能拿到额外$10K-30K。', tag: 'neutral', effects: { mental: 2 } },
    ],
  },

  // === COMMUNITY / EMOTIONAL ===
  {
    id: 'forum_success_story',
    type: 'life', nameZh: '刷论坛看到绿卡Timeline', phase: 'career',
    descZh: '深夜刷一亩三分地，看到有人分享绿卡批准的Timeline——从H1B到绿卡只用了4年。评论区一片羡慕和祝福。你也忍不住算了算自己还要等多久。',
    weight: 0.5,
    precondition: (s) => !s.immigration.hasGreenCard && s.immigration.permStatus !== 'none',
    cooldownQuarters: 8, oneTime: false,
    immediateEffects: {},
    choices: [
      { id: 'inspired', textKey: '', nameZh: '受到鼓励', descZh: '总有一天会轮到我的。继续加油。', tag: 'stable', effects: { mental: 5 } },
      { id: 'anxious', textKey: '', nameZh: '越看越焦虑', descZh: '为什么别人那么快，我还要等那么久...放下手机吧。', tag: 'neutral', effects: { mental: -8 } },
      { id: 'plan', textKey: '', nameZh: '开始做攻略', descZh: '研究有没有加速的办法。花2小时整理信息。', tag: 'neutral', effects: { mental: -2, academicImpact: 1 } },
    ],
  },

  {
    id: 'coworker_got_gc',
    type: 'life', nameZh: '同事拿到绿卡了', phase: 'career',
    descZh: '今天同组的同事宣布绿卡批准了，Slack上大家纷纷恭喜。你替他高兴，但心里说不出是什么滋味。',
    weight: 0.4,
    precondition: (s) => !s.immigration.hasGreenCard && s.career.employed === 'employed',
    cooldownQuarters: 8, oneTime: false,
    immediateEffects: { mental: -3 },
    choices: [
      { id: 'congrats', textKey: '', nameZh: '真心祝贺', descZh: '他等了很多年也不容易。下次就轮到我了。', tag: 'stable', effects: { mental: 3 } },
      { id: 'jealous', textKey: '', nameZh: '有点酸', descZh: '他运气好排期快...我什么时候才能等到。', tag: 'neutral', effects: { mental: -5 } },
      { id: 'motivated', textKey: '', nameZh: '化酸为动力', descZh: '至少证明这条路走得通。加倍努力。', tag: 'stable', effects: { mental: 2, performance: 2 } },
    ],
  },

  {
    id: 'survivor_guilt',
    type: 'career', nameZh: '同事被裁，你留下了', phase: 'career',
    descZh: '这轮裁员你幸存了，但和你关系不错的同事被裁了。他是H1B，现在只有60天找新工作。你感到愧疚，工作量也因为人少而增加了。',
    weight: 0.5,
    precondition: (s) => s.career.employed === 'employed' && s.economicPhase === 'recession',
    cooldownQuarters: 8, oneTime: false,
    immediateEffects: { mental: -8 },
    choices: [
      { id: 'help', textKey: '', nameZh: '帮他内推', descZh: '花时间帮同事找工作。精神-3但心安理得。', tag: 'stable', effects: { mental: -3 } },
      { id: 'absorb', textKey: '', nameZh: '默默承担多出来的工作', descZh: '绩效+5但精神消耗大。', tag: 'neutral', effects: { performance: 5, mental: -5 } },
      { id: 'boundaries', textKey: '', nameZh: '设好边界，保护自己', descZh: '不揽太多活。精神恢复。', tag: 'stable', effects: { mental: 3 } },
    ],
  },

  {
    id: 'opt_running_out',
    type: 'immigration', nameZh: 'OPT即将到期', phase: 'career',
    descZh: 'OPT还剩不到一年了，H1B还没抽中。如果下次还抽不中，你可能不得不考虑其他选择。',
    weight: 0.6,
    precondition: (s) => {
      if (!['opt', 'optStem'].includes(s.immigration.visaType)) return false;
      const remaining = s.immigration.visaExpiryTurn - s.turn;
      return remaining <= 6 && remaining > 0 && !s.immigration.h1bPending;
    },
    cooldownQuarters: 8, oneTime: false,
    immediateEffects: { mental: -10 },
    choices: [
      { id: 'hope', textKey: '', nameZh: '继续等H1B', descZh: '还有机会，下次抽签再说。', tag: 'stable', effects: { mental: -3 } },
      { id: 'cpt', textKey: '', nameZh: '了解Day-1 CPT', descZh: '挂靠学校续身份，$15K/年学费但能留下。', tag: 'costly', effects: { mental: -5 }, flags: { considerCpt: true } },
      { id: 'accept', textKey: '', nameZh: '开始考虑回国', descZh: '接受可能的结果。精神反而轻松了。', tag: 'neutral', effects: { mental: 5 } },
    ],
  },
];
