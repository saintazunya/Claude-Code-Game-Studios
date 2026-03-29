<script lang="ts">
  import { currentEvent, resolveCurrentEvent, turnInfo } from '../engine/store';

  function tagStyle(tag: string): string {
    const styles: Record<string, string> = {
      stable: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      risky: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
      desperate: 'bg-red-500/20 text-red-400 border border-red-500/30',
      costly: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      neutral: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
    };
    return styles[tag] || styles.neutral;
  }

  function tagLabel(tag: string): string {
    const labels: Record<string, string> = { stable: '稳妥', risky: '冒险', desperate: '孤注一掷', costly: '花钱', neutral: '中立' };
    return labels[tag] || tag;
  }

  function typeIcon(type: string): string {
    const icons: Record<string, string> = { crisis: '💥', opportunity: '✨', career: '🏢', immigration: '📋', life: '🏠', economic: '📉' };
    return icons[type] || '📌';
  }

  function typeLabel(type: string): string {
    const labels: Record<string, string> = { crisis: '突发事件', opportunity: '好消息', career: '职场动态', immigration: '移民消息', life: '生活点滴', economic: '经济变动' };
    return labels[type] || '事件';
  }

  function typeBorderColor(type: string): string {
    const colors: Record<string, string> = { crisis: '#ef4444', opportunity: '#3b82f6', career: '#6b7280', immigration: '#a855f7', life: '#f59e0b', economic: '#f97316' };
    return colors[type] || '#6b7280';
  }

  function iconBg(type: string): string {
    const bgs: Record<string, string> = { crisis: 'from-red-600 to-red-800', opportunity: 'from-blue-600 to-blue-800', career: 'from-gray-600 to-gray-800', immigration: 'from-purple-600 to-purple-800', life: 'from-amber-600 to-amber-800', economic: 'from-orange-600 to-orange-800' };
    return bgs[type] || 'from-gray-600 to-gray-800';
  }

  function formatEffect(key: string, val: number): { name: string; text: string; color: string } {
    const names: Record<string, string> = { performance: '绩效', skills: '技能', academicImpact: '学术', health: '健康', mental: '精神', netWorth: '资产' };
    return { name: names[key] || key, text: `${val > 0 ? '+' : ''}${val}`, color: val > 0 ? 'text-green-400' : 'text-red-400' };
  }
</script>

{#if $currentEvent}
  {@const event = $currentEvent}
  {@const ti = $turnInfo}
<div class="min-h-dvh bg-[#0a0e17] flex items-center justify-center p-4">
  <div class="bg-[#1a2234] rounded-2xl border border-[#2a3a5a] w-full max-w-[400px] shadow-2xl overflow-hidden" style="animation: slideUp 0.35s ease-out">
    <!-- Header -->
    <div class="pt-6 px-5 text-center">
      <div class="w-16 h-16 rounded-2xl bg-gradient-to-br {iconBg(event.type)} flex items-center justify-center text-3xl mx-auto mb-3 shadow-lg">
        {typeIcon(event.type)}
      </div>
      <div class="text-[10px] font-bold tracking-widest uppercase mb-1" style="color: {typeBorderColor(event.type)}">
        {typeLabel(event.type)}
      </div>
      <h2 class="text-xl font-black text-white mb-1">{event.nameZh}</h2>
      <p class="text-xs text-gray-500">{ti.year}年 Q{ti.quarter} — {ti.age}岁</p>
    </div>

    <!-- Narrative -->
    <div class="px-5 pt-4">
      <div class="text-sm leading-relaxed text-gray-300 bg-[#111827] rounded-xl p-4" style="border-left: 3px solid {typeBorderColor(event.type)}">
        {event.descZh}
      </div>
    </div>

    <!-- Immediate Effects -->
    {#if Object.entries(event.immediateEffects).some(([_, v]) => v !== 0)}
      <div class="px-5 pt-3">
        <p class="text-[10px] text-gray-500 font-semibold mb-2 tracking-wider">即时影响</p>
        {#each Object.entries(event.immediateEffects) as [key, val]}
          {#if val !== 0}
            {@const eff = formatEffect(key, val as number)}
            <div class="flex items-center gap-2 py-1 text-xs">
              <div class="w-1.5 h-1.5 rounded-full {(val as number) > 0 ? 'bg-green-400' : 'bg-red-400'}"></div>
              <span class="text-gray-400">{eff.name}</span>
              <span class="{eff.color} font-semibold">{eff.text}</span>
            </div>
          {/if}
        {/each}
      </div>
    {/if}

    <!-- Choices -->
    <div class="p-5 space-y-3">
      <p class="text-[10px] text-gray-500 font-semibold tracking-wider mb-1">选择你的应对方式</p>
      {#each event.choices as choice (choice.id)}
        <button
          type="button"
          class="w-full text-left p-4 rounded-xl border-2 border-[#2a3a5a] bg-[#1e2a3a] hover:bg-[#253550] active:bg-[#2a3a5a] active:scale-[0.98] transition-all cursor-pointer select-none"
          onpointerup={() => resolveCurrentEvent(choice.id)}
        >
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded {tagStyle(choice.tag)}">
              {tagLabel(choice.tag)}
            </span>
          </div>
          <div class="text-sm font-bold text-white mb-1">{choice.nameZh}</div>
          <div class="text-xs text-gray-400 leading-relaxed">{choice.descZh}</div>
          {#if Object.entries(choice.effects).some(([_, v]) => v !== 0)}
            <div class="flex flex-wrap gap-2 mt-2 pt-2 border-t border-[#2a3050]">
              {#each Object.entries(choice.effects) as [key, val]}
                {#if val !== 0}
                  {@const eff = formatEffect(key, val as number)}
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-[#111827] {eff.color}">{eff.name} {eff.text}</span>
                {/if}
              {/each}
            </div>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</div>
{/if}

<style>
  @keyframes slideUp {
    from { transform: translateY(30px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
</style>
