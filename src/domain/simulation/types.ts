export type SimulationStatus = 'stopped' | 'running' | 'unsupported' | 'error';

export interface ComponentSimulationState {
  isPowered: boolean;
  isOn: boolean; // For LEDs / Indicators
  stateLabel: string; // e.g. "Sáng (Phân cực thuận)", "Tắt (Công tắc mở)", "Dẫn dòng 15mA"
  currentEstimate?: string;
  voltageDrop?: string;
  note?: string;
  /** Numeric results (SI units) from the DC solver */
  currentA?: number;
  voltageV?: number;
}

export interface SimulationResult {
  status: SimulationStatus;
  revision: number;
  components: Record<string, ComponentSimulationState>;
  summary: string;
  isClosedLoop: boolean;
  issues: string[];
  timestamp: number;
  /** Solver used: Modified Nodal Analysis, DC steady state */
  solver?: 'mna-dc';
  /** Components shown in 3D but without an electrical model (not included in the results) */
  unsupportedComponents?: string[];
  /** Node voltages relative to each island's reference (negative terminal of its first source) */
  nodeVoltages?: Record<string, number>;
}
