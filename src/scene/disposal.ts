import * as THREE from 'three';

/**
 * GPU resource lifecycle helpers for the 3D workspace.
 *
 * Shared resources (the SceneMaterialRegistry materials and the geometries / materials /
 * textures of cached GLB models, which `clone()` shares between instances) are registered
 * here and are NEVER disposed when a mesh using them is removed. Everything else that is
 * removed from the scene is disposed so repeated rebuilds do not leak GPU memory.
 */

const sharedResources = new WeakSet<object>();

const TEXTURE_KEYS = [
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'lightMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
  'specularMap',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'sheenColorMap',
  'sheenRoughnessMap',
  'transmissionMap',
  'thicknessMap',
] as const;

function materialTextures(material: THREE.Material): THREE.Texture[] {
  const out: THREE.Texture[] = [];
  for (const key of TEXTURE_KEYS) {
    const tex = (material as any)[key];
    if (tex && (tex as THREE.Texture).isTexture) out.push(tex);
  }
  return out;
}

export function markShared(resource: THREE.Material | THREE.BufferGeometry | THREE.Texture | null | undefined): void {
  if (!resource) return;
  sharedResources.add(resource);
  if ((resource as THREE.Material).isMaterial) {
    for (const tex of materialTextures(resource as THREE.Material)) sharedResources.add(tex);
  }
}

/** Marks every geometry / material / texture under `root` as shared (e.g. a cached GLB scene). */
export function markObjectTreeShared(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const anyObj = obj as any;
    if (anyObj.geometry) markShared(anyObj.geometry);
    const mats = Array.isArray(anyObj.material) ? anyObj.material : anyObj.material ? [anyObj.material] : [];
    for (const m of mats) markShared(m);
  });
}

export function isShared(resource: object): boolean {
  return sharedResources.has(resource);
}

function disposeMaterial(material: THREE.Material, seen: Set<object>) {
  if (seen.has(material) || sharedResources.has(material)) return;
  seen.add(material);
  for (const tex of materialTextures(material)) {
    if (!seen.has(tex) && !sharedResources.has(tex)) {
      seen.add(tex);
      tex.dispose();
    }
  }
  material.dispose();
}

/** Disposes all non-shared GPU resources owned by `root` and its descendants. */
export function disposeObjectTree(root: THREE.Object3D | null | undefined): void {
  if (!root) return;
  const seen = new Set<object>();
  root.traverse((obj) => {
    const anyObj = obj as any;
    const geometry: THREE.BufferGeometry | undefined = anyObj.geometry;
    if (geometry && !seen.has(geometry) && !sharedResources.has(geometry)) {
      seen.add(geometry);
      geometry.dispose();
    }
    const mats: THREE.Material[] = Array.isArray(anyObj.material) ? anyObj.material : anyObj.material ? [anyObj.material] : [];
    for (const m of mats) disposeMaterial(m, seen);
    if ((obj as THREE.InstancedMesh).isInstancedMesh && typeof (obj as any).dispose === 'function') {
      (obj as any).dispose();
    }
  });
}

/** Removes and disposes every child of a group (the group itself is kept). */
export function clearGroup(group: THREE.Object3D): void {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    disposeObjectTree(child);
  }
}
