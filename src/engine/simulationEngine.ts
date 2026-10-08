import { ProjectDocument, SimulationResult, ComponentSimState } from '../types/circuit.ts';

export class SimulationEngine {
  public static simulate(doc: ProjectDocument, isRunning: boolean): SimulationResult {
    if (!isRunning) {
      return {
        state: 'stopped',
        timestamp: Date.now(),
        message: 'Mô phỏng đang tạm dừng.',
        supportedTopology: true,
        componentStates: {},
        circuitFlow: {
          isClosedLoop: false,
          currentFlowing: false,
        },
      };
    }

    const { components, connections } = doc;
    const componentStates: Record<string, ComponentSimState> = {};

    // Initialize all component states to inactive
    components.forEach((c) => {
      componentStates[c.id] = {
        componentId: c.id,
        isActive: false,
        statusText: 'Không hoạt động',
      };
    });

    const sources = components.filter((c) => c.type === 'dc_power_supply');
    const leds = components.filter((c) => c.type === 'led');
    const resistors = components.filter((c) => c.type === 'resistor');
    const switches = components.filter((c) => c.type === 'switch_spst');

    if (sources.length === 0) {
      return {
        state: 'running',
        timestamp: Date.now(),
        message: 'Không có nguồn điện. Mạch không có điện thế kích hoạt.',
        supportedTopology: true,
        componentStates,
        circuitFlow: { isClosedLoop: false, currentFlowing: false },
      };
    }

    if (connections.length < 2) {
      return {
        state: 'running',
        timestamp: Date.now(),
        message: 'Mạch hở (chưa đủ dây nối để tạo thành vòng kín).',
        supportedTopology: true,
        componentStates,
        circuitFlow: { isClosedLoop: false, currentFlowing: false },
      };
    }

    // Build adjacency graph for pins
    type NodeKey = string; // "compId:pinId"
    const adj = new Map<NodeKey, NodeKey[]>();

    const addEdge = (u: NodeKey, v: NodeKey) => {
      if (!adj.has(u)) adj.set(u, []);
      if (!adj.has(v)) adj.set(v, []);
      adj.get(u)!.push(v);
      adj.get(v)!.push(u);
    };

    // Internal connections within components
    components.forEach((c) => {
      if (c.type === 'resistor') {
        addEdge(`${c.id}:pin_1`, `${c.id}:pin_2`);
      } else if (c.type === 'switch_spst') {
        const isClosed = Boolean(c.properties.isClosed);
        if (isClosed) {
          addEdge(`${c.id}:pin_1`, `${c.id}:pin_2`);
        }
      } else if (c.type === 'led') {
        // Conducts Anode -> Cathode
        addEdge(`${c.id}:pin_anode`, `${c.id}:pin_cathode`);
      }
    });

    // Wire connections
    connections.forEach((w) => {
      addEdge(`${w.fromComponentId}:${w.fromPinId}`, `${w.toComponentId}:${w.toPinId}`);
    });

    // Check if there is path from Source Positive to Source Negative
    const primarySource = sources[0];
    const startNode = `${primarySource.id}:pin_pos`;
    const targetNode = `${primarySource.id}:pin_neg`;

    const visited = new Set<NodeKey>();
    const queue: NodeKey[] = [startNode];
    visited.add(startNode);

    let isClosedLoop = false;

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === targetNode) {
        isClosedLoop = true;
        break;
      }
      const neighbors = adj.get(curr) || [];
      for (const next of neighbors) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }

    // Check switches state
    const openSwitch = switches.find((s) => !s.properties.isClosed);
    if (openSwitch) {
      componentStates[openSwitch.id] = {
        componentId: openSwitch.id,
        isActive: false,
        statusText: 'Công tắc đang mở (ngắt mạch)',
      };
    }

    switches.filter((s) => s.properties.isClosed).forEach((s) => {
      componentStates[s.id] = {
        componentId: s.id,
        isActive: true,
        statusText: 'Công tắc đang đóng (thông mạch)',
      };
    });

    if (!isClosedLoop) {
      return {
        state: 'running',
        timestamp: Date.now(),
        message: openSwitch
          ? `Mạch bị ngắt do công tắc "${openSwitch.name}" đang mở.`
          : 'Mạch hở (chưa khép kín từ cực dương sang cực âm).',
        supportedTopology: true,
        componentStates,
        circuitFlow: {
          isClosedLoop: false,
          currentFlowing: false,
        },
      };
    }

    // Circuit is closed! Calculate electrical parameters for supported series loop
    const voltage = primarySource.properties.voltage || 5;
    let totalResistance = resistors.reduce((sum, r) => sum + (r.properties.resistance || 220), 0);

    // Source state
    componentStates[primarySource.id] = {
      componentId: primarySource.id,
      isActive: true,
      voltageDrop: voltage,
      statusText: `Cung cấp ${voltage}V DC`,
    };

    // Evaluate LEDs
    leds.forEach((led) => {
      const forwardV = led.properties.forwardVoltage || 2.0;
      const maxI = led.properties.maxCurrent || 25; // mA

      if (totalResistance === 0) {
        // Direct connected without resistor -> Burned out
        componentStates[led.id] = {
          componentId: led.id,
          isActive: false,
          isOverloaded: true,
          statusText: 'CHÁY ĐÈN: Quá dòng cực đại do thiếu điện trở hạn dòng!',
          color: '#000000',
        };
      } else {
        const currentA = Math.max(0, (voltage - forwardV) / totalResistance);
        const currentMa = Math.round(currentA * 1000 * 10) / 10;

        if (currentMa <= 0) {
          componentStates[led.id] = {
            componentId: led.id,
            isActive: false,
            isUnderpowered: true,
            statusText: 'Không sáng (Điện áp nguồn thấp hơn ngưỡng kích hoạt 2.0V)',
          };
        } else if (currentMa > maxI * 1.5) {
          componentStates[led.id] = {
            componentId: led.id,
            isActive: false,
            isOverloaded: true,
            currentMa,
            statusText: `Quá dòng (${currentMa}mA > ${maxI}mA)! Nguy cơ cháy LED.`,
          };
        } else {
          // Normal bright operation!
          componentStates[led.id] = {
            componentId: led.id,
            isActive: true,
            currentMa,
            voltageDrop: forwardV,
            statusText: `Sáng rõ nét (Dòng điện qua LED: ${currentMa}mA)`,
            color: led.properties.color || '#ef4444',
          };
        }
      }
    });

    // Resistors state
    resistors.forEach((r) => {
      componentStates[r.id] = {
        componentId: r.id,
        isActive: true,
        statusText: `Hạn dòng: ${r.properties.resistance || 220}Ω`,
      };
    });

    const hasOverload = Object.values(componentStates).some((s) => s.isOverloaded);
    const estimatedMa = totalResistance > 0 ? Math.round(((voltage - 2.0) / totalResistance) * 1000 * 10) / 10 : 999;

    return {
      state: hasOverload ? 'error' : 'running',
      timestamp: Date.now(),
      message: hasOverload
        ? 'Cảnh báo mô phỏng: Xuất hiện linh kiện bị quá tải hoặc đoản mạch.'
        : `Mạch hoạt động bình thường. Dòng mạch kín ước tính: ${estimatedMa}mA.`,
      supportedTopology: true,
      componentStates,
      circuitFlow: {
        isClosedLoop: true,
        currentFlowing: true,
        estimatedCurrentMa: estimatedMa,
      },
    };
  }
}
