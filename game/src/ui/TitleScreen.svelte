<script lang="ts">
  import { screen, resumeGame, refreshSaveList, saveList } from '../engine/store';
  import type { SaveMeta } from '../engine/save';

  try { refreshSaveList(); } catch(e) { console.warn('Could not load saves:', e); }
  const saves = $derived($saveList);
  let showSaves = $state(false);

  let resumeError = $state('');

  function formatMoney(n: number) {
    if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(0)}K`;
    return `$${n}`;
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function handleResume(id: string) {
    const ok = resumeGame(id);
    if (!ok) {
      resumeError = '存档加载失败';
      setTimeout(() => resumeError = '', 2000);
    }
  }
</script>

<div class="flex flex-col items-center justify-center min-h-dvh px-6 bg-[#0a0e17]">
  <div class="animate-float">
    <div class="text-7xl mb-6">🗽</div>
  </div>

  <h1 class="text-4xl font-black text-white mb-1 tracking-tight animate-title">绿卡之路</h1>
  <p class="text-sm text-gray-500 mb-1 animate-subtitle">Green Card Odyssey</p>
  <div class="w-12 h-0.5 bg-gradient-to-r from-transparent via-gray-600 to-transparent my-3"></div>
  <p class="text-xs text-gray-600 mb-8 text-center max-w-[260px] leading-relaxed animate-subtitle">
    一代移民的美国梦模拟器<br>
    从留学到绿卡，每个选择都有代价
  </p>

  <button
    class="w-full max-w-[280px] py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-lg font-bold active:scale-[0.97] transition-all shadow-lg shadow-blue-600/25 animate-btn"
    onclick={() => screen.set('creation')}
  >
    开始新游戏
  </button>

  <!-- Resume Game -->
  {#if saves.length > 0}
    <button
      class="w-full max-w-[280px] py-3 mt-3 rounded-2xl bg-[#1a2234] text-gray-300 text-sm font-medium border border-[#2a3050] active:scale-[0.98] transition-all animate-btn-delay"
      onclick={() => showSaves = !showSaves}
    >
      继续游戏 ({saves.length}个存档)
    </button>

    {#if showSaves}
      <div class="w-full max-w-[280px] mt-2 space-y-2 animate-fadein">
        {#each saves as save}
          <button
            class="w-full text-left p-3 rounded-xl bg-[#1a2234] border border-[#2a3050] active:bg-[#253050] transition-colors"
            onclick={() => handleResume(save.id)}
          >
            <div class="flex justify-between items-center mb-1">
              <span class="text-xs font-bold text-white">
                {save.ending ? (save.ending === 'gcBeforeDeadline' || save.ending === 'age59WithGc' ? '🏆' : '✈️') : '🎮'}
                回合 {save.turn}/148
              </span>
              <span class="text-[10px] text-gray-500">{formatTime(save.timestamp)}</span>
            </div>
            <div class="flex gap-3 text-[10px] text-gray-400">
              <span>Build: {save.build}</span>
              <span>NW: {formatMoney(save.netWorth)}</span>
              <span>{save.visa.toUpperCase()}</span>
            </div>
          </button>
        {/each}
      </div>
    {/if}

    {#if resumeError}
      <p class="text-xs text-red-400 mt-2">{resumeError}</p>
    {/if}
  {:else}
    <button
      class="w-full max-w-[280px] py-3 mt-3 rounded-2xl bg-[#1a2234] text-gray-500 text-sm font-medium border border-[#2a3050] animate-btn-delay"
      disabled
    >
      继续游戏（无存档）
    </button>
  {/if}

  <div class="mt-12 text-center animate-footer">
    <p class="text-[10px] text-gray-700">v0.2.0 MVP · 148回合 · 19个系统</p>
    <p class="text-[9px] text-gray-800 mt-1">基于真实一代移民经历</p>
  </div>
</div>

<style>
  .animate-float { animation: float 3s ease-in-out infinite; }
  @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
  .animate-title { animation: fadeUp 0.6s ease-out; }
  .animate-subtitle { animation: fadeUp 0.6s ease-out 0.15s both; }
  .animate-btn { animation: fadeUp 0.5s ease-out 0.3s both; }
  .animate-btn-delay { animation: fadeUp 0.5s ease-out 0.4s both; }
  .animate-footer { animation: fadeUp 0.5s ease-out 0.6s both; }
  .animate-fadein { animation: fadeUp 0.3s ease-out; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
</style>
