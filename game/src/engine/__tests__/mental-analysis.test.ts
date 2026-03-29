// Analyze mental health impact across simulated games
import { describe, it } from 'vitest';
import { createGameState, processTurn, getEffectiveAp, getWorkModeCost } from '../game-state';
import { getAvailableActions, canSelectAction } from '../actions';
import type { GameState, WorkMode, AcademicStudyMode, ActionId } from '../types';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

describe('Mental Health Impact Analysis', () => {
  it('tracks mental states and consequences across 10 games', () => {
    const stats = {
      totalTurns: 0,
      mentalBelow60: 0, // stressed
      mentalBelow30: 0, // at risk
      mentalBelow10: 0, // burnout zone
      burnoutTriggered: 0,
      perfReduced75: 0, // 0.75x multiplier active
      perfReduced50: 0, // 0.5x multiplier active
      mentalValues: [] as number[],
      mentalDecayPerTurn: [] as number[],
    };

    for (let g = 0; g < 10; g++) {
      let state = createGameState({ constitution: 3, schoolRanking: 4, geoLocation: 3 });

      for (let t = 0; t < 148; t++) {
        const prevMental = state.attributes.mental;
        stats.totalTurns++;
        stats.mentalValues.push(state.attributes.mental);

        if (state.attributes.mental < 60) stats.mentalBelow60++;
        if (state.attributes.mental < 30) stats.mentalBelow30++;
        if (state.attributes.mental < 10) stats.mentalBelow10++;
        if (state.attributes.mental < 60 && state.attributes.mental >= 30) stats.perfReduced75++;
        if (state.attributes.mental < 30) stats.perfReduced50++;
        if (state.flags.burnoutActive) stats.burnoutTriggered++;

        // Play with normal mode, some rest
        const isAcademic = state.phase === 'academic';
        const modes = isAcademic
          ? ['light', 'normal', 'intense'] as AcademicStudyMode[]
          : ['coast', 'normal', 'grind'] as WorkMode[];
        const filtered = modes.filter(m => !((m === 'grind' || m === 'intense') && state.grindLockQuarters > 0));
        const wm = pick(filtered);

        const available = getAvailableActions(state);
        const shuffled = [...available].sort(() => Math.random() - 0.5);
        let rem = getEffectiveAp(state, wm) - getWorkModeCost(wm);
        const sel: ActionId[] = [];
        // Prioritize survival
        for (const id of ['searchIntern', 'internWork', 'prepH1b'] as ActionId[]) {
          const a = available.find(x => x.id === id);
          if (a && rem >= a.apCost) {
            const check = canSelectAction(a, sel, rem);
            if (check.allowed) { sel.push(a.id); rem -= a.apCost; }
          }
        }
        for (const a of shuffled) {
          if (rem <= 0) break;
          const check = canSelectAction(a, sel, rem);
          if (check.allowed) { sel.push(a.id); rem -= a.apCost; }
        }

        try { state = processTurn(state, wm, sel); } catch { break; }

        const mentalDelta = state.attributes.mental - prevMental;
        stats.mentalDecayPerTurn.push(mentalDelta);

        if (state.endingType) break;
      }
    }

    const avgMental = stats.mentalValues.reduce((a, b) => a + b, 0) / stats.mentalValues.length;
    const avgDecay = stats.mentalDecayPerTurn.reduce((a, b) => a + b, 0) / stats.mentalDecayPerTurn.length;
    const minMental = Math.min(...stats.mentalValues);
    const maxMental = Math.max(...stats.mentalValues);

    console.log('\n=== MENTAL HEALTH IMPACT ANALYSIS ===');
    console.log(`Total turns analyzed: ${stats.totalTurns}`);
    console.log(`Average mental: ${avgMental.toFixed(1)}`);
    console.log(`Mental range: ${minMental} — ${maxMental}`);
    console.log(`Average mental change/turn: ${avgDecay.toFixed(2)}`);
    console.log(`Turns stressed (mental < 60): ${stats.mentalBelow60} (${(stats.mentalBelow60 / stats.totalTurns * 100).toFixed(1)}%)`);
    console.log(`Turns at risk (mental < 30): ${stats.mentalBelow30} (${(stats.mentalBelow30 / stats.totalTurns * 100).toFixed(1)}%)`);
    console.log(`Turns burnout zone (mental < 10): ${stats.mentalBelow10} (${(stats.mentalBelow10 / stats.totalTurns * 100).toFixed(1)}%)`);
    console.log(`Burnout events: ${stats.burnoutTriggered}`);
    console.log(`Turns with 0.75x perf penalty: ${stats.perfReduced75} (${(stats.perfReduced75 / stats.totalTurns * 100).toFixed(1)}%)`);
    console.log(`Turns with 0.50x perf penalty: ${stats.perfReduced50} (${(stats.perfReduced50 / stats.totalTurns * 100).toFixed(1)}%)`);

    console.log('\n--- DIAGNOSIS ---');
    if (avgMental > 50) console.log('⚠️ Mental stays too high — not enough pressure');
    if (stats.mentalBelow30 / stats.totalTurns < 0.05) console.log('⚠️ Mental rarely drops below 30 — burnout is too rare');
    if (stats.burnoutTriggered < 1) console.log('⚠️ Burnout almost never happens — mental is too easy to manage');
    if (stats.perfReduced75 / stats.totalTurns < 0.1) console.log('⚠️ Performance penalty rarely active — mental doesn\'t affect gameplay');
  });
});
