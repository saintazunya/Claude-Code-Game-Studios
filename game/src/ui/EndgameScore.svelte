<script lang="ts">
  import { gameState, returnToTitle, turnInfo, exportGameLog, shareGameResult } from '../engine/store';

  let shareStatus = $state('');
  import { calculateFinalScore, getTurnInfo } from '../engine/game-state';

  const gs = $derived($gameState);
  const ti = $derived($turnInfo);
  const score = $derived(gs ? calculateFinalScore(gs) : 0);

  function formatMoney(n: number) {
    return n.toLocaleString('en-US');
  }

  function formatShort(n: number) {
    if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(0)}K`;
    return `$${Math.round(n)}`;
  }

  const ending = $derived(() => {
    if (!gs) return { icon: '', title: '', sub: '', gradient: '', won: false };
    switch (gs.endingType) {
      case 'gcBeforeDeadline':
        return { icon: '🏆', title: '美国梦达成', sub: `${ti.age}岁拿到绿卡`, gradient: 'from-emerald-400 to-blue-400', won: true };
      case 'age59WithGc':
        return { icon: '✅', title: '安全着陆', sub: '59岁，绿卡在手', gradient: 'from-green-400 to-teal-400', won: true };
      case 'age59WithoutGc':
        return { icon: '⏰', title: '时间到', sub: '59岁，仍在等待绿卡...', gradient: 'from-amber-400 to-orange-400', won: false };
      case 'deported':
        return { icon: '✈️', title: '被迫回国', sub: '签证到期，梦断异乡', gradient: 'from-red-400 to-red-600', won: false };
      case 'voluntaryDeparture':
        return { icon: '🏠', title: '落叶归根', sub: '选择回国', gradient: 'from-gray-400 to-gray-500', won: false };
      default:
        return { icon: '🎮', title: '游戏结束', sub: '', gradient: 'from-gray-400 to-gray-500', won: false };
    }
  });

  const e = $derived(ending());

  // Extract milestone events from timeline
  const milestoneEvents = $derived(() => {
    if (!gs) return [];
    const highlights: { age: number; text: string; color: string; icon: string }[] = [];

    const milestoneMap: Record<string, { text: string; color: string; icon: string }> = {
      masters_graduated: { text: '硕士毕业', color: 'bg-blue-500', icon: '🎓' },
      phd_graduated: { text: '博士毕业', color: 'bg-blue-500', icon: '🎓' },
      first_job_found: { text: '找到第一份工作', color: 'bg-green-500', icon: '💼' },
      h1b_approved: { text: 'H-1B抽中', color: 'bg-purple-500', icon: '🎊' },
      h1b_denied: { text: 'H-1B未中签', color: 'bg-red-500', icon: '😰' },
      promoted: { text: '升职', color: 'bg-blue-500', icon: '🎉' },
      laid_off: { text: '被裁员', color: 'bg-red-500', icon: '💥' },
      perm_approved: { text: 'PERM批准', color: 'bg-amber-500', icon: '📋' },
      i140_approved: { text: 'I-140批准', color: 'bg-purple-500', icon: '✅' },
      i485_filed_combo_card: { text: 'Combo卡到手', color: 'bg-teal-500', icon: '🎫' },
      green_card_approved: { text: '绿卡批准！', color: 'bg-green-500', icon: '🏆' },
      pip_started: { text: '收到PIP', color: 'bg-red-500', icon: '⚠️' },
      pip_terminated: { text: 'PIP被开除', color: 'bg-red-500', icon: '💔' },
    };

    for (const record of gs.timeline) {
      for (const ev of record.events) {
        if (milestoneMap[ev.id]) {
          const m = milestoneMap[ev.id];
          highlights.push({ age: record.age, ...m });
        }
      }
    }

    return highlights;
  });

  // Net worth history (yearly snapshots)
  const nwHistory = $derived(() => {
    if (!gs) return [];
    return gs.timeline
      .filter((_, i) => i % 4 === 3) // every 4th record = yearly
      .map(r => ({
        age: r.age,
        nw: r.attributesAfter.netWorth,
      }));
  });

  const maxNw = $derived(Math.max(1, ...nwHistory().map(h => Math.abs(h.nw))));
</script>

{#if gs}
<div class="flex flex-col min-h-dvh bg-[#0a0e17] text-gray-200">
  <div class="flex-1 px-5 pt-8 pb-4 overflow-y-auto">
    <!-- Victory/Defeat Banner -->
    <div class="text-center mb-6 animate-entrance">
      <div class="text-7xl mb-3 {e.won ? 'animate-bounce-slow' : ''}">{e.icon}</div>
      <h1 class="text-3xl font-black bg-gradient-to-r {e.gradient} bg-clip-text text-transparent mb-1">
        {e.title}
      </h1>
      <p class="text-sm text-gray-400">{e.sub}</p>
    </div>

    <!-- Score -->
    <div class="bg-gradient-to-br from-[#1a2a3a] to-[#1a2234] rounded-2xl p-5 border border-[#2a4060] text-center mb-5 animate-entrance-delay">
      <div class="text-[10px] text-gray-500 tracking-wider mb-1">最终得分</div>
      <div class="text-4xl font-black text-emerald-400 mb-3 tabular-nums">{formatMoney(score)}</div>
      <div class="flex justify-center gap-5 text-xs text-gray-500">
        <div class="text-center">
          <div class="text-sm text-white font-bold">{formatShort(Math.max(0, gs.attributes.netWorth))}</div>
          <div>净资产</div>
        </div>
        <div class="text-center">
          <div class="text-sm text-white font-bold">{gs.immigration.hasGreenCard ? '×1.5' : gs.endingType === 'deported' ? '×0.8' : '×1.0'}</div>
          <div>绿卡加成</div>
        </div>
        {#if gs.immigration.hasGreenCard}
          <div class="text-center">
            <div class="text-sm text-white font-bold">+{formatShort(Math.max(0, (59 - ti.age) * 10000))}</div>
            <div>提前奖励</div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-2 gap-2.5 mb-5">
      <div class="bg-[#1a2234] rounded-xl p-3.5 border border-[#2a3050] text-center">
        <div class="text-[10px] text-gray-500 mb-1">职业巅峰</div>
        <div class="text-base font-bold text-blue-400">SDE L{gs.career.level}</div>
      </div>
      <div class="bg-[#1a2234] rounded-xl p-3.5 border border-[#2a3050] text-center">
        <div class="text-[10px] text-gray-500 mb-1">最终净资产</div>
        <div class="text-base font-bold text-emerald-400">{formatShort(Math.max(0, gs.attributes.netWorth))}</div>
      </div>
      <div class="bg-[#1a2234] rounded-xl p-3.5 border border-[#2a3050] text-center">
        <div class="text-[10px] text-gray-500 mb-1">游玩回合</div>
        <div class="text-base font-bold text-amber-400">{gs.turn} / 148</div>
      </div>
      <div class="bg-[#1a2234] rounded-xl p-3.5 border border-[#2a3050] text-center">
        <div class="text-[10px] text-gray-500 mb-1">初始Build</div>
        <div class="text-base font-bold text-purple-400">{gs.creation.constitution}/{gs.creation.schoolRanking}/{gs.creation.geoLocation}</div>
      </div>
    </div>

    <!-- Net Worth Chart -->
    {#if nwHistory().length > 0}
      <div class="bg-[#1a2234] rounded-xl p-4 border border-[#2a3050] mb-5">
        <div class="text-[10px] text-gray-500 font-semibold mb-3 tracking-wider">净资产变化</div>
        <div class="flex items-end gap-[2px] h-20">
          {#each nwHistory() as point, i}
            {@const height = Math.max(2, (Math.abs(point.nw) / maxNw) * 100)}
            {@const isNeg = point.nw < 0}
            <div
              class="flex-1 rounded-t-sm transition-all duration-300 {isNeg ? 'bg-red-500' : gs.immigration.hasGreenCard && i > nwHistory().length * 0.6 ? 'bg-emerald-500' : 'bg-blue-500/70'}"
              style="height: {height}%; animation-delay: {i * 30}ms"
              title="{point.age}岁: {formatShort(point.nw)}"
            ></div>
          {/each}
        </div>
        <div class="flex justify-between text-[9px] text-gray-600 mt-1.5">
          <span>{nwHistory()[0]?.age}岁</span>
          <span>{nwHistory()[Math.floor(nwHistory().length / 2)]?.age}岁</span>
          <span>{nwHistory()[nwHistory().length - 1]?.age}岁</span>
        </div>
      </div>
    {/if}

    <!-- Life Timeline -->
    {#if milestoneEvents().length > 0}
      <div class="mb-5">
        <div class="text-[10px] text-gray-500 font-semibold mb-3 tracking-wider">人生轨迹</div>
        <div class="space-y-0">
          {#each milestoneEvents() as m, i}
            <div class="flex gap-3 animate-milestone" style="animation-delay: {i * 80}ms">
              <div class="flex flex-col items-center">
                <div class="w-3 h-3 rounded-full {m.color} border-2 border-[#0a0e17] z-10 flex-shrink-0"></div>
                {#if i < milestoneEvents().length - 1}
                  <div class="w-0.5 flex-1 min-h-[20px] bg-[#2a3a5a]"></div>
                {/if}
              </div>
              <div class="pb-3 -mt-0.5">
                <div class="text-[10px] text-gray-600">{m.age}岁</div>
                <div class="text-xs text-gray-200">{m.icon} {m.text}</div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- Bottom Buttons -->
  <div class="px-5 pb-6 pt-2 space-y-2">
    <!-- Share button -->
    <button
      class="w-full py-4 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 text-white text-base font-bold active:scale-[0.98] transition-transform shadow-lg shadow-green-600/20"
      onclick={async () => {
        const ok = await shareGameResult();
        shareStatus = ok ? '已复制到剪贴板！' : '分享失败';
        setTimeout(() => shareStatus = '', 3000);
      }}
    >
      📤 分享我的移民之路
    </button>
    {#if shareStatus}
      <p class="text-xs text-green-400 text-center">{shareStatus}</p>
    {/if}

    <div class="flex gap-3">
      <button
        class="flex-1 py-3 rounded-2xl bg-[#1a2234] text-gray-400 text-sm font-bold border border-[#2a3050] active:scale-[0.98] transition-transform"
        onclick={exportGameLog}
      >
        📥 下载记录
      </button>
      <button
        class="flex-1 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-bold active:scale-[0.98] transition-transform shadow-lg shadow-blue-600/20"
        onclick={returnToTitle}
      >
        再来一局
      </button>
    </div>
    <p class="text-[9px] text-gray-700 text-center">游戏自动保存 · 可从标题页恢复</p>
  </div>
</div>
{/if}

<style>
  .animate-entrance {
    animation: entrance 0.6s ease-out;
  }
  .animate-entrance-delay {
    animation: entrance 0.6s ease-out 0.2s both;
  }
  @keyframes entrance {
    from { opacity: 0; transform: translateY(20px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .animate-bounce-slow {
    animation: bounceSlow 2s ease-in-out infinite;
  }
  @keyframes bounceSlow {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
  .animate-milestone {
    animation: milestoneIn 0.4s ease-out both;
  }
  @keyframes milestoneIn {
    from { opacity: 0; transform: translateX(-10px); }
    to { opacity: 1; transform: translateX(0); }
  }
</style>
