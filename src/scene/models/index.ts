import type * as THREE from 'three';
import type { ComponentDefinition, ComponentInstance } from '../../domain/project/types';
import { getModelSpec } from '../assets/registry';
import type { DetailLevel } from '../assets/quality';
import {
  applyComponentTransform,
  componentVisualSignature as legacyVisualSignature,
  createComponentMesh as createLegacyComponentMesh,
} from './legacy/proceduralModels';
import { getModelSet, ModelSet } from './modelSet';
import type { ComponentMeshOptions, ModelBuildSettings } from './types';
import { buildV2ComponentMesh } from './v2/buildComponent';

/**
 * Component model registry: chooses between the legacy procedural models and the v2 models of the
 * asset library. Scene code only talks to this module.
 *
 * The choice (`modelSet`) and the level of detail are rendering settings: they change which meshes
 * are built, never the ProjectDocument, pin ids or pin anchors.
 */
export { applyComponentTransform };
export type { ComponentMeshOptions, ModelBuildSettings };
export type { ModelSet } from './modelSet';
export { DEFAULT_MODEL_SET, getModelSet, setModelSet, subscribeModelSet } from './modelSet';

const DEFAULT_DETAIL: DetailLevel = 'balanced';

/** The v2 spec used for `definition` under `modelSet`, or undefined when the legacy model is drawn. */
function activeSpec(definition: ComponentDefinition, modelSet: ModelSet) {
  // GLB-backed parts (Arduino, breadboard) keep their loaded model in both sets
  if (modelSet !== 'v2' || definition.modelUrl) return undefined;
  return getModelSpec(definition.definitionId);
}

export function createComponentMesh(
  instance: ComponentInstance,
  definition: ComponentDefinition,
  options: ComponentMeshOptions = {},
  settings: ModelBuildSettings = {}
): THREE.Group {
  const spec = activeSpec(definition, settings.modelSet ?? getModelSet());
  if (!spec) return createLegacyComponentMesh(instance, definition, options);
  const group = buildV2ComponentMesh(spec, instance, definition, options, settings.detail ?? DEFAULT_DETAIL);
  applyComponentTransform(group, instance);
  return group;
}

/**
 * Everything createComponentMesh's output depends on, except position and rotation. Two equal
 * signatures produce identical meshes, so the reconciler keeps the existing object.
 */
export function componentVisualSignature(
  instance: ComponentInstance,
  definition: ComponentDefinition,
  options: ComponentMeshOptions = {},
  settings: ModelBuildSettings = {}
): string {
  const spec = activeSpec(definition, settings.modelSet ?? getModelSet());
  const legacy = legacyVisualSignature(instance, definition, options);
  return spec ? `v2:${spec.id}:${settings.detail ?? DEFAULT_DETAIL}:${legacy}` : `legacy:${legacy}`;
}
