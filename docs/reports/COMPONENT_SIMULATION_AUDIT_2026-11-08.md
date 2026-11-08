# Kiểm định linh kiện, mô hình 3D và mô phỏng — 2026-11-08

Phạm vi: toàn bộ registry `COMPONENT_DEFINITIONS` (27 định nghĩa) và 4 định nghĩa đăng ký thêm để mở dự án cũ (`terminal_block_2pin`, `resistor_axial`, `led_basic`, `arduino_uno`), cùng bộ giải (`src/domain/simulation/engine.ts`), DRC (`src/domain/validation/engine.ts`), mô hình 3D thủ tục (`src/scene/proceduralModels.ts`), Property Panel, thư viện linh kiện, dự án mẫu, thiết kế sản phẩm Marketplace và mạch bài học.

Cách đánh giá: PASS = đúng và có test/nguồn đối chiếu; PARTIAL = đúng một phần, giới hạn được ghi rõ; FAIL = sai/thiếu (trước khi sửa); NOT IMPLEMENTED; NOT VERIFIED = chưa đủ bằng chứng. Không có linh kiện nào được đánh dấu PASS chỉ vì hiển thị được trên canvas.

Nguồn thông số: datasheet nhà sản xuất của chính linh kiện được ghi trong bảng (TI LM7805/LM35/NE555, Nexperia/TI 74HC08, ON Semi PN2222A, Songle SRD-05VDC-SL-C, Diodes/Vishay 1N4007, Microchip ATmega328P, Arduino UNO R3 tech specs, TowerPro SG90, HC-SR04), các ví dụ chính thức của Arduino (Blink, Button, AnalogInOutSerial, Knob) và thư viện Servo. Giá trị không có datasheet cụ thể (động cơ DC hobby, LDR, buzzer) được ghi rõ là **giả định** và chỉnh được trong Property Panel.

---

## A. Tóm tắt

| Chỉ số | Số lượng |
|---|---|
| Định nghĩa được kiểm tra | 27 (+ 4 bản đăng ký cho dự án cũ) |
| Đạt chuẩn trước đợt này (không cần sửa gì) | 4: `resistor`, `switch`, `connector`, `diode` (diode chỉ cập nhật chú thích) |
| Có lỗi trước đợt này | 23 |
| Đã sửa (định nghĩa, chân, thông số, mô phỏng hoặc hình 3D) | 23 |
| Dựng lại hình 3D | 6: NE555 (DIP-8), 74HC08 (DIP-14), LED RGB, LED 7 đoạn, servo (cánh tay xoay theo góc), động cơ DC (trục quay) |
| Bổ sung mô hình mô phỏng (trước đây "chưa hỗ trợ") | 11: transistor NPN, LM7805, LM35, 74HC08, NE555, LED RGB, LED 7 đoạn, động cơ DC, servo SG90, OLED (chỉ nguồn), HC-SR04 (chỉ nguồn) |
| Viết lại mô hình sai | Arduino UNO (bỏ giả định D13 luôn HIGH), rơ-le (ngưỡng hút, NC), còi (cực tính, dải áp), LED (Vf theo màu), breadboard (chân cũ `strip_N`, thanh ngắt giữa) |

Giới hạn lớn còn lại: chưa tích phân theo thời gian (tụ/cuộn cảm chỉ có τ, không có dạng sóng), Arduino chỉ chạy 4 chương trình mẫu (không biên dịch sketch), OLED/I2C và HC-SR04 TRIG/ECHO chưa mô phỏng, chưa có linh kiện cuộn cảm và MOSFET trong thư viện.

---

## B. Ma trận kiểm định từng linh kiện

File định nghĩa của mọi dòng: `src/domain/components/definitions.ts`; mô hình 3D: `src/scene/proceduralModels.ts` (trừ khi ghi GLB). Cột "Trước" là trạng thái lúc bắt đầu kiểm định, "Sau" là sau khi sửa.

| ID | Tên | 3D | Chân | Mô hình điện | Mức mô phỏng | DRC | Test | Thay đổi | Giới hạn còn lại |
|---|---|---|---|---|---|---|---|---|---|
| `dc-source` | Nguồn DC | PASS | PASS (VCC/GND) | Trước PARTIAL → Sau PASS | dc | SHORT_CIRCUIT, SOURCE_OVERLOAD | PASS | Chẩn đoán có cấu trúc; quá dòng mặc định 1 A | Không có chế độ giới hạn dòng như nguồn bàn thật |
| `resistor` | Điện trở | PASS (vạch màu theo trị số) | PASS | PASS | dc | OVERPOWER | PASS | Chỉ thêm `powerW` | Không xét dung sai/nhiệt |
| `led` | LED 5 mm | PASS | PASS (A chân dài −2,54; K 0) | Trước FAIL (mọi màu dùng Vf 2,0 V do giá trị mặc định lưu sẵn) → Sau PASS | dc | LED_OVERCURRENT_RISK, REVERSE_POLARITY | PASS | Vf theo màu, nhãn màu sửa (lục 525 nm là InGaN ~3 V nên đổi thành ~570 nm, 2,2 V), độ sáng 3D theo dòng | Tuyến tính từng đoạn, không có quang thông |
| `switch` | Công tắc SPST | PASS | PASS | PASS | dc | — | PASS | Nút ở Property Panel ghi sai trường (`parameters.open` đảo không đúng) → sửa, bộ giải đọc cả `parameters.open` | Không mô phỏng rung tiếp điểm |
| `connector` | Cọc đấu dây | PASS | PASS | PASS (2 cực độc lập) | layout | — | PASS (gián tiếp) | — | — |
| `potentiometer` | Biến trở | PASS | PASS (3 chân) | Trước PARTIAL (không chỉnh được vị trí con chạy) → Sau PASS | dc | — | PASS (0/25/50/75/100 %) | Thêm thanh trượt vị trí con chạy | Tuyến tính, không có điện trở đầu mút |
| `capacitor` | Tụ hóa | PASS | PASS (+/−) | Trước PARTIAL → Sau PARTIAL | dc + τ | OVERVOLTAGE, REVERSE_POLARITY | PASS | τ = R_th·C, chọn điện áp định mức, kiểm tra quá áp/ngược cực | Không có dạng sóng nạp/xả |
| `pushbutton` | Nút nhấn 6×6 | Trước FAIL (2/4 chân) → Sau PASS | Sau PASS (1A,2A,1B,2B) | PASS | dc | — | PASS | Thêm 2 chân nối trong, chân 3D, ô "đang nhấn" | Không có bounce |
| `diode` | 1N4007 | PASS | PASS | PASS (Vf 0,7 V + 1 Ω) | dc | OVERCURRENT | PASS | — | Không có đánh thủng ngược |
| `buzzer` | Còi chủ động 5 V | PASS | PASS | Trước FAIL (kêu cả khi ngược cực, ngưỡng 2 V) → Sau PARTIAL | behavioral | OVERVOLTAGE | PASS | Ngược cực = hở mạch; kêu ở 4–7 V | Không phát âm thanh; tải 170 Ω là giá trị tương đương (≈ 30 mA ở 5 V) |
| `ldr` | Quang trở | PASS | PASS | PARTIAL | dc | — | PASS | Thanh trượt mức sáng | Thang % không quy đổi lux (giả định nội suy mũ) |
| `relay` | Rơ-le 5 V SPDT | Trước FAIL (thiếu NC) → Sau PASS | Sau PASS (coil±, COM, NO, NC) | Trước FAIL (ngưỡng 30 mA, không có NC) → Sau PASS | behavioral | RELAY_FLYBACK (info) | PASS | Ngưỡng hút 3,75 V / nhả 0,5 V theo SRD-05VDC, COM–NC khi chưa kích | Không có thời gian đóng/ngắt |
| `ne555` | NE555 | Trước FAIL (hộp không chân) → Sau PASS (DIP-8, khuyết, chấm chân 1) | Trước FAIL (4/8 chân, vị trí sai) → Sau PASS | Trước NOT IMPLEMENTED → Sau PARTIAL | behavioral | FLOATING_INPUT, OVERVOLTAGE, OVERCURRENT | PASS | Astable, monostable, bộ so sánh; RESET thả nổi bị báo | Chỉ nhận dạng RC mắc trực tiếp; không có dạng sóng |
| `logic-and` | 74HC08 | Trước FAIL → Sau PASS (DIP-14) | Trước FAIL (5/14 chân) → Sau PASS | Trước NOT IMPLEMENTED → Sau PASS (logic lý tưởng) | digital | FLOATING_INPUT, OVERVOLTAGE, OVERCURRENT, MISSING_POWER | PASS (bảng chân lý) | 4 cổng, ngưỡng 0,3/0,7·VCC | Không có trễ lan truyền |
| `arduino-uno` | Arduino UNO R3 | PASS (GLB) | PARTIAL (32 chân đủ tên; khoảng cách D8–D7 xem mục F) | Trước FAIL (D13 luôn HIGH) → Sau PARTIAL | behavioral | OVERCURRENT (20/40 mA), SOURCE_OVERLOAD, FLOATING_INPUT | PASS | Chương trình mẫu: none, Blink, Button, AnalogInOutSerial, Knob; bỏ tùy chọn "logic 3,3 V" không có trên UNO R3; 3V3 50 mA | Không biên dịch sketch, không UART/I2C/SPI/ngắt |
| `breadboard` | Breadboard | PASS (GLB) | Trước FAIL (chân `strip_N` nối sai cột) → Sau PASS | PASS | layout | — | PASS (mọi nhóm nối thông) | Thanh nguồn ngắt giữa (tùy chọn); bỏ tùy chọn số điểm cắm/điện áp thanh không có tác dụng | Điện trở tiếp xúc = 0 |
| `temp-sensor` | LM35DZ | PASS | PASS (+VS, OUT, GND) | Trước NOT IMPLEMENTED → Sau PASS | behavioral | OVERVOLTAGE, OVERCURRENT, MISSING_POWER | PASS | 10 mV/°C khi 4–30 V; thanh trượt nhiệt độ 0–100 °C | Không có sai số ±0,5 °C |
| `transistor-npn` | 2N2222A | PASS (sửa chân B lệch 1,5 mm) | PASS (C-B-E thẳng hàng) | Trước NOT IMPLEMENTED → Sau PARTIAL | behavioral | OVERCURRENT, OVERPOWER, OVERVOLTAGE | PASS (3 chế độ) | Tắt / khuếch đại / bão hòa, β chỉnh được | Không Ebers–Moll, không Early |
| `ultrasonic-sensor` | HC-SR04 (bản cũ) | PASS | PASS | Như `ultrasonic-sr04` | power-only | — | PASS (dự án mẫu) | Ánh xạ về `ultrasonic-sr04`, ẩn khỏi thư viện | — |
| `servo-motor` | SG90 (bản cũ) | PASS | PASS | Như `servo-sg90` | behavioral | — | PASS | Ánh xạ về `servo-sg90` (chân `signal`→`pwm`), ẩn khỏi thư viện | — |
| `rgb-led` | LED RGB | Trước FAIL (màu theo thông số) → Sau PASS | PASS (R, K, G, B) | Trước NOT IMPLEMENTED → Sau PASS | dc | LED_OVERCURRENT_RISK→OVERCURRENT | PASS | 3 LED chung cathode, màu trộn theo dòng | Vf điển hình |
| `7seg-display` | LED 7 đoạn | Trước FAIL (số theo thông số) → Sau PASS | Trước FAIL (5/10 chân) → Sau PASS | Trước NOT IMPLEMENTED → Sau PASS | dc | OVERCURRENT | PASS | 8 LED, 2 COM nối trong, đoạn sáng theo dòng | Chỉ cathode chung |
| `oled-i2c` | OLED 0,96" | Trước FAIL (màn hình phát sáng khi có điện) → Sau PASS (tối) | PASS | NOT IMPLEMENTED (giao thức) | power-only | OVERVOLTAGE, REVERSE_POLARITY, MISSING_POWER | PASS | Không hiển thị nội dung giả | Chưa mô phỏng I2C/SSD1306 |
| `ultrasonic-sr04` | HC-SR04 | PASS | PASS | NOT IMPLEMENTED (đo) | power-only | như trên | PASS | Báo ECHO lý thuyết = cm × 58 µs | Chưa có TRIG/ECHO theo thời gian |
| `servo-sg90` | Servo SG90 | Trước FAIL (quay theo thông số) → Sau PASS | PASS | Trước NOT IMPLEMENTED → Sau PARTIAL | behavioral | OVERVOLTAGE, MISSING_POWER | PASS | Góc chỉ theo xung từ chương trình Knob; không có xung thì đứng yên | Không tính dòng servo |
| `dc-motor` | Động cơ DC 3–6 V | PASS (thêm cờ trên trục) | PASS | Trước NOT IMPLEMENTED → Sau PARTIAL | behavioral | (qua nguồn/chân cấp) | PASS | Tải tương đương (giả định 20 Ω), tốc độ ∝ V, đảo chiều | Không phản điện động |
| `voltage-reg-7805` | LM7805/7812 | PASS | PASS (IN-GND-OUT) | Trước NOT IMPLEMENTED → Sau PARTIAL | behavioral | OVERVOLTAGE, REGULATOR_DROPOUT, OVERCURRENT, THERMAL | PASS | Ổn áp / sụt áp / giới hạn dòng; bỏ tùy chọn "3,3 V AMS1117" vì chân AMS1117 khác thứ tự | Không nhiệt độ mối nối, gợn sóng |

---

## C. Độ chính xác mô phỏng

Nguyên lý chung: MNA DC xác lập. Kết quả "thực tế" bên dưới là giá trị bộ giải trả về trong `test/components_simulation.test.ts`; dung sai là sai số tương đối tối đa test cho phép. Điện trở trong nguồn DC (0,05 Ω) có trong cả giá trị kỳ vọng.

| Linh kiện | Công thức / thuật toán | Đầu vào | Kỳ vọng | Thực tế (dung sai) |
|---|---|---|---|---|
| Điện trở | I = V/(R + Rs) | 5 V, 1 kΩ | 4,99975 mA | khớp (1e-9) |
| Phân áp | V = V·R2/(R1+R2+Rs) | 10 V, 1 kΩ/1 kΩ | 4,99988 V | khớp (1e-9) |
| LED | I = (V − Vf)/(R + 10 Ω + Rs) | 5 V, 220 Ω, đỏ/lam/lục | 13,04 / 8,69 / 12,17 mA | khớp (1e-6) |
| Diode | I = (V − 0,7)/(R + 1 Ω + Rs) | 5 V, 1 kΩ | 4,296 mA | khớp (1e-6); ngược: 0 |
| Tụ | DC: hở; τ = R_th·C (nguồn áp nối tắt, test 1 A) | 5 V, 1 kΩ, 100 µF | Vc 5 V, τ 0,100005 s | khớp (1e-3 / 1e-6) |
| Biến trở | V_w = V·(1 − x) | 10 kΩ, x = 0…1 | 5; 3,75; 2,5; 1,25; 0 V | sai lệch < 5 mV (có tải đo 10 MΩ) |
| Nút nhấn | tiếp điểm 0,01 Ω | 5 V, 1 kΩ | 4,9997 mA khi nhấn, 0 khi nhả | khớp (1e-6) |
| Còi | R tương đương 170 Ω khi đúng cực | 5 V | 29,4 mA, kêu; ngược: 0, im; 3,3 V: im | khớp |
| LDR | R = R_tối·(R_sáng/R_tối)^x | 0 %, 100 % | 1 MΩ, 400 Ω | khớp (1e-6) |
| Rơ-le | cuộn 70 Ω; hút ≥ 3,75 V | 5 V / 3,3 V | NO đóng / NC đóng | khớp (1e-5) |
| Transistor | VBE 0,7 V + 10 Ω; active IC = β·IB; sat VCE 0,2 V + 0,5 Ω | RB 1 kΩ / 1 MΩ, RC 1 kΩ | bão hòa 4,8 mA; active 0,43 mA = 100·IB; tắt 0 | khớp (2e-3) |
| LM7805 | regulating: OUT = 5 V; IIN = IOUT + 5 mA; Pd = (VIN−VOUT)·IOUT + VIN·IQ | 12 V, 100 Ω | 5 V, IIN 55 mA, Pd 0,41 W | khớp (1e-4…3e-3) |
| LM7805 sụt áp | OUT = VIN − 2 V | 6 V, 1 kΩ | 4,0 V + cảnh báo | khớp (2e-3) |
| LM35 | VOUT = 0,01·T | 25 °C, 80 °C | 0,25 V, 0,80 V | khớp (1e-4) |
| 74HC08 | Y = A·B, VIH 0,7·VCC, VIL 0,3·VCC, ngõ ra 50 Ω | 4 tổ hợp | 0,0,0, 4,975 V (tải 10 kΩ) | khớp |
| NE555 astable | f = 1/(ln2·(RA+2RB)·C); D = (RA+RB)/(RA+2RB) | 9 V, 1 kΩ, 10 kΩ, 10 µF | 6,870 Hz, 52,4 % | khớp (1e-9) |
| NE555 monostable | T = 1,1·R·C | 100 kΩ, 10 µF | 1,10 s; OUT cao khi TRIG < VCC/3 | khớp |
| Arduino Blink | D13 HIGH 1 s / LOW 1 s | LED + 220 Ω ở D13 | 0,5 Hz, 50 %, dòng TB 5,88 mA | khớp (1e-3) |
| Arduino AnalogInOutSerial | ADC = ⌊V·1024/5⌋; duty = round(ADC/4)/255; 490 Hz | biến trở 50 % | ADC 511, duty 128/255 | khớp |
| Arduino Knob | góc = ⌊ADC·180/1023⌋; xung 544 + góc/180·1856 µs | biến trở 25 % | 134° | khớp |
| Động cơ DC | I = V/R_tđ; rpm = rpm_6V·V/6 | 6 V | 2999 vòng/phút, đảo chiều khi đảo cực | khớp (1e-6) |

Giả định và đơn giản hóa (đều hiển thị trong Property Panel → "Mô hình / Giới hạn" và trong ghi chú kết quả):
- LED/diode là mô hình tuyến tính từng đoạn, không phải đặc tuyến mũ Shockley; transistor là PWL ba chế độ, không phải SPICE.
- Dao động được giải ở hai mức (cao/thấp), không có dạng sóng theo thời gian; nhiều bộ dao động được xét riêng từng bộ (có thông báo INFO).
- Nút "thả nổi" = không nối tới nguồn áp nào qua trở kháng < 100 MΩ.

---

## D. Thay đổi mô hình 3D

| Mô hình | Thay đổi |
|---|---|
| NE555 | Dựng lại vỏ DIP-8 9,8 × 6,35 mm, khuyết chân 1, chấm chân 1, 8 chân dẹt tại đúng vị trí chân định nghĩa |
| 74HC08 | Dựng lại vỏ DIP-14 19,0 × 6,35 mm, khuyết, chấm chân 1, 14 chân |
| Nút nhấn, rơ-le, LED 7 đoạn | Thêm chân kim loại tại đúng vị trí mọi chân (dùng chung một geometry/material đã đăng ký `markShared`) |
| LED | Độ sáng (đèn điểm + quầng) tỉ lệ dòng thực (1 = 20 mA); tắt khi dòng < 0,2 mA |
| LED RGB | Màu trộn từ dòng ba chip; chân cathode dài nhất |
| LED 7 đoạn | Mỗi đoạn sáng theo dòng riêng; thêm dấu chấm DP; vật liệu bật/tắt dùng chung |
| OLED | Không còn phát sáng khi chỉ có nguồn |
| Servo | Cánh tay gắn trên trục xoay; góc = góc mô phỏng khi có xung, còn không thì giữ góc lắp |
| Động cơ DC | Thêm cờ trên trục; trục quay theo vòng/phút mô phỏng trong vòng render |
| Transistor | Chân B thẳng hàng với C, E (trước lệch 1,5 mm theo z) |
| Nhấp nháy | LED/còi/RGB/7 đoạn theo bộ dao động ≤ 20 Hz đổi vật liệu và đèn trong vòng render, không dựng lại mesh |
| Dây | Hiệu ứng dòng điện chỉ chạy trên dây nối với linh kiện có dòng |

Thay đổi vị trí chân: NE555, 74HC08 (theo package DIP), LED 7 đoạn (giữ vị trí 5 chân cũ, thêm 5 chân), LM35 (±2,5 → ±2,54 mm), transistor chân B (z 1,5 → 0). ID chân cũ đều được giữ nên dây cũ vẫn nối đúng chân; dây 3D tự đi lại theo vị trí mới. Riêng IC đã cắm sẵn trên breadboard trong dự án cũ có thể nhận lỗ khác vì vị trí chân thay đổi (trước đây vị trí chân không theo package thật, và IC chưa được mô phỏng nên không có kết quả cũ bị đổi).

Tương thích dữ liệu: không đổi `definitionId` đã lưu, không xóa tham số, không ghi lại dữ liệu khi mở dự án (test kiểm tra JSON không đổi sau mô phỏng/DRC trên toàn bộ dự án mẫu, sản phẩm và bài học).

---

## E. Kết quả kiểm thử

| Kiểm tra | Kết quả |
|---|---|
| `test/components_simulation.test.ts` (mới) | 55/55 PASS |
| `test/domain_simulation_ai.test.ts` | 30/30 PASS (2 test cập nhật: servo và NE555 giờ đã có mô hình; vẫn kiểm tra linh kiện không đăng ký bị đánh dấu "Chưa hỗ trợ" và NE555 chỉ có nguồn không dao động) |
| `npm run lint` | PASS |
| `npm test` (toàn bộ, 14 bộ) | PASS — verify 18, task 2.1/2.2/2.3 PASS, domain 30, linh kiện 55, scene 15, AI chat 11, bảo mật/thanh toán 56, deploy 41, serverless 51, Vercel output 29 |
| `npm run build` | PASS |
| Kiểm thử 3D trên trình duyệt (Chromium của app, dev server cục bộ, Supabase trỏ vào cổng không tồn tại) | PASS cho phần dựng hình: trang xem tạm dùng đúng `createComponentMesh` + `simulateBehavior` (đã xóa sau khi kiểm tra). NE555 DIP-8 và 74HC08 DIP-14 có đủ chân, khuyết và chấm chân 1; LED 7 đoạn sáng đúng đoạn a, d; LED RGB tím (đỏ + lam); LED theo NE555 nhấp nháy 6,87 Hz, 52 %; servo 134°; động cơ quay; 0 lỗi console. **NOT RUN:** luồng trong Workspace thật (cần đăng nhập, bản cách ly không có backend) |
| Thiết bị di động/máy tính bảng thật | NOT RUN |
| Đo FPS / RAM / GPU | NOT RUN (không có công cụ profiling trên trình duyệt nhúng; không ghi số liệu) |
| Hiệu năng bộ giải | Mạch 161 linh kiện (40 nhánh transistor + LED): 32 ms trên máy phát triển (một lần đo, chỉ để tham khảo) |

---

## F. Vấn đề còn tồn tại

1. **Arduino UNO — khoảng cách chân:** trong định nghĩa, D8 và D7 cách nhau 1,62 mm. Trên UNO R3 thật hai header digital lệch 160 mil (4,06 mm giữa D8 và D7). Tọa độ hiện tại có vẻ được lấy từ mô hình GLB nên chưa sửa: cần đối chiếu với GLB trước khi đổi để chân không lệch khỏi hình. Trạng thái: NOT VERIFIED.
2. **Chưa có mô phỏng theo thời gian** (nạp/xả tụ, RL, RLC, dạng sóng 555, trễ logic). Đề xuất: thêm phân tích quá độ Euler lùi dựa trên chính ma trận MNA hiện có (tụ → nguồn dòng + điện dẫn C/Δt).
3. **Arduino:** chỉ 4 chương trình mẫu. Đề xuất: trình thông dịch tập con (`pinMode`, `digitalWrite/Read`, `analogRead/Write`, `delay`) có giới hạn bước, chạy trong Web Worker.
4. **OLED (I2C/SSD1306) và HC-SR04 (TRIG/ECHO):** chưa mô phỏng; chỉ kiểm tra nguồn.
5. **Chưa có trong thư viện:** cuộn cảm, MOSFET, transistor PNP, IC logic khác (74HC00/04/32), còi thụ động — không thể kiểm định vì chưa tồn tại.
6. **Động cơ DC, LDR, buzzer:** thông số mặc định là giá trị điển hình/giả định (ghi rõ), không thuộc một mã linh kiện cụ thể.
7. **Kiểm thử online và thiết bị thật** chưa chạy.
8. **Module legacy** (`src/domain/componentLibrary.ts`, `src/engine/*`, `src/types/circuit.ts`) có bộ định nghĩa linh kiện song song, không nằm trong luồng chạy của ứng dụng (xem `docs/ARCHITECTURE.md`); không sửa trong đợt này.

## Tài liệu

| File | Cập nhật |
|---|---|
| `docs/PROGRESS.md` | Mục C1 |
| `docs/ARCHITECTURE.md` | Bảng module, giới hạn, mục "Mô phỏng & linh kiện" |
| `docs/CONTRACTS.md` | Mục 5 (alias, chân mới, tham số), mục 6 (`diagnostics`, `visual`, `pwm`, `mode`, `timeConstantS`, ruleId) |
| `docs/TEST-PLAN.md` | Thêm bộ test mới |
| `ROADMAP.md` | Task C1 |
| `SYSTEM_ARCHITECTURE_DETAILED.md` | Mục 4.1, 5.1, 5.2 (file nội bộ, không đưa lên GitHub) |
| `docs/DEPLOYMENT.md` | **Không đổi:** không có dependency, biến môi trường, route hay giới hạn tài nguyên mới; mô phỏng chạy hoàn toàn trên trình duyệt, không ảnh hưởng Vercel Function hay Supabase |
