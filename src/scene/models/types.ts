import type { ComponentVisualState } from '../../domain/simulation/types';
import type { DetailLevel } from '../assets/quality';
import type { ModelSet } from './modelSet';

/** Everything the solver tells the scene about one component (see simulation/types.ts). */
export interface ComponentMeshOptions {
  isSimulationOn?: boolean;
  switchClosed?: boolean;
  visual?: ComponentVisualState;
  pwm?: { frequencyHz: number; duty: number };
}

/** Scene-only rendering choices. Never stored in the ProjectDocument. */
export interface ModelBuildSettings {
  /** Defaults to the active model set (see modelSet.ts). */
  modelSet?: ModelSet;
  /** Defaults to 'balanced'. Follows the workspace quality setting. */
  detail?: DetailLevel;
}

/** Above this frequency a PWM-driven part is drawn at its average level instead of blinking. */
export const BLINK_MAX_HZ = 20;
