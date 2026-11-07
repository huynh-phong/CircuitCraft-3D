import { SimulationResult, ComponentSimulationState } from './types';
import { ProjectDocument, ComponentInstance, Connection } from '../project/types';
import { COMPONENT_DEFINITION_MAP, getBreadboardBusId } from '../components/definitions';
import { calculatePinWorldPosition } from '../project/coordinates';
import { toCanonicalDocument } from '../components/aliases';

/**
 * CircuitCraft 3D - DC steady-state circuit solver.
 *
 * Method: Modified Nodal Analysis (MNA). Every set of electrically connected pins (wires,
 * breadboard buses, components plugged into the breadboard) becomes a node; resistive
 * elements are stamped as conductances (Ohm's law), voltage sources add a branch-current
 * unknown, and solving G·x = b enforces Kirchhoff's current law at every node and
 * Kirchhoff's voltage law around every loop.
 *
 * Non-linear parts use piecewise-linear models solved iteratively:
 *  - LED / diode: OFF = open circuit, ON = forward voltage Vf + series resistance.
 *  - Relay: contacts COM–NO close when the coil current exceeds the pick-up current.
 * Capacitors are open circuits at DC steady state (only a 1 GΩ leakage path is kept so their
 * terminal voltage is defined). Components without an electrical model are reported as
 * unsupported instead of being given fabricated values.
 */

// --------------------------------------------------------------------------------------
// Model constants
// --------------------------------------------------------------------------------------
export const SIM_CONSTANTS = {
  CONTACT_RESISTANCE: 0.01, // Ω closed switch / connector
  LED_SERIES_RESISTANCE: 10, // Ω dynamic resistance in the ON region
  DIODE_FORWARD_VOLTAGE: 0.7, // V (1N4007)
  DIODE_SERIES_RESISTANCE: 1, // Ω
  OFF_RESISTANCE: 1e9, // Ω reverse-biased junction / capacitor leakage
  LED_VISIBLE_CURRENT: 0.0002, // A (0.2 mA) below this an LED is considered dark
  LED_DIM_CURRENT: 0.002, // A (2 mA) below this the LED glows dimly
  CONDUCTING_CURRENT: 1e-6, // A
  RELAY_COIL_RESISTANCE: 70, // Ω (typical 5 V relay coil)
  RELAY_PICKUP_CURRENT: 0.03, // A
  BUZZER_EQUIVALENT_RESISTANCE: 170, // Ω (≈ 30 mA at 5 V, active buzzer)
  BUZZER_MIN_VOLTAGE: 2.0, // V
  ARDUINO_PIN_RESISTANCE: 25, // Ω ATmega328P output stage
  SOURCE_INTERNAL_RESISTANCE: 0.05, // Ω bench supply / battery internal resistance
  ARDUINO_RAIL_RESISTANCE: 0.1, // Ω on-board regulator output
  SHORT_CIRCUIT_RESISTANCE: 1, // Ω: load below this across a source = short circuit
  MAX_ITERATIONS: 40,
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

/** Components handled by the solver (canonical definition ids). */
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
]);

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

type Element =
  | { kind: 'R'; a: string; b: string; r: number; compId: string; part: string }
  | { kind: 'V'; p: string; n: string; v: number; compId: string; part: string; rInternal?: number };

interface DiodeModel {
  compId: string;
  anode: string;
  cathode: string;
  vf: number;
  rs: number;
  on: boolean;
}

interface RelayModel {
  compId: string;
  coilPos: string;
  coilNeg: string;
  com: string;
  no: string;
  energized: boolean;
}

interface Netlist {
  elements: Element[];
  diodes: DiodeModel[];
  relays: RelayModel[];
  nodeOf: (compId: string, pinId: string) => string;
  sources: Array<{ compId: string; p: string; n: string; v: number; part: string; maxCurrent: number; rInternal: number }>;
  unsupported: string[];
}

function num(v: any, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function buildNetlist(doc: ProjectDocument, switchStates: Record<string, boolean>): Netlist {
  const uf = new UnionFind();
  const compById = new Map(doc.components.map((c) => [c.instanceId, c]));

  const allConnections = [...doc.connections, ...computeBreadboardPlugs(doc)];
  for (const conn of allConnections) {
    if (!compById.has(conn.fromComponentId) || !compById.has(conn.toComponentId)) continue;
    uf.union(pinKey(conn.fromComponentId, conn.fromPinId), pinKey(conn.toComponentId, conn.toPinId));
  }

  // Internal bonding: breadboard buses and Arduino ground pins
  for (const conn of allConnections) {
    for (const [compId, pinId] of [
      [conn.fromComponentId, conn.fromPinId],
      [conn.toComponentId, conn.toPinId],
    ] as const) {
      const comp = compById.get(compId);
      if (comp?.definitionId === 'breadboard') {
        uf.union(pinKey(compId, pinId), pinKey(compId, `bus:${getBreadboardBusId(pinId)}`));
      }
    }
  }
  for (const comp of doc.components) {
    if (comp.definitionId === 'arduino-uno') {
      uf.union(pinKey(comp.instanceId, 'pin_gnd'), pinKey(comp.instanceId, 'pin_gnd2'));
      uf.union(pinKey(comp.instanceId, 'pin_gnd'), pinKey(comp.instanceId, 'pin_gnd_top'));
      uf.union(pinKey(comp.instanceId, 'pin_gnd'), pinKey(comp.instanceId, 'gnd'));
    }
  }

  const nodeOf = (compId: string, pinId: string) => uf.find(pinKey(compId, pinId));
  const isWired = (compId: string, pinId: string) => {
    const key = pinKey(compId, pinId);
    return uf.find(key) !== key || allConnections.some(
      (c) => (c.fromComponentId === compId && c.fromPinId === pinId) || (c.toComponentId === compId && c.toPinId === pinId)
    );
  };

  const elements: Element[] = [];
  const diodes: DiodeModel[] = [];
  const relays: RelayModel[] = [];
  const sources: Netlist['sources'] = [];
  const unsupported: string[] = [];

  for (const comp of doc.components) {
    const id = comp.instanceId;
    const p = comp.parameters || {};
    const N = (pin: string) => nodeOf(id, pin);
    switch (comp.definitionId) {
      case 'dc-source': {
        const v = num(p.voltage, 5);
        sources.push({
          compId: id,
          p: N('vcc'),
          n: N('gnd'),
          v,
          part: 'main',
          maxCurrent: num(p.maxCurrent, 1000) / 1000,
          rInternal: SIM_CONSTANTS.SOURCE_INTERNAL_RESISTANCE,
        });
        break;
      }
      case 'arduino-uno': {
        // Board supply rails. Sketch execution is NOT simulated: D13 is modelled as a HIGH
        // output (the built-in "Blink" pin) through the ATmega output resistance.
        const railR = SIM_CONSTANTS.ARDUINO_RAIL_RESISTANCE;
        sources.push({ compId: id, p: N('pin_5v'), n: N('pin_gnd'), v: 5, part: '5V', maxCurrent: 0.5, rInternal: railR });
        if (isWired(id, 'pin_3v3')) {
          sources.push({ compId: id, p: N('pin_3v3'), n: N('pin_gnd'), v: 3.3, part: '3V3', maxCurrent: 0.15, rInternal: railR });
        }
        if (isWired(id, 'pin_d13')) {
          elements.push({ kind: 'V', p: N('pin_d13'), n: N('pin_gnd'), v: 5, compId: id, part: 'D13', rInternal: SIM_CONSTANTS.ARDUINO_PIN_RESISTANCE });
        }
        break;
      }
      case 'resistor':
        elements.push({ kind: 'R', a: N('pin1'), b: N('pin2'), r: Math.max(1e-3, num(p.resistance, 220)), compId: id, part: 'main' });
        break;
      case 'potentiometer': {
        const total = Math.max(1, num(p.maxResistance ?? p.resistance, 10000));
        const pos = Math.min(1, Math.max(0, num(p.currentPosition ?? (comp.state?.value !== undefined ? comp.state.value / 100 : undefined), 0.5)));
        elements.push({ kind: 'R', a: N('pin1'), b: N('wiper'), r: Math.max(1e-3, total * pos), compId: id, part: 'pin1-wiper' });
        elements.push({ kind: 'R', a: N('wiper'), b: N('pin2'), r: Math.max(1e-3, total * (1 - pos)), compId: id, part: 'wiper-pin2' });
        break;
      }
      case 'ldr': {
        const dark = Math.max(1, num(p.darkResistance, 1e6));
        const light = Math.max(1, num(p.lightResistance, 400));
        const level = Math.min(100, Math.max(0, num(p.lightLevelPercent, 50))) / 100;
        const r = dark * Math.pow(light / dark, level);
        elements.push({ kind: 'R', a: N('pin1'), b: N('pin2'), r, compId: id, part: 'main' });
        break;
      }
      case 'switch': {
        const closed = switchStates[id] ?? comp.state?.open === false;
        if (closed) elements.push({ kind: 'R', a: N('pin1'), b: N('pin2'), r: SIM_CONSTANTS.CONTACT_RESISTANCE, compId: id, part: 'main' });
        break;
      }
      case 'pushbutton': {
        const pressed = switchStates[id] ?? Boolean(p.pressed);
        if (pressed) elements.push({ kind: 'R', a: N('pin1'), b: N('pin2'), r: SIM_CONSTANTS.CONTACT_RESISTANCE, compId: id, part: 'main' });
        break;
      }
      case 'connector':
        // Screw terminal block: two independent poles, no internal connection between pin1/pin2
        break;
      case 'led': {
        const vf = num(p.forwardVoltage, LED_VF_BY_COLOR[String(p.color || 'red').toLowerCase()] ?? 2.0);
        diodes.push({ compId: id, anode: N('anode'), cathode: N('cathode'), vf, rs: SIM_CONSTANTS.LED_SERIES_RESISTANCE, on: false });
        break;
      }
      case 'diode':
        diodes.push({
          compId: id,
          anode: N('anode'),
          cathode: N('cathode'),
          vf: num(p.forwardVoltage, SIM_CONSTANTS.DIODE_FORWARD_VOLTAGE),
          rs: SIM_CONSTANTS.DIODE_SERIES_RESISTANCE,
          on: false,
        });
        break;
      case 'buzzer':
        elements.push({ kind: 'R', a: N('pin_pos'), b: N('pin_neg'), r: SIM_CONSTANTS.BUZZER_EQUIVALENT_RESISTANCE, compId: id, part: 'main' });
        break;
      case 'capacitor':
        elements.push({ kind: 'R', a: N('pin_pos'), b: N('pin_neg'), r: SIM_CONSTANTS.OFF_RESISTANCE, compId: id, part: 'leakage' });
        break;
      case 'relay':
        elements.push({ kind: 'R', a: N('coil_pos'), b: N('coil_neg'), r: SIM_CONSTANTS.RELAY_COIL_RESISTANCE, compId: id, part: 'coil' });
        relays.push({ compId: id, coilPos: N('coil_pos'), coilNeg: N('coil_neg'), com: N('com'), no: N('no'), energized: false });
        break;
      case 'breadboard':
        break;
      default:
        unsupported.push(id);
    }
  }

  return { elements, diodes, relays, nodeOf, sources, unsupported };
}

// --------------------------------------------------------------------------------------
// Linear solver (Gaussian elimination with partial pivoting)
// --------------------------------------------------------------------------------------

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
  return M.map((row, i) => row[n] / row[i]);
}

interface SolveOutput {
  voltages: Map<string, number>; // node -> V (only for nodes in solved islands)
  elementCurrents: Map<Element, number>; // a->b for R, + -> - through the source for V (supply = negative)
  diodeCurrents: Map<DiodeModel, number>; // anode -> cathode
  sourceCurrents: Map<Netlist['sources'][number], number>; // current delivered out of + terminal
  singular: boolean;
}

function solveCircuit(net: Netlist): SolveOutput {
  // Expand all two-terminal parts into primitive R / V stamps (with internal nodes)
  type Prim = { kind: 'R'; a: string; b: string; r: number } | { kind: 'V'; p: string; n: string; v: number };
  const prims: Prim[] = [];
  const elementPrim = new Map<Element, Prim>();
  const diodePrim = new Map<DiodeModel, Prim>();
  const sourcePrim = new Map<Netlist['sources'][number], Prim>();

  const addVWithR = (p: string, n: string, v: number, r: number | undefined, tag: string): Prim => {
    if (r && r > 0) {
      const internal = `${tag}#int`;
      prims.push({ kind: 'R', a: p, b: internal, r });
      const vs: Prim = { kind: 'V', p: internal, n, v };
      prims.push(vs);
      return vs;
    }
    const vs: Prim = { kind: 'V', p, n, v };
    prims.push(vs);
    return vs;
  };

  for (const s of net.sources) sourcePrim.set(s, addVWithR(s.p, s.n, s.v, s.rInternal, `${s.compId}:${s.part}`));
  for (const el of net.elements) {
    if (el.kind === 'R') {
      const pr: Prim = { kind: 'R', a: el.a, b: el.b, r: el.r };
      prims.push(pr);
      elementPrim.set(el, pr);
    } else {
      elementPrim.set(el, addVWithR(el.p, el.n, el.v, el.rInternal, `${el.compId}:${el.part}`));
    }
  }
  for (const d of net.diodes) {
    if (d.on) {
      diodePrim.set(d, addVWithR(d.anode, d.cathode, d.vf, d.rs, `${d.compId}:diode`));
    } else {
      const pr: Prim = { kind: 'R', a: d.anode, b: d.cathode, r: SIM_CONSTANTS.OFF_RESISTANCE };
      prims.push(pr);
      diodePrim.set(d, pr);
    }
  }
  for (const rl of net.relays) {
    if (rl.energized) prims.push({ kind: 'R', a: rl.com, b: rl.no, r: SIM_CONSTANTS.CONTACT_RESISTANCE });
  }

  // Islands of nodes connected through elements
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  for (const pr of prims) pr.kind === 'R' ? link(pr.a, pr.b) : link(pr.p, pr.n);

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

  const out: SolveOutput = {
    voltages: new Map(),
    elementCurrents: new Map(),
    diodeCurrents: new Map(),
    sourceCurrents: new Map(),
    singular: false,
  };
  const primCurrent = new Map<Prim, number>();

  for (let isl = 0; isl < islandCount; isl++) {
    const islandPrims = prims.filter((pr) => islandOf.get(pr.kind === 'R' ? pr.a : pr.p) === isl);
    const vPrims = islandPrims.filter((pr): pr is Extract<Prim, { kind: 'V' }> => pr.kind === 'V');
    if (vPrims.length === 0) continue; // no excitation: no current, voltages undefined

    // Reference node: negative terminal of the first source in the island
    const ref = vPrims[0].n;
    const nodes = Array.from(islandOf.entries())
      .filter(([node, i]) => i === isl && node !== ref)
      .map(([node]) => node);
    const idx = new Map(nodes.map((nd, i) => [nd, i]));
    const n = nodes.length;
    const m = vPrims.length;
    const size = n + m;
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
      }
    }
    vPrims.forEach((pr, k) => {
      const row = n + k;
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
      if (pr.kind === 'R') {
        primCurrent.set(pr, ((out.voltages.get(pr.a) ?? 0) - (out.voltages.get(pr.b) ?? 0)) / pr.r);
      }
    }
    // MNA branch current = current entering the + terminal from the circuit (p -> n inside)
    vPrims.forEach((pr, k) => primCurrent.set(pr, x[n + k]));
  }

  for (const [el, pr] of elementPrim) {
    if (primCurrent.has(pr)) out.elementCurrents.set(el, primCurrent.get(pr)!);
  }
  for (const [d, pr] of diodePrim) {
    if (primCurrent.has(pr)) {
      const i = primCurrent.get(pr)!;
      // For the ON model the source current enters the anode-side terminal: anode->cathode = +i
      out.diodeCurrents.set(d, i);
    }
  }
  for (const [s, pr] of sourcePrim) {
    if (primCurrent.has(pr)) out.sourceCurrents.set(s, -primCurrent.get(pr)!);
  }
  return out;
}

// --------------------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------------------

function fmtCurrent(a: number): string {
  const abs = Math.abs(a);
  if (abs >= 1) return `${abs.toFixed(2)} A`;
  if (abs >= 1e-3) return `${(abs * 1000).toFixed(1)} mA`;
  if (abs >= 1e-6) return `${(abs * 1e6).toFixed(1)} µA`;
  return '0 mA';
}
const fmtVoltage = (v: number) => `${Math.abs(v).toFixed(2)} V`;

export function simulateBehavior(
  inputDoc: ProjectDocument,
  switchStates: Record<string, boolean> = {} // instanceId -> isClosed
): SimulationResult {
  const doc = toCanonicalDocument(inputDoc);
  const compStates: Record<string, ComponentSimulationState> = {};
  for (const c of inputDoc.components) {
    compStates[c.instanceId] = { isPowered: false, isOn: false, stateLabel: 'Chưa có điện' };
  }

  const hasPowerSource = doc.components.some((c) => c.definitionId === 'dc-source' || c.definitionId === 'arduino-uno');
  if (!hasPowerSource) {
    return {
      status: 'stopped',
      revision: inputDoc.revision,
      components: compStates,
      summary: 'Mô phỏng dừng: Chưa có nguồn điện (Nguồn DC hoặc Arduino UNO) trên mạch.',
      isClosedLoop: false,
      issues: ['Chưa có nguồn điện DC hoặc Bo Arduino.'],
      timestamp: Date.now(),
      solver: 'mna-dc',
      unsupportedComponents: [],
    };
  }

  const net = buildNetlist(doc, switchStates);
  const issues: string[] = [];

  for (const id of net.unsupported) {
    compStates[id] = {
      isPowered: false,
      isOn: false,
      stateLabel: 'Chưa hỗ trợ mô phỏng điện',
      note: 'Linh kiện này hiện chỉ được hiển thị và lắp ráp 3D; động cơ mô phỏng DC chưa có mô hình điện cho nó nên không tính dòng/áp.',
    };
  }

  // Direct short: a source whose terminals are on the same node (a plain wire across it)
  const directShort = net.sources.find((s) => s.p === s.n);
  if (directShort) {
    compStates[directShort.compId] = {
      isPowered: true,
      isOn: false,
      stateLabel: 'ĐOẢN MẠCH! Bảo vệ quá dòng kích hoạt',
      note: 'Cực dương và cực âm của nguồn được nối trực tiếp với nhau (điện trở ≈ 0 Ω).',
    };
    return {
      status: 'error',
      revision: inputDoc.revision,
      components: compStates,
      summary: 'LỖI NGUY HIỂM: Đoản mạch (ngắn mạch) trực tiếp giữa cực dương và cực âm của nguồn!',
      isClosedLoop: true,
      issues: ['Đoản mạch (ngắn mạch): VCC chạm trực tiếp GND.'],
      timestamp: Date.now(),
      solver: 'mna-dc',
      unsupportedComponents: net.unsupported,
    };
  }

  // Iterate piecewise-linear device states until consistent
  let result = solveCircuit(net);
  let converged = false;
  for (let iter = 0; iter < SIM_CONSTANTS.MAX_ITERATIONS; iter++) {
    let changed = false;
    for (const d of net.diodes) {
      if (d.on) {
        const i = result.diodeCurrents.get(d) ?? 0;
        if (i <= 0) {
          d.on = false;
          changed = true;
        }
      } else {
        const va = result.voltages.get(d.anode);
        const vc = result.voltages.get(d.cathode);
        if (va !== undefined && vc !== undefined && va - vc > d.vf) {
          d.on = true;
          changed = true;
        }
      }
    }
    for (const rl of net.relays) {
      const coil = net.elements.find((e) => e.compId === rl.compId && e.part === 'coil');
      const i = coil ? Math.abs(result.elementCurrents.get(coil) ?? 0) : 0;
      const shouldEnergize = i >= SIM_CONSTANTS.RELAY_PICKUP_CURRENT;
      if (shouldEnergize !== rl.energized) {
        rl.energized = shouldEnergize;
        changed = true;
      }
    }
    if (!changed) {
      converged = true;
      break;
    }
    result = solveCircuit(net);
  }

  if (result.singular) {
    issues.push('Không giải được mạch: có các nguồn áp mắc song song/xung đột hoặc vòng chỉ gồm nguồn áp. Hãy kiểm tra lại cách nối nguồn.');
  }
  if (!converged) {
    issues.push('Bộ giải chưa hội tụ trạng thái LED/diode/rơ-le sau nhiều vòng lặp; kết quả có thể chưa chính xác.');
  }

  // ---------------- Per-component reporting ----------------
  const V = (node: string) => result.voltages.get(node);
  let totalSupply = 0;
  let shortDetected = false;
  let overCurrent = false;

  // Group sources per component (Arduino exposes several rails)
  for (const s of net.sources) {
    const i = result.sourceCurrents.get(s);
    if (i === undefined) continue;
    if (i > SIM_CONSTANTS.CONDUCTING_CURRENT) totalSupply += i;
    const loadR = Math.abs(i) > 1e-12 ? s.v / Math.abs(i) : Infinity;
    const prev = compStates[s.compId];
    const prevCurrent = prev?.currentA ?? 0;
    const current = Math.abs(i) + (prev?.isPowered ? prevCurrent : 0);
    if (Math.abs(i) > s.maxCurrent) {
      if (loadR < SIM_CONSTANTS.SHORT_CIRCUIT_RESISTANCE) {
        shortDetected = true;
        issues.push(`Đoản mạch (ngắn mạch) tại nguồn ${s.part === 'main' ? '' : s.part + ' '}: tải chỉ ≈ ${loadR.toFixed(3)} Ω, dòng ${fmtCurrent(i)}.`);
      } else {
        overCurrent = true;
        issues.push(`Nguồn ${s.part === 'main' ? '' : s.part + ' '}quá dòng: ${fmtCurrent(i)} vượt giới hạn ${fmtCurrent(s.maxCurrent)}.`);
      }
    }
    compStates[s.compId] = {
      isPowered: true,
      isOn: current > SIM_CONSTANTS.CONDUCTING_CURRENT,
      stateLabel: current > SIM_CONSTANTS.CONDUCTING_CURRENT ? `Đang cấp nguồn ${s.v.toFixed(1)}V` : `Sẵn sàng ${s.v.toFixed(1)}V (chưa có tải)`,
      currentEstimate: fmtCurrent(current),
      voltageDrop: fmtVoltage(s.v),
      currentA: current,
      voltageV: s.v,
      note:
        doc.components.find((c) => c.instanceId === s.compId)?.definitionId === 'arduino-uno'
          ? 'Arduino: chỉ mô phỏng các chân nguồn (5V/3.3V/GND) và giả định D13 ở mức HIGH; chương trình (sketch) không được thực thi.'
          : undefined,
    };
  }

  for (const el of net.elements) {
    if (el.kind === 'V') {
      // Arduino D13 output
      const i = result.elementCurrents.get(el);
      if (i !== undefined && compStates[el.compId]) {
        const supply = -i;
        if (supply > SIM_CONSTANTS.CONDUCTING_CURRENT) {
          totalSupply += supply;
          const st = compStates[el.compId];
          const total = (st.currentA ?? 0) + supply;
          st.currentA = total;
          st.currentEstimate = fmtCurrent(total);
          st.isPowered = true;
          st.isOn = true;
          st.stateLabel = `Đang cấp nguồn (chân ${el.part} mức HIGH: ${fmtCurrent(supply)})`;
        }
        if (supply > 0.04) {
          overCurrent = true;
          issues.push(`Chân ${el.part} của Arduino xuất ${fmtCurrent(supply)}, vượt mức tối đa 40 mA của ATmega328P.`);
        }
      }
      continue;
    }
    const comp = doc.components.find((c) => c.instanceId === el.compId)!;
    const i = result.elementCurrents.get(el);
    const va = V(el.a);
    const vb = V(el.b);
    if (i === undefined || va === undefined || vb === undefined) continue;
    const absI = Math.abs(i);
    const drop = va - vb;
    const conducting = absI > SIM_CONSTANTS.CONDUCTING_CURRENT;
    const existing = compStates[el.compId];
    // Potentiometer has two segments: report the larger current
    if (existing?.currentA !== undefined && existing.currentA > absI) continue;

    let stateLabel = conducting ? `Dẫn dòng ${fmtCurrent(absI)}` : 'Không có dòng điện';
    let isOn = conducting;
    let note: string | undefined;
    switch (comp.definitionId) {
      case 'resistor': {
        const ohms = el.r;
        const power = absI * absI * ohms;
        stateLabel = conducting ? `Đang hạn dòng (${ohms} Ω)` : `Không có dòng (${ohms} Ω)`;
        const rating = num(comp.parameters?.powerRating, 0.25);
        if (power > rating) {
          overCurrent = true;
          issues.push(`Điện trở ${comp.name} tiêu tán ${power.toFixed(2)} W, vượt công suất định mức ${rating} W.`);
          note = 'Quá công suất định mức – điện trở có thể quá nhiệt.';
        }
        break;
      }
      case 'switch':
      case 'pushbutton':
        stateLabel = conducting ? 'ĐÓNG (Tiếp điểm dẫn dòng)' : 'ĐÓNG (Chưa có dòng qua)';
        break;
      case 'buzzer': {
        const on = drop >= SIM_CONSTANTS.BUZZER_MIN_VOLTAGE && i > 0;
        isOn = on;
        stateLabel = on ? 'ĐANG KÊU (đủ áp phân cực thuận)' : drop < 0 ? 'KHÔNG KÊU (phân cực ngược)' : 'KHÔNG KÊU (chưa đủ áp)';
        note = 'Mô hình gần đúng: còi chủ động được coi là tải điện trở tương đương ~170 Ω.';
        break;
      }
      case 'capacitor':
        isOn = false;
        stateLabel = `Đã nạp ${fmtVoltage(drop)} (DC xác lập: hở mạch)`;
        note = 'Ở trạng thái DC xác lập tụ điện không cho dòng một chiều đi qua.';
        break;
      case 'relay':
        break;
      default:
        break;
    }
    compStates[el.compId] = {
      isPowered: conducting || Math.abs(drop) > 0.01,
      isOn,
      stateLabel,
      currentEstimate: comp.definitionId === 'capacitor' ? '0 mA' : fmtCurrent(absI),
      voltageDrop: fmtVoltage(drop),
      currentA: comp.definitionId === 'capacitor' ? 0 : absI,
      voltageV: Math.abs(drop),
      note,
    };
  }

  for (const rl of net.relays) {
    const st = compStates[rl.compId];
    if (!st) continue;
    st.isOn = rl.energized;
    st.stateLabel = rl.energized ? 'KÍCH HOẠT (Tiếp điểm COM–NO đóng)' : 'Chưa kích hoạt (dòng cuộn hút chưa đủ)';
  }

  for (const d of net.diodes) {
    const comp = doc.components.find((c) => c.instanceId === d.compId)!;
    const isLed = comp.definitionId === 'led';
    const i = d.on ? result.diodeCurrents.get(d) ?? 0 : 0;
    const va = V(d.anode);
    const vc = V(d.cathode);
    const drop = va !== undefined && vc !== undefined ? va - vc : undefined;
    const reverse = drop !== undefined && drop < -0.5;
    let stateLabel: string;
    let note: string | undefined;
    if (d.on) {
      stateLabel = isLed
        ? i >= SIM_CONSTANTS.LED_DIM_CURRENT
          ? 'SÁNG (Dẫn dòng phân cực thuận)'
          : i >= SIM_CONSTANTS.LED_VISIBLE_CURRENT
          ? 'SÁNG MỜ (dòng nhỏ)'
          : 'GẦN NHƯ KHÔNG SÁNG (dòng quá nhỏ)'
        : `DẪN THUẬN (Sụt áp ~${d.vf} V)`;
    } else if (reverse) {
      stateLabel = isLed ? 'KHÔNG SÁNG (Phân cực ngược)' : 'KHÓA (Diode phân cực ngược)';
      note = isLed
        ? 'Điện áp dương đặt vào chân Cathode bị LED chặn lại.'
        : 'Diode chặn dòng điện chạy từ Cathode sang Anode.';
    } else {
      stateLabel = isLed ? 'KHÔNG SÁNG (chưa đủ áp thuận)' : 'Không dẫn (chưa đủ áp thuận)';
    }
    if (isLed) {
      const maxA = num(comp.parameters?.maxCurrent, 20) / 1000;
      if (i > maxA) {
        overCurrent = true;
        issues.push(`LED ${comp.name} dẫn ${fmtCurrent(i)}, vượt dòng định mức ${fmtCurrent(maxA)} – có nguy cơ cháy LED. Hãy thêm/tăng điện trở hạn dòng.`);
        note = 'Quá dòng định mức – LED có nguy cơ cháy.';
      }
    }
    compStates[d.compId] = {
      isPowered: drop !== undefined && Math.abs(drop) > 0.01,
      isOn: isLed ? d.on && i >= SIM_CONSTANTS.LED_VISIBLE_CURRENT : d.on,
      stateLabel,
      currentEstimate: fmtCurrent(i),
      voltageDrop: drop !== undefined ? fmtVoltage(drop) : undefined,
      currentA: i,
      voltageV: drop !== undefined ? Math.abs(drop) : undefined,
      note,
    };
  }

  const closedLoop = totalSupply > SIM_CONSTANTS.CONDUCTING_CURRENT;
  const unsupportedNote =
    net.unsupported.length > 0
      ? ` ${net.unsupported.length} linh kiện chưa có mô hình điện và không được tính vào kết quả.`
      : '';

  let status: SimulationResult['status'];
  let summary: string;
  if (shortDetected) {
    status = 'error';
    summary = 'LỖI NGUY HIỂM: Đoản mạch (ngắn mạch) – dòng điện vượt xa giới hạn của nguồn!';
  } else if (result.singular && !closedLoop) {
    status = 'error';
    summary = 'Không thể giải mạch: cấu trúc nguồn áp không xác định.' + unsupportedNote;
  } else if (closedLoop) {
    status = 'running';
    summary =
      (overCurrent
        ? `Mạch kín nhưng có linh kiện quá dòng/quá công suất. Tổng dòng cấp: ${fmtCurrent(totalSupply)}.`
        : `Mạch điện hoạt động: vòng kín từ cực dương qua tải về GND, tổng dòng cấp ${fmtCurrent(totalSupply)}.`) +
      unsupportedNote;
  } else {
    status = 'stopped';
    summary = 'Mạch hở: Chưa tìm thấy vòng khép kín hoàn chỉnh từ cực dương VCC về cực âm GND.' + unsupportedNote;
    issues.push('Mạch hở, chưa nối đủ dây về GND hoặc công tắc đang mở.');
  }

  return {
    status,
    revision: inputDoc.revision,
    components: compStates,
    summary,
    isClosedLoop: closedLoop || shortDetected,
    issues,
    timestamp: Date.now(),
    solver: 'mna-dc',
    unsupportedComponents: net.unsupported,
    nodeVoltages: Object.fromEntries(result.voltages),
  };
}
