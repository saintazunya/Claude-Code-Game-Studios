// Immigration-specific events based on common 一亩三分地 forum experiences
// These supplement the base events with realistic immigration drama

import type { GameEvent } from './types';

export const IMMIGRATION_EVENTS: GameEvent[] = [
  // === H1B RELATED ===
  {
    id: 'h1b_multiple_registrations',
    type: 'immigration', nameZh: 'H1B多家公司注册', phase: 'career',
    descZh: '你听说有人让多家公司同时帮忙注册H1B来提高中签概率。但USCIS在打击这种行为。',
    weight: 0.4,
    precondition: (s) => ['opt', 'optStem'].includes(s.immigration.visaType) && s.immigration.h1bAttempts >= 1,
    cooldownQuarters: 12, oneTime: true,
    immediateEffects: {},
    choices: [
      { id: 'safe', textKey: '', nameZh: '只用一家公司注册', descZh: '合规操作，概率不变。', tag: 'stable', effects: { mental: 2 } },
      { id: 'risky_multi', textKey: '', nameZh: '尝试多家注册', descZh: '概率翻倍但有5%被查的风险。被查=取消资格。', tag: 'risky', effects: {} },
    ],
  },

  // === PERM RELATED ===
  {
    id: 'perm_prevailing_wage',
    type: 'immigration', nameZh: 'Prevailing Wage过高', phase: 'career',
    descZh: '劳工部给你的岗位定了一个很高的prevailing wage。公司表示这个工资水平太高，可能需要重新申请。',
    weight: 0.5,
    precondition: (s) => s.immigration.permStatus === 'pending',
    cooldownQuarters: 20, oneTime: true,
    immediateEffects: { mental: -10 },
    choices: [
      { id: 'wait', textKey: '', nameZh: '等公司协调', descZh: '公司可能会调整职位描述重新申请，延迟2-3季度。', tag: 'stable', effects: { mental: -5 } },
      { id: 'negotiate', textKey: '', nameZh: '主动和HR沟通', descZh: '表示愿意接受这个工资水平（可能涨薪）。', tag: 'neutral', effects: { mental: -3 } },
    ],
  },

  {
    id: 'perm_recruitment_issue',
    type: 'immigration', nameZh: 'PERM招聘流程问题', phase: 'career',
    descZh: '公司在PERM的强制招聘环节出了纰漏——有美国人应聘者看起来符合条件。HR很紧张。',
    weight: 0.3,
    precondition: (s) => s.immigration.permStatus === 'pending',
    cooldownQuarters: 20, oneTime: true,
    immediateEffects: { mental: -12 },
    choices: [
      { id: 'trust', textKey: '', nameZh: '相信HR能处理', descZh: '大概率没事，但心里忐忑。', tag: 'stable', effects: { mental: -3 } },
      { id: 'prepare', textKey: '', nameZh: '开始准备Plan B', descZh: '研究NIW等备选路线，精神消耗但安心。', tag: 'neutral', effects: { mental: -5, academicImpact: 3 } },
    ],
  },

  // === I-140 RELATED ===
  {
    id: 'i140_rfe',
    type: 'immigration', nameZh: 'I-140收到补件通知', phase: 'career',
    descZh: 'USCIS对你的I-140发了RFE（Request for Evidence），要求补充材料证明你的资质。',
    weight: 0.3,
    precondition: (s) => s.immigration.i140Status === 'pending',
    cooldownQuarters: 20, oneTime: true,
    immediateEffects: { mental: -15 },
    choices: [
      { id: 'respond', textKey: '', nameZh: '认真准备回复材料', descZh: '花$2000律师费，大概率通过。', tag: 'stable', effects: { mental: -5 } },
    ],
  },

  // === PRIORITY DATE / VISA BULLETIN ===
  {
    id: 'eb2_eb3_downgrade',
    type: 'immigration', nameZh: 'EB2降级到EB3的抉择', phase: 'career',
    descZh: '论坛上有人说EB3排期最近比EB2快，建议降级到EB3。但EB3工资要求低可能影响future job。',
    weight: 0.4,
    precondition: (s) => s.immigration.i140Status === 'approved' && s.immigration.i485Status === 'none',
    cooldownQuarters: 20, oneTime: true,
    immediateEffects: {},
    choices: [
      { id: 'stay_eb2', textKey: '', nameZh: '留在EB2', descZh: '排期虽慢但长期更好。', tag: 'stable', effects: {} },
      { id: 'downgrade', textKey: '', nameZh: '降级到EB3', descZh: '排期可能快1-2年，但有风险。', tag: 'risky', effects: { mental: 3 } },
    ],
  },

  {
    id: 'visa_bulletin_big_jump',
    type: 'immigration', nameZh: '排期大幅前进！', phase: 'career',
    descZh: '这个月的签证公告牌上，中国EB2排期一下前进了一年多！论坛上一片欢腾。',
    weight: 0.3,
    precondition: (s) => s.immigration.i140Status === 'approved' && s.immigration.i485Status === 'none',
    cooldownQuarters: 12, oneTime: false,
    immediateEffects: { mental: 15 },
    choices: [
      { id: 'celebrate', textKey: '', nameZh: '太好了！', descZh: '距离提交I-485又近了一步。', tag: 'stable', effects: { mental: 5 } },
    ],
  },

  {
    id: 'visa_bulletin_retrogression',
    type: 'immigration', nameZh: '排期大幅倒退', phase: 'career',
    descZh: '签证公告牌上排期突然倒退了两年。已经准备好的I-485材料全部白费。论坛上一片哀嚎。',
    weight: 0.3,
    precondition: (s) => s.immigration.i140Status === 'approved' && s.immigration.i485Status === 'none',
    cooldownQuarters: 12, oneTime: false,
    immediateEffects: { mental: -20 },
    choices: [
      { id: 'endure', textKey: '', nameZh: '继续等吧', descZh: '除了等没有别的办法。', tag: 'stable', effects: { mental: -5 } },
      { id: 'consider_niw', textKey: '', nameZh: '考虑走NIW', descZh: '研究自主绿卡路线作为备选。', tag: 'neutral', effects: { academicImpact: 3 } },
    ],
  },

  // === LAYOFF + IMMIGRATION COMBO ===
  {
    id: 'layoff_h1b_transfer_panic',
    type: 'crisis', nameZh: '裁员后H1B转换危机', phase: 'career',
    descZh: '被裁后你有60天找到新雇主transfer H1B。新公司HR说H1B transfer要6-8周处理。时间很紧。',
    weight: 0,
    precondition: () => false, // triggered by layoff system
    cooldownQuarters: 8, oneTime: false,
    immediateEffects: { mental: -20 },
    choices: [
      { id: 'rush', textKey: '', nameZh: '催促新公司加急', descZh: '精神压力大但可能来得及。', tag: 'risky', effects: { mental: -10 } },
      { id: 'multiple', textKey: '', nameZh: '同时面多家', descZh: '增加保险但精力分散。', tag: 'stable', effects: { mental: -8 } },
    ],
  },

  // === RFE ON I-485 ===
  {
    id: 'i485_medical_rfe',
    type: 'immigration', nameZh: 'I-485体检补件', phase: 'career',
    descZh: 'I-485审查中，移民局要求重新提交体检报告。之前的体检过期了，需要重新做。',
    weight: 0.3,
    precondition: (s) => s.immigration.i485Status === 'pending',
    cooldownQuarters: 20, oneTime: true,
    immediateEffects: { mental: -8 },
    choices: [
      { id: 'redo', textKey: '', nameZh: '重新体检', descZh: '花$500，延迟1-2季度。', tag: 'stable', effects: {} },
    ],
  },

  // === USCIS PROCESSING DELAYS ===
  {
    id: 'uscis_processing_delay',
    type: 'immigration', nameZh: 'USCIS审批大规模延迟', phase: 'career',
    descZh: '新闻报道USCIS处理案件严重积压，所有移民申请的审批时间翻倍。',
    weight: 0.4,
    precondition: (s) => s.immigration.permStatus === 'pending' || s.immigration.i140Status === 'pending' || s.immigration.i485Status === 'pending',
    cooldownQuarters: 12, oneTime: false,
    immediateEffects: { mental: -10 },
    choices: [
      { id: 'wait', textKey: '', nameZh: '只能等', descZh: '焦虑但无能为力。', tag: 'stable', effects: { mental: -5 } },
      { id: 'inquiry', textKey: '', nameZh: '提交案件查询', descZh: '花$500请律师催，可能有用也可能没用。', tag: 'neutral', effects: { mental: -3 } },
    ],
  },

  // === POLICY CHANGES ===
  {
    id: 'policy_h1b_wage_increase',
    type: 'immigration', nameZh: 'H1B最低工资要求提高', phase: 'career',
    descZh: '政府提高了H1B的最低工资要求。你的当前薪资可能不满足新标准，续签时可能出问题。',
    weight: 0.3,
    precondition: (s) => ['h1b', 'h1bRenewal', 'h1b7thYear'].includes(s.immigration.visaType),
    cooldownQuarters: 16, oneTime: true,
    immediateEffects: { mental: -8 },
    choices: [
      { id: 'ask_raise', textKey: '', nameZh: '和老板谈加薪', descZh: '用政策变化作为谈薪理由。', tag: 'neutral', effects: { mental: -3 } },
      { id: 'upgrade_skills', textKey: '', nameZh: '提升技能争取升职', descZh: '升职后自然涨薪。', tag: 'stable', effects: { skills: 3 } },
    ],
  },

  {
    id: 'policy_premium_processing_suspended',
    type: 'immigration', nameZh: '加急审理暂停', phase: 'career',
    descZh: 'USCIS宣布暂停Premium Processing（加急审理）。所有等待中的申请都要按普通速度处理了。',
    weight: 0.3,
    precondition: (s) => s.immigration.i140Status === 'pending',
    cooldownQuarters: 16, oneTime: true,
    immediateEffects: { mental: -8 },
    choices: [
      { id: 'accept', textKey: '', nameZh: '接受现实', descZh: '等就是了。', tag: 'stable', effects: { mental: -3 } },
    ],
  },

  // === TRAVEL RELATED ===
  {
    id: 'travel_visa_stamp_expired',
    type: 'immigration', nameZh: '签证stamp过期', phase: 'career',
    descZh: '你需要出差/回国，但发现H1B的签证stamp已经过期了。虽然在美国境内合法，但出境后需要重新在大使馆贴签才能回来。',
    weight: 0.4,
    precondition: (s) => ['h1b', 'h1bRenewal', 'h1b7thYear'].includes(s.immigration.visaType) && !s.immigration.hasComboCard,
    cooldownQuarters: 12, oneTime: false,
    immediateEffects: { mental: -5 },
    choices: [
      { id: 'dont_travel', textKey: '', nameZh: '不出境', descZh: '放弃回国/出差计划。安全但遗憾。', tag: 'stable', effects: { mental: -3 } },
      { id: 'risk_travel', textKey: '', nameZh: '出境贴签', descZh: '去大使馆面签。90%通过，10%被check延迟1-3个月。', tag: 'risky', effects: { mental: -8 } },
    ],
  },

  // === COMPANY SPECIFIC ===
  {
    id: 'company_merger_immigration',
    type: 'career', nameZh: '公司被收购，移民案件受影响', phase: 'career',
    descZh: '你的公司被另一家公司收购了。所有进行中的移民案件需要转到新雇主名下，可能产生延迟。',
    weight: 0.3,
    precondition: (s) => s.career.employed === 'employed' && s.immigration.permStatus !== 'none',
    cooldownQuarters: 20, oneTime: true,
    immediateEffects: { mental: -12 },
    choices: [
      { id: 'stay', textKey: '', nameZh: '留在新公司继续', descZh: '大部分情况下案件可以顺利转移。', tag: 'stable', effects: { mental: -3 } },
      { id: 'leave', textKey: '', nameZh: '趁机跳槽', descZh: '反正要重新办了不如找更好的。', tag: 'risky', effects: {} },
    ],
  },

  // === 140/485 SPECIFIC ===
  {
    id: 'i485_interview_notice',
    type: 'immigration', nameZh: '收到I-485面试通知', phase: 'career',
    descZh: '收到USCIS的面试通知！需要去当地移民局面谈。这通常意味着你的绿卡快要批了。',
    weight: 0.4,
    precondition: (s) => s.immigration.i485Status === 'pending',
    cooldownQuarters: 20, oneTime: true,
    immediateEffects: { mental: 5 },
    choices: [
      { id: 'prepare', textKey: '', nameZh: '认真准备面试', descZh: '带齐材料，大概率是好消息。', tag: 'stable', effects: { mental: 5 } },
    ],
  },

  // === EMOTIONAL/COMMUNITY ===
  {
    id: 'forum_success_story',
    type: 'life', nameZh: '论坛上的Timeline分享', phase: 'career',
    descZh: '刷一亩三分地看到有人分享绿卡批准的Timeline，从H1B到绿卡只用了5年。评论区一片羡慕。',
    weight: 0.5,
    precondition: (s) => !s.immigration.hasGreenCard && s.immigration.permStatus !== 'none',
    cooldownQuarters: 8, oneTime: false,
    immediateEffects: {},
    choices: [
      { id: 'inspired', textKey: '', nameZh: '受到鼓舞', descZh: '总有一天会轮到我的。', tag: 'stable', effects: { mental: 5 } },
      { id: 'anxious', textKey: '', nameZh: '更焦虑了', descZh: '为什么别人那么快我这么慢...', tag: 'neutral', effects: { mental: -5 } },
    ],
  },

  {
    id: 'coworker_got_gc',
    type: 'life', nameZh: '同事拿到绿卡了', phase: 'career',
    descZh: '同组的印度同事今天宣布绿卡批准了，大家纷纷祝贺。你替他高兴，但心里五味杂陈。',
    weight: 0.4,
    precondition: (s) => !s.immigration.hasGreenCard && s.career.employed === 'employed',
    cooldownQuarters: 8, oneTime: false,
    immediateEffects: { mental: -3 },
    choices: [
      { id: 'congrats', textKey: '', nameZh: '真心祝贺', descZh: '他等了10年也不容易。', tag: 'stable', effects: { mental: 2 } },
      { id: 'jealous', textKey: '', nameZh: '有点酸', descZh: '什么时候才轮到我...', tag: 'neutral', effects: { mental: -5 } },
    ],
  },
];
