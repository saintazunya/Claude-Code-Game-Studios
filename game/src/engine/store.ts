// Reactive game store — bridges engine to Svelte UI
import { writable, derived, get } from 'svelte/store';
import type { GameState, CreationAttributes, WorkMode, AcademicStudyMode, ActionId, GameEvent } from './types';
import { createGameState, getTurnInfo, getEffectiveAp, getWorkModeCost, getWorkModeEffects, processTurn, calculateFinalScore, resolveEvent } from './game-state';
import { getAvailableActions, canSelectAction, ACTIONS } from './actions';
import { preview } from './probability';
import { getPortfolioStatus } from './economic-cycle';
import { getHealthThreshold, getMentalThreshold } from './attributes';
import { EVENT_POOL } from './events';
import { startLog, logTurn, logEventChoice, endLog, downloadLog } from './logger';

export type Screen = 'title' | 'creation' | 'game' | 'event' | 'summary' | 'endgame';

export const screen = writable<Screen>('title');
export const gameState = writable<GameState | null>(null);

// Current turn selections (not yet committed)
export const selectedWorkMode = writable<WorkMode | AcademicStudyMode | null>(null);
export const selectedActions = writable<ActionId[]>([]);

// Current event being shown to player
export const currentEvent = writable<GameEvent | null>(null);
export const eventQueue = writable<GameEvent[]>([]);

// Derived stores
export const turnInfo = derived(gameState, ($gs) => {
  if (!$gs) return { year: 2024, quarter: 1, age: 22 };
  return getTurnInfo($gs.turn);
});

export const effectiveAp = derived([gameState, selectedWorkMode], ([$gs, $wm]) => {
  if (!$gs || !$wm) return 10;
  return getEffectiveAp($gs, $wm);
});

export const remainingAp = derived([effectiveAp, selectedWorkMode, selectedActions], ([$eap, $wm, $sa]) => {
  if (!$wm) return $eap;
  let remaining = $eap - getWorkModeCost($wm);
  for (const actionId of $sa) {
    const action = ACTIONS[actionId];
    if (action) remaining -= action.apCost;
  }
  return Math.max(0, remaining);
});

export const availableActions = derived(gameState, ($gs) => {
  if (!$gs) return [];
  return getAvailableActions($gs);
});

export const portfolio = derived(gameState, ($gs) => {
  if (!$gs) return { currentValue: 0, unrealizedPnl: 0, unrealizedPnlPercent: 0 };
  return getPortfolioStatus($gs);
});

export const healthState = derived(gameState, ($gs) => {
  if (!$gs) return 'healthy';
  return getHealthThreshold($gs.attributes.health);
});

export const mentalState = derived(gameState, ($gs) => {
  if (!$gs) return 'stable';
  return getMentalThreshold($gs.attributes.mental);
});

// Actions
export function startNewGame(creation: CreationAttributes) {
  const state = createGameState(creation);
  gameState.set(state);
  selectedWorkMode.set(null);
  selectedActions.set([]);
  startLog(creation, state.schoolModifier, state.geoBonus);
  screen.set('game');
}

export function selectWorkModeAction(mode: WorkMode | AcademicStudyMode) {
  selectedWorkMode.set(mode);
  const gs = get(gameState);
  if (!gs) return;
  const totalAp = getEffectiveAp(gs, mode);
  const workCost = getWorkModeCost(mode);
  let remaining = totalAp - workCost;

  const current = get(selectedActions);
  const valid: ActionId[] = [];
  for (const id of current) {
    const action = ACTIONS[id];
    if (action && action.apCost <= remaining) {
      valid.push(id);
      remaining -= action.apCost;
    }
  }
  selectedActions.set(valid);
}

export function toggleAction(actionId: ActionId) {
  const current = get(selectedActions);
  if (current.includes(actionId)) {
    selectedActions.set(current.filter((id) => id !== actionId));
  } else {
    const gs = get(gameState);
    const wm = get(selectedWorkMode);
    if (!gs || !wm) return;
    const action = ACTIONS[actionId];
    if (!action) return;

    const rem = get(remainingAp);
    const check = canSelectAction(action, current, rem);
    if (check.allowed) {
      selectedActions.set([...current, actionId]);
    }
  }
}

export function endTurn() {
  const gs = get(gameState);
  const wm = get(selectedWorkMode);
  if (!gs || !wm) return;

  const actions = get(selectedActions);
  const stateBefore = gs;
  const newState = processTurn(gs, wm, actions);
  gameState.set(newState);
  logTurn(stateBefore, newState, wm, actions);

  selectedWorkMode.set(null);
  selectedActions.set([]);

  // Check for pending random events
  const pendingIds = (newState.flags.pendingRandomEvents as string[]) || [];
  const pendingGameEvents = pendingIds
    .map(id => EVENT_POOL.find(e => e.id === id))
    .filter((e): e is GameEvent => e !== undefined);

  if (newState.endingType) {
    endLog(newState.endingType, calculateFinalScore(newState));
  }

  if (pendingGameEvents.length > 0) {
    // Show events one by one
    eventQueue.set(pendingGameEvents.slice(1));
    currentEvent.set(pendingGameEvents[0]);
    screen.set('event');
  } else if (newState.endingType) {
    screen.set('endgame');
  } else {
    screen.set('summary');
  }
}

export function resolveCurrentEvent(choiceId: string) {
  const gs = get(gameState);
  const event = get(currentEvent);
  if (!gs || !event) return;

  // Apply the player's choice
  logEventChoice(event.id, choiceId);
  const newState = resolveEvent(gs, event, choiceId);
  gameState.set(newState);

  // Check for more events in queue
  const queue = get(eventQueue);
  if (queue.length > 0) {
    currentEvent.set(queue[0]);
    eventQueue.set(queue.slice(1));
    // Stay on event screen
  } else {
    currentEvent.set(null);
    eventQueue.set([]);

    const latest = get(gameState);
    if (latest?.endingType) {
      screen.set('endgame');
    } else {
      screen.set('summary');
    }
  }
}

export function continueTurn() {
  screen.set('game');
}

export function exportGameLog() {
  downloadLog();
}

export function returnToTitle() {
  gameState.set(null);
  currentEvent.set(null);
  eventQueue.set([]);
  screen.set('title');
}
