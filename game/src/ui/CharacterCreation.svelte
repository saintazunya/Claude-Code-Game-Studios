<script lang="ts">
  import { startNewGame } from '../engine/store';

  interface Character {
    id: string;
    name: string;
    emoji: string;
    title: string;
    desc: string;
    stats: { c: number; s: number; g: number };
    tags: string[];
    difficulty: '简单' | '普通' | '困难' | '地狱';
    diffColor: string;
  }

  const characters: Character[] = [
    {
      id: 'balanced', name: '小稳', emoji: '🎓', title: '均衡选手',
      desc: '中上985本科，美国Top30硕士。成绩不拔尖但稳扎稳打，什么都会一点。',
      stats: { c: 3, s: 4, g: 3 }, tags: ['推荐新手', '稳健路线'],
      difficulty: '普通', diffColor: 'text-blue-400',
    },
    {
      id: 'grinder', name: '小娟', emoji: '🏋️', title: '卷王',
      desc: '清华本科MIT硕士，从小卷到大。GPA 4.0，leetcode 2000题。信仰：只要卷不死就往死里卷。',
      stats: { c: 4, s: 5, g: 1 }, tags: ['高绩效', '易burnout'],
      difficulty: '普通', diffColor: 'text-blue-400',
    },
    {
      id: 'local', name: '小蛇', emoji: '📍', title: '地头蛇',
      desc: '本科就在湾区读书，实习人脉广，地理优势拉满。学校一般但location is everything。',
      stats: { c: 2, s: 3, g: 5 }, tags: ['实习容易', '找工快'],
      difficulty: '简单', diffColor: 'text-green-400',
    },
    {
      id: 'ironman', name: '小龟', emoji: '💪', title: '铁人',
      desc: '体育特长生出身，体质极好。别人burnout他还在跑步。能扛996不生病。',
      stats: { c: 5, s: 2, g: 3 }, tags: ['不易生病', '卷不倒'],
      difficulty: '普通', diffColor: 'text-blue-400',
    },
    {
      id: 'scholar', name: '小P', emoji: '📚', title: '学术大佬',
      desc: '顶级名校PhD候选人，论文引用100+。NIW/EB1A是她的绿卡后门。代价：体质差，容易倒。',
      stats: { c: 1, s: 5, g: 4 }, tags: ['NIW路线', '体质弱'],
      difficulty: '普通', diffColor: 'text-blue-400',
    },
    {
      id: 'gambler', name: '小笃', emoji: '🎰', title: '赌徒',
      desc: '把所有点数押在学校和地理上，体质为零。要么快速上岸，要么速死。不适合心脏不好的人。',
      stats: { c: 0, s: 5, g: 5 }, tags: ['极限操作', '容易猝死'],
      difficulty: '地狱', diffColor: 'text-red-400',
    },
    {
      id: 'underdog', name: '小土', emoji: '🔥', title: '逆袭者',
      desc: '普通二本出身，学校排名0。全靠自己死磕，体质拉满硬扛。从最底层开始证明自己。',
      stats: { c: 5, s: 0, g: 5 }, tags: ['高难度', '找工极难'],
      difficulty: '困难', diffColor: 'text-amber-400',
    },
  ];

  let selected = $state<Character | null>(null);

  const grindReduction = $derived(selected ? selected.stats.c * 10 : 0);
  const schoolMod = $derived(selected ? (-5 + selected.stats.s * 4) : 0);
  const internBonus = $derived(selected ? (-10 + selected.stats.g * 6) : 0);

  function confirm() {
    if (!selected) return;
    startNewGame({ constitution: selected.stats.c, schoolRanking: selected.stats.s, geoLocation: selected.stats.g });
  }
</script>

<div class="flex flex-col min-h-dvh bg-[#0a0e17] text-gray-200">
  <div class="px-5 pt-10 pb-3">
    <h1 class="text-xl font-bold text-white">选择你的角色</h1>
    <p class="text-xs text-gray-500 mt-1">每个人都有不同的起点，选择你的故事</p>
  </div>

  <!-- Character Cards -->
  <div class="flex-1 px-4 overflow-y-auto pb-4">
    <div class="space-y-2.5">
      {#each characters as char}
        <button
          class="w-full text-left p-4 rounded-xl border-2 transition-all {selected?.id === char.id ? 'border-blue-400 bg-[#1a2a4a] shadow-lg shadow-blue-500/10' : 'border-[#2a3050] bg-[#1a2234]'} active:scale-[0.99]"
          onclick={() => selected = char}
        >
          <div class="flex items-start gap-3">
            <div class="text-3xl">{char.emoji}</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <span class="text-base font-bold text-white">{char.name}</span>
                <span class="text-xs text-gray-400">「{char.title}」</span>
                <span class="text-[10px] {char.diffColor} ml-auto">{char.difficulty}</span>
              </div>
              <p class="text-[11px] text-gray-400 leading-relaxed">{char.desc}</p>
              <div class="flex gap-1.5 mt-2">
                {#each char.tags as tag}
                  <span class="px-1.5 py-0.5 rounded bg-[#0d1117] text-[9px] text-gray-500">{tag}</span>
                {/each}
              </div>
              {#if selected?.id === char.id}
                <div class="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                  <div class="bg-[#0d1117] rounded-lg p-2 text-center">
                    <div class="text-green-400 font-bold text-sm">{char.stats.c}</div>
                    <div class="text-gray-500">💪 体质</div>
                    <div class="text-gray-600">减免{char.stats.c * 10}%</div>
                  </div>
                  <div class="bg-[#0d1117] rounded-lg p-2 text-center">
                    <div class="text-blue-400 font-bold text-sm">{char.stats.s}</div>
                    <div class="text-gray-500">🎓 学校</div>
                    <div class="text-gray-600">{(-5 + char.stats.s * 4) >= 0 ? '+' : ''}{-5 + char.stats.s * 4}%</div>
                  </div>
                  <div class="bg-[#0d1117] rounded-lg p-2 text-center">
                    <div class="text-purple-400 font-bold text-sm">{char.stats.g}</div>
                    <div class="text-gray-500">📍 地理</div>
                    <div class="text-gray-600">{(-10 + char.stats.g * 6) >= 0 ? '+' : ''}{-10 + char.stats.g * 6}%</div>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </button>
      {/each}
    </div>
  </div>

  <!-- Confirm -->
  <div class="px-5 pb-8 pt-3">
    <button
      class="w-full py-4 rounded-2xl text-white text-lg font-bold transition-all"
      class:bg-gradient-to-r={!!selected}
      class:from-blue-600={!!selected}
      class:to-blue-700={!!selected}
      class:bg-gray-700={!selected}
      class:opacity-50={!selected}
      disabled={!selected}
      onclick={confirm}
    >
      {selected ? `以「${selected.name}」的身份出发 ✈️` : '请选择一个角色'}
    </button>
  </div>
</div>
