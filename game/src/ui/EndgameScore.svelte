<script lang="ts">
  import { gameState, returnToTitle, turnInfo } from '../engine/store';
  import { calculateFinalScore } from '../engine/game-state';

  const gs = $derived($gameState);
  const ti = $derived($turnInfo);
  const score = $derived(gs ? calculateFinalScore(gs) : 0);

  function formatMoney(n: number) {
    return n.toLocaleString('en-US');
  }

  const endingConfig = $derived(() => {
    if (!gs) return { icon: '', title: '', sub: '', gradient: '' };
    switch (gs.endingType) {
      case 'gcBeforeDeadline':
        return { icon: '🏆', title: '美国梦达成', sub: `${ti.age}岁拿到绿卡`, gradient: 'from-emerald-400 to-blue-400' };
      case 'age59WithGc':
        return { icon: '✅', title: '安全着陆', sub: '59岁，绿卡在手', gradient: 'from-green-400 to-teal-400' };
      case 'age59WithoutGc':
        return { icon: '⏰', title: '时间到', sub: '59岁，绿卡未获批', gradient: 'from-amber-400 to-orange-400' };
      case 'deported':
        return { icon: '✈️', title: '被迫回国', sub: '签证到期', gradient: 'from-red-400 to-red-600' };
      case 'voluntaryDeparture':
        return { icon: '🏠', title: '选择回国', sub: '主动离开', gradient: 'from-gray-400 to-gray-500' };
      default:
        return { icon: '🎮', title: '游戏结束', sub: '', gradient: 'from-gray-400 to-gray-500' };
    }
  });

  const ending = $derived(endingConfig());

  // Find peak career level
  const peakLevel = $derived(gs ? Math.max(...gs.timeline.map(r => {
    // Simple approximation - just use current level
    return gs.career.level;
  })) : 3);
</script>

{#if gs}
<div class="flex flex-col min-h-dvh bg-[#0a0e17] text-gray-200">
  <div class="flex-1 px-5 pt-10 pb-4 overflow-y-auto">
    <!-- Victory Banner -->
    <div class="text-center mb-8">
      <div class="text-6xl mb-3">{ending.icon}</div>
      <h1 class="text-3xl font-black bg-gradient-to-r {ending.gradient} bg-clip-text text-transparent">
        {ending.title}
      </h1>
      <p class="text-sm text-gray-500 mt-1">{ending.sub}</p>
    </div>

    <!-- Score -->
    <div class="bg-gradient-to-br from-[#1a2a3a] to-[#1a2234] rounded-2xl p-6 border border-[#2a4060] text-center mb-6">
      <div class="text-xs text-gray-500 mb-1">最终得分</div>
      <div class="text-4xl font-black text-emerald-400">{formatMoney(score)}</div>
      <div class="flex justify-center gap-6 mt-3 text-xs text-gray-500">
        <div class="text-center">
          <div class="text-white font-semibold">${formatMoney(Math.max(0, gs.attributes.netWorth))}</div>
          <div>净资产</div>
        </div>
        <div class="text-center">
          <div class="text-white font-semibold">{gs.immigration.hasGreenCard ? '×1.5' : '×1.0'}</div>
          <div>绿卡加成</div>
        </div>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-2 gap-3 mb-6">
      <div class="bg-[#1a2234] rounded-xl p-4 border border-[#2a3050] text-center">
        <div class="text-[10px] text-gray-500">职业巅峰</div>
        <div class="text-base font-bold text-blue-400">SDE L{gs.career.level}</div>
      </div>
      <div class="bg-[#1a2234] rounded-xl p-4 border border-[#2a3050] text-center">
        <div class="text-[10px] text-gray-500">最终净资产</div>
        <div class="text-base font-bold text-emerald-400">${formatMoney(Math.max(0, gs.attributes.netWorth))}</div>
      </div>
      <div class="bg-[#1a2234] rounded-xl p-4 border border-[#2a3050] text-center">
        <div class="text-[10px] text-gray-500">游戏回合</div>
        <div class="text-base font-bold text-amber-400">{gs.turn}/148</div>
      </div>
      <div class="bg-[#1a2234] rounded-xl p-4 border border-[#2a3050] text-center">
        <div class="text-[10px] text-gray-500">经济状态</div>
        <div class="text-base font-bold text-purple-400">{gs.economicPhase}</div>
      </div>
    </div>

    <!-- Timeline (simplified) -->
    <div class="mb-6">
      <h2 class="text-xs text-gray-500 mb-3">人生轨迹</h2>
      <div class="space-y-0">
        {#each gs.timeline.filter((_, i) => i % 4 === 0).slice(0, 20) as record, i}
          <div class="flex gap-3 relative">
            <div class="flex flex-col items-center">
              <div class="w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-[#0a0e17] z-10"></div>
              {#if i < 19}
                <div class="w-0.5 h-6 bg-[#2a3a5a]"></div>
              {/if}
            </div>
            <div class="pb-3">
              <div class="text-[10px] text-gray-600">{record.age}岁</div>
              <div class="text-xs text-gray-300">
                绩效{Math.round(record.attributesAfter.performance)} · 健康{Math.round(record.attributesAfter.health)} · 净资产${Math.round(record.attributesAfter.netWorth / 1000)}K
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Bottom Buttons -->
  <div class="px-5 pb-8 pt-2 flex gap-3">
    <button
      class="flex-1 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-base font-bold active:scale-[0.98] transition-transform"
      onclick={returnToTitle}
    >
      再来一局
    </button>
  </div>
</div>
{/if}
