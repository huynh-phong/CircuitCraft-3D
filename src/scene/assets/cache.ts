import * as THREE from 'three';
import { markShared } from '../disposal';

/**
 * Shared GPU resources of the asset library.
 *
 * Every geometry / material / texture made by `primitives/` and `materials/` goes through these
 * caches and is registered with `markShared`, so `disposeObjectTree` (disposal.ts) and
 * `reconcileChildren` (sceneReconciler.ts) never dispose it when one mesh is removed.
 *
 * Keys must come from a SMALL, DISCRETE set of values (dimensions of a spec, a detail level, a
 * colour of a fixed palette). Never put a continuous user value in a key (an angle, a voltage):
 * apply those with a transform instead, otherwise the cache grows without bound.
 */
const geometries = new Map<string, THREE.BufferGeometry>();
const materials = new Map<string, THREE.Material>();
const textures = new Map<string, THREE.Texture>();

export function cachedGeometry<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let geometry = geometries.get(key) as T | undefined;
  if (!geometry) {
    geometry = make();
    geometry.name = key;
    markShared(geometry);
    geometries.set(key, geometry);
  }
  return geometry;
}

export function cachedMaterial<T extends THREE.Material>(key: string, make: () => T): T {
  let material = materials.get(key) as T | undefined;
  if (!material) {
    material = make();
    material.name = key;
    markShared(material);
    materials.set(key, material);
  }
  return material;
}

/** `make` may return null where textures cannot be created (Node tests have no canvas). */
export function cachedTexture<T extends THREE.Texture>(key: string, make: () => T | null): T | null {
  let texture = textures.get(key) as T | undefined;
  if (!texture) {
    const made = make();
    if (!made) return null;
    texture = made;
    texture.name = key;
    markShared(texture);
    textures.set(key, texture);
  }
  return texture;
}

export function assetCacheStats(): { geometries: number; materials: number; textures: number } {
  return { geometries: geometries.size, materials: materials.size, textures: textures.size };
}

/** Releases every cached resource. Only for a full teardown (tests, hot reload): nothing may still use them. */
export function disposeAssetCaches(): void {
  for (const g of geometries.values()) g.dispose();
  for (const m of materials.values()) m.dispose();
  for (const t of textures.values()) t.dispose();
  geometries.clear();
  materials.clear();
  textures.clear();
}
