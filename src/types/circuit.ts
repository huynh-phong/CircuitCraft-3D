/**
 * CircuitVerse 3D - Core Type Definitions & Data Contracts
 */

export type ComponentType = 
  | 'dc_power_supply' // Nguồn DC (5V, 9V, 12V)
  | 'resistor'        // Điện trở (Ohms)
  | 'led'             // Đèn LED phát quang
  | 'switch_spst'     // Công tắc gạt đơn
  | 'connector'       // Đầu nối / Trạm đấu dây (2-pin / Header)
  | 'capacitor'       // Tụ điện hóa
  | 'potentiometer'   // Biến trở xoay
  | 'pushbutton'      // Nút nhấn nhả
  | 'diode'           // Diode bán dẫn 1N4007
  | 'buzzer'          // Còi chíp 5V
  | 'ldr'             // Quang trở LDR
  | 'relay'           // Rơ-le 5V
  | 'ne555'           // IC định thời NE555
  | 'logic_and'       // Cổng logic AND
  | 'arduino_uno'     // Bo vi điều khiển Arduino UNO R3
  | 'temp_sensor';    // Cảm biến nhiệt độ LM35

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export type PinType = 'anode' | 'cathode' | 'passive' | 'power_pos' | 'power_neg' | 'input' | 'output' | 'bidirectional';

export interface PinDefinition {
  id: string;                 // e.g., 'pin_pos', 'pin_neg', 'pin_1', 'pin_2', 'pin_anode', 'pin_cathode'
  label: string;              // e.g., '+', '-', '1', '2', 'A', 'K'
  type: PinType;
  relativePosition: Vector3D; // Offset from component center in millimeters (mm)
}

export interface ComponentProperties {
  voltage?: number;           // V
  resistance?: number;        // Ohms
  forwardVoltage?: number;    // V (LED threshold)
  maxCurrent?: number;        // mA
  color?: string;             // Hex code
  isClosed?: boolean;         // Switch state
  label?: string;
  pinsCount?: number;         // For connectors
  [key: string]: any;
}

export interface ComponentDefinition {
  id: string;                 // Stable ID e.g., 'dc_power_supply', 'resistor', 'led', 'switch_spst', 'connector'
  type: ComponentType;
  version: string;            // Semantic version e.g. '1.0.0'
  name: string;
  description: string;
  category: 'Nguồn' | 'Thụ động' | 'Chỉ báo' | 'Điều khiển' | 'Đầu nối' | 'Bán dẫn' | 'Vi mạch' | 'Cảm biến' | 'Vi điều khiển';
  pins: PinDefinition[];
  defaultProperties: ComponentProperties;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
}

export interface SchemaValidationError {
  path: string;
  message: string;
  code: 'UNSUPPORTED_VERSION' | 'DUPLICATE_ID' | 'NON_FINITE_VALUE' | 'PIN_NOT_FOUND' | 'COMPONENT_NOT_FOUND' | 'SELF_CONNECTION' | 'INVALID_FIELD';
}

export interface SchemaValidationResult {
  isValid: boolean;
  errors: SchemaValidationError[];
}

export interface ComponentInstance {
  id: string;
  type: ComponentType;
  name: string;
  position: Vector3D;
  rotation: number;           // Rotation around Y axis in degrees (0, 90, 180, 270)
  properties: ComponentProperties;
  pins: PinDefinition[];
}

export interface ConnectionWire {
  id: string;
  fromComponentId: string;
  fromPinId: string;
  toComponentId: string;
  toPinId: string;
  color: string;
}

export interface WireRoute {
  connectionId: string;
  waypoints: Vector3D[];
}

export interface BoardConfig {
  width: number;
  depth: number;
  thickness: number;
  gridSize: number;
  color: string;
}

export interface ProjectMetadata {
  authorId?: string;
  authorName?: string;
  tags?: string[];
  isTemplate?: boolean;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export interface ProjectDocument {
  schemaVersion: number;
  revision: number;
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  board: BoardConfig;
  components: ComponentInstance[];
  connections: ConnectionWire[];
  wireRoutes?: WireRoute[];
  metadata?: ProjectMetadata;
}

// Command & History Engine
export interface Command {
  id: string;
  type: string;
  description: string;
  execute: (doc: ProjectDocument) => ProjectDocument;
  undo: (doc: ProjectDocument) => ProjectDocument;
}

export interface Transaction {
  id: string;
  description: string;
  commands: Command[];
  timestamp: number;
}

export interface CommandHistoryState {
  past: Transaction[];
  future: Transaction[];
  canUndo: boolean;
  canRedo: boolean;
}

// Validation Engine
export type ValidationSeverity = 'info' | 'warning' | 'error';

export interface ObjectRef {
  type: 'component' | 'connection' | 'pin';
  id: string;
  secondaryId?: string;
}

export interface ValidationDiagnostic {
  ruleId: string;
  severity: ValidationSeverity;
  message: string;
  details?: string;
  objectRefs: ObjectRef[];
}

export interface ValidationResult {
  timestamp: number;
  isValid: boolean;
  diagnostics: ValidationDiagnostic[];
  stats: {
    errorsCount: number;
    warningsCount: number;
    infosCount: number;
  };
}

// Simulation Engine
export type SimulationState = 'stopped' | 'running' | 'unsupported' | 'error';

export interface ComponentSimState {
  componentId: string;
  isActive: boolean;
  isOverloaded?: boolean;
  isUnderpowered?: boolean;
  currentMa?: number;
  voltageDrop?: number;
  statusText: string;
  color?: string;
}

export interface SimulationResult {
  state: SimulationState;
  timestamp: number;
  message: string;
  supportedTopology: boolean;
  componentStates: Record<string, ComponentSimState>;
  circuitFlow: {
    isClosedLoop: boolean;
    currentFlowing: boolean;
    estimatedCurrentMa?: number;
  };
}

// AI Proposal
export interface AIProposalChange {
  action: 'add_component' | 'remove_component' | 'move_component' | 'update_property' | 'add_connection' | 'remove_connection';
  payload: any;
}

export interface AIProposal {
  id: string;
  baseRevision: number;
  summary: string;
  explanation: string;
  safetyCheckPassed: boolean;
  changes: AIProposalChange[];
  isMockFallback?: boolean;
}

// User Tier & Permissions
export type UserTier = 'free' | 'student' | 'creator' | 'pro_soon' | 'edu_soon';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  tier: UserTier;
  createdAt: string;
}

export interface MarketplaceItem {
  id: string;
  title: string;
  category: string;
  tierRequired: UserTier;
  difficulty: string;
  price: number;
  author: string;
  description: string;
  downloads: number;
  rating: number;
  circuitData?: Partial<ProjectDocument>;
}

// Editor Interaction & Transient State (Strictly separated from ProjectDocument)
export interface EditorInteractionState {
  selectedComponentId: string | null;
  selectedWireId: string | null;
  hoveredComponentId: string | null;
  hoveredPinId: string | null;
  activePinWiring: { componentId: string; pinId: string } | null;
  mode: 'select' | 'wire' | 'pan';
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    isLowGraphics: boolean;
  };
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  revision: number;
}

export interface SaveProjectResult {
  success: boolean;
  revision: number;
  conflict?: boolean;
  message?: string;
}

export interface ProjectRepository {
  getProject(id: string): Promise<ProjectDocument>;
  saveProject(doc: ProjectDocument, expectedRevision?: number): Promise<SaveProjectResult>;
  listProjects(userId?: string): Promise<ProjectSummary[]>;
  deleteProject(id: string): Promise<boolean>;
}

