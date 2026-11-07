import * as THREE from 'three';
import { disposeObjectTree } from './disposal';

/**
 * Keeps the children of a group in sync with a list of items, rebuilding only the objects whose
 * visual signature changed. Each object remembers its key and signature in `userData`, so objects
 * added by other code paths (without a signature) are simply rebuilt on the next pass.
 */

export interface ReconcileItem<T> {
  key: string;
  signature: string;
  data: T;
}

export interface ReconcileStats {
  built: number;
  kept: number;
  removed: number;
}

export function reconcileChildren<T>(
  parent: THREE.Object3D,
  items: ReconcileItem<T>[],
  build: (data: T) => THREE.Object3D | null,
  onKeep?: (object: THREE.Object3D, data: T) => void
): ReconcileStats {
  const stats: ReconcileStats = { built: 0, kept: 0, removed: 0 };
  const existing = new Map<string, THREE.Object3D>();
  for (const child of [...parent.children]) {
    const key = child.userData?.reconcileKey;
    if (typeof key === 'string' && !existing.has(key)) {
      existing.set(key, child);
    } else {
      parent.remove(child);
      disposeObjectTree(child);
      stats.removed += 1;
    }
  }

  const ordered: THREE.Object3D[] = [];
  for (const item of items) {
    const current = existing.get(item.key);
    if (current && current.userData.reconcileSignature === item.signature) {
      existing.delete(item.key);
      onKeep?.(current, item.data);
      ordered.push(current);
      stats.kept += 1;
      continue;
    }
    if (current) {
      existing.delete(item.key);
      parent.remove(current);
      disposeObjectTree(current);
      stats.removed += 1;
    }
    const built = build(item.data);
    if (built) {
      built.userData.reconcileKey = item.key;
      built.userData.reconcileSignature = item.signature;
      parent.add(built);
      ordered.push(built);
      stats.built += 1;
    }
  }

  for (const stale of existing.values()) {
    parent.remove(stale);
    disposeObjectTree(stale);
    stats.removed += 1;
  }

  // Keep document order: exploded-view layers and wire pulse phases are derived from the index
  parent.children.splice(0, parent.children.length, ...ordered);
  return stats;
}
