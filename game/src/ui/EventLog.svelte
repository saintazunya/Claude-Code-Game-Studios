<script lang="ts">
  import { gameState, turnInfo } from '../engine/store';
  import { getTurnInfo } from '../engine/game-state';

  let { onclose }: { onclose: () => void } = $props();

  const gs = $derived($gameState);

  // Active flags / ongoing situations
  const activeEvents = $derived(() => {
    if (!gs) return [];
    const active: { icon: string; text: string; color: string; detail: string }[] = [];

    if (gs.flags.layoffWarningActive) {
      active.push({ icon: '⚠️', text: '裁员预警中', color: 'text-red-400', detail: '下季度揭晓结果' });
    }
    if (gs.immigration.h1bPending) {
      active.push({ icon: '⏳', text: 'H-1B待生效', color: 'text-purple-400', detail: 'Q4(10月1日)正式激活' });
    }
    if (gs.career.onPip) {
      active.push({ icon: '⚠️', text: 'PIP进行中', color: 'text-red-400', detail: `剩余${gs.career.pipQuartersRemaining}季度，绩效需达到50` });
    }
    if (gs.flags.sicknessApPenalty && (gs.flags.sicknessApPenalty as number) > 0) {
      active.push({ icon: '🤒', text: '生病恢复中', color: 'text-amber-400', detail: `AP减少${gs.flags.sicknessApPenalty}` });
    }
    if (gs.flags.burnoutActive) {
      active.push({ icon: '💀', text: 'Burnout恢复中', color: 'text-red-400', detail: '最多4AP' });
    }
    if (gs.grindLockQuarters > 0) {
      active.push({ icon: '🔒', text: '卷王锁定', color: 'text-amber-400', detail: `${gs.grindLockQuarters}季度后解锁` });
    }
    if (gs.immigration.permStatus === 'pending') {
      active.push({ icon: '📋', text: 'PERM审批中', color: 'text-amber-400', detail: '等待劳工部批准' });
    }
    if (gs.immigration.permStatus === 'audited') {
      active.push({ icon: '🔍', text: 'PERM被Audit', color: 'text-red-400', detail: '审查中，处理延长' });
    }
    if (gs.immigration.i140Status === 'pending') {
      active.push({ icon: '📝', text: 'I-140审批中', color: 'text-purple-400', detail: '等待批准' });
    }
    if (gs.immigration.i485Status === 'pending') {
      active.push({ icon: '📋', text: 'I-485审批中', color: 'text-purple-400', detail: 'Combo卡已到手，等待最终批准' });
    }
    if (gs.immigration.i485Status === 'rfe') {
      active.push({ icon: '📋', text: 'I-485补件(RFE)', color: 'text-amber-400', detail: '需要补充材料' });
    }
    if (gs.flags.internActiveThisQuarter) {
      active.push({ icon: '💼', text: '实习进行中', color: 'text-green-400', detail: '本季度占用3AP' });
    }
    if (gs.career.employed === 'unemployed' && gs.phase === 'career') {
      const remaining = gs.immigration.visaExpiryTurn - gs.turn;
      active.push({ icon: '🆘', text: '失业中', color: 'text-red-400', detail: `签证剩余${remaining}季度，尽快找工作` });
    }

    return active;
  });

  // Event message map (reuse from summary)
  const EVENT_NAMES: Record<string, { icon: string; text: string }> = {
    promoted: { icon: '🎉', text: '升职' },
    h1b_approved: { icon: '🎊', text: 'H-1B抽中' },
    h1b_denied: { icon: '😰', text: 'H-1B未中签' },
    h1b_activated: { icon: '🎊', text: 'H-1B生效' },
    h1b_pending_lost: { icon: '💔', text: 'H-1B作废' },
    h1b_6year_expired: { icon: '💀', text: 'H-1B 6年到期' },
    h1b_auto_filed: { icon: '📝', text: 'H-1B已提交' },
    h1b_renewed: { icon: '📄', text: 'H-1B续签' },
    h1b_7th_year_extension: { icon: '📄', text: 'H-1B 7年延期' },
    green_card_approved: { icon: '🏆', text: '绿卡批准' },
    i485_filed_combo_card: { icon: '🎫', text: 'Combo卡到手' },
    i140_approved: { icon: '✅', text: 'I-140批准' },
    i140_filed: { icon: '📝', text: 'I-140提交' },
    i140_denied: { icon: '❌', text: 'I-140被拒' },
    perm_rejected: { icon: '❌', text: 'PERM被拒' },
    perm_approved: { icon: '✅', text: 'PERM批准' },
    perm_filed: { icon: '📝', text: 'PERM提交' },
    perm_audited: { icon: '🔍', text: 'PERM被Audit' },
    perm_voided_layoff: { icon: '💀', text: 'PERM作废' },
    opt_stem_activated: { icon: '📋', text: 'OPT STEM延期' },
    masters_graduated: { icon: '🎓', text: '硕士毕业' },
    phd_graduated: { icon: '🎓', text: '博士毕业' },
    first_job_found: { icon: '💼', text: '找到工作' },
    graduated_unemployed: { icon: '🎓', text: '毕业未就业' },
    laid_off: { icon: '💥', text: '被裁员' },
    layoff_survived: { icon: '😮‍💨', text: '裁员幸存' },
    layoff_wave: { icon: '⚠️', text: '裁员预警' },
    pip_started: { icon: '⚠️', text: 'PIP开始' },
    pip_resolved: { icon: '😮‍💨', text: 'PIP通过' },
    pip_terminated: { icon: '💔', text: 'PIP被开' },
    intern_found: { icon: '🎉', text: '找到实习' },
    intern_not_found: { icon: '😔', text: '实习未找到' },
    return_offer_received: { icon: '🎊', text: '拿到Return Offer' },
    return_offer_not_received: { icon: '😐', text: '没拿到Return Offer' },
    sickness_mild: { icon: '🤧', text: '轻微生病' },
    sickness_moderate: { icon: '🤒', text: '中度生病' },
    sickness_severe: { icon: '🏥', text: '严重生病' },
    sickness_hospitalized: { icon: '🚑', text: '住院' },
    burnout: { icon: '💀', text: 'Burnout' },
    priority_date_retrogression: { icon: '😤', text: '排期倒退' },
    found_job_while_unemployed: { icon: '🎉', text: '重新就业' },
    job_search_failed: { icon: '😔', text: '求职失败' },
    job_offer_received: { icon: '🎉', text: '收到Offer' },
    job_offer_rejected: { icon: '😔', text: '面试没过' },
    recruiter_call: { icon: '📞', text: '猎头来电' },
    market_crash: { icon: '📉', text: '股市暴跌' },
    performance_bonus: { icon: '💰', text: '绩效奖金' },
    team_reorg: { icon: '🔄', text: '团队重组' },
    toxic_incident: { icon: '😤', text: '职场冲突' },
    conference_invite: { icon: '🎤', text: '技术大会' },
    priority_date_jump: { icon: '🎉', text: '排期前进' },
    holiday_loneliness: { icon: '🎄', text: '节日孤独' },
    cultural_friction: { icon: '🌏', text: '文化冲突' },
    family_emergency: { icon: '🏥', text: '家人生病' },
    community_support: { icon: '🤝', text: '找到组织' },
    identity_crisis: { icon: '💭', text: '身份认同' },
    immigration_policy_change: { icon: '📜', text: '政策变动' },
    boss_changed: { icon: '👔', text: '换老板' },
    h1b_grace_period_started: { icon: '⏰', text: '60天宽限期' },
    gc_frozen_by_employer: { icon: '🥶', text: 'GC冻结' },
  };

  // Extract all past events from timeline
  const pastEvents = $derived(() => {
    if (!gs) return [];
    const events: { turn: number; age: number; year: number; quarter: number; icon: string; text: string }[] = [];

    for (const record of gs.timeline) {
      for (const ev of record.events) {
        const info = EVENT_NAMES[ev.id];
        if (info) {
          events.push({
            turn: record.turn,
            age: record.age,
            year: record.year,
            quarter: record.quarter,
            icon: info.icon,
            text: info.text,
          });
        } else {
          events.push({
            turn: record.turn,
            age: record.age,
            year: record.year,
            quarter: record.quarter,
            icon: '📌',
            text: ev.id.replace(/_/g, ' '),
          });
        }
      }
    }

    return events.reverse(); // newest first
  });
</script>

{#if gs}
<div class="fixed inset-0 bg-black/70 z-50 flex items-start justify-center overflow-y-auto" onclick={onclose}>
  <div class="bg-[#111827] w-full max-w-[430px] min-h-dvh p-5" onclick={(e) => e.stopPropagation()}>
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-lg font-bold text-white">📜 事件追踪</h1>
      <button class="text-gray-400 text-xl px-2" onclick={onclose}>✕</button>
    </div>

    <!-- Active / Ongoing -->
    {#if activeEvents().length > 0}
      <div class="mb-4">
        <h2 class="text-[10px] text-gray-500 font-semibold mb-2 tracking-wider">🔴 进行中</h2>
        <div class="space-y-2">
          {#each activeEvents() as ev}
            <div class="p-3 rounded-xl bg-[#1a2234] border border-[#2a3050]">
              <div class="flex items-center gap-2">
                <span class="text-lg">{ev.icon}</span>
                <span class="text-sm font-bold {ev.color}">{ev.text}</span>
              </div>
              <p class="text-[10px] text-gray-400 mt-1 ml-8">{ev.detail}</p>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <div class="mb-4 p-3 rounded-xl bg-[#1a2234] border border-[#2a3050]">
        <span class="text-xs text-gray-500">🟢 没有进行中的事件</span>
      </div>
    {/if}

    <!-- Past Events -->
    <div>
      <h2 class="text-[10px] text-gray-500 font-semibold mb-2 tracking-wider">📜 历史事件（最新在前）</h2>
      {#if pastEvents().length === 0}
        <p class="text-xs text-gray-600 py-4 text-center">还没有发生过事件</p>
      {:else}
        <div class="space-y-0">
          {#each pastEvents() as ev, i}
            <div class="flex gap-3 py-2 border-b border-[#1a2234] last:border-0">
              <div class="text-lg w-6 text-center flex-shrink-0">{ev.icon}</div>
              <div class="flex-1 min-w-0">
                <span class="text-xs text-white">{ev.text}</span>
              </div>
              <div class="text-[10px] text-gray-600 flex-shrink-0">
                {ev.year} Q{ev.quarter} · {ev.age}岁
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <button class="w-full py-3 mt-4 mb-4 rounded-xl bg-[#1a2234] text-gray-400 text-sm border border-[#2a3050] active:scale-[0.98] transition-transform" onclick={onclose}>
      关闭
    </button>
  </div>
</div>
{/if}
