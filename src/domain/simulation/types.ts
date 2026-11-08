export type SimulationStatus = 'stopped' | 'running' | 'unsupported' | 'error';

/**
 * What the 3D scene shows for a component. Every value comes from the solver; the scene never
 * animates a part on its own.
 */
export interface ComponentVisualState {
  /** LED light output relative to its rated current (0 = dark, 1 = rated current). */
  brightness?: number;
  /** RGB LED chip levels [red, green, blue], same scale as brightness. */
  rgb?: [number, number, number];
  /** 7-segment levels per segment key a-g, dp. */
  segments?: Record<string, number>;
  /** Servo shaft angle in degrees, only when a valid control pulse is received. */
  angleDeg?: number;
  /** Motor speed (signed, revolutions per minute). */
  rpm?: number;
  sounding?: boolean;
  displayOn?: boolean;
  /** Relay contact currently closed to COM. */
  contact?: 'no' | 'nc';
}

export interface ComponentSimulationState {
  isPowered: boolean;
  isOn: boolean; // For LEDs / Indicators
  stateLabel: string; // e.g. "Sáng (Phân cực thuận)", "Tắt (Công tắc mở)", "Dẫn dòng 13.6 mA"
  currentEstimate?: string;
  voltageDrop?: string;
  note?: string;
  /** Numeric results (SI units) from the solver */
  currentA?: number;
  voltageV?: number;
  powerW?: number;
  /** Operating mode of a piecewise-linear / behavioural model (e.g. 'saturation', 'astable'). */
  mode?: string;
  /** The part follows an oscillator: blinking (low frequency) or PWM (average brightness). */
  pwm?: { frequencyHz: number; duty: number; sourceId: string };
  /** First-order time constant of a capacitor (s). */
  timeConstantS?: number;
  visual?: ComponentVisualState;
}

/** Structured finding from the solver; the design rule checker shows the same findings. */
export interface SimulationDiagnostic {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  objectRefs: string[];
  suggestion?: string;
}

export interface SimulationResult {
  status: SimulationStatus;
  revision: number;
  components: Record<string, ComponentSimulationState>;
  summary: string;
  isClosedLoop: boolean;
  /** Error / warning messages (kept as plain text for existing UI and lesson checks). */
  issues: string[];
  diagnostics?: SimulationDiagnostic[];
  timestamp: number;
  /** Solver used: Modified Nodal Analysis, DC steady state (+ behavioural device models) */
  solver?: 'mna-dc';
  /** Components shown in 3D but without an electrical model (not included in the results) */
  unsupportedComponents?: string[];
  /** Node voltages relative to each island's reference (negative terminal of its first source) */
  nodeVoltages?: Record<string, number>;
}
