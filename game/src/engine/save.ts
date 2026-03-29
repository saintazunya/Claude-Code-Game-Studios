// Save/Load system — persist game state to localStorage with session IDs

import type { GameState } from './types';

const SAVE_PREFIX = 'gco_save_';
const SAVE_INDEX_KEY = 'gco_saves';

export interface SaveMeta {
  id: string;
  timestamp: string;
  turn: number;
  age: number;
  build: string;
  netWorth: number;
  visa: string;
  ending: string | null;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function serializeState(state: GameState): string {
  const serializable = {
    ...state,
    eventFired: Array.from(state.eventFired),
  };
  return JSON.stringify(serializable);
}

function deserializeState(json: string): GameState {
  const parsed = JSON.parse(json);
  parsed.eventFired = new Set(parsed.eventFired || []);
  return parsed as GameState;
}

export function saveGame(state: GameState): string {
  const id = generateId();
  const age = 22 + Math.floor((state.turn - 1) / 4);

  // Save the state
  localStorage.setItem(SAVE_PREFIX + id, serializeState(state));

  // Update save index
  const index = getSaveIndex();
  const meta: SaveMeta = {
    id,
    timestamp: new Date().toISOString(),
    turn: state.turn,
    age,
    build: `${state.creation.constitution}/${state.creation.schoolRanking}/${state.creation.geoLocation}`,
    netWorth: Math.round(state.attributes.netWorth),
    visa: state.immigration.visaType,
    ending: state.endingType,
  };
  index.unshift(meta); // newest first
  // Keep max 10 saves
  if (index.length > 10) {
    const removed = index.splice(10);
    for (const r of removed) {
      localStorage.removeItem(SAVE_PREFIX + r.id);
    }
  }
  localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index));

  return id;
}

export function loadGame(id: string): GameState | null {
  const json = localStorage.getItem(SAVE_PREFIX + id);
  if (!json) return null;
  try {
    return deserializeState(json);
  } catch {
    return null;
  }
}

export function getSaveIndex(): SaveMeta[] {
  try {
    const json = localStorage.getItem(SAVE_INDEX_KEY);
    if (!json) return [];
    return JSON.parse(json);
  } catch {
    return [];
  }
}

export function deleteSave(id: string) {
  localStorage.removeItem(SAVE_PREFIX + id);
  const index = getSaveIndex().filter(s => s.id !== id);
  localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index));
}

// Auto-save after each turn
export function autoSave(state: GameState, existingId?: string): string {
  if (existingId) {
    // Overwrite existing save
    localStorage.setItem(SAVE_PREFIX + existingId, serializeState(state));
    // Update meta
    const index = getSaveIndex();
    const meta = index.find(s => s.id === existingId);
    if (meta) {
      meta.timestamp = new Date().toISOString();
      meta.turn = state.turn;
      meta.age = 22 + Math.floor((state.turn - 1) / 4);
      meta.netWorth = Math.round(state.attributes.netWorth);
      meta.visa = state.immigration.visaType;
      meta.ending = state.endingType;
      localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index));
    }
    return existingId;
  }
  return saveGame(state);
}
