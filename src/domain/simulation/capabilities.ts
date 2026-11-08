/**
 * Published simulation support per canonical component definition. The Property Panel shows it,
 * the audit report documents it and tests require an entry for every registered component.
 *
 * Levels:
 *  - dc          linear/piecewise-linear element in the MNA DC solver
 *  - behavioral  device-level model with modes derived from the solved voltages
 *  - digital     ideal logic levels with datasheet thresholds
 *  - power-only  only the supply voltage is checked; the device's function is not simulated
 *  - layout      mechanical / connection part without its own electrical behaviour
 */
export type SimulationLevel = 'dc' | 'behavioral' | 'digital' | 'power-only' | 'layout';

export interface SimulationSupport {
  level: SimulationLevel;
  summary: string;
  limits: string;
}

export const SIMULATION_LEVEL_LABEL: Record<SimulationLevel, string> = {
  dc: 'Mô phỏng DC (MNA)',
  behavioral: 'Mô hình hành vi',
  digital: 'Logic số lý tưởng',
  'power-only': 'Chỉ kiểm tra nguồn',
  layout: 'Kết nối / lắp ráp',
};

export const SIMULATION_SUPPORT: Record<string, SimulationSupport> = {
  'dc-source': { level: 'dc', summary: 'Nguồn áp lý tưởng nối tiếp điện trở trong 0,05 Ω; báo quá dòng theo dòng tối đa và đoản mạch.', limits: 'Không mô phỏng giới hạn dòng (current limit) của nguồn thật.' },
  resistor: { level: 'dc', summary: 'Định luật Ohm, công suất P = I²R so với công suất định mức.', limits: 'Không xét dung sai và nhiệt độ.' },
  potentiometer: { level: 'dc', summary: 'Hai điện trở R·x và R·(1 − x) quanh con chạy, x chỉnh trong Property Panel.', limits: 'Đặc tuyến tuyến tính (loại B); không xét điện trở đầu mút.' },
  ldr: { level: 'dc', summary: 'R = R_tối·(R_sáng/R_tối)^(mức sáng) – nội suy hàm mũ.', limits: 'Thang % ánh sáng không quy đổi ra lux; không có độ trễ đáp ứng.' },
  capacitor: { level: 'dc', summary: 'Hở mạch ở DC xác lập; điện áp tụ, hằng số thời gian τ = R_th·C, quá áp và ngược cực.', limits: 'Không tích phân quá trình nạp/xả theo thời gian (chỉ báo τ).' },
  switch: { level: 'dc', summary: 'Tiếp điểm 0,01 Ω khi đóng, hở mạch khi mở.', limits: 'Không mô phỏng rung tiếp điểm (bounce).' },
  pushbutton: { level: 'dc', summary: '4 chân: 1A–1B và 2A–2B nối liền; nhấn nối hai nhóm.', limits: 'Không mô phỏng rung tiếp điểm (bounce).' },
  connector: { level: 'layout', summary: 'Hai cực độc lập, chỉ nối theo dây.', limits: 'Không có mô hình điện riêng.' },
  breadboard: { level: 'layout', summary: 'Cột A–E / F–J nối thông, 4 thanh nguồn (liền hoặc ngắt giữa), cắm chân trong bán kính 3 mm.', limits: 'Điện trở tiếp xúc lỗ cắm coi như bằng 0.' },
  led: { level: 'dc', summary: 'Tuyến tính từng đoạn: hở khi < Vf, Vf (theo màu) + 10 Ω khi dẫn; độ sáng theo dòng.', limits: 'Không mô phỏng đặc tuyến mũ chính xác và quang thông.' },
  diode: { level: 'dc', summary: 'Tuyến tính từng đoạn Vf 0,7 V + 1 Ω, khóa khi phân cực ngược.', limits: 'Không mô phỏng đánh thủng ngược và thời gian phục hồi.' },
  'rgb-led': { level: 'dc', summary: 'Ba LED chung cathode (đỏ 2,0 V; lục, lam 3,2 V); màu hiển thị theo dòng từng chân.', limits: 'Vf là giá trị điển hình, khác nhau theo nhà sản xuất.' },
  '7seg-display': { level: 'dc', summary: '8 LED (a–g, DP) chung cathode, hai chân COM nối liền; đoạn sáng theo dòng thực.', limits: 'Chỉ loại cathode chung; không giải mã BCD.' },
  buzzer: { level: 'behavioral', summary: 'Còi chủ động: tải ~170 Ω đúng cực, kêu khi 4–7 V; hở mạch khi ngược cực.', limits: 'Không phát âm thanh thật; không mô phỏng còi thụ động.' },
  relay: { level: 'behavioral', summary: 'Cuộn 70 Ω, hút ở ≥ 3,75 V, nhả ở ≤ 0,5 V; COM–NO / COM–NC độc lập với mạch cuộn.', limits: 'Không mô phỏng thời gian đóng/ngắt và điện áp cảm ứng khi ngắt.' },
  'transistor-npn': { level: 'behavioral', summary: 'BJT tuyến tính từng đoạn: tắt / khuếch đại (IC = β·IB) / bão hòa (VCE 0,2 V); kiểm tra IC, công suất, VCEO.', limits: 'Không có mô hình Ebers–Moll đầy đủ, hiệu ứng Early, chế độ đảo ngược.' },
  'voltage-reg-7805': { level: 'behavioral', summary: 'LM7805/7812: ổn áp khi VIN ≥ VOUT + 2 V, sụt áp khi thiếu, IQ 5 mA, giới hạn 2,2 A, công suất tiêu tán.', limits: 'Không mô phỏng nhiệt độ mối nối, gợn sóng và đáp ứng quá độ.' },
  'temp-sensor': { level: 'behavioral', summary: 'LM35: VOUT = 10 mV/°C khi +VS 4–30 V, nhiệt độ chỉnh trong Property Panel.', limits: 'Không mô phỏng sai số ±0,5 °C và tự gia nhiệt.' },
  'logic-and': { level: 'digital', summary: '74HC08: 4 cổng AND, chạy khi VCC 2–6 V, ngưỡng 0,3/0,7·VCC, ngõ ra ~50 Ω, phát hiện ngõ vào thả nổi.', limits: 'Logic lý tưởng, không có trễ lan truyền.' },
  ne555: { level: 'behavioral', summary: 'NE555: astable (f = 1/(ln2·(RA+2RB)·C)), monostable (T = 1,1·R·C) và các bộ so sánh 1/3–2/3 VCC; RESET thả nổi bị báo.', limits: 'Chỉ nhận dạng mạch RC mắc trực tiếp; không vẽ dạng sóng theo thời gian.' },
  'arduino-uno': { level: 'behavioral', summary: 'Nguồn USB 5 V (0,5 A) / 3,3 V (50 mA); chương trình mẫu Blink, đọc nút D12, A0 → PWM D9, A0 → Servo D9.', limits: 'Không biên dịch/chạy sketch tùy ý; không có UART, I2C, SPI, ngắt, timer.' },
  'servo-sg90': { level: 'behavioral', summary: 'Kiểm tra nguồn 4,8–6 V; góc theo độ rộng xung (544–2400 µs) từ chương trình Knob của Arduino.', limits: 'Chỉ nhận xung từ chương trình mẫu; không tính dòng tiêu thụ và tốc độ quay.' },
  'dc-motor': { level: 'behavioral', summary: 'Tải điện trở tương đương (giả định, chỉnh được), tốc độ không tải tỉ lệ điện áp, đảo chiều theo cực.', limits: 'Không có sức phản điện động, mô-men tải, dòng khởi động.' },
  'oled-i2c': { level: 'power-only', summary: 'Kiểm tra nguồn 3,3–5 V; màn hình giữ tối vì chưa có dữ liệu I2C.', limits: 'Chưa mô phỏng giao thức I2C / lệnh SSD1306.' },
  'ultrasonic-sr04': { level: 'power-only', summary: 'Kiểm tra nguồn 5 V; tính độ rộng xung ECHO lý thuyết = khoảng cách × 58 µs.', limits: 'Chưa mô phỏng chu trình TRIG/ECHO theo thời gian.' },
};
