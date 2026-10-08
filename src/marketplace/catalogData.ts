import { CatalogProduct } from './types';
import { createDefaultProjectDocument } from '../domain/project/document';

export const CATALOG_PRODUCTS: CatalogProduct[] = [
  {
    id: 'prod-led-dimmer',
    name: 'Mạch Dimmer LED chiết áp xoay',
    tagline: 'Điều chỉnh cường độ phát quang mượt mà qua con chạy Potentiometer',
    description:
      'Mạch thực hành kinh điển hướng dẫn kỹ thuật chia áp và phân dòng để điều khiển độ sáng của đèn LED bằng biến trở xoay 10kΩ. Kèm hướng dẫn tính toán phân cực an toàn cho bán dẫn.',
    price: 0,
    currency: 'VND',
    difficulty: 'Cơ bản',
    category: 'Chiếu sáng',
    version: '1.2.0',
    license: 'MIT Open Hardware',
    tags: ['LED', 'Potentiometer', 'Chiết áp', 'Người mới'],
    componentsSummary: ['1x Nguồn DC 5V', '1x Biến trở 10kΩ', '1x Điện trở 220Ω', '1x LED Vàng'],
    isFree: true,
    rating: 4.9,
    reviewsCount: 142,
    downloadsCount: 1850,
    author: {
      name: 'Thầy Hoàng Nam',
      verified: true,
      role: 'Kỹ sư Vi mạch Lab',
    },
    learningOutcomes: [
      'Nắm vững nguyên lý cầu phân áp (Voltage Divider)',
      'Hiểu cách con chạy biến trở thay đổi điện trở',
      'Định tuyến linh kiện gọn gàng trên bo mạch PCB',
    ],
    projectTemplate: () => {
      const doc = createDefaultProjectDocument('Dự án: Dimmer LED với Biến trở');
      doc.components = [
        {
          instanceId: 'p1',
          definitionId: 'dc-source',
          name: 'Nguồn 5V',
          position: { x: -45, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { voltage: 5.0 },
        },
        {
          instanceId: 'pot1',
          definitionId: 'potentiometer',
          name: 'POT 10k',
          position: { x: -5, y: 0, z: -15 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { maxResistance: 10000 },
        },
        {
          instanceId: 'r1',
          definitionId: 'resistor',
          name: 'R 220Ω',
          position: { x: 25, y: 0, z: -15 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { resistance: 220 },
        },
        {
          instanceId: 'led1',
          definitionId: 'led',
          name: 'LED Vàng',
          position: { x: 50, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { color: 'yellow' },
        },
      ];
      doc.connections = [
        { id: 'c1', fromComponentId: 'p1', fromPinId: 'vcc', toComponentId: 'pot1', toPinId: 'pin1', wireColor: '#ef4444' },
        { id: 'c2', fromComponentId: 'pot1', fromPinId: 'wiper', toComponentId: 'r1', toPinId: 'pin1', wireColor: '#f59e0b' },
        { id: 'c3', fromComponentId: 'r1', fromPinId: 'pin2', toComponentId: 'led1', toPinId: 'anode', wireColor: '#10b981' },
        { id: 'c4', fromComponentId: 'led1', fromPinId: 'cathode', toComponentId: 'p1', toPinId: 'gnd', wireColor: '#0f172a' },
      ];
      return doc;
    },
  },
  {
    id: 'prod-dual-light-switch',
    name: 'Hệ thống đèn kép công tắc chọn kênh',
    tagline: 'Mạch chọn kênh tín hiệu 2 trạng thái điều khiển đèn LED đỏ và xanh',
    description:
      'Mạch thực nghiệm về logic chuyển mạch cơ bản trong các thiết bị gia dụng và bảng điều khiển tín hiệu trạng thái công nghiệp (Status Indicator).',
    price: 0,
    currency: 'VND',
    difficulty: 'Cơ bản',
    category: 'Điều khiển',
    version: '1.0.0',
    license: 'CC-BY-4.0',
    tags: ['Công tắc', 'Switch', 'Đèn kép', 'Chỉ báo'],
    componentsSummary: ['1x Nguồn 5V', '1x Công tắc gạt', '2x Điện trở 330Ω', '1x LED Đỏ', '1x LED Xanh'],
    isFree: true,
    rating: 4.8,
    reviewsCount: 88,
    downloadsCount: 1240,
    author: {
      name: 'Vũ Đức Thành',
      verified: true,
      role: 'Maker & IoT Developer',
    },
    learningOutcomes: [
      'Hiểu cách ly nguồn điện bằng tiếp điểm cơ học',
      'Đấu nối nhiều nhánh song song trên một nguồn cấp chung',
      'Thao tác công tắc trực quan trong môi trường 3D',
    ],
    projectTemplate: () => {
      const doc = createDefaultProjectDocument('Dự án: Đèn kép công tắc chọn kênh');
      doc.components = [
        {
          instanceId: 'src1',
          definitionId: 'dc-source',
          name: 'Nguồn 5V',
          position: { x: -50, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { voltage: 5.0 },
        },
        {
          instanceId: 'sw1',
          definitionId: 'switch',
          name: 'SW1 (Bật/Tắt)',
          position: { x: -20, y: 0, z: -15 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { type: 'slide' },
          state: { open: false },
        },
        {
          instanceId: 'r1',
          definitionId: 'resistor',
          name: 'R1 (330Ω)',
          position: { x: 15, y: 0, z: -15 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { resistance: 330 },
        },
        {
          instanceId: 'led1',
          definitionId: 'led',
          name: 'LED Xanh',
          position: { x: 50, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { color: 'green' },
        },
      ];
      doc.connections = [
        { id: 'con1', fromComponentId: 'src1', fromPinId: 'vcc', toComponentId: 'sw1', toPinId: 'pin1', wireColor: '#ef4444' },
        { id: 'con2', fromComponentId: 'sw1', fromPinId: 'pin2', toComponentId: 'r1', toPinId: 'pin1', wireColor: '#f59e0b' },
        { id: 'con3', fromComponentId: 'r1', fromPinId: 'pin2', toComponentId: 'led1', toPinId: 'anode', wireColor: '#10b981' },
        { id: 'con4', fromComponentId: 'led1', fromPinId: 'cathode', toComponentId: 'src1', toPinId: 'gnd', wireColor: '#0f172a' },
      ];
      return doc;
    },
  },
  {
    id: 'prod-terminal-splitter',
    name: 'Module chia nguồn Terminal Block 2 cổng',
    tagline: 'Mạch phân phối nguồn ổn định với cọc đấu dây vặn vít công nghiệp',
    description:
      'Thiết kế chuẩn công nghiệp sử dụng Terminal Block chịu dòng cao, phân phối nguồn từ bộ cấp chính đến các nhánh tải phụ.',
    price: 49000,
    currency: 'VND',
    difficulty: 'Trung bình',
    category: 'Mô-đun nguồn',
    version: '2.0.0',
    license: 'Commercial Pro',
    tags: ['Terminal', 'Power Rail', 'Phân phối nguồn', 'Pro'],
    componentsSummary: ['1x Cọc đấu dây', '2x Điện trở công suất', '2x LED Báo nguồn'],
    isFree: false,
    rating: 5.0,
    reviewsCount: 35,
    downloadsCount: 420,
    author: {
      name: 'CircuitCraft Studio',
      verified: true,
      role: 'Đội ngũ kỹ thuật chính thức',
    },
    learningOutcomes: [
      'Thiết kế sơ đồ phân phối nguồn công nghiệp',
      'Đấu nối terminal block an toàn chống tuột dây',
      'Sử dụng LED chỉ báo trạng thái hoạt động của từng ray nguồn',
    ],
    projectTemplate: () => {
      const doc = createDefaultProjectDocument('Dự án Pro: Terminal Block Nguồn');
      doc.components = [
        {
          instanceId: 'src-pro',
          definitionId: 'dc-source',
          name: 'Nguồn 9V',
          position: { x: -45, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { voltage: 9.0 },
        },
        {
          instanceId: 'term-1',
          definitionId: 'connector',
          name: 'Cọc Terminal',
          position: { x: 0, y: 0, z: -10 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: {},
        },
        {
          instanceId: 'r-pro',
          definitionId: 'resistor',
          name: 'R 470Ω',
          position: { x: 25, y: 0, z: -10 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { resistance: 470 },
        },
        {
          instanceId: 'led-pro',
          definitionId: 'led',
          name: 'LED Trắng',
          position: { x: 45, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { color: 'white' },
        },
      ];
      doc.connections = [
        { id: 'c1', fromComponentId: 'src-pro', fromPinId: 'vcc', toComponentId: 'term-1', toPinId: 'pin1', wireColor: '#ef4444' },
        { id: 'c2', fromComponentId: 'term-1', fromPinId: 'pin2', toComponentId: 'r-pro', toPinId: 'pin1', wireColor: '#f59e0b' },
        { id: 'c3', fromComponentId: 'r-pro', fromPinId: 'pin2', toComponentId: 'led-pro', toPinId: 'anode', wireColor: '#10b981' },
        { id: 'c4', fromComponentId: 'led-pro', fromPinId: 'cathode', toComponentId: 'src-pro', toPinId: 'gnd', wireColor: '#0f172a' },
      ];
      return doc;
    },
  },
  {
    id: 'prod-555-pwm-controller',
    name: 'Mạch tạo xung PWM NE555 điều tốc Động cơ DC',
    tagline: 'Mạch dao động đa hài dùng IC NE555 kết hợp Transistor NPN điều khiển tốc độ động cơ 3-6V',
    description:
      'Thiết kế mạch điều khiển xung PWM thực tế sử dụng vi mạch hẹn giờ NE555 kinh điển, biến trở chỉnh chu kỳ xung (Duty Cycle), tụ nạp xả và Transistor NPN khuếch đại dòng cho động cơ DC.',
    price: 79000,
    currency: 'VND',
    difficulty: 'Trung bình',
    category: 'Điều khiển',
    version: '1.4.0',
    license: 'Commercial Pro',
    tags: ['NE555', 'PWM', 'DC Motor', 'Transistor', 'Xung nhịp'],
    componentsSummary: ['1x Nguồn DC 9V', '1x IC NE555', '1x Biến trở 10kΩ', '1x Tụ 100µF', '1x Transistor NPN', '1x Động cơ DC'],
    isFree: false,
    rating: 4.9,
    reviewsCount: 54,
    downloadsCount: 680,
    author: {
      name: 'CircuitCraft Studio',
      verified: true,
      role: 'Đội ngũ kỹ thuật chính thức',
    },
    learningOutcomes: [
      'Cấu hình IC NE555 ở chế độ dao động đa hài (Astable Mode)',
      'Điều chỉnh độ rộng xung PWM bằng biến trở và tụ điện',
      'Khuếch đại dòng tải cho động cơ DC thông qua cực góp Transistor NPN',
    ],
    projectTemplate: () => {
      const doc = createDefaultProjectDocument('Dự án: Điều tốc PWM NE555 & Động cơ DC');
      doc.board.width = 160;
      doc.board.depth = 100;
      doc.board.solderMaskColor = '#0f3b5f';
      doc.components = [
        { instanceId: 'pwr1', definitionId: 'dc-source', name: 'Nguồn 9V', position: { x: -60, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { voltage: 9.0 } },
        { instanceId: 'ic1', definitionId: 'ne555', name: 'IC NE555', position: { x: -10, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { frequency: 5 } },
        { instanceId: 'pot1', definitionId: 'potentiometer', name: 'Biến trở PWM', position: { x: -30, y: 0, z: -25 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { maxResistance: 10000 } },
        { instanceId: 'cap1', definitionId: 'capacitor', name: 'Tụ 100µF', position: { x: -30, y: 0, z: 25 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { capacitance: 100 } },
        { instanceId: 'r_base', definitionId: 'resistor', name: 'R 1kΩ', position: { x: 20, y: 0, z: -10 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { resistance: 1000 } },
        { instanceId: 'q1', definitionId: 'transistor-npn', name: 'NPN 2N2222', position: { x: 40, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { hfe: 100 } },
        { instanceId: 'mot1', definitionId: 'dc-motor', name: 'Động cơ DC', position: { x: 60, y: 0, z: -15 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { rpm: 3000 } },
      ];
      doc.connections = [
        { id: 'w1', fromComponentId: 'pwr1', fromPinId: 'vcc', toComponentId: 'ic1', toPinId: 'vcc', wireColor: '#ef4444' },
        { id: 'w2', fromComponentId: 'pwr1', fromPinId: 'gnd', toComponentId: 'ic1', toPinId: 'gnd', wireColor: '#0f172a' },
        { id: 'w3', fromComponentId: 'pot1', fromPinId: 'wiper', toComponentId: 'ic1', toPinId: 'trig', wireColor: '#eab308' },
        { id: 'w4', fromComponentId: 'ic1', fromPinId: 'trig', toComponentId: 'cap1', toPinId: 'pos', wireColor: '#f97316' },
        { id: 'w5', fromComponentId: 'cap1', fromPinId: 'neg', toComponentId: 'pwr1', toPinId: 'gnd', wireColor: '#0f172a' },
        { id: 'w6', fromComponentId: 'ic1', fromPinId: 'out', toComponentId: 'r_base', toPinId: 'pin1', wireColor: '#06b6d4' },
        { id: 'w7', fromComponentId: 'r_base', fromPinId: 'pin2', toComponentId: 'q1', toPinId: 'base', wireColor: '#06b6d4' },
        { id: 'w8', fromComponentId: 'pwr1', fromPinId: 'vcc', toComponentId: 'mot1', toPinId: 'pos', wireColor: '#ef4444' },
        { id: 'w9', fromComponentId: 'mot1', fromPinId: 'neg', toComponentId: 'q1', toPinId: 'collector', wireColor: '#22c55e' },
        { id: 'w10', fromComponentId: 'q1', fromPinId: 'emitter', toComponentId: 'pwr1', toPinId: 'gnd', wireColor: '#0f172a' },
      ];
      return doc;
    },
  },
  {
    id: 'prod-arduino-radar-node',
    name: 'Trạm Radar Siêu âm Arduino Uno & Servo SG90',
    tagline: 'Hệ thống quét khoảng cách 180° dùng HC-SR04, Servo SG90, màn hình OLED I2C và còi báo',
    description:
      'Tổ hợp mạch nhúng hoàn chỉnh kết nối vi điều khiển Arduino Uno R3 với cảm biến siêu âm HC-SR04, động cơ góc quay Servo SG90 và màn hình OLED I2C để phát hiện vật cản và cảnh báo âm thanh.',
    price: 129000,
    currency: 'VND',
    difficulty: 'Nâng cao',
    category: 'IoT & Nhúng',
    version: '2.1.0',
    license: 'Commercial Pro',
    tags: ['Arduino Uno', 'HC-SR04', 'Servo SG90', 'OLED I2C', 'Radar'],
    componentsSummary: ['1x Arduino Uno R3', '1x Siêu âm HC-SR04', '1x Servo SG90', '1x Màn hình OLED I2C', '1x Còi Buzzer'],
    isFree: false,
    rating: 5.0,
    reviewsCount: 67,
    downloadsCount: 910,
    author: {
      name: 'TS. Nguyễn Minh Hoàng',
      verified: true,
      role: 'Chuyên gia Hệ thống Nhúng & IoT',
    },
    learningOutcomes: [
      'Giao tiếp xung Trigger/Echo đo khoảng cách với cảm biến siêu âm HC-SR04',
      'Điều khiển góc quay động cơ Servo SG90 bằng chân xung PWM trên Arduino',
      'Kết nối màn hình đồ họa OLED chuẩn I2C và cảnh báo còi Buzzer chủ động',
    ],
    projectTemplate: () => {
      const doc = createDefaultProjectDocument('Dự án: Trạm Radar Siêu âm Arduino Uno & OLED');
      doc.board.width = 180;
      doc.board.depth = 120;
      doc.board.solderMaskColor = '#064e3b';
      doc.components = [
        { instanceId: 'mcu1', definitionId: 'arduino-uno', name: 'Arduino Uno R3', position: { x: -20, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { programType: 'blink' } },
        { instanceId: 'sr04', definitionId: 'ultrasonic-sr04', name: 'Siêu âm HC-SR04', position: { x: 45, y: 0, z: -30 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { distanceCm: 25 } },
        { instanceId: 'srv1', definitionId: 'servo-sg90', name: 'Servo SG90', position: { x: 50, y: 0, z: 25 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { angle: 90 } },
        { instanceId: 'oled1', definitionId: 'oled-i2c', name: 'OLED 0.96" I2C', position: { x: -65, y: 0, z: -20 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { contrast: 100 } },
        { instanceId: 'bz1', definitionId: 'buzzer', name: 'Còi cảnh báo', position: { x: -65, y: 0, z: 25 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { toneHz: 2000 } },
      ];
      doc.connections = [
        { id: 'r1', fromComponentId: 'mcu1', fromPinId: '5v', toComponentId: 'sr04', toPinId: 'vcc', wireColor: '#ef4444' },
        { id: 'r2', fromComponentId: 'mcu1', fromPinId: 'gnd1', toComponentId: 'sr04', toPinId: 'gnd', wireColor: '#0f172a' },
        { id: 'r3', fromComponentId: 'mcu1', fromPinId: 'd13', toComponentId: 'sr04', toPinId: 'trig', wireColor: '#06b6d4' },
        { id: 'r4', fromComponentId: 'mcu1', fromPinId: 'd12', toComponentId: 'sr04', toPinId: 'echo', wireColor: '#22c55e' },
        { id: 'r5', fromComponentId: 'mcu1', fromPinId: 'd9', toComponentId: 'srv1', toPinId: 'pwm', wireColor: '#f97316' },
        { id: 'r6', fromComponentId: 'mcu1', fromPinId: '5v', toComponentId: 'srv1', toPinId: 'vcc', wireColor: '#ef4444' },
        { id: 'r7', fromComponentId: 'mcu1', fromPinId: 'gnd2', toComponentId: 'srv1', toPinId: 'gnd', wireColor: '#0f172a' },
        { id: 'r8', fromComponentId: 'mcu1', fromPinId: '3v3', toComponentId: 'oled1', toPinId: 'vcc', wireColor: '#ef4444' },
        { id: 'r9', fromComponentId: 'mcu1', fromPinId: 'gnd1', toComponentId: 'oled1', toPinId: 'gnd', wireColor: '#0f172a' },
        { id: 'r10', fromComponentId: 'mcu1', fromPinId: 'a0', toComponentId: 'oled1', toPinId: 'sda', wireColor: '#3b82f6' },
        { id: 'r11', fromComponentId: 'mcu1', fromPinId: 'a1', toComponentId: 'oled1', toPinId: 'scl', wireColor: '#eab308' },
        { id: 'r12', fromComponentId: 'mcu1', fromPinId: 'd8', toComponentId: 'bz1', toPinId: 'pos', wireColor: '#a855f7' },
        { id: 'r13', fromComponentId: 'bz1', fromPinId: 'neg', toComponentId: 'mcu1', toPinId: 'gnd2', wireColor: '#0f172a' },
      ];
      return doc;
    },
  },
  {
    id: 'prod-regulated-5v-psu',
    name: 'Mạch Nguồn Ổn Áp Tuyến Tính LM7805 & Hiển thị 7 Đoạn',
    tagline: 'Hạ áp 12V xuống 5V chuẩn công nghiệp kèm tụ lọc, Diode chống ngược cực và LED 7 đoạn',
    description:
      'Mạch cấp nguồn chuẩn mực sử dụng IC ổn áp LM7805, Diode chỉnh lưu bảo vệ ngược cực, tụ hóa lọc nhiễu đầu vào/ra và cụm hiển thị trạng thái LED 7 đoạn.',
    price: 0,
    currency: 'VND',
    difficulty: 'Cơ bản',
    category: 'Mô-đun nguồn',
    version: '1.1.0',
    license: 'MIT Open Hardware',
    tags: ['LM7805', 'Ổn áp 5V', 'Diode', '7-Segment', 'Nguồn DC'],
    componentsSummary: ['1x Nguồn 12V', '1x Diode 1N4007', '1x IC LM7805', '1x Tụ 100µF', '1x Điện trở 330Ω', '1x LED 7 Đoạn'],
    isFree: true,
    rating: 4.9,
    reviewsCount: 93,
    downloadsCount: 1410,
    author: {
      name: 'Thầy Hoàng Nam',
      verified: true,
      role: 'Kỹ sư Vi mạch Lab',
    },
    learningOutcomes: [
      'Bảo vệ mạch điện một chiều khỏi đấu ngược cực bằng Diode 1N4007',
      'Ổn định điện áp 5V tuyến tính với IC LM7805 và tụ lọc nguồn',
      'Cấp nguồn an toàn cho mô-đun hiển thị LED 7 đoạn',
    ],
    projectTemplate: () => {
      const doc = createDefaultProjectDocument('Dự án: Nguồn Ổn Áp LM7805 5V & LED 7 Đoạn');
      doc.board.width = 160;
      doc.board.depth = 95;
      doc.components = [
        { instanceId: 'vin', definitionId: 'dc-source', name: 'Nguồn 12V', position: { x: -55, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { voltage: 12.0 } },
        { instanceId: 'd1', definitionId: 'diode', name: 'Diode 1N4007', position: { x: -30, y: 0, z: -15 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { forwardVoltage: 0.7 } },
        { instanceId: 'reg1', definitionId: 'voltage-reg-7805', name: 'IC LM7805', position: { x: -5, y: 0, z: -10 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { outputVoltage: 5.0 } },
        { instanceId: 'c_out', definitionId: 'capacitor', name: 'Tụ lọc 100µF', position: { x: 15, y: 0, z: 15 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { capacitance: 100 } },
        { instanceId: 'r_lim', definitionId: 'resistor', name: 'R 330Ω', position: { x: 25, y: 0, z: -15 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { resistance: 330 } },
        { instanceId: 'seg1', definitionId: '7seg-display', name: 'LED 7 Đoạn', position: { x: 52, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { digit: 5, color: 'red' } },
      ];
      doc.connections = [
        { id: 'p1', fromComponentId: 'vin', fromPinId: 'vcc', toComponentId: 'd1', toPinId: 'anode', wireColor: '#ef4444' },
        { id: 'p2', fromComponentId: 'd1', fromPinId: 'cathode', toComponentId: 'reg1', toPinId: 'vin', wireColor: '#f97316' },
        { id: 'p3', fromComponentId: 'vin', fromPinId: 'gnd', toComponentId: 'reg1', toPinId: 'gnd', wireColor: '#0f172a' },
        { id: 'p4', fromComponentId: 'reg1', fromPinId: 'vout', toComponentId: 'c_out', toPinId: 'pos', wireColor: '#ef4444' },
        { id: 'p5', fromComponentId: 'c_out', fromPinId: 'neg', toComponentId: 'vin', toPinId: 'gnd', wireColor: '#0f172a' },
        { id: 'p6', fromComponentId: 'reg1', fromPinId: 'vout', toComponentId: 'r_lim', toPinId: 'pin1', wireColor: '#ef4444' },
        { id: 'p7', fromComponentId: 'r_lim', fromPinId: 'pin2', toComponentId: 'seg1', toPinId: 'seg_a', wireColor: '#22c55e' },
        { id: 'p8', fromComponentId: 'seg1', fromPinId: 'com', toComponentId: 'vin', toPinId: 'gnd', wireColor: '#0f172a' },
      ];
      return doc;
    },
  },
];
