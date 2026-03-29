<script lang="ts">
  import { gameState, selectedWorkMode, selectedActions, remainingAp, effectiveAp, availableActions, turnInfo, selectWorkModeAction, toggleAction, endTurn, portfolio, healthState, mentalState } from '../engine/store';
  import { getWorkModeCost } from '../engine/game-state';
  import { canSelectAction, ACTIONS } from '../engine/actions';
  import { computeSicknessChance } from '../engine/attributes';
  import type { WorkMode, AcademicStudyMode, ActionId } from '../engine/types';

  const gs = $derived($gameState);
  const ti = $derived($turnInfo);
  const ap = $derived($remainingAp);
  const totalAp = $derived($effectiveAp);
  const wm = $derived($selectedWorkMode);
  const actions = $derived($selectedActions);
  const available = $derived($availableActions);
  const pf = $derived($portfolio);
  const hs = $derived($healthState);
  const ms = $derived($mentalState);

  const isAcademic = $derived(gs?.phase === 'academic');
  const sicknessChance = $derived(gs ? Math.round(computeSicknessChance(gs) * 100) : 0);
  const turnProgress = $derived(gs ? (gs.turn / 148) * 100 : 0);

  const workModes = $derived(isAcademic
    ? [
        { id: 'light' as AcademicStudyMode, label: '轻松', emoji: '☕', cost: 3, desc: '技能+2, 精神+3' },
        { id: 'normal' as AcademicStudyMode, label: '正常', emoji: '📚', cost: 4, desc: '技能+5, 精神-2' },
        { id: 'intense' as AcademicStudyMode, label: '拼命', emoji: '🔥', cost: 4, desc: '技能+8, 健康-10, +3AP' },
      ]
    : [
        { id: 'coast' as WorkMode, label: '躺平', emoji: '🛋️', cost: 3, desc: '绩效-5, 精神+3' },
        { id: 'normal' as WorkMode, label: '正常', emoji: '💼', cost: 4, desc: '绩效+5, 精神-2' },
        { id: 'grind' as WorkMode, label: '卷王', emoji: '🔥', cost: 4, desc: '绩效+15, 健康-15, +3AP' },
      ]
  );

  const grindLocked = $derived((gs?.grindLockQuarters ?? 0) > 0);

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
      upskill: '📖', prepJobChange: '🔍', prepJobChangeIntensive: '🎯',
      entrepreneurship: '🚀', prepH1b: '📋', researchNiw: '📝',
      publishPaper: '📄', consultLawyer: '⚖️', rest: '😴', travel: '✈️',
      exercise: '🏃', therapist: '🧠', studyGpa: '📚', searchIntern: '🔎',
      thesisResearch: '🔬', taRaWork: '👨‍🏫', networking: '🤝',
      sideProject: '💻', urgentJobSearch: '🆘',
    };
    return icons[id] || '📌';
  }

  const canConfirm = $derived(wm !== null);

  // Unspent AP warning
  const unspentWarning = $derived(wm && ap > 2);
</script>

{#if gs}
<div class="flex flex-col min-h-dvh bg-[#0a0e17] animate-fadein">
  <!-- Progress Bar (top of screen) -->
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
      </div>
    </div>
    <div class="flex items-center gap-2 text-[10px]">
      <span class="text-gray-500">回合 {gs.turn}/148</span>
      <span class="text-gray-700">|</span>
      <span class="text-gray-500">
        {gs.economicPhase === 'recession' ? '📉 经济衰退' : gs.economicPhase === 'boom' ? '📈 经济繁荣' : gs.economicPhase === 'recovery' ? '📊 经济复苏' : '📊 经济平稳'}
      </span>
      {#if gs.career.employed === 'employed' && gs.career.company}
        <span class="ml-auto text-gray-600 truncate max-w-[100px]">{gs.career.company.name}</span>
      {/if}
    </div>
  </div>

  <!-- Stats Grid -->
  <div class="grid grid-cols-2 gap-2 p-3">
    <div class="bg-[#1a2234] rounded-xl p-3 border border-[#2a3050] relative overflow-hidden">
      <div class="text-[10px] text-gray-500 mb-0.5">净资产</div>
      <div class="text-xl font-black text-emerald-400">{formatMoney(gs.attributes.netWorth)}</div>
      <div class="text-[10px] text-gray-600">现金 {formatMoney(gs.economy.cash)}</div>
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
      <!-- Academic: GPA card -->
      <div class="bg-[#1a2234] rounded-xl p-3 border border-[#2a3050]">
        <div class="text-[10px] text-gray-500 mb-0.5">GPA</div>
        <div class="text-xl font-black {gs.academic.gpa >= 3.7 ? 'text-green-400' : gs.academic.gpa >= 3.3 ? 'text-blue-400' : gs.academic.gpa >= 3.0 ? 'text-amber-400' : 'text-red-400'}">
          {gs.academic.gpa.toFixed(2)}
        </div>
        <div class="text-[10px] text-gray-600">
          {gs.academic.gpa >= 3.7 ? '优秀 — 实习加成大' : gs.academic.gpa >= 3.3 ? '良好 — 有一定加成' : gs.academic.gpa >= 3.0 ? '及格 — 加成很小' : '偏低 — 会拖后腿'}
        </div>
      </div>
      <!-- Academic: Intern status card -->
      <div class="bg-[#1a2234] rounded-xl p-3 border border-[#2a3050]">
        <div class="text-[10px] text-gray-500 mb-0.5">实习</div>
        {#if gs.academic.hadIntern}
          <div class="text-lg font-bold text-green-400">
            ✅ {gs.academic.internQuality === 'top' ? '大厂实习' : '普通实习'}
          </div>
          <div class="text-[10px] text-gray-600">找工作概率{gs.academic.internQuality === 'top' ? '+40%' : '+25%'}</div>
        {:else}
          <div class="text-lg font-bold text-gray-500">❌ 还没有</div>
          <div class="text-[10px] text-red-400/60">无实习→找工作概率大幅下降</div>
        {/if}
      </div>
    {:else}
      <!-- Career: S&P 500 -->
      <div class="bg-[#1a2234] rounded-xl p-3 border border-[#2a3050]">
        <div class="text-[10px] text-gray-500 mb-0.5">S&P 500</div>
        {#if pf.currentValue > 0}
          <div class="text-sm font-bold {pf.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}">
            {formatMoney(pf.currentValue)}
          </div>
          <div class="text-[10px] {pf.unrealizedPnl >= 0 ? 'text-emerald-500/60' : 'text-red-500/60'}">
            {pf.unrealizedPnlPercent >= 0 ? '+' : ''}{pf.unrealizedPnlPercent.toFixed(1)}%
          </div>
        {:else}
          <div class="text-sm text-gray-600">未投资</div>
        {/if}
      </div>
      <!-- Career: Green card -->
      <div class="bg-[#1a2234] rounded-xl p-3 border border-[#2a3050]">
        <div class="text-[10px] text-gray-500 mb-0.5">绿卡</div>
        <div class="text-sm font-bold">
          {#if gs.immigration.hasGreenCard}
            <span class="text-green-400">✅ 已获批</span>
          {:else if gs.immigration.hasComboCard}
            <span class="text-teal-400">🎫 Combo卡</span>
          {:else if gs.immigration.i140Status === 'approved'}
            <span class="text-purple-400">📋 等排期中</span>
          {:else if gs.immigration.permStatus !== 'none'}
            <span class="text-amber-400">⏳ PERM: {gs.immigration.permStatus === 'pending' ? '审批中' : gs.immigration.permStatus === 'audited' ? '被Audit' : gs.immigration.permStatus === 'approved' ? '已批准' : gs.immigration.permStatus === 'filing' ? '提交中' : '准备中'}</span>
          {:else}
            <span class="text-gray-500">未开始</span>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Health & Mental Bars -->
  <div class="px-4 space-y-2.5 mb-3">
    <div>
      <div class="flex justify-between text-[10px] mb-1">
        <span class="text-gray-500">💪 健康</span>
        <span class="{gs.attributes.health > 70 ? 'text-green-400' : gs.attributes.health > 30 ? 'text-amber-400' : 'text-red-400'}">
          {Math.round(gs.attributes.health)}% — {hs === 'healthy' ? '健康' : hs === 'subhealthy' ? '亚健康' : hs === 'critical' ? '⚠️ 危险' : '🏥 住院'}
          {#if sicknessChance > 10}
            <span class="text-gray-600 ml-1">(生病{sicknessChance}%)</span>
          {/if}
        </span>
      </div>
      <div class="h-2 bg-[#1a2234] rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-500 ease-out {healthBarColor(gs.attributes.health)}" style="width: {gs.attributes.health}%"></div>
      </div>
    </div>
    <div>
      <div class="flex justify-between text-[10px] mb-1">
        <span class="text-gray-500">🧠 精神</span>
        <span class="{gs.attributes.mental > 60 ? 'text-blue-400' : gs.attributes.mental > 30 ? 'text-amber-400' : 'text-red-400'}">
          {Math.round(gs.attributes.mental)}% — {ms === 'stable' ? '稳定' : ms === 'stressed' ? '压力大' : ms === 'atRisk' ? '⚠️ 高危' : '💀 Burnout'}
        </span>
      </div>
      <div class="h-2 bg-[#1a2234] rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-500 ease-out {mentalBarColor(gs.attributes.mental)}" style="width: {gs.attributes.mental}%"></div>
      </div>
    </div>
  </div>

  <!-- Skills & Academic (compact) -->
  <div class="px-4 flex gap-3 mb-3 text-[10px]">
    <div class="flex items-center gap-1 text-gray-500">
      <span>📊 技能</span>
      <span class="text-gray-300 font-semibold">{Math.round(gs.attributes.skills)}</span>
    </div>
    <div class="flex items-center gap-1 text-gray-500">
      <span>📚 学术</span>
      <span class="text-gray-300 font-semibold">{Math.round(gs.attributes.academicImpact)}</span>
    </div>
    {#if isAcademic}
      <div class="flex items-center gap-1 text-gray-500">
        <span>📝 GPA</span>
        <span class="text-gray-300 font-semibold">{gs.academic.gpa.toFixed(2)}</span>
      </div>
      {#if gs.academic.hadIntern}
        <div class="text-green-400 font-semibold">✅ 实习 ({gs.academic.internQuality === 'top' ? '大厂' : '普通'})</div>
      {:else}
        <div class="text-gray-600">❌ 无实习</div>
      {/if}
    {/if}
  </div>

  <!-- Academic Progress Bar -->
  {#if isAcademic}
    {@const gradTurn = gs.academic.isPhd ? 16 : 8}
    {@const progress = Math.min(100, (gs.turn / gradTurn) * 100)}
    {@const turnsLeft = gradTurn - gs.turn}
    <div class="px-4 mb-3">
      <div class="bg-[#1a2234] rounded-xl p-3 border border-[#2a3050]">
        <div class="flex justify-between text-[10px] mb-1.5">
          <span class="text-gray-500">🎓 {gs.academic.isPhd ? '博士' : '硕士'}进度</span>
          <span class="text-blue-400 font-semibold">还剩 {turnsLeft} 个季度毕业</span>
        </div>
        <div class="h-2.5 bg-[#111827] rounded-full overflow-hidden">
          <div class="h-full rounded-full bg-gradient-to-r from-blue-600 to-purple-500 transition-all duration-500" style="width: {progress}%"></div>
        </div>
        <div class="flex justify-between text-[9px] text-gray-600 mt-1">
          <span>入学</span>
          {#if !gs.academic.isPhd && gs.turn < 8}
            <span>第{gs.turn}学期 / 共8学期</span>
          {:else if gs.academic.isPhd}
            <span>第{gs.turn}学期 / 共16学期（博士需要5次论文研究: {gs.academic.thesisPoints}/5）</span>
          {/if}
          <span>毕业</span>
        </div>
      </div>
    </div>
  {/if}

  <!-- Work Mode Selection -->
  <div class="px-4 mb-3">
    <p class="text-xs text-gray-500 mb-2">{isAcademic ? '学习模式' : '工作模式'}（必选一个）</p>
    <div class="grid grid-cols-3 gap-2">
      {#each workModes as mode}
        {@const isGrind = mode.id === 'grind' || mode.id === 'intense'}
        {@const disabled = isGrind && grindLocked}
        {@const selected = wm === mode.id}
        <button
          class="py-2.5 rounded-xl border text-center transition-all duration-200 {selected ? 'border-blue-500 bg-blue-900/30 shadow-lg shadow-blue-500/10 scale-[1.02]' : 'border-[#2a3050] bg-[#1a2234]'} {disabled ? 'opacity-30' : 'active:scale-95'}"
          {disabled}
          onclick={() => selectWorkModeAction(mode.id)}
        >
          <div class="text-lg">{mode.emoji}</div>
          <div class="text-xs font-bold text-white">{mode.label}</div>
          <div class="text-gray-500 text-[9px]">{mode.cost} AP</div>
          <div class="text-[8px] text-gray-600 mt-0.5">{mode.desc}</div>
          {#if isGrind && !disabled}
            <div class="text-red-400 text-[9px] font-bold mt-0.5">+3 AP</div>
          {/if}
          {#if disabled}
            <div class="text-red-400 text-[9px]">🔒 {gs.grindLockQuarters}Q</div>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <!-- Action List -->
  <div class="flex-1 px-4 overflow-y-auto pb-4">
    <div class="flex justify-between items-center mb-2">
      <p class="text-xs text-gray-500">分配行动点</p>
      <div class="flex items-center gap-1.5">
        {#if unspentWarning}
          <span class="text-[10px] text-amber-500 animate-pulse">剩余AP!</span>
        {/if}
        <span class="px-2.5 py-0.5 rounded-full bg-amber-500/90 text-black text-[10px] font-bold">
          AP: {ap} / {wm ? totalAp : '—'}
        </span>
      </div>
    </div>

    {#if wm}
      <div class="space-y-2">
        {#each available as action}
          {@const isSelected = actions.includes(action.id)}
          {@const check = canSelectAction(action, actions, ap)}
          {@const disabled = !isSelected && !check.allowed}
          <button
            class="w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-150 text-left {isSelected ? 'border-blue-500 bg-[#1a2a4a] shadow-md shadow-blue-500/5' : 'border-[#2a3050] bg-[#1a2234]'} {disabled ? 'opacity-30' : 'active:scale-[0.98]'}"
            {disabled}
            onclick={() => toggleAction(action.id)}
          >
            <div class="text-lg w-8 text-center flex-shrink-0">{actionIcon(action.id)}</div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold text-white">{action.nameZh}</div>
              {#if action.tipsZh}
                <div class="text-[10px] text-gray-500 leading-relaxed mt-0.5">{action.tipsZh}</div>
              {:else}
                <div class="text-[10px] text-gray-500 truncate">{action.description}</div>
              {/if}
            </div>
            <div class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold {isSelected ? 'bg-blue-500 text-white' : disabled ? 'bg-[#111827] text-gray-600' : 'bg-amber-500/20 text-amber-400'}">
              {action.apCost}
            </div>
          </button>
        {/each}
      </div>
    {:else}
      <div class="text-center py-12">
        <div class="text-3xl mb-2">👆</div>
        <p class="text-gray-600 text-xs">请先选择{isAcademic ? '学习' : '工作'}模式</p>
      </div>
    {/if}
  </div>

  <!-- Bottom Bar -->
  <div class="px-4 py-3 bg-[#0d1117] border-t border-[#2a3050]">
    <button
      class="w-full py-4 rounded-2xl text-white text-base font-bold transition-all duration-200 {canConfirm ? 'bg-gradient-to-r from-blue-600 to-blue-700 active:scale-[0.98] shadow-lg shadow-blue-600/20' : 'bg-gray-800 opacity-40'}"
      disabled={!canConfirm}
      onclick={endTurn}
    >
      结束本季度 ➜
    </button>
  </div>
</div>
{/if}

<style>
  .animate-fadein {
    animation: fadein 0.3s ease-out;
  }
  @keyframes fadein {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
