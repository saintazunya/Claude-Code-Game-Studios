<script lang="ts">
  import { currentEvent, gameState, resolveCurrentEvent, turnInfo } from '../engine/store';
  import type { EventChoice } from '../engine/types';

  const event = $derived($currentEvent);
  const gs = $derived($gameState);
  const ti = $derived($turnInfo);

  function tagStyle(tag: string) {
    switch (tag) {
      case 'stable': return 'bg-blue-500/20 text-blue-400';
      case 'risky': return 'bg-purple-500/20 text-purple-400';
      case 'desperate': return 'bg-red-500/20 text-red-400';
      case 'costly': return 'bg-amber-500/20 text-amber-400';
      case 'neutral': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  }

  function tagLabel(tag: string) {
    switch (tag) {
      case 'stable': return '稳妥';
      case 'risky': return '冒险';
      case 'desperate': return '孤注一掷';
      case 'costly': return '花钱';
      case 'neutral': return '中立';
      default: return tag;
    }
  }

  function typeIcon(type: string) {
    switch (type) {
      case 'crisis': return '💥';
      case 'opportunity': return '✨';
      case 'career': return '🏢';
      case 'immigration': return '📋';
      case 'life': return '🏠';
      case 'economic': return '📉';
      default: return '📌';
    }
  }

  function typeLabel(type: string) {
    switch (type) {
      case 'crisis': return '突发事件';
      case 'opportunity': return '好消息';
      case 'career': return '职场动态';
      case 'immigration': return '移民消息';
      case 'life': return '生活点滴';
      case 'economic': return '经济变动';
      default: return '事件';
    }
  }

  function typeColor(type: string) {
    switch (type) {
      case 'crisis': return 'text-red-400 border-red-500/30';
      case 'opportunity': return 'text-blue-400 border-blue-500/30';
      case 'career': return 'text-gray-400 border-gray-500/30';
      case 'immigration': return 'text-purple-400 border-purple-500/30';
      case 'life': return 'text-amber-400 border-amber-500/30';
      case 'economic': return 'text-orange-400 border-orange-500/30';
      default: return 'text-gray-400 border-gray-500/30';
    }
  }

  function iconBg(type: string) {
    switch (type) {
      case 'crisis': return 'from-red-600 to-red-800';
      case 'opportunity': return 'from-blue-600 to-blue-800';
      case 'career': return 'from-gray-600 to-gray-800';
      case 'immigration': return 'from-purple-600 to-purple-800';
      case 'life': return 'from-amber-600 to-amber-800';
      case 'economic': return 'from-orange-600 to-orange-800';
      default: return 'from-gray-600 to-gray-800';
    }
  }

  function formatEffect(key: string, val: number) {
    const names: Record<string, string> = {
      performance: '绩效', skills: '技能', academicImpact: '学术',
      health: '健康', mental: '精神', netWorth: '资产',
    };
    const name = names[key] || key;
    const prefix = val > 0 ? '+' : '';
    const color = val > 0 ? 'text-green-400' : 'text-red-400';
    return { name, text: `${prefix}${val}`, color };
  }

  function handleChoice(choiceId: string) {
    resolveCurrentEvent(choiceId);
  }
</script>

{#if event}
<div class="fixed inset-0 bg-black/60 flex items-center justify-center p-5 z-50">
  <div class="bg-[#1a2234] rounded-2xl border border-[#2a3a5a] w-full max-w-[380px] max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-up">
    <!-- Header -->
    <div class="pt-5 px-5 text-center">
      <div class="w-14 h-14 rounded-2xl bg-gradient-to-br {iconBg(event.type)} flex items-center justify-center text-2xl mx-auto mb-3 shadow-lg">
        {typeIcon(event.type)}
      </div>
      <div class="text-[10px] font-bold tracking-widest uppercase {typeColor(event.type).split(' ')[0]} mb-1">
        {typeLabel(event.type)}
      </div>
      <h2 class="text-xl font-black text-white mb-0.5">{event.nameZh}</h2>
      <p class="text-xs text-gray-500">{ti.year}年 Q{ti.quarter} — {ti.age}岁</p>
    </div>

    <!-- Narrative -->
    <div class="px-5 pt-4">
      <div class="text-sm leading-relaxed text-gray-300 bg-[#111827] rounded-xl p-4 border-l-3 {typeColor(event.type).split(' ').map(c => c.startsWith('border') ? c : '').join(' ')} border-l-[3px]" style="border-left-color: {event.type === 'crisis' ? '#ef4444' : event.type === 'opportunity' ? '#3b82f6' : event.type === 'immigration' ? '#a855f7' : event.type === 'life' ? '#f59e0b' : '#6b7280'}">
        {event.descZh}
      </div>
    </div>

    <!-- Immediate Effects -->
    {#if Object.keys(event.immediateEffects).length > 0}
      <div class="px-5 pt-3">
        <p class="text-[10px] text-gray-500 font-semibold mb-2">即时影响</p>
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
      {#each event.choices as choice}
        <button
          class="w-full text-left p-4 rounded-xl border border-[#2a3a5a] bg-[#1e2a3a] active:bg-[#253550] transition-colors"
          onclick={() => handleChoice(choice.id)}
        >
          <div class="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded {tagStyle(choice.tag)} mb-1.5">
            {tagLabel(choice.tag)}
          </div>
          <div class="text-sm font-bold text-white mb-1">{choice.nameZh}</div>
          <div class="text-xs text-gray-500 leading-relaxed">{choice.descZh}</div>
          {#if Object.keys(choice.effects).length > 0}
            <div class="flex gap-3 mt-2">
              {#each Object.entries(choice.effects) as [key, val]}
                {#if val !== 0}
                  {@const eff = formatEffect(key, val as number)}
                  <span class="text-[10px] {eff.color}">{eff.name} {eff.text}</span>
                {/if}
              {/each}
            </div>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Footer -->
    <div class="text-center pb-4 text-xs text-amber-500">
      ⏰ 必须做出选择
    </div>
  </div>
</div>
{/if}

<style>
  @keyframes slide-up {
    from { transform: translateY(30px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .animate-slide-up {
    animation: slide-up 0.3s ease-out;
  }
</style>
