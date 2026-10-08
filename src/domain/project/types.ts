/**
 * CircuitCraft 3D - Domain Types
 * Single source of truth for the circuit document.
 * Strictly independent of React, Three.js, and external UI frameworks.
 */

export interface Vector3D {
  x: number; // mm
  y: number; // mm
  z: number; // mm
}

export interface Rotation3D {
  x: number; // degrees
  y: number; // degrees
  z: number; // degrees
}

export interface PinDefinition {
  id: string;
  name: string;
  type: 'power' | 'ground' | 'passive' | 'input' | 'output' | 'bidirectional';
  localOffset: Vector3D; // mm relative to component anchor
  description?: string;
  designator?: string; // e.g. "1", "2", "+", "-"
}

export type ComponentCategory =
  | 'power'
  | 'passives'
  | 'semiconductors'
  | 'switches'
  | 'connectors'
  | 'ics'
  | 'sensors'
  | 'microcontrollers'
  | 'opto';

export interface ComponentDefinition {
  definitionId: string;
  version: string;
  name: string;
  category: ComponentCategory;
  description: string;
  pins: PinDefinition[];
  defaultParameters: Record<string, any>;
  parameterSchema: Array<{
    name: string;
    label: string;
    type: 'number' | 'string' | 'select' | 'boolean';
    unit?: string;
    options?: Array<{ label: string; value: any }>;
    min?: number;
    max?: number;
    step?: number;
    default: any;
  }>;
  dimensions: Vector3D; // bounding box in mm [width, height, depth]
  footprintType: 'through-hole' | 'smd' | 'modular';
}

export interface ComponentInstance {
  instanceId: string;
  definitionId: string;
  name: string; // e.g. "R1", "LED1", "BAT1"
  position: Vector3D; // position on board in mm
  rotation: Rotation3D; // rotation in degrees
  parameters: Record<string, any>;
  state?: {
    open?: boolean; // for switches
    value?: number; // for potentiometers
    customLabel?: string;
  };
}

export type WireStyle = 'curved' | 'orthogonal' | 'straight';

export interface Connection {
  id: string;
  fromComponentId: string;
  fromPinId: string;
  toComponentId: string;
  toPinId: string;
  wireColor?: string; // optional hex e.g. "#ef4444" for power, "#000000" for gnd
  thickness?: number; // wire radius in mm, e.g. 0.35, 0.55, 0.9, 1.4 (default 0.55)
  wireStyle?: WireStyle; // 'curved' | 'orthogonal' | 'straight' (default 'curved')
  sag?: number; // arc height multiplier 0.5 -> 2.5 (default 1.0)
}

export interface WireRoute {
  id: string;
  connectionId: string;
  controlPoints: Vector3D[];
  visualOnly: true;
}

export type BoardShape = 'rectangle' | 'square' | 'circle' | 'triangle' | 'polygon';

export interface BoardDefinition {
  width: number; // mm (default 140)
  depth: number; // mm (default 90)
  thickness: number; // mm (default 1.6)
  solderMaskColor: string; // e.g. "#0f4c3a" (classic dark green) or "#0e3a53" (ocean blue)
  copperLayerCount: number; // default 2
  gridSpacing: number; // mm (default 2.54mm = 100 mil standard pitch)
  shape?: BoardShape; // 'rectangle' | 'square' | 'circle' | 'triangle' | 'polygon'
  radius?: number; // mm for circular board
  outline?: Array<{ x: number; z: number }>; // Closed 2D polygon vertices for custom / cut boards
  cutHistory?: Array<{ path: Array<{ x: number; z: number }>; timestamp: string }>;
}

export interface ProjectMetadata {
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'Dễ' | 'Trung bình' | 'Khó';
  category?: string;
  learningObjectives?: string[];
  requiredComponents?: string[];
  simulationSupport?: boolean;
  version?: string;
  slug?: string;
  isTemplate?: boolean;
}

export interface ProjectDocument {
  schemaVersion: number; // 1
  projectId: string;
  name: string;
  description?: string;
  revision: number;
  units: 'mm';
  board: BoardDefinition;
  components: ComponentInstance[];
  connections: Connection[];
  wireRoutes: WireRoute[];
  createdAt: string;
  updatedAt: string;
  authorId?: string;
  thumbnail?: string;
  metadata?: ProjectMetadata;
}

export interface DerivedPinWorldPosition {
  componentId: string;
  pinId: string;
  worldPosition: Vector3D;
}
