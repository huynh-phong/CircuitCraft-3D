import type * as THREE from 'three';
import type { ComponentDefinition, ComponentInstance, Vector3D } from '../../../domain/project/types';
import type { ComponentMeshOptions } from '../../models/types';
import type { PinVisualSpec, ResolvedPin } from '../pins';
import type { DetailLevel } from '../quality';

/** What a builder receives. Everything is in millimetres; Y = 0 is the board surface. */
export interface BuildContext {
  /** Add the model's parts here (with `part()` from ../primitives). Origin = component anchor. */
  group: THREE.Group;
  instance: ComponentInstance;
  definition: ComponentDefinition;
  /** Simulation state of this component (LED brightness, switch closed, ...). */
  options: ComponentMeshOptions;
  detail: DetailLevel;
  pins: ResolvedPin[];
  /** Anchor of a pin, straight from the domain definition. Throws for an unknown id. */
  pin(id: string): Vector3D;
}

/** A reusable shape family (axial, radial LED, battery holder, ...). `P` is its parameter object. */
export type Builder<P> = (ctx: BuildContext, params: P) => void;

/**
 * Declaration of one component model. Adding a component = one spec file + one line in registry.ts.
 */
export interface ComponentModelSpec<P = any> {
  /** Unique id of the spec (kebab-case). */
  id: string;
  /** Domain definition ids drawn with this spec (canonical id + the legacy aliases that still exist). */
  definitionIds: string[];
  /** Real part and datasheet the dimensions were taken from. */
  reference: string;
  builder: Builder<P>;
  /** Real dimensions (mm), colours and state, possibly derived from the instance parameters. */
  params: (instance: ComponentInstance, options: ComponentMeshOptions) => P;
  /**
   * Visual information per pin id of the CANONICAL definition (role, lead direction, touch radius).
   * Ids must match the domain definition exactly; positions are never declared here.
   */
  pins: Record<string, PinVisualSpec>;
}

export const defineSpec = <P>(spec: ComponentModelSpec<P>): ComponentModelSpec<P> => spec;
