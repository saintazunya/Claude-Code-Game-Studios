// Reactive game store — bridges engine to Svelte UI
import { writable, derived, get } from 'svelte/store';
import type { GameState, CreationAttributes, WorkMode, AcademicStudyMode, ActionId, GameEvent } from './types';
import { createGameState, getTurnInfo, getEffectiveAp, getWorkModeCost, getWorkModeEffects, processTurn, calculateFinalScore, resolveEvent, inferWorkMode, getMaxAp } from './game-state';
import { getAvailableActions, canSelectAction, ACTIONS } from './actions';
import { preview } from './probability';
import { getPortfolioStatus } from './economic-cycle';
import { getHealthThreshold, getMentalThreshold } from './attributes';
import { EVENT_POOL } from './events';
import { startLog, logTurn, logEventChoice, endLog, downloadLog } from './logger';
import { autoSave, loadGame, getSaveIndex, type SaveMeta } from './save';
import { shareResult } from './share';
import { autoSelectTurn } from './auto-play';

export type Screen = 'title' | 'creation' | 'game' | 'event' | 'summary' | 'endgame';

export const screen = writable<Screen>('title');
export const gameState = writable<GameState | null>(null);

// Current turn selections (not yet committed)
export const selectedWorkMode = writable<WorkMode | AcademicStudyMode | null>(null);
export const selectedActions = writable<ActionId[]>([]);
// Attitude level: 0=not working/slack, 1=slack, 2=normal(default), 3=hard, 4=super hard
export const attitudeLevel = writable<number>(1); // default: normal

// Current event being shown to player
export const currentEvent = writable<GameEvent | null>(null);
export const eventQueue = writable<GameEvent[]>([]);

// Session tracking
export const currentSessionId = writable<string | null>(null);
export const saveList = writable<SaveMeta[]>([]);

// Derived stores
export const turnInfo = derived(gameState, ($gs) => {
  if (!$gs) return { year: 2024, quarter: 1, age: 22 };
  return getTurnInfo($gs.turn);
});

export const effectiveAp = derived(gameState, ($gs) => {
  if (!$gs) return 7;
  return getEffectiveAp($gs);
});

const ATTITUDE_ACTION_IDS = ['workNone', 'workSlack', 'workHard', 'workSuperHard', 'studySlack', 'studyNormal', 'studyHard'];

export const availableActions = derived(gameState, ($gs) => {
  if (!$gs) return [];
  // Filter out attitude actions — handled by toggle bar
  return getAvailableActions($gs).filter(a => !ATTITUDE_ACTION_IDS.includes(a.id));
});

export const remainingAp = derived([effectiveAp, selectedActions, availableActions], ([$eap, $sa, $avail]) => {
  let remaining = $eap;
  for (const actionId of $sa) {
    const action = $avail.find(a => a.id === actionId) || ACTIONS[actionId];
    if (action) remaining -= action.apCost;
  }
  return Math.max(0, remaining);
});

// Inferred work mode from current AP usage
export const inferredMode = derived([effectiveAp, remainingAp, selectedActions], ([$eap, $rem, $sa]) => {
  const used = $eap - $rem;
  const hasUrgent = $sa.includes('urgentJobSearch');
  return inferWorkMode(used, hasUrgent);
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
function scrollTop() {
  setTimeout(() => window.scrollTo(0, 0), 50);
}

export function startNewGame(creation: CreationAttributes) {
  const state = createGameState(creation);
  gameState.set(state);
  selectedWorkMode.set(null);
  selectedActions.set([]);
  startLog(creation, state.schoolModifier, state.geoBonus);
  const id = autoSave(state);
  currentSessionId.set(id);
  refreshSaveList();
  screen.set('game');
  scrollTop();
}

export function resumeGame(id: string) {
  const state = loadGame(id);
  if (!state) return false;
  gameState.set(state);
  selectedWorkMode.set(null);
  selectedActions.set([]);
  currentSessionId.set(id);
  screen.set('game');
  return true;
}

export function refreshSaveList() {
  saveList.set(getSaveIndex());
}

export function toggleAction(actionId: ActionId) {
  const current = get(selectedActions);
  if (current.includes(actionId)) {
    selectedActions.set(current.filter((id) => id !== actionId));
  } else {
    const gs = get(gameState);
    if (!gs) return;
    const avail = get(availableActions);
    const action = avail.find(a => a.id === actionId) || ACTIONS[actionId];
    if (!action) return;

    const rem = get(remainingAp);
    const check = canSelectAction(action, current, rem);
    if (check.allowed) {
      selectedActions.set([...current, actionId]);
    }
  }
}

export const autoPlayReasoning = writable<string[]>([]);

export function autoSelect() {
  const gs = get(gameState);
  if (!gs) return;
  const result = autoSelectTurn(gs);
  selectedWorkMode.set(result.workMode);
  selectedActions.set(result.actions);
  autoPlayReasoning.set(result.reasoning);
}

export function endTurn() {
  const gs = get(gameState);
  if (!gs) return;

  const actions = [...get(selectedActions)];
  // Inject attitude action based on toggle
  const att = get(attitudeLevel);
  const isAcad = gs.phase === 'academic';
  const attitudeActions: Record<number, ActionId> = isAcad
    ? { 0: 'studySlack', 1: 'studyNormal', 2: 'studyHard' }
    : { 0: 'workNone', 1: 'workSlack', 2: 'workHard', 3: 'workSuperHard' };
  const attAction = attitudeActions[att];
  if (attAction && !actions.includes(attAction)) {
    actions.push(attAction);
  }

  const stateBefore = gs;
  const newState = processTurn(gs, 'normal', actions);
  const mode = get(inferredMode);
  gameState.set(newState);
  logTurn(stateBefore, newState, mode, actions);

  // Auto-save
  const sessionId = get(currentSessionId);
  if (sessionId) autoSave(newState, sessionId);

  selectedWorkMode.set(null);
  selectedActions.set([]);
  autoPlayReasoning.set([]);
  attitudeLevel.set(1); // reset to normal

  // Check for pending random events
  const pendingIds = (newState.flags.pendingRandomEvents as string[]) || [];
  const pendingGameEvents = pendingIds
    .map(id => EVENT_POOL.find(e => e.id === id))
    .filter((e): e is GameEvent => e !== undefined);

  if (newState.endingType) {
    endLog(newState.endingType, calculateFinalScore(newState));
  }

  if (pendingGameEvents.length > 0) {
    eventQueue.set(pendingGameEvents.slice(1));
    currentEvent.set(pendingGameEvents[0]);
    screen.set('event');
  } else if (newState.endingType) {
    screen.set('endgame');
  } else {
    screen.set('summary');
  }
  scrollTop();
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
    scrollTop();
  }
}

export function continueTurn() {
  screen.set('game');
  // Scroll to top after screen change
  setTimeout(() => window.scrollTo(0, 0), 50);
}

export function exportGameLog() {
  downloadLog();
}

export async function shareGameResult(): Promise<boolean> {
  const gs = get(gameState);
  if (!gs) return false;
  return shareResult(gs);
}

export function returnToTitle() {
  gameState.set(null);
  currentEvent.set(null);
  eventQueue.set([]);
  screen.set('title');
}
