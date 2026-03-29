<script lang="ts">
  import { startNewGame } from '../engine/store';

  let constitution = $state(3);
  let schoolRanking = $state(4);
  let geoLocation = $state(3);

  const total = $derived(constitution + schoolRanking + geoLocation);
  const isValid = $derived(total === 10);
  const remaining = $derived(10 - total);

  // Derived preview values
  const grindReduction = $derived(constitution * 10); // 0-50% reduction
  const schoolMod = $derived((-5 + schoolRanking * 4).toFixed(0));
  const internBonus = $derived(((geoLocation - 2.5) * 8).toFixed(0));

  const archetypes = [
    { name: '学霸', desc: '名校光环，永久加成', c: 2, s: 5, g: 3 },
    { name: '铁人', desc: '体质过人，能卷不倒', c: 5, s: 2, g: 3 },
    { name: '地头蛇', desc: '地利优势，实习无忧', c: 2, s: 3, g: 5 },
    { name: '赌徒', desc: '极限操作，高风险开局', c: 0, s: 5, g: 5 },
    { name: '均衡', desc: '推荐新手，稳健起步', c: 3, s: 4, g: 3 },
  ];

  function applyArchetype(a: typeof archetypes[0]) {
    constitution = a.c;
    schoolRanking = a.s;
    geoLocation = a.g;
  }

  function adjustAttr(attr: 'c' | 's' | 'g', delta: number) {
    if (attr === 'c') {
      const next = Math.max(0, Math.min(5, constitution + delta));
      if (next !== constitution && (total + (next - constitution)) <= 10) constitution = next;
    } else if (attr === 's') {
      const next = Math.max(0, Math.min(5, schoolRanking + delta));
      if (next !== schoolRanking && (total + (next - schoolRanking)) <= 10) schoolRanking = next;
    } else {
      const next = Math.max(0, Math.min(5, geoLocation + delta));
      if (next !== geoLocation && (total + (next - geoLocation)) <= 10) geoLocation = next;
    }
  }

  function confirm() {
    if (!isValid) return;
    startNewGame({ constitution, schoolRanking, geoLocation });
  }
</script>

<div class="flex flex-col min-h-dvh bg-[#0a0e17] text-gray-200">
  <!-- Header -->
  <div class="px-5 pt-12 pb-4">
    <h1 class="text-xl font-bold text-white">创建你的角色</h1>
    <p class="text-xs text-gray-500 mt-1">分配10个属性点，定义你的起点</p>
  </div>

  <!-- Archetypes -->
  <div class="px-5 mb-4">
    <p class="text-xs text-gray-500 mb-2">快速选择</p>
    <div class="flex gap-2 overflow-x-auto pb-1">
      {#each archetypes as a}
        <button
          class="flex-shrink-0 px-3 py-2 rounded-lg bg-[#1a2234] border border-[#2a3050] text-xs active:bg-[#253050] transition-colors"
          class:border-blue-500={constitution === a.c && schoolRanking === a.s && geoLocation === a.g}
          onclick={() => applyArchetype(a)}
        >
          <div class="font-bold text-white">{a.name}</div>
          <div class="text-gray-500 text-[10px]">{a.desc}</div>
        </button>
      {/each}
    </div>
  </div>

  <!-- Attribute Sliders -->
  <div class="flex-1 px-5 space-y-5">
    <!-- Constitution -->
    <div>
      <div class="flex justify-between items-center mb-2">
        <div>
          <span class="text-sm font-semibold text-white">💪 体质</span>
          <span class="text-xs text-gray-500 ml-2">卷王惩罚减免 + 抗病能力</span>
        </div>
        <span class="text-lg font-bold text-white">{constitution}</span>
      </div>
      <div class="flex items-center gap-3">
        <button class="w-8 h-8 rounded-lg bg-[#1a2234] text-white font-bold active:bg-[#253050]" onclick={() => adjustAttr('c', -1)}>−</button>
        <div class="flex-1 h-2 bg-[#1a2234] rounded-full overflow-hidden">
          <div class="h-full bg-green-500 rounded-full transition-all" style="width: {constitution * 20}%"></div>
        </div>
        <button class="w-8 h-8 rounded-lg bg-[#1a2234] text-white font-bold active:bg-[#253050]" onclick={() => adjustAttr('c', 1)}>+</button>
      </div>
      <p class="text-[10px] text-gray-600 mt-1">卷王健康惩罚减少: {grindReduction}%{constitution >= 4 ? ' 💪' : ''}</p>
    </div>

    <!-- School Ranking -->
    <div>
      <div class="flex justify-between items-center mb-2">
        <div>
          <span class="text-sm font-semibold text-white">🎓 学校排名</span>
          <span class="text-xs text-gray-500 ml-2">永久工作概率加成</span>
        </div>
        <span class="text-lg font-bold text-white">{schoolRanking}</span>
      </div>
      <div class="flex items-center gap-3">
        <button class="w-8 h-8 rounded-lg bg-[#1a2234] text-white font-bold active:bg-[#253050]" onclick={() => adjustAttr('s', -1)}>−</button>
        <div class="flex-1 h-2 bg-[#1a2234] rounded-full overflow-hidden">
          <div class="h-full bg-blue-500 rounded-full transition-all" style="width: {schoolRanking * 20}%"></div>
        </div>
        <button class="w-8 h-8 rounded-lg bg-[#1a2234] text-white font-bold active:bg-[#253050]" onclick={() => adjustAttr('s', 1)}>+</button>
      </div>
      <p class="text-[10px] text-gray-600 mt-1">工作概率修正: {Number(schoolMod) >= 0 ? '+' : ''}{schoolMod}%</p>
    </div>

    <!-- Geo Location -->
    <div>
      <div class="flex justify-between items-center mb-2">
        <div>
          <span class="text-sm font-semibold text-white">📍 地理位置</span>
          <span class="text-xs text-gray-500 ml-2">实习搜索加成</span>
        </div>
        <span class="text-lg font-bold text-white">{geoLocation}</span>
      </div>
      <div class="flex items-center gap-3">
        <button class="w-8 h-8 rounded-lg bg-[#1a2234] text-white font-bold active:bg-[#253050]" onclick={() => adjustAttr('g', -1)}>−</button>
        <div class="flex-1 h-2 bg-[#1a2234] rounded-full overflow-hidden">
          <div class="h-full bg-purple-500 rounded-full transition-all" style="width: {geoLocation * 20}%"></div>
        </div>
        <button class="w-8 h-8 rounded-lg bg-[#1a2234] text-white font-bold active:bg-[#253050]" onclick={() => adjustAttr('g', 1)}>+</button>
      </div>
      <p class="text-[10px] text-gray-600 mt-1">实习加成: {Number(internBonus) >= 0 ? '+' : ''}{internBonus}%</p>
    </div>

    <!-- Points remaining -->
    <div class="text-center py-2">
      {#if remaining > 0}
        <span class="text-sm text-amber-400">还剩 {remaining} 个点数未分配</span>
      {:else if remaining < 0}
        <span class="text-sm text-red-400">超出 {-remaining} 个点数！</span>
      {:else}
        <span class="text-sm text-green-400">✓ 10点已分配完毕</span>
      {/if}
    </div>
  </div>

  <!-- Confirm -->
  <div class="px-5 pb-8 pt-4">
    <button
      class="w-full py-4 rounded-2xl text-white text-lg font-bold transition-all"
      class:bg-gradient-to-r={isValid}
      class:from-blue-600={isValid}
      class:to-blue-700={isValid}
      class:bg-gray-700={!isValid}
      class:opacity-50={!isValid}
      disabled={!isValid}
      onclick={confirm}
    >
      确认出发 ✈️
    </button>
  </div>
</div>
