<script lang="ts">
  import { gameState, selectedActions, remainingAp, effectiveAp, availableActions, turnInfo, toggleAction, endTurn, portfolio, healthState, mentalState, autoSelect, autoPlayReasoning, inferredMode, attitudeLevel, attitudeApCost } from '../engine/store';
  import InfoPanel from './InfoPanel.svelte';
  import EventLog from './EventLog.svelte';

  let showInfo = $state(false);
  let showEventLog = $state(false);
  let showStockPopup = $state<'buy' | 'sell' | null>(null);
  let stockAmount = $state(0);
  import { canSelectAction, ACTIONS } from '../engine/actions';
  import { computeSicknessChance } from '../engine/attributes';
  import type { ActionId } from '../engine/types';

  const gs = $derived($gameState);
  const ti = $derived($turnInfo);
  const ap = $derived($remainingAp);
  const totalAp = $derived($effectiveAp);
  const actions = $derived($selectedActions);
  const available = $derived($availableActions);
  const pf = $derived($portfolio);
  const hs = $derived($healthState);
  const ms = $derived($mentalState);
  const mode = $derived($inferredMode);

  const isAcademic = $derived(gs?.phase === 'academic');
  const sicknessChance = $derived(gs ? Math.round(computeSicknessChance(gs) * 100) : 0);
  const turnProgress = $derived(gs ? (gs.turn / 148) * 100 : 0);
  const apUsed = $derived(totalAp - ap);

  function visaColor(type: string) {
    if (type === 'greenCard') return 'bg-green-600';
    if (type === 'comboCard') return 'bg-teal-600';
    if (['h1b', 'h1bRenewal', 'h1b7thYear'].includes(type)) return 'bg-purple-600';
    if (['opt', 'optStem'].includes(type)) return 'bg-amber-600';
    return 'bg-gray-600';
  }

  function visaLabel(type: string) {
    const labels: Record<string, string> = {
      f1: 'F-1', opt: 'OPT', optStem: 'OPT STEM', h1b: 'H-1B',
      h1bRenewal: 'H-1B', h1b7thYear: 'H-1B 7th+', o1: 'O-1',
      comboCard: 'Combo卡', greenCard: '绿卡 ✅', cptDay1: 'CPT',
    };
    return labels[type] || type;
  }

  function healthBarColor(h: number) {
    if (h > 70) return 'bg-gradient-to-r from-green-500 to-green-400';
    if (h > 30) return 'bg-gradient-to-r from-amber-500 to-amber-400';
    return 'bg-gradient-to-r from-red-600 to-red-400';
  }

  function mentalBarColor(m: number) {
    if (m > 60) return 'bg-gradient-to-r from-blue-500 to-blue-400';
    if (m > 30) return 'bg-gradient-to-r from-amber-500 to-amber-400';
    return 'bg-gradient-to-r from-red-600 to-red-400';
  }

  function formatMoney(n: number) {
    if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(0)}K`;
    return `$${Math.round(n)}`;
  }

  function actionIcon(id: string): string {
    const icons: Record<string, string> = {
      searchFullTimeJob: '💼', normalJobSearch: '🔍', workNone: '🏖️', workSlack: '🫠', workHard: '💪', workSuperHard: '🏋️', studySlack: '☕', studyNormal: '📚', studyHard: '📖',  upskill: '📖', prepJobChange: '🔍',
      hospital: '🏥', internWork: '💪',
      entrepreneurship: '🚀', prepH1b: '📋', researchNiw: '📝',
      publishPaper: '📄', consultLawyer: '⚖️', day1Cpt: '🏫', invest: '📈', sellStock: '📉',
      rest: '😴', travel: '✈️',
      exercise: '🏃', therapist: '🧠', studyGpa: '📚', searchIntern: '🔎',
      thesisResearch: '🔬', taRaWork: '👨‍🏫', networking: '🤝',
      sideProject: '💻', urgentJobSearch: '🆘',
    };
    return icons[id] || '📌';
  }

  function modeLabel(m: string) {
    const con = gs?.creation.constitution || 0;
    const grindRed = con * 0.1;
    const grindH = Math.round(-10 * (1 - grindRed));
    const grindM = Math.round(-5 * (1 - grindRed * 0.5));
    if (m === 'grind') return { text: '🔥 卷王模式', color: 'text-red-400', desc: `健康${grindH} 精神${grindM}` };
    if (m === 'coast') return { text: '🛋️ 躺平模式', color: 'text-green-400', desc: '精神+5' };
    return { text: '💼 正常模式', color: 'text-blue-400', desc: '精神-1' };
  }

  const modeInfo = $derived(modeLabel(mode));
  const att = $derived($attitudeLevel);
  const needsStudy = false;

  const attitudeConfig = $derived(isAcademic
    ? [
        { level: 0, emoji: '☕', label: '摸鱼', color: 'bg-green-600', ap: 1, desc: 'GPA+0.05, 技能+1' },
        { level: 1, emoji: '📚', label: '正常', color: 'bg-blue-600', ap: 2, desc: 'GPA+0.15, 技能+3' },
        { level: 2, emoji: '📖', label: '努力', color: 'bg-amber-600', ap: 3, desc: 'GPA+0.30, 技能+5, 精神-2' },
      ]
    : gs?.career.employed === 'employed'
    ? [
        { level: 0, emoji: '🏖️', label: '不干', color: 'bg-gray-600', ap: 0, desc: '绩效-5, 精神+5' },
        { level: 1, emoji: '🫠', label: '摸鱼', color: 'bg-green-600', ap: 1, desc: '绩效-3, 精神+2' },
        { level: 2, emoji: '💪', label: '努力', color: 'bg-blue-600', ap: 2, desc: '绩效+5, 精神-1' },
        { level: 3, emoji: '🏋️', label: '超级', color: 'bg-red-600', ap: 3, desc: '绩效+12, 精神-3' },
      ]
    : []);
  const attCost = $derived($attitudeApCost);
  // AP available for attitude switch = remaining AP + current attitude cost
  const attBudget = $derived(ap + attCost);
</script>

{#if gs}
<div class="flex flex-col min-h-dvh bg-[#0a0e17] animate-fadein">
  <!-- Progress Bar -->
  <div class="h-1 bg-[#1a2234]">
    <div class="h-full bg-gradient-to-r from-blue-600 to-purple-500 transition-all duration-500" style="width: {turnProgress}%"></div>
  </div>

  <!-- Header -->
  <div class="px-4 pt-2 pb-2 bg-gradient-to-b from-[#1a1f35] to-[#111827] border-b border-[#2a3050]">
    <div class="flex justify-between items-center mb-1">
      <div class="text-lg font-bold text-white">
        {ti.year}年 <span class="text-blue-400">Q{ti.quarter}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="px-2 py-0.5 rounded {visaColor(gs.immigration.visaType)} text-white font-semibold text-[10px]">
          {visaLabel(gs.immigration.visaType)}
        </span>
        <span class="px-2.5 py-0.5 rounded-full bg-[#1e3a5f] text-sky-300 text-xs font-semibold">
          {ti.age}岁
        </span>
        <button class="px-2 py-0.5 rounded-full bg-[#1a2234] text-gray-400 text-xs border border-[#2a3050] active:scale-95" onclick={() => showEventLog = true}>
          📜
        </button>
        <button class="px-2 py-0.5 rounded-full bg-[#1a2234] text-gray-400 text-xs border border-[#2a3050] active:scale-95" onclick={() => showInfo = true}>
          📊
        </button>
      </div>
    </div>
    <div class="flex items-center gap-2 text-[10px]">
      <span class="text-gray-500">回合 {gs.turn}/72</span>
      <span class="text-gray-700">|</span>
      <span class="text-gray-500">
        {gs.economicPhase === 'recession' ? '📉 衰退' : gs.economicPhase === 'boom' ? '📈 繁荣' : gs.economicPhase === 'recovery' ? '📊 复苏' : '📊 平稳'}
      </span>
      {#if gs.career.employed === 'employed' && gs.career.company}
        <span class="ml-auto text-gray-600 truncate max-w-[100px]">{gs.career.company.name}</span>
      {/if}
    </div>
  </div>

  <!-- Stats Grid -->
  <div class="grid grid-cols-2 gap-2 p-3">
    <div class="bg-[#1a2234] rounded-xl p-3 border border-[#2a3050]">
      <div class="text-[10px] text-gray-500 mb-0.5">💰 现金</div>
      <div class="text-xl font-black {gs.economy.cash >= 0 ? 'text-emerald-400' : 'text-red-400'}">{formatMoney(gs.economy.cash)}</div>
      {#if gs.economy.portfolioShares > 0}
        <div class="text-[10px] text-gray-500 mt-0.5">📈 股票 {formatMoney(gs.economy.portfolioShares * gs.economy.sharePrice)}</div>
      {/if}
    </div>
    <div class="bg-[#1a2234] rounded-xl p-3 border border-[#2a3050]">
      <div class="text-[10px] text-gray-500 mb-0.5">职业</div>
      <div class="text-lg font-bold text-blue-400">
        {#if gs.career.employed === 'student'}
          🎓 {gs.academic.isPhd ? '博士生' : '研究生'}
        {:else if gs.career.employed === 'employed'}
          SDE L{gs.career.level}
        {:else}
          ⚠️ 失业
        {/if}
      </div>
      {#if gs.career.employed === 'employed'}
        <div class="text-[10px] text-gray-600">绩效 {Math.round(gs.attributes.performance)}</div>
      {/if}
      {#if gs.career.onPip}
        <div class="text-[10px] text-red-400 font-bold animate-pulse">⚠️ PIP中 ({gs.career.pipQuartersRemaining}季度)</div>
      {/if}
    </div>
    {#if isAcademic}
      <div class="bg-[#1a2234] rounded-xl p-3 border border-[#2a3050]">
        <div class="text-[10px] text-gray-500 mb-0.5">GPA</div>
        <div class="text-xl font-black {gs.academic.gpa >= 3.7 ? 'text-green-400' : gs.academic.gpa >= 3.3 ? 'text-blue-400' : gs.academic.gpa >= 3.0 ? 'text-amber-400' : 'text-red-400'}">
          {gs.academic.gpa.toFixed(2)}
        </div>
      </div>
      <div class="bg-[#1a2234] rounded-xl p-3 border border-[#2a3050]">
        <div class="text-[10px] text-gray-500 mb-0.5">实习</div>
        {#if gs.academic.hadIntern}
          <div class="text-lg font-bold text-green-400">✅ {gs.academic.internQuality === 'top' ? '大厂' : '普通'}</div>
          {#if gs.academic.hasReturnOffer}
            <div class="text-[10px] text-green-400">🎊 有Return Offer</div>
          {/if}
        {:else}
          <div class="text-lg font-bold text-gray-500">❌ 还没有</div>
        {/if}
      </div>
    {:else}
      <div class="bg-[#1a2234] rounded-xl p-3 border border-[#2a3050]">
        <div class="text-[10px] text-gray-500 mb-0.5">S&P 500</div>
        {#if pf.currentValue > 0}
          <div class="text-sm font-bold {pf.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}">{formatMoney(pf.currentValue)}</div>
          <div class="text-[10px] {pf.unrealizedPnl >= 0 ? 'text-emerald-500/60' : 'text-red-500/60'}">{pf.unrealizedPnlPercent >= 0 ? '+' : ''}{pf.unrealizedPnlPercent.toFixed(1)}%</div>
        {:else}
          <div class="text-sm text-gray-600">未投资</div>
        {/if}
      </div>
      <div class="bg-[#1a2234] rounded-xl p-3 border border-[#2a3050]">
        <div class="text-[10px] text-gray-500 mb-0.5">绿卡</div>
        <div class="text-sm font-bold">
          {#if gs.immigration.hasGreenCard}
            <span class="text-green-400">✅ 已获批</span>
          {:else if gs.immigration.hasComboCard}
            <span class="text-teal-400">🎫 Combo卡</span>
          {:else if gs.immigration.i140Status === 'approved'}
            <span class="text-purple-400">📋 等排期</span>
          {:else if gs.immigration.permStatus !== 'none'}
            <span class="text-amber-400">⏳ PERM</span>
          {:else}
            <span class="text-gray-500">未开始</span>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Health & Mental -->
  <div class="px-4 space-y-2.5 mb-3">
    <div>
      <div class="flex justify-between text-[10px] mb-1">
        <span class="text-gray-500">💪 健康</span>
        <span class="{gs.attributes.health > 70 ? 'text-green-400' : gs.attributes.health > 30 ? 'text-amber-400' : 'text-red-400'}">
          {Math.round(gs.attributes.health)}%
          {#if sicknessChance > 10}
            <span class="text-gray-600">(生病{sicknessChance}%)</span>
          {/if}
        </span>
      </div>
      <div class="h-2 bg-[#1a2234] rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-500 {healthBarColor(gs.attributes.health)}" style="width: {gs.attributes.health}%"></div>
      </div>
    </div>
    <div>
      <div class="flex justify-between text-[10px] mb-1">
        <span class="text-gray-500">🧠 精神</span>
        <span class="{gs.attributes.mental > 60 ? 'text-blue-400' : gs.attributes.mental > 30 ? 'text-amber-400' : 'text-red-400'}">
          {Math.round(gs.attributes.mental)}%
        </span>
      </div>
      <div class="h-2 bg-[#1a2234] rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-500 {mentalBarColor(gs.attributes.mental)}" style="width: {gs.attributes.mental}%"></div>
      </div>
    </div>
  </div>

  <!-- Compact stats row -->
  <div class="px-4 flex gap-3 mb-2 text-[10px]">
    <span class="text-gray-500">📊 技能 <span class="text-gray-300 font-semibold">{Math.round(gs.attributes.skills)}</span></span>
    <span class="text-gray-500">📚 学术 <span class="text-gray-300 font-semibold">{Math.round(gs.attributes.academicImpact)}</span></span>
    {#if isAcademic}
      {@const gradTurn = gs.academic.isPhd ? 16 : 8}
      <span class="text-gray-500">🎓 毕业 <span class="text-blue-400 font-semibold">还剩{gradTurn - gs.turn}季</span></span>
    {/if}
  </div>

  <!-- Attitude Toggle Bar -->
  {#if attitudeConfig.length > 0}
    <div class="px-4 mb-3">
      <div class="flex justify-between items-center mb-1.5">
        <span class="text-xs text-gray-500">{isAcademic ? '📚 学习态度' : '💼 工作态度'} <span class="text-amber-400">{attCost}AP</span></span>
        <span class="text-[10px] text-gray-600">{attitudeConfig[att]?.desc || ''}</span>
      </div>
      <div class="flex gap-1 bg-[#1a2234] rounded-xl p-1 border border-[#2a3050]">
        {#each attitudeConfig as item}
          {@const canAfford = item.ap <= attBudget || att === item.level}
          <button
            class="flex-1 py-2 rounded-lg text-center transition-all text-xs {att === item.level ? item.color + ' text-white font-bold shadow-lg' : canAfford ? 'text-gray-500' : 'text-gray-700 opacity-40'}"
            disabled={!canAfford}
            onclick={() => attitudeLevel.set(item.level)}
          >
            <div class="text-sm">{item.emoji}</div>
            <div class="text-[9px]">{item.label}</div>
            <div class="text-[8px] {att === item.level ? 'text-white/70' : 'text-gray-600'}">{item.ap}AP</div>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Status Warnings -->
  {#if isAcademic && gs.flags.internActiveThisQuarter}
    <div class="mx-4 mb-2 p-2.5 rounded-xl bg-green-950/30 border border-green-900/40 text-xs">
      <span class="text-green-400 font-bold">💼 实习中（本季度）</span>
      <span class="text-green-400/70"> — 占用3AP，+$15K，技能+5</span>
    </div>
  {:else if isAcademic && gs.academic.hadIntern && !gs.academic.hasReturnOffer}
    <div class="mx-4 mb-2 p-2 rounded-xl bg-[#1a2234] border border-[#2a3050] text-xs">
      <span class="text-green-400/60">✅ 已完成实习</span>
    </div>
  {/if}
  {#if (gs.flags.sicknessApPenalty as number) > 0}
    <div class="mx-4 mb-2 p-2.5 rounded-xl bg-red-950/40 border border-red-900/50 text-xs">
      <span class="text-red-400 font-bold">🤒 生病中</span>
      <span class="text-red-400/70"> — AP -{gs.flags.sicknessApPenalty}</span>
    </div>
  {/if}
  {#if gs.flags.burnoutActive}
    <div class="mx-4 mb-2 p-2.5 rounded-xl bg-red-950/40 border border-red-900/50 text-xs">
      <span class="text-red-400 font-bold">💀 Burnout</span>
      <span class="text-red-400/70"> — 精神崩溃，本季度最多4AP</span>
    </div>
  {/if}
  {#if gs.flags.layoffWarningActive && gs.career.employed === 'employed'}
    <div class="mx-4 mb-2 p-2.5 rounded-xl bg-red-950/40 border border-red-900/50 text-xs animate-pulse">
      <span class="text-red-400 font-bold">⚠️ 裁员预警</span>
      <span class="text-red-400/70"> — 下季度揭晓结果。绩效越高被裁概率越低！</span>
    </div>
  {/if}
  {#if gs.grindLockQuarters > 0}
    <div class="mx-4 mb-2 p-2 rounded-xl bg-amber-950/30 border border-amber-900/40 text-xs">
      <span class="text-amber-400">🔒 卷王模式锁定 {gs.grindLockQuarters}季度（AP上限{totalAp}）</span>
    </div>
  {/if}
  {#if gs.flags.showProbabilities}
    <div class="mx-4 mb-2 p-2.5 rounded-xl bg-purple-950/30 border border-purple-800/40 text-xs">
      <span class="text-purple-400 font-bold">⚖️ 律师加成生效中</span>
      <span class="text-purple-400/70"> — 移民审批+10% · 打开📊查看详细概率</span>
    </div>
  {/if}
  {#if gs.phase === 'career' && !gs.flags.lawyerConsulted && !gs.immigration.hasGreenCard}
    <div class="mx-4 mb-2 p-2 rounded-xl bg-[#1a2234] border border-[#2a3050] text-xs">
      <span class="text-gray-500">💡 提示：咨询移民律师可解锁隐藏选项（NIW/CPT/发论文）</span>
    </div>
  {/if}

  <!-- AP Bar + Mode Indicator -->
  <div class="px-4 mb-2">
    <div class="flex justify-between items-center mb-1">
      <div class="flex items-center gap-2">
        <span class="text-xs {modeInfo.color} font-bold">{modeInfo.text}</span>
        <span class="text-[9px] text-gray-600">{modeInfo.desc}</span>
      </div>
      <span class="px-2.5 py-0.5 rounded-full bg-amber-500/90 text-black text-[10px] font-bold">
        {ap} / {totalAp} AP
      </span>
    </div>
    <!-- AP usage bar with zone indicators -->
    <div class="h-3 bg-[#1a2234] rounded-full overflow-hidden relative">
      <div class="h-full rounded-full transition-all duration-300 {mode === 'grind' ? 'bg-gradient-to-r from-red-600 to-red-400' : mode === 'coast' ? 'bg-gradient-to-r from-green-600 to-green-400' : 'bg-gradient-to-r from-blue-600 to-blue-400'}" style="width: {Math.min(100, (apUsed / totalAp) * 100)}%"></div>
      <!-- Zone markers -->
      {#if totalAp >= 7}
        <div class="absolute top-0 h-full w-px bg-gray-600" style="left: {(5 / totalAp) * 100}%"></div>
        <div class="absolute top-0 h-full w-px bg-amber-500/50" style="left: {(7 / totalAp) * 100}%"></div>
      {/if}
    </div>
    <div class="flex justify-between text-[8px] text-gray-600 mt-0.5">
      <span>躺平 ≤5</span>
      <span>正常 6-7</span>
      <span>卷王 8+</span>
    </div>
  </div>

  <!-- Action List -->
  <div class="flex-1 px-4 overflow-y-auto pb-4">
    <div class="space-y-2">
      {#each available as action}
        {@const isSelected = actions.includes(action.id)}
        {@const check = canSelectAction(action, actions, ap)}
        {@const disabled = !isSelected && !check.allowed}
        <button
          class="w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-150 text-left {isSelected ? 'border-blue-500 bg-[#1a2a4a] shadow-md shadow-blue-500/5' : 'border-[#2a3050] bg-[#1a2234]'} {disabled ? 'opacity-30' : 'active:scale-[0.98]'}"
          {disabled}
          onclick={() => {
            if (action.id === 'invest' && !actions.includes('invest')) {
              stockAmount = Math.round(gs.economy.cash * 0.5);
              showStockPopup = 'buy';
            } else if (action.id === 'sellStock' && !actions.includes('sellStock')) {
              stockAmount = Math.round(gs.economy.portfolioShares * gs.economy.sharePrice);
              showStockPopup = 'sell';
            } else {
              toggleAction(action.id);
            }
          }}
        >
          <div class="text-lg w-8 text-center flex-shrink-0">{actionIcon(action.id)}</div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold text-white">{action.nameZh}</div>
            {#if action.tipsZh}
              <div class="text-[10px] text-gray-500 leading-relaxed mt-0.5">{action.tipsZh}</div>
            {/if}
          </div>
          <div class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold {isSelected ? 'bg-blue-500 text-white' : disabled ? 'bg-[#111827] text-gray-600' : 'bg-amber-500/20 text-amber-400'}">
            {action.apCost}
          </div>
        </button>
      {/each}
    </div>
  </div>

  <!-- Auto-play reasoning -->
  {#if $autoPlayReasoning.length > 0}
    <div class="px-4 pb-2">
      <div class="bg-amber-950/30 border border-amber-900/40 rounded-xl p-3">
        <p class="text-[10px] text-amber-400 font-bold mb-1">🤖 自动决策：</p>
        {#each $autoPlayReasoning as reason}
          <p class="text-[10px] text-amber-400/70">• {reason}</p>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Bottom Bar -->
  <div class="px-4 py-3 bg-[#0d1117] border-t border-[#2a3050]">
    <div class="flex gap-2">
      <button
        class="py-4 px-5 rounded-2xl bg-[#1a2234] text-amber-400 text-sm font-bold border border-amber-900/40 active:scale-[0.98] transition-all"
        onclick={() => { autoSelect(); }}
      >
        🤖
      </button>
      <button
        class="flex-1 py-4 rounded-2xl text-white text-base font-bold transition-all duration-200 {needsStudy ? 'bg-gray-800 opacity-40' : 'bg-gradient-to-r from-blue-600 to-blue-700 active:scale-[0.98] shadow-lg shadow-blue-600/20'}"
        disabled={needsStudy}
        onclick={endTurn}
      >
        {needsStudy ? '请先选择学习态度' : '结束本季度 ➜'}
      </button>
    </div>
  </div>
</div>
{#if showInfo}
  <InfoPanel onclose={() => showInfo = false} />
{/if}
{#if showEventLog}
  <EventLog onclose={() => showEventLog = false} />
{/if}
{#if showStockPopup && gs}
  <div class="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" role="dialog">
    <div class="bg-[#111827] w-[90%] max-w-[380px] rounded-2xl p-5 border border-[#2a3050]" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-lg font-bold text-white mb-1">
        {showStockPopup === 'buy' ? '📈 买入股票' : '📉 卖出股票'}
      </h2>
      <p class="text-xs text-gray-500 mb-3">
        当前股价: ${gs.economy.sharePrice.toFixed(2)} /股
        {showStockPopup === 'buy'
          ? ` | 可用现金: ${formatMoney(gs.economy.cash)}`
          : ` | 持有: ${gs.economy.portfolioShares.toFixed(1)}股 (${formatMoney(gs.economy.portfolioShares * gs.economy.sharePrice)})`}
      </p>

      <div class="mb-3">
        <label class="text-xs text-gray-400 mb-1 block">
          {showStockPopup === 'buy' ? '买入金额 ($)' : '卖出金额 ($)'}
        </label>
        <input
          type="range"
          min="0"
          max={showStockPopup === 'buy' ? Math.floor(gs.economy.cash) : Math.floor(gs.economy.portfolioShares * gs.economy.sharePrice)}
          step={showStockPopup === 'buy' ? 1000 : 500}
          bind:value={stockAmount}
          class="w-full h-2 bg-[#1a2234] rounded-full appearance-none cursor-pointer accent-blue-500"
        />
        <div class="flex justify-between mt-1">
          <span class="text-emerald-400 text-lg font-bold">${stockAmount.toLocaleString()}</span>
          <span class="text-xs text-gray-500">≈ {(stockAmount / gs.economy.sharePrice).toFixed(1)}股</span>
        </div>
      </div>

      <!-- Quick buttons -->
      <div class="flex gap-2 mb-4">
        {#each [25, 50, 75, 100] as pct}
          <button
            class="flex-1 py-1.5 rounded-lg bg-[#1a2234] text-xs text-gray-400 border border-[#2a3050] active:scale-95"
            onclick={() => {
              const max = showStockPopup === 'buy' ? gs.economy.cash : gs.economy.portfolioShares * gs.economy.sharePrice;
              stockAmount = Math.round(max * pct / 100);
            }}
          >
            {pct}%
          </button>
        {/each}
      </div>

      <div class="flex gap-2">
        <button
          class="flex-1 py-3 rounded-xl bg-[#1a2234] text-gray-400 text-sm border border-[#2a3050] active:scale-95"
          onclick={() => showStockPopup = null}
        >
          取消
        </button>
        <button
          class="flex-1 py-3 rounded-xl text-white text-sm font-bold active:scale-95 {showStockPopup === 'buy' ? 'bg-emerald-600' : 'bg-red-600'}"
          disabled={stockAmount <= 0}
          onclick={() => {
            if (showStockPopup === 'buy') {
              gs.flags.pendingInvestAmount = stockAmount;
              toggleAction('invest');
            } else {
              gs.flags.pendingSellShares = stockAmount / gs.economy.sharePrice;
              toggleAction('sellStock');
            }
            showStockPopup = null;
          }}
        >
          {showStockPopup === 'buy' ? `买入 $${stockAmount.toLocaleString()}` : `卖出 $${stockAmount.toLocaleString()}`}
        </button>
      </div>
    </div>
  </div>
{/if}
{/if}

<style>
  .animate-fadein { animation: fadein 0.3s ease-out; }
  @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
</style>
