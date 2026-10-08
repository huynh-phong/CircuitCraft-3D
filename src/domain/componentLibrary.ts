import { ComponentType, PinDefinition, ComponentProperties } from '../types/circuit.ts';

export interface ComponentMetadata {
  type: ComponentType;
  title: string;
  category: 'Nguồn' | 'Thụ động' | 'Chỉ báo' | 'Điều khiển' | 'Đầu nối' | 'Bán dẫn' | 'Vi mạch' | 'Cảm biến' | 'Vi điều khiển';
  icon: string;
  description: string;
  defaultProperties: ComponentProperties;
  pins: PinDefinition[];
  size: { width: number; height: number; depth: number };
}

export const COMPONENT_CATALOG: Record<ComponentType, ComponentMetadata> = {
  dc_power_supply: {
    type: 'dc_power_supply',
    title: 'Nguồn DC',
    category: 'Nguồn',
    icon: 'BatteryCharging',
    description: 'Nguồn điện 1 chiều ổn định (mặc định 5V DC). Cung cấp năng lượng cho toàn mạch.',
    defaultProperties: {
      voltage: 5,
      label: 'Nguồn DC 5V',
    },
    pins: [
      {
        id: 'pin_pos',
        label: '+',
        type: 'power_pos',
        relativePosition: { x: -14, y: 6, z: 0 },
      },
      {
        id: 'pin_neg',
        label: '-',
        type: 'power_neg',
        relativePosition: { x: 14, y: 6, z: 0 },
      },
    ],
    size: { width: 36, height: 16, depth: 24 },
  },

  resistor: {
    type: 'resistor',
    title: 'Điện trở',
    category: 'Thụ động',
    icon: 'Activity',
    description: 'Hạn chế cường độ dòng điện trong mạch. Bảo vệ linh kiện nhạy cảm như LED khỏi cháy hỏng.',
    defaultProperties: {
      resistance: 220,
      label: '220 Ω',
    },
    pins: [
      {
        id: 'pin_1',
        label: '1',
        type: 'passive',
        relativePosition: { x: -18, y: 5, z: 0 },
      },
      {
        id: 'pin_2',
        label: '2',
        type: 'passive',
        relativePosition: { x: 18, y: 5, z: 0 },
      },
    ],
    size: { width: 40, height: 10, depth: 10 },
  },

  led: {
    type: 'led',
    title: 'Đèn LED 5mm',
    category: 'Chỉ báo',
    icon: 'Sun',
    description: 'Điốt phát quang. Yêu cầu đúng chiều cực tính (Anode dương, Cathode âm) và điện trở hạn dòng.',
    defaultProperties: {
      forwardVoltage: 2.0,
      maxCurrent: 25,
      color: '#ef4444',
      label: 'LED Đỏ',
    },
    pins: [
      {
        id: 'pin_anode',
        label: '+ (A)',
        type: 'anode',
        relativePosition: { x: -8, y: 5, z: 0 },
      },
      {
        id: 'pin_cathode',
        label: '- (K)',
        type: 'cathode',
        relativePosition: { x: 8, y: 5, z: 0 },
      },
    ],
    size: { width: 20, height: 26, depth: 20 },
  },

  switch_spst: {
    type: 'switch_spst',
    title: 'Công tắc SPST',
    category: 'Điều khiển',
    icon: 'ToggleRight',
    description: 'Công tắc gạt 1 cực 1 ngả (Single Pole Single Throw). Đóng hoặc ngắt dòng điện.',
    defaultProperties: {
      isClosed: false,
      label: 'Công tắc S1',
    },
    pins: [
      {
        id: 'pin_1',
        label: '1',
        type: 'passive',
        relativePosition: { x: -14, y: 5, z: 0 },
      },
      {
        id: 'pin_2',
        label: '2',
        type: 'passive',
        relativePosition: { x: 14, y: 5, z: 0 },
      },
    ],
    size: { width: 34, height: 16, depth: 16 },
  },

  connector: {
    type: 'connector',
    title: 'Đầu nối 2P',
    category: 'Đầu nối',
    icon: 'Radio',
    description: 'Trạm đấu dây / đầu nối 2 chân (Terminal Block / Header 2-Pin), hỗ trợ cầu nối trung gian.',
    defaultProperties: {
      pinsCount: 2,
      label: 'Đầu nối 2P',
    },
    pins: [
      {
        id: 'pin_1',
        label: '1',
        type: 'passive',
        relativePosition: { x: -8, y: 4, z: 0 },
      },
      {
        id: 'pin_2',
        label: '2',
        type: 'passive',
        relativePosition: { x: 8, y: 4, z: 0 },
      },
    ],
    size: { width: 22, height: 14, depth: 14 },
  },

  capacitor: {
    type: 'capacitor',
    title: 'Tụ điện hóa',
    category: 'Thụ động',
    icon: 'Battery',
    description: 'Tụ điện tích trữ năng lượng điện trường, lọc nguồn và định thời chu kỳ.',
    defaultProperties: {
      capacitance: 100,
      label: '100 µF',
    },
    pins: [
      { id: 'pin_pos', label: '+', type: 'passive', relativePosition: { x: -6, y: 5, z: 0 } },
      { id: 'pin_neg', label: '-', type: 'passive', relativePosition: { x: 6, y: 5, z: 0 } },
    ],
    size: { width: 18, height: 22, depth: 18 },
  },

  potentiometer: {
    type: 'potentiometer',
    title: 'Biến trở xoay',
    category: 'Thụ động',
    icon: 'Sliders',
    description: 'Chiết áp 3 chân phân chia điện áp và tinh chỉnh dòng điện.',
    defaultProperties: {
      resistance: 10000,
      label: '10 kΩ',
    },
    pins: [
      { id: 'pin_1', label: '1', type: 'passive', relativePosition: { x: -10, y: 5, z: 4 } },
      { id: 'pin_wiper', label: 'W', type: 'passive', relativePosition: { x: 0, y: 5, z: -4 } },
      { id: 'pin_2', label: '2', type: 'passive', relativePosition: { x: 10, y: 5, z: 4 } },
    ],
    size: { width: 24, height: 22, depth: 24 },
  },

  pushbutton: {
    type: 'pushbutton',
    title: 'Nút nhấn nhả',
    category: 'Điều khiển',
    icon: 'CircleDot',
    description: 'Nút bấm 2 chân tiếp xúc tạm thời khi nhấn.',
    defaultProperties: {
      isClosed: false,
      label: 'Nút SW',
    },
    pins: [
      { id: 'pin_1', label: '1', type: 'passive', relativePosition: { x: -8, y: 4, z: 0 } },
      { id: 'pin_2', label: '2', type: 'passive', relativePosition: { x: 8, y: 4, z: 0 } },
    ],
    size: { width: 20, height: 14, depth: 20 },
  },

  diode: {
    type: 'diode',
    title: 'Diode 1N4007',
    category: 'Bán dẫn',
    icon: 'ArrowRightCircle',
    description: 'Diode chỉnh lưu chỉ dẫn dòng theo chiều thuận Anode -> Cathode.',
    defaultProperties: {
      forwardVoltage: 0.7,
      label: '1N4007',
    },
    pins: [
      { id: 'pin_anode', label: 'A', type: 'input', relativePosition: { x: -12, y: 4, z: 0 } },
      { id: 'pin_cathode', label: 'K', type: 'output', relativePosition: { x: 12, y: 4, z: 0 } },
    ],
    size: { width: 28, height: 10, depth: 10 },
  },

  buzzer: {
    type: 'buzzer',
    title: 'Còi chíp Buzzer',
    category: 'Chỉ báo',
    icon: 'Volume2',
    description: 'Còi phát âm thanh tần số cao cảnh báo khi có nguồn điện.',
    defaultProperties: {
      voltage: 5,
      label: 'Buzzer 5V',
    },
    pins: [
      { id: 'pin_pos', label: '+', type: 'power_pos', relativePosition: { x: -6, y: 5, z: 0 } },
      { id: 'pin_neg', label: '-', type: 'power_neg', relativePosition: { x: 6, y: 5, z: 0 } },
    ],
    size: { width: 22, height: 18, depth: 22 },
  },

  ldr: {
    type: 'ldr',
    title: 'Quang trở LDR',
    category: 'Cảm biến',
    icon: 'Eye',
    description: 'Điện trở thay đổi theo ánh sáng môi trường chiếu vào.',
    defaultProperties: {
      label: 'LDR GL5528',
    },
    pins: [
      { id: 'pin_1', label: '1', type: 'passive', relativePosition: { x: -6, y: 4, z: 0 } },
      { id: 'pin_2', label: '2', type: 'passive', relativePosition: { x: 6, y: 4, z: 0 } },
    ],
    size: { width: 16, height: 12, depth: 16 },
  },

  relay: {
    type: 'relay',
    title: 'Rơ-le cách ly 5V',
    category: 'Điều khiển',
    icon: 'Cpu',
    description: 'Đóng cắt mạch điện công suất lớn bằng tín hiệu kích cuộn hút.',
    defaultProperties: {
      label: 'Relay 5V',
    },
    pins: [
      { id: 'pin_in', label: 'IN', type: 'input', relativePosition: { x: -14, y: 5, z: -6 } },
      { id: 'pin_gnd', label: 'GND', type: 'power_neg', relativePosition: { x: -14, y: 5, z: 6 } },
      { id: 'pin_com', label: 'COM', type: 'passive', relativePosition: { x: 14, y: 5, z: 0 } },
      { id: 'pin_no', label: 'NO', type: 'passive', relativePosition: { x: 14, y: 5, z: -6 } },
    ],
    size: { width: 34, height: 22, depth: 26 },
  },

  ne555: {
    type: 'ne555',
    title: 'IC Định thời NE555',
    category: 'Vi mạch',
    icon: 'Cpu',
    description: 'IC tạo xung nhịp, định thời và chớp đèn LED chu kỳ.',
    defaultProperties: {
      label: 'NE555 Timer',
    },
    pins: [
      { id: 'pin_vcc', label: 'VCC', type: 'power_pos', relativePosition: { x: -10, y: 4, z: 8 } },
      { id: 'pin_gnd', label: 'GND', type: 'power_neg', relativePosition: { x: -10, y: 4, z: -8 } },
      { id: 'pin_out', label: 'OUT', type: 'output', relativePosition: { x: 0, y: 4, z: -8 } },
      { id: 'pin_trig', label: 'TRG', type: 'input', relativePosition: { x: -5, y: 4, z: -8 } },
    ],
    size: { width: 28, height: 12, depth: 22 },
  },

  logic_and: {
    type: 'logic_and',
    title: 'Cổng Logic AND 74HC08',
    category: 'Vi mạch',
    icon: 'Binary',
    description: 'Cổng logic thực hiện phép toán số AND giữa 2 đầu vào.',
    defaultProperties: {
      label: '74HC08 AND',
    },
    pins: [
      { id: 'pin_vcc', label: 'VCC', type: 'power_pos', relativePosition: { x: -10, y: 4, z: 8 } },
      { id: 'pin_gnd', label: 'GND', type: 'power_neg', relativePosition: { x: -10, y: 4, z: -8 } },
      { id: 'pin_a', label: 'A', type: 'input', relativePosition: { x: -5, y: 4, z: -8 } },
      { id: 'pin_b', label: 'B', type: 'input', relativePosition: { x: 0, y: 4, z: -8 } },
      { id: 'pin_y', label: 'Y', type: 'output', relativePosition: { x: 8, y: 4, z: -8 } },
    ],
    size: { width: 28, height: 12, depth: 22 },
  },

  arduino_uno: {
    type: 'arduino_uno',
    title: 'Arduino UNO R3',
    category: 'Vi điều khiển',
    icon: 'Cpu',
    description: 'Bo mạch vi điều khiển lập trình nhúng ATmega328P với chân I/O số và tương tự.',
    defaultProperties: {
      label: 'Arduino UNO R3',
      voltage: 5,
    },
    pins: [
      { id: 'pin_5v', label: '5V', type: 'power_pos', relativePosition: { x: -40, y: 6, z: 30 } },
      { id: 'pin_3v3', label: '3.3V', type: 'power_pos', relativePosition: { x: -35, y: 6, z: 30 } },
      { id: 'pin_gnd', label: 'GND', type: 'power_neg', relativePosition: { x: -30, y: 6, z: 30 } },
      { id: 'pin_d13', label: 'D13', type: 'output', relativePosition: { x: 30, y: 6, z: -30 } },
      { id: 'pin_d12', label: 'D12', type: 'bidirectional', relativePosition: { x: 25, y: 6, z: -30 } },
      { id: 'pin_a0', label: 'A0', type: 'input', relativePosition: { x: -15, y: 6, z: 30 } },
    ],
    size: { width: 90, height: 16, depth: 65 },
  },

  temp_sensor: {
    type: 'temp_sensor',
    title: 'Cảm biến nhiệt độ LM35',
    category: 'Cảm biến',
    icon: 'Thermometer',
    description: 'Đo nhiệt độ môi trường và xuất điện áp tỷ lệ thuận tuyến tính 10mV/°C.',
    defaultProperties: {
      temperatureC: 25,
      label: 'LM35',
    },
    pins: [
      { id: 'pin_vcc', label: '+', type: 'power_pos', relativePosition: { x: -5, y: 4, z: 0 } },
      { id: 'pin_out', label: 'OUT', type: 'output', relativePosition: { x: 0, y: 4, z: 0 } },
      { id: 'pin_gnd', label: '-', type: 'power_neg', relativePosition: { x: 5, y: 4, z: 0 } },
    ],
    size: { width: 16, height: 14, depth: 10 },
  },
};

/**
 * Formal Component Definitions with stable IDs and SemVer versioning
 */
export const COMPONENT_DEFINITIONS: Record<ComponentType, import('../types/circuit.ts').ComponentDefinition> = {
  dc_power_supply: {
    id: 'dc_power_supply',
    type: 'dc_power_supply',
    version: '1.0.0',
    name: 'Nguồn DC mẫu',
    description: 'Nguồn điện 1 chiều mẫu không gắn thương mại (5V)',
    category: 'Nguồn',
    pins: COMPONENT_CATALOG.dc_power_supply.pins,
    defaultProperties: COMPONENT_CATALOG.dc_power_supply.defaultProperties,
    dimensions: COMPONENT_CATALOG.dc_power_supply.size,
  },
  resistor: {
    id: 'resistor',
    type: 'resistor',
    version: '1.0.0',
    name: 'Điện trở mẫu',
    description: 'Điện trở hạn dòng mẫu (220 Ohm)',
    category: 'Thụ động',
    pins: COMPONENT_CATALOG.resistor.pins,
    defaultProperties: COMPONENT_CATALOG.resistor.defaultProperties,
    dimensions: COMPONENT_CATALOG.resistor.size,
  },
  led: {
    id: 'led',
    type: 'led',
    version: '1.0.0',
    name: 'Đèn LED mẫu',
    description: 'Điốt phát quang mẫu 5mm (Đỏ)',
    category: 'Chỉ báo',
    pins: COMPONENT_CATALOG.led.pins,
    defaultProperties: COMPONENT_CATALOG.led.defaultProperties,
    dimensions: COMPONENT_CATALOG.led.size,
  },
  switch_spst: {
    id: 'switch_spst',
    type: 'switch_spst',
    version: '1.0.0',
    name: 'Công tắc SPST mẫu',
    description: 'Công tắc đơn đóng ngắt mạch',
    category: 'Điều khiển',
    pins: COMPONENT_CATALOG.switch_spst.pins,
    defaultProperties: COMPONENT_CATALOG.switch_spst.defaultProperties,
    dimensions: COMPONENT_CATALOG.switch_spst.size,
  },
  connector: {
    id: 'connector',
    type: 'connector',
    version: '1.0.0',
    name: 'Đầu nối mẫu',
    description: 'Đầu nối 2 chân trung gian',
    category: 'Đầu nối',
    pins: COMPONENT_CATALOG.connector.pins,
    defaultProperties: COMPONENT_CATALOG.connector.defaultProperties,
    dimensions: COMPONENT_CATALOG.connector.size,
  },
  capacitor: {
    id: 'capacitor',
    type: 'capacitor',
    version: '1.0.0',
    name: 'Tụ điện hóa',
    description: 'Tụ điện lọc nguồn và nạp xả',
    category: 'Thụ động',
    pins: COMPONENT_CATALOG.capacitor.pins,
    defaultProperties: COMPONENT_CATALOG.capacitor.defaultProperties,
    dimensions: COMPONENT_CATALOG.capacitor.size,
  },
  potentiometer: {
    id: 'potentiometer',
    type: 'potentiometer',
    version: '1.0.0',
    name: 'Biến trở xoay',
    description: 'Biến trở chiết áp phân áp',
    category: 'Thụ động',
    pins: COMPONENT_CATALOG.potentiometer.pins,
    defaultProperties: COMPONENT_CATALOG.potentiometer.defaultProperties,
    dimensions: COMPONENT_CATALOG.potentiometer.size,
  },
  pushbutton: {
    id: 'pushbutton',
    type: 'pushbutton',
    version: '1.0.0',
    name: 'Nút nhấn nhả',
    description: 'Khóa bấm tiếp xúc tạm thời',
    category: 'Điều khiển',
    pins: COMPONENT_CATALOG.pushbutton.pins,
    defaultProperties: COMPONENT_CATALOG.pushbutton.defaultProperties,
    dimensions: COMPONENT_CATALOG.pushbutton.size,
  },
  diode: {
    id: 'diode',
    type: 'diode',
    version: '1.0.0',
    name: 'Diode 1N4007',
    description: 'Diode bán dẫn chỉnh lưu',
    category: 'Bán dẫn',
    pins: COMPONENT_CATALOG.diode.pins,
    defaultProperties: COMPONENT_CATALOG.diode.defaultProperties,
    dimensions: COMPONENT_CATALOG.diode.size,
  },
  buzzer: {
    id: 'buzzer',
    type: 'buzzer',
    version: '1.0.0',
    name: 'Còi chíp Buzzer',
    description: 'Còi phát âm thanh cảnh báo',
    category: 'Chỉ báo',
    pins: COMPONENT_CATALOG.buzzer.pins,
    defaultProperties: COMPONENT_CATALOG.buzzer.defaultProperties,
    dimensions: COMPONENT_CATALOG.buzzer.size,
  },
  ldr: {
    id: 'ldr',
    type: 'ldr',
    version: '1.0.0',
    name: 'Quang trở LDR',
    description: 'Cảm biến ánh sáng quang điện trở',
    category: 'Cảm biến',
    pins: COMPONENT_CATALOG.ldr.pins,
    defaultProperties: COMPONENT_CATALOG.ldr.defaultProperties,
    dimensions: COMPONENT_CATALOG.ldr.size,
  },
  relay: {
    id: 'relay',
    type: 'relay',
    version: '1.0.0',
    name: 'Rơ-le cách ly 5V',
    description: 'Rơ-le điện cơ tiếp điểm SPDT',
    category: 'Điều khiển',
    pins: COMPONENT_CATALOG.relay.pins,
    defaultProperties: COMPONENT_CATALOG.relay.defaultProperties,
    dimensions: COMPONENT_CATALOG.relay.size,
  },
  ne555: {
    id: 'ne555',
    type: 'ne555',
    version: '1.0.0',
    name: 'IC Định thời NE555',
    description: 'IC định thời xung đa hài',
    category: 'Vi mạch',
    pins: COMPONENT_CATALOG.ne555.pins,
    defaultProperties: COMPONENT_CATALOG.ne555.defaultProperties,
    dimensions: COMPONENT_CATALOG.ne555.size,
  },
  logic_and: {
    id: 'logic_and',
    type: 'logic_and',
    version: '1.0.0',
    name: 'Cổng Logic AND',
    description: 'Cổng logic số 74HC08',
    category: 'Vi mạch',
    pins: COMPONENT_CATALOG.logic_and.pins,
    defaultProperties: COMPONENT_CATALOG.logic_and.defaultProperties,
    dimensions: COMPONENT_CATALOG.logic_and.size,
  },
  arduino_uno: {
    id: 'arduino_uno',
    type: 'arduino_uno',
    version: '1.0.0',
    name: 'Arduino UNO R3',
    description: 'Bo vi điều khiển ATmega328P',
    category: 'Vi điều khiển',
    pins: COMPONENT_CATALOG.arduino_uno.pins,
    defaultProperties: COMPONENT_CATALOG.arduino_uno.defaultProperties,
    dimensions: COMPONENT_CATALOG.arduino_uno.size,
  },
  temp_sensor: {
    id: 'temp_sensor',
    type: 'temp_sensor',
    version: '1.0.0',
    name: 'Cảm biến nhiệt LM35',
    description: 'Cảm biến nhiệt độ 10mV/°C',
    category: 'Cảm biến',
    pins: COMPONENT_CATALOG.temp_sensor.pins,
    defaultProperties: COMPONENT_CATALOG.temp_sensor.defaultProperties,
    dimensions: COMPONENT_CATALOG.temp_sensor.size,
  },
};

export function createDefaultProject(): import('../types/circuit.ts').ProjectDocument {
  return {
    schemaVersion: 1,
    revision: 1,
    id: 'proj_' + Math.random().toString(36).substring(2, 9),
    name: 'Mạch thực hành cơ bản',
    description: 'Thiết kế và thí nghiệm mạch điện DC tương tác 3D',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    board: {
      width: 180,
      depth: 120,
      thickness: 4,
      gridSize: 10,
      color: '#1e3a2f', // PCB deep dark green
    },
    components: [],
    connections: [],
    metadata: {
      difficulty: 'beginner',
      tags: ['DC', 'LED', 'Cơ bản'],
    },
  };
}
