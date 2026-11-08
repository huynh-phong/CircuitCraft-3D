import { SimulationResult, ComponentSimulationState, SimulationDiagnostic } from './types';
import { ProjectDocument, ComponentInstance, Connection } from '../project/types';
import { COMPONENT_DEFINITION_MAP, getBreadboardBusId } from '../components/definitions';
import { calculatePinWorldPosition } from '../project/coordinates';
import { toCanonicalDocument } from '../components/aliases';

/**
 * CircuitCraft 3D - circuit simulator.
 *
 * Core: Modified Nodal Analysis (MNA), DC steady state. Every set of electrically connected pins
 * (wires, breadboard buses, parts plugged into the breadboard) is a node. Elements are stamped as
 * conductances (Ohm's law), independent voltage sources (with a branch-current unknown), current
 * sources and current-controlled current sources; solving G·x = b enforces KCL at every node and
 * KVL around every loop.
 *
 * Non-linear and behavioural parts are piecewise-linear devices with discrete modes, solved
 * iteratively until no device changes mode (LED/diode on/off, transistor cutoff/active/saturation,
 * relay pulled in/released, regulator off/dropout/regulating/current limit, logic levels...).
 *
 * Time behaviour is NOT integrated step by step. Two limited, explicit extensions exist:
 *  - Oscillators with a closed-form period (NE555 astable, Arduino sample programs) are solved once
 *    per output level; parts whose state differs between the levels are reported with the
 *    frequency and duty cycle (blinking / PWM) instead of an invented waveform.
 *  - Capacitors report the first-order time constant τ = R_th·C seen from their terminals.
 *
 * Components without an electrical model are reported as unsupported instead of being given
 * fabricated values. See docs/reports/COMPONENT_SIMULATION_AUDIT_2026-11-08.md for every model,
 * its formulas, sources and limits.
 */

// --------------------------------------------------------------------------------------
// Model constants (SI units). Values come from the datasheets named in the comments.
// --------------------------------------------------------------------------------------
export const SIM_CONSTANTS = {
  CONTACT_RESISTANCE: 0.01, // Ω closed switch / relay contact
  LED_SERIES_RESISTANCE: 10, // Ω dynamic resistance in the ON region
  LED_MAX_REVERSE_VOLTAGE: 5, // V, VR of standard indicator LEDs
  DIODE_FORWARD_VOLTAGE: 0.7, // V (1N4007 at small currents; VF max 1.1 V at 1 A)
  DIODE_SERIES_RESISTANCE: 1, // Ω
  OFF_RESISTANCE: 1e9, // Ω reverse-biased junction / capacitor leakage / open device
  WEAK_RESISTANCE: 1e8, // Ω paths at or above this do not "drive" a node (floating detection)
  LED_VISIBLE_CURRENT: 0.0002, // A (0.2 mA) below this an LED is considered dark
  LED_DIM_CURRENT: 0.002, // A (2 mA) below this the LED glows dimly
  CONDUCTING_CURRENT: 1e-6, // A
  RELAY_COIL_RESISTANCE: 70, // Ω  SRD-05VDC-SL-C
  RELAY_PICKUP_VOLTAGE: 3.75, // V must-operate voltage (≤ 75 % of 5 V)
  RELAY_RELEASE_VOLTAGE: 0.5, // V must-release voltage (≥ 10 % of 5 V)
  BUZZER_EQUIVALENT_RESISTANCE: 170, // Ω (≈ 30 mA at 5 V, rated current of 5 V active buzzers)
  BUZZER_MIN_VOLTAGE: 4.0, // V
  BUZZER_MAX_VOLTAGE: 7.0, // V
  ARDUINO_PIN_RESISTANCE: 25, // Ω ATmega328P output stage (VOH ≥ 4.2 V at 20 mA)
  ARDUINO_PIN_RECOMMENDED_CURRENT: 0.02, // A, UNO R3 "DC current per I/O pin"
  ARDUINO_PIN_MAX_CURRENT: 0.04, // A, ATmega328P absolute maximum per pin
  ARDUINO_VIL: 1.5, // V (0.3·VCC)
  ARDUINO_VIH: 3.0, // V (0.6·VCC)
  ARDUINO_5V_MAX_CURRENT: 0.5, // A, USB polyfuse
  ARDUINO_3V3_MAX_CURRENT: 0.05, // A, UNO R3 "DC current for 3.3 V pin"
  SOURCE_INTERNAL_RESISTANCE: 0.05, // Ω bench supply / battery internal resistance
  ARDUINO_RAIL_RESISTANCE: 0.1, // Ω on-board regulator output
  SHORT_CIRCUIT_RESISTANCE: 1, // Ω: load below this across a source = short circuit
  BJT_VBE: 0.7, // V
  BJT_VCE_SAT: 0.2, // V
  BJT_BASE_RESISTANCE: 10, // Ω
  BJT_MAX_IC: 0.6, // A (PN2222A continuous collector current)
  BJT_MAX_POWER: 0.625, // W (TO-92 at 25 °C)
  BJT_VCEO: 40, // V
  REG_DROPOUT: 2.0, // V LM78xx dropout
  REG_QUIESCENT: 0.005, // A LM7805 typical quiescent current
  REG_MAX_INPUT: 35, // V absolute maximum input (LM7805/LM7812)
  REG_RATED_CURRENT: 1.5, // A
  REG_LIMIT_CURRENT: 2.2, // A typical peak output current (internal current limit)
  LM35_GAIN: 0.01, // V/°C
  LM35_MIN_SUPPLY: 4, // V
  LM35_MAX_SUPPLY: 30, // V
  LM35_QUIESCENT: 60e-6, // A
  LM35_MAX_OUTPUT_CURRENT: 0.01, // A
  HC_MIN_VCC: 2, // V 74HC operating supply
  HC_MAX_VCC: 6, // V
  HC_ABS_MAX_VCC: 7, // V
  HC_OUTPUT_RESISTANCE: 50, // Ω (VOH 4.32 V typ at 4 mA, VCC 4.5 V)
  HC_MAX_OUTPUT_CURRENT: 0.025, // A absolute maximum
  NE555_MIN_VCC: 4.5, // V
  NE555_MAX_VCC: 16, // V recommended
  NE555_ABS_MAX_VCC: 18, // V
  NE555_HIGH_DROP: 1.4, // V output-high drop below VCC at light load
  NE555_HIGH_RESISTANCE: 3, // Ω (VOH 3.3 V typ at −100 mA, VCC 5 V)
  NE555_LOW_RESISTANCE: 20, // Ω (VOL 0.1 V typ at 5 mA)
  NE555_RESET_THRESHOLD: 0.7, // V
  SERVO_MIN_VOLTAGE: 4.8, // V SG90
  SERVO_MAX_VOLTAGE: 6.0, // V
  SERVO_MIN_PULSE_US: 544, // Arduino Servo library default
  SERVO_MAX_PULSE_US: 2400,
  BLINK_VISIBLE_MAX_HZ: 20, // above this the eye sees a steady (average) brightness
  MAX_ITERATIONS: 80,
  TIME_BUDGET_MS: 400, // per solve phase; a pathological circuit cannot freeze the page
};

const LED_VF_BY_COLOR: Record<string, number> = {
  red: 2.0,
  orange: 2.0,
  yellow: 2.1,
  green: 2.2,
  blue: 3.0,
  white: 3.0,
  purple: 3.2,
};

/** Canonical definition ids that the solver models (fully or behaviourally). */
export const ELECTRICALLY_MODELED = new Set([
  'dc-source',
  'arduino-uno',
  'resistor',
  'potentiometer',
  'ldr',
  'switch',
  'pushbutton',
  'connector',
  'led',
  'diode',
  'buzzer',
  'capacitor',
  'relay',
  'breadboard',
  'transistor-npn',
  'voltage-reg-7805',
  'temp-sensor',
  'logic-and',
  'ne555',
  'rgb-led',
  '7seg-display',
  'dc-motor',
  'servo-sg90',
  'oled-i2c',
  'ultrasonic-sr04',
]);

/** True when a switch is closed: runtime toggle first, then the stored state. */
export function isSwitchClosed(comp: ComponentInstance, switchStates: Record<string, boolean> = {}): boolean {
  if (switchStates[comp.instanceId] !== undefined) return switchStates[comp.instanceId];
  if (typeof comp.parameters?.open === 'boolean') return !comp.parameters.open;
  return comp.state?.open === false;
}

// --------------------------------------------------------------------------------------
// Netlist construction
// --------------------------------------------------------------------------------------

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    let cur = x;
    while (this.parent.get(cur) !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

const pinKey = (compId: string, pinId: string) => `${compId}:${pinId}`;

/** Virtual plug connections for through-hole pins resting in breadboard holes (≤ 3 mm). */
export function computeBreadboardPlugs(doc: ProjectDocument): Connection[] {
  const plugs: Connection[] = [];
  const bbDef = COMPONENT_DEFINITION_MAP.get('breadboard');
  if (!bbDef) return plugs;
  const breadboards = doc.components.filter((c) => c.definitionId === 'breadboard');
  for (const bb of breadboards) {
    const holes = bbDef.pins.map((p) => ({ pin: p, world: calculatePinWorldPosition(bb, p.localOffset) }));
    for (const comp of doc.components) {
      if (comp.instanceId === bb.instanceId || comp.definitionId === 'breadboard') continue;
      const isOverBreadboard =
        Math.abs(comp.position.x - bb.position.x) <= 165 / 2 + 3 &&
        Math.abs(comp.position.z - bb.position.z) <= 55 / 2 + 3;
      if (comp.position.y < 3.5 && !isOverBreadboard) continue;
      const compDef = COMPONENT_DEFINITION_MAP.get(comp.definitionId);
      if (!compDef) continue;
      for (const pin of compDef.pins) {
        const pinWorld = calculatePinWorldPosition(comp, pin.localOffset);
        let nearest: string | null = null;
        let minDistSq = 9.0; // 3.0 mm snapping radius squared
        for (const hole of holes) {
          const dx = pinWorld.x - hole.world.x;
          const dz = pinWorld.z - hole.world.z;
          const d = dx * dx + dz * dz;
          if (d < minDistSq) {
            minDistSq = d;
            nearest = hole.pin.id;
          }
        }
        if (nearest) {
          plugs.push({
            id: `plug-${comp.instanceId}-${pin.id}-${bb.instanceId}-${nearest}`,
            fromComponentId: comp.instanceId,
            fromPinId: pin.id,
            toComponentId: bb.instanceId,
            toPinId: nearest,
          });
        }
      }
    }
  }
  return plugs;
}

/** Pins tied together inside a component (no resistance). */
const INTERNAL_BONDS: Record<string, Array<[string, string]>> = {
  'arduino-uno': [
    ['pin_gnd', 'pin_gnd2'],
    ['pin_gnd', 'pin_gnd_top'],
  ],
  pushbutton: [
    ['pin1', 'pin1b'],
    ['pin2', 'pin2b'],
  ],
  '7seg-display': [['com', 'com2']],
};

export interface Connectivity {
  nodeOf: (compId: string, pinId: string) => string;
  /** Pins that touch a wire or a breadboard hole. */
  isConnected: (compId: string, pinId: string) => boolean;
  connections: Connection[];
}

/**
 * Electrical nets of a canonical document: wires, breadboard buses (honouring split rails),
 * breadboard plugs and internal bonds. Shared by the simulator and the design rule checker.
 */
export function buildConnectivity(doc: ProjectDocument): Connectivity {
  const uf = new UnionFind();
  const compById = new Map(doc.components.map((c) => [c.instanceId, c]));
  const allConnections = [...doc.connections, ...computeBreadboardPlugs(doc)].filter(
    (c) => compById.has(c.fromComponentId) && compById.has(c.toComponentId)
  );
  const touched = new Set<string>();
  for (const conn of allConnections) {
    const a = pinKey(conn.fromComponentId, conn.fromPinId);
    const b = pinKey(conn.toComponentId, conn.toPinId);
    touched.add(a);
    touched.add(b);
    uf.union(a, b);
    for (const [compId, pinId] of [
      [conn.fromComponentId, conn.fromPinId],
      [conn.toComponentId, conn.toPinId],
    ] as const) {
      const comp = compById.get(compId);
      if (comp?.definitionId === 'breadboard') {
        const bus = getBreadboardBusId(pinId, { railSplit: Boolean(comp.parameters?.railSplit) });
        uf.union(pinKey(compId, pinId), pinKey(compId, `bus:${bus}`));
      }
    }
  }
  for (const comp of doc.components) {
    for (const [a, b] of INTERNAL_BONDS[comp.definitionId] || []) {
      uf.union(pinKey(comp.instanceId, a), pinKey(comp.instanceId, b));
    }
  }
  return {
    nodeOf: (compId, pinId) => uf.find(pinKey(compId, pinId)),
    isConnected: (compId, pinId) => touched.has(pinKey(compId, pinId)),
    connections: allConnections,
  };
}

// --------------------------------------------------------------------------------------
// Primitive elements and the MNA solver
// --------------------------------------------------------------------------------------

type RPrim = { kind: 'R'; a: string; b: string; r: number; tag?: string };
type VPrim = { kind: 'V'; p: string; n: string; v: number; tag?: string };
/** Independent current source: `i` amperes leave node `from` and enter node `to`. */
type IPrim = { kind: 'I'; from: string; to: string; i: number; tag?: string };
/** Current-controlled current source: gain·I(ctrl) leaves `from` and enters `to`. */
type FPrim = { kind: 'F'; from: string; to: string; ctrl: VPrim; gain: number; tag?: string };
type Prim = RPrim | VPrim | IPrim | FPrim;

class Stamper {
  prims: Prim[] = [];
  addR(a: string, b: string, r: number, tag?: string): RPrim {
    const pr: RPrim = { kind: 'R', a, b, r: Math.max(1e-6, r), tag };
    this.prims.push(pr);
    return pr;
  }
  /** Voltage source p(+)/n(−) of `v` volts, optionally behind a series resistance at the + side. */
  addV(p: string, n: string, v: number, rSeries: number | undefined, tag: string): VPrim {
    if (rSeries && rSeries > 0) {
      const internal = `${tag}#int`;
      this.addR(p, internal, rSeries, tag);
      const vs: VPrim = { kind: 'V', p: internal, n, v, tag };
      this.prims.push(vs);
      return vs;
    }
    const vs: VPrim = { kind: 'V', p, n, v, tag };
    this.prims.push(vs);
    return vs;
  }
  addI(from: string, to: string, i: number, tag?: string): IPrim {
    const pr: IPrim = { kind: 'I', from, to, i, tag };
    this.prims.push(pr);
    return pr;
  }
  addF(from: string, to: string, ctrl: VPrim, gain: number, tag?: string): FPrim {
    const pr: FPrim = { kind: 'F', from, to, ctrl, gain, tag };
    this.prims.push(pr);
    return pr;
  }
}

export function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-14) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = M.map((row, i) => row[n] / row[i]);
  return x.every(Number.isFinite) ? x : null;
}

interface Solution {
  voltages: Map<string, number>;
  island: Map<string, number>;
  current: Map<Prim, number>; // R: a→b; V: MNA branch current (entering + from the circuit)
  driven: Set<string>;
  singular: boolean;
}

function solvePrims(prims: Prim[]): Solution {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  const firstNode = (pr: Prim) => (pr.kind === 'R' ? pr.a : pr.kind === 'V' ? pr.p : pr.from);
  for (const pr of prims) {
    if (pr.kind === 'R') link(pr.a, pr.b);
    else if (pr.kind === 'V') link(pr.p, pr.n);
    else if (pr.kind === 'I') link(pr.from, pr.to);
    else {
      link(pr.from, pr.to);
      link(pr.to, pr.ctrl.n);
    }
  }

  const islandOf = new Map<string, number>();
  let islandCount = 0;
  for (const start of adj.keys()) {
    if (islandOf.has(start)) continue;
    const stack = [start];
    islandOf.set(start, islandCount);
    while (stack.length) {
      const cur = stack.pop()!;
      for (const nb of adj.get(cur) || []) {
        if (!islandOf.has(nb)) {
          islandOf.set(nb, islandCount);
          stack.push(nb);
        }
      }
    }
    islandCount += 1;
  }

  const out: Solution = { voltages: new Map(), island: islandOf, current: new Map(), driven: new Set(), singular: false };
  const byIsland: Prim[][] = Array.from({ length: islandCount }, () => []);
  for (const pr of prims) byIsland[islandOf.get(firstNode(pr))!].push(pr);

  for (let isl = 0; isl < islandCount; isl++) {
    const islandPrims = byIsland[isl];
    const vPrims = islandPrims.filter((pr): pr is VPrim => pr.kind === 'V');
    const hasExcitation = islandPrims.some((pr) => pr.kind === 'V' || (pr.kind === 'I' && pr.i !== 0));
    if (!hasExcitation) continue; // no source: no current, voltages undefined

    // Reference node: negative terminal of the first voltage source (or any node)
    const ref = vPrims.length ? vPrims[0].n : firstNode(islandPrims[0]);
    const nodes = Array.from(islandOf.entries())
      .filter(([node, i]) => i === isl && node !== ref)
      .map(([node]) => node);
    const idx = new Map(nodes.map((nd, i) => [nd, i]));
    const n = nodes.length;
    const vIndex = new Map(vPrims.map((pr, k) => [pr, n + k]));
    const size = n + vPrims.length;
    const A = Array.from({ length: size }, () => new Array(size).fill(0));
    const b = new Array(size).fill(0);

    for (const pr of islandPrims) {
      if (pr.kind === 'R') {
        const g = 1 / pr.r;
        const ia = idx.get(pr.a);
        const ib = idx.get(pr.b);
        if (ia !== undefined) A[ia][ia] += g;
        if (ib !== undefined) A[ib][ib] += g;
        if (ia !== undefined && ib !== undefined) {
          A[ia][ib] -= g;
          A[ib][ia] -= g;
        }
      } else if (pr.kind === 'I') {
        const i1 = idx.get(pr.from);
        const i2 = idx.get(pr.to);
        if (i1 !== undefined) b[i1] -= pr.i;
        if (i2 !== undefined) b[i2] += pr.i;
      } else if (pr.kind === 'F') {
        const k = vIndex.get(pr.ctrl);
        if (k === undefined) continue;
        const i1 = idx.get(pr.from);
        const i2 = idx.get(pr.to);
        if (i1 !== undefined) A[i1][k] += pr.gain;
        if (i2 !== undefined) A[i2][k] -= pr.gain;
      }
    }
    vPrims.forEach((pr) => {
      const row = vIndex.get(pr)!;
      const ip = idx.get(pr.p);
      const inn = idx.get(pr.n);
      if (ip !== undefined) {
        A[ip][row] += 1;
        A[row][ip] += 1;
      }
      if (inn !== undefined) {
        A[inn][row] -= 1;
        A[row][inn] -= 1;
      }
      b[row] = pr.v;
    });

    const x = solveLinearSystem(A, b);
    if (!x) {
      out.singular = true;
      continue;
    }
    out.voltages.set(ref, 0);
    nodes.forEach((nd, i) => out.voltages.set(nd, x[i]));
    for (const pr of islandPrims) {
      if (pr.kind === 'R') out.current.set(pr, ((out.voltages.get(pr.a) ?? 0) - (out.voltages.get(pr.b) ?? 0)) / pr.r);
      else if (pr.kind === 'V') out.current.set(pr, x[vIndex.get(pr)!]);
      else if (pr.kind === 'I') out.current.set(pr, pr.i);
      else {
        const k = vIndex.get(pr.ctrl);
        out.current.set(pr, k !== undefined ? pr.gain * x[k] : 0);
      }
    }
  }

  // Nodes held by a voltage source through a reasonably low impedance ("driven", not floating)
  const strong = new Map<string, string[]>();
  const strongLink = (a: string, b: string) => {
    if (!strong.has(a)) strong.set(a, []);
    if (!strong.has(b)) strong.set(b, []);
    strong.get(a)!.push(b);
    strong.get(b)!.push(a);
  };
  const seeds: string[] = [];
  for (const pr of prims) {
    if (pr.kind === 'R' && pr.r < SIM_CONSTANTS.WEAK_RESISTANCE) strongLink(pr.a, pr.b);
    if (pr.kind === 'V') {
      strongLink(pr.p, pr.n);
      seeds.push(pr.p, pr.n);
    }
  }
  const stack = seeds.filter((s) => out.voltages.has(s));
  for (const s of stack) out.driven.add(s);
  while (stack.length) {
    const cur = stack.pop()!;
    for (const nb of strong.get(cur) || []) {
      if (!out.driven.has(nb) && out.voltages.has(nb)) {
        out.driven.add(nb);
        stack.push(nb);
      }
    }
  }
  return out;
}

// --------------------------------------------------------------------------------------
// Devices
// --------------------------------------------------------------------------------------

interface StampCtx {
  /** Oscillator outputs forced to their LOW level in this phase. */
  lowSet: Set<string>;
  /** Signals published by controllers this iteration (node → servo pulse). */
  servoSignals: Map<string, { pulseUs: number; angleDeg: number; sourceId: string }>;
}

interface Oscillator {
  key: string;
  compId: string;
  frequencyHz: number;
  dutyHigh: number;
  label: string;
}

interface ReportCtx {
  sol: Solution;
  states: Record<string, ComponentSimulationState>;
  diag: (d: SimulationDiagnostic) => void;
  addSupply: (amps: number) => void;
  net: Netlist;
  ctx: StampCtx;
}

interface Device {
  compId: string;
  stamp(st: Stamper, ctx: StampCtx): void;
  /** Updates the device mode from a solution; returns true when the mode changed. */
  update?(sol: Solution, ctx: StampCtx): boolean;
  report(r: ReportCtx): void;
  oscillator?(): Oscillator | null;
}

interface SourceRecord {
  compId: string;
  part: string;
  v: number;
  maxCurrent: number;
  p: string;
  n: string;
  prim?: VPrim;
}

interface Netlist {
  doc: ProjectDocument;
  comps: Map<string, ComponentInstance>;
  conn: Connectivity;
  N: (compId: string, pin: string) => string;
  devices: Device[];
  sources: SourceRecord[];
  capacitors: Array<{ compId: string; a: string; b: string; farads: number }>;
  resistors: Array<{ compId: string; a: string; b: string; r: number }>;
  unsupported: string[];
}

function num(v: any, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function fmtCurrent(a: number): string {
  const abs = Math.abs(a);
  if (abs >= 1) return `${abs.toFixed(2)} A`;
  if (abs >= 1e-3) return `${(abs * 1000).toFixed(1)} mA`;
  if (abs >= 1e-6) return `${(abs * 1e6).toFixed(1)} µA`;
  return '0 mA';
}
const fmtVoltage = (v: number) => `${Math.abs(v).toFixed(2)} V`;
function fmtSeconds(s: number): string {
  if (s >= 1) return `${s.toFixed(2)} s`;
  if (s >= 1e-3) return `${(s * 1000).toFixed(1)} ms`;
  return `${(s * 1e6).toFixed(1)} µs`;
}
function fmtOhms(r: number): string {
  if (r >= 1e6) return `${(r / 1e6).toFixed(2)} MΩ`;
  if (r >= 1e3) return `${(r / 1e3).toFixed(2)} kΩ`;
  return `${r.toFixed(1)} Ω`;
}

/** V(a) − V(b) when both nodes were solved in the same island. */
function vdiff(sol: Solution, a: string, b: string): number | undefined {
  const va = sol.voltages.get(a);
  const vb = sol.voltages.get(b);
  if (va === undefined || vb === undefined) return undefined;
  if (sol.island.get(a) !== sol.island.get(b)) return undefined;
  return va - vb;
}

function setState(r: ReportCtx, id: string, st: Partial<ComponentSimulationState>) {
  const prev: ComponentSimulationState = r.states[id] || { isPowered: false, isOn: false, stateLabel: 'Chưa có điện' };
  r.states[id] = { ...prev, ...st };
}

// ---------- Two-terminal semiconductor junction (LED, diode, RGB / 7-segment chips) ----------
class Junction {
  on = false;
  prim: VPrim | RPrim | null = null;
  constructor(
    public tag: string,
    public anode: string,
    public cathode: string,
    public vf: number,
    public rs: number
  ) {}
  stamp(st: Stamper) {
    this.prim = this.on
      ? st.addV(this.anode, this.cathode, this.vf, this.rs, this.tag)
      : st.addR(this.anode, this.cathode, SIM_CONSTANTS.OFF_RESISTANCE, this.tag);
  }
  current(sol: Solution): number {
    if (!this.on || !this.prim) return 0;
    return sol.current.get(this.prim) ?? 0;
  }
  update(sol: Solution): boolean {
    if (this.on) {
      if (this.current(sol) <= 0) {
        this.on = false;
        return true;
      }
      return false;
    }
    const d = vdiff(sol, this.anode, this.cathode);
    if (d !== undefined && d > this.vf) {
      this.on = true;
      return true;
    }
    return false;
  }
}

function ledColorVf(p: Record<string, any>): number {
  const color = String(p.color || 'red').toLowerCase();
  const byColor = LED_VF_BY_COLOR[color] ?? 2.0;
  const stored = Number(p.forwardVoltage);
  // Projects saved before this audit carry the old default `forwardVoltage: 2.0` for every colour:
  // treat that as "not chosen" so blue / white LEDs get their real forward voltage.
  if (!Number.isFinite(stored) || stored <= 0 || (stored === 2 && byColor !== 2)) return byColor;
  return stored;
}

class LedDevice implements Device {
  j: Junction;
  constructor(public compId: string, private comp: ComponentInstance, net: Netlist, private isLed: boolean) {
    const p = comp.parameters || {};
    const vf = isLed ? ledColorVf(p) : num(p.forwardVoltage, SIM_CONSTANTS.DIODE_FORWARD_VOLTAGE);
    const rs = isLed ? SIM_CONSTANTS.LED_SERIES_RESISTANCE : SIM_CONSTANTS.DIODE_SERIES_RESISTANCE;
    this.j = new Junction(`${compId}:diode`, net.N(compId, 'anode'), net.N(compId, 'cathode'), vf, rs);
  }
  stamp(st: Stamper) {
    this.j.stamp(st);
  }
  update(sol: Solution) {
    return this.j.update(sol);
  }
  report(r: ReportCtx) {
    const { comp, isLed } = this;
    const i = this.j.current(r.sol);
    const drop = vdiff(r.sol, this.j.anode, this.j.cathode);
    const reverse = drop !== undefined && drop < -0.5;
    let stateLabel: string;
    let note: string | undefined;
    if (this.j.on) {
      stateLabel = isLed
        ? i >= SIM_CONSTANTS.LED_DIM_CURRENT
          ? 'SÁNG (Dẫn dòng phân cực thuận)'
          : i >= SIM_CONSTANTS.LED_VISIBLE_CURRENT
          ? 'SÁNG MỜ (dòng nhỏ)'
          : 'GẦN NHƯ KHÔNG SÁNG (dòng quá nhỏ)'
        : `DẪN THUẬN (Sụt áp ~${this.j.vf} V)`;
    } else if (reverse) {
      stateLabel = isLed ? 'KHÔNG SÁNG (Phân cực ngược)' : 'KHÓA (Diode phân cực ngược)';
      note = isLed ? 'Điện áp dương đặt vào chân Cathode bị LED chặn lại.' : 'Diode chặn dòng điện chạy từ Cathode sang Anode.';
    } else {
      stateLabel = isLed ? 'KHÔNG SÁNG (chưa đủ áp thuận)' : 'Không dẫn (chưa đủ áp thuận)';
    }
    const maxA = num(comp.parameters?.maxCurrent, isLed ? 20 : 1000) / 1000;
    if (i > maxA) {
      note = isLed ? 'Quá dòng định mức – LED có nguy cơ cháy.' : 'Quá dòng định mức của diode.';
      r.diag({
        ruleId: isLed ? 'LED_OVERCURRENT_RISK' : 'OVERCURRENT',
        severity: 'error',
        message: isLed
          ? `LED ${comp.name} dẫn ${fmtCurrent(i)}, vượt dòng định mức ${fmtCurrent(maxA)} – có nguy cơ cháy LED. Hãy thêm/tăng điện trở hạn dòng.`
          : `Diode ${comp.name} dẫn ${fmtCurrent(i)}, vượt dòng định mức ${fmtCurrent(maxA)}.`,
        objectRefs: [comp.instanceId],
        suggestion: isLed ? 'Mắc nối tiếp điện trở R ≥ (V nguồn − Vf) / 0,02 A với LED.' : 'Giảm dòng tải hoặc dùng diode chịu dòng lớn hơn.',
      });
    }
    if (isLed && reverse && drop! < -SIM_CONSTANTS.LED_MAX_REVERSE_VOLTAGE) {
      r.diag({
        ruleId: 'REVERSE_POLARITY',
        severity: 'warning',
        message: `LED ${comp.name} chịu điện áp ngược ${fmtVoltage(drop!)}, vượt mức tối đa 5 V của LED thông thường.`,
        objectRefs: [comp.instanceId],
        suggestion: 'Đảo lại chiều LED (Anode về phía cực dương).',
      });
    } else if (isLed && reverse) {
      r.diag({
        ruleId: 'REVERSE_POLARITY',
        severity: 'warning',
        message: `LED ${comp.name} đang bị phân cực ngược (Cathode ở điện thế cao hơn Anode) nên không sáng.`,
        objectRefs: [comp.instanceId],
        suggestion: 'Đảo lại chân: Anode (+, chân dài) về phía cực dương, Cathode (−) về phía GND.',
      });
    }
    const visible = isLed ? this.j.on && i >= SIM_CONSTANTS.LED_VISIBLE_CURRENT : this.j.on;
    setState(r, comp.instanceId, {
      isPowered: drop !== undefined && Math.abs(drop) > 0.01,
      isOn: visible,
      stateLabel,
      currentEstimate: fmtCurrent(i),
      voltageDrop: drop !== undefined ? fmtVoltage(drop) : undefined,
      currentA: i,
      voltageV: drop !== undefined ? Math.abs(drop) : undefined,
      powerW: drop !== undefined ? Math.abs(drop * i) : undefined,
      note,
      visual: isLed ? { brightness: visible ? clamp(i / 0.02, 0.08, 1.5) : 0 } : undefined,
    });
  }
}

/** RGB LED (3 chips, common cathode) and 7-segment display (8 chips, common cathode). */
class LedArrayDevice implements Device {
  chips: Array<{ key: string; j: Junction }> = [];
  constructor(public compId: string, private comp: ComponentInstance, net: Netlist, private kind: 'rgb' | '7seg') {
    const p = comp.parameters || {};
    if (kind === 'rgb') {
      const k = net.N(compId, 'cathode');
      // Typical common-cathode RGB 5 mm LED: red ≈ 2.0 V, green/blue (InGaN) ≈ 3.2 V at 20 mA
      for (const [key, vf] of [
        ['red', 2.0],
        ['green', 3.2],
        ['blue', 3.2],
      ] as const) {
        this.chips.push({ key, j: new Junction(`${compId}:${key}`, net.N(compId, key), k, vf, SIM_CONSTANTS.LED_SERIES_RESISTANCE) });
      }
    } else {
      const k = net.N(compId, 'com');
      const vf = LED_VF_BY_COLOR[String(p.color || 'red').toLowerCase()] ?? 2.0;
      for (const key of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp']) {
        const pin = key === 'dp' ? 'dp' : `seg_${key}`;
        this.chips.push({ key, j: new Junction(`${compId}:${key}`, net.N(compId, pin), k, vf, SIM_CONSTANTS.LED_SERIES_RESISTANCE) });
      }
    }
  }
  stamp(st: Stamper) {
    for (const c of this.chips) c.j.stamp(st);
  }
  update(sol: Solution) {
    let changed = false;
    for (const c of this.chips) changed = c.j.update(sol) || changed;
    return changed;
  }
  report(r: ReportCtx) {
    const maxA = num(this.comp.parameters?.maxCurrent, 20) / 1000;
    const levels: Record<string, number> = {};
    let total = 0;
    const lit: string[] = [];
    for (const c of this.chips) {
      const i = c.j.current(r.sol);
      total += i;
      const on = c.j.on && i >= SIM_CONSTANTS.LED_VISIBLE_CURRENT;
      levels[c.key] = on ? clamp(i / 0.02, 0.08, 1.5) : 0;
      if (on) lit.push(c.key.toUpperCase());
      if (i > maxA) {
        r.diag({
          ruleId: 'OVERCURRENT',
          severity: 'error',
          message: `${this.comp.name}: ${this.kind === 'rgb' ? 'chip màu ' + c.key : 'đoạn ' + c.key.toUpperCase()} dẫn ${fmtCurrent(i)}, vượt dòng định mức ${fmtCurrent(maxA)} – có nguy cơ cháy.`,
          objectRefs: [this.comp.instanceId],
          suggestion: 'Mỗi chân màu/đoạn cần một điện trở hạn dòng riêng.',
        });
      }
    }
    const names: Record<string, string> = { red: 'Đỏ', green: 'Lục', blue: 'Lam' };
    const label =
      lit.length === 0
        ? 'TẮT (không có dòng thuận qua chân nào)'
        : this.kind === 'rgb'
        ? `SÁNG: ${lit.map((k) => names[k.toLowerCase()] || k).join(' + ')}`
        : `SÁNG các đoạn: ${lit.join(', ')}`;
    setState(r, this.comp.instanceId, {
      isPowered: total > SIM_CONSTANTS.CONDUCTING_CURRENT,
      isOn: lit.length > 0,
      stateLabel: label,
      currentEstimate: fmtCurrent(total),
      currentA: total,
      visual: this.kind === 'rgb' ? { rgb: [levels.red, levels.green, levels.blue] } : { segments: levels },
    });
  }
}

class SourceDevice implements Device {
  constructor(public compId: string, private rec: SourceRecord, private rInt: number) {}
  stamp(st: Stamper) {
    this.rec.prim = st.addV(this.rec.p, this.rec.n, this.rec.v, this.rInt, `${this.compId}:${this.rec.part}`);
  }
  report() {
    // Sources are reported together in simulate() (Arduino exposes several rails)
  }
}

class ResistorDevice implements Device {
  prim: RPrim | null = null;
  constructor(public compId: string, private comp: ComponentInstance, private a: string, private b: string, private r: number) {}
  stamp(st: Stamper) {
    this.prim = st.addR(this.a, this.b, this.r, `${this.compId}:main`);
  }
  report(r: ReportCtx) {
    const i = this.prim ? r.sol.current.get(this.prim) : undefined;
    const drop = vdiff(r.sol, this.a, this.b);
    if (i === undefined || drop === undefined) return;
    const absI = Math.abs(i);
    const conducting = absI > SIM_CONSTANTS.CONDUCTING_CURRENT;
    const power = absI * absI * this.r;
    const def = this.comp.definitionId;
    let stateLabel = conducting ? `Dẫn dòng ${fmtCurrent(absI)}` : 'Không có dòng điện';
    let note: string | undefined;
    if (def === 'resistor') {
      stateLabel = conducting ? `Đang hạn dòng (${this.r} Ω)` : `Không có dòng (${this.r} Ω)`;
      const rating = num(this.comp.parameters?.powerRating, 0.25);
      if (power > rating) {
        note = 'Quá công suất định mức – điện trở có thể quá nhiệt.';
        r.diag({
          ruleId: 'OVERPOWER',
          severity: 'error',
          message: `Điện trở ${this.comp.name} tiêu tán ${power.toFixed(2)} W, vượt công suất định mức ${rating} W.`,
          objectRefs: [this.comp.instanceId],
          suggestion: 'Tăng trị số điện trở hoặc dùng điện trở công suất lớn hơn.',
        });
      }
    } else if (def === 'ldr') {
      stateLabel = `${conducting ? 'Dẫn dòng' : 'Không có dòng'} – điện trở hiện tại ${fmtOhms(this.r)}`;
      note = 'Mô hình gần đúng: R thay đổi theo hàm mũ giữa điện trở tối và điện trở sáng; thang % ánh sáng không quy đổi ra lux.';
    } else if (def === 'switch' || def === 'pushbutton') {
      stateLabel = conducting ? 'ĐÓNG (Tiếp điểm dẫn dòng)' : 'ĐÓNG (Chưa có dòng qua)';
    }
    setState(r, this.compId, {
      isPowered: conducting || Math.abs(drop) > 0.01,
      isOn: conducting,
      stateLabel,
      currentEstimate: fmtCurrent(absI),
      voltageDrop: fmtVoltage(drop),
      currentA: absI,
      voltageV: Math.abs(drop),
      powerW: power,
      note,
    });
  }
}

class PotentiometerDevice implements Device {
  p1: RPrim | null = null;
  p2: RPrim | null = null;
  constructor(public compId: string, private comp: ComponentInstance, private net: Netlist, private total: number, private pos: number) {}
  stamp(st: Stamper) {
    const N = (pin: string) => this.net.N(this.compId, pin);
    this.p1 = st.addR(N('pin1'), N('wiper'), Math.max(1e-3, this.total * this.pos), `${this.compId}:pin1-wiper`);
    this.p2 = st.addR(N('wiper'), N('pin2'), Math.max(1e-3, this.total * (1 - this.pos)), `${this.compId}:wiper-pin2`);
  }
  report(r: ReportCtx) {
    const N = (pin: string) => this.net.N(this.compId, pin);
    const i1 = this.p1 ? r.sol.current.get(this.p1) : undefined;
    const i2 = this.p2 ? r.sol.current.get(this.p2) : undefined;
    const ends = vdiff(r.sol, N('pin1'), N('pin2'));
    if (i1 === undefined || i2 === undefined) return;
    const i = Math.max(Math.abs(i1), Math.abs(i2));
    const vw = vdiff(r.sol, N('wiper'), N('pin2'));
    setState(r, this.compId, {
      isPowered: i > SIM_CONSTANTS.CONDUCTING_CURRENT || Math.abs(ends ?? 0) > 0.01,
      isOn: i > SIM_CONSTANTS.CONDUCTING_CURRENT,
      stateLabel: `Con chạy ở ${(this.pos * 100).toFixed(0)}% (Đầu 1 ↔ con chạy: ${fmtOhms(this.total * this.pos)})`,
      currentEstimate: fmtCurrent(i),
      voltageDrop: ends !== undefined ? fmtVoltage(ends) : undefined,
      currentA: i,
      voltageV: ends !== undefined ? Math.abs(ends) : undefined,
      note: vw !== undefined ? `Điện áp con chạy so với Đầu 2: ${vw.toFixed(2)} V.` : undefined,
    });
  }
}

class CapacitorDevice implements Device {
  prim: RPrim | null = null;
  constructor(public compId: string, private comp: ComponentInstance, private a: string, private b: string) {}
  stamp(st: Stamper) {
    this.prim = st.addR(this.a, this.b, SIM_CONSTANTS.OFF_RESISTANCE, `${this.compId}:leakage`);
  }
  report(r: ReportCtx) {
    const drop = vdiff(r.sol, this.a, this.b);
    if (drop === undefined) return;
    const rating = num(this.comp.parameters?.voltageRating, 25);
    if (Math.abs(drop) > rating) {
      r.diag({
        ruleId: 'OVERVOLTAGE',
        severity: 'error',
        message: `Tụ ${this.comp.name} chịu ${fmtVoltage(drop)}, vượt điện áp định mức ${rating} V – tụ có thể phồng/nổ.`,
        objectRefs: [this.compId],
        suggestion: 'Chọn tụ có điện áp định mức cao hơn điện áp mạch ít nhất 20–50 %.',
      });
    }
    if (drop < -1) {
      r.diag({
        ruleId: 'REVERSE_POLARITY',
        severity: 'error',
        message: `Tụ hóa ${this.comp.name} bị mắc ngược cực (chân − cao hơn chân + ${fmtVoltage(drop)}).`,
        objectRefs: [this.compId],
        suggestion: 'Đảo lại tụ: chân + (chân dài) về phía điện thế cao hơn.',
      });
    }
    setState(r, this.compId, {
      isPowered: Math.abs(drop) > 0.01,
      isOn: false,
      stateLabel: `Đã nạp ${fmtVoltage(drop)} (DC xác lập: hở mạch)`,
      currentEstimate: '0 mA',
      voltageDrop: fmtVoltage(drop),
      currentA: 0,
      voltageV: Math.abs(drop),
      note: 'Ở trạng thái DC xác lập tụ điện không cho dòng một chiều đi qua.',
    });
  }
}

class SwitchDevice implements Device {
  inner: ResistorDevice | null;
  constructor(public compId: string, comp: ComponentInstance, a: string, b: string, closed: boolean) {
    this.inner = closed ? new ResistorDevice(compId, comp, a, b, SIM_CONSTANTS.CONTACT_RESISTANCE) : null;
  }
  stamp(st: Stamper) {
    this.inner?.stamp(st);
  }
  report(r: ReportCtx) {
    if (this.inner) this.inner.report(r);
    else setState(r, this.compId, { stateLabel: 'MỞ (ngắt mạch)', currentA: 0, currentEstimate: '0 mA' });
  }
}

class BuzzerDevice implements Device {
  forward = true;
  prim: RPrim | null = null;
  constructor(public compId: string, private comp: ComponentInstance, private a: string, private b: string) {}
  stamp(st: Stamper) {
    // Active buzzer: internal oscillator + transistor, conducts only with correct polarity
    this.prim = st.addR(this.a, this.b, this.forward ? SIM_CONSTANTS.BUZZER_EQUIVALENT_RESISTANCE : SIM_CONSTANTS.OFF_RESISTANCE, `${this.compId}:main`);
  }
  update(sol: Solution) {
    const d = vdiff(sol, this.a, this.b);
    const fwd = d === undefined || d >= 0;
    if (fwd !== this.forward) {
      this.forward = fwd;
      return true;
    }
    return false;
  }
  report(r: ReportCtx) {
    const d = vdiff(r.sol, this.a, this.b);
    const i = this.prim ? Math.abs(r.sol.current.get(this.prim) ?? 0) : 0;
    if (d === undefined) return;
    const p = this.comp.parameters || {};
    const vmin = num(p.minVoltage, SIM_CONSTANTS.BUZZER_MIN_VOLTAGE);
    const vmax = num(p.maxVoltage, SIM_CONSTANTS.BUZZER_MAX_VOLTAGE);
    const on = d >= vmin;
    if (d > vmax) {
      r.diag({
        ruleId: 'OVERVOLTAGE',
        severity: 'warning',
        message: `Còi ${this.comp.name} nhận ${fmtVoltage(d)}, cao hơn dải hoạt động ${vmin}–${vmax} V.`,
        objectRefs: [this.compId],
        suggestion: 'Thêm điện trở hoặc dùng nguồn 5 V cho còi chủ động 5 V.',
      });
    }
    setState(r, this.compId, {
      isPowered: Math.abs(d) > 0.01,
      isOn: on,
      stateLabel: on ? 'ĐANG KÊU (đủ áp phân cực thuận)' : d < 0 ? 'KHÔNG KÊU (phân cực ngược)' : `KHÔNG KÊU (chưa đủ ${vmin} V)`,
      currentEstimate: fmtCurrent(i),
      voltageDrop: fmtVoltage(d),
      currentA: i,
      voltageV: Math.abs(d),
      note: 'Mô hình gần đúng: còi chủ động được coi là tải ~170 Ω khi đúng cực, hở mạch khi ngược cực.',
      visual: { sounding: on },
    });
  }
}

class RelayDevice implements Device {
  energized = false;
  coil: RPrim | null = null;
  constructor(public compId: string, private comp: ComponentInstance, private net: Netlist) {}
  private N(pin: string) {
    return this.net.N(this.compId, pin);
  }
  stamp(st: Stamper) {
    const p = this.comp.parameters || {};
    this.coil = st.addR(this.N('coil_pos'), this.N('coil_neg'), num(p.coilResistance, SIM_CONSTANTS.RELAY_COIL_RESISTANCE), `${this.compId}:coil`);
    st.addR(this.N('com'), this.energized ? this.N('no') : this.N('nc'), SIM_CONSTANTS.CONTACT_RESISTANCE, `${this.compId}:contact`);
  }
  update(sol: Solution) {
    const p = this.comp.parameters || {};
    const v = Math.abs(vdiff(sol, this.N('coil_pos'), this.N('coil_neg')) ?? 0);
    const pickup = num(p.pickupVoltage, SIM_CONSTANTS.RELAY_PICKUP_VOLTAGE);
    const release = num(p.releaseVoltage, SIM_CONSTANTS.RELAY_RELEASE_VOLTAGE);
    const next = this.energized ? v > release : v >= pickup;
    if (next !== this.energized) {
      this.energized = next;
      return true;
    }
    return false;
  }
  report(r: ReportCtx) {
    const v = vdiff(r.sol, this.N('coil_pos'), this.N('coil_neg'));
    const i = this.coil ? Math.abs(r.sol.current.get(this.coil) ?? 0) : 0;
    if (this.energized) {
      const hasDiode = this.net.devices.some(
        (d) =>
          d instanceof LedDevice &&
          !(d as any).isLed &&
          [this.N('coil_pos'), this.N('coil_neg')].includes(d.j.anode) &&
          [this.N('coil_pos'), this.N('coil_neg')].includes(d.j.cathode)
      );
      if (!hasDiode) {
        r.diag({
          ruleId: 'RELAY_FLYBACK',
          severity: 'info',
          message: `Rơ-le ${this.comp.name} chưa có diode dập song song cuộn hút.`,
          objectRefs: [this.compId],
          suggestion: 'Mắc diode 1N4007 song song ngược với cuộn hút (Cathode về phía cực +) để bảo vệ transistor/vi điều khiển khi ngắt.',
        });
      }
    }
    setState(r, this.compId, {
      isPowered: (v ?? 0) !== 0,
      isOn: this.energized,
      stateLabel: this.energized ? 'KÍCH HOẠT (Tiếp điểm COM–NO đóng, NC mở)' : 'Chưa kích hoạt (COM–NC đóng)',
      currentEstimate: fmtCurrent(i),
      voltageDrop: v !== undefined ? fmtVoltage(v) : undefined,
      currentA: i,
      voltageV: v !== undefined ? Math.abs(v) : undefined,
      note: `Cuộn hút cần ≥ ${num(this.comp.parameters?.pickupVoltage, SIM_CONSTANTS.RELAY_PICKUP_VOLTAGE)} V để hút; thời gian đóng/ngắt cơ khí không được mô phỏng.`,
      visual: { contact: this.energized ? 'no' : 'nc' },
    });
  }
}

class TransistorDevice implements Device {
  mode: 'cutoff' | 'active' | 'saturation' = 'cutoff';
  be: VPrim | null = null;
  ce: VPrim | null = null;
  f: FPrim | null = null;
  beta: number;
  constructor(public compId: string, private comp: ComponentInstance, private net: Netlist) {
    const p = comp.parameters || {};
    this.beta = clamp(num(p.gainBeta ?? p.hfe, 100), 1, 1000);
  }
  private N(pin: string) {
    return this.net.N(this.compId, pin);
  }
  stamp(st: Stamper) {
    const [c, b, e] = [this.N('collector'), this.N('base'), this.N('emitter')];
    st.addR(b, e, SIM_CONSTANTS.OFF_RESISTANCE, `${this.compId}:leak-be`);
    st.addR(c, e, SIM_CONSTANTS.OFF_RESISTANCE, `${this.compId}:leak-ce`);
    this.be = this.ce = this.f = null;
    if (this.mode === 'cutoff') return;
    this.be = st.addV(b, e, SIM_CONSTANTS.BJT_VBE, SIM_CONSTANTS.BJT_BASE_RESISTANCE, `${this.compId}:be`);
    if (this.mode === 'active') this.f = st.addF(c, e, this.be, this.beta, `${this.compId}:ic`);
    else this.ce = st.addV(c, e, SIM_CONSTANTS.BJT_VCE_SAT, 0.5, `${this.compId}:ce`);
  }
  private ib(sol: Solution) {
    return this.be ? sol.current.get(this.be) ?? 0 : 0;
  }
  private ic(sol: Solution) {
    if (this.f) return sol.current.get(this.f) ?? 0;
    if (this.ce) return sol.current.get(this.ce) ?? 0;
    return 0;
  }
  update(sol: Solution) {
    const prev = this.mode;
    const ib = this.ib(sol);
    if (this.mode === 'cutoff') {
      const vbe = vdiff(sol, this.N('base'), this.N('emitter'));
      if (vbe !== undefined && vbe > SIM_CONSTANTS.BJT_VBE) this.mode = 'active';
    } else if (ib <= 0) {
      this.mode = 'cutoff';
    } else if (this.mode === 'active') {
      const vce = vdiff(sol, this.N('collector'), this.N('emitter'));
      if (vce !== undefined && vce < SIM_CONSTANTS.BJT_VCE_SAT) this.mode = 'saturation';
    } else if (this.ic(sol) > this.beta * ib) {
      this.mode = 'active';
    }
    return prev !== this.mode;
  }
  report(r: ReportCtx) {
    const ib = this.ib(r.sol);
    const ic = Math.max(0, this.ic(r.sol));
    const vce = vdiff(r.sol, this.N('collector'), this.N('emitter'));
    const vbe = vdiff(r.sol, this.N('base'), this.N('emitter'));
    if (vce === undefined && vbe === undefined) return;
    const power = (vce ?? 0) * ic + (vbe ?? 0) * Math.max(0, ib);
    const labels = {
      cutoff: 'TẮT (cutoff: VBE < 0,7 V, không có dòng IC)',
      active: `KHUẾCH ĐẠI (active: IC = β·IB = ${fmtCurrent(ic)})`,
      saturation: `BÃO HÒA (dẫn như công tắc đóng, VCE ≈ ${SIM_CONSTANTS.BJT_VCE_SAT} V)`,
    };
    if (ic > SIM_CONSTANTS.BJT_MAX_IC) {
      r.diag({ ruleId: 'OVERCURRENT', severity: 'error', message: `Transistor ${this.comp.name}: IC = ${fmtCurrent(ic)} vượt giới hạn 600 mA của 2N2222A.`, objectRefs: [this.compId], suggestion: 'Giảm tải ở cực C hoặc dùng transistor/MOSFET công suất lớn hơn.' });
    }
    if (power > SIM_CONSTANTS.BJT_MAX_POWER) {
      r.diag({ ruleId: 'OVERPOWER', severity: 'error', message: `Transistor ${this.comp.name} tiêu tán ${power.toFixed(2)} W, vượt 0,625 W của vỏ TO-92.`, objectRefs: [this.compId], suggestion: 'Cho transistor làm việc ở chế độ bão hòa (tăng dòng base) hoặc giảm dòng tải.' });
    }
    if (vce !== undefined && vce > SIM_CONSTANTS.BJT_VCEO) {
      r.diag({ ruleId: 'OVERVOLTAGE', severity: 'error', message: `Transistor ${this.comp.name}: VCE = ${fmtVoltage(vce)} vượt VCEO 40 V.`, objectRefs: [this.compId] });
    }
    setState(r, this.compId, {
      isPowered: Math.abs(vce ?? 0) > 0.01 || Math.abs(vbe ?? 0) > 0.01,
      isOn: this.mode !== 'cutoff' && ic > SIM_CONSTANTS.CONDUCTING_CURRENT,
      stateLabel: labels[this.mode],
      mode: this.mode,
      currentEstimate: fmtCurrent(ic),
      voltageDrop: vce !== undefined ? fmtVoltage(vce) : undefined,
      currentA: ic,
      voltageV: vce !== undefined ? Math.abs(vce) : undefined,
      powerW: power,
      note: `IB = ${fmtCurrent(Math.max(0, ib))}, β = ${this.beta}. Mô hình tuyến tính từng đoạn (VBE = 0,7 V, VCE(sat) = 0,2 V), không mô phỏng chế độ đảo ngược.`,
    });
  }
}

class RegulatorDevice implements Device {
  mode: 'off' | 'dropout' | 'regulating' | 'limit' = 'off';
  out: VPrim | null = null;
  limit: IPrim | null = null;
  vnom: number;
  constructor(public compId: string, private comp: ComponentInstance, private net: Netlist) {
    this.vnom = num(comp.parameters?.outputVoltage, 5);
  }
  private N(pin: string) {
    return this.net.N(this.compId, pin);
  }
  stamp(st: Stamper) {
    const [vin, gnd, vout] = [this.N('vin'), this.N('gnd'), this.N('vout')];
    st.addR(vin, gnd, SIM_CONSTANTS.OFF_RESISTANCE, `${this.compId}:leak-in`);
    st.addR(vout, gnd, SIM_CONSTANTS.OFF_RESISTANCE, `${this.compId}:leak-out`);
    this.out = this.limit = null;
    if (this.mode === 'off') return;
    st.addI(vin, gnd, SIM_CONSTANTS.REG_QUIESCENT, `${this.compId}:iq`);
    if (this.mode === 'regulating') {
      this.out = st.addV(vout, gnd, this.vnom, 0.01, `${this.compId}:out`);
      // The load current delivered at OUT is drawn from IN (series pass transistor)
      st.addF(vin, gnd, this.out, -1, `${this.compId}:pass`);
    } else if (this.mode === 'dropout') {
      this.out = st.addV(vin, vout, SIM_CONSTANTS.REG_DROPOUT, 0.01, `${this.compId}:drop`);
    } else {
      this.limit = st.addI(vin, vout, SIM_CONSTANTS.REG_LIMIT_CURRENT, `${this.compId}:limit`);
    }
  }
  iout(sol: Solution): number {
    if (this.mode === 'regulating' && this.out) return -(sol.current.get(this.out) ?? 0);
    if (this.mode === 'dropout' && this.out) return sol.current.get(this.out) ?? 0;
    if (this.mode === 'limit') return SIM_CONSTANTS.REG_LIMIT_CURRENT;
    return 0;
  }
  update(sol: Solution) {
    const prev = this.mode;
    const vin = vdiff(sol, this.N('vin'), this.N('gnd'));
    const vout = vdiff(sol, this.N('vout'), this.N('gnd'));
    if (vin === undefined || vin <= SIM_CONSTANTS.REG_DROPOUT || vin > SIM_CONSTANTS.REG_MAX_INPUT) {
      this.mode = 'off';
    } else if (this.mode === 'off') {
      this.mode = 'dropout';
    } else if (this.mode === 'dropout') {
      if (vout !== undefined && vout > this.vnom) this.mode = 'regulating';
      else if (this.iout(sol) > SIM_CONSTANTS.REG_LIMIT_CURRENT) this.mode = 'limit';
    } else if (this.mode === 'regulating') {
      if (vout !== undefined && vin - vout < SIM_CONSTANTS.REG_DROPOUT - 1e-9) this.mode = 'dropout';
      else if (this.iout(sol) > SIM_CONSTANTS.REG_LIMIT_CURRENT) this.mode = 'limit';
    } else if (vout !== undefined && (vout > this.vnom || vin - vout < SIM_CONSTANTS.REG_DROPOUT)) {
      this.mode = vout > this.vnom ? 'regulating' : 'dropout';
    }
    return prev !== this.mode;
  }
  report(r: ReportCtx) {
    const vin = vdiff(r.sol, this.N('vin'), this.N('gnd'));
    const vout = vdiff(r.sol, this.N('vout'), this.N('gnd'));
    const iout = Math.max(0, this.iout(r.sol));
    const part = this.vnom === 12 ? 'LM7812' : 'LM7805';
    if (vin !== undefined && vin > SIM_CONSTANTS.REG_MAX_INPUT) {
      r.diag({ ruleId: 'OVERVOLTAGE', severity: 'error', message: `${part} ${this.comp.name}: VIN = ${fmtVoltage(vin)} vượt mức tối đa 35 V.`, objectRefs: [this.compId] });
    }
    if (vin !== undefined && vin < -0.5) {
      r.diag({ ruleId: 'REVERSE_POLARITY', severity: 'error', message: `${part} ${this.comp.name} bị cấp ngược cực (IN thấp hơn GND).`, objectRefs: [this.compId], suggestion: 'Kiểm tra chân: IN – GND – OUT (nhìn mặt chữ, từ trái sang phải).' });
    }
    if (this.mode === 'dropout' && iout > 0) {
      r.diag({ ruleId: 'REGULATOR_DROPOUT', severity: 'warning', message: `${part} ${this.comp.name} không đủ áp để ổn định: VIN = ${fmtVoltage(vin ?? 0)} cần ≥ ${(this.vnom + SIM_CONSTANTS.REG_DROPOUT).toFixed(1)} V, ngõ ra chỉ còn ${fmtVoltage(vout ?? 0)}.`, objectRefs: [this.compId], suggestion: `Dùng nguồn vào từ ${(this.vnom + SIM_CONSTANTS.REG_DROPOUT).toFixed(0)} V trở lên.` });
    }
    if (iout > SIM_CONSTANTS.REG_RATED_CURRENT) {
      r.diag({ ruleId: 'OVERCURRENT', severity: 'error', message: `${part} ${this.comp.name} phải cấp ${fmtCurrent(iout)}, vượt dòng định mức 1,5 A${this.mode === 'limit' ? ' (IC đang tự giới hạn dòng)' : ''}.`, objectRefs: [this.compId] });
    }
    const pd = vin !== undefined && vout !== undefined ? (vin - vout) * iout + vin * (this.mode === 'off' ? 0 : SIM_CONSTANTS.REG_QUIESCENT) : 0;
    if (pd > 1) {
      r.diag({ ruleId: 'THERMAL', severity: 'info', message: `${part} ${this.comp.name} tiêu tán ≈ ${pd.toFixed(2)} W: nên gắn tản nhiệt (vỏ TO-220 để trần chỉ tản được khoảng 1–2 W).`, objectRefs: [this.compId], suggestion: 'Giảm điện áp vào hoặc gắn tản nhiệt nhôm lên tab.' });
    }
    const labels = {
      off: 'TẮT (chưa đủ điện áp vào)',
      dropout: `SỤT ÁP (dropout): ngõ ra ≈ VIN − 2 V`,
      regulating: `ỔN ÁP ${this.vnom.toFixed(1)} V`,
      limit: 'GIỚI HẠN DÒNG (quá tải/chập ngõ ra)',
    };
    setState(r, this.compId, {
      isPowered: (vin ?? 0) > 0.01,
      isOn: this.mode !== 'off',
      stateLabel: labels[this.mode],
      mode: this.mode,
      currentEstimate: fmtCurrent(iout),
      voltageDrop: vout !== undefined ? fmtVoltage(vout) : undefined,
      currentA: iout,
      voltageV: vout !== undefined ? vout : undefined,
      powerW: pd,
      note: `VIN = ${vin !== undefined ? fmtVoltage(vin) : '—'}, IQ ≈ 5 mA. Mô hình tuyến tính từng đoạn: dropout 2 V, giới hạn dòng 2,2 A; không mô phỏng nhiệt độ mối nối và gợn sóng.`,
    });
  }
}

class Lm35Device implements Device {
  on = false;
  out: VPrim | null = null;
  constructor(public compId: string, private comp: ComponentInstance, private net: Netlist) {}
  private N(pin: string) {
    return this.net.N(this.compId, pin);
  }
  private tempC() {
    const p = this.comp.parameters || {};
    return num(p.temperatureC ?? p.temperature, 25);
  }
  stamp(st: Stamper) {
    const [vcc, vout, gnd] = [this.N('vcc'), this.N('vout'), this.N('gnd')];
    st.addR(vout, gnd, SIM_CONSTANTS.OFF_RESISTANCE, `${this.compId}:leak`);
    this.out = null;
    if (!this.on) return;
    st.addI(vcc, gnd, SIM_CONSTANTS.LM35_QUIESCENT, `${this.compId}:iq`);
    // Basic centigrade circuit: output follows 10 mV/°C from +2 °C; it cannot go below ~0.02 V
    const v = Math.max(2, this.tempC()) * SIM_CONSTANTS.LM35_GAIN;
    this.out = st.addV(vout, gnd, v, 0.1, `${this.compId}:out`);
    st.addF(vcc, gnd, this.out, -1, `${this.compId}:supply`);
  }
  update(sol: Solution) {
    const vs = vdiff(sol, this.N('vcc'), this.N('gnd'));
    const next = vs !== undefined && vs >= SIM_CONSTANTS.LM35_MIN_SUPPLY && vs <= 35;
    if (next !== this.on) {
      this.on = next;
      return true;
    }
    return false;
  }
  report(r: ReportCtx) {
    const vs = vdiff(r.sol, this.N('vcc'), this.N('gnd'));
    const vo = vdiff(r.sol, this.N('vout'), this.N('gnd'));
    const iout = this.out ? -(r.sol.current.get(this.out) ?? 0) : 0;
    const t = this.tempC();
    if (vs !== undefined && vs > SIM_CONSTANTS.LM35_MAX_SUPPLY) {
      r.diag({ ruleId: 'OVERVOLTAGE', severity: vs > 35 ? 'error' : 'warning', message: `LM35 ${this.comp.name}: nguồn ${fmtVoltage(vs)} ngoài dải 4–30 V.`, objectRefs: [this.compId] });
    }
    if (iout > SIM_CONSTANTS.LM35_MAX_OUTPUT_CURRENT) {
      r.diag({ ruleId: 'OVERCURRENT', severity: 'warning', message: `LM35 ${this.comp.name}: tải ở VOUT kéo ${fmtCurrent(iout)}, vượt khả năng cấp dòng ~10 mA nên điện áp đo sẽ sai.`, objectRefs: [this.compId], suggestion: 'Nối VOUT vào ngõ vào trở kháng cao (chân analog), không nối tải trực tiếp.' });
    }
    setState(r, this.compId, {
      isPowered: this.on,
      isOn: this.on,
      stateLabel: this.on ? `Đo ${t.toFixed(1)} °C → VOUT ≈ ${fmtVoltage(vo ?? 0)}` : `TẮT (cần nguồn +VS 4–30 V${vs !== undefined ? `, hiện ${fmtVoltage(vs)}` : ''})`,
      currentEstimate: fmtCurrent(iout),
      voltageDrop: vo !== undefined ? fmtVoltage(vo) : undefined,
      currentA: iout,
      voltageV: vo,
      note: t < 2 ? 'Mạch cơ bản của LM35 chỉ đo từ +2 °C; dưới mức này VOUT giữ ≈ 20 mV.' : 'VOUT = 10 mV × nhiệt độ (°C), sai số danh định ±0,5 °C ở 25 °C không được mô phỏng.',
    });
  }
}

type Logic = 'high' | 'low' | 'undef';

function readLogic(sol: Solution, node: string, gnd: string, vcc: number, vil: number, vih: number): Logic {
  if (!sol.driven.has(node)) return 'undef';
  const v = vdiff(sol, node, gnd);
  if (v === undefined) return 'undef';
  if (v >= vih) return 'high';
  if (v <= vil) return 'low';
  return 'undef';
}

class LogicAndDevice implements Device {
  static GATES = [
    { a: 'in_a', b: 'in_b', y: 'out_y', name: '1' },
    { a: 'in_2a', b: 'in_2b', y: 'out_2y', name: '2' },
    { a: 'in_3a', b: 'in_3b', y: 'out_3y', name: '3' },
    { a: 'in_4a', b: 'in_4b', y: 'out_4y', name: '4' },
  ];
  out: Logic[] = ['undef', 'undef', 'undef', 'undef'];
  prims: Array<RPrim | null> = [null, null, null, null];
  powered = false;
  constructor(public compId: string, private comp: ComponentInstance, private net: Netlist) {}
  private N(pin: string) {
    return this.net.N(this.compId, pin);
  }
  stamp(st: Stamper) {
    LogicAndDevice.GATES.forEach((g, k) => {
      this.prims[k] = null;
      if (this.out[k] === 'high') this.prims[k] = st.addR(this.N('vcc'), this.N(g.y), SIM_CONSTANTS.HC_OUTPUT_RESISTANCE, `${this.compId}:${g.y}`);
      if (this.out[k] === 'low') this.prims[k] = st.addR(this.N(g.y), this.N('gnd'), SIM_CONSTANTS.HC_OUTPUT_RESISTANCE, `${this.compId}:${g.y}`);
    });
  }
  update(sol: Solution) {
    const vcc = vdiff(sol, this.N('vcc'), this.N('gnd'));
    this.powered = vcc !== undefined && vcc >= SIM_CONSTANTS.HC_MIN_VCC && vcc <= SIM_CONSTANTS.HC_ABS_MAX_VCC;
    let changed = false;
    LogicAndDevice.GATES.forEach((g, k) => {
      let next: Logic = 'undef';
      if (this.powered) {
        const a = readLogic(sol, this.N(g.a), this.N('gnd'), vcc!, 0.3 * vcc!, 0.7 * vcc!);
        const b = readLogic(sol, this.N(g.b), this.N('gnd'), vcc!, 0.3 * vcc!, 0.7 * vcc!);
        if (a === 'low' || b === 'low') next = 'low';
        else if (a === 'high' && b === 'high') next = 'high';
      }
      if (next !== this.out[k]) {
        this.out[k] = next;
        changed = true;
      }
    });
    return changed;
  }
  report(r: ReportCtx) {
    const vcc = vdiff(r.sol, this.N('vcc'), this.N('gnd'));
    if (vcc !== undefined && vcc > SIM_CONSTANTS.HC_ABS_MAX_VCC) {
      r.diag({ ruleId: 'OVERVOLTAGE', severity: 'error', message: `74HC08 ${this.comp.name}: VCC = ${fmtVoltage(vcc)} vượt giới hạn tuyệt đối 7 V (dải làm việc 2–6 V).`, objectRefs: [this.compId], suggestion: 'Cấp 5 V cho IC họ 74HC.' });
    } else if (vcc !== undefined && vcc > SIM_CONSTANTS.HC_MAX_VCC) {
      r.diag({ ruleId: 'OVERVOLTAGE', severity: 'warning', message: `74HC08 ${this.comp.name}: VCC = ${fmtVoltage(vcc)} ngoài dải làm việc 2–6 V.`, objectRefs: [this.compId] });
    }
    const floating: string[] = [];
    const parts: string[] = [];
    let total = 0;
    LogicAndDevice.GATES.forEach((g, k) => {
      const used = [g.a, g.b, g.y].some((pin) => this.net.conn.isConnected(this.compId, pin));
      for (const pin of [g.a, g.b]) if (!r.sol.driven.has(this.N(pin))) floating.push(pin);
      const pr = this.prims[k];
      const i = pr ? Math.abs(r.sol.current.get(pr) ?? 0) : 0;
      total += i;
      if (i > SIM_CONSTANTS.HC_MAX_OUTPUT_CURRENT) {
        r.diag({ ruleId: 'OVERCURRENT', severity: 'error', message: `74HC08 ${this.comp.name}: ngõ ra ${g.name}Y cấp ${fmtCurrent(i)}, vượt giới hạn 25 mA.`, objectRefs: [this.compId], suggestion: 'Thêm điện trở hạn dòng hoặc dùng transistor để đóng tải.' });
      }
      if (used) parts.push(`${g.name}Y=${this.out[k] === 'high' ? '1' : this.out[k] === 'low' ? '0' : '?'}`);
    });
    if (this.powered && floating.length > 0) {
      r.diag({
        ruleId: 'FLOATING_INPUT',
        severity: 'warning',
        message: `74HC08 ${this.comp.name} có ngõ vào thả nổi (${floating.join(', ')}): mức logic không xác định.`,
        objectRefs: [this.compId],
        suggestion: 'Nối mọi ngõ vào CMOS (kể cả cổng không dùng) lên VCC hoặc xuống GND, hoặc qua điện trở kéo 10 kΩ.',
      });
    }
    setState(r, this.compId, {
      isPowered: this.powered,
      isOn: this.out.some((o) => o === 'high'),
      stateLabel: this.powered ? `Đang hoạt động: ${parts.join(', ') || 'chưa dùng cổng nào'}` : `TẮT (cần VCC 2–6 V giữa chân 14 và 7)`,
      currentEstimate: fmtCurrent(total),
      currentA: total,
      note: 'Logic lý tưởng: ngưỡng VIL = 0,3·VCC, VIH = 0,7·VCC; trễ lan truyền (~7 ns) không được mô phỏng.',
    });
  }
}

type Ne555Topology =
  | { kind: 'astable'; ra: number; rb: number; c: number; f: number; duty: number }
  | { kind: 'monostable'; r: number; c: number; width: number }
  | { kind: 'none' };

function parallelR(net: Netlist, a: string, b: string): number | null {
  const g = net.resistors.filter((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a)).reduce((s, r) => s + 1 / r.r, 0);
  return g > 0 ? 1 / g : null;
}
function capBetween(net: Netlist, a: string, b: string): number | null {
  const c = net.capacitors.filter((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a)).reduce((s, x) => s + x.farads, 0);
  return c > 0 ? c : null;
}

class Ne555Device implements Device {
  out: Logic = 'undef';
  reason = 'chưa cấp nguồn';
  outPrim: RPrim | null = null;
  lastVcc = 5;
  topo: Ne555Topology;
  constructor(public compId: string, private comp: ComponentInstance, private net: Netlist) {
    const N = (pin: string) => net.N(compId, pin);
    const [vcc, gnd, thr, trig, dis] = [N('vcc'), N('gnd'), N('thr'), N('trig'), N('dis')];
    const ra = parallelR(net, vcc, dis);
    const rb = parallelR(net, dis, thr);
    const c = capBetween(net, thr, gnd);
    if (thr === trig && ra && rb && c && dis !== thr) {
      const f = 1 / (Math.LN2 * (ra + 2 * rb) * c);
      this.topo = { kind: 'astable', ra, rb, c, f, duty: (ra + rb) / (ra + 2 * rb) };
    } else if (thr === dis && thr !== trig) {
      const r = parallelR(net, vcc, thr);
      const cm = capBetween(net, thr, gnd);
      this.topo = r && cm ? { kind: 'monostable', r, c: cm, width: 1.1 * r * cm } : { kind: 'none' };
    } else {
      this.topo = { kind: 'none' };
    }
  }
  private N(pin: string) {
    return this.net.N(this.compId, pin);
  }
  get oscKey() {
    return `${this.compId}:OUT`;
  }
  oscillator(): Oscillator | null {
    if (this.topo.kind !== 'astable' || this.reason !== 'astable') return null;
    return { key: this.oscKey, compId: this.compId, frequencyHz: this.topo.f, dutyHigh: this.topo.duty, label: `NE555 ${this.comp.name}` };
  }
  stamp(st: Stamper, ctx: StampCtx) {
    const [vcc, gnd, out, dis] = [this.N('vcc'), this.N('gnd'), this.N('out'), this.N('dis')];
    this.outPrim = null;
    let level = this.out;
    if (this.reason === 'astable') level = ctx.lowSet.has(this.oscKey) ? 'low' : 'high';
    if (level === 'undef') return;
    // Supply current 3 mA at VCC 5 V, 10 mA at 15 V (typical, output low)
    const icc = 0.003 + 0.0007 * Math.max(0, this.lastVcc - 5);
    st.addI(vcc, gnd, icc, `${this.compId}:icc`);
    if (level === 'high') {
      const outH = `${this.compId}#outH`;
      st.addV(vcc, outH, SIM_CONSTANTS.NE555_HIGH_DROP, undefined, `${this.compId}:drop`);
      this.outPrim = st.addR(outH, out, SIM_CONSTANTS.NE555_HIGH_RESISTANCE, `${this.compId}:outH`);
    } else {
      this.outPrim = st.addR(out, gnd, SIM_CONSTANTS.NE555_LOW_RESISTANCE, `${this.compId}:outL`);
      st.addR(dis, gnd, SIM_CONSTANTS.NE555_LOW_RESISTANCE, `${this.compId}:dis`);
    }
  }
  update(sol: Solution) {
    const prev = `${this.out}|${this.reason}`;
    const gnd = this.N('gnd');
    const vcc = vdiff(sol, this.N('vcc'), gnd);
    this.lastVcc = vcc ?? 5;
    const decide = (): [Logic, string] => {
      if (vcc === undefined || vcc < SIM_CONSTANTS.NE555_MIN_VCC) return ['undef', 'chưa đủ áp VCC (cần 4,5–16 V)'];
      if (vcc > SIM_CONSTANTS.NE555_ABS_MAX_VCC) return ['undef', 'quá áp VCC'];
      if (!sol.driven.has(this.N('reset'))) return ['undef', 'RESET thả nổi'];
      const vr = vdiff(sol, this.N('reset'), gnd) ?? 0;
      if (vr < SIM_CONSTANTS.NE555_RESET_THRESHOLD) return ['low', 'đang bị RESET'];
      if (this.topo.kind === 'astable') return ['high', 'astable'];
      if (this.topo.kind === 'monostable') {
        if (!sol.driven.has(this.N('trig'))) return ['undef', 'TRIG thả nổi'];
        const vt = vdiff(sol, this.N('trig'), gnd) ?? 0;
        return vt < vcc / 3 ? ['high', 'monostable-trig'] : ['low', 'monostable-idle'];
      }
      const ctrlDriven = sol.driven.has(this.N('ctrl'));
      const vth = ctrlDriven ? vdiff(sol, this.N('ctrl'), gnd) ?? (2 * vcc) / 3 : (2 * vcc) / 3;
      const vtr = vth / 2;
      if (sol.driven.has(this.N('trig')) && (vdiff(sol, this.N('trig'), gnd) ?? vcc) < vtr) return ['high', 'comparator'];
      if (sol.driven.has(this.N('thr')) && (vdiff(sol, this.N('thr'), gnd) ?? 0) > vth) return ['low', 'comparator'];
      return ['undef', 'giữ trạng thái'];
    };
    const [o, reason] = decide();
    this.out = o;
    this.reason = reason;
    return prev !== `${this.out}|${this.reason}`;
  }
  report(r: ReportCtx) {
    const vcc = vdiff(r.sol, this.N('vcc'), this.N('gnd'));
    const iout = this.outPrim ? Math.abs(r.sol.current.get(this.outPrim) ?? 0) : 0;
    const t = this.topo;
    if (vcc !== undefined && vcc > SIM_CONSTANTS.NE555_ABS_MAX_VCC) {
      r.diag({ ruleId: 'OVERVOLTAGE', severity: 'error', message: `NE555 ${this.comp.name}: VCC = ${fmtVoltage(vcc)} vượt giới hạn 18 V.`, objectRefs: [this.compId] });
    }
    if (this.reason === 'RESET thả nổi') {
      r.diag({ ruleId: 'FLOATING_INPUT', severity: 'warning', message: `NE555 ${this.comp.name}: chân RESET (4) đang thả nổi nên trạng thái IC không xác định.`, objectRefs: [this.compId], suggestion: 'Nối chân 4 (RESET) lên VCC khi không dùng chức năng reset.' });
    }
    if (this.reason === 'TRIG thả nổi') {
      r.diag({ ruleId: 'FLOATING_INPUT', severity: 'warning', message: `NE555 ${this.comp.name}: chân TRIG (2) thả nổi.`, objectRefs: [this.compId], suggestion: 'Kéo TRIG lên VCC bằng điện trở 10 kΩ, nút nhấn kéo xuống GND để kích.' });
    }
    if (iout > 0.2) {
      r.diag({ ruleId: 'OVERCURRENT', severity: 'error', message: `NE555 ${this.comp.name}: ngõ ra cấp ${fmtCurrent(iout)}, vượt 200 mA.`, objectRefs: [this.compId] });
    }
    let label: string;
    let note: string;
    if (this.reason === 'astable' && t.kind === 'astable') {
      label = `DAO ĐỘNG astable ≈ ${t.f >= 1 ? t.f.toFixed(2) + ' Hz' : (1 / t.f).toFixed(2) + ' s/chu kỳ'}, độ rộng xung ${(t.duty * 100).toFixed(0)}%`;
      note = `f = 1 / (ln2·(RA + 2RB)·C) với RA = ${fmtOhms(t.ra)}, RB = ${fmtOhms(t.rb)}, C = ${(t.c * 1e6).toPrecision(3)} µF; mức cao ${fmtSeconds(Math.LN2 * (t.ra + t.rb) * t.c)}, mức thấp ${fmtSeconds(Math.LN2 * t.rb * t.c)}.`;
    } else if (this.reason.startsWith('monostable') && t.kind === 'monostable') {
      label = this.reason === 'monostable-trig' ? 'ĐANG KÍCH (OUT mức cao, TRIG < 1/3 VCC)' : 'CHỜ KÍCH (OUT mức thấp)';
      note = `Một xung: T = 1,1·R·C ≈ ${fmtSeconds(t.width)} (R = ${fmtOhms(t.r)}, C = ${(t.c * 1e6).toPrecision(3)} µF). Mô phỏng DC chỉ thể hiện trạng thái khi TRIG đang được giữ.`;
    } else if (this.out === 'undef') {
      label = `KHÔNG XÁC ĐỊNH (${this.reason})`;
      note = 'NE555 chỉ được mô phỏng ở cấu hình astable (RA: VCC–DIS, RB: DIS–THR, THR = TRIG, C: THR–GND), monostable, hoặc khi mức TRIG/THR quyết định được ngõ ra.';
    } else {
      label = this.out === 'high' ? 'OUT mức cao' : `OUT mức thấp (${this.reason})`;
      note = 'Trạng thái theo các bộ so sánh 1/3 và 2/3 VCC.';
    }
    setState(r, this.compId, {
      isPowered: vcc !== undefined && vcc >= SIM_CONSTANTS.NE555_MIN_VCC,
      isOn: this.reason === 'astable' || this.out === 'high',
      stateLabel: label,
      mode: this.reason,
      currentEstimate: fmtCurrent(iout),
      currentA: iout,
      voltageV: vcc,
      note,
    });
  }
}

/** Arduino UNO R3: USB supply rails + the selected sample program on the GPIO pins. */
class ArduinoDevice implements Device {
  program: string;
  pins = new Map<string, { level: Logic | 'osc'; prim: VPrim | RPrim | null; osc?: Oscillator }>();
  adc: number | null = null;
  servo: { pulseUs: number; angleDeg: number } | null = null;
  input: Logic = 'undef';
  constructor(public compId: string, private comp: ComponentInstance, private net: Netlist) {
    const p = comp.parameters || {};
    this.program = String(p.codeProgram || 'blink_led');
    if (this.program === 'blink_led') {
      this.pins.set('pin_d13', { level: 'osc', prim: null, osc: { key: `${compId}:D13`, compId, frequencyHz: 0.5, dutyHigh: 0.5, label: `Arduino ${comp.name} (Blink D13)` } });
    }
  }
  private N(pin: string) {
    return this.net.N(this.compId, pin);
  }
  oscillators(): Oscillator[] {
    return Array.from(this.pins.values())
      .map((p) => (p.level === 'osc' ? p.osc! : null))
      .filter((o): o is Oscillator => o !== null);
  }
  stamp(st: Stamper, ctx: StampCtx) {
    const gnd = this.N('pin_gnd');
    for (const [pin, s] of this.pins) {
      s.prim = null;
      let level: Logic = s.level === 'osc' ? (ctx.lowSet.has(s.osc!.key) ? 'low' : 'high') : s.level;
      if (level === 'high') s.prim = st.addV(this.N(pin), gnd, 5, SIM_CONSTANTS.ARDUINO_PIN_RESISTANCE, `${this.compId}:${pin}`);
      else if (level === 'low') s.prim = st.addR(this.N(pin), gnd, SIM_CONSTANTS.ARDUINO_PIN_RESISTANCE, `${this.compId}:${pin}`);
    }
    if (this.servo) {
      ctx.servoSignals.set(this.N('pin_d9'), { ...this.servo, sourceId: this.compId });
    }
  }
  private setPin(pin: string, level: Logic | 'osc', osc?: Oscillator): boolean {
    const cur = this.pins.get(pin);
    if (cur && cur.level === level && (level !== 'osc' || (cur.osc?.dutyHigh === osc?.dutyHigh && cur.osc?.frequencyHz === osc?.frequencyHz))) return false;
    if (level === 'undef') {
      if (!cur) return false;
      this.pins.delete(pin);
      return true;
    }
    this.pins.set(pin, { level, prim: null, osc });
    return true;
  }
  update(sol: Solution) {
    const gnd = this.N('pin_gnd');
    if (this.program === 'button_read') {
      this.input = readLogic(sol, this.N('pin_d12'), gnd, 5, SIM_CONSTANTS.ARDUINO_VIL, SIM_CONSTANTS.ARDUINO_VIH);
      return this.setPin('pin_d13', this.input);
    }
    if (this.program === 'analog_read' || this.program === 'servo_control') {
      const a0 = this.N('pin_a0');
      const v = sol.driven.has(a0) ? vdiff(sol, a0, gnd) : undefined;
      this.adc = v === undefined ? null : clamp(Math.floor((v / 5) * 1024), 0, 1023);
      if (this.adc === null) {
        this.servo = null;
        return this.setPin('pin_d9', 'undef');
      }
      if (this.program === 'analog_read') {
        const duty = Math.round(this.adc / 4) / 255; // analogWrite(9, map(v, 0, 1023, 0, 255))
        if (duty <= 0) return this.setPin('pin_d9', 'low');
        if (duty >= 1) return this.setPin('pin_d9', 'high');
        return this.setPin('pin_d9', 'osc', { key: `${this.compId}:D9`, compId: this.compId, frequencyHz: 490, dutyHigh: duty, label: `Arduino ${this.comp.name} (PWM D9)` });
      }
      const angleDeg = Math.floor((this.adc * 180) / 1023); // map(val, 0, 1023, 0, 180)
      const pulseUs = SIM_CONSTANTS.SERVO_MIN_PULSE_US + (angleDeg / 180) * (SIM_CONSTANTS.SERVO_MAX_PULSE_US - SIM_CONSTANTS.SERVO_MIN_PULSE_US);
      const changed = this.servo?.angleDeg !== angleDeg;
      this.servo = { pulseUs, angleDeg };
      return this.setPin('pin_d9', 'osc', { key: `${this.compId}:D9`, compId: this.compId, frequencyHz: 50, dutyHigh: pulseUs / 20000, label: `Arduino ${this.comp.name} (xung servo D9)` }) || changed;
    }
    return false;
  }
  report(r: ReportCtx) {
    const st = r.states[this.compId];
    const parts: string[] = [];
    for (const [pin, s] of this.pins) {
      const name = pin.replace('pin_', '').toUpperCase();
      const i = s.prim ? r.sol.current.get(s.prim) ?? 0 : 0;
      const supplied = -i; // HIGH: MNA branch current is negative while the pin sources current
      const absI = Math.abs(i);
      if (s.prim?.kind === 'V' && supplied > SIM_CONSTANTS.CONDUCTING_CURRENT) {
        r.addSupply(supplied);
        if (st) {
          st.currentA = (st.currentA ?? 0) + supplied;
          st.currentEstimate = fmtCurrent(st.currentA);
          st.isOn = true;
        }
      }
      if (absI > SIM_CONSTANTS.ARDUINO_PIN_MAX_CURRENT) {
        r.diag({ ruleId: 'OVERCURRENT', severity: 'error', message: `Chân ${name} của Arduino dẫn ${fmtCurrent(absI)}, vượt mức tối đa 40 mA của ATmega328P.`, objectRefs: [this.compId], suggestion: 'Thêm điện trở hạn dòng, hoặc dùng transistor/rơ-le để đóng tải lớn.' });
      } else if (absI > SIM_CONSTANTS.ARDUINO_PIN_RECOMMENDED_CURRENT) {
        r.diag({ ruleId: 'OVERCURRENT', severity: 'warning', message: `Chân ${name} của Arduino dẫn ${fmtCurrent(absI)}, vượt mức khuyến nghị 20 mA cho mỗi chân.`, objectRefs: [this.compId], suggestion: 'Tăng điện trở hạn dòng.' });
      }
      const level = s.level === 'osc' ? (r.ctx.lowSet.has(s.osc!.key) ? 'LOW' : 'HIGH') : s.level.toUpperCase();
      parts.push(s.level === 'osc' ? `${name}: xung ${s.osc!.frequencyHz} Hz, ${(s.osc!.dutyHigh * 100).toFixed(1)}%` : `${name}: ${level}${absI > 1e-6 ? ` (${fmtCurrent(absI)})` : ''}`);
    }
    if (this.program === 'button_read' && this.input === 'undef') {
      r.diag({ ruleId: 'FLOATING_INPUT', severity: 'warning', message: `Arduino ${this.comp.name}: chân D12 (INPUT) đang thả nổi hoặc ở mức trung gian, digitalRead() không xác định nên D13 không được điều khiển.`, objectRefs: [this.compId], suggestion: 'Thêm điện trở kéo xuống 10 kΩ từ D12 về GND, nút nhấn nối D12 lên 5V.' });
    }
    if ((this.program === 'analog_read' || this.program === 'servo_control') && this.adc === null) {
      r.diag({ ruleId: 'FLOATING_INPUT', severity: 'warning', message: `Arduino ${this.comp.name}: chân A0 thả nổi, analogRead() không xác định.`, objectRefs: [this.compId], suggestion: 'Nối con chạy biến trở vào A0, hai đầu biến trở vào 5V và GND.' });
    }
    const programLabel: Record<string, string> = {
      none: 'không chạy chương trình',
      blink_led: 'Blink D13',
      button_read: `D13 = digitalRead(D12) = ${this.input === 'undef' ? '?' : this.input.toUpperCase()}`,
      analog_read: `A0 = ${this.adc ?? '?'} → PWM D9`,
      servo_control: `A0 = ${this.adc ?? '?'} → servo ${this.servo ? this.servo.angleDeg + '°' : '?'}`,
    };
    const note = `Arduino: mô phỏng nguồn USB (5V/3.3V/GND) và chương trình mẫu "${programLabel[this.program] || this.program}"; không biên dịch hay chạy sketch tùy ý. ${parts.length ? 'Chân: ' + parts.join('; ') + '.' : 'Không chân GPIO nào đang xuất tín hiệu.'}`;
    if (st) st.note = note;
    else setState(r, this.compId, { isPowered: true, note });
  }
}

/** Load-free modules checked only for supply voltage and control signals. */
class ModuleDevice implements Device {
  constructor(public compId: string, private comp: ComponentInstance, private net: Netlist, private kind: 'servo' | 'oled' | 'sr04') {}
  private N(pin: string) {
    return this.net.N(this.compId, pin);
  }
  stamp() {}
  report(r: ReportCtx) {
    const v = vdiff(r.sol, this.N('vcc'), this.N('gnd'));
    const name = this.comp.name;
    const p = this.comp.parameters || {};
    const ranges = { servo: [SIM_CONSTANTS.SERVO_MIN_VOLTAGE, SIM_CONSTANTS.SERVO_MAX_VOLTAGE], oled: [3.0, 5.5], sr04: [4.5, 5.5] } as const;
    const [lo, hi] = ranges[this.kind];
    const powered = v !== undefined && v >= lo && v <= hi;
    if (v !== undefined && v > hi + 0.5) {
      r.diag({ ruleId: 'OVERVOLTAGE', severity: 'error', message: `${name}: nguồn ${fmtVoltage(v)} vượt dải ${lo}–${hi} V.`, objectRefs: [this.compId] });
    }
    if (v !== undefined && v < -0.5) {
      r.diag({ ruleId: 'REVERSE_POLARITY', severity: 'error', message: `${name} đang bị cấp ngược cực (VCC thấp hơn GND).`, objectRefs: [this.compId] });
    }
    const supplyText = v === undefined ? 'chưa nối nguồn' : `VCC = ${fmtVoltage(v)}`;
    if (this.kind === 'servo') {
      const sig = r.ctx.servoSignals.get(this.N('pwm'));
      const angle = powered && sig ? sig.angleDeg : undefined;
      setState(r, this.compId, {
        isPowered: powered,
        isOn: angle !== undefined,
        stateLabel: !powered
          ? `KHÔNG HOẠT ĐỘNG (cần 4,8–6 V, ${supplyText})`
          : angle !== undefined
          ? `Giữ góc ${angle}° (xung ${sig!.pulseUs.toFixed(0)} µs / 20 ms)`
          : 'Có nguồn, chưa nhận xung điều khiển: trục đứng yên',
        voltageV: v,
        note: 'Góc = (độ rộng xung − 544 µs)/(2400 − 544 µs)·180° (quy ước thư viện Servo của Arduino); dòng tiêu thụ của servo (tới vài trăm mA khi quay) không được tính vào mạch.',
        visual: angle !== undefined ? { angleDeg: angle } : undefined,
      });
    } else if (this.kind === 'oled') {
      setState(r, this.compId, {
        isPowered: powered,
        isOn: false,
        stateLabel: powered ? 'Có nguồn – màn hình tối (chưa nhận lệnh khởi tạo I2C)' : `TẮT (${supplyText})`,
        voltageV: v,
        note: 'Giao thức I2C/SSD1306 chưa được mô phỏng: màn hình chỉ sáng khi vi điều khiển gửi lệnh khởi tạo và dữ liệu, nên không hiển thị nội dung giả.',
        visual: { displayOn: false },
      });
    } else {
      const d = num(p.distanceCm, 25);
      setState(r, this.compId, {
        isPowered: powered,
        isOn: false,
        stateLabel: powered ? `Có nguồn – chờ xung TRIG 10 µs (vật cản ${d} cm ⇒ ECHO ≈ ${(d * 58).toFixed(0)} µs)` : `TẮT (cần 5 V, ${supplyText})`,
        voltageV: v,
        note: 'Chu trình đo (xung TRIG → sóng 40 kHz → xung ECHO = khoảng cách × 58 µs/cm) cần mô phỏng theo thời gian, hiện chưa hỗ trợ.',
      });
    }
  }
}

class MotorDevice implements Device {
  prim: RPrim | null = null;
  constructor(public compId: string, private comp: ComponentInstance, private a: string, private b: string) {}
  stamp(st: Stamper) {
    this.prim = st.addR(this.a, this.b, Math.max(0.5, num(this.comp.parameters?.equivalentResistance, 20)), `${this.compId}:main`);
  }
  report(r: ReportCtx) {
    const v = vdiff(r.sol, this.a, this.b);
    if (v === undefined || !this.prim) return;
    const i = r.sol.current.get(this.prim) ?? 0;
    const p = this.comp.parameters || {};
    const vStart = num(p.startVoltage, 0.8);
    const running = Math.abs(v) >= vStart;
    const rpm = running ? (num(p.rpm, 3000) * v) / num(p.ratedVoltage, 6) : 0;
    setState(r, this.compId, {
      isPowered: Math.abs(v) > 0.01,
      isOn: running,
      stateLabel: running ? `QUAY ${v > 0 ? 'thuận' : 'ngược'} ≈ ${Math.abs(rpm).toFixed(0)} vòng/phút (không tải)` : `ĐỨNG YÊN (cần ≥ ${vStart} V)`,
      currentEstimate: fmtCurrent(i),
      voltageDrop: fmtVoltage(v),
      currentA: Math.abs(i),
      voltageV: Math.abs(v),
      powerW: Math.abs(v * i),
      note: 'Mô hình gần đúng: tải điện trở tương đương (giả định, chỉnh trong Property Panel), tốc độ không tải tỉ lệ điện áp; không tính sức phản điện động, mô-men tải và dòng khởi động.',
      visual: running ? { rpm } : { rpm: 0 },
    });
  }
}

// --------------------------------------------------------------------------------------
// Netlist
// --------------------------------------------------------------------------------------

function buildNetlist(doc: ProjectDocument, switchStates: Record<string, boolean>): Netlist {
  const conn = buildConnectivity(doc);
  const net: Netlist = {
    doc,
    comps: new Map(doc.components.map((c) => [c.instanceId, c])),
    conn,
    N: conn.nodeOf,
    devices: [],
    sources: [],
    capacitors: [],
    resistors: [],
    unsupported: [],
  };
  const N = net.N;
  const add = (d: Device) => net.devices.push(d);
  const addSource = (rec: SourceRecord, rInt: number) => {
    net.sources.push(rec);
    add(new SourceDevice(rec.compId, rec, rInt));
  };

  for (const comp of doc.components) {
    const id = comp.instanceId;
    const p = comp.parameters || {};
    switch (comp.definitionId) {
      case 'dc-source':
        addSource({ compId: id, part: 'main', v: num(p.voltage, 5), maxCurrent: num(p.maxCurrent, 1000) / 1000, p: N(id, 'vcc'), n: N(id, 'gnd') }, SIM_CONSTANTS.SOURCE_INTERNAL_RESISTANCE);
        break;
      case 'arduino-uno':
        addSource({ compId: id, part: '5V', v: 5, maxCurrent: SIM_CONSTANTS.ARDUINO_5V_MAX_CURRENT, p: N(id, 'pin_5v'), n: N(id, 'pin_gnd') }, SIM_CONSTANTS.ARDUINO_RAIL_RESISTANCE);
        if (conn.isConnected(id, 'pin_3v3')) {
          addSource({ compId: id, part: '3V3', v: 3.3, maxCurrent: SIM_CONSTANTS.ARDUINO_3V3_MAX_CURRENT, p: N(id, 'pin_3v3'), n: N(id, 'pin_gnd') }, SIM_CONSTANTS.ARDUINO_RAIL_RESISTANCE);
        }
        add(new ArduinoDevice(id, comp, net));
        break;
      case 'resistor': {
        const r = Math.max(1e-3, num(p.resistance, 220));
        net.resistors.push({ compId: id, a: N(id, 'pin1'), b: N(id, 'pin2'), r });
        add(new ResistorDevice(id, comp, N(id, 'pin1'), N(id, 'pin2'), r));
        break;
      }
      case 'potentiometer': {
        const total = Math.max(1, num(p.maxResistance ?? p.resistance, 10000));
        const pos = clamp(num(p.currentPosition ?? (comp.state?.value !== undefined ? comp.state.value / 100 : undefined), 0.5), 0, 1);
        add(new PotentiometerDevice(id, comp, net, total, pos));
        break;
      }
      case 'ldr': {
        const dark = Math.max(1, num(p.darkResistance, 1e6));
        const light = Math.max(1, num(p.lightResistance, 400));
        const level = clamp(num(p.lightLevelPercent, 50), 0, 100) / 100;
        add(new ResistorDevice(id, comp, N(id, 'pin1'), N(id, 'pin2'), dark * Math.pow(light / dark, level)));
        break;
      }
      case 'switch':
        add(new SwitchDevice(id, comp, N(id, 'pin1'), N(id, 'pin2'), isSwitchClosed(comp, switchStates)));
        break;
      case 'pushbutton':
        add(new SwitchDevice(id, comp, N(id, 'pin1'), N(id, 'pin2'), switchStates[id] ?? Boolean(p.pressed)));
        break;
      case 'connector':
      case 'breadboard':
      case 'ne555': // added after the loop (needs the resistor/capacitor lists)
        break;
      case 'led':
        add(new LedDevice(id, comp, net, true));
        break;
      case 'diode':
        add(new LedDevice(id, comp, net, false));
        break;
      case 'rgb-led':
        add(new LedArrayDevice(id, comp, net, 'rgb'));
        break;
      case '7seg-display':
        add(new LedArrayDevice(id, comp, net, '7seg'));
        break;
      case 'buzzer':
        add(new BuzzerDevice(id, comp, N(id, 'pin_pos'), N(id, 'pin_neg')));
        break;
      case 'capacitor':
        net.capacitors.push({ compId: id, a: N(id, 'pin_pos'), b: N(id, 'pin_neg'), farads: Math.max(0, num(p.capacitance, 100)) * 1e-6 });
        add(new CapacitorDevice(id, comp, N(id, 'pin_pos'), N(id, 'pin_neg')));
        break;
      case 'relay':
        add(new RelayDevice(id, comp, net));
        break;
      case 'transistor-npn':
        add(new TransistorDevice(id, comp, net));
        break;
      case 'voltage-reg-7805':
        add(new RegulatorDevice(id, comp, net));
        break;
      case 'temp-sensor':
        add(new Lm35Device(id, comp, net));
        break;
      case 'logic-and':
        add(new LogicAndDevice(id, comp, net));
        break;
      case 'dc-motor':
        add(new MotorDevice(id, comp, N(id, 'pos'), N(id, 'neg')));
        break;
      case 'servo-sg90':
        add(new ModuleDevice(id, comp, net, 'servo'));
        break;
      case 'oled-i2c':
        add(new ModuleDevice(id, comp, net, 'oled'));
        break;
      case 'ultrasonic-sr04':
        add(new ModuleDevice(id, comp, net, 'sr04'));
        break;
      default:
        net.unsupported.push(id);
    }
  }
  // NE555 needs the resistor / capacitor lists to recognise its timing network
  for (const comp of doc.components) {
    if (comp.definitionId === 'ne555') add(new Ne555Device(comp.instanceId, comp, net));
  }
  return net;
}

// --------------------------------------------------------------------------------------
// Phase solve: iterate device modes to a consistent operating point
// --------------------------------------------------------------------------------------

interface PhaseResult {
  net: Netlist;
  sol: Solution;
  prims: Prim[];
  ctx: StampCtx;
  converged: boolean;
  timedOut: boolean;
}

function runPhase(doc: ProjectDocument, switchStates: Record<string, boolean>, lowSet: Set<string>): PhaseResult {
  const net = buildNetlist(doc, switchStates);
  const started = Date.now();
  let ctx: StampCtx = { lowSet, servoSignals: new Map() };
  const stampAll = () => {
    ctx = { lowSet, servoSignals: new Map() };
    const st = new Stamper();
    for (const d of net.devices) d.stamp(st, ctx);
    return st.prims;
  };
  let prims = stampAll();
  let sol = solvePrims(prims);
  let converged = false;
  let timedOut = false;
  for (let iter = 0; iter < SIM_CONSTANTS.MAX_ITERATIONS; iter++) {
    let changed = false;
    for (const d of net.devices) if (d.update && d.update(sol, ctx)) changed = true;
    if (!changed) {
      converged = true;
      break;
    }
    if (Date.now() - started > SIM_CONSTANTS.TIME_BUDGET_MS) {
      timedOut = true;
      break;
    }
    prims = stampAll();
    sol = solvePrims(prims);
  }
  return { net, sol, prims, ctx, converged, timedOut };
}

function collectOscillators(net: Netlist): Oscillator[] {
  const list: Oscillator[] = [];
  for (const d of net.devices) {
    if (d instanceof ArduinoDevice) list.push(...d.oscillators());
    else if (d.oscillator) {
      const o = d.oscillator();
      if (o) list.push(o);
    }
  }
  return list;
}

/** Thevenin resistance seen by each capacitor (independent sources zeroed, devices linearised). */
function capacitorTimeConstants(phase: PhaseResult): Map<string, { rth: number; tau: number }> {
  const out = new Map<string, { rth: number; tau: number }>();
  for (const cap of phase.net.capacitors.slice(0, 12)) {
    if (cap.a === cap.b || cap.farads <= 0) continue;
    const prims: Prim[] = [];
    const vMap = new Map<VPrim, VPrim>();
    for (const pr of phase.prims) {
      if (pr.kind === 'R' && pr.tag === `${cap.compId}:leakage`) continue;
      if (pr.kind === 'V') {
        const z: VPrim = { ...pr, v: 0 };
        vMap.set(pr, z);
        prims.push(z);
      } else if (pr.kind === 'I') continue;
      else if (pr.kind === 'F') prims.push({ ...pr, ctrl: vMap.get(pr.ctrl) || pr.ctrl });
      else prims.push(pr);
    }
    // F prims may reference V prims stamped later: remap after the pass
    for (let k = 0; k < prims.length; k++) {
      const pr = prims[k];
      if (pr.kind === 'F' && vMap.has(pr.ctrl)) prims[k] = { ...pr, ctrl: vMap.get(pr.ctrl)! };
    }
    prims.push({ kind: 'I', from: cap.b, to: cap.a, i: 1 });
    const sol = solvePrims(prims);
    const v = vdiff(sol, cap.a, cap.b);
    if (v === undefined || !Number.isFinite(v) || v <= 0) continue;
    out.set(cap.compId, { rth: v, tau: v * cap.farads });
  }
  return out;
}

// --------------------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------------------

function reportPhase(phase: PhaseResult, inputDoc: ProjectDocument) {
  const { net, sol } = phase;
  const states: Record<string, ComponentSimulationState> = {};
  for (const c of inputDoc.components) states[c.instanceId] = { isPowered: false, isOn: false, stateLabel: 'Chưa có điện' };
  const diagnostics: SimulationDiagnostic[] = [];
  const seen = new Set<string>();
  const diag = (d: SimulationDiagnostic) => {
    const key = `${d.ruleId}|${d.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    diagnostics.push(d);
  };
  let totalSupply = 0;
  let shortDetected = false;

  // Sources (grouped per component: the Arduino exposes several rails)
  for (const s of net.sources) {
    const raw = s.prim ? sol.current.get(s.prim) : undefined;
    if (raw === undefined) continue;
    const i = -raw; // current delivered out of the + terminal
    if (i > SIM_CONSTANTS.CONDUCTING_CURRENT) totalSupply += i;
    const loadR = Math.abs(i) > 1e-12 ? s.v / Math.abs(i) : Infinity;
    const prev = states[s.compId];
    const current = Math.abs(i) + (prev?.isPowered ? prev.currentA ?? 0 : 0);
    const where = s.part === 'main' ? '' : `${s.part} `;
    if (Math.abs(i) > s.maxCurrent) {
      if (loadR < SIM_CONSTANTS.SHORT_CIRCUIT_RESISTANCE) {
        shortDetected = true;
        diag({ ruleId: 'SHORT_CIRCUIT', severity: 'error', message: `Đoản mạch (ngắn mạch) tại nguồn ${where}: tải chỉ ≈ ${loadR.toFixed(3)} Ω, dòng ${fmtCurrent(i)}.`, objectRefs: [s.compId], suggestion: 'Tìm và gỡ đường nối thẳng từ cực + về GND không qua tải.' });
      } else {
        diag({ ruleId: 'SOURCE_OVERLOAD', severity: 'error', message: `Nguồn ${where}quá dòng: ${fmtCurrent(i)} vượt giới hạn ${fmtCurrent(s.maxCurrent)}.`, objectRefs: [s.compId], suggestion: 'Giảm tải hoặc dùng nguồn có dòng định mức lớn hơn.' });
      }
    }
    states[s.compId] = {
      isPowered: true,
      isOn: current > SIM_CONSTANTS.CONDUCTING_CURRENT,
      stateLabel: current > SIM_CONSTANTS.CONDUCTING_CURRENT ? `Đang cấp nguồn ${s.v.toFixed(1)}V` : `Sẵn sàng ${s.v.toFixed(1)}V (chưa có tải)`,
      currentEstimate: fmtCurrent(current),
      voltageDrop: fmtVoltage(s.v),
      currentA: current,
      voltageV: s.v,
      powerW: s.v * current,
    };
  }

  const r: ReportCtx = { sol, states, diag, addSupply: (a) => (totalSupply += a), net, ctx: phase.ctx };
  for (const d of net.devices) d.report(r);
  return { states, diagnostics, totalSupply, shortDetected };
}

export function simulateBehavior(
  inputDoc: ProjectDocument,
  switchStates: Record<string, boolean> = {} // instanceId -> isClosed
): SimulationResult {
  const doc = toCanonicalDocument(inputDoc);
  const blank: Record<string, ComponentSimulationState> = {};
  for (const c of inputDoc.components) blank[c.instanceId] = { isPowered: false, isOn: false, stateLabel: 'Chưa có điện' };

  const hasPowerSource = doc.components.some((c) => c.definitionId === 'dc-source' || c.definitionId === 'arduino-uno');
  if (!hasPowerSource) {
    return {
      status: 'stopped',
      revision: inputDoc.revision,
      components: blank,
      summary: 'Mô phỏng dừng: Chưa có nguồn điện (Nguồn DC hoặc Arduino UNO) trên mạch.',
      isClosedLoop: false,
      issues: ['Chưa có nguồn điện DC hoặc Bo Arduino.'],
      diagnostics: [],
      timestamp: Date.now(),
      solver: 'mna-dc',
      unsupportedComponents: [],
    };
  }

  // Primary phase: every oscillator output at its HIGH level
  const base = runPhase(doc, switchStates, new Set());
  const net = base.net;
  for (const id of net.unsupported) {
    blank[id] = {
      isPowered: false,
      isOn: false,
      stateLabel: 'Chưa hỗ trợ mô phỏng điện',
      note: 'Linh kiện này hiện chỉ được hiển thị và lắp ráp 3D; bộ mô phỏng chưa có mô hình điện cho nó nên không tính dòng/áp.',
    };
  }

  // Direct short: a source whose terminals are on the same node (a plain wire across it)
  const directShort = net.sources.find((s) => s.p === s.n);
  if (directShort) {
    const states = { ...blank };
    states[directShort.compId] = {
      isPowered: true,
      isOn: false,
      stateLabel: 'ĐOẢN MẠCH! Bảo vệ quá dòng kích hoạt',
      note: 'Cực dương và cực âm của nguồn được nối trực tiếp với nhau (điện trở ≈ 0 Ω).',
    };
    const d: SimulationDiagnostic = {
      ruleId: 'SHORT_CIRCUIT',
      severity: 'error',
      message: 'Đoản mạch (ngắn mạch): VCC chạm trực tiếp GND.',
      objectRefs: [directShort.compId],
      suggestion: 'Xóa dây nối tắt này ngay lập tức để tránh làm hỏng nguồn điện.',
    };
    return {
      status: 'error',
      revision: inputDoc.revision,
      components: states,
      summary: 'LỖI NGUY HIỂM: Đoản mạch (ngắn mạch) trực tiếp giữa cực dương và cực âm của nguồn!',
      isClosedLoop: true,
      issues: [d.message],
      diagnostics: [d],
      timestamp: Date.now(),
      solver: 'mna-dc',
      unsupportedComponents: net.unsupported,
    };
  }

  const primary = reportPhase(base, inputDoc);
  const states: Record<string, ComponentSimulationState> = { ...blank, ...primary.states };
  for (const id of net.unsupported) states[id] = blank[id];
  const diagnostics = [...primary.diagnostics];
  const addDiag = (d: SimulationDiagnostic) => {
    if (!diagnostics.some((x) => x.ruleId === d.ruleId && x.message === d.message)) diagnostics.push(d);
  };

  // Oscillators: solve again with each one at its LOW level; parts that change follow it
  const oscillators = collectOscillators(net).slice(0, 6);
  for (const osc of oscillators) {
    const low = runPhase(doc, switchStates, new Set([osc.key]));
    const lowReport = reportPhase(low, inputDoc);
    for (const d of lowReport.diagnostics) addDiag(d);
    for (const [id, hi] of Object.entries(states)) {
      const lo = lowReport.states[id];
      if (!lo || states[id].pwm || id === osc.compId) continue;
      const changed = hi.isOn !== lo.isOn || Math.abs((hi.currentA ?? 0) - (lo.currentA ?? 0)) > 1e-4 || hi.visual?.angleDeg !== lo.visual?.angleDeg;
      if (!changed) continue;
      const onFraction = hi.isOn && !lo.isOn ? osc.dutyHigh : !hi.isOn && lo.isOn ? 1 - osc.dutyHigh : osc.dutyHigh;
      const base = hi.isOn ? hi : lo;
      const avg = (hi.currentA ?? 0) * osc.dutyHigh + (lo.currentA ?? 0) * (1 - osc.dutyHigh);
      const visible = osc.frequencyHz <= SIM_CONSTANTS.BLINK_VISIBLE_MAX_HZ;
      states[id] = {
        ...base,
        isOn: hi.isOn || lo.isOn,
        stateLabel: visible
          ? `NHẤP NHÁY ${osc.frequencyHz >= 1 ? osc.frequencyHz.toFixed(2) + ' Hz' : (1 / osc.frequencyHz).toFixed(2) + ' s/chu kỳ'} (bật ${(onFraction * 100).toFixed(0)}% thời gian)`
          : `Nhận xung ${osc.frequencyHz.toFixed(0)} Hz: sáng/hoạt động trung bình ${(onFraction * 100).toFixed(0)}%`,
        currentA: avg,
        currentEstimate: `${fmtCurrent(avg)} (trung bình)`,
        pwm: { frequencyHz: osc.frequencyHz, duty: onFraction, sourceId: osc.compId },
        note: `${base.note ? base.note + ' ' : ''}Theo ${osc.label}: khi mức cao ${fmtCurrent(hi.currentA ?? 0)}, khi mức thấp ${fmtCurrent(lo.currentA ?? 0)}.`,
      };
    }
  }
  if (oscillators.length > 1) {
    addDiag({ ruleId: 'SIMULATION_LIMIT', severity: 'info', message: `Mạch có ${oscillators.length} nguồn dao động: mỗi nguồn được xét riêng, tương tác giữa chúng theo thời gian không được mô phỏng.`, objectRefs: oscillators.map((o) => o.compId) });
  }

  // Capacitor time constants τ = R_th · C
  for (const [id, tc] of capacitorTimeConstants(base)) {
    const st = states[id];
    if (!st) continue;
    st.note = tc.rth >= SIM_CONSTANTS.WEAK_RESISTANCE
      ? 'Ở trạng thái DC xác lập tụ điện không cho dòng một chiều đi qua. Không có đường nạp/xả qua điện trở nên tụ giữ điện tích.'
      : `Ở trạng thái DC xác lập tụ điện không cho dòng một chiều đi qua. Hằng số thời gian τ = R·C = ${fmtOhms(tc.rth)} × C ≈ ${fmtSeconds(tc.tau)}: đạt ~63% điện áp cuối sau τ, ~99% sau 5τ ≈ ${fmtSeconds(5 * tc.tau)}.`;
    st.timeConstantS = tc.rth >= SIM_CONSTANTS.WEAK_RESISTANCE ? undefined : tc.tau;
  }

  if (base.sol.singular) {
    addDiag({ ruleId: 'PIN_CONFLICT', severity: 'error', message: 'Không giải được mạch: có các nguồn áp mắc song song khác điện áp/xung đột hoặc vòng chỉ gồm nguồn áp. Hãy kiểm tra lại cách nối nguồn.', objectRefs: net.sources.map((s) => s.compId) });
  }
  if (!base.converged) {
    addDiag({ ruleId: 'SIMULATION_LIMIT', severity: 'warning', message: base.timedOut ? 'Bộ giải dừng vì vượt thời gian cho phép; kết quả có thể chưa chính xác.' : 'Bộ giải chưa hội tụ trạng thái LED/diode/transistor/logic sau nhiều vòng lặp (có thể là mạch dao động/hồi tiếp); kết quả có thể chưa chính xác.', objectRefs: [] });
  }

  const closedLoop = primary.totalSupply > SIM_CONSTANTS.CONDUCTING_CURRENT;
  const shortDetected = primary.shortDetected;
  const overCurrent = diagnostics.some((d) => ['OVERCURRENT', 'OVERPOWER', 'SOURCE_OVERLOAD'].includes(d.ruleId));
  const unsupportedNote = net.unsupported.length > 0 ? ` ${net.unsupported.length} linh kiện chưa có mô hình điện và không được tính vào kết quả.` : '';

  let status: SimulationResult['status'];
  let summary: string;
  const issues = diagnostics.filter((d) => d.severity !== 'info').map((d) => d.message);
  if (shortDetected) {
    status = 'error';
    summary = 'LỖI NGUY HIỂM: Đoản mạch (ngắn mạch) – dòng điện vượt xa giới hạn của nguồn!';
  } else if (base.sol.singular && !closedLoop) {
    status = 'error';
    summary = 'Không thể giải mạch: cấu trúc nguồn áp không xác định.' + unsupportedNote;
  } else if (closedLoop) {
    status = 'running';
    summary =
      (overCurrent
        ? `Mạch kín nhưng có linh kiện quá dòng/quá công suất. Tổng dòng cấp: ${fmtCurrent(primary.totalSupply)}.`
        : `Mạch điện hoạt động: vòng kín từ cực dương qua tải về GND, tổng dòng cấp ${fmtCurrent(primary.totalSupply)}.`) + unsupportedNote;
  } else {
    status = 'stopped';
    summary = 'Mạch hở: Chưa tìm thấy vòng khép kín hoàn chỉnh từ cực dương VCC về cực âm GND.' + unsupportedNote;
    issues.push('Mạch hở, chưa nối đủ dây về GND hoặc công tắc đang mở.');
  }

  return {
    status,
    revision: inputDoc.revision,
    components: states,
    summary,
    isClosedLoop: closedLoop || shortDetected,
    issues,
    diagnostics,
    timestamp: Date.now(),
    solver: 'mna-dc',
    unsupportedComponents: net.unsupported,
    nodeVoltages: Object.fromEntries(base.sol.voltages),
  };
}
