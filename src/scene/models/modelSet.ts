/**
 * Which set of component models the workspace draws.
 *
 *  - 'v2'     : models built from the asset library (src/scene/assets). Default.
 *  - 'legacy' : the previous procedural models, kept unchanged in ./legacy for comparison and rollback.
 *
 * A definition without a v2 spec is always drawn with its legacy model, whatever the set.
 * The choice is a rendering preference only: it is never written to a ProjectDocument.
 *
 * How to switch (highest priority first):
 *   1. URL:          ?modelSet=legacy
 *   2. localStorage: cc3d.modelSet = "legacy"   (or `window.__cc3dSetModelSet('legacy')` in dev)
 *   3. Build config: VITE_MODEL_SET=legacy
 *
 * The legacy set is only removed once the project owner confirms it (see docs/ARCHITECTURE.md).
 */
export type ModelSet = 'legacy' | 'v2';

export const DEFAULT_MODEL_SET: ModelSet = 'v2';
export const MODEL_SET_STORAGE_KEY = 'cc3d.modelSet';

const isModelSet = (value: unknown): value is ModelSet => value === 'legacy' || value === 'v2';

let current: ModelSet | null = null;
const listeners = new Set<() => void>();

function resolveInitial(): ModelSet {
  try {
    if (typeof window !== 'undefined') {
      const fromUrl = new URLSearchParams(window.location.search).get('modelSet');
      if (isModelSet(fromUrl)) return fromUrl;
      const stored = window.localStorage?.getItem(MODEL_SET_STORAGE_KEY);
      if (isModelSet(stored)) return stored;
    }
  } catch {
    // storage blocked: fall through to the configured default
  }
  const configured = (import.meta as any).env?.VITE_MODEL_SET;
  return isModelSet(configured) ? configured : DEFAULT_MODEL_SET;
}

export function getModelSet(): ModelSet {
  if (current === null) current = resolveInitial();
  return current;
}

export function setModelSet(next: ModelSet, persist = true): void {
  if (!isModelSet(next) || next === getModelSet()) return;
  current = next;
  if (persist) {
    try {
      window.localStorage?.setItem(MODEL_SET_STORAGE_KEY, next);
    } catch {
      // not persisted: still applies to this session
    }
  }
  for (const listener of listeners) listener();
}

export function subscribeModelSet(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
