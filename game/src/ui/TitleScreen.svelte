<script lang="ts">
  import { screen } from '../engine/store';
</script>

<div class="flex flex-col items-center justify-center min-h-dvh px-6 bg-[#0a0e17]">
  <div class="text-6xl mb-4">🗽</div>
  <h1 class="text-3xl font-black text-white mb-2 tracking-tight">绿卡之路</h1>
  <p class="text-sm text-gray-500 mb-1">Green Card Odyssey</p>
  <p class="text-xs text-gray-600 mb-10 text-center max-w-[280px]">
    一代移民的美国梦模拟器<br>
    从留学到绿卡，每个选择都有代价
  </p>

  <button
    class="w-full max-w-[280px] py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-lg font-bold tracking-wide active:scale-[0.98] transition-transform"
    onclick={() => screen.set('creation')}
  >
    开始新游戏
  </button>

  <button
    class="w-full max-w-[280px] py-3 mt-3 rounded-2xl bg-[#1a2234] text-gray-400 text-sm font-medium border border-[#2a3050]"
    disabled
  >
    继续游戏（开发中）
  </button>

  <p class="text-[10px] text-gray-700 mt-12">v0.1.0 — MVP Prototype</p>
</div>
