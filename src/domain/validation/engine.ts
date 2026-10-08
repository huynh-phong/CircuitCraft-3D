import { ValidationIssue } from './types';
import { ProjectDocument } from '../project/types';
import { isInsideBoard } from '../project/coordinates';
import { COMPONENT_DEFINITION_MAP } from '../components/definitions';

export function validateProjectDocument(doc: ProjectDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
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
  for (const comp of components) {
    if (!isInsideBoard(comp.position, board.width, board.depth, 4)) {
      issues.push({
        id: `out-of-bounds-${comp.instanceId}`,
        ruleId: 'OUT_OF_BOARD_BOUNDS',
        severity: 'error',
        message: `Linh kiện ${comp.name} nằm ngoài phạm vi giới hạn của bo mạch PCB (${board.width}x${board.depth} mm).`,
        objectRefs: [comp.instanceId],
        suggestion: 'Kéo linh kiện vào khu vực mặt đồng bên trong bo mạch.',
      });
    }
  }

  // 2. Component Collision / Overlap Check
  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const c1 = components[i];
      const c2 = components[j];
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
  const powerSources = components.filter((c) => c.definitionId === 'dc-source');
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
  for (const conn of connections) {
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

  // 5. Direct Short Circuit Detection (VCC directly connected to GND)
  const powerSource = powerSources[0];
  if (powerSource) {
    const vccConns = connections.filter(
      (c) =>
        (c.fromComponentId === powerSource.instanceId && c.fromPinId === 'vcc') ||
        (c.toComponentId === powerSource.instanceId && c.toPinId === 'vcc')
    );

    for (const vc of vccConns) {
      const isDirectToGnd =
        (vc.fromComponentId === powerSource.instanceId &&
          vc.fromPinId === 'vcc' &&
          vc.toComponentId === powerSource.instanceId &&
          vc.toPinId === 'gnd') ||
        (vc.fromComponentId === powerSource.instanceId &&
          vc.fromPinId === 'gnd' &&
          vc.toComponentId === powerSource.instanceId &&
          vc.toPinId === 'vcc');

      if (isDirectToGnd) {
        issues.push({
          id: `short-circuit-${powerSource.instanceId}`,
          ruleId: 'SHORT_CIRCUIT',
          severity: 'error',
          message: `NGUY HIỂM: Chân VCC (+) đang bị nối tắt trực tiếp vào chân GND (-) của nguồn ${powerSource.name}!`,
          objectRefs: [powerSource.instanceId, vc.id],
          suggestion: 'Xóa dây nối tắt này ngay lập tức để tránh làm hỏng nguồn điện.',
        });
      }
    }
  }

  // 6. LED Missing Current Limiting Resistor Check
  const leds = components.filter((c) => c.definitionId === 'led');
  for (const led of leds) {
    // Check if LED anode is directly wired to VCC and cathode directly to GND with 0 resistor
    const anodeConns = connections.filter(
      (c) =>
        (c.fromComponentId === led.instanceId && c.fromPinId === 'anode') ||
        (c.toComponentId === led.instanceId && c.toPinId === 'anode')
    );
    const cathodeConns = connections.filter(
      (c) =>
        (c.fromComponentId === led.instanceId && c.fromPinId === 'cathode') ||
        (c.toComponentId === led.instanceId && c.toPinId === 'cathode')
    );

    const directlyToVcc = anodeConns.some((c) => {
      const otherCompId = c.fromComponentId === led.instanceId ? c.toComponentId : c.fromComponentId;
      const otherPin = c.fromComponentId === led.instanceId ? c.toPinId : c.fromPinId;
      const other = components.find((x) => x.instanceId === otherCompId);
      return other?.definitionId === 'dc-source' && otherPin === 'vcc';
    });

    const directlyToGnd = cathodeConns.some((c) => {
      const otherCompId = c.fromComponentId === led.instanceId ? c.toComponentId : c.fromComponentId;
      const otherPin = c.fromComponentId === led.instanceId ? c.toPinId : c.fromPinId;
      const other = components.find((x) => x.instanceId === otherCompId);
      return other?.definitionId === 'dc-source' && otherPin === 'gnd';
    });

    if (directlyToVcc && directlyToGnd) {
      issues.push({
        id: `led-no-resistor-${led.instanceId}`,
        ruleId: 'LED_OVERCURRENT_RISK',
        severity: 'warning',
        message: `CẢNH BÁO: Đèn ${led.name} được nối thẳng vào nguồn điện mà không có điện trở hạn dòng (Series Resistor).`,
        objectRefs: [led.instanceId],
        suggestion: 'Mắc nối tiếp một điện trở 220Ω hoặc 330Ω giữa VCC và chân Anode của LED để bảo vệ LED.',
      });
    }

    // Check Reverse Polarity (Anode connected to GND, Cathode connected to VCC)
    const reversedAnodeToGnd = anodeConns.some((c) => {
      const otherCompId = c.fromComponentId === led.instanceId ? c.toComponentId : c.fromComponentId;
      const otherPin = c.fromComponentId === led.instanceId ? c.toPinId : c.fromPinId;
      const other = components.find((x) => x.instanceId === otherCompId);
      return other?.definitionId === 'dc-source' && otherPin === 'gnd';
    });

    const reversedCathodeToVcc = cathodeConns.some((c) => {
      const otherCompId = c.fromComponentId === led.instanceId ? c.toComponentId : c.fromComponentId;
      const otherPin = c.fromComponentId === led.instanceId ? c.toPinId : c.fromPinId;
      const other = components.find((x) => x.instanceId === otherCompId);
      return other?.definitionId === 'dc-source' && otherPin === 'vcc';
    });

    if (reversedAnodeToGnd || reversedCathodeToVcc) {
      issues.push({
        id: `led-reverse-polarity-${led.instanceId}`,
        ruleId: 'REVERSE_POLARITY',
        severity: 'warning',
        message: `Đèn ${led.name} có thể đang bị mắc ngược cực (Anode nối mass hoặc Cathode nối nguồn dương).`,
        objectRefs: [led.instanceId],
        suggestion: 'Đảo lại chân: Chân Anode (+) phải hướng về cực dương, Cathode (-) hướng về mass.',
      });
    }
  }

  return issues;
}
