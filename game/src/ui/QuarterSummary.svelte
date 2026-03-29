<script lang="ts">
  import { gameState, continueTurn, turnInfo } from '../engine/store';

  const gs = $derived($gameState);
  const ti = $derived($turnInfo);
  const lastRecord = $derived(gs?.timeline[gs.timeline.length - 1]);

  // Detect milestones for celebration
  const milestones = $derived(() => {
    if (!lastRecord) return [];
    const ms: { icon: string; text: string; color: string }[] = [];
    for (const e of lastRecord.events) {
      switch (e.id) {
        case 'promoted': ms.push({ icon: '🎉', text: '升职了！', color: 'text-blue-400' }); break;
        case 'h1b_approved': ms.push({ icon: '🎊', text: 'H-1B 抽中了！', color: 'text-purple-400' }); break;
        case 'green_card_approved': ms.push({ icon: '🏆', text: '绿卡批准！！！', color: 'text-green-400' }); break;
        case 'i485_filed_combo_card': ms.push({ icon: '🎫', text: 'Combo卡到手！', color: 'text-teal-400' }); break;
        case 'i140_approved': ms.push({ icon: '📋', text: 'I-140批准，排期锁定！', color: 'text-purple-400' }); break;
        case 'perm_approved': ms.push({ icon: '✅', text: 'PERM批准！', color: 'text-amber-400' }); break;
        case 'masters_graduated': ms.push({ icon: '🎓', text: '硕士毕业！', color: 'text-blue-400' }); break;
        case 'phd_graduated': ms.push({ icon: '🎓', text: '博士毕业！', color: 'text-blue-400' }); break;
        case 'first_job_found': ms.push({ icon: '💼', text: '找到第一份工作！', color: 'text-green-400' }); break;
        case 'laid_off': ms.push({ icon: '💥', text: '被裁员了...', color: 'text-red-400' }); break;
        case 'pip_started': ms.push({ icon: '⚠️', text: '收到PIP警告', color: 'text-red-400' }); break;
        case 'pip_terminated': ms.push({ icon: '💔', text: 'PIP未通过，被开除', color: 'text-red-400' }); break;
        case 'h1b_denied': ms.push({ icon: '😰', text: 'H-1B没抽中...', color: 'text-red-400' }); break;
        case 'perm_voided_layoff': ms.push({ icon: '💀', text: 'PERM作废了！', color: 'text-red-400' }); break;
        case 'priority_date_retrogression': ms.push({ icon: '😤', text: '排期倒退了！', color: 'text-red-400' }); break;
      }
    }
    return ms;
  });

  function formatMoney(n: number) {
    if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(0)}K`;
    return `$${Math.round(n)}`;
  }

  function delta(before: number, after: number) {
    const d = Math.round(after - before);
    if (d > 10) return { text: `+${d}`, color: 'text-green-400', arrow: '↑↑', big: true };
    if (d > 0) return { text: `+${d}`, color: 'text-green-400', arrow: '↑', big: false };
    if (d < -10) return { text: `${d}`, color: 'text-red-400', arrow: '↓↓', big: true };
    if (d < 0) return { text: `${d}`, color: 'text-red-400', arrow: '↓', big: false };
    return { text: '—', color: 'text-gray-600', arrow: '', big: false };
  }

  const hasCelebration = $derived(milestones().some(m =>
    ['🎉','🎊','🏆','🎫','🎓','💼','✅','📋'].includes(m.icon)
  ));
</script>

{#if gs && lastRecord}
<div class="flex flex-col min-h-dvh bg-[#0a0e17] text-gray-200 animate-fadein">
  <div class="flex-1 px-5 pt-6 pb-4 overflow-y-auto">
    <!-- Header -->
    <div class="flex justify-between items-start mb-4">
      <div>
        <h1 class="text-lg font-bold text-white">{ti.year}年 Q{ti.quarter}</h1>
        <p class="text-xs text-gray-500">{ti.age}岁 · 回合 {gs.turn}/148</p>
      </div>
      <div class="text-right">
        <div class="text-lg font-black text-emerald-400">{formatMoney(gs.attributes.netWorth)}</div>
        <div class="text-[10px] text-gray-600">净资产</div>
      </div>
    </div>

    <!-- Milestones (celebration) -->
    {#if milestones().length > 0}
      <div class="mb-4 space-y-2">
        {#each milestones() as m}
          <div class="flex items-center gap-2 p-3 rounded-xl border {m.color.includes('red') ? 'bg-red-950/30 border-red-900/50' : 'bg-[#1a2a3a] border-[#2a4060]'} {hasCelebration && !m.color.includes('red') ? 'animate-celebration' : ''}">
            <span class="text-2xl">{m.icon}</span>
            <span class="font-bold {m.color}">{m.text}</span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Attribute Changes -->
    <div class="bg-[#1a2234] rounded-xl p-4 border border-[#2a3050] mb-3">
      <h2 class="text-[10px] text-gray-500 font-semibold mb-3 tracking-wider">属性变化</h2>
      {#each [
        { name: '绩效', icon: '📊', key: 'performance' },
        { name: '技能', icon: '🛠️', key: 'skills' },
        { name: '健康', icon: '💪', key: 'health' },
        { name: '精神', icon: '🧠', key: 'mental' },
        { name: '学术', icon: '📚', key: 'academicImpact' },
      ] as attr}
        {@const before = lastRecord.attributesBefore[attr.key as keyof typeof lastRecord.attributesBefore] as number}
        {@const after = lastRecord.attributesAfter[attr.key as keyof typeof lastRecord.attributesAfter] as number}
        {@const d = delta(before, after)}
        <div class="flex justify-between items-center py-1.5 border-b border-[#2a3050]/50 last:border-0">
          <span class="text-xs text-gray-400">{attr.icon} {attr.name}</span>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-600">{Math.round(before)}</span>
            <span class="text-gray-700">→</span>
            <span class="text-xs text-white font-semibold">{Math.round(after)}</span>
            <span class="text-xs font-bold min-w-[36px] text-right {d.color} {d.big ? 'animate-bounce-subtle' : ''}">
              {d.text} {d.arrow}
            </span>
          </div>
        </div>
      {/each}
    </div>

    <!-- Financial Summary -->
    <div class="bg-[#1a2234] rounded-xl p-4 border border-[#2a3050] mb-3">
      <h2 class="text-[10px] text-gray-500 font-semibold mb-3 tracking-wider">财务</h2>
      <div class="space-y-1.5">
        <div class="flex justify-between text-xs">
          <span class="text-gray-400">💰 现金</span>
          <span class="text-white font-semibold">{formatMoney(gs.economy.cash)}</span>
        </div>
        {#if gs.economy.portfolioShares > 0}
          <div class="flex justify-between text-xs">
            <span class="text-gray-400">📈 S&P 500</span>
            <span class="{gs.economy.portfolioShares * gs.economy.sharePrice - gs.economy.portfolioCostBasis >= 0 ? 'text-emerald-400' : 'text-red-400'} font-semibold">
              {formatMoney(gs.economy.portfolioShares * gs.economy.sharePrice)}
            </span>
          </div>
        {/if}
        {#if gs.economy.ownsHome}
          <div class="flex justify-between text-xs">
            <span class="text-gray-400">🏠 房产净值</span>
            <span class="text-white font-semibold">{formatMoney(gs.economy.homeValue - gs.economy.homeMortgageRemaining)}</span>
          </div>
        {/if}
        {#if gs.economy.studentLoanRemaining > 0}
          <div class="flex justify-between text-xs">
            <span class="text-gray-400">🎓 学贷余额</span>
            <span class="text-red-400 font-semibold">-{formatMoney(gs.economy.studentLoanRemaining)}</span>
          </div>
        {/if}
      </div>
    </div>

    <!-- Immigration Status -->
    <div class="bg-[#1a2234] rounded-xl p-4 border border-[#2a3050] mb-3">
      <h2 class="text-[10px] text-gray-500 font-semibold mb-3 tracking-wider">移民身份</h2>
      <div class="space-y-1.5">
        <div class="flex justify-between text-xs">
          <span class="text-gray-400">签证</span>
          <span class="text-white font-semibold">{gs.immigration.visaType.toUpperCase()}</span>
        </div>
        {#if !gs.immigration.hasGreenCard && !gs.immigration.hasComboCard}
          {@const remaining = gs.immigration.visaExpiryTurn - gs.turn}
          {#if remaining < 999}
            <div class="flex justify-between text-xs">
              <span class="text-gray-400">到期</span>
              <span class="{remaining <= 4 ? 'text-red-400 animate-pulse font-bold' : remaining <= 8 ? 'text-amber-400' : 'text-gray-300'}">
                {remaining}个季度
              </span>
            </div>
          {/if}
        {/if}
        {#if gs.immigration.permStatus !== 'none'}
          <div class="flex justify-between text-xs">
            <span class="text-gray-400">PERM</span>
            <span class="text-purple-400">{gs.immigration.permStatus}</span>
          </div>
        {/if}
        {#if gs.immigration.i140Status !== 'none'}
          <div class="flex justify-between text-xs">
            <span class="text-gray-400">I-140</span>
            <span class="text-purple-400">{gs.immigration.i140Status}</span>
          </div>
        {/if}
        {#if gs.immigration.hasGreenCard}
          <div class="text-center py-1 text-green-400 font-bold text-sm">🎉 永久居民</div>
        {:else if gs.immigration.hasComboCard}
          <div class="text-center py-1 text-teal-400 font-bold text-xs">🎫 Combo卡有效 — 自由换工作</div>
        {/if}
      </div>
    </div>

    <!-- Events this quarter -->
    {#if lastRecord.events.length > 0}
      <div class="bg-[#1a2234] rounded-xl p-4 border border-[#2a3050] mb-3">
        <h2 class="text-[10px] text-gray-500 font-semibold mb-3 tracking-wider">本季度事件</h2>
        <div class="space-y-1">
          {#each lastRecord.events as ev}
            <div class="text-xs text-gray-400 py-0.5">
              📌 {ev.id.replace(/_/g, ' ')}
              {#if ev.choiceId}
                <span class="text-gray-600">→ {ev.choiceId}</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <div class="px-5 pb-6 pt-2">
    <button
      class="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-base font-bold active:scale-[0.98] transition-transform shadow-lg shadow-blue-600/20"
      onclick={continueTurn}
    >
      下一季度 ➜
    </button>
  </div>
</div>
{/if}

<style>
  .animate-fadein {
    animation: fadein 0.25s ease-out;
  }
  @keyframes fadein {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-celebration {
    animation: celebrate 0.6s ease-out;
  }
  @keyframes celebrate {
    0% { transform: scale(0.8); opacity: 0; }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); opacity: 1; }
  }
  .animate-bounce-subtle {
    animation: bounceSubtle 0.5s ease-out;
  }
  @keyframes bounceSubtle {
    0% { transform: translateY(0); }
    40% { transform: translateY(-4px); }
    100% { transform: translateY(0); }
  }
</style>
