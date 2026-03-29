<script lang="ts">
  import { gameState, turnInfo, portfolio } from '../engine/store';
  import { computeSicknessChance, computeBurnoutChance } from '../engine/attributes';
  import { preview } from '../engine/probability';

  let { onclose }: { onclose: () => void } = $props();

  const gs = $derived($gameState);
  const ti = $derived($turnInfo);
  const pf = $derived($portfolio);

  function formatMoney(n: number) {
    if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(0)}K`;
    return `$${Math.round(n)}`;
  }

  const sicknessChance = $derived(gs ? Math.round(computeSicknessChance(gs) * 100) : 0);
  const burnoutChance = $derived(gs ? Math.round(computeBurnoutChance(gs.attributes.mental) * 100) : 0);
  const promotionChance = $derived(gs && gs.career.employed === 'employed' ? Math.round(preview('promotion', gs) * 100) : 0);
  const layoffChance = $derived(gs && gs.career.employed === 'employed' ? Math.round(preview('layoff', gs) * 100) : 0);
  const visaRemaining = $derived(gs ? gs.immigration.visaExpiryTurn - gs.turn : 999);
</script>

{#if gs}
<div class="fixed inset-0 bg-black/70 z-50 flex items-start justify-center overflow-y-auto" onclick={onclose}>
  <div class="bg-[#111827] w-full max-w-[430px] min-h-dvh p-5" onclick={(e) => e.stopPropagation()}>
    <!-- Header -->
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-lg font-bold text-white">📊 状态总览</h1>
      <button class="text-gray-400 text-xl px-2" onclick={onclose}>✕</button>
    </div>

    <!-- Basic Info -->
    <div class="bg-[#1a2234] rounded-xl p-4 border border-[#2a3050] mb-3">
      <h2 class="text-[10px] text-gray-500 font-semibold mb-2 tracking-wider">基本信息</h2>
      <div class="grid grid-cols-2 gap-y-2 text-xs">
        <span class="text-gray-400">日期</span><span class="text-white text-right">{ti.year}年 Q{ti.quarter}</span>
        <span class="text-gray-400">年龄</span><span class="text-white text-right">{ti.age}岁</span>
        <span class="text-gray-400">回合</span><span class="text-white text-right">{gs.turn} / 148</span>
        <span class="text-gray-400">阶段</span><span class="text-white text-right">{gs.phase === 'academic' ? '学业' : '职业'}</span>
        <span class="text-gray-400">经济周期</span><span class="text-right {gs.economicPhase === 'recession' ? 'text-red-400' : gs.economicPhase === 'boom' ? 'text-green-400' : 'text-white'}">{gs.economicPhase === 'recession' ? '📉 衰退' : gs.economicPhase === 'boom' ? '📈 繁荣' : gs.economicPhase === 'recovery' ? '📊 复苏' : '📊 平稳'}</span>
        <span class="text-gray-400">Build</span><span class="text-white text-right">{gs.creation.constitution}/{gs.creation.schoolRanking}/{gs.creation.geoLocation}</span>
      </div>
    </div>

    <!-- Attributes -->
    <div class="bg-[#1a2234] rounded-xl p-4 border border-[#2a3050] mb-3">
      <h2 class="text-[10px] text-gray-500 font-semibold mb-2 tracking-wider">属性</h2>
      <div class="space-y-2">
        {#each [
          { name: '绩效', icon: '📊', val: gs.attributes.performance, color: gs.attributes.performance > 50 ? 'text-blue-400' : 'text-amber-400' },
          { name: '技能', icon: '🛠️', val: gs.attributes.skills, color: 'text-blue-400' },
          { name: '学术影响力', icon: '📚', val: gs.attributes.academicImpact, color: 'text-purple-400' },
          { name: '健康', icon: '💪', val: gs.attributes.health, color: gs.attributes.health > 70 ? 'text-green-400' : gs.attributes.health > 30 ? 'text-amber-400' : 'text-red-400' },
          { name: '精神', icon: '🧠', val: gs.attributes.mental, color: gs.attributes.mental > 60 ? 'text-blue-400' : gs.attributes.mental > 30 ? 'text-amber-400' : 'text-red-400' },
        ] as attr}
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400 w-20">{attr.icon} {attr.name}</span>
            <div class="flex-1 h-2 bg-[#0a0e17] rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all {attr.color.replace('text-', 'bg-')}" style="width: {attr.val}%"></div>
            </div>
            <span class="text-xs font-bold {attr.color} w-8 text-right">{Math.round(attr.val)}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Career -->
    <div class="bg-[#1a2234] rounded-xl p-4 border border-[#2a3050] mb-3">
      <h2 class="text-[10px] text-gray-500 font-semibold mb-2 tracking-wider">职业</h2>
      <div class="grid grid-cols-2 gap-y-2 text-xs">
        <span class="text-gray-400">状态</span>
        <span class="text-right {gs.career.employed === 'employed' ? 'text-green-400' : gs.career.employed === 'unemployed' ? 'text-red-400' : 'text-blue-400'}">
          {gs.career.employed === 'employed' ? '在职' : gs.career.employed === 'unemployed' ? '失业' : '学生'}
        </span>
        {#if gs.career.employed === 'employed'}
          <span class="text-gray-400">职级</span><span class="text-white text-right">SDE L{gs.career.level}</span>
          <span class="text-gray-400">公司</span><span class="text-white text-right">{gs.career.company?.name || '—'}</span>
          <span class="text-gray-400">公司文化</span><span class="text-right {gs.career.company?.culture === 'grind' ? 'text-red-400' : gs.career.company?.culture === 'relaxed' ? 'text-green-400' : 'text-white'}">{gs.career.company?.culture === 'grind' ? '内卷' : gs.career.company?.culture === 'relaxed' ? '轻松' : '正常'}</span>
          <span class="text-gray-400">老板</span><span class="text-right {gs.career.bossType === 'toxic' ? 'text-red-400' : gs.career.bossType === 'supportive' ? 'text-green-400' : 'text-white'}">{gs.career.bossType === 'toxic' ? '有毒 ☠️' : gs.career.bossType === 'demanding' ? '严格' : gs.career.bossType === 'supportive' ? '给力 ✨' : '一般'}</span>
          <span class="text-gray-400">在职时间</span><span class="text-white text-right">{gs.career.tenure}季度</span>
          <span class="text-gray-400">年薪TC</span><span class="text-emerald-400 text-right">{formatMoney(gs.career.salary + gs.career.rsu)}</span>
          <span class="text-gray-400">升职概率(Q4)</span><span class="text-blue-400 text-right">{promotionChance}%</span>
          <span class="text-gray-400">裁员风险</span><span class="text-right {layoffChance > 10 ? 'text-red-400' : 'text-gray-300'}">{layoffChance}%</span>
          {#if gs.career.onPip}
            <span class="text-red-400 font-bold">⚠️ PIP</span><span class="text-red-400 text-right">{gs.career.pipQuartersRemaining}季度剩余</span>
          {/if}
        {/if}
        {#if gs.phase === 'academic'}
          <span class="text-gray-400">GPA</span><span class="text-white text-right">{gs.academic.gpa.toFixed(2)}</span>
          <span class="text-gray-400">实习</span><span class="text-right {gs.academic.hadIntern ? 'text-green-400' : 'text-gray-500'}">{gs.academic.hadIntern ? (gs.academic.internQuality === 'top' ? '大厂 ✅' : '普通 ✅') : '无'}</span>
          {#if gs.academic.hasReturnOffer}
            <span class="text-gray-400">Return Offer</span><span class="text-green-400 text-right">有 🎊</span>
          {/if}
        {/if}
      </div>
    </div>

    <!-- Immigration -->
    <div class="bg-[#1a2234] rounded-xl p-4 border border-[#2a3050] mb-3">
      <h2 class="text-[10px] text-gray-500 font-semibold mb-2 tracking-wider">移民身份</h2>
      <div class="grid grid-cols-2 gap-y-2 text-xs">
        <span class="text-gray-400">签证</span><span class="text-white text-right">{gs.immigration.visaType.toUpperCase()}</span>
        {#if visaRemaining < 999}
          <span class="text-gray-400">到期</span><span class="text-right {visaRemaining <= 4 ? 'text-red-400 font-bold' : visaRemaining <= 8 ? 'text-amber-400' : 'text-gray-300'}">{visaRemaining}季度</span>
        {/if}
        <span class="text-gray-400">H1B尝试</span><span class="text-white text-right">{gs.immigration.h1bAttempts}次</span>
        {#if gs.immigration.h1bPending}
          <span class="text-purple-400 font-bold">H1B待生效</span><span class="text-purple-400 text-right">Q4激活</span>
        {/if}
        <span class="text-gray-400">PERM</span><span class="text-right {gs.immigration.permStatus === 'approved' ? 'text-green-400' : gs.immigration.permStatus !== 'none' ? 'text-amber-400' : 'text-gray-500'}">{gs.immigration.permStatus === 'none' ? '未开始' : gs.immigration.permStatus === 'approved' ? '已批准 ✅' : gs.immigration.permStatus}</span>
        <span class="text-gray-400">I-140</span><span class="text-right {gs.immigration.i140Status === 'approved' ? 'text-green-400' : gs.immigration.i140Status !== 'none' ? 'text-amber-400' : 'text-gray-500'}">{gs.immigration.i140Status === 'none' ? '未开始' : gs.immigration.i140Status === 'approved' ? '已批准 ✅' : gs.immigration.i140Status}</span>
        <span class="text-gray-400">I-485</span><span class="text-right {gs.immigration.i485Status === 'approved' ? 'text-green-400' : gs.immigration.i485Status !== 'none' ? 'text-amber-400' : 'text-gray-500'}">{gs.immigration.i485Status === 'none' ? '未开始' : gs.immigration.i485Status === 'approved' ? '已批准 ✅' : gs.immigration.i485Status}</span>
        <span class="text-gray-400">Combo卡</span><span class="text-right {gs.immigration.hasComboCard ? 'text-teal-400' : 'text-gray-500'}">{gs.immigration.hasComboCard ? '有 🎫' : '无'}</span>
        <span class="text-gray-400">绿卡</span><span class="text-right {gs.immigration.hasGreenCard ? 'text-green-400 font-bold' : 'text-gray-500'}">{gs.immigration.hasGreenCard ? '已获批 🏆' : '未获得'}</span>
        {#if gs.immigration.gcWillingness}
          <span class="text-gray-400">公司GC态度</span><span class="text-right">{gs.career.company?.gcWillingness === 'eager' ? '积极 👍' : gs.career.company?.gcWillingness === 'reluctant' ? '消极 👎' : '一般'}</span>
        {/if}
      </div>
    </div>

    <!-- Finance -->
    <div class="bg-[#1a2234] rounded-xl p-4 border border-[#2a3050] mb-3">
      <h2 class="text-[10px] text-gray-500 font-semibold mb-2 tracking-wider">财务</h2>
      <div class="grid grid-cols-2 gap-y-2 text-xs">
        <span class="text-gray-400">净资产</span><span class="text-emerald-400 text-right font-bold">{formatMoney(gs.attributes.netWorth)}</span>
        <span class="text-gray-400">现金</span><span class="text-white text-right">{formatMoney(gs.economy.cash)}</span>
        <span class="text-gray-400">S&P 500</span><span class="text-right {pf.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}">{formatMoney(pf.currentValue)} ({pf.unrealizedPnlPercent >= 0 ? '+' : ''}{pf.unrealizedPnlPercent.toFixed(1)}%)</span>
        {#if gs.economy.ownsHome}
          <span class="text-gray-400">房产价值</span><span class="text-white text-right">{formatMoney(gs.economy.homeValue)}</span>
          <span class="text-gray-400">房贷剩余</span><span class="text-red-400 text-right">{formatMoney(gs.economy.homeMortgageRemaining)}</span>
        {/if}
        <span class="text-gray-400">定投</span><span class="text-white text-right">{gs.economy.autoInvestAmount > 0 ? `${formatMoney(gs.economy.autoInvestAmount)}/季度` : '未设置'}</span>
      </div>
    </div>

    <!-- Risk -->
    <div class="bg-[#1a2234] rounded-xl p-4 border border-[#2a3050] mb-3">
      <h2 class="text-[10px] text-gray-500 font-semibold mb-2 tracking-wider">风险指标</h2>
      <div class="grid grid-cols-2 gap-y-2 text-xs">
        <span class="text-gray-400">生病概率</span><span class="text-right {sicknessChance > 20 ? 'text-red-400' : sicknessChance > 10 ? 'text-amber-400' : 'text-gray-300'}">{sicknessChance}%</span>
        <span class="text-gray-400">Burnout概率</span><span class="text-right {burnoutChance > 10 ? 'text-red-400' : 'text-gray-300'}">{burnoutChance}%</span>
        {#if gs.grindLockQuarters > 0}
          <span class="text-gray-400">卷王锁定</span><span class="text-amber-400 text-right">{gs.grindLockQuarters}季度</span>
        {/if}
        <span class="text-gray-400">连续卷王</span><span class="text-right {gs.career.grindConsecutive > 2 ? 'text-red-400' : 'text-gray-300'}">{gs.career.grindConsecutive}季度</span>
        <span class="text-gray-400">连续躺平</span><span class="text-right {gs.career.coastConsecutive > 2 ? 'text-amber-400' : 'text-gray-300'}">{gs.career.coastConsecutive}季度</span>
      </div>
    </div>

    <!-- Permanent Modifiers -->
    <div class="bg-[#1a2234] rounded-xl p-4 border border-[#2a3050] mb-3">
      <h2 class="text-[10px] text-gray-500 font-semibold mb-2 tracking-wider">永久修正</h2>
      <div class="grid grid-cols-2 gap-y-2 text-xs">
        <span class="text-gray-400">学校加成</span><span class="text-right {gs.schoolModifier >= 0 ? 'text-green-400' : 'text-red-400'}">{gs.schoolModifier >= 0 ? '+' : ''}{(gs.schoolModifier * 100).toFixed(0)}% 工作概率</span>
        <span class="text-gray-400">地理加成</span><span class="text-right {gs.geoBonus >= 0 ? 'text-green-400' : 'text-red-400'}">{gs.geoBonus >= 0 ? '+' : ''}{(gs.geoBonus * 100).toFixed(0)}% 实习概率</span>
        <span class="text-gray-400">体质减免</span><span class="text-green-400 text-right">{(gs.creation.constitution * 10)}% 卷王惩罚</span>
      </div>
    </div>

    <button class="w-full py-3 mt-2 mb-4 rounded-xl bg-[#1a2234] text-gray-400 text-sm border border-[#2a3050] active:scale-[0.98] transition-transform" onclick={onclose}>
      关闭
    </button>
  </div>
</div>
{/if}
