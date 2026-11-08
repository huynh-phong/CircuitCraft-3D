import { ComponentInstance, Connection, ProjectDocument } from '../project/types';
import { COMPONENT_DEFINITION_MAP } from './definitions';

/**
 * CircuitCraft 3D - Canonical component schema & legacy ID mapping.
 *
 * The canonical (official) schema is the one in `definitions.ts`
 * (e.g. `dc-source` with pins `vcc`/`gnd`, `resistor` with `pin1`/`pin2`).
 * Older documents, marketplace snapshots and AI output use other spellings
 * (`dc_power_supply`/`pin_pos`, `switch_spst`/`pin_1`, `resistor_axial`, ...).
 *
 * These helpers resolve legacy IDs to canonical ones for electrical analysis, AI context and
 * validation WITHOUT rewriting stored user data: rendering keeps using the stored ids
 * (alias definitions are registered in COMPONENT_DEFINITION_MAP for that purpose).
 */

export const DEFINITION_ALIASES: Record<string, string> = {
  dc_source: 'dc-source',
  dc_power_supply: 'dc-source',
  'dc-power-supply': 'dc-source',
  power_supply: 'dc-source',
  battery: 'dc-source',
  terminal_block_2pin: 'dc-source',
  resistor_axial: 'resistor',
  led_basic: 'led',
  switch_spst: 'switch',
  'switch-spst': 'switch',
  push_button: 'pushbutton',
  arduino_uno: 'arduino-uno',
  logic_and: 'logic-and',
  temp_sensor: 'temp-sensor',
  // Older duplicate definitions of the same physical part
  'servo-motor': 'servo-sg90',
  'ultrasonic-sensor': 'ultrasonic-sr04',
};

const ARDUINO_PIN_ALIASES: Record<string, string> = (() => {
  const map: Record<string, string> = {
    '5v': 'pin_5v', '3v3': 'pin_3v3', '3.3v': 'pin_3v3', vin: 'pin_vin',
    gnd: 'pin_gnd', gnd1: 'pin_gnd', gnd2: 'pin_gnd2', gnd3: 'pin_gnd_top',
    ioref: 'pin_ioref', reset: 'pin_reset', aref: 'pin_aref', sda: 'pin_sda', scl: 'pin_scl',
  };
  for (let i = 0; i <= 13; i++) map[`d${i}`] = `pin_d${i}`;
  for (let i = 0; i <= 5; i++) map[`a${i}`] = `pin_a${i}`;
  return map;
})();

/** Legacy pin spellings per CANONICAL definition id. */
export const PIN_ALIASES: Record<string, Record<string, string>> = {
  'dc-source': { pin_pos: 'vcc', pin_neg: 'gnd', pin_1: 'vcc', pin_2: 'gnd', pin1: 'vcc', pin2: 'gnd', pos: 'vcc', neg: 'gnd', '+': 'vcc', '-': 'gnd', positive: 'vcc', negative: 'gnd' },
  resistor: { pin_1: 'pin1', pin_2: 'pin2', p1: 'pin1', p2: 'pin2', a: 'pin1', b: 'pin2' },
  led: { pin_anode: 'anode', pin_cathode: 'cathode', a: 'anode', k: 'cathode', pin_1: 'anode', pin_2: 'cathode', '+': 'anode', '-': 'cathode' },
  diode: { pin_anode: 'anode', pin_cathode: 'cathode', a: 'anode', k: 'cathode' },
  switch: { pin_1: 'pin1', pin_2: 'pin2', p1: 'pin1', p2: 'pin2' },
  pushbutton: { pin_1: 'pin1', pin_2: 'pin2', p1: 'pin1', p2: 'pin2' },
  connector: { pin_1: 'pin1', pin_2: 'pin2', p1: 'pin1', p2: 'pin2' },
  ldr: { pin_1: 'pin1', pin_2: 'pin2', p1: 'pin1', p2: 'pin2' },
  potentiometer: { pin_1: 'pin1', pin_2: 'pin2', pin_wiper: 'wiper', w: 'wiper' },
  capacitor: { pin1: 'pin_pos', pin2: 'pin_neg', pin_1: 'pin_pos', pin_2: 'pin_neg', '+': 'pin_pos', '-': 'pin_neg', anode: 'pin_pos', cathode: 'pin_neg', pos: 'pin_pos', neg: 'pin_neg' },
  buzzer: { pin1: 'pin_pos', pin2: 'pin_neg', pin_1: 'pin_pos', pin_2: 'pin_neg', '+': 'pin_pos', '-': 'pin_neg', pos: 'pin_pos', neg: 'pin_neg' },
  'arduino-uno': ARDUINO_PIN_ALIASES,
  ne555: { trigger: 'trig', output: 'out', threshold: 'thr', discharge: 'dis', control: 'ctrl', cv: 'ctrl', rst: 'reset' },
  relay: { 'coil+': 'coil_pos', 'coil-': 'coil_neg', in: 'coil_pos' },
  'servo-sg90': { signal: 'pwm', sig: 'pwm' },
  'voltage-reg-7805': { in: 'vin', input: 'vin', out: 'vout', output: 'vout' },
  'temp-sensor': { out: 'vout', '+vs': 'vcc', vs: 'vcc' },
  'dc-motor': { pin1: 'pos', pin2: 'neg', 'm+': 'pos', 'm-': 'neg' },
  'transistor-npn': { c: 'collector', b: 'base', e: 'emitter' },
};

export function resolveDefinitionId(definitionId: string): string {
  if (!definitionId) return definitionId;
  return DEFINITION_ALIASES[definitionId] || definitionId;
}

/** Resolves a pin id for a (possibly legacy) definition to the canonical pin id. */
export function resolvePinId(definitionId: string, pinId: string): string {
  const canonical = resolveDefinitionId(definitionId);
  const def = COMPONENT_DEFINITION_MAP.get(canonical);
  if (def && def.pins.some((p) => p.id === pinId)) return pinId;
  return PIN_ALIASES[canonical]?.[pinId] || PIN_ALIASES[canonical]?.[pinId.toLowerCase()] || pinId;
}

/** True when the definition (canonical or alias) exists in the component library. */
export function isKnownDefinition(definitionId: string): boolean {
  return COMPONENT_DEFINITION_MAP.has(definitionId) || COMPONENT_DEFINITION_MAP.has(resolveDefinitionId(definitionId));
}

/** True when `pinId` (canonical or legacy spelling) exists on the definition. */
export function isKnownPin(definitionId: string, pinId: string): boolean {
  if (!pinId) return false;
  const stored = COMPONENT_DEFINITION_MAP.get(definitionId);
  if (stored?.pins.some((p) => p.id === pinId)) return true;
  const canonicalDef = COMPONENT_DEFINITION_MAP.get(resolveDefinitionId(definitionId));
  if (!canonicalDef) return false;
  const canonicalPin = resolvePinId(definitionId, pinId);
  return canonicalDef.pins.some((p) => p.id === canonicalPin);
}

/**
 * Returns a derived, canonical copy of a project for electrical analysis.
 * The input document is never mutated; ids of instances and connections are preserved.
 */
export function toCanonicalDocument(doc: ProjectDocument): ProjectDocument {
  const byId = new Map<string, ComponentInstance>();
  const components = doc.components.map((c) => {
    const canonical: ComponentInstance = { ...c, definitionId: resolveDefinitionId(c.definitionId) };
    byId.set(c.instanceId, c);
    return canonical;
  });
  const connections: Connection[] = doc.connections.map((conn) => {
    const from = byId.get(conn.fromComponentId);
    const to = byId.get(conn.toComponentId);
    return {
      ...conn,
      fromPinId: from ? resolvePinId(from.definitionId, conn.fromPinId) : conn.fromPinId,
      toPinId: to ? resolvePinId(to.definitionId, conn.toPinId) : conn.toPinId,
    };
  });
  return { ...doc, components, connections };
}
