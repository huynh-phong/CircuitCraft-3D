export type SimulationStatus = 'stopped' | 'running' | 'unsupported' | 'error';

export interface ComponentSimulationState {
  isPowered: boolean;
  isOn: boolean; // For LEDs / Indicators
  stateLabel: string; // e.g. "Sáng (Phân cực thuận)", "Tắt (Công tắc mở)", "Dẫn dòng 15mA"
  currentEstimate?: string;
  voltageDrop?: string;
  note?: string;
}

export interface SimulationResult {
  status: SimulationStatus;
  revision: number;
  components: Record<string, ComponentSimulationState>;
  summary: string;
  isClosedLoop: boolean;
  issues: string[];
  timestamp: number;
}
