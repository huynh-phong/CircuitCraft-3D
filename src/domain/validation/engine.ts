import { ValidationIssue } from './types';
import { ProjectDocument } from '../project/types';
import { isInsideBoard } from '../project/coordinates';
import { COMPONENT_DEFINITION_MAP } from '../components/definitions';
import { isKnownDefinition, isKnownPin, toCanonicalDocument } from '../components/aliases';
import { buildConnectivity, computeBreadboardPlugs, simulateBehavior } from '../simulation/engine';

/** Supply pins that must be wired before an IC / module can work. */
const SUPPLY_PINS: Record<string, string[]> = {
  ne555: ['vcc', 'gnd'],
  'logic-and': ['vcc', 'gnd'],
  'temp-sensor': ['vcc', 'gnd'],
  'voltage-reg-7805': ['vin', 'gnd'],
  'servo-sg90': ['vcc', 'gnd'],
  'oled-i2c': ['vcc', 'gnd'],
  'ultrasonic-sr04': ['vcc', 'gnd'],
};

function hashText(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function validateProjectDocument(inputDoc: ProjectDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // Legacy component / pin ids are resolved to the canonical schema for analysis only
  // (instance and connection ids are preserved, the stored document is not modified).
  const doc = toCanonicalDocument(inputDoc);
  const { board, components, connections } = doc;

  if (components.length === 0) {
    issues.push({
      id: 'empty-board',
      ruleId: 'EMPTY_DESIGN',
      severity: 'info',
      message: 'Bo mạch chưa có linh kiện nào. Hãy kéo linh kiện từ thư viện bên trái vào bo mạch.',
      objectRefs: [],
      suggestion: 'Thêm Nguồn DC, Điện trở và LED để tạo mạch thử nghiệm đầu tiên.',
    });
    return issues;
  }

  // 1. Board Boundary Check
  const breadboards = components.filter((c) => c.definitionId === 'breadboard');

  for (const comp of components) {
    // If component is resting on or plugged into a breadboard, or is a large board entity, allow workspace placement
    const isOnBreadboard = breadboards.some((bb) => {
      const dx = Math.abs(comp.position.x - bb.position.x);
      const dz = Math.abs(comp.position.z - bb.position.z);
      return dx <= 165 / 2 && dz <= 55 / 2;
    });

    if (
      !isOnBreadboard &&
      comp.definitionId !== 'breadboard' &&
      comp.definitionId !== 'arduino-uno' &&
      comp.definitionId !== 'arduino_uno'
    ) {
      if (!isInsideBoard(comp.position, board.width, board.depth, 4)) {
        issues.push({
          id: `out-of-bounds-${comp.instanceId}`,
          ruleId: 'OUT_OF_BOARD_BOUNDS',
          severity: 'error',
          message: `Linh kiện ${comp.name} nằm ngoài phạm vi giới hạn của bo mạch PCB (${board.width}x${board.depth} mm).`,
          objectRefs: [comp.instanceId],
          suggestion: 'Kéo linh kiện vào khu vực mặt đồng bên trong bo mạch hoặc cắm lên Breadboard.',
        });
      }
    }
  }

  // 2. Component Collision / Overlap Check
  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const c1 = components[i];
      const c2 = components[j];
      // Do not treat breadboard itself as colliding with components placed on top of it
      if (c1.definitionId === 'breadboard' || c2.definitionId === 'breadboard') continue;

      const dx = c1.position.x - c2.position.x;
      const dz = c1.position.z - c2.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      // Min clearance 7mm
      if (dist < 7.0) {
        issues.push({
          id: `collision-${c1.instanceId}-${c2.instanceId}`,
          ruleId: 'COMPONENT_COLLISION',
          severity: 'warning',
          message: `Linh kiện ${c1.name} và ${c2.name} đang bị đặt đè lên nhau (khoảng cách: ${dist.toFixed(1)}mm).`,
          objectRefs: [c1.instanceId, c2.instanceId],
          suggestion: 'Di chuyển một trong hai linh kiện để tránh chập chân cơ khí.',
        });
      }
    }
  }

  // 3. Power Source Presence
  const powerSources = components.filter(
    (c) => c.definitionId === 'dc-source' || c.definitionId === 'arduino-uno' || c.definitionId === 'arduino_uno'
  );
  if (powerSources.length === 0) {
    issues.push({
      id: 'no-power-source',
      ruleId: 'NO_POWER_SOURCE',
      severity: 'warning',
      message: 'Mạch điện chưa có nguồn cấp DC. Các linh kiện sẽ không nhận được điện áp.',
      objectRefs: [],
      suggestion: 'Kéo một "Nguồn DC (Pin/Power)" từ thư viện vào bo mạch.',
    });
  }

  // 4. Pin Connectivity & Dangling Pins
  const pinConnectedMap = new Map<string, number>();
  // Pins resting in breadboard holes are electrically connected (same rule as the simulator)
  for (const conn of [...connections, ...computeBreadboardPlugs(doc)]) {
    const fromKey = `${conn.fromComponentId}:${conn.fromPinId}`;
    const toKey = `${conn.toComponentId}:${conn.toPinId}`;
    pinConnectedMap.set(fromKey, (pinConnectedMap.get(fromKey) || 0) + 1);
    pinConnectedMap.set(toKey, (pinConnectedMap.get(toKey) || 0) + 1);
  }

  for (const comp of components) {
    const def = COMPONENT_DEFINITION_MAP.get(comp.definitionId);
    if (!def) continue;

    let unconnectedPinsCount = 0;
    for (const pin of def.pins) {
      const key = `${comp.instanceId}:${pin.id}`;
      const count = pinConnectedMap.get(key) || 0;
      if (count === 0) {
        unconnectedPinsCount++;
      }
    }

    if (unconnectedPinsCount === def.pins.length && def.pins.length > 0) {
      issues.push({
        id: `dangling-${comp.instanceId}`,
        ruleId: 'UNCONNECTED_COMPONENT',
        severity: 'info',
        message: `Linh kiện ${comp.name} chưa được nối bất kỳ chân nào vào mạch.`,
        objectRefs: [comp.instanceId],
        suggestion: 'Dùng công cụ Nối Dây (Wiring) để kết nối các chân của linh kiện.',
      });
    }
  }

  // 5. Wires must end on pins that exist on the component (legacy spellings are accepted)
  const storedById = new Map(inputDoc.components.map((c) => [c.instanceId, c]));
  for (const conn of inputDoc.connections) {
    for (const [compId, pinId] of [
      [conn.fromComponentId, conn.fromPinId],
      [conn.toComponentId, conn.toPinId],
    ] as const) {
      const inst = storedById.get(compId);
      if (inst && isKnownDefinition(inst.definitionId) && !isKnownPin(inst.definitionId, pinId)) {
        issues.push({
          id: `invalid-pin-${conn.id}-${compId}-${pinId}`,
          ruleId: 'INVALID_PIN',
          severity: 'error',
          message: `Dây ${conn.id} nối vào chân "${pinId}" không tồn tại trên ${inst.name}.`,
          objectRefs: [conn.id, compId],
          suggestion: 'Xóa dây này và nối lại vào một chân có thật của linh kiện.',
        });
      }
    }
  }

  // 6. ICs and modules that are wired but have no supply connected
  const conn = buildConnectivity(doc);
  for (const comp of components) {
    const supply = SUPPLY_PINS[comp.definitionId];
    if (!supply) continue;
    const def = COMPONENT_DEFINITION_MAP.get(comp.definitionId);
    const anyWired = def?.pins.some((p) => conn.isConnected(comp.instanceId, p.id));
    const missing = supply.filter((pin) => !conn.isConnected(comp.instanceId, pin));
    if (anyWired && missing.length > 0) {
      issues.push({
        id: `missing-power-${comp.instanceId}`,
        ruleId: 'MISSING_POWER',
        severity: 'warning',
        message: `${comp.name} chưa nối chân nguồn ${missing.map((m) => m.toUpperCase()).join(', ')} nên sẽ không hoạt động.`,
        objectRefs: [comp.instanceId],
        suggestion: 'Nối chân VCC lên nguồn dương và chân GND về mass chung của mạch.',
      });
    }
  }

  // 7. Electrical rules come from the solver itself (short circuits through any path, LED and
  //    pin over-current, over-power, over-voltage, reverse polarity, floating CMOS inputs,
  //    regulator dropout...), so the DRC can never contradict the simulation result.
  if (powerSources.length > 0) {
    const sim = simulateBehavior(inputDoc);
    for (const d of sim.diagnostics || []) {
      issues.push({
        id: `${d.ruleId.toLowerCase()}-${d.objectRefs.join('-')}-${hashText(d.message)}`,
        ruleId: d.ruleId,
        severity: d.severity,
        message: d.message,
        objectRefs: d.objectRefs,
        suggestion: d.suggestion,
      });
    }
  }

  return issues;
}
