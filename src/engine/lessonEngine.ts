import { ProjectDocument, SimulationResult } from '../types/circuit.ts';

export interface LessonStep {
  id: string;
  title: string;
  instruction: string;
  hint: string;
  isCompleted: (doc: ProjectDocument, simResult?: SimulationResult) => boolean;
}

export interface Lesson {
  id: string;
  title: string;
  difficulty: 'Cơ bản' | 'Trung bình';
  category: 'Lý thuyết mạch' | 'Thực hành 3D';
  description: string;
  estimatedMinutes: number;
  steps: LessonStep[];
}

export const LESSONS: Lesson[] = [
  {
    id: 'lesson_basic_led',
    title: 'Bài 1: Thắp sáng LED an toàn với điện trở',
    difficulty: 'Cơ bản',
    category: 'Thực hành 3D',
    description: 'Học cách cấp nguồn 5V DC cho LED qua điện trở hạn dòng 220Ω và quan sát LED phát sáng trong 3D.',
    estimatedMinutes: 5,
    steps: [
      {
        id: 'step_1_add_source',
        title: 'Thêm Nguồn DC',
        instruction: 'Kéo một "Nguồn DC" (5V) từ thanh công cụ bên trái vào mặt bo mạch.',
        hint: 'Nhấp vào linh kiện Nguồn DC trong danh mục hoặc kéo thả vào không gian 3D.',
        isCompleted: (doc) => doc.components.some((c) => c.type === 'dc_power_supply'),
      },
      {
        id: 'step_2_add_resistor_and_led',
        title: 'Thêm Điện trở và LED',
        instruction: 'Kéo thêm 1 Điện trở (220Ω) và 1 Đèn LED vào bo mạch.',
        hint: 'Mạch luôn cần điện trở để bảo vệ LED khỏi điện áp quá lớn làm cháy diode.',
        isCompleted: (doc) =>
          doc.components.some((c) => c.type === 'resistor') &&
          doc.components.some((c) => c.type === 'led'),
      },
      {
        id: 'step_3_wire_series',
        title: 'Nối dây mạch nối tiếp',
        instruction: 'Nối: Nguồn (+) -> Điện trở -> Chân Anode (+) của LED -> Chân Cathode (-) của LED -> Cực (-) của Nguồn.',
        hint: 'Nhấp vào đầu pin nguồn, sau đó nhấp vào pin tiếp theo để nối dây. Cực Anode (+) là chân dài hơn.',
        isCompleted: (doc) => doc.connections.length >= 3,
      },
      {
        id: 'step_4_run_simulation',
        title: 'Bật mô phỏng',
        instruction: 'Nhấn nút "Chạy mô phỏng" trên thanh điều khiển để chiêm ngưỡng LED phát sáng.',
        hint: 'Nếu dây nối đúng, LED sẽ phát ra vệt sáng rực rỡ và thông số dòng điện (~13.6mA) hiển thị.',
        isCompleted: (_doc, simResult) =>
          Boolean(simResult && simResult.state === 'running' && simResult.circuitFlow.currentFlowing),
      },
    ],
  },
  {
    id: 'lesson_switch_control',
    title: 'Bài 2: Điều khiển bật/tắt bằng công tắc SPST',
    difficulty: 'Cơ bản',
    category: 'Thực hành 3D',
    description: 'Tích hợp công tắc gạt cơ học vào mạch nối tiếp để kiểm soát dòng điện đóng/ngắt linh hoạt.',
    estimatedMinutes: 6,
    steps: [
      {
        id: 'step_1_add_switch',
        title: 'Thêm Công tắc SPST',
        instruction: 'Đặt một Công tắc SPST vào giữa nguồn dương và điện trở hạn dòng.',
        hint: 'Công tắc SPST hoạt động như một cầu nối có thể đóng mở tiếp điểm cơ học.',
        isCompleted: (doc) => doc.components.some((c) => c.type === 'switch_spst'),
      },
      {
        id: 'step_2_connect_switch',
        title: 'Nối công tắc vào chuỗi tải',
        instruction: 'Dẫn dây từ cực (+) của Nguồn vào Pin 1 của công tắc, và Pin 2 vào Điện trở.',
        hint: 'Đảm bảo công tắc nằm trên đường dẫn khép kín của dòng điện.',
        isCompleted: (doc) => {
          const sw = doc.components.find((c) => c.type === 'switch_spst');
          if (!sw) return false;
          return doc.connections.some(
            (w) => w.fromComponentId === sw.id || w.toComponentId === sw.id
          );
        },
      },
      {
        id: 'step_3_toggle_switch',
        title: 'Tương tác bật/tắt công tắc',
        instruction: 'Bật mô phỏng, sau đó nhấp trực tiếp vào công tắc 3D hoặc bảng thuộc tính để chuyển sang trạng thái Đóng (ON).',
        hint: 'Quan sát sự thay đổi trạng thái của đèn LED khi đóng và mở công tắc.',
        isCompleted: (doc, simResult) => {
          const sw = doc.components.find((c) => c.type === 'switch_spst');
          return Boolean(
            sw?.properties.isClosed &&
              simResult &&
              simResult.circuitFlow.currentFlowing
          );
        },
      },
    ],
  },
];
