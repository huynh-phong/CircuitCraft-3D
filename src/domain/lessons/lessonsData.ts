import { Lesson } from './types';
import { createDefaultProjectDocument } from '../project/document';

export const LESSONS: Lesson[] = [
  {
    id: 'lesson-1-basic-led',
    number: 1,
    title: 'Thắp sáng đèn LED đầu tiên',
    subtitle: 'Làm quen với Nguồn DC, Điện trở hạn dòng và Đèn LED phát quang',
    difficulty: 'Cơ bản',
    estimatedMinutes: 5,
    goal: 'Thiết kế một mạch điện cơ bản hoàn chỉnh: nối nguồn DC 5V qua điện trở 220Ω vào chân Anode của LED, và nối chân Cathode về mass GND để LED phát sáng rực rỡ.',
    steps: [
      {
        id: 'step-1',
        title: 'Bước 1: Đặt các linh kiện lên bo mạch',
        instruction: 'Kéo thả 1 Nguồn DC, 1 Điện trở (220Ω) và 1 Đèn LED lên mặt phẳng bo mạch PCB.',
        hint: 'Mở tab Thư viện linh kiện ở góc bên trái và kéo các linh kiện cần thiết ra màn hình.',
      },
      {
        id: 'step-2',
        title: 'Bước 2: Nối dây từ Nguồn sang Điện trở và LED',
        instruction: 'Bật chế độ "Nối Dây (Wiring)", click chân VCC (+) của Nguồn DC và nối đến Chân 1 của Điện trở. Sau đó nối Chân 2 của Điện trở đến chân Anode (+) của LED.',
        hint: 'Điện trở có tác dụng bảo vệ LED không bị cháy do dòng điện quá cao.',
      },
      {
        id: 'step-3',
        title: 'Bước 3: Nối dây khép kín mạch về cực âm GND',
        instruction: 'Click chân Cathode (-) của LED và kéo dây nối về chân GND (-) của Nguồn DC.',
        hint: 'Mạch điện phải tạo thành một vòng khép kín thì dòng điện mới có thể lưu thông.',
      },
      {
        id: 'step-4',
        title: 'Bước 4: Bật Mô phỏng hành vi',
        instruction: 'Nhấn nút "Bắt đầu mô phỏng" trên thanh công cụ trên cùng để quan sát đèn LED phát sáng.',
        hint: 'Đèn LED sẽ phát ánh sáng màu đỏ rực rỡ và Minibot sẽ chúc mừng bạn!',
      },
    ],
    createInitialProject: () => {
      const doc = createDefaultProjectDocument('Bài 1: Mạch LED cơ bản');
      // Pre-populate with components placed so the learner can focus on wiring or start freely
      doc.components = [
        {
          instanceId: 'pwr-1',
          definitionId: 'dc-source',
          name: 'Nguồn 5V',
          position: { x: -40, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { voltage: 5.0 },
        },
        {
          instanceId: 'res-1',
          definitionId: 'resistor',
          name: 'R1 (220Ω)',
          position: { x: 0, y: 0, z: -15 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { resistance: 220 },
        },
        {
          instanceId: 'led-1',
          definitionId: 'led',
          name: 'LED1',
          position: { x: 40, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { color: 'red' },
        },
      ];
      doc.connections = [];
      return doc;
    },
    evaluate: (doc, simResult) => {
      const hasPower = doc.components.some((c) => c.definitionId === 'dc-source');
      const hasResistor = doc.components.some((c) => c.definitionId === 'resistor');
      const hasLed = doc.components.some((c) => c.definitionId === 'led');

      if (!hasPower || !hasResistor || !hasLed) {
        return {
          isCompleted: false,
          activeStepIndex: 0,
          progressPercent: 20,
          feedback: 'Vui lòng đảm bảo có đủ 3 linh kiện: Nguồn DC, Điện trở và LED trên bo mạch.',
        };
      }

      // Check if wired
      if (doc.connections.length < 2) {
        return {
          isCompleted: false,
          activeStepIndex: 1,
          progressPercent: 45,
          feedback: 'Đã có đủ linh kiện. Hãy dùng công cụ Nối Dây để kết nối các chân lại với nhau.',
        };
      }

      if (doc.connections.length < 3) {
        return {
          isCompleted: false,
          activeStepIndex: 2,
          progressPercent: 70,
          feedback: 'Gần xong rồi! Đừng quên nối chân Cathode của LED về cực GND của nguồn.',
        };
      }

      // Check simulation
      if (simResult.status === 'running' && simResult.isClosedLoop) {
        const ledOn = Object.values(simResult.components).some((c) => c.isOn);
        if (ledOn) {
          return {
            isCompleted: true,
            activeStepIndex: 3,
            progressPercent: 100,
            feedback: 'Tuyệt vời! Bạn đã hoàn thành xuất sắc Bài 1: Đèn LED đã sáng trong vòng mạch khép kín!',
          };
        }
      }

      return {
        isCompleted: false,
        activeStepIndex: 3,
        progressPercent: 85,
        feedback: 'Mạch đã được nối dây. Hãy bật "Bắt đầu mô phỏng" để kiểm tra kết quả!',
      };
    },
  },
  {
    id: 'lesson-2-switch-control',
    number: 2,
    title: 'Điều khiển đèn bằng công tắc',
    subtitle: 'Học cách ngắt và đóng dòng điện bằng công tắc cơ khí SPST',
    difficulty: 'Cơ bản',
    estimatedMinutes: 6,
    goal: 'Mắc nối tiếp một công tắc vào mạch để kiểm soát dòng điện cấp cho LED. Khi bật công tắc thì đèn sáng, khi tắt công tắc thì đèn tắt.',
    steps: [
      {
        id: 'step-1',
        title: 'Bước 1: Chuẩn bị công tắc và linh kiện',
        instruction: 'Đặt Nguồn DC, Công tắc (Switch), Điện trở 220Ω và LED lên bo mạch.',
        hint: 'Công tắc được bố trí nối tiếp trên đường dây dẫn điện dương VCC.',
      },
      {
        id: 'step-2',
        title: 'Bước 2: Nối mạch điều khiển qua công tắc',
        instruction: 'Nối VCC của Nguồn đến Tiếp điểm 1 của Công tắc. Nối Tiếp điểm 2 của Công tắc đến Chân 1 của Điện trở.',
        hint: 'Khi công tắc mở, mạch bị ngắt quãng tại đây, không cho electron di chuyển.',
      },
      {
        id: 'step-3',
        title: 'Bước 3: Nối tiếp vào LED và về GND',
        instruction: 'Nối Chân 2 của Điện trở vào chân Anode của LED. Nối Cathode của LED về cực âm GND của Nguồn.',
        hint: 'Hoàn thiện vòng kín để chuẩn bị thử nghiệm thao tác đóng/mở công tắc.',
      },
      {
        id: 'step-4',
        title: 'Bước 4: Thử nghiệm bật/tắt trong Mô phỏng',
        instruction: 'Bật mô phỏng và click vào cần gạt của Công tắc để bật tắt đèn LED.',
        hint: 'Quan sát trạng thái đèn LED chuyển đổi tức thì theo thao tác gạt công tắc.',
      },
    ],
    createInitialProject: () => {
      const doc = createDefaultProjectDocument('Bài 2: Mạch công tắc điều khiển LED');
      doc.components = [
        {
          instanceId: 'pwr-1',
          definitionId: 'dc-source',
          name: 'Nguồn 5V',
          position: { x: -50, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { voltage: 5.0 },
        },
        {
          instanceId: 'sw-1',
          definitionId: 'switch',
          name: 'SW1 (Công tắc)',
          position: { x: -20, y: 0, z: -15 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { type: 'slide' },
          state: { open: false },
        },
        {
          instanceId: 'res-1',
          definitionId: 'resistor',
          name: 'R1 (220Ω)',
          position: { x: 15, y: 0, z: -15 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { resistance: 220 },
        },
        {
          instanceId: 'led-1',
          definitionId: 'led',
          name: 'LED1',
          position: { x: 45, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { color: 'green' },
        },
      ];
      // Pre-connect VCC -> SW1 -> R1 -> LED -> GND
      doc.connections = [
        {
          id: 'c1',
          fromComponentId: 'pwr-1',
          fromPinId: 'vcc',
          toComponentId: 'sw-1',
          toPinId: 'pin1',
          wireColor: '#ef4444',
        },
        {
          id: 'c2',
          fromComponentId: 'sw-1',
          fromPinId: 'pin2',
          toComponentId: 'res-1',
          toPinId: 'pin1',
          wireColor: '#f59e0b',
        },
        {
          id: 'c3',
          fromComponentId: 'res-1',
          fromPinId: 'pin2',
          toComponentId: 'led-1',
          toPinId: 'anode',
          wireColor: '#10b981',
        },
        {
          id: 'c4',
          fromComponentId: 'led-1',
          fromPinId: 'cathode',
          toComponentId: 'pwr-1',
          toPinId: 'gnd',
          wireColor: '#1e293b',
        },
      ];
      return doc;
    },
    evaluate: (doc, simResult, switchStates) => {
      const sw = doc.components.find((c) => c.definitionId === 'switch');
      if (!sw) {
        return {
          isCompleted: false,
          activeStepIndex: 0,
          progressPercent: 20,
          feedback: 'Chưa có công tắc (Switch) trên mạch. Hãy thêm 1 công tắc từ thư viện.',
        };
      }

      if (doc.connections.length < 4) {
        return {
          isCompleted: false,
          activeStepIndex: 1,
          progressPercent: 50,
          feedback: 'Chưa nối đủ dây cho công tắc, điện trở và LED.',
        };
      }

      const isSwClosed = switchStates[sw.instanceId] ?? (sw.state?.open === false);
      if (simResult.status === 'running' && isSwClosed) {
        return {
          isCompleted: true,
          activeStepIndex: 3,
          progressPercent: 100,
          feedback: 'Xuất sắc! Bạn đã đóng công tắc và đèn LED xanh đã phát sáng thành công!',
        };
      }

      return {
        isCompleted: false,
        activeStepIndex: 3,
        progressPercent: 85,
        feedback: 'Mạch đã sẵn sàng! Hãy nhấn vào Công tắc trên mô hình 3D để đóng mạch và thắp sáng LED.',
      };
    },
  },
  {
    id: 'lesson-3-pot-control',
    number: 3,
    title: 'Điều chỉnh độ sáng với Biến trở (Potentiometer)',
    subtitle: 'Nguyên lý cầu phân áp biến thiên và kiểm soát điện áp',
    difficulty: 'Cơ bản',
    estimatedMinutes: 8,
    goal: 'Dùng biến trở xoay 10kΩ chia điện áp từ nguồn 5V, cho phép tinh chỉnh mượt mà dòng điện cấp cho LED.',
    steps: [
      {
        id: 'step-1',
        title: 'Bước 1: Bố trí linh kiện',
        instruction: 'Kéo 1 Nguồn 5V, 1 Biến trở (Potentiometer), 1 Điện trở 220Ω và 1 Đèn LED ra không gian 3D.',
        hint: 'Biến trở có 3 chân: 2 chân ngoài cùng là thanh điện trở, chân giữa là con chạy (wiper).',
      },
      {
        id: 'step-2',
        title: 'Bước 2: Nối dây phân áp cho biến trở',
        instruction: 'Nối VCC (+) của Nguồn vào Chân 1 của Biến trở, và nối Chân 2 của Biến trở về GND (-).',
        hint: 'Cách mắc này tạo ra một cầu phân áp hoàn chỉnh giữa 0V và 5V tại chân con chạy wiper.',
      },
      {
        id: 'step-3',
        title: 'Bước 3: Nối ngõ ra Wiper đến LED',
        instruction: 'Nối chân Wiper (con chạy) của Biến trở qua Điện trở 220Ω và vào chân Anode của LED. Nối Cathode về GND.',
        hint: 'Khi vặn núm xoay, điện áp cấp vào LED sẽ thay đổi liên tục.',
      },
      {
        id: 'step-4',
        title: 'Bước 4: Chạy mô phỏng',
        instruction: 'Nhấn Bắt đầu mô phỏng để quan sát dòng điện thay đổi mượt mà theo vị trí con chạy.',
        hint: 'Mô phỏng sẽ tính toán dòng qua tải theo công thức phân áp Ohm.',
      },
    ],
    createInitialProject: () => {
      const doc = createDefaultProjectDocument('Bài 3: Biến trở điều khiển độ sáng');
      doc.components = [
        {
          instanceId: 'pwr-1',
          definitionId: 'dc-source',
          name: 'Nguồn 5V',
          position: { x: -55, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { voltage: 5.0 },
        },
        {
          instanceId: 'pot-1',
          definitionId: 'potentiometer',
          name: 'Biến trở 10k',
          position: { x: -15, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { totalResistance: 10000, positionPercent: 75 },
        },
        {
          instanceId: 'res-1',
          definitionId: 'resistor',
          name: 'R1 220Ω',
          position: { x: 20, y: 0, z: -15 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { resistance: 220 },
        },
        {
          instanceId: 'led-1',
          definitionId: 'led',
          name: 'LED Vàng',
          position: { x: 50, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          parameters: { color: 'yellow' },
        },
      ];
      doc.connections = [
        { id: 'c1', fromComponentId: 'pwr-1', fromPinId: 'vcc', toComponentId: 'pot-1', toPinId: 'pin1', wireColor: '#ef4444' },
        { id: 'c2', fromComponentId: 'pot-1', fromPinId: 'pin2', toComponentId: 'pwr-1', toPinId: 'gnd', wireColor: '#1e293b' },
        { id: 'c3', fromComponentId: 'pot-1', fromPinId: 'wiper', toComponentId: 'res-1', toPinId: 'pin1', wireColor: '#f59e0b' },
        { id: 'c4', fromComponentId: 'res-1', fromPinId: 'pin2', toComponentId: 'led-1', toPinId: 'anode', wireColor: '#10b981' },
        { id: 'c5', fromComponentId: 'led-1', fromPinId: 'cathode', toComponentId: 'pwr-1', toPinId: 'gnd', wireColor: '#1e293b' },
      ];
      return doc;
    },
    evaluate: (doc, simResult) => {
      const pot = doc.components.find((c) => c.definitionId === 'potentiometer');
      if (!pot) {
        return { isCompleted: false, activeStepIndex: 0, progressPercent: 20, feedback: 'Hãy thêm Biến trở vào bo mạch.' };
      }
      if (doc.connections.length < 4) {
        return { isCompleted: false, activeStepIndex: 1, progressPercent: 50, feedback: 'Hãy nối chân Wiper của biến trở vào mạch LED.' };
      }
      if (simResult.status === 'running') {
        return { isCompleted: true, activeStepIndex: 3, progressPercent: 100, feedback: 'Tuyệt vời! Bạn đã hoàn thành mạch biến trở phân áp mượt mà!' };
      }
      return { isCompleted: false, activeStepIndex: 3, progressPercent: 85, feedback: 'Hãy nhấn nút Bắt đầu mô phỏng để quan sát hoạt động.' };
    },
  },
  {
    id: 'lesson-4-ldr-dark-sensor',
    number: 4,
    title: 'Cảm biến quang trở LDR - Đèn tự động khi trời tối',
    subtitle: 'Ứng dụng linh kiện nhạy quang trong mạch tự động hóa',
    difficulty: 'Trung bình',
    estimatedMinutes: 10,
    goal: 'Tạo mạch cảm biến ánh sáng bằng quang trở LDR: khi cường độ sáng giảm, điện trở LDR tăng làm thay đổi điện áp kích hoạt đèn.',
    steps: [
      {
        id: 'step-1',
        title: 'Bước 1: Thêm cảm biến LDR và linh kiện',
        instruction: 'Kéo 1 Nguồn 5V, 1 Quang trở LDR, 1 Điện trở 10kΩ và 1 Đèn LED lên bo mạch.',
        hint: 'Quang trở LDR thay đổi giá trị từ vài trăm Ohm (ngoài trời nắng) lên đến hàng MegaOhm (trong bóng tối).',
      },
      {
        id: 'step-2',
        title: 'Bước 2: Nối cầu phân áp ánh sáng',
        instruction: 'Nối VCC vào Chân 1 của LDR. Chân 2 của LDR nối vào Điện trở và ngõ vào điều khiển.',
        hint: 'Điện trở 10kΩ đóng vai trò điện trở kéo đối ứng trong cầu phân áp.',
      },
      {
        id: 'step-3',
        title: 'Bước 3: Nối LED chỉ thị và khép kín mass GND',
        instruction: 'Nối đèn LED qua điện trở hạn dòng và nối tất cả các đường mass về GND.',
        hint: 'Kiểm tra kỹ các điểm nút dây nối trong không gian 3D.',
      },
      {
        id: 'step-4',
        title: 'Bước 4: Chạy mô phỏng',
        instruction: 'Bật mô phỏng để quan sát hệ thống phản ứng với cường độ sáng.',
        hint: 'Hệ thống tự động bật đèn khi mô phỏng phát hiện bóng tối.',
      },
    ],
    createInitialProject: () => {
      const doc = createDefaultProjectDocument('Bài 4: Mạch đèn tự động cảm biến LDR');
      doc.components = [
        { instanceId: 'pwr-1', definitionId: 'dc-source', name: 'Nguồn 5V', position: { x: -50, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { voltage: 5.0 } },
        { instanceId: 'ldr-1', definitionId: 'ldr', name: 'Quang trở LDR', position: { x: -15, y: 0, z: -15 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { lux: 100 } },
        { instanceId: 'res-1', definitionId: 'resistor', name: 'R1 10kΩ', position: { x: 15, y: 0, z: -15 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { resistance: 10000 } },
        { instanceId: 'led-1', definitionId: 'led', name: 'LED Trắng', position: { x: 45, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { color: 'white' } },
      ];
      doc.connections = [
        { id: 'c1', fromComponentId: 'pwr-1', fromPinId: 'vcc', toComponentId: 'ldr-1', toPinId: 'pin1', wireColor: '#ef4444' },
        { id: 'c2', fromComponentId: 'ldr-1', fromPinId: 'pin2', toComponentId: 'res-1', toPinId: 'pin1', wireColor: '#f59e0b' },
        { id: 'c3', fromComponentId: 'res-1', fromPinId: 'pin2', toComponentId: 'led-1', toPinId: 'anode', wireColor: '#10b981' },
        { id: 'c4', fromComponentId: 'led-1', fromPinId: 'cathode', toComponentId: 'pwr-1', toPinId: 'gnd', wireColor: '#1e293b' },
      ];
      return doc;
    },
    evaluate: (doc, simResult) => {
      const ldr = doc.components.find((c) => c.definitionId === 'ldr');
      if (!ldr) return { isCompleted: false, activeStepIndex: 0, progressPercent: 25, feedback: 'Cần có cảm biến LDR trong mạch.' };
      if (simResult.status === 'running') {
        return { isCompleted: true, activeStepIndex: 3, progressPercent: 100, feedback: 'Thành công! Mạch cảm biến ánh sáng LDR hoạt động chính xác!' };
      }
      return { isCompleted: false, activeStepIndex: 3, progressPercent: 85, feedback: 'Hãy nhấn Bắt đầu mô phỏng để xem hoạt động.' };
    },
  },
  {
    id: 'lesson-5-buzzer-alarm',
    number: 5,
    title: 'Còi báo động Buzzer & Mạch cảnh báo âm thanh',
    subtitle: 'Kích hoạt phần tử phát âm thanh áp điện piezo 5V',
    difficulty: 'Cơ bản',
    estimatedMinutes: 6,
    goal: 'Mắc mạch còi chíp Buzzer phát âm thanh cảnh báo 85dB kết hợp LED cảnh báo khi nhấn nút.',
    steps: [
      {
        id: 'step-1',
        title: 'Bước 1: Thêm Nút nhấn và Còi Buzzer',
        instruction: 'Kéo 1 Nguồn 5V, 1 Nút nhấn (Pushbutton) và 1 Còi Buzzer 5V lên bo mạch.',
        hint: 'Còi Buzzer có cực tính: chân (+) nối nguồn dương và chân (-) nối mass.',
      },
      {
        id: 'step-2',
        title: 'Bước 2: Nối dây điều khiển',
        instruction: 'Nối VCC qua Nút nhấn đến chân (+) của Còi Buzzer. Nối chân (-) của Buzzer về GND.',
        hint: 'Khi bấm nút, dòng điện 20mA chạy qua cuộn màng áp điện làm phát ra âm thanh beep.',
      },
      {
        id: 'step-3',
        title: 'Bước 3: Chạy mô phỏng',
        instruction: 'Bật mô phỏng và quan sát hiệu ứng sóng âm thanh 3D tỏa ra từ còi chíp.',
        hint: 'Hệ thống hiển thị sóng âm thanh 3D chân thực.',
      },
    ],
    createInitialProject: () => {
      const doc = createDefaultProjectDocument('Bài 5: Mạch còi cảnh báo Buzzer');
      doc.components = [
        { instanceId: 'pwr-1', definitionId: 'dc-source', name: 'Nguồn 5V', position: { x: -45, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { voltage: 5.0 } },
        { instanceId: 'btn-1', definitionId: 'pushbutton', name: 'Nút nhấn Khẩn cấp', position: { x: -10, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { pressed: true } },
        { instanceId: 'buz-1', definitionId: 'buzzer', name: 'Còi Buzzer 5V', position: { x: 30, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: {} },
      ];
      doc.connections = [
        { id: 'c1', fromComponentId: 'pwr-1', fromPinId: 'vcc', toComponentId: 'btn-1', toPinId: 'pin1', wireColor: '#ef4444' },
        { id: 'c2', fromComponentId: 'btn-1', fromPinId: 'pin2', toComponentId: 'buz-1', toPinId: 'pin_pos', wireColor: '#f59e0b' },
        { id: 'c3', fromComponentId: 'buz-1', fromPinId: 'pin_neg', toComponentId: 'pwr-1', toPinId: 'gnd', wireColor: '#1e293b' },
      ];
      return doc;
    },
    evaluate: (doc, simResult) => {
      const buz = doc.components.find((c) => c.definitionId === 'buzzer');
      if (!buz) return { isCompleted: false, activeStepIndex: 0, progressPercent: 30, feedback: 'Hãy thêm Còi Buzzer vào mạch.' };
      if (simResult.status === 'running') {
        return { isCompleted: true, activeStepIndex: 2, progressPercent: 100, feedback: 'Tuyệt vời! Còi báo động Buzzer đã phát tín hiệu cảnh báo thành công!' };
      }
      return { isCompleted: false, activeStepIndex: 2, progressPercent: 80, feedback: 'Bật mô phỏng để nghe và xem còi hoạt động.' };
    },
  },
  {
    id: 'lesson-6-temp-lm35',
    number: 6,
    title: 'Cảm biến nhiệt độ LM35 & Giám sát môi trường',
    subtitle: 'Đo lường nhiệt độ tuyến tính chính xác 10mV mỗi độ C',
    difficulty: 'Trung bình',
    estimatedMinutes: 9,
    goal: 'Kết nối cảm biến nhiệt độ tương tự LM35 với nguồn cấp 5V và theo dõi điện áp ngõ ra tương ứng theo nhiệt độ C.',
    steps: [
      {
        id: 'step-1',
        title: 'Bước 1: Đặt cảm biến nhiệt độ LM35',
        instruction: 'Kéo 1 Cảm biến nhiệt độ LM35 (TO-92) và Nguồn cấp 5V lên bo mạch.',
        hint: 'LM35 có 3 chân: Vs (Chân 1), Vout (Chân 2), GND (Chân 3).',
      },
      {
        id: 'step-2',
        title: 'Bước 2: Cấp nguồn cho cảm biến',
        instruction: 'Nối VCC vào chân Vs và GND vào chân GND của cảm biến.',
        hint: 'Mỗi 1°C nhiệt độ tăng thêm, chân Vout sẽ xuất ra thêm đúng 10mV (0.01V).',
      },
      {
        id: 'step-3',
        title: 'Bước 3: Chạy mô phỏng',
        instruction: 'Bật mô phỏng và quan sát điện áp đo được tại ngõ ra của cảm biến.',
        hint: 'Ở 25°C nhiệt độ phòng, Vout sẽ là 250mV.',
      },
    ],
    createInitialProject: () => {
      const doc = createDefaultProjectDocument('Bài 6: Cảm biến nhiệt độ LM35');
      doc.components = [
        { instanceId: 'pwr-1', definitionId: 'dc-source', name: 'Nguồn 5V', position: { x: -45, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { voltage: 5.0 } },
        { instanceId: 'tmp-1', definitionId: 'temp-sensor', name: 'LM35 Sensor', position: { x: 10, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { temperature: 28.5 } },
      ];
      doc.connections = [
        { id: 'c1', fromComponentId: 'pwr-1', fromPinId: 'vcc', toComponentId: 'tmp-1', toPinId: 'vcc', wireColor: '#ef4444' },
        { id: 'c2', fromComponentId: 'tmp-1', fromPinId: 'gnd', toComponentId: 'pwr-1', toPinId: 'gnd', wireColor: '#1e293b' },
      ];
      return doc;
    },
    evaluate: (doc, simResult) => {
      const tmp = doc.components.find((c) => c.definitionId === 'temp-sensor');
      if (!tmp) return { isCompleted: false, activeStepIndex: 0, progressPercent: 30, feedback: 'Hãy thêm cảm biến LM35 vào bo mạch.' };
      if (simResult.status === 'running') {
        return { isCompleted: true, activeStepIndex: 2, progressPercent: 100, feedback: 'Xuất sắc! Cảm biến LM35 đang đo nhiệt độ chuẩn xác 10mV/°C!' };
      }
      return { isCompleted: false, activeStepIndex: 2, progressPercent: 80, feedback: 'Nhấn Bắt đầu mô phỏng để khởi động cảm biến.' };
    },
  },
  {
    id: 'lesson-7-relay-isolation',
    number: 7,
    title: 'Rơ-le (Relay) đóng cắt tải công suất cao cách ly',
    subtitle: 'Nguyên lý cuộn điện từ kích hoạt tiếp điểm cơ khí an toàn',
    difficulty: 'Nâng cao',
    estimatedMinutes: 12,
    goal: 'Dùng tín hiệu điều khiển điện áp thấp kích cuộn hút rơ-le để đóng ngắt tiếp điểm NO (Thường mở), cấp điện an toàn cho tải nặng.',
    steps: [
      {
        id: 'step-1',
        title: 'Bước 1: Bố trí Rơ-le 5V và Diode dập xung Flyback',
        instruction: 'Kéo 1 Rơ-le 5V, 1 Diode 1N4007 dập xung, 1 Công tắc kích hoạt và Nguồn cấp.',
        hint: 'Diode bảo vệ mắc song song ngược cực với cuộn hút rơ-le để triệt tiêu sức điện động tự cảm khi ngắt.',
      },
      {
        id: 'step-2',
        title: 'Bước 2: Nối cuộn hút rơ-le',
        instruction: 'Nối nguồn qua công tắc vào chân Coil (+) và Coil (-) về mass GND.',
        hint: 'Khi có dòng qua cuộn dây, từ trường sẽ kéo lá đồng đóng tiếp điểm COM và NO.',
      },
      {
        id: 'step-3',
        title: 'Bước 3: Nối tải công suất vào tiếp điểm',
        instruction: 'Nối nguồn cấp tải qua tiếp điểm COM và NO ra bóng đèn tải.',
        hint: 'Hai mạch điện hoàn toàn cách ly về mặt điện học, đảm bảo an toàn tuyệt đối.',
      },
      {
        id: 'step-4',
        title: 'Bước 4: Bật mô phỏng',
        instruction: 'Bật mô phỏng và đóng công tắc để nghe tiếng "tách" tiếp điểm nhảy và đèn tải sáng.',
        hint: 'Rơ-le là cốt lõi của mọi tủ điện công nghiệp và nhà thông minh Smart Home.',
      },
    ],
    createInitialProject: () => {
      const doc = createDefaultProjectDocument('Bài 7: Mạch đóng cắt Relay cách ly');
      doc.components = [
        { instanceId: 'pwr-1', definitionId: 'dc-source', name: 'Nguồn 5V', position: { x: -55, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { voltage: 5.0 } },
        { instanceId: 'sw-1', definitionId: 'switch', name: 'Công tắc Kích', position: { x: -25, y: 0, z: -15 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { type: 'slide' }, state: { open: false } },
        { instanceId: 'rel-1', definitionId: 'relay', name: 'Rơ-le Songle 5V', position: { x: 10, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: {} },
        { instanceId: 'led-1', definitionId: 'led', name: 'Đèn Tải Công Suất', position: { x: 55, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { color: 'blue' } },
      ];
      doc.connections = [
        { id: 'c1', fromComponentId: 'pwr-1', fromPinId: 'vcc', toComponentId: 'sw-1', toPinId: 'pin1', wireColor: '#ef4444' },
        { id: 'c2', fromComponentId: 'sw-1', fromPinId: 'pin2', toComponentId: 'rel-1', toPinId: 'coil_pos', wireColor: '#f59e0b' },
        { id: 'c3', fromComponentId: 'rel-1', fromPinId: 'coil_neg', toComponentId: 'pwr-1', toPinId: 'gnd', wireColor: '#1e293b' },
      ];
      return doc;
    },
    evaluate: (doc, simResult) => {
      const rel = doc.components.find((c) => c.definitionId === 'relay');
      if (!rel) return { isCompleted: false, activeStepIndex: 0, progressPercent: 25, feedback: 'Cần có linh kiện Rơ-le trong mạch.' };
      if (simResult.status === 'running') {
        return { isCompleted: true, activeStepIndex: 3, progressPercent: 100, feedback: 'Thành công! Tiếp điểm Rơ-le đã đóng ngắt cách ly tải công suất an toàn!' };
      }
      return { isCompleted: false, activeStepIndex: 3, progressPercent: 85, feedback: 'Bật mô phỏng để xem rơ-le hoạt động.' };
    },
  },
  {
    id: 'lesson-8-ne555-oscillator',
    number: 8,
    title: 'IC định thời NE555 & Mạch dao động đa hài tạo xung',
    subtitle: 'Tạo nhịp đập điện tử tuần hoàn không cần vi điều khiển',
    difficulty: 'Nâng cao',
    estimatedMinutes: 15,
    goal: 'Mắc IC NE555 ở chế độ dao động đa hài (Astable Multivibrator) cùng tụ điện 100µF và điện trở để tạo xung vuông tự động chớp nháy LED.',
    steps: [
      {
        id: 'step-1',
        title: 'Bước 1: Bố trí IC NE555, Tụ điện và Điện trở',
        instruction: 'Kéo IC NE555 DIP-8, Tụ điện 100µF, Điện trở định thời 10kΩ và LED lên bo mạch.',
        hint: 'IC NE555 so sánh điện áp nạp xả trên tụ điện giữa ngưỡng 1/3 VCC và 2/3 VCC để lật trạng thái ngõ ra.',
      },
      {
        id: 'step-2',
        title: 'Bước 2: Nối chân nguồn và chân kích',
        instruction: 'Nối VCC vào chân VCC và Chân Reset. Nối GND về mass.',
        hint: 'Chân Trigger và Threshold nối chung với tụ điện định thời để đo điện áp nạp.',
      },
      {
        id: 'step-3',
        title: 'Bước 3: Nối ngõ ra Chân 3 ra LED',
        instruction: 'Nối chân OUT (Chân 3) của IC NE555 qua điện trở hạn dòng vào LED chỉ thị.',
        hint: 'Ngõ ra chân 3 sẽ luân phiên ở mức CAO (5V) và THẤP (0V) theo tần số f = 1.44 / ((R1 + 2R2) * C).',
      },
      {
        id: 'step-4',
        title: 'Bước 4: Chạy mô phỏng',
        instruction: 'Nhấn Bắt đầu mô phỏng và quan sát LED nháy theo chu kỳ xung vuông đều đặn.',
        hint: 'Bạn có thể thay đổi điện dung tụ điện để đổi tốc độ nháy từ chậm đến siêu nhanh.',
      },
    ],
    createInitialProject: () => {
      const doc = createDefaultProjectDocument('Bài 8: Mạch dao động đa hài NE555');
      doc.components = [
        { instanceId: 'pwr-1', definitionId: 'dc-source', name: 'Nguồn 9V', position: { x: -60, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { voltage: 9.0 } },
        { instanceId: 'ic-1', definitionId: 'ne555', name: 'IC NE555 DIP8', position: { x: -10, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: {} },
        { instanceId: 'cap-1', definitionId: 'capacitor', name: 'Tụ 100µF', position: { x: -10, y: 0, z: -25 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { capacitance: 0.0001 } },
        { instanceId: 'res-1', definitionId: 'resistor', name: 'R1 10kΩ', position: { x: 20, y: 0, z: -15 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { resistance: 10000 } },
        { instanceId: 'led-1', definitionId: 'led', name: 'LED Xung Ra', position: { x: 50, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, parameters: { color: 'green' } },
      ];
      doc.connections = [
        { id: 'c1', fromComponentId: 'pwr-1', fromPinId: 'vcc', toComponentId: 'ic-1', toPinId: 'vcc', wireColor: '#ef4444' },
        { id: 'c2', fromComponentId: 'ic-1', fromPinId: 'gnd', toComponentId: 'pwr-1', toPinId: 'gnd', wireColor: '#1e293b' },
        { id: 'c3', fromComponentId: 'ic-1', fromPinId: 'out', toComponentId: 'res-1', toPinId: 'pin1', wireColor: '#f59e0b' },
        { id: 'c4', fromComponentId: 'res-1', fromPinId: 'pin2', toComponentId: 'led-1', toPinId: 'anode', wireColor: '#10b981' },
        { id: 'c5', fromComponentId: 'led-1', fromPinId: 'cathode', toComponentId: 'pwr-1', toPinId: 'gnd', wireColor: '#1e293b' },
      ];
      return doc;
    },
    evaluate: (doc, simResult) => {
      const ic = doc.components.find((c) => c.definitionId === 'ne555');
      if (!ic) return { isCompleted: false, activeStepIndex: 0, progressPercent: 25, feedback: 'Hãy thêm IC NE555 vào bo mạch.' };
      if (simResult.status === 'running') {
        return { isCompleted: true, activeStepIndex: 3, progressPercent: 100, feedback: 'Chúc mừng bạn! Bạn đã hoàn thành toàn bộ 8 bài học mạch điện tử nâng cao với IC NE555!' };
      }
      return { isCompleted: false, activeStepIndex: 3, progressPercent: 85, feedback: 'Bật mô phỏng để quan sát xung nhịp dao động.' };
    },
  },
];
