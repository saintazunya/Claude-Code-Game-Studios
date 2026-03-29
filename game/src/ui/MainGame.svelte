<script lang="ts">
  import { gameState, selectedWorkMode, selectedActions, remainingAp, effectiveAp, availableActions, turnInfo, selectWorkModeAction, toggleAction, endTurn, portfolio, healthState, mentalState } from '../engine/store';
  import { getWorkModeCost } from '../engine/game-state';
  import { canSelectAction, ACTIONS } from '../engine/actions';
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

  const workModes = $derived(isAcademic
    ? [
        { id: 'light' as AcademicStudyMode, label: '轻松', cost: 2, color: 'bg-green-900/50 border-green-700' },
        { id: 'normal' as AcademicStudyMode, label: '正常', cost: 4, color: 'bg-blue-900/50 border-blue-600' },
        { id: 'intense' as AcademicStudyMode, label: '拼命', cost: 6, color: 'bg-red-900/50 border-red-700' },
      ]
    : [
        { id: 'coast' as WorkMode, label: '躺平', cost: 2, color: 'bg-green-900/50 border-green-700' },
        { id: 'normal' as WorkMode, label: '正常', cost: 4, color: 'bg-blue-900/50 border-blue-600' },
        { id: 'grind' as WorkMode, label: '卷王', cost: 6, color: 'bg-red-900/50 border-red-700' },
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
      comboCard: 'Combo卡', greenCard: '绿卡', cptDay1: 'CPT',
    };
    return labels[type] || type;
  }

  function healthColor(h: number) {
    if (h > 70) return 'bg-green-500';
    if (h > 30) return 'bg-amber-500';
    return 'bg-red-500';
  }

  function mentalColor(m: number) {
    if (m > 60) return 'bg-blue-500';
    if (m > 30) return 'bg-amber-500';
    return 'bg-red-500';
  }

  function formatMoney(n: number) {
    if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  }

  const canConfirm = $derived(wm !== null);
</script>

{#if gs}
<div class="flex flex-col min-h-dvh bg-[#0a0e17]">
  <!-- Header -->
  <div class="px-4 pt-3 pb-2 bg-gradient-to-b from-[#1a1f35] to-[#111827] border-b border-[#2a3050]">
    <div class="flex justify-between items-center mb-1">
      <div class="text-lg font-bold text-white">
        {ti.year}年 <span class="text-blue-400">Q{ti.quarter}</span>
      </div>
      <div class="px-3 py-0.5 rounded-full bg-[#1e3a5f] text-sky-300 text-xs font-semibold">
        {ti.age}岁
      </div>
    </div>
    <div class="flex items-center gap-2 text-xs">
      <span class="px-2 py-0.5 rounded {visaColor(gs.immigration.visaType)} text-white font-semibold text-[10px]">
        {visaLabel(gs.immigration.visaType)}
      </span>
      <span class="text-gray-500">回合 {gs.turn}/148</span>
      <span class="ml-auto text-gray-500">{gs.economicPhase === 'recession' ? '📉 衰退' : gs.economicPhase === 'boom' ? '📈 繁荣' : gs.economicPhase === 'recovery' ? '📊 复苏' : '📊 正常'}</span>
    </div>
  </div>

  <!-- Stats Grid -->
  <div class="grid grid-cols-2 gap-2 p-3">
    <div class="bg-[#1a2234] rounded-xl p-3 border border-[#2a3050]">
      <div class="text-[10px] text-gray-500">净资产</div>
      <div class="text-lg font-bold text-emerald-400">{formatMoney(gs.attributes.netWorth)}</div>
    </div>
    <div class="bg-[#1a2234] rounded-xl p-3 border border-[#2a3050]">
      <div class="text-[10px] text-gray-500">职业</div>
      <div class="text-lg font-bold text-blue-400">
        {#if gs.career.employed === 'student'}
          {gs.academic.isPhd ? '博士生' : '研究生'}
        {:else if gs.career.employed === 'employed'}
          SDE L{gs.career.level}
        {:else}
          失业
        {/if}
      </div>
    </div>
    <div class="bg-[#1a2234] rounded-xl p-3 border border-[#2a3050]">
      <div class="text-[10px] text-gray-500">S&P 500</div>
      <div class="text-sm font-bold" class:text-emerald-400={pf.unrealizedPnl >= 0} class:text-red-400={pf.unrealizedPnl < 0}>
        {formatMoney(pf.currentValue)}
        <span class="text-[10px]">({pf.unrealizedPnlPercent >= 0 ? '+' : ''}{pf.unrealizedPnlPercent.toFixed(1)}%)</span>
      </div>
    </div>
    <div class="bg-[#1a2234] rounded-xl p-3 border border-[#2a3050]">
      <div class="text-[10px] text-gray-500">绿卡进度</div>
      <div class="text-sm font-bold text-amber-400">
        {#if gs.immigration.hasGreenCard}
          ✅ 已获批
        {:else if gs.immigration.hasComboCard}
          Combo卡
        {:else if gs.immigration.permStatus !== 'none'}
          PERM: {gs.immigration.permStatus}
        {:else}
          未开始
        {/if}
      </div>
    </div>
  </div>

  <!-- Health & Mental Bars -->
  <div class="px-4 space-y-2 mb-3">
    <div>
      <div class="flex justify-between text-[10px] mb-0.5">
        <span class="text-gray-500">健康</span>
        <span class:text-green-400={gs.attributes.health > 70} class:text-amber-400={gs.attributes.health <= 70 && gs.attributes.health > 30} class:text-red-400={gs.attributes.health <= 30}>
          {gs.attributes.health}% — {hs === 'healthy' ? '健康' : hs === 'subhealthy' ? '亚健康' : hs === 'critical' ? '危险' : '住院'}
        </span>
      </div>
      <div class="h-1.5 bg-[#1a2234] rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-300 {healthColor(gs.attributes.health)}" style="width: {gs.attributes.health}%"></div>
      </div>
    </div>
    <div>
      <div class="flex justify-between text-[10px] mb-0.5">
        <span class="text-gray-500">精神</span>
        <span class:text-blue-400={gs.attributes.mental > 60} class:text-amber-400={gs.attributes.mental <= 60 && gs.attributes.mental > 30} class:text-red-400={gs.attributes.mental <= 30}>
          {gs.attributes.mental}% — {ms === 'stable' ? '稳定' : ms === 'stressed' ? '压力大' : ms === 'atRisk' ? '危险' : 'Burnout'}
        </span>
      </div>
      <div class="h-1.5 bg-[#1a2234] rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-300 {mentalColor(gs.attributes.mental)}" style="width: {gs.attributes.mental}%"></div>
      </div>
    </div>
  </div>

  <!-- Work Mode Selection -->
  <div class="px-4 mb-3">
    <p class="text-xs text-gray-500 mb-2">{isAcademic ? '学习模式' : '工作模式'}（必选）</p>
    <div class="grid grid-cols-3 gap-2">
      {#each workModes as mode}
        {@const isGrind = mode.id === 'grind' || mode.id === 'intense'}
        {@const disabled = isGrind && grindLocked}
        <button
          class="py-3 rounded-xl border text-center transition-all text-xs {wm === mode.id ? 'border-blue-500 bg-blue-900/30' : 'border-[#2a3050] bg-[#1a2234]'} {disabled ? 'opacity-40' : ''}"
          {disabled}
          onclick={() => selectWorkModeAction(mode.id)}
        >
          <div class="font-bold text-white">{mode.label}</div>
          <div class="text-gray-500 text-[10px]">{mode.cost} AP</div>
          {#if isGrind && !disabled}
            <div class="text-red-400 text-[10px]">+3 AP</div>
          {/if}
          {#if disabled}
            <div class="text-red-400 text-[10px]">🔒 {gs.grindLockQuarters}季度</div>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <!-- Action List -->
  <div class="flex-1 px-4 overflow-y-auto pb-4">
    <div class="flex justify-between items-center mb-2">
      <p class="text-xs text-gray-500">分配行动点</p>
      <span class="px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-bold">
        AP: {ap} / {wm ? totalAp : '—'}
      </span>
    </div>

    {#if wm}
      {#each available as action}
        {@const isSelected = actions.includes(action.id)}
        {@const check = canSelectAction(action, actions, ap)}
        {@const disabled = !isSelected && !check.allowed}
        <button
          class="w-full flex items-center p-3 mb-2 rounded-xl border transition-all text-left {isSelected ? 'border-blue-500 bg-[#1a2a4a]' : 'border-[#2a3050] bg-[#1a2234]'} {disabled ? 'opacity-40' : ''}"
          {disabled}
          onclick={() => toggleAction(action.id)}
        >
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold text-white">{action.nameZh}</div>
            <div class="text-[10px] text-gray-500 truncate">{action.description}</div>
          </div>
          <div class="ml-2 text-xs font-semibold" class:text-amber-400={!disabled} class:text-gray-600={disabled}>
            {action.apCost}
          </div>
        </button>
      {/each}
    {:else}
      <p class="text-center text-gray-600 text-xs py-8">请先选择{isAcademic ? '学习' : '工作'}模式</p>
    {/if}
  </div>

  <!-- Bottom Bar -->
  <div class="px-4 py-4 bg-[#0d1117] border-t border-[#2a3050]">
    <button
      class="w-full py-4 rounded-2xl text-white text-base font-bold transition-all"
      class:bg-gradient-to-r={canConfirm}
      class:from-blue-600={canConfirm}
      class:to-blue-700={canConfirm}
      class:bg-gray-700={!canConfirm}
      class:opacity-50={!canConfirm}
      disabled={!canConfirm}
      onclick={endTurn}
    >
      结束本季度 ➜
    </button>
  </div>
</div>
{/if}
