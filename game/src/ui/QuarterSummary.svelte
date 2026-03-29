<script lang="ts">
  import { gameState, continueTurn, turnInfo } from '../engine/store';

  const gs = $derived($gameState);
  const ti = $derived($turnInfo);

  function formatMoney(n: number) {
    if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  }

  function delta(before: number, after: number) {
    const d = after - before;
    if (d > 0) return { text: `+${d}`, color: 'text-green-400', arrow: '↑' };
    if (d < 0) return { text: `${d}`, color: 'text-red-400', arrow: '↓' };
    return { text: '—', color: 'text-gray-500', arrow: '' };
  }

  const lastRecord = $derived(gs?.timeline[gs.timeline.length - 1]);
</script>

{#if gs && lastRecord}
<div class="flex flex-col min-h-dvh bg-[#0a0e17] text-gray-200">
  <div class="flex-1 px-5 pt-8 pb-4 overflow-y-auto">
    <h1 class="text-lg font-bold text-white mb-1">{ti.year}年 Q{ti.quarter} 季度总结</h1>
    <p class="text-xs text-gray-500 mb-6">{ti.age}岁 · 回合 {gs.turn}/148</p>

    <!-- Attribute Changes -->
    <div class="bg-[#1a2234] rounded-xl p-4 border border-[#2a3050] mb-4">
      <h2 class="text-xs text-gray-500 mb-3">属性变化</h2>
      {#each [
        { name: '绩效', key: 'performance' },
        { name: '技能', key: 'skills' },
        { name: '健康', key: 'health' },
        { name: '精神', key: 'mental' },
        { name: '学术', key: 'academicImpact' },
      ] as attr}
        {@const before = lastRecord.attributesBefore[attr.key as keyof typeof lastRecord.attributesBefore] as number}
        {@const after = lastRecord.attributesAfter[attr.key as keyof typeof lastRecord.attributesAfter] as number}
        {@const d = delta(before, after)}
        <div class="flex justify-between items-center py-1.5 border-b border-[#2a3050] last:border-0">
          <span class="text-xs text-gray-400">{attr.name}</span>
          <span class="text-xs">
            <span class="text-gray-500">{Math.round(before)}</span>
            <span class="text-gray-600 mx-1">→</span>
            <span class="text-white font-semibold">{Math.round(after)}</span>
            <span class="ml-1 {d.color}">{d.text} {d.arrow}</span>
          </span>
        </div>
      {/each}
    </div>

    <!-- Financial Summary -->
    <div class="bg-[#1a2234] rounded-xl p-4 border border-[#2a3050] mb-4">
      <h2 class="text-xs text-gray-500 mb-3">财务概况</h2>
      <div class="flex justify-between py-1.5">
        <span class="text-xs text-gray-400">净资产</span>
        <span class="text-sm font-bold text-emerald-400">{formatMoney(gs.attributes.netWorth)}</span>
      </div>
      <div class="flex justify-between py-1.5">
        <span class="text-xs text-gray-400">现金</span>
        <span class="text-xs text-white">{formatMoney(gs.economy.cash)}</span>
      </div>
      <div class="flex justify-between py-1.5">
        <span class="text-xs text-gray-400">S&P 500</span>
        <span class="text-xs text-white">{formatMoney(gs.economy.portfolioShares * gs.economy.sharePrice)}</span>
      </div>
      {#if gs.economy.ownsHome}
        <div class="flex justify-between py-1.5">
          <span class="text-xs text-gray-400">房产净值</span>
          <span class="text-xs text-white">{formatMoney(gs.economy.homeValue - gs.economy.homeMortgageRemaining)}</span>
        </div>
      {/if}
    </div>

    <!-- Immigration Status -->
    <div class="bg-[#1a2234] rounded-xl p-4 border border-[#2a3050] mb-4">
      <h2 class="text-xs text-gray-500 mb-3">移民身份</h2>
      <div class="flex justify-between py-1.5">
        <span class="text-xs text-gray-400">当前签证</span>
        <span class="text-xs text-white font-semibold">{gs.immigration.visaType.toUpperCase()}</span>
      </div>
      {#if gs.immigration.permStatus !== 'none'}
        <div class="flex justify-between py-1.5">
          <span class="text-xs text-gray-400">PERM</span>
          <span class="text-xs text-purple-400">{gs.immigration.permStatus}</span>
        </div>
      {/if}
      {#if gs.immigration.hasGreenCard}
        <div class="text-center py-2 text-green-400 font-bold">🎉 绿卡已批准！</div>
      {/if}
    </div>
  </div>

  <div class="px-5 pb-8 pt-2">
    <button
      class="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-base font-bold active:scale-[0.98] transition-transform"
      onclick={continueTurn}
    >
      继续 ➜
    </button>
  </div>
</div>
{/if}
