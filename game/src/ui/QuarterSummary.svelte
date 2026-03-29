<script lang="ts">
  import { gameState, continueTurn, turnInfo } from '../engine/store';
  import { ACTIONS } from '../engine/actions';

  const gs = $derived($gameState);
  const ti = $derived($turnInfo);
  const lastRecord = $derived(gs?.timeline[gs.timeline.length - 1]);

  // Event message map
  const EVENT_MESSAGES: Record<string, { icon: string; text: string; color: string; detail?: string }> = {
    promoted: { icon: '🎉', text: '升职了！', color: 'text-blue-400', detail: '职级提升，薪资增加。新的挑战开始了。' },
    h1b_approved: { icon: '🎊', text: 'H-1B 抽中了！', color: 'text-purple-400', detail: 'H-1B签证获批，有效期3年。可以开始办绿卡了！' },
    h1b_denied: { icon: '😰', text: 'H-1B 没抽中...', color: 'text-red-400', detail: '很遗憾，今年没中签。需要等明年再抽或寻找替代方案。' },
    green_card_approved: { icon: '🏆', text: '绿卡批准！！！', color: 'text-green-400', detail: '漫长的等待终于结束了！你现在是美国永久居民。' },
    i485_filed_combo_card: { icon: '🎫', text: 'Combo卡到手！', color: 'text-teal-400', detail: '拿到EAD/AP，不再绑定雇主，可以自由换工作和旅行！' },
    i140_approved: { icon: '📋', text: 'I-140批准！', color: 'text-purple-400', detail: '排期已锁定。即使换工作也保留优先日期。关键里程碑！' },
    perm_approved: { icon: '✅', text: 'PERM批准！', color: 'text-amber-400', detail: 'PERM劳工证批准，下一步提交I-140。' },
    perm_filed: { icon: '📝', text: '公司开始办PERM', color: 'text-amber-400', detail: '雇主启动了绿卡流程，PERM申请已提交。' },
    perm_audited: { icon: '⚠️', text: 'PERM被Audit', color: 'text-amber-400', detail: 'PERM申请被劳工部抽查，处理时间将延长2-6个季度。' },
    perm_voided_layoff: { icon: '💀', text: 'PERM作废了！', color: 'text-red-400', detail: '因为离职/裁员，进行中的PERM申请全部作废。' },
    masters_graduated: { icon: '🎓', text: '硕士毕业！', color: 'text-blue-400', detail: '恭喜毕业！OPT已激活，开始找工作吧。' },
    phd_graduated: { icon: '🎓', text: '博士毕业！', color: 'text-blue-400', detail: '博士毕业！以L4级别进入职场，学术影响力大幅积累。' },
    first_job_found: { icon: '💼', text: '拿到第一份工作！', color: 'text-green-400', detail: '成功入职！美国职业生涯正式开始。' },
    first_job_search_failed: { icon: '😟', text: '暂时没找到工作', color: 'text-amber-400', detail: 'OPT正在倒计时，需要尽快找到工作。' },
    laid_off: { icon: '💥', text: '被裁员了', color: 'text-red-400', detail: '收到了遣散费。如果是H-1B身份，60天内必须找到新工作。' },
    pip_started: { icon: '⚠️', text: '收到PIP警告！', color: 'text-red-400', detail: '2个季度内必须把绩效提升到50以上，否则被开除。' },
    pip_resolved: { icon: '😮‍💨', text: 'PIP考核通过', color: 'text-green-400', detail: '绩效达标，PIP解除。好险！' },
    pip_terminated: { icon: '💔', text: 'PIP未通过，被开除', color: 'text-red-400', detail: '绩效未达标，被公司辞退。需要紧急找新工作。' },
    priority_date_retrogression: { icon: '😤', text: '排期倒退了！', color: 'text-red-400', detail: '签证公告牌排期倒退，绿卡等待时间又变长了。' },
    h1b_renewed: { icon: '📄', text: 'H-1B续签成功', color: 'text-purple-400' },
    h1b_7th_year_extension: { icon: '📄', text: 'H-1B第7年延期', color: 'text-purple-400', detail: '因I-140已批准，获得H-1B延期。' },
    i140_filed: { icon: '📝', text: 'I-140已提交', color: 'text-purple-400' },
    i140_denied: { icon: '❌', text: 'I-140被拒', color: 'text-red-400', detail: '需要重新提交。' },
    boss_changed: { icon: '👔', text: '换了新老板', color: 'text-gray-400' },
    h1b_grace_period_started: { icon: '⏰', text: '60天宽限期开始', color: 'text-red-400', detail: 'H-1B身份下被裁，必须在1个季度内找到新的雇主。' },
    gc_frozen_by_employer: { icon: '🥶', text: '公司冻结绿卡办理', color: 'text-red-400', detail: '经济不好，公司暂停了所有绿卡申请。' },
    noid_received: { icon: '⚠️', text: '收到NOID（拒绝意向通知）', color: 'text-red-400', detail: '失业太久，I-485面临被拒风险。必须尽快找到工作！' },
    rfe_resolved: { icon: '📋', text: 'RFE补件完成', color: 'text-amber-400' },
    i485_rfe: { icon: '📋', text: 'I-485被要求补件(RFE)', color: 'text-amber-400', detail: '需要额外材料，处理时间延长。' },
    visa_expired_deported: { icon: '✈️', text: '签证过期，被遣返', color: 'text-red-400' },
  };

  // Detect milestones for celebration
  const milestones = $derived(() => {
    if (!lastRecord) return [];
    const ms: { icon: string; text: string; color: string; detail?: string }[] = [];
    for (const e of lastRecord.events) {
      const msg = EVENT_MESSAGES[e.id];
      if (msg) {
        ms.push(msg);
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

    <!-- What you did this quarter -->
    {#if lastRecord.actions.length > 0}
      <div class="mb-3">
        <div class="flex flex-wrap gap-1.5">
          <span class="text-[10px] text-gray-500">本季度：</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-300">
            {lastRecord.workMode === 'coast' || lastRecord.workMode === 'light' ? '躺平' : lastRecord.workMode === 'grind' || lastRecord.workMode === 'intense' ? '卷王🔥' : '正常'}模式
          </span>
          {#each lastRecord.actions as actionId}
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-[#1a2234] text-gray-400">
              {ACTIONS[actionId]?.nameZh || actionId}
            </span>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Milestones & Events (with details) -->
    {#if milestones().length > 0}
      <div class="mb-4 space-y-2">
        {#each milestones() as m}
          <div class="p-3 rounded-xl border {m.color.includes('red') ? 'bg-red-950/30 border-red-900/50' : 'bg-[#1a2a3a] border-[#2a4060]'} {hasCelebration && !m.color.includes('red') ? 'animate-celebration' : ''}">
            <div class="flex items-center gap-2">
              <span class="text-2xl">{m.icon}</span>
              <span class="font-bold {m.color}">{m.text}</span>
            </div>
            {#if m.detail}
              <p class="text-xs text-gray-400 mt-1.5 ml-10 leading-relaxed">{m.detail}</p>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="mb-4 p-3 rounded-xl bg-[#1a2234] border border-[#2a3050]">
        <div class="flex items-center gap-2">
          <span class="text-lg">📅</span>
          <span class="text-xs text-gray-400">平静的一个季度，没有特别事件发生。</span>
        </div>
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
