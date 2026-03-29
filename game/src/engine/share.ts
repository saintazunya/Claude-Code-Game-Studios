// Share system — generate shareable result cards

import type { GameState } from './types';
import { getTurnInfo, calculateFinalScore } from './game-state';

export interface ShareData {
  title: string;
  text: string;
  url?: string;
}

function formatMoney(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

function getEndingEmoji(ending: string | null): string {
  switch (ending) {
    case 'gcBeforeDeadline': return '🏆';
    case 'age59WithGc': return '✅';
    case 'age59WithoutGc': return '⏰';
    case 'deported': return '✈️';
    case 'voluntaryDeparture': return '🏠';
    default: return '🎮';
  }
}

function getEndingText(ending: string | null): string {
  switch (ending) {
    case 'gcBeforeDeadline': return '美国梦达成';
    case 'age59WithGc': return '安全着陆';
    case 'age59WithoutGc': return '时间到';
    case 'deported': return '被迫回国';
    case 'voluntaryDeparture': return '选择回国';
    default: return '游戏结束';
  }
}

export function generateShareText(state: GameState): ShareData {
  const score = calculateFinalScore(state);
  const ti = getTurnInfo(state.turn);
  const ending = state.endingType;
  const emoji = getEndingEmoji(ending);
  const endText = getEndingText(ending);

  // Build milestone timeline (key events only)
  const milestones: string[] = [];
  const milestoneMap: Record<string, string> = {
    h1b_approved: 'H1B✅',
    h1b_denied: 'H1B❌',
    promoted: '升职🎉',
    laid_off: '裁员💥',
    perm_approved: 'PERM✅',
    i140_approved: 'I140✅',
    i485_filed_combo_card: 'Combo🎫',
    green_card_approved: '绿卡🏆',
    intern_found: '实习✅',
    first_job_found: '入职💼',
    pip_started: 'PIP⚠️',
    burnout: 'Burnout💀',
  };

  for (const record of state.timeline) {
    for (const ev of record.events) {
      if (milestoneMap[ev.id]) {
        milestones.push(`${record.age}岁${milestoneMap[ev.id]}`);
      }
    }
  }

  const build = `${state.creation.constitution}/${state.creation.schoolRanking}/${state.creation.geoLocation}`;

  const text = [
    `${emoji} 绿卡之路 | ${endText}`,
    `得分: ${score.toLocaleString()}`,
    ``,
    `📊 Build: ${build} | L${state.career.level} | ${formatMoney(state.attributes.netWorth)}`,
    `🎯 ${state.turn}回合 | ${ti.age}岁 | ${state.immigration.hasGreenCard ? '绿卡✅' : '无绿卡'}`,
    ``,
    milestones.length > 0 ? `📜 ${milestones.slice(0, 8).join(' → ')}` : '',
    ``,
    `来挑战你的移民之路 👇`,
  ].filter(Boolean).join('\n');

  return {
    title: `绿卡之路 ${emoji} ${endText} - ${score.toLocaleString()}分`,
    text,
  };
}

export async function shareResult(state: GameState): Promise<boolean> {
  const { title, text } = generateShareText(state);

  // Try native Web Share API first (mobile)
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return true;
    } catch {
      // User cancelled or share failed
    }
  }

  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Last resort: select text in prompt
    window.prompt('复制分享文本:', text);
    return true;
  }
}
