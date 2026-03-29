<script lang="ts">
  import { screen } from '../engine/store';
</script>

<div class="flex flex-col items-center justify-center min-h-dvh px-6 bg-[#0a0e17]">
  <div class="animate-float">
    <div class="text-7xl mb-6">🗽</div>
  </div>

  <h1 class="text-4xl font-black text-white mb-1 tracking-tight animate-title">绿卡之路</h1>
  <p class="text-sm text-gray-500 mb-1 animate-subtitle">Green Card Odyssey</p>
  <div class="w-12 h-0.5 bg-gradient-to-r from-transparent via-gray-600 to-transparent my-3"></div>
  <p class="text-xs text-gray-600 mb-10 text-center max-w-[260px] leading-relaxed animate-subtitle">
    一代移民的美国梦模拟器<br>
    从留学到绿卡，每个选择都有代价
  </p>

  <button
    class="w-full max-w-[280px] py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-lg font-bold active:scale-[0.97] transition-all shadow-lg shadow-blue-600/25 animate-btn"
    onclick={() => screen.set('creation')}
  >
    开始新游戏
  </button>

  <button
    class="w-full max-w-[280px] py-3 mt-3 rounded-2xl bg-[#1a2234] text-gray-500 text-sm font-medium border border-[#2a3050] animate-btn-delay"
    disabled
  >
    继续游戏（开发中）
  </button>

  <div class="mt-16 text-center animate-footer">
    <p class="text-[10px] text-gray-700">v0.1.0 MVP · 148回合 · 19个系统</p>
    <p class="text-[9px] text-gray-800 mt-1">基于真实一代移民经历</p>
  </div>
</div>

<style>
  .animate-float {
    animation: float 3s ease-in-out infinite;
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  .animate-title {
    animation: fadeUp 0.6s ease-out;
  }
  .animate-subtitle {
    animation: fadeUp 0.6s ease-out 0.15s both;
  }
  .animate-btn {
    animation: fadeUp 0.5s ease-out 0.3s both;
  }
  .animate-btn-delay {
    animation: fadeUp 0.5s ease-out 0.4s both;
  }
  .animate-footer {
    animation: fadeUp 0.5s ease-out 0.6s both;
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
