import { SimulationResult, ComponentSimulationState } from './types';
import { ProjectDocument } from '../project/types';

interface AdjacencyEdge {
  fromPin: string;
  toComponentId: string;
  toPin: string;
}

/**
 * Behavioral Simulation Engine
 * Explicitly defined as behavioral simulation, not physical SPICE.
 * Traces DC loops and models stateful switch and LED forward conduction.
 */
export function simulateBehavior(
  doc: ProjectDocument,
  switchStates: Record<string, boolean> = {} // instanceId -> isClosed (true = closed, false = open)
): SimulationResult {
  const compStates: Record<string, ComponentSimulationState> = {};

  // Initialize all components as inactive
  for (const c of doc.components) {
    compStates[c.instanceId] = {
      isPowered: false,
      isOn: false,
      stateLabel: 'Chưa có điện',
    };
  }

  const powerSource = doc.components.find((c) => c.definitionId === 'dc-source');
  if (!powerSource) {
    return {
      status: 'stopped',
      revision: doc.revision,
      components: compStates,
      summary: 'Mô phỏng dừng: Chưa có nguồn điện DC trên mạch.',
      isClosedLoop: false,
      issues: ['Chưa có nguồn điện DC.'],
      timestamp: Date.now(),
    };
  }

  // Build pin graph
  const graph = new Map<string, AdjacencyEdge[]>();

  for (const conn of doc.connections) {
    // Add forward
    if (!graph.has(conn.fromComponentId)) graph.set(conn.fromComponentId, []);
    graph.get(conn.fromComponentId)!.push({
      fromPin: conn.fromPinId,
      toComponentId: conn.toComponentId,
      toPin: conn.toPinId,
    });

    // Add reverse
    if (!graph.has(conn.toComponentId)) graph.set(conn.toComponentId, []);
    graph.get(conn.toComponentId)!.push({
      fromPin: conn.toPinId,
      toComponentId: conn.fromComponentId,
      toPin: conn.fromPinId,
    });
  }

  // Check direct short circuit
  const powerEdges = graph.get(powerSource.instanceId) || [];
  const directShort = powerEdges.some(
    (e) => e.fromPin === 'vcc' && e.toComponentId === powerSource.instanceId && e.toPin === 'gnd'
  );
  if (directShort) {
    compStates[powerSource.instanceId] = {
      isPowered: true,
      isOn: false,
      stateLabel: 'NGẮN MẠCH! Bảo vệ quá dòng kích hoạt',
      note: 'VCC chạm trực tiếp GND',
    };
    return {
      status: 'error',
      revision: doc.revision,
      components: compStates,
      summary: 'LỖI NGUY HIỂM: Ngắn mạch trực tiếp giữa cực dương và cực âm!',
      isClosedLoop: true,
      issues: ['Ngắn mạch VCC chạm GND.'],
      timestamp: Date.now(),
    };
  }

  // Trace path from power VCC pin
  // A path is valid if:
  // - Starts at powerSource:vcc
  // - Traverses through components
  //   - If switch: only passes if switch is CLOSED (switchStates[id] !== false)
  //   - If LED: only conducts from anode to cathode (forward biased)
  //   - If Resistor / Connector / Potentiometer: conducts in both directions
  // - Reaches powerSource:gnd

  interface PathNode {
    compId: string;
    enteredPin: string;
    visited: Set<string>;
    componentsTraversed: string[];
  }

  const vccEdges = powerEdges.filter((e) => e.fromPin === 'vcc');
  let foundClosedLoop = false;
  let activeComponentsInLoop: string[] = [];

  for (const startEdge of vccEdges) {
    const queue: PathNode[] = [
      {
        compId: startEdge.toComponentId,
        enteredPin: startEdge.toPin,
        visited: new Set([powerSource.instanceId, startEdge.toComponentId]),
        componentsTraversed: [startEdge.toComponentId],
      },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const comp = doc.components.find((c) => c.instanceId === current.compId);
      if (!comp) continue;

      // Determine exit pins for this component based on component logic
      let exitPins: string[] = [];

      if (comp.definitionId === 'switch') {
        // Switch: check state
        const isClosed = switchStates[comp.instanceId] ?? (comp.state?.open === false || false);
        if (!isClosed) {
          // Switch is open -> current cannot pass!
          compStates[comp.instanceId] = {
            isPowered: true,
            isOn: false,
            stateLabel: 'MỞ MẠCH (Công tắc đang ngắt)',
            note: 'Nhấn vào công tắc để đóng mạch',
          };
          continue;
        } else {
          // Switch is closed
          exitPins = current.enteredPin === 'pin1' ? ['pin2'] : ['pin1'];
        }
      } else if (comp.definitionId === 'resistor') {
        exitPins = current.enteredPin === 'pin1' ? ['pin2'] : ['pin1'];
      } else if (comp.definitionId === 'led') {
        // LED conducts only if entered through anode
        if (current.enteredPin === 'anode') {
          exitPins = ['cathode'];
        } else {
          // Reverse polarity: LED blocks current
          compStates[comp.instanceId] = {
            isPowered: true,
            isOn: false,
            stateLabel: 'KHÔNG SÁNG (Phân cực ngược)',
            note: 'Điện áp dương đặt vào chân Cathode bị diode chặn lại',
          };
          continue;
        }
      } else if (comp.definitionId === 'potentiometer') {
        // Conducts between entered pin and any other pin
        exitPins = ['pin1', 'pin2', 'wiper'].filter((p) => p !== current.enteredPin);
      } else if (comp.definitionId === 'connector') {
        exitPins = current.enteredPin === 'pin1' ? ['pin2'] : ['pin1'];
      } else if (comp.definitionId === 'pushbutton') {
        const isPressed = comp.parameters?.pressed ?? true; // Interactive or simulated closed
        if (isPressed) {
          exitPins = current.enteredPin === 'pin1' ? ['pin2'] : ['pin1'];
        }
      } else if (comp.definitionId === 'diode') {
        if (current.enteredPin === 'anode') {
          exitPins = ['cathode'];
        } else {
          compStates[comp.instanceId] = {
            isPowered: true,
            isOn: false,
            stateLabel: 'KHÓA (Diode phân cực ngược)',
            note: 'Diode 1N4007 chặn dòng điện chạy từ Cathode sang Anode.',
          };
          continue;
        }
      } else if (comp.definitionId === 'buzzer') {
        if (current.enteredPin === 'pin_pos') {
          exitPins = ['pin_neg'];
        }
      } else if (comp.definitionId === 'capacitor') {
        exitPins = current.enteredPin === 'pin_pos' ? ['pin_neg'] : ['pin_pos'];
      } else if (comp.definitionId === 'ldr') {
        exitPins = current.enteredPin === 'pin1' ? ['pin2'] : ['pin1'];
      } else if (comp.definitionId === 'relay') {
        exitPins = current.enteredPin === 'coil_pos' ? ['coil_neg'] : ['coil_pos'];
      } else if (comp.definitionId === 'ne555') {
        exitPins = current.enteredPin === 'vcc' ? ['out', 'gnd'] : ['out'];
      } else if (comp.definitionId === 'logic-and') {
        exitPins = ['out_y'];
      } else if (comp.definitionId === 'arduino-uno') {
        exitPins = ['pin_gnd'];
      }

      // Check next connections
      const edges = graph.get(comp.instanceId) || [];
      for (const exitPin of exitPins) {
        const matchingEdges = edges.filter((e) => e.fromPin === exitPin);
        for (const nextEdge of matchingEdges) {
          if (nextEdge.toComponentId === powerSource.instanceId) {
            if (nextEdge.toPin === 'gnd') {
              // Found closed path back to GND!
              foundClosedLoop = true;
              activeComponentsInLoop = Array.from(new Set([...activeComponentsInLoop, ...current.componentsTraversed]));
            }
          } else if (!current.visited.has(nextEdge.toComponentId)) {
            const nextVisited = new Set(current.visited);
            nextVisited.add(nextEdge.toComponentId);
            queue.push({
              compId: nextEdge.toComponentId,
              enteredPin: nextEdge.toPin,
              visited: nextVisited,
              componentsTraversed: [...current.componentsTraversed, nextEdge.toComponentId],
            });
          }
        }
      }
    }
  }

  // Update states for active components in the closed loop
  if (foundClosedLoop) {
    compStates[powerSource.instanceId] = {
      isPowered: true,
      isOn: true,
      stateLabel: 'Đang cấp nguồn 5.0V',
      currentEstimate: '~15.0 mA',
    };

    for (const compId of activeComponentsInLoop) {
      const comp = doc.components.find((c) => c.instanceId === compId);
      if (!comp) continue;

      if (comp.definitionId === 'led') {
        compStates[compId] = {
          isPowered: true,
          isOn: true,
          stateLabel: 'SÁNG (Dẫn dòng phân cực thuận)',
          currentEstimate: '~13.6 mA',
          voltageDrop: '2.0 V',
          note: 'Đèn LED hoạt động ở vùng dòng định mức an toàn.',
        };
      } else if (comp.definitionId === 'resistor') {
        const ohms = comp.parameters.resistance || 220;
        compStates[compId] = {
          isPowered: true,
          isOn: true,
          stateLabel: `Đang hạn dòng (${ohms} Ω)`,
          currentEstimate: `~${((5 - 2.0) / ohms * 1000).toFixed(1)} mA`,
          voltageDrop: '3.0 V',
        };
      } else if (comp.definitionId === 'switch') {
        compStates[compId] = {
          isPowered: true,
          isOn: true,
          stateLabel: 'ĐÓNG (Tiếp điểm dẫn dòng thông)',
        };
      } else if (comp.definitionId === 'potentiometer') {
        compStates[compId] = {
          isPowered: true,
          isOn: true,
          stateLabel: 'Đang dẫn dòng biến thiên',
        };
      } else if (comp.definitionId === 'buzzer') {
        compStates[compId] = {
          isPowered: true,
          isOn: true,
          stateLabel: 'KÊU BEEP BEEP (2.3 kHz, 85dB)',
          currentEstimate: '~20.0 mA',
          voltageDrop: '5.0 V',
          note: 'Còi chíp đang phát âm thanh cảnh báo!',
        };
      } else if (comp.definitionId === 'pushbutton') {
        compStates[compId] = {
          isPowered: true,
          isOn: true,
          stateLabel: 'NHẤN GIỮ (Tiếp điểm đóng)',
        };
      } else if (comp.definitionId === 'diode') {
        compStates[compId] = {
          isPowered: true,
          isOn: true,
          stateLabel: 'DẪN THUẬN (Sụt áp 0.7V)',
          voltageDrop: '0.7 V',
        };
      } else if (comp.definitionId === 'capacitor') {
        compStates[compId] = {
          isPowered: true,
          isOn: true,
          stateLabel: 'NẠP ĐIỆN / ĐỊNH THỜI (100µF)',
        };
      } else if (comp.definitionId === 'ldr') {
        compStates[compId] = {
          isPowered: true,
          isOn: true,
          stateLabel: 'CẢM BIẾN QUANG (Đang dẫn theo độ sáng)',
        };
      } else if (comp.definitionId === 'relay') {
        compStates[compId] = {
          isPowered: true,
          isOn: true,
          stateLabel: 'KÍCH HOẠT (Cuộn hút đóng tiếp điểm NO)',
          note: 'Tải công suất cao cách ly đã được cấp điện an toàn',
        };
      } else if (comp.definitionId === 'ne555') {
        compStates[compId] = {
          isPowered: true,
          isOn: true,
          stateLabel: 'DAO ĐỘNG XUNG VUÔNG (F = 1.44 / (R1+2R2)C)',
          note: 'IC NE555 đang phát xung kích hoạt chu kỳ',
        };
      } else if (comp.definitionId === 'logic-and') {
        compStates[compId] = {
          isPowered: true,
          isOn: true,
          stateLabel: 'OUT = MỨC CAO 5V (A = 1 & B = 1)',
        };
      } else if (comp.definitionId === 'arduino-uno') {
        compStates[compId] = {
          isPowered: true,
          isOn: true,
          stateLabel: 'ARDUINO CHẠY CHƯƠNG TRÌNH (D13 NHẤP NHÁY)',
          note: 'Chân D13 nhấp nháy 1Hz, ADC A0 sẵn sàng đọc dữ liệu',
        };
      }
    }

    return {
      status: 'running',
      revision: doc.revision,
      components: compStates,
      summary: 'Mạch điện hoạt động tốt: Vòng kín được thiết lập từ VCC qua tải về GND!',
      isClosedLoop: true,
      issues: [],
      timestamp: Date.now(),
    };
  }

  // Loop was not closed
  return {
    status: 'stopped',
    revision: doc.revision,
    components: compStates,
    summary: 'Mạch hở: Chưa tìm thấy vòng khép kín hoàn chỉnh từ cực dương VCC về cực âm GND.',
    isClosedLoop: false,
    issues: ['Mạch hở, chưa nối đủ dây về GND hoặc công tắc đang mở.'],
    timestamp: Date.now(),
  };
}
