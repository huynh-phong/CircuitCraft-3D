import { ComponentDefinition, PinDefinition } from '../project/types';

/**
 * Returns the electrical internal bus identifier for a breadboard pin.
 * All pins sharing the same busId on a breadboard are electrically tied together.
 */
export const BREADBOARD_COLUMNS = 60;
/** Column after which split power rails are interrupted (holes 1-30 | 31-60). */
export const BREADBOARD_RAIL_SPLIT_AFTER = 30;

/** Column a legacy `strip_N_top/bot` pin sits on (10 legacy strips spread over the 60 columns). */
export function legacyStripColumn(strip: number): number {
  return Math.round(1 + ((strip - 1) / 9) * (BREADBOARD_COLUMNS - 1));
}

/**
 * @param options.railSplit true for boards whose power rails are cut in the middle
 *   (many full-size boards): holes 1-30 and 31-60 of a rail are then separate buses.
 */
export function getBreadboardBusId(pinId: string, options: { railSplit?: boolean } = {}): string {
  const rail = /^rail_(top|bot)_(pos|neg)(?:_(\d+))?$/.exec(pinId);
  if (rail) {
    const base = `rail_${rail[1]}_${rail[2]}`;
    if (!options.railSplit || !rail[3]) return base;
    return Number(rail[3]) <= BREADBOARD_RAIL_SPLIT_AFTER ? `${base}_left` : `${base}_right`;
  }

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
    // Legacy strip pins are drawn on column legacyStripColumn(N): they join THAT column's bus,
    // so a wire to strip_2_top reaches the parts plugged in where the hole is shown (column 8).
    const parts = pinId.split('_');
    return `col_${legacyStripColumn(Number(parts[1]))}_${parts[2]}`;
  }

  return pinId;
}

/**
 * Generates the 60 columns (rows A-J: 600 terminal holes) and four power rails of 60 holes each
 * (240 holes) of the breadboard model. Hole pitch 2.54 mm; rows E and F are 7.68 mm apart across
 * the centre channel, so DIP ICs (row spacing 7.62 mm) straddle it like on a real board.
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
      description: `Thanh nguồn dương (+) phía trên (nối chung cả thanh; nếu chọn kiểu thanh ngắt giữa thì lỗ 1-30 và 31-60 tách riêng)`,
    });
    pins.push({
      id: `rail_top_neg_${c}`,
      name: `Thanh (-) Mass Trên - Lỗ ${c}`,
      type: 'ground',
      localOffset: { x, y: 9.8, z: -25.8 },
      designator: `-T${c}`,
      description: `Thanh mass GND (-) phía trên (nối chung cả thanh; nếu chọn kiểu thanh ngắt giữa thì lỗ 1-30 và 31-60 tách riêng)`,
    });
    pins.push({
      id: `rail_bot_pos_${c}`,
      name: `Thanh (+) Nguồn Dưới - Lỗ ${c}`,
      type: 'power',
      localOffset: { x, y: 9.8, z: 23.5 },
      designator: `+B${c}`,
      description: `Thanh nguồn dương (+) phía dưới (nối chung cả thanh; nếu chọn kiểu thanh ngắt giữa thì lỗ 1-30 và 31-60 tách riêng)`,
    });
    pins.push({
      id: `rail_bot_neg_${c}`,
      name: `Thanh (-) Mass Dưới - Lỗ ${c}`,
      type: 'ground',
      localOffset: { x, y: 9.8, z: 25.8 },
      designator: `-B${c}`,
      description: `Thanh mass GND (-) phía dưới (nối chung cả thanh; nếu chọn kiểu thanh ngắt giữa thì lỗ 1-30 và 31-60 tách riêng)`,
    });
  }

  // Backward compatibility aliases for existing samples/lessons
  for (let i = 1; i <= 10; i++) {
    const colIdx = legacyStripColumn(i);
    pins.push(
      { id: `strip_${i}_top`, name: `Hàng cắm ${i} Trên (A-E)`, type: 'passive', localOffset: { x: Number(((colIdx - 1 - halfCols) * colPitch).toFixed(2)), y: 9.8, z: -8.92 }, designator: `${i}T` },
      { id: `strip_${i}_bot`, name: `Hàng cắm ${i} Dưới (F-J)`, type: 'passive', localOffset: { x: Number(((colIdx - 1 - halfCols) * colPitch).toFixed(2)), y: 9.8, z: 8.92 }, designator: `${i}B` }
    );
  }

  return pins;
}

/** Sample programs the Arduino UNO model can run (behavioural, see simulation/engine.ts). */
export const ARDUINO_PROGRAM_OPTIONS = [
  { label: 'Không chạy chương trình (chỉ cấp nguồn, mọi chân ở chế độ INPUT)', value: 'none' },
  { label: 'Blink: D13 sáng 1 s / tắt 1 s (ví dụ Blink)', value: 'blink_led' },
  { label: 'Nút bấm: D13 = digitalRead(D12)', value: 'button_read' },
  { label: 'Biến trở A0 → PWM D9 (ví dụ AnalogInOutSerial)', value: 'analog_read' },
  { label: 'Biến trở A0 → góc Servo ở D9 (ví dụ Knob)', value: 'servo_control' },
];

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
        type: 'passive',
        localOffset: { x: -2.54, y: 0, z: 0 },
        description: 'Chân dương (chân dài hơn)',
        designator: 'A',
      },
      {
        id: 'cathode',
        name: 'Cathode (-)',
        type: 'passive',
        localOffset: { x: 0, y: 0, z: 0 },
        description: 'Chân âm (chân ngắn, phía thân vát phẳng)',
        designator: 'K',
      },
    ],
    defaultParameters: {
      color: 'red',
      maxCurrent: 20, // mA (continuous forward current of a standard 5 mm indicator LED)
    },
    parameterSchema: [
      {
        name: 'color',
        label: 'Màu sắc ánh sáng',
        type: 'select',
        options: [
          { label: 'Đỏ (Red ~630nm, Vf ≈ 2.0V)', value: 'red' },
          { label: 'Xanh lục (Green ~570nm, Vf ≈ 2.2V)', value: 'green' },
          { label: 'Xanh lam (Blue ~470nm, Vf ≈ 3.0V)', value: 'blue' },
          { label: 'Vàng (Yellow ~590nm, Vf ≈ 2.1V)', value: 'yellow' },
          { label: 'Trắng (White, Vf ≈ 3.0V)', value: 'white' },
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
      currentPosition: 0.5, // 0 = wiper at pin1, 1 = wiper at pin2
    },
    parameterSchema: [
      {
        name: 'currentPosition',
        label: 'Vị trí con chạy (0 = sát Đầu 1, 1 = sát Đầu 2)',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.5,
      },
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
        name: 'voltageRating',
        label: 'Điện áp định mức (V)',
        type: 'select',
        options: [
          { label: '6.3 V', value: 6.3 },
          { label: '16 V', value: 16 },
          { label: '25 V', value: 25 },
          { label: '50 V', value: 50 },
        ],
        default: 25,
      },
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
    version: '2.0.0',
    name: 'Nút nhấn nhả (Tactile Switch)',
    category: 'switches',
    description: 'Nút bấm 6×6 mm 4 chân hồi vị tức thời: 1A–1B và 2A–2B luôn nối với nhau; nhấn nút nối nhóm 1 với nhóm 2.',
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
      {
        id: 'pin1b',
        name: 'Chân 1B',
        type: 'passive',
        localOffset: { x: -4, y: 1, z: 3 },
        description: 'Nối liền bên trong với Chân 1A (cùng một bản tiếp điểm)',
        designator: '1B',
      },
      {
        id: 'pin2b',
        name: 'Chân 2B',
        type: 'passive',
        localOffset: { x: 4, y: 1, z: 3 },
        description: 'Nối liền bên trong với Chân 2A (cùng một bản tiếp điểm)',
        designator: '2B',
      },
    ],
    defaultParameters: {
      pressed: false,
    },
    parameterSchema: [
      {
        name: 'pressed',
        label: 'Đang nhấn giữ nút',
        type: 'boolean',
        default: false,
      },
    ],
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
      forwardVoltage: 0.7, // V (piecewise-linear knee; datasheet VF max 1.1 V at 1 A)
      maxCurrent: 1000, // mA (1N4007 average rectified current 1 A)
    },
    parameterSchema: [],
  },
  {
    definitionId: 'buzzer',
    version: '1.0.0',
    name: 'Còi chíp báo động (Buzzer 5V)',
    category: 'opto',
    description: 'Còi chủ động (active buzzer, có mạch dao động bên trong) 5 V: kêu ~2,3 kHz khi được cấp 4–7 V đúng cực tính.',
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
      minVoltage: 4.0, // V, typical 5 V active buzzer operating range 4-7 V
      maxVoltage: 7.0,
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
        unit: '%',
        min: 0,
        max: 100,
        step: 5,
        default: 50,
      },
    ],
  },
  {
    definitionId: 'relay',
    version: '2.0.0',
    name: 'Rơ-le cách ly 5V (SPDT Relay)',
    category: 'switches',
    description: 'Rơ-le điện từ 5 V kiểu SRD-05VDC-SL-C (cuộn 70 Ω, hút ở ≥ 3,75 V): cuộn hút cách ly với tiếp điểm COM/NO/NC.',
    dimensions: { x: 20, y: 15, z: 16 },
    footprintType: 'through-hole',
    pins: [
      {
        id: 'coil_pos',
        name: 'Cuộn hút (+)',
        type: 'passive',
        localOffset: { x: -7, y: 1, z: -4 },
        description: 'Kích nguồn 5V cuộn dây',
        designator: 'IN',
      },
      {
        id: 'coil_neg',
        name: 'Cuộn hút (-)',
        type: 'passive',
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
      {
        id: 'nc',
        name: 'Thường đóng (NC)',
        type: 'passive',
        localOffset: { x: 7, y: 1, z: 4 },
        description: 'Tiếp điểm thường đóng (Normally Closed): nối với COM khi cuộn hút chưa được kích',
        designator: 'NC',
      },
    ],
    defaultParameters: {
      coilResistance: 70, // Ω (SRD-05VDC-SL-C)
      pickupVoltage: 3.75, // V (must-operate ≤ 75 % of 5 V)
      releaseVoltage: 0.5, // V (must-release ≥ 10 % of 5 V)
    },
    parameterSchema: [],
  },
  {
    definitionId: 'ne555',
    version: '2.0.0',
    name: 'IC Định thời (NE555 Timer)',
    category: 'ics',
    description: 'IC định thời NE555 vỏ DIP-8 (VCC 4,5–16 V): tạo xung vuông (astable) hoặc một xung trễ (monostable) theo R và C mắc ngoài.',
    dimensions: { x: 10, y: 5, z: 8 },
    footprintType: 'through-hole',
    // DIP-8, 2.54 mm pitch, 7.62 mm row spacing. Pin 1 is at the notch (−x); seen from above the
    // pins count counter-clockwise: 1-4 on the +z row, 5-8 back along the −z row.
    pins: [
      { id: 'gnd', name: 'GND (Chân 1)', type: 'ground', localOffset: { x: -3.81, y: 0, z: 3.81 }, designator: '1' },
      { id: 'trig', name: 'TRIG (Chân 2)', type: 'input', localOffset: { x: -1.27, y: 0, z: 3.81 }, designator: '2', description: 'Kích khi điện áp < 1/3 VCC' },
      { id: 'out', name: 'OUT (Chân 3)', type: 'output', localOffset: { x: 1.27, y: 0, z: 3.81 }, designator: '3' },
      { id: 'reset', name: 'RESET (Chân 4)', type: 'input', localOffset: { x: 3.81, y: 0, z: 3.81 }, designator: '4', description: 'Tích cực mức thấp; nối lên VCC khi không dùng' },
      { id: 'ctrl', name: 'CONTROL (Chân 5)', type: 'input', localOffset: { x: 3.81, y: 0, z: -3.81 }, designator: '5', description: 'Điện áp ngưỡng 2/3 VCC; thường nối tụ 10 nF xuống GND' },
      { id: 'thr', name: 'THRESHOLD (Chân 6)', type: 'input', localOffset: { x: 1.27, y: 0, z: -3.81 }, designator: '6', description: 'Ngắt khi điện áp > 2/3 VCC' },
      { id: 'dis', name: 'DISCHARGE (Chân 7)', type: 'output', localOffset: { x: -1.27, y: 0, z: -3.81 }, designator: '7', description: 'Cực collector hở, nối GND khi OUT ở mức thấp' },
      { id: 'vcc', name: 'VCC (Chân 8)', type: 'power', localOffset: { x: -3.81, y: 0, z: -3.81 }, designator: '8', description: '4,5 V – 16 V' },
    ],
    defaultParameters: {},
    parameterSchema: [],
  },
  {
    definitionId: 'logic-and',
    version: '2.0.0',
    name: 'Cổng Logic AND (74HC08)',
    category: 'ics',
    description: 'IC 74HC08 vỏ DIP-14 gồm 4 cổng AND 2 ngõ vào (VCC 2–6 V): ngõ ra Y lên mức cao khi cả A và B ở mức cao.',
    dimensions: { x: 19, y: 5, z: 8 },
    footprintType: 'through-hole',
    // DIP-14 pinout of the 74HC08 (quad 2-input AND). The original five pin ids are kept for
    // gate 1 (1A, 1B, 1Y) and the supply pins so existing wires stay valid.
    pins: [
      { id: 'in_a', name: '1A (Chân 1)', type: 'input', localOffset: { x: -7.62, y: 0, z: 3.81 }, designator: '1' },
      { id: 'in_b', name: '1B (Chân 2)', type: 'input', localOffset: { x: -5.08, y: 0, z: 3.81 }, designator: '2' },
      { id: 'out_y', name: '1Y = 1A·1B (Chân 3)', type: 'output', localOffset: { x: -2.54, y: 0, z: 3.81 }, designator: '3' },
      { id: 'in_2a', name: '2A (Chân 4)', type: 'input', localOffset: { x: 0, y: 0, z: 3.81 }, designator: '4' },
      { id: 'in_2b', name: '2B (Chân 5)', type: 'input', localOffset: { x: 2.54, y: 0, z: 3.81 }, designator: '5' },
      { id: 'out_2y', name: '2Y (Chân 6)', type: 'output', localOffset: { x: 5.08, y: 0, z: 3.81 }, designator: '6' },
      { id: 'gnd', name: 'GND (Chân 7)', type: 'ground', localOffset: { x: 7.62, y: 0, z: 3.81 }, designator: '7' },
      { id: 'out_3y', name: '3Y (Chân 8)', type: 'output', localOffset: { x: 7.62, y: 0, z: -3.81 }, designator: '8' },
      { id: 'in_3a', name: '3A (Chân 9)', type: 'input', localOffset: { x: 5.08, y: 0, z: -3.81 }, designator: '9' },
      { id: 'in_3b', name: '3B (Chân 10)', type: 'input', localOffset: { x: 2.54, y: 0, z: -3.81 }, designator: '10' },
      { id: 'out_4y', name: '4Y (Chân 11)', type: 'output', localOffset: { x: 0, y: 0, z: -3.81 }, designator: '11' },
      { id: 'in_4a', name: '4A (Chân 12)', type: 'input', localOffset: { x: -2.54, y: 0, z: -3.81 }, designator: '12' },
      { id: 'in_4b', name: '4B (Chân 13)', type: 'input', localOffset: { x: -5.08, y: 0, z: -3.81 }, designator: '13' },
      { id: 'vcc', name: 'VCC (Chân 14)', type: 'power', localOffset: { x: -7.62, y: 0, z: -3.81 }, designator: '14', description: '2 V – 6 V' },
    ],
    defaultParameters: {},
    parameterSchema: [],
  },
  {
    definitionId: 'arduino-uno',
    version: '1.0.0',
    name: 'Bo mạch Arduino UNO R3',
    category: 'microcontrollers',
    description: 'Bo Arduino UNO R3 (ATmega328P, 5 V, 16 MHz): 14 chân digital (6 chân PWM ~), 6 chân analog A0–A5, chân nguồn 5V/3.3V/VIN. Mô phỏng: nguồn USB và các chương trình mẫu chọn sẵn.',
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
      { id: 'pin_d13', name: 'D13 (SCK / LED onboard)', type: 'bidirectional', localOffset: { x: -2.13, y: 7.15, z: -21.47 }, designator: 'D13' },
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
      { id: 'pin_d1', name: 'D1 (TX / Truyền UART)', type: 'bidirectional', localOffset: { x: 27.43, y: 7.15, z: -21.76 }, designator: 'TX' },
      { id: 'pin_d0', name: 'D0 (RX / Nhận UART)', type: 'bidirectional', localOffset: { x: 29.97, y: 7.15, z: -21.76 }, designator: 'RX' },

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
    },
    parameterSchema: [
      {
        name: 'codeProgram',
        label: 'Chương trình mẫu',
        type: 'select',
        options: ARDUINO_PROGRAM_OPTIONS,
        default: 'blink_led',
      },
    ],
  },
  {
    definitionId: 'breadboard',
    version: '1.0.0',
    name: 'Bo mạch Breadboard (Bo test)',
    category: 'connectors',
    description: 'Breadboard 60 cột: mỗi cột có nhóm A–E và nhóm F–J nối dọc (tách nhau bởi rãnh giữa), cùng 4 thanh nguồn (+/−) 60 lỗ. Bước lỗ 2,54 mm.',
    dimensions: { x: 165, y: 10, z: 55 },
    footprintType: 'modular',
    modelUrl: '/3d-model/breadboard.glb',
    pins: generateBreadboardPins(),
    defaultParameters: {
      railSplit: false,
      notes: 'Breadboard cắm IC và mạch mẫu',
    },
    parameterSchema: [
      {
        name: 'railSplit',
        label: 'Thanh nguồn bị ngắt ở giữa (lỗ 1–30 tách 31–60)',
        type: 'boolean',
        default: false,
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
    name: 'Cảm biến nhiệt độ LM35 (LM35DZ, TO-92)',
    category: 'sensors',
    description: 'Cảm biến nhiệt độ tuyến tính LM35DZ (0–100 °C): VOUT = 10 mV/°C khi nguồn +VS từ 4 V đến 30 V.',
    dimensions: { x: 6, y: 10, z: 5 },
    footprintType: 'through-hole',
    pins: [
      { id: 'vcc', name: '+VS (4 V – 30 V)', type: 'power', localOffset: { x: -2.54, y: 1, z: 0 }, designator: '+VS' },
      { id: 'vout', name: 'VOUT (10 mV/°C)', type: 'output', localOffset: { x: 0, y: 1, z: 0 }, designator: 'OUT' },
      { id: 'gnd', name: 'GND', type: 'ground', localOffset: { x: 2.54, y: 1, z: 0 }, designator: 'GND' },
    ],
    defaultParameters: {
      temperatureC: 25,
    },
    parameterSchema: [
      {
        name: 'temperatureC',
        label: 'Nhiệt độ môi trường (°C)',
        type: 'number',
        unit: '°C',
        min: 0,
        max: 100,
        step: 1,
        default: 25,
      },
    ],
  },
  {
    definitionId: 'transistor-npn',
    version: '1.1.0',
    name: 'Transistor NPN (2N2222)',
    category: 'semiconductors',
    description: 'Transistor NPN 2N2222A vỏ TO-92 (IC tối đa 600 mA, VCEO 40 V): công tắc điện tử hoặc khuếch đại dòng. Thứ tự chân trên mô hình: C – B – E.',
    dimensions: { x: 6, y: 10, z: 6 },
    footprintType: 'through-hole',
    pins: [
      { id: 'collector', name: 'Collector (C)', type: 'passive', localOffset: { x: -2.54, y: 1, z: 0 }, designator: 'C' },
      { id: 'base', name: 'Base (B)', type: 'input', localOffset: { x: 0, y: 1, z: 0 }, designator: 'B' },
      { id: 'emitter', name: 'Emitter (E)', type: 'passive', localOffset: { x: 2.54, y: 1, z: 0 }, designator: 'E' },
    ],
    defaultParameters: {
      gainBeta: 100, // hFE min 100 at IC = 150 mA (PN2222A datasheet)
    },
    parameterSchema: [
      {
        name: 'gainBeta',
        label: 'Hệ số khuếch đại dòng hFE (β)',
        type: 'number',
        min: 35,
        max: 300,
        step: 5,
        default: 100,
      },
    ],
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
    deprecatedBy: 'ultrasonic-sr04',
    parameterSchema: [
      {
        name: 'distanceCm',
        label: 'Khoảng cách vật thể (cm)',
        type: 'number',
        unit: 'cm',
        min: 2,
        max: 400,
        step: 1,
        default: 15,
      },
    ],
  },
  {
    definitionId: 'servo-motor',
    version: '1.0.0',
    name: 'Động cơ Servo (SG90)',
    category: 'actuators',
    description: 'Động cơ servo SG90 (bản cũ, giữ để mở dự án cũ; chân Signal tương đương PWM). Dự án mới dùng "Động cơ Servo SG90".',
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
    deprecatedBy: 'servo-sg90',
    parameterSchema: [
      {
        name: 'targetAngle',
        label: 'Góc trục lúc lắp (khi chưa nhận xung PWM)',
        type: 'number',
        unit: '°',
        min: 0,
        max: 180,
        step: 5,
        default: 90,
      },
    ],
  },
  {
    definitionId: 'rgb-led',
    version: '1.0.0',
    name: 'Đèn LED RGB 5mm (Common Cathode)',
    category: 'semiconductors',
    description: 'LED RGB 5 mm chung cathode (chân dài nhất): mỗi màu là một LED riêng, Vf ≈ 2,0 V (đỏ) và ≈ 3,2 V (lục, lam). Màu hiển thị do dòng qua từng chân quyết định.',
    dimensions: { x: 8, y: 10, z: 8 },
    footprintType: 'through-hole',
    pins: [
      { id: 'red', name: 'Red (R)', type: 'passive', localOffset: { x: -3.81, y: 1, z: 0 }, designator: 'R' },
      { id: 'cathode', name: 'Cathode chung (chân dài nhất)', type: 'passive', localOffset: { x: -1.27, y: 1, z: 0 }, designator: 'K' },
      { id: 'green', name: 'Green (G)', type: 'passive', localOffset: { x: 1.27, y: 1, z: 0 }, designator: 'G' },
      { id: 'blue', name: 'Blue (B)', type: 'passive', localOffset: { x: 3.81, y: 1, z: 0 }, designator: 'B' },
    ],
    defaultParameters: {
      maxCurrent: 20, // mA per colour chip
    },
    parameterSchema: [],
  },

  // 19. 7-Segment LED Display
  {
    definitionId: '7seg-display',
    version: '2.0.0',
    name: 'LED 7 Đoạn (7-Segment)',
    category: 'opto',
    description: 'LED 7 đoạn 1 số loại cathode chung, 10 chân (a–g, DP, 2 chân COM): đoạn nào có dòng thuận chạy qua thì sáng.',
    footprintType: 'through-hole',
    dimensions: { x: 12.6, y: 8, z: 19 },
    // 10-pin common-cathode layout: bottom row (+z) pins 1-5 = E D COM C DP,
    // top row (−z) pins 10-6 = G F COM A B. Both COM pins are tied inside.
    pins: [
      { id: 'seg_e', name: 'Đoạn E (Chân 1)', type: 'passive', localOffset: { x: -5.08, y: 1.5, z: 7.62 }, designator: 'E' },
      { id: 'seg_d', name: 'Đoạn D (Chân 2)', type: 'passive', localOffset: { x: -2.54, y: 1.5, z: 7.62 }, designator: 'D' },
      { id: 'com', name: 'COM (Chân 3, cathode chung)', type: 'passive', localOffset: { x: 0, y: 1.5, z: 7.62 }, designator: 'COM' },
      { id: 'seg_c', name: 'Đoạn C (Chân 4)', type: 'passive', localOffset: { x: 2.54, y: 1.5, z: 7.62 }, designator: 'C' },
      { id: 'dp', name: 'Dấu chấm DP (Chân 5)', type: 'passive', localOffset: { x: 5.08, y: 1.5, z: 7.62 }, designator: 'DP' },
      { id: 'seg_b', name: 'Đoạn B (Chân 6)', type: 'passive', localOffset: { x: 5.08, y: 1.5, z: -7.62 }, designator: 'B' },
      { id: 'seg_a', name: 'Đoạn A (Chân 7)', type: 'passive', localOffset: { x: 2.54, y: 1.5, z: -7.62 }, designator: 'A' },
      { id: 'com2', name: 'COM (Chân 8, cathode chung)', type: 'passive', localOffset: { x: 0, y: 1.5, z: -7.62 }, designator: 'COM' },
      { id: 'seg_f', name: 'Đoạn F (Chân 9)', type: 'passive', localOffset: { x: -2.54, y: 1.5, z: -7.62 }, designator: 'F' },
      { id: 'seg_g', name: 'Đoạn G (Chân 10)', type: 'passive', localOffset: { x: -5.08, y: 1.5, z: -7.62 }, designator: 'G' },
    ],
    defaultParameters: { color: 'red', maxCurrent: 20 },
    parameterSchema: [
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
    description: 'Mô-đun OLED 0,96" 128×64 (chip SSD1306, I2C) 4 chân GND, VCC 3,3–5 V, SCL, SDA. Chỉ hiển thị khi có vi điều khiển gửi dữ liệu I2C.',
    footprintType: 'modular',
    dimensions: { x: 27, y: 5, z: 27 },
    pins: [
      { id: 'gnd', name: 'GND', type: 'ground', localOffset: { x: -3.81, y: 2.5, z: -11 }, designator: 'GND' },
      { id: 'vcc', name: 'VCC (3.3-5V)', type: 'power', localOffset: { x: -1.27, y: 2.5, z: -11 }, designator: 'VCC' },
      { id: 'scl', name: 'SCL (Clock)', type: 'bidirectional', localOffset: { x: 1.27, y: 2.5, z: -11 }, designator: 'SCL' },
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
    category: 'actuators',
    description: 'Servo SG90 (4,8–6 V): góc trục do độ rộng xung chu kỳ 20 ms quyết định (thư viện Servo của Arduino: 544 µs → 0°, 2400 µs → 180°).',
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
        label: 'Góc trục lúc lắp (khi chưa nhận xung PWM)',
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
    category: 'actuators',
    description: 'Động cơ DC chổi than nam châm vĩnh cửu 3–6 V. Mô hình: tải điện trở tương đương; tốc độ không tải tỉ lệ với điện áp, đảo chiều khi đảo cực.',
    footprintType: 'modular',
    dimensions: { x: 20, y: 15, z: 25 },
    pins: [
      { id: 'pos', name: 'Cực Dương (M+)', type: 'passive', localOffset: { x: -4, y: 4, z: 10 }, designator: 'M+' },
      { id: 'neg', name: 'Cực Âm (M-)', type: 'passive', localOffset: { x: 4, y: 4, z: 10 }, designator: 'M-' },
    ],
    defaultParameters: { rpm: 3000, ratedVoltage: 6, equivalentResistance: 20, startVoltage: 0.8 },
    parameterSchema: [
      {
        name: 'equivalentResistance',
        label: 'Điện trở tương đương khi quay (Ω, giả định)',
        type: 'number',
        unit: 'Ω',
        min: 1,
        max: 200,
        step: 1,
        default: 20,
      },
      {
        name: 'rpm',
        label: 'Tốc độ không tải ở 6 V',
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
    description: 'IC ổn áp tuyến tính LM78xx vỏ TO-220 (IN – GND – OUT nhìn từ mặt chữ): cần VIN cao hơn VOUT ít nhất ~2 V, dòng ra tối đa 1,5 A, VIN tối đa 35 V.',
    footprintType: 'through-hole',
    dimensions: { x: 10, y: 15, z: 4.5 },
    pins: [
      { id: 'vin', name: 'INPUT (Chân 1)', type: 'power', localOffset: { x: -2.54, y: 1.5, z: 0 }, designator: 'IN' },
      { id: 'gnd', name: 'GND (Chân 2, nối tab)', type: 'ground', localOffset: { x: 0, y: 1.5, z: 0 }, designator: 'GND' },
      { id: 'vout', name: 'OUTPUT (Chân 3)', type: 'power', localOffset: { x: 2.54, y: 1.5, z: 0 }, designator: 'OUT' },
    ],
    defaultParameters: { outputVoltage: 5.0 },
    parameterSchema: [
      {
        name: 'outputVoltage',
        label: 'Phiên bản (điện áp ra)',
        type: 'select',
        options: [
          { label: 'LM7805 – 5 V', value: 5.0 },
          { label: 'LM7812 – 12 V', value: 12.0 },
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

