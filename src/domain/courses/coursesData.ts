import { Course } from './types';
import { ProjectDocument } from '../project/types';
import { CURRENT_SCHEMA_VERSION, createDefaultProjectDocument } from '../project/document';
import { buildDeterministicPracticeStages } from './pptxAndPracticeParser';

// Dự án thực hành chuẩn 1 của Nhà sáng tạo: Mạch Đèn LED Cơ bản với Điện trở bảo vệ 220Ω
export const PRACTICE_PROJECT_1_BASIC_LED: ProjectDocument = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  projectId: 'proj-course-basic-led-lab1',
  name: 'Mạch Đèn LED Cơ Bản & Điện Trở Hạn Dòng 220Ω',
  description:
    'Mạch thực hành căn bản sử dụng Nguồn DC 5V cấp điện qua Điện trở bảo vệ 220Ω làm sáng Đèn LED Đỏ an toàn.',
  revision: 1,
  units: 'mm',
  createdAt: '2026-10-18T00:00:00.000Z',
  updatedAt: '2026-10-18T00:00:00.000Z',
  wireRoutes: [],
  board: {
    width: 60,
    depth: 50,
    thickness: 1.6,
    solderMaskColor: '#0f5132',
    copperLayerCount: 2,
    gridSpacing: 2.54,
    shape: 'rectangle',
  },
  components: [
    {
      instanceId: 'comp-dc-1',
      definitionId: 'dc-source',
      name: 'Nguồn DC 5V',
      position: { x: -18, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      parameters: { voltage: 5.0 },
    },
    {
      instanceId: 'comp-res-1',
      definitionId: 'resistor',
      name: 'Điện trở R1 220Ω',
      position: { x: 0, y: 0, z: -8 },
      rotation: { x: 0, y: 0, z: 0 },
      parameters: { resistance: 220 },
    },
    {
      instanceId: 'comp-led-1',
      definitionId: 'led',
      name: 'Đèn LED Đỏ',
      position: { x: 18, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      parameters: { color: 'red', forwardVoltage: 2.0 },
    },
  ],
  connections: [
    {
      id: 'wire-1-vcc-r1',
      fromComponentId: 'comp-dc-1',
      fromPinId: 'vcc',
      toComponentId: 'comp-res-1',
      toPinId: 'pin1',
      wireColor: '#ef4444',
      wireStyle: 'curved',
    },
    {
      id: 'wire-2-r1-anode',
      fromComponentId: 'comp-res-1',
      fromPinId: 'pin2',
      toComponentId: 'comp-led-1',
      toPinId: 'anode',
      wireColor: '#f59e0b',
      wireStyle: 'curved',
    },
    {
      id: 'wire-3-cathode-gnd',
      fromComponentId: 'comp-led-1',
      fromPinId: 'cathode',
      toComponentId: 'comp-dc-1',
      toPinId: 'gnd',
      wireColor: '#3b82f6',
      wireStyle: 'curved',
    },
  ],
};

// Dự án thực hành chuẩn 2 của Nhà sáng tạo: Mạch Công tắc Điều khiển Đèn LED
export const PRACTICE_PROJECT_2_SWITCH_LED: ProjectDocument = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  projectId: 'proj-course-basic-switch-lab2',
  name: 'Mạch Công Tắc Điều Khiển Đóng Ngắt Đèn LED 3D',
  description:
    'Mạch điều khiển đóng/ngắt dòng điện trực tiếp bằng Công tắc cơ khí SPST kết hợp Điện trở bảo vệ 220Ω và Đèn LED Xanh lục.',
  revision: 1,
  units: 'mm',
  createdAt: '2026-10-18T00:00:00.000Z',
  updatedAt: '2026-10-18T00:00:00.000Z',
  wireRoutes: [],
  board: {
    width: 70,
    depth: 50,
    thickness: 1.6,
    solderMaskColor: '#0f5132',
    copperLayerCount: 2,
    gridSpacing: 2.54,
    shape: 'rectangle',
  },
  components: [
    {
      instanceId: 'comp-dc-2',
      definitionId: 'dc-source',
      name: 'Nguồn DC 5V',
      position: { x: -22, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      parameters: { voltage: 5.0 },
    },
    {
      instanceId: 'comp-sw-2',
      definitionId: 'switch',
      name: 'Công tắc SW1',
      position: { x: -7, y: 0, z: -10 },
      rotation: { x: 0, y: 0, z: 0 },
      parameters: {},
    },
    {
      instanceId: 'comp-res-2',
      definitionId: 'resistor',
      name: 'Điện trở R1 220Ω',
      position: { x: 8, y: 0, z: -10 },
      rotation: { x: 0, y: 0, z: 0 },
      parameters: { resistance: 220 },
    },
    {
      instanceId: 'comp-led-2',
      definitionId: 'led',
      name: 'Đèn LED Xanh lục',
      position: { x: 22, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      parameters: { color: 'green', forwardVoltage: 2.1 },
    },
  ],
  connections: [
    {
      id: 'wire-sw-1',
      fromComponentId: 'comp-dc-2',
      fromPinId: 'vcc',
      toComponentId: 'comp-sw-2',
      toPinId: 'pin1',
      wireColor: '#ef4444',
      wireStyle: 'curved',
    },
    {
      id: 'wire-sw-2',
      fromComponentId: 'comp-sw-2',
      fromPinId: 'pin2',
      toComponentId: 'comp-res-2',
      toPinId: 'pin1',
      wireColor: '#f59e0b',
      wireStyle: 'curved',
    },
    {
      id: 'wire-sw-3',
      fromComponentId: 'comp-res-2',
      fromPinId: 'pin2',
      toComponentId: 'comp-led-2',
      toPinId: 'anode',
      wireColor: '#10b981',
      wireStyle: 'curved',
    },
    {
      id: 'wire-sw-4',
      fromComponentId: 'comp-led-2',
      fromPinId: 'cathode',
      toComponentId: 'comp-dc-2',
      toPinId: 'gnd',
      wireColor: '#3b82f6',
      wireStyle: 'curved',
    },
  ],
};

const lab1Summary =
  'Thực hành từ bàn làm việc 3D trống: Thêm Nguồn DC 5V, Điện trở 220Ω và Đèn LED Đỏ; thực hiện nối dây khép kín và chạy mô phỏng phát sáng an toàn.';
const lab1Decomposition = buildDeterministicPracticeStages(
  PRACTICE_PROJECT_1_BASIC_LED,
  'Thực hành Lab 1: Lắp ráp & Mô phỏng Mạch Đèn LED Cơ bản',
  lab1Summary
);

const lab2Summary =
  'Thực hành lắp ráp mạch điều khiển có Công tắc đóng/ngắt (Switch): Bố trí 4 thiết bị lên bo mạch 3D, đi 4 đường dây dẫn chuẩn xác và chạy mô phỏng bật/tắt đèn LED trực tiếp.';
const lab2Decomposition = buildDeterministicPracticeStages(
  PRACTICE_PROJECT_2_SWITCH_LED,
  'Thực hành Lab 2: Mạch Công tắc Điều khiển Đèn LED 3D',
  lab2Summary
);

export const FUNDAMENTAL_ELECTRONICS_COURSE: Course = {
  id: 'course-hoc-tap-mach-dien-tu-can-ban',
  title: 'Học tập mạch điện tử căn bản',
  slug: 'hoc-tap-mach-dien-tu-can-ban',
  tagline:
    'Lộ trình toàn diện từ Lý thuyết Slide trực quan có Trợ giảng AI đến Thực hành lắp ráp mạch 3D theo 3 giai đoạn chuẩn kỹ thuật.',
  description:
    'Khóa học nền tảng dành cho người mới bắt đầu làm quen với kỹ thuật điện tử trên không gian 3D. Học viên được trang bị kiến thức cốt lõi qua hệ thống Slide bài giảng lý thuyết tương tác cùng Trợ giảng AI riêng biệt, sau đó trực tiếp bước vào Phòng Thực hành Lab 3D để tự tay đặt linh kiện, nối dây và chạy mô phỏng kiểm nghiệm.',
  author: {
    id: 'creator-1',
    name: 'Huỳnh Phong',
    role: 'Giảng viên & Nhà sáng tạo CircuitCraft 3D',
    bio: 'Kỹ sư hệ thống nhúng & thiết kế mạch điện tử 3D tương tác.',
  },
  instructor: {
    name: 'Huỳnh Phong',
    role: 'Giảng viên & Nhà sáng tạo CircuitCraft 3D',
  },
  price: 0,
  currency: 'VND',
  isFree: true,
  level: 'Cơ bản',
  category: 'stem',
  duration: '4 bài học (2 Lý thuyết • 2 Thực hành)',
  lessonCount: 4,
  rating: 5.0,
  reviewsCount: 128,
  studentsCount: 450,
  thumbnailGradient: 'from-cyan-600 via-sky-600 to-indigo-700',
  badge: 'Khóa học Nền tảng',
  highlights: [
    'Lý thuyết trực quan qua Slide bài giảng tích hợp Trợ giảng AI theo dõi từng trang slide',
    'Hiểu rõ bản chất Nguồn DC, Định luật Ohm, Điện trở hạn dòng và phân cực Đèn LED',
    'Thực hành lắp ráp mạch từ bàn làm việc 3D trống qua 3 giai đoạn: Thêm thiết bị → Nối dây → Chạy mô phỏng',
    'Hệ thống DRC tự động kiểm tra lỗi đoản mạch và đánh giá tiến độ thực hành theo thời gian thực',
  ],
  syllabus: [
    // PHẦN 1: LÝ THUYẾT (2 bài giảng có Slide PPTX chi tiết)
    {
      id: 'syl-theory-1',
      title: 'Bài 1 (Lý thuyết): Nguyên lý dòng điện DC, Định luật Ohm & Bảo vệ Đèn LED',
      duration: '30 phút',
      summary:
        'Nắm vững bản chất dòng điện một chiều (DC), định luật Ohm (I = U / R), cách tính điện trở hạn dòng và phân biệt chân Anode (+), Cathode (-) của đèn LED.',
      shortDescription:
        'Nắm vững bản chất dòng điện một chiều (DC), định luật Ohm (I = U / R), cách tính điện trở hạn dòng và phân biệt chân Anode (+), Cathode (-) của đèn LED.',
      sectionType: 'theory',
      isPracticalLab: false,
      pptxFileName: 'Bai_1_Nguyen_Ly_Mach_Dien_DC_Ohm_LED.pptx',
      slides: [
        {
          id: 't1-slide-1',
          slideNumber: 1,
          title: '1. Tổng quan về Mạch Điện Tử Căn Bản & Mạch Kín',
          bullets: [
            'Mạch điện tử là một vòng khép kín cho phép các hạt điện tích dịch chuyển có hướng từ cực dương (VCC) qua tải tiêu thụ và trở về cực âm (GND).',
            'Ba thành phần cốt lõi của một mạch điện cơ bản: Nguồn cung cấp năng lượng (DC Source), Linh kiện bảo vệ/điều khiển (Điện trở, Công tắc) và Tải tiêu thụ (Đèn LED, Còi chip).',
            'Điều kiện tiên quyết để mạch hoạt động: Mạch phải KHÉP KÍN (Closed Loop) và không bị nối tắt trực tiếp từ VCC sang GND (Đoản mạch / Short Circuit).',
          ],
          contentText:
            '1. Tổng quan về Mạch Điện Tử Căn Bản & Mạch Kín\n- Mạch điện tử là một vòng khép kín cho phép dòng điện chạy từ cực dương (VCC) qua tải tiêu thụ về cực âm (GND).\n- Ba thành phần cốt lõi: Nguồn DC, Linh kiện hạn dòng/điều khiển (Điện trở, Công tắc) và Tải (Đèn LED).\n- Điều kiện mạch hoạt động: Mạch khép kín và không bị đoản mạch.',
          notes:
            'Hãy quan sát sơ đồ vòng lặp khép kín. Nếu bất kỳ một nhánh dây nào bị hở, dòng điện bằng 0 và đèn LED sẽ không thể sáng.',
        },
        {
          id: 't1-slide-2',
          slideNumber: 2,
          title: '2. Nguồn Điện Một Chiều (DC Source) — VCC (+) và GND (-)',
          bullets: [
            'Nguồn điện một chiều (DC) duy trì hiệu điện thế ổn định giữa hai cực: Cực dương ký hiệu là VCC (+) và cực âm/mass ký hiệu là GND (-).',
            'Trong các mạch điện tử thực hành STEM và vi điều khiển chuẩn, mức điện áp thông dụng nhất là 5.0V (hoặc 3.3V, 9.0V).',
            'Quy ước màu dây tiêu chuẩn kỹ thuật: Dây nối từ cực dương VCC (+) luôn ưu tiên màu ĐỎ; dây nối về cực âm GND (-) ưu tiên màu XANH DƯƠNG hoặc ĐEN.',
          ],
          contentText:
            '2. Nguồn Điện Một Chiều (DC Source) — VCC (+) và GND (-)\n- Nguồn DC duy trì hiệu điện thế ổn định giữa cực dương VCC (+) và cực âm GND (-).\n- Mức điện áp thực hành tiêu chuẩn: 5.0V DC.\n- Quy ước màu dây: Đỏ cho VCC (+), Xanh dương/Đen cho GND (-).',
          notes:
            'Trong không gian 3D của CircuitCraft, khối Nguồn DC có 2 chân cắm rõ ràng là VCC (+) và GND (-).',
        },
        {
          id: 't1-slide-3',
          slideNumber: 3,
          title: '3. Điện Trở (Resistor) & Định Luật Ohm (I = U / R)',
          bullets: [
            'Điện trở (Resistor) là linh kiện thụ động có tác dụng cản trở và giới hạn cường độ dòng điện chạy trong nhánh mạch, đơn vị đo là Ohm (Ω).',
            'Định luật Ohm: Cường độ dòng điện I (Ampe) tỷ lệ thuận với hiệu điện thế U (Volt) và tỷ lệ nghịch với điện trở R (Ohm): I = U / R.',
            'Điện trở không phân biệt chiều âm dương (linh kiện không phân cực): Bạn có thể nối dây vào Chân 1 (pin1) hay Chân 2 (pin2) theo chiều nào cũng hoạt động đúng.',
          ],
          contentText:
            '3. Điện Trở (Resistor) & Định Luật Ohm (I = U / R)\n- Điện trở giới hạn cường độ dòng điện trong mạch, đơn vị là Ohm (Ω).\n- Công thức định luật Ohm: I = U / R.\n- Điện trở là linh kiện không phân cực (2 chân pin1 và pin2 tương đương nhau).',
          notes:
            'Nhớ công thức I = U / R. Khi tăng giá trị R thì dòng điện I giảm xuống, giúp bảo vệ các linh kiện bán dẫn nhạy cảm như đèn LED.',
        },
        {
          id: 't1-slide-4',
          slideNumber: 4,
          title: '4. Đi-ốt Phát Quang (Đèn LED) & Quy tắc Phân Cực Thuận',
          bullets: [
            'LED (Light Emitting Diode) là đi-ốt bán dẫn phát sáng khi có dòng điện chạy qua theo chiều phân cực thuận.',
            'Khác với điện trở, đèn LED BẮT BUỘC PHẢI ĐẤU ĐÚNG CỰC: Chân dương gọi là Anode (+) (chân dài hơn), chân âm gọi là Cathode (-) (chân ngắn hơn, bên cạnh vát phẳng).',
            'Mỗi màu LED có điện áp rơi thuận (Vf) đặc trưng: LED Đỏ khoảng 2.0V, LED Xanh lục khoảng 2.1V - 2.2V. Dòng điện làm việc an toàn là 10mA – 20mA.',
          ],
          contentText:
            '4. Đi-ốt Phát Quang (Đèn LED) & Quy tắc Phân Cực Thuận\n- LED chỉ phát sáng khi dòng điện đi vào chân Anode (+) và đi ra ở chân Cathode (-).\n- Nếu đấu ngược cực (VCC vào Cathode), LED bị phân cực ngược và sẽ KHÔNG SÁNG.\n- Dòng định mức an toàn của LED 5mm thông thường là 10mA - 20mA.',
          notes:
            'Nếu người học hỏi tại sao LED không sáng dù mạch kín, nguyên nhân phổ biến nhất là đấu ngược chân Anode và Cathode.',
        },
        {
          id: 't1-slide-5',
          slideNumber: 5,
          title: '5. Tính Toán Điện Trở Hạn Dòng Bảo Vệ LED Với Nguồn 5V',
          bullets: [
            'Tại sao không được nối trực tiếp LED vào nguồn 5V? Vì điện áp 5V lớn hơn nhiều so với ngưỡng 2.0V của LED, dòng điện tăng vọt gây cháy hỏng LED ngay lập tức.',
            'Công thức tính điện trở hạn dòng nối tiếp: R = (U_nguồn - V_f) / I_led.',
            'Với U_nguồn = 5V, V_f (LED Đỏ) = 2V và dòng mong muốn I = 13.6mA (0.0136A): R = (5 - 2) / 0.0136 ≈ 220 Ω. Do đó, điện trở 220Ω là giá trị chuẩn vàng khi dùng nguồn 5V.',
          ],
          contentText:
            '5. Tính Toán Điện Trở Hạn Dòng Bảo Vệ LED Với Nguồn 5V\n- Nối trực tiếp LED vào nguồn 5V sẽ gây quá dòng làm hỏng LED.\n- Áp dụng công thức R = (U_nguồn - V_f) / I_led = (5V - 2V) / 0.0136A ≈ 220Ω.\n- Giá trị điện trở tiêu chuẩn trong thực hành 5V là 220Ω hoặc 330Ω.',
          notes:
            'Đây là câu hỏi kinh điển trong thiết kế mạch cơ bản: Tại sao luôn cần điện trở 220Ω đi kèm với LED trên nguồn 5V.',
        },
      ],
    },
    {
      id: 'syl-theory-2',
      title: 'Bài 2 (Lý thuyết): Mạch Đóng Cắt Với Công Tắc (Switch) & Kiểm Tra An Toàn Mạch (DRC)',
      duration: '25 phút',
      summary:
        'Tìm hiểu cơ chế đóng/ngắt dòng điện bằng công tắc cơ khí SPST, phân biệt trạng thái Hở mạch / Kín mạch và quy trình kiểm tra lỗi thiết kế DRC.',
      shortDescription:
        'Tìm hiểu cơ chế đóng/ngắt dòng điện bằng công tắc cơ khí SPST, phân biệt trạng thái Hở mạch / Kín mạch và quy trình kiểm tra lỗi thiết kế DRC.',
      sectionType: 'theory',
      isPracticalLab: false,
      pptxFileName: 'Bai_2_Cong_Tac_Dieu_Khien_Va_Kiem_Tra_DRC.pptx',
      slides: [
        {
          id: 't2-slide-1',
          slideNumber: 1,
          title: '1. Nguyên Lý Hoạt Động Của Công Tắc Cơ Khí (SPST Switch)',
          bullets: [
            'Công tắc đơn (SPST - Single Pole Single Throw) gồm 2 chân tiếp điểm: Tiếp điểm 1 (pin1) và Tiếp điểm 2 (pin2).',
            'Khi công tắc ở trạng thái MỞ (OFF / Open): Hai tiếp điểm tách rời nhau, tạo ra khoảng hở cách điện khiến dòng điện không thể đi qua (Hở mạch).',
            'Khi công tắc ở trạng thái ĐÓNG (ON / Closed): Thanh kim loại nối liền pin1 và pin2, cho phép dòng điện chạy qua toàn mạch để thắp sáng tải LED.',
          ],
          contentText:
            '1. Nguyên Lý Hoạt Động Của Công Tắc Cơ Khí (SPST Switch)\n- Công tắc SPST có 2 chân tiếp điểm là pin1 và pin2.\n- Trạng thái OFF: Hở mạch, dòng điện bằng 0.\n- Trạng thái ON: Kín mạch, dòng điện dẫn qua tiếp điểm cấp cho tải.',
          notes:
            'Trong chế độ Mô phỏng 3D, bạn có thể nhấp chuột trực tiếp vào thân Công tắc để bật/tắt và quan sát đèn LED phản hồi tức thì.',
        },
        {
          id: 't2-slide-2',
          slideNumber: 2,
          title: '2. Sơ Đồ Đấu Nối Chuẩn Mạch Công Tắc Điều Khiển LED',
          bullets: [
            'Trình tự mắc nối tiếp chuẩn an toàn: Cực dương Nguồn DC (VCC) → Chân 1 Công tắc (pin1) → Chân 2 Công tắc (pin2) → Chân 1 Điện trở (pin1).',
            'Tiếp tục từ Chân 2 Điện trở (pin2) → Chân dương Đèn LED (anode) → Chân âm Đèn LED (cathode) → Quay về cực âm Nguồn DC (GND).',
            'Việc đặt công tắc ở phía cực dương (High-side switching) ngay sau nguồn VCC giúp ngắt hoàn toàn điện áp cấp vào mạch khi công tắc tắt.',
          ],
          contentText:
            '2. Sơ Đồ Đấu Nối Chuẩn Mạch Công Tắc Điều Khiển LED\n- Tuyến dây 1: Nguồn DC (vcc) -> Công tắc (pin1).\n- Tuyến dây 2: Công tắc (pin2) -> Điện trở 220Ω (pin1).\n- Tuyến dây 3: Điện trở 220Ω (pin2) -> Đèn LED (anode).\n- Tuyến dây 4: Đèn LED (cathode) -> Nguồn DC (gnd).',
          notes:
            'Ghi nhớ 4 tuyến dây nối tiếp này để áp dụng ngay trong Bài Thực hành Lab 2.',
        },
        {
          id: 't2-slide-3',
          slideNumber: 3,
          title: '3. Kiểm Tra Quy Tắc Thiết Kế Điện Tử (DRC Validation)',
          bullets: [
            'DRC (Design Rule Check) là công cụ tự động phân tích sơ đồ mạch trước khi cấp nguồn mô phỏng nhằm phát hiện sớm các nguy cơ hư hỏng.',
            'Ba lỗi DRC nghiêm trọng cần tránh: (1) Nối tắt trực tiếp VCC vào GND gây ĐOẢN MẠCH; (2) Thiếu điện trở hạn dòng cho LED; (3) Để chân linh kiện lơ lửng chưa kết nối.',
            'Trước khi chuyển sang Giai đoạn 3 (Chạy mô phỏng), hãy luôn kiểm tra thanh trạng thái dưới cùng đảm bảo mạch đạt chuẩn DRC xanh lá.',
          ],
          contentText:
            '3. Kiểm Tra Quy Tắc Thiết Kế Điện Tử (DRC Validation)\n- DRC giúp phát hiện lỗi đoản mạch, thiếu điện trở bảo vệ hoặc chân linh kiện bị hở.\n- Luôn đảm bảo DRC báo hợp lệ trước khi nhấn Chạy Mô phỏng.',
          notes:
            'Sau khi hoàn thành slide cuối cùng này, bài học Lý thuyết sẽ tự động được đánh dấu Hoàn thành và bạn có thể chuyển sang Thực hành Lab.',
        },
      ],
    },

    // PHẦN 2: THỰC HÀNH LAB 3D (2 bài thực hành có Dự án chuẩn & Hướng dẫn 3 giai đoạn)
    {
      id: 'syl-practice-1',
      title: 'Bài 3 (Thực hành Lab 1): Lắp ráp & Mô phỏng Mạch Đèn LED Cơ bản với Điện trở 220Ω',
      duration: '40 phút',
      summary: lab1Summary,
      shortDescription: lab1Summary,
      sectionType: 'practice',
      isPracticalLab: true,
      isLab: true,
      practiceProjectId: PRACTICE_PROJECT_1_BASIC_LED.projectId,
      practiceProjectName: PRACTICE_PROJECT_1_BASIC_LED.name,
      practiceProjectSnapshot: PRACTICE_PROJECT_1_BASIC_LED,
      practiceProject: PRACTICE_PROJECT_1_BASIC_LED,
      practiceStages: lab1Decomposition.stages,
      practiceGuideSummary: lab1Decomposition.summary,
      practiceSummary: lab1Decomposition.summary,
      labGoal: lab1Summary,
    },
    {
      id: 'syl-practice-2',
      title: 'Bài 4 (Thực hành Lab 2): Mạch Công tắc Điều khiển Đèn LED & Kiểm nghiệm Đóng/Ngắt 3D',
      duration: '45 phút',
      summary: lab2Summary,
      shortDescription: lab2Summary,
      sectionType: 'practice',
      isPracticalLab: true,
      isLab: true,
      practiceProjectId: PRACTICE_PROJECT_2_SWITCH_LED.projectId,
      practiceProjectName: PRACTICE_PROJECT_2_SWITCH_LED.name,
      practiceProjectSnapshot: PRACTICE_PROJECT_2_SWITCH_LED,
      practiceProject: PRACTICE_PROJECT_2_SWITCH_LED,
      practiceStages: lab2Decomposition.stages,
      practiceGuideSummary: lab2Decomposition.summary,
      practiceSummary: lab2Decomposition.summary,
      labGoal: lab2Summary,
    },
  ],
  createLabProject: (_labId?: string) => {
    // Requirement 2.3: Không gian thực hành luôn bắt đầu hoàn toàn trống để học viên tự lắp theo 3 giai đoạn
    const emptyDoc = createDefaultProjectDocument('Thực hành: Học tập mạch điện tử căn bản');
    emptyDoc.components = [];
    emptyDoc.connections = [];
    return emptyDoc;
  },
};

export const COURSES: Course[] = [FUNDAMENTAL_ELECTRONICS_COURSE];
