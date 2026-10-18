import { ComponentDefinition, PinDefinition } from '../project/types';

/**
 * Returns the electrical internal bus identifier for a breadboard pin.
 * All pins sharing the same busId on a breadboard are electrically tied together.
 */
export function getBreadboardBusId(pinId: string): string {
  if (pinId.startsWith('rail_top_pos')) return 'rail_top_pos';
  if (pinId.startsWith('rail_top_neg')) return 'rail_top_neg';
  if (pinId.startsWith('rail_bot_pos')) return 'rail_bot_pos';
  if (pinId.startsWith('rail_bot_neg')) return 'rail_bot_neg';

  if (pinId.startsWith('tie_')) {
    const parts = pinId.split('_');
    const col = parts[1];
    const row = parts[2]?.toLowerCase();
    if (['a', 'b', 'c', 'd', 'e'].includes(row)) {
      return `col_${col}_top`;
    }
    return `col_${col}_bot`;
  }

  if (pinId.startsWith('strip_')) {
    const parts = pinId.split('_');
    return `col_${parts[1]}_${parts[2]}`; // e.g. col_1_top
  }

  return pinId;
}

/**
 * Generates all 60 columns (rows A-J) and power rails for a standard full-size breadboard (830 tie-points).
 */
export function generateBreadboardPins(): PinDefinition[] {
  const pins: PinDefinition[] = [];
  const colCount = 60;
  const colPitch = 2.54;
  const halfCols = (colCount - 1) / 2; // 29.5

  const topRows = [
    { row: 'E', z: -14.0 },
    { row: 'D', z: -11.46 },
    { row: 'C', z: -8.92 },
    { row: 'B', z: -6.38 },
    { row: 'A', z: -3.84 },
  ];
  const botRows = [
    { row: 'F', z: 3.84 },
    { row: 'G', z: 6.38 },
    { row: 'H', z: 8.92 },
    { row: 'I', z: 11.46 },
    { row: 'J', z: 14.0 },
  ];

  for (let c = 1; c <= colCount; c++) {
    const x = Number(((c - 1 - halfCols) * colPitch).toFixed(2));

    // Top bank A-E
    for (const r of topRows) {
      pins.push({
        id: `tie_${c}_${r.row.toLowerCase()}`,
        name: `Cột ${c} (Hàng ${r.row})`,
        type: 'passive',
        localOffset: { x, y: 9.8, z: r.z },
        designator: `${c}${r.row}`,
        description: `Lỗ cắm cột ${c} hàng ${r.row} (Nối chung A-E cột ${c})`,
      });
    }

    // Bottom bank F-J
    for (const r of botRows) {
      pins.push({
        id: `tie_${c}_${r.row.toLowerCase()}`,
        name: `Cột ${c} (Hàng ${r.row})`,
        type: 'passive',
        localOffset: { x, y: 9.8, z: r.z },
        designator: `${c}${r.row}`,
        description: `Lỗ cắm cột ${c} hàng ${r.row} (Nối chung F-J cột ${c})`,
      });
    }

    // Power rails (+ and -) top and bottom
    pins.push({
      id: `rail_top_pos_${c}`,
      name: `Thanh (+) Nguồn Trên - Lỗ ${c}`,
      type: 'power',
      localOffset: { x, y: 9.8, z: -23.5 },
      designator: `+T${c}`,
      description: `Thanh nguồn dương (+) phía trên (Nối chung toàn thanh)`,
    });
    pins.push({
      id: `rail_top_neg_${c}`,
      name: `Thanh (-) Mass Trên - Lỗ ${c}`,
      type: 'ground',
      localOffset: { x, y: 9.8, z: -25.8 },
      designator: `-T${c}`,
      description: `Thanh mass GND (-) phía trên (Nối chung toàn thanh)`,
    });
    pins.push({
      id: `rail_bot_pos_${c}`,
      name: `Thanh (+) Nguồn Dưới - Lỗ ${c}`,
      type: 'power',
      localOffset: { x, y: 9.8, z: 23.5 },
      designator: `+B${c}`,
      description: `Thanh nguồn dương (+) phía dưới (Nối chung toàn thanh)`,
    });
    pins.push({
      id: `rail_bot_neg_${c}`,
      name: `Thanh (-) Mass Dưới - Lỗ ${c}`,
      type: 'ground',
      localOffset: { x, y: 9.8, z: 25.8 },
      designator: `-B${c}`,
      description: `Thanh mass GND (-) phía dưới (Nối chung toàn thanh)`,
    });
  }

  // Backward compatibility aliases for existing samples/lessons
  for (let i = 1; i <= 10; i++) {
    const colIdx = Math.round(1 + ((i - 1) / 9) * 59);
    pins.push(
      { id: `strip_${i}_top`, name: `Hàng cắm ${i} Trên (A-E)`, type: 'passive', localOffset: { x: Number(((colIdx - 1 - halfCols) * colPitch).toFixed(2)), y: 9.8, z: -8.92 }, designator: `${i}T` },
      { id: `strip_${i}_bot`, name: `Hàng cắm ${i} Dưới (F-J)`, type: 'passive', localOffset: { x: Number(((colIdx - 1 - halfCols) * colPitch).toFixed(2)), y: 9.8, z: 8.92 }, designator: `${i}B` }
    );
  }

  return pins;
}

export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
  {
    definitionId: 'dc-source',
    version: '1.0.0',
    name: 'Nguồn DC (Pin/Power)',
    category: 'power',
    description: 'Khối nguồn một chiều cấp điện áp ổn định (VCC/GND) cho mạch điện.',
    dimensions: { x: 30, y: 15, z: 20 },
    footprintType: 'through-hole',
    pins: [
      {
        id: 'vcc',
        name: 'VCC (+)',
        type: 'power',
        localOffset: { x: -8, y: 3, z: 0 },
        description: 'Cực dương cấp nguồn',
        designator: '+',
      },
      {
        id: 'gnd',
        name: 'GND (-)',
        type: 'ground',
        localOffset: { x: 8, y: 3, z: 0 },
        description: 'Cực âm / Mass mạch',
        designator: '-',
      },
    ],
    defaultParameters: {
      voltage: 5, // Volts
      maxCurrent: 1000, // mA
    },
    parameterSchema: [
      {
        name: 'voltage',
        label: 'Điện áp (V)',
        type: 'select',
        options: [
          { label: '3.3V (Logic)', value: 3.3 },
          { label: '5.0V (Chuẩn USB/Arduino)', value: 5.0 },
          { label: '9.0V (Pin 9V)', value: 9.0 },
          { label: '12.0V (Nguồn công suất)', value: 12.0 },
        ],
        default: 5.0,
      },
    ],
  },
  {
    definitionId: 'resistor',
    version: '1.0.0',
    name: 'Điện trở (Resistor)',
    category: 'passives',
    description: 'Linh kiện thụ động cản trở dòng điện, giới hạn dòng và phân chia điện áp.',
    dimensions: { x: 16, y: 5, z: 5 },
    footprintType: 'through-hole',
    pins: [
      {
        id: 'pin1',
        name: 'Chân 1',
        type: 'passive',
        localOffset: { x: -5.08, y: 0, z: 0 },
        description: 'Đầu chân kim loại 1',
        designator: '1',
      },
      {
        id: 'pin2',
        name: 'Chân 2',
        type: 'passive',
        localOffset: { x: 5.08, y: 0, z: 0 },
        description: 'Đầu chân kim loại 2',
        designator: '2',
      },
    ],
    defaultParameters: {
      resistance: 220, // Ohms
      tolerance: 5, // %
      powerRating: 0.25, // W
    },
    parameterSchema: [
      {
        name: 'resistance',
        label: 'Trị số điện trở (Ω)',
        type: 'select',
        options: [
          { label: '100 Ω', value: 100 },
          { label: '220 Ω (Chuẩn cho LED 5V)', value: 220 },
          { label: '330 Ω (Chuẩn cho LED 5V sáng dịu)', value: 330 },
          { label: '470 Ω', value: 470 },
          { label: '1 kΩ (1000 Ω)', value: 1000 },
          { label: '4.7 kΩ', value: 4700 },
          { label: '10 kΩ (Kéo điện áp)', value: 10000 },
        ],
        default: 220,
      },
    ],
  },
  {
    definitionId: 'led',
    version: '1.0.0',
    name: 'Đèn LED (5mm)',
    category: 'semiconductors',
    description: 'Diode phát quang bán dẫn chuyển đổi điện năng thành quang năng khi phân cực thuận.',
    dimensions: { x: 6, y: 10, z: 6 },
    footprintType: 'through-hole',
    pins: [
      {
        id: 'anode',
        name: 'Anode (+)',
        type: 'input',
        localOffset: { x: -2.54, y: 0, z: 0 },
        description: 'Chân dương (chân dài hơn)',
        designator: 'A',
      },
      {
        id: 'cathode',
        name: 'Cathode (-)',
        type: 'output',
        localOffset: { x: 0, y: 0, z: 0 },
        description: 'Chân âm (chân vát cạnh)',
        designator: 'K',
      },
    ],
    defaultParameters: {
      color: 'red',
      forwardVoltage: 2.0, // V
      maxCurrent: 20, // mA
    },
    parameterSchema: [
      {
        name: 'color',
        label: 'Màu sắc ánh sáng',
        type: 'select',
        options: [
          { label: 'Đỏ (Red 630nm)', value: 'red' },
          { label: 'Xanh lục (Green 525nm)', value: 'green' },
          { label: 'Xanh lam (Blue 470nm)', value: 'blue' },
          { label: 'Vàng (Yellow 590nm)', value: 'yellow' },
          { label: 'Trắng (White 6000K)', value: 'white' },
        ],
        default: 'red',
      },
    ],
  },
  {
    definitionId: 'switch',
    version: '1.0.0',
    name: 'Công tắc (SPST Switch)',
    category: 'switches',
    description: 'Khóa đóng/mở cơ học một tiếp điểm (Single-Pole Single-Throw) để ngắt/nối dòng.',
    dimensions: { x: 12, y: 8, z: 7 },
    footprintType: 'through-hole',
    pins: [
      {
        id: 'pin1',
        name: 'Tiếp điểm 1',
        type: 'passive',
        localOffset: { x: -4, y: 1, z: 0 },
        description: 'Cực tiếp điểm thứ nhất',
        designator: '1',
      },
      {
        id: 'pin2',
        name: 'Tiếp điểm 2',
        type: 'passive',
        localOffset: { x: 4, y: 1, z: 0 },
        description: 'Cực tiếp điểm thứ hai',
        designator: '2',
      },
    ],
    defaultParameters: {
      type: 'slide',
    },
    parameterSchema: [
      {
        name: 'type',
        label: 'Loại công tắc',
        type: 'select',
        options: [
          { label: 'Công tắc gạt (Slide Switch)', value: 'slide' },
          { label: 'Nút nhấn (Pushbutton)', value: 'pushbutton' },
        ],
        default: 'slide',
      },
    ],
  },
  {
    definitionId: 'connector',
    version: '1.0.0',
    name: 'Cọc đấu dây (Terminal Block)',
    category: 'connectors',
    description: 'Khối terminal vít 2 cực 5.08mm cho phép đấu nối dây mở rộng ngoài bo mạch.',
    dimensions: { x: 12, y: 10, z: 10 },
    footprintType: 'through-hole',
    pins: [
      {
        id: 'pin1',
        name: 'Terminal 1',
        type: 'bidirectional',
        localOffset: { x: -2.54, y: 2, z: 0 },
        description: 'Cực cắm 1',
        designator: 'T1',
      },
      {
        id: 'pin2',
        name: 'Terminal 2',
        type: 'bidirectional',
        localOffset: { x: 2.54, y: 2, z: 0 },
        description: 'Cực cắm 2',
        designator: 'T2',
      },
    ],
    defaultParameters: {
      maxAmps: 10,
    },
    parameterSchema: [],
  },
  {
    definitionId: 'potentiometer',
    version: '1.0.0',
    name: 'Biến trở xoay (Potentiometer)',
    category: 'passives',
    description: 'Điện trở điều chỉnh 3 chân với con chạy quay để chia điện áp hoặc chỉnh dòng.',
    dimensions: { x: 12, y: 14, z: 12 },
    footprintType: 'through-hole',
    pins: [
      {
        id: 'pin1',
        name: 'Đầu 1',
        type: 'passive',
        localOffset: { x: -4, y: 1, z: 3 },
        description: 'Đầu điện trở cố định A',
        designator: '1',
      },
      {
        id: 'wiper',
        name: 'Con chạy (Wiper)',
        type: 'passive',
        localOffset: { x: 0, y: 1, z: -3 },
        description: 'Đầu ra con chạy biến thiên',
        designator: 'W',
      },
      {
        id: 'pin2',
        name: 'Đầu 2',
        type: 'passive',
        localOffset: { x: 4, y: 1, z: 3 },
        description: 'Đầu điện trở cố định B',
        designator: '2',
      },
    ],
    defaultParameters: {
      maxResistance: 10000, // 10k
      currentPosition: 0.5, // 50%
    },
    parameterSchema: [
      {
        name: 'maxResistance',
        label: 'Trị số cực đại (Ω)',
        type: 'select',
        options: [
          { label: '1 kΩ', value: 1000 },
          { label: '10 kΩ (Chuẩn chiết áp)', value: 10000 },
          { label: '100 kΩ', value: 100000 },
        ],
        default: 10000,
      },
    ],
  },
  {
    definitionId: 'capacitor',
    version: '1.0.0',
    name: 'Tụ điện hóa (Capacitor)',
    category: 'passives',
    description: 'Tụ điện tích trữ và phóng thích năng lượng điện trường, lọc nguồn và định thời.',
    dimensions: { x: 8, y: 14, z: 8 },
    footprintType: 'through-hole',
    pins: [
      {
        id: 'pin_pos',
        name: 'Cực dương (+)',
        type: 'passive',
        localOffset: { x: -2.54, y: 1, z: 0 },
        description: 'Chân dài hơn (+)',
        designator: '+',
      },
      {
        id: 'pin_neg',
        name: 'Cực âm (-)',
        type: 'passive',
        localOffset: { x: 2.54, y: 1, z: 0 },
        description: 'Chân ngắn hơn có vạch chỉ thị (-)',
        designator: '-',
      },
    ],
    defaultParameters: {
      capacitance: 100, // uF
      voltageRating: 25, // V
    },
    parameterSchema: [
      {
        name: 'capacitance',
        label: 'Điện dung (µF)',
        type: 'select',
        options: [
          { label: '10 µF', value: 10 },
          { label: '47 µF', value: 47 },
          { label: '100 µF (Chuẩn định thời)', value: 100 },
          { label: '470 µF (Lọc nguồn DC)', value: 470 },
          { label: '1000 µF', value: 1000 },
        ],
        default: 100,
      },
    ],
  },
  {
    definitionId: 'pushbutton',
    version: '1.0.0',
    name: 'Nút nhấn nhả (Tactile Switch)',
    category: 'switches',
    description: 'Nút bấm 4 chân hồi vị tức thời (Momentary Pushbutton) tạo xung kích hoạt.',
    dimensions: { x: 12, y: 8, z: 12 },
    footprintType: 'through-hole',
    pins: [
      {
        id: 'pin1',
        name: 'Chân 1A',
        type: 'passive',
        localOffset: { x: -4, y: 1, z: -3 },
        description: 'Tiếp điểm nhánh A',
        designator: '1A',
      },
      {
        id: 'pin2',
        name: 'Chân 2A',
        type: 'passive',
        localOffset: { x: 4, y: 1, z: -3 },
        description: 'Tiếp điểm nhánh B',
        designator: '2A',
      },
    ],
    defaultParameters: {
      pressed: false,
    },
    parameterSchema: [],
  },
  {
    definitionId: 'diode',
    version: '1.0.0',
    name: 'Diode chỉnh lưu (1N4007)',
    category: 'semiconductors',
    description: 'Diode bán dẫn cho dòng điện chỉ chạy qua theo một chiều thuận (Anode sang Cathode).',
    dimensions: { x: 14, y: 5, z: 5 },
    footprintType: 'through-hole',
    pins: [
      {
        id: 'anode',
        name: 'Anode (A)',
        type: 'input',
        localOffset: { x: -5.08, y: 1, z: 0 },
        description: 'Cực dương Anode',
        designator: 'A',
      },
      {
        id: 'cathode',
        name: 'Cathode (K)',
        type: 'output',
        localOffset: { x: 5.08, y: 1, z: 0 },
        description: 'Cực âm Cathode có vạch bạc',
        designator: 'K',
      },
    ],
    defaultParameters: {
      forwardVoltage: 0.7, // V
      maxCurrent: 1000, // mA
    },
    parameterSchema: [],
  },
  {
    definitionId: 'buzzer',
    version: '1.0.0',
    name: 'Còi chíp báo động (Buzzer 5V)',
    category: 'opto',
    description: 'Phát ra âm thanh cảnh báo tần số ~2.3kHz khi được cấp nguồn đúng cực tính.',
    dimensions: { x: 12, y: 10, z: 12 },
    footprintType: 'through-hole',
    pins: [
      {
        id: 'pin_pos',
        name: 'VCC (+)',
        type: 'power',
        localOffset: { x: -2.54, y: 1, z: 0 },
        description: 'Cực dương còi chíp',
        designator: '+',
      },
      {
        id: 'pin_neg',
        name: 'GND (-)',
        type: 'ground',
        localOffset: { x: 2.54, y: 1, z: 0 },
        description: 'Cực âm còi chíp',
        designator: '-',
      },
    ],
    defaultParameters: {
      frequencyHz: 2300,
      soundLevel: 85, // dB
    },
    parameterSchema: [],
  },
  {
    definitionId: 'ldr',
    version: '1.0.0',
    name: 'Quang trở (LDR Photoresistor)',
    category: 'sensors',
    description: 'Điện trở nhạy sáng, có trị số điện trở giảm mạnh khi cường độ ánh sáng tăng.',
    dimensions: { x: 8, y: 8, z: 8 },
    footprintType: 'through-hole',
    pins: [
      {
        id: 'pin1',
        name: 'Chân 1',
        type: 'passive',
        localOffset: { x: -2.54, y: 1, z: 0 },
        description: 'Đầu cảm biến 1',
        designator: '1',
      },
      {
        id: 'pin2',
        name: 'Chân 2',
        type: 'passive',
        localOffset: { x: 2.54, y: 1, z: 0 },
        description: 'Đầu cảm biến 2',
        designator: '2',
      },
    ],
    defaultParameters: {
      lightLevelPercent: 50, // 0% tối, 100% sáng
      darkResistance: 1000000, // 1M
      lightResistance: 400, // 400 Ohm
    },
    parameterSchema: [
      {
        name: 'lightLevelPercent',
        label: 'Mức ánh sáng môi trường (%)',
        type: 'number',
        min: 0,
        max: 100,
        default: 50,
      },
    ],
  },
  {
    definitionId: 'relay',
    version: '1.0.0',
    name: 'Rơ-le cách ly 5V (SPDT Relay)',
    category: 'switches',
    description: 'Rơ-le điện cơ đóng cắt tiếp điểm cách ly quang/từ để điều khiển tải công suất lớn.',
    dimensions: { x: 20, y: 15, z: 16 },
    footprintType: 'through-hole',
    pins: [
      {
        id: 'coil_pos',
        name: 'Cuộn hút (+)',
        type: 'power',
        localOffset: { x: -7, y: 1, z: -4 },
        description: 'Kích nguồn 5V cuộn dây',
        designator: 'IN',
      },
      {
        id: 'coil_neg',
        name: 'Cuộn hút (-)',
        type: 'ground',
        localOffset: { x: -7, y: 1, z: 4 },
        description: 'Mass cuộn dây',
        designator: 'GND',
      },
      {
        id: 'com',
        name: 'Chung (COM)',
        type: 'passive',
        localOffset: { x: 7, y: 1, z: 0 },
        description: 'Chân chung COM',
        designator: 'COM',
      },
      {
        id: 'no',
        name: 'Thường mở (NO)',
        type: 'passive',
        localOffset: { x: 7, y: 1, z: -4 },
        description: 'Tiếp điểm thường mở (Normally Open)',
        designator: 'NO',
      },
    ],
    defaultParameters: {
      isEnergized: false,
    },
    parameterSchema: [],
  },
  {
    definitionId: 'ne555',
    version: '1.0.0',
    name: 'IC Định thời (NE555 Timer)',
    category: 'ics',
    description: 'IC định thời huyền thoại dạng DIP-8, tạo dao động xung vuông, chớp đèn và trễ thời gian.',
    dimensions: { x: 16, y: 7, z: 12 },
    footprintType: 'through-hole',
    pins: [
      { id: 'vcc', name: 'VCC (Chân 8)', type: 'power', localOffset: { x: -5, y: 1, z: 4 }, designator: 'VCC' },
      { id: 'gnd', name: 'GND (Chân 1)', type: 'ground', localOffset: { x: -5, y: 1, z: -4 }, designator: 'GND' },
      { id: 'out', name: 'OUT (Chân 3)', type: 'output', localOffset: { x: 0, y: 1, z: -4 }, designator: 'OUT' },
      { id: 'trig', name: 'TRIG (Chân 2)', type: 'input', localOffset: { x: -2.5, y: 1, z: -4 }, designator: 'TRG' },
    ],
    defaultParameters: {
      mode: 'astable',
    },
    parameterSchema: [],
  },
  {
    definitionId: 'logic-and',
    version: '1.0.0',
    name: 'Cổng Logic AND (74HC08)',
    category: 'ics',
    description: 'Cổng logic số AND: Ngõ ra OUT chỉ ở mức cao khi CẢ HAI ngõ vào A và B cùng ở mức cao.',
    dimensions: { x: 16, y: 7, z: 12 },
    footprintType: 'through-hole',
    pins: [
      { id: 'vcc', name: 'VCC', type: 'power', localOffset: { x: -5, y: 1, z: 4 }, designator: 'VCC' },
      { id: 'gnd', name: 'GND', type: 'ground', localOffset: { x: -5, y: 1, z: -4 }, designator: 'GND' },
      { id: 'in_a', name: 'Ngõ vào A', type: 'input', localOffset: { x: -2, y: 1, z: -4 }, designator: 'A' },
      { id: 'in_b', name: 'Ngõ vào B', type: 'input', localOffset: { x: 1, y: 1, z: -4 }, designator: 'B' },
      { id: 'out_y', name: 'Ngõ ra Y (A & B)', type: 'output', localOffset: { x: 4, y: 1, z: -4 }, designator: 'Y' },
    ],
    defaultParameters: {},
    parameterSchema: [],
  },
  {
    definitionId: 'arduino-uno',
    version: '1.0.0',
    name: 'Bo mạch Arduino UNO R3',
    category: 'microcontrollers',
    description: 'Bo mạch vi điều khiển ATmega328P với nguồn 5V/3.3V, chân Digital D13 và chân Analog A0 tích hợp.',
    dimensions: { x: 68, y: 12, z: 53 },
    footprintType: 'modular',
    imageUrl: '/picture/ArdruinoUNO.png',
    modelUrl: '/3d-model/arduino_uno.glb',
    pins: [
      // Top Header 1 (10-pin digital: SCL to D8)
      { id: 'pin_scl', name: 'SCL (I2C Clock)', type: 'bidirectional', localOffset: { x: -12.29, y: 7.15, z: -21.47 }, designator: 'SCL' },
      { id: 'pin_sda', name: 'SDA (I2C Data)', type: 'bidirectional', localOffset: { x: -9.75, y: 7.15, z: -21.47 }, designator: 'SDA' },
      { id: 'pin_aref', name: 'AREF (Tham chiếu Analog)', type: 'input', localOffset: { x: -7.21, y: 7.15, z: -21.47 }, designator: 'AREF' },
      { id: 'pin_gnd_top', name: 'GND (Đất số)', type: 'ground', localOffset: { x: -4.67, y: 7.15, z: -21.47 }, designator: 'GND' },
      { id: 'pin_d13', name: 'D13 (SCK / LED onboard)', type: 'output', localOffset: { x: -2.13, y: 7.15, z: -21.47 }, designator: 'D13' },
      { id: 'pin_d12', name: 'D12 (MISO / GPIO)', type: 'bidirectional', localOffset: { x: 0.41, y: 7.15, z: -21.47 }, designator: 'D12' },
      { id: 'pin_d11', name: 'D11 (~PWM / MOSI)', type: 'bidirectional', localOffset: { x: 2.95, y: 7.15, z: -21.47 }, designator: '~D11' },
      { id: 'pin_d10', name: 'D10 (~PWM / SS)', type: 'bidirectional', localOffset: { x: 5.49, y: 7.15, z: -21.47 }, designator: '~D10' },
      { id: 'pin_d9', name: 'D9 (~PWM)', type: 'bidirectional', localOffset: { x: 8.03, y: 7.15, z: -21.47 }, designator: '~D9' },
      { id: 'pin_d8', name: 'D8 (GPIO)', type: 'bidirectional', localOffset: { x: 10.57, y: 7.15, z: -21.47 }, designator: 'D8' },

      // Top Header 2 (8-pin digital: D7 to D0)
      { id: 'pin_d7', name: 'D7 (GPIO)', type: 'bidirectional', localOffset: { x: 12.19, y: 7.15, z: -21.76 }, designator: 'D7' },
      { id: 'pin_d6', name: 'D6 (~PWM)', type: 'bidirectional', localOffset: { x: 14.73, y: 7.15, z: -21.76 }, designator: '~D6' },
      { id: 'pin_d5', name: 'D5 (~PWM)', type: 'bidirectional', localOffset: { x: 17.27, y: 7.15, z: -21.76 }, designator: '~D5' },
      { id: 'pin_d4', name: 'D4 (GPIO)', type: 'bidirectional', localOffset: { x: 19.81, y: 7.15, z: -21.76 }, designator: 'D4' },
      { id: 'pin_d3', name: 'D3 (~PWM / INT1)', type: 'bidirectional', localOffset: { x: 22.35, y: 7.15, z: -21.76 }, designator: '~D3' },
      { id: 'pin_d2', name: 'D2 (GPIO / INT0)', type: 'bidirectional', localOffset: { x: 24.89, y: 7.15, z: -21.76 }, designator: 'D2' },
      { id: 'pin_d1', name: 'D1 (TX / Truyền UART)', type: 'output', localOffset: { x: 27.43, y: 7.15, z: -21.76 }, designator: 'TX' },
      { id: 'pin_d0', name: 'D0 (RX / Nhận UART)', type: 'input', localOffset: { x: 29.97, y: 7.15, z: -21.76 }, designator: 'RX' },

      // Bottom Power Header (NC to VIN)
      { id: 'pin_nc', name: 'NC (Không kết nối)', type: 'passive', localOffset: { x: -3.74, y: 7.15, z: 21.31 }, designator: 'NC' },
      { id: 'pin_ioref', name: 'IOREF (Điện áp tham chiếu 5V)', type: 'power', localOffset: { x: -1.20, y: 7.15, z: 21.31 }, designator: 'IOREF' },
      { id: 'pin_reset', name: 'RESET (Khởi động lại MCU)', type: 'input', localOffset: { x: 1.34, y: 7.15, z: 21.31 }, designator: 'RST' },
      { id: 'pin_3v3', name: '3.3V (Nguồn ra 3.3V)', type: 'power', localOffset: { x: 3.88, y: 7.15, z: 21.31 }, designator: '3V3' },
      { id: 'pin_5v', name: '5V (Nguồn cấp chính 5V)', type: 'power', localOffset: { x: 6.42, y: 7.15, z: 21.31 }, designator: '5V' },
      { id: 'pin_gnd', name: 'GND (Đất / Cực âm 1)', type: 'ground', localOffset: { x: 8.96, y: 7.15, z: 21.31 }, designator: 'GND' },
      { id: 'pin_gnd2', name: 'GND 2 (Đất / Cực âm 2)', type: 'ground', localOffset: { x: 11.50, y: 7.15, z: 21.31 }, designator: 'GND' },
      { id: 'pin_vin', name: 'VIN (Nguồn vào 7-12V)', type: 'power', localOffset: { x: 14.04, y: 7.15, z: 21.31 }, designator: 'VIN' },

      // Bottom Analog Header (A0 to A5)
      { id: 'pin_a0', name: 'A0 (Ngõ vào Analog 0)', type: 'input', localOffset: { x: 16.91, y: 7.15, z: 21.36 }, designator: 'A0' },
      { id: 'pin_a1', name: 'A1 (Ngõ vào Analog 1)', type: 'input', localOffset: { x: 19.45, y: 7.15, z: 21.36 }, designator: 'A1' },
      { id: 'pin_a2', name: 'A2 (Ngõ vào Analog 2)', type: 'input', localOffset: { x: 21.99, y: 7.15, z: 21.36 }, designator: 'A2' },
      { id: 'pin_a3', name: 'A3 (Ngõ vào Analog 3)', type: 'input', localOffset: { x: 24.53, y: 7.15, z: 21.36 }, designator: 'A3' },
      { id: 'pin_a4', name: 'A4 (Ngõ vào Analog 4 / SDA)', type: 'bidirectional', localOffset: { x: 27.07, y: 7.15, z: 21.36 }, designator: 'A4' },
      { id: 'pin_a5', name: 'A5 (Ngõ vào Analog 5 / SCL)', type: 'bidirectional', localOffset: { x: 29.61, y: 7.15, z: 21.36 }, designator: 'A5' },
    ],
    defaultParameters: {
      codeProgram: 'blink_led',
      clockFrequency: 16,
      operatingVoltage: 5.0,
      d13State: true,
    },
    parameterSchema: [
      {
        name: 'codeProgram',
        label: 'Chương trình nhúng',
        type: 'select',
        options: [
          { label: 'Blink LED D13 (1Hz chu kỳ chuẩn)', value: 'blink_led' },
          { label: 'Đọc nút bấm chân D12 điều khiển LED', value: 'button_read' },
          { label: 'Đọc biến trở Analog A0', value: 'analog_read' },
          { label: 'Điều khiển góc Servo PWM D9', value: 'servo_control' },
        ],
        default: 'blink_led',
      },
      {
        name: 'operatingVoltage',
        label: 'Điện áp logic (V)',
        type: 'select',
        options: [
          { label: '5.0V (Tiêu chuẩn UNO)', value: 5.0 },
          { label: '3.3V (Chế độ tiết kiệm)', value: 3.3 },
        ],
        default: 5.0,
      },
    ],
  },
  {
    definitionId: 'breadboard',
    version: '1.0.0',
    name: 'Bo mạch Breadboard (Bo test)',
    category: 'connectors',
    description: 'Bo mạch thử nghiệm cắm dây không cần hàn, gồm 2 hàng thanh nguồn (+/-) và các rãnh kết nối cắm linh kiện.',
    dimensions: { x: 165, y: 10, z: 55 },
    footprintType: 'modular',
    modelUrl: '/3d-model/breadboard.glb',
    pins: generateBreadboardPins(),
    defaultParameters: {
      tiePoints: 400,
      railVoltage: 5.0,
      boardType: 'half',
      notes: 'Breadboard cắm IC và mạch mẫu',
    },
    parameterSchema: [
      {
        name: 'tiePoints',
        label: 'Số điểm cắm (Tie-points)',
        type: 'select',
        options: [
          { label: '400 Điểm (Chuẩn Half Size)', value: 400 },
          { label: '830 Điểm (Chuẩn Full Size)', value: 830 },
          { label: '170 Điểm (Chuẩn Mini Prototyping)', value: 170 },
        ],
        default: 400,
      },
      {
        name: 'railVoltage',
        label: 'Điện áp thanh Bus nguồn (V)',
        type: 'select',
        options: [
          { label: '5.0V (Chuẩn USB / MCU)', value: 5.0 },
          { label: '3.3V (Chuẩn Cảm biến / ESP)', value: 3.3 },
          { label: '12.0V (Nguồn công suất)', value: 12.0 },
        ],
        default: 5.0,
      },
      {
        name: 'notes',
        label: 'Ghi chú bo mạch',
        type: 'string',
        default: 'Breadboard cắm IC và mạch mẫu',
      },
    ],
  },
  {
    definitionId: 'temp-sensor',
    version: '1.0.0',
    name: 'Cảm biến nhiệt độ LM35',
    category: 'sensors',
    description: 'Cảm biến nhiệt độ tuyến tính chuẩn xác, cho điện áp ra 10mV mỗi độ Celsius (°C).',
    dimensions: { x: 6, y: 10, z: 5 },
    footprintType: 'through-hole',
    pins: [
      { id: 'vcc', name: 'VCC (+4V - 20V)', type: 'power', localOffset: { x: -2.5, y: 1, z: 0 }, designator: '+' },
      { id: 'vout', name: 'VOUT (10mV/°C)', type: 'output', localOffset: { x: 0, y: 1, z: 0 }, designator: 'OUT' },
      { id: 'gnd', name: 'GND (-)', type: 'ground', localOffset: { x: 2.5, y: 1, z: 0 }, designator: '-' },
    ],
    defaultParameters: {
      temperatureC: 25,
    },
    parameterSchema: [
      {
        name: 'temperatureC',
        label: 'Nhiệt độ môi trường (°C)',
        type: 'number',
        min: -10,
        max: 100,
        default: 25,
      },
    ],
  },
  {
    definitionId: 'transistor-npn',
    version: '1.0.0',
    name: 'Transistor NPN (2N2222)',
    category: 'semiconductors',
    description: 'Transistor lưỡng cực NPN đóng vai trò công tắc điện tử hoặc bộ khuếch đại dòng.',
    dimensions: { x: 6, y: 10, z: 6 },
    footprintType: 'through-hole',
    pins: [
      { id: 'collector', name: 'Collector (C)', type: 'passive', localOffset: { x: -2.54, y: 1, z: 0 }, designator: 'C' },
      { id: 'base', name: 'Base (B)', type: 'input', localOffset: { x: 0, y: 1, z: 1.5 }, designator: 'B' },
      { id: 'emitter', name: 'Emitter (E)', type: 'ground', localOffset: { x: 2.54, y: 1, z: 0 }, designator: 'E' },
    ],
    defaultParameters: {
      gainBeta: 100,
      isConducting: false,
    },
    parameterSchema: [],
  },
  {
    definitionId: 'ultrasonic-sensor',
    version: '1.0.0',
    name: 'Cảm biến siêu âm (HC-SR04)',
    category: 'sensors',
    description: 'Cảm biến khoảng cách siêu âm 40kHz với hai mắt phát/thu, dải đo 2cm - 400cm.',
    dimensions: { x: 45, y: 20, z: 15 },
    footprintType: 'modular',
    pins: [
      { id: 'vcc', name: 'VCC (5V)', type: 'power', localOffset: { x: -7.62, y: 1, z: 5 }, designator: 'VCC' },
      { id: 'trig', name: 'Trig (Kích)', type: 'input', localOffset: { x: -2.54, y: 1, z: 5 }, designator: 'TRG' },
      { id: 'echo', name: 'Echo (Phản hồi)', type: 'output', localOffset: { x: 2.54, y: 1, z: 5 }, designator: 'ECH' },
      { id: 'gnd', name: 'GND (Đất)', type: 'ground', localOffset: { x: 7.62, y: 1, z: 5 }, designator: 'GND' },
    ],
    defaultParameters: {
      distanceCm: 15,
    },
    parameterSchema: [
      {
        name: 'distanceCm',
        label: 'Khoảng cách vật thể (cm)',
        type: 'number',
        min: 2,
        max: 400,
        default: 15,
      },
    ],
  },
  {
    definitionId: 'servo-motor',
    version: '1.0.0',
    name: 'Động cơ Servo (SG90)',
    category: 'opto',
    description: 'Động cơ servo vi mô góc quay 0° - 180° điều khiển bằng xung PWM cho cửa tự động.',
    dimensions: { x: 23, y: 26, z: 12 },
    footprintType: 'modular',
    pins: [
      { id: 'gnd', name: 'GND (Nâu)', type: 'ground', localOffset: { x: -2.54, y: 1, z: 0 }, designator: 'GND' },
      { id: 'vcc', name: '5V (Đỏ)', type: 'power', localOffset: { x: 0, y: 1, z: 0 }, designator: 'VCC' },
      { id: 'signal', name: 'Signal PWM (Cam)', type: 'input', localOffset: { x: 2.54, y: 1, z: 0 }, designator: 'SIG' },
    ],
    defaultParameters: {
      targetAngle: 90,
    },
    parameterSchema: [
      {
        name: 'targetAngle',
        label: 'Góc quay (độ)',
        type: 'number',
        min: 0,
        max: 180,
        default: 90,
      },
    ],
  },
  {
    definitionId: 'rgb-led',
    version: '1.0.0',
    name: 'Đèn LED RGB 5mm (Common Cathode)',
    category: 'semiconductors',
    description: 'LED ba màu Đỏ, Xanh lá, Xanh dương chung cực âm Cathode GND.',
    dimensions: { x: 8, y: 10, z: 8 },
    footprintType: 'through-hole',
    pins: [
      { id: 'red', name: 'Red (R)', type: 'input', localOffset: { x: -3.81, y: 1, z: 0 }, designator: 'R' },
      { id: 'cathode', name: 'Cathode (GND)', type: 'ground', localOffset: { x: -1.27, y: 1, z: 0 }, designator: 'K' },
      { id: 'green', name: 'Green (G)', type: 'input', localOffset: { x: 1.27, y: 1, z: 0 }, designator: 'G' },
      { id: 'blue', name: 'Blue (B)', type: 'input', localOffset: { x: 3.81, y: 1, z: 0 }, designator: 'B' },
    ],
    defaultParameters: {
      colorState: 'green',
    },
    parameterSchema: [
      {
        name: 'colorState',
        label: 'Màu sáng hiện tại',
        type: 'select',
        options: [
          { label: 'Đỏ (Báo động/Đóng)', value: 'red' },
          { label: 'Xanh lá (An toàn/Mở)', value: 'green' },
          { label: 'Xanh lam (Chờ)', value: 'blue' },
        ],
        default: 'green',
      },
    ],
  },

  // 19. 7-Segment LED Display
  {
    definitionId: '7seg-display',
    version: '1.0.0',
    name: 'LED 7 Đoạn (7-Segment)',
    category: 'opto',
    description: 'Màn hình hiển thị số LED 7 đoạn (0-9) chuẩn Cathode chung',
    footprintType: 'through-hole',
    dimensions: { x: 12.6, y: 8, z: 19 },
    pins: [
      { id: 'com', name: 'COM (GND)', type: 'ground', localOffset: { x: 0, y: 1.5, z: 7.62 }, designator: 'COM' },
      { id: 'seg_a', name: 'Đoạn A', type: 'input', localOffset: { x: 2.54, y: 1.5, z: -7.62 }, designator: 'A' },
      { id: 'seg_b', name: 'Đoạn B', type: 'input', localOffset: { x: 5.08, y: 1.5, z: -7.62 }, designator: 'B' },
      { id: 'seg_c', name: 'Đoạn C', type: 'input', localOffset: { x: 2.54, y: 1.5, z: 7.62 }, designator: 'C' },
      { id: 'dp', name: 'Dấu chấm (DP)', type: 'input', localOffset: { x: 5.08, y: 1.5, z: 7.62 }, designator: 'DP' },
    ],
    defaultParameters: { digit: 8, color: 'red' },
    parameterSchema: [
      {
        name: 'digit',
        label: 'Số hiển thị',
        type: 'number',
        min: 0,
        max: 9,
        step: 1,
        default: 8,
      },
      {
        name: 'color',
        label: 'Màu LED',
        type: 'select',
        options: [
          { label: 'Đỏ', value: 'red' },
          { label: 'Xanh lá', value: 'green' },
          { label: 'Xanh lam', value: 'blue' },
        ],
        default: 'red',
      },
    ],
  },

  // 20. OLED 0.96" I2C Display
  {
    definitionId: 'oled-i2c',
    version: '1.0.0',
    name: 'Màn hình OLED 0.96" I2C',
    category: 'opto',
    description: 'Màn hình đồ họa OLED 128x64 giao tiếp I2C 4 chân (GND, VCC, SCL, SDA)',
    footprintType: 'modular',
    dimensions: { x: 27, y: 5, z: 27 },
    pins: [
      { id: 'gnd', name: 'GND', type: 'ground', localOffset: { x: -3.81, y: 2.5, z: -11 }, designator: 'GND' },
      { id: 'vcc', name: 'VCC (3.3-5V)', type: 'power', localOffset: { x: -1.27, y: 2.5, z: -11 }, designator: 'VCC' },
      { id: 'scl', name: 'SCL (Clock)', type: 'input', localOffset: { x: 1.27, y: 2.5, z: -11 }, designator: 'SCL' },
      { id: 'sda', name: 'SDA (Data)', type: 'bidirectional', localOffset: { x: 3.81, y: 2.5, z: -11 }, designator: 'SDA' },
    ],
    defaultParameters: { contrast: 100 },
    parameterSchema: [
      {
        name: 'contrast',
        label: 'Độ sáng màn hình',
        type: 'number',
        unit: '%',
        min: 10,
        max: 100,
        step: 10,
        default: 100,
      },
    ],
  },

  // 21. Ultrasonic Sensor HC-SR04
  {
    definitionId: 'ultrasonic-sr04',
    version: '1.0.0',
    name: 'Cảm biến siêu âm HC-SR04',
    category: 'sensors',
    description: 'Cảm biến đo khoảng cách bằng sóng siêu âm 2cm - 400cm (VCC, TRIG, ECHO, GND)',
    footprintType: 'modular',
    dimensions: { x: 45, y: 15, z: 20 },
    pins: [
      { id: 'vcc', name: 'VCC (5V)', type: 'power', localOffset: { x: -3.81, y: 2, z: 8 }, designator: 'VCC' },
      { id: 'trig', name: 'Trigger', type: 'input', localOffset: { x: -1.27, y: 2, z: 8 }, designator: 'TRIG' },
      { id: 'echo', name: 'Echo', type: 'output', localOffset: { x: 1.27, y: 2, z: 8 }, designator: 'ECHO' },
      { id: 'gnd', name: 'GND', type: 'ground', localOffset: { x: 3.81, y: 2, z: 8 }, designator: 'GND' },
    ],
    defaultParameters: { distanceCm: 25 },
    parameterSchema: [
      {
        name: 'distanceCm',
        label: 'Khoảng cách vật cản',
        type: 'number',
        unit: 'cm',
        min: 2,
        max: 400,
        step: 1,
        default: 25,
      },
    ],
  },

  // 22. Micro Servo SG90
  {
    definitionId: 'servo-sg90',
    version: '1.0.0',
    name: 'Động cơ Servo SG90',
    category: 'connectors',
    description: 'Động cơ góc quay chính xác 0-180° điều khiển bằng xung PWM 50Hz',
    footprintType: 'modular',
    dimensions: { x: 23, y: 22, z: 12 },
    pins: [
      { id: 'pwm', name: 'PWM (Cam)', type: 'input', localOffset: { x: -2.54, y: 2, z: 8 }, designator: 'PWM' },
      { id: 'vcc', name: 'VCC 5V (Đỏ)', type: 'power', localOffset: { x: 0, y: 2, z: 8 }, designator: 'VCC' },
      { id: 'gnd', name: 'GND (Nâu)', type: 'ground', localOffset: { x: 2.54, y: 2, z: 8 }, designator: 'GND' },
    ],
    defaultParameters: { angle: 90 },
    parameterSchema: [
      {
        name: 'angle',
        label: 'Góc quay trục',
        type: 'number',
        unit: '°',
        min: 0,
        max: 180,
        step: 15,
        default: 90,
      },
    ],
  },

  // 23. DC Motor 3-6V
  {
    definitionId: 'dc-motor',
    version: '1.0.0',
    name: 'Động cơ DC 3-6V',
    category: 'power',
    description: 'Động cơ điện một chiều nam châm vĩnh cửu dùng cho quạt, xe robot và băng tải',
    footprintType: 'modular',
    dimensions: { x: 20, y: 15, z: 25 },
    pins: [
      { id: 'pos', name: 'Cực Dương (M+)', type: 'passive', localOffset: { x: -4, y: 4, z: 10 }, designator: 'M+' },
      { id: 'neg', name: 'Cực Âm (M-)', type: 'passive', localOffset: { x: 4, y: 4, z: 10 }, designator: 'M-' },
    ],
    defaultParameters: { rpm: 3000 },
    parameterSchema: [
      {
        name: 'rpm',
        label: 'Tốc độ định mức',
        type: 'number',
        unit: 'RPM',
        min: 500,
        max: 10000,
        step: 500,
        default: 3000,
      },
    ],
  },

  // 24. Voltage Regulator LM7805
  {
    definitionId: 'voltage-reg-7805',
    version: '1.0.0',
    name: 'IC Ổn áp LM7805 (5V)',
    category: 'ics',
    description: 'IC ổn áp tuyến tính 5V 1.5A kiểu chân TO-220 có cánh tản nhiệt nhôm',
    footprintType: 'through-hole',
    dimensions: { x: 10, y: 15, z: 4.5 },
    pins: [
      { id: 'vin', name: 'VIN (7-24V)', type: 'power', localOffset: { x: -2.54, y: 1.5, z: 0 }, designator: 'IN' },
      { id: 'gnd', name: 'GND', type: 'ground', localOffset: { x: 0, y: 1.5, z: 0 }, designator: 'GND' },
      { id: 'vout', name: 'VOUT (5V)', type: 'power', localOffset: { x: 2.54, y: 1.5, z: 0 }, designator: 'OUT' },
    ],
    defaultParameters: { outputVoltage: 5.0 },
    parameterSchema: [
      {
        name: 'outputVoltage',
        label: 'Điện áp ngõ ra',
        type: 'select',
        options: [
          { label: '5.0V (LM7805)', value: 5.0 },
          { label: '3.3V (AMS1117)', value: 3.3 },
          { label: '12.0V (LM7812)', value: 12.0 },
        ],
        default: 5.0,
      },
    ],
  },
];

export const COMPONENT_DEFINITION_MAP = new Map<string, ComponentDefinition>(
  COMPONENT_DEFINITIONS.map((def) => [def.definitionId, def])
);

// Register legacy/marketplace alias definitions so all snapshots render 100% of components
const dcSourceDef = COMPONENT_DEFINITION_MAP.get('dc-source')!;
const resistorDef = COMPONENT_DEFINITION_MAP.get('resistor')!;
const ledDef = COMPONENT_DEFINITION_MAP.get('led')!;

if (dcSourceDef) {
  COMPONENT_DEFINITION_MAP.set('terminal_block_2pin', {
    ...dcSourceDef,
    definitionId: 'terminal_block_2pin',
    name: 'Cọc đấu dây nguồn 2 chân',
    pins: [
      { id: 'pin_1', name: 'VCC (+)', type: 'power', localOffset: { x: 6, y: 2.5, z: -2.54 }, designator: '+' },
      { id: 'pin_2', name: 'GND (-)', type: 'ground', localOffset: { x: 6, y: 2.5, z: 2.54 }, designator: '-' },
      ...dcSourceDef.pins,
    ],
  });
}

if (resistorDef) {
  COMPONENT_DEFINITION_MAP.set('resistor_axial', {
    ...resistorDef,
    definitionId: 'resistor_axial',
    pins: [
      { id: 'pin_1', name: 'Chân 1', type: 'passive', localOffset: { x: -5.08, y: 0, z: 0 }, designator: '1' },
      { id: 'pin_2', name: 'Chân 2', type: 'passive', localOffset: { x: 5.08, y: 0, z: 0 }, designator: '2' },
      ...resistorDef.pins,
    ],
  });
}

if (ledDef) {
  COMPONENT_DEFINITION_MAP.set('led_basic', {
    ...ledDef,
    definitionId: 'led_basic',
  });
}

const arduinoDef = COMPONENT_DEFINITION_MAP.get('arduino-uno');
if (arduinoDef) {
  COMPONENT_DEFINITION_MAP.set('arduino_uno', {
    ...arduinoDef,
    definitionId: 'arduino_uno',
  });
}

export function getComponentDefinition(id: string): ComponentDefinition | undefined {
  return COMPONENT_DEFINITION_MAP.get(id);
}

