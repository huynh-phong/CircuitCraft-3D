import * as THREE from 'three';
import type { ComponentDefinition, ComponentInstance } from '../../../domain/project/types';
import { createPinTarget, resolvePins } from '../../assets/pins';
import { bakeStatic } from '../../assets/primitives';
import type { DetailLevel } from '../../assets/quality';
import type { BuildContext, ComponentModelSpec } from '../../assets/specs/types';
import { SCENE_UNITS_PER_MM } from '../../assets/units';
import { BLINK_MAX_HZ, ComponentMeshOptions } from '../types';

/**
 * Builds the scene object of one component from its v2 spec. The result has the same outer
 * contract as a legacy model (group name, userData, `pin-...` targets, `sim-glow`, `blink`), so
 * picking, selection, wiring, the reconciler and the simulation animation need no special case.
 */
export function buildV2ComponentMesh(
  spec: ComponentModelSpec,
  instance: ComponentInstance,
  definition: ComponentDefinition,
  options: ComponentMeshOptions,
  detail: DetailLevel
): THREE.Group {
  const root = new THREE.Group();
  root.name = `comp-${instance.instanceId}`;
  root.userData = {
    type: 'component',
    instanceId: instance.instanceId,
    definitionId: definition.definitionId,
    modelSpec: spec.id,
  };

  const pins = resolvePins(definition, spec.pins);
  const model = new THREE.Group();
  model.name = 'model';
  const ctx: BuildContext = {
    group: model,
    instance,
    definition,
    options,
    detail,
    pins,
    pin(id) {
      const pin = pins.find((p) => p.id === id);
      if (!pin) throw new Error(`Spec "${spec.id}": pin "${id}" is not defined by "${definition.definitionId}"`);
      return pin.position;
    },
  };
  spec.builder(ctx, spec.params(instance, options));
  bakeStatic(model);
  // The one place where millimetres become scene units
  model.scale.setScalar(SCENE_UNITS_PER_MM);
  root.add(model);

  if (options.pwm && options.pwm.frequencyHz <= BLINK_MAX_HZ && options.pwm.frequencyHz > 0) {
    root.userData.blink = { hz: options.pwm.frequencyHz, duty: options.pwm.duty };
  }

  for (const pin of pins) root.add(createPinTarget(instance.instanceId, pin));
  return root;
}
