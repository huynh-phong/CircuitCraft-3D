# CircuitCraft 3D — Kiến trúc (theo code thực tế)

Tài liệu chi tiết lịch sử: `SYSTEM_ARCHITECTURE_DETAILED.md` (file nội bộ, không đẩy lên GitHub). Tài liệu này tóm tắt kiến trúc **đã chốt** và các module đang chạy.

## Thành phần đang chạy

| Lớp | Module chính |
|---|---|
| Entry client | `src/main.tsx` → `src/App.tsx` (định tuyến, trạng thái editor) |
| Định tuyến | `src/router/routes.ts` (History API, alias URL) |
| Dữ liệu thiết kế | `src/domain/project/*` (ProjectDocument là nguồn sự thật) |
| Lệnh / Undo-Redo | `src/domain/commands/commands.ts`, `history.ts` (`CommandHistory`, tối đa **50** bước) |
| Linh kiện | `src/domain/components/definitions.ts` (định nghĩa, chân theo datasheet, breadboard) + `aliases.ts` (chuẩn hóa ID/chân cũ) + `src/domain/simulation/capabilities.ts` (mức hỗ trợ mô phỏng công bố cho từng linh kiện) |
| Mô phỏng | `src/domain/simulation/engine.ts` — **Modified Nodal Analysis** DC xác lập + mô hình thiết bị tuyến tính từng đoạn / hành vi (xem mục *Mô phỏng & linh kiện* bên dưới) |
| DRC | `src/domain/validation/engine.ts`: luật bố trí (biên bo, va chạm, chưa nối), `INVALID_PIN`, `MISSING_POWER`, cộng **toàn bộ chẩn đoán điện của bộ giải** (cùng nguồn dữ liệu nên không mâu thuẫn) |
| AI | `src/ai/assistantService.ts`, `circuitContext.ts`, `src/domain/ai/proposalValidation.ts` |
| 3D | `src/scene/ThreeScene.tsx`, `models/` (registry bộ model `legacy` / `v2`), `assets/` (thư viện tài nguyên 3D), `workbench/` (bàn làm việc, chỉ trong scene), `modelLoader.ts`, `materials.ts`, `wires.ts`, `disposal.ts`, `sceneReconciler.ts` (chỉ dựng lại object có chữ ký hình ảnh thay đổi). `proceduralModels.ts` chỉ còn re-export `models/` |
| Lưu trữ client | `src/persistence/*` (localStorage theo user + Supabase nếu cấu hình) |
| Server | `server.ts` (Express) + `src/server/security.ts`, `userStore.ts`, `otpService.ts`, `creatorStore.ts`, `paymentMode.ts`, `atomicJson.ts`, `courseMedia.ts` |
| Dữ liệu server | File JSON trong `data/` (in-memory + ghi đồng bộ) và mirror Supabase bằng service role |

## Bất biến (AGENTS.md §8) và cách code tuân thủ

- Dữ liệu dự án là nguồn chính, cảnh 3D dựng lại từ dữ liệu; không lưu đối tượng Three.js vào dữ liệu.
- Mọi thay đổi thiết kế qua `CommandHistory`; đề xuất AI áp dụng bằng `BatchCommand`.
- AI chỉ trả JSON có cấu trúc; được validate và xem trước trước khi áp dụng; không thực thi code từ AI.
- Không đặt secret ở frontend: `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `GEMINI_API_KEY` chỉ ở server.
- Mock và tích hợp thật được tách: thanh toán mô phỏng gắn nhãn & cờ `isMock`; đề xuất mạch không dùng AI gắn nhãn "đề xuất mẫu"; linh kiện chưa có mô hình điện gắn nhãn "Chưa hỗ trợ mô phỏng điện".

## Giới hạn hiện tại (đã biết)

- Triển khai: client tĩnh trên CDN Vercel, `/api/*` là một Vercel Function chạy app Express (`src/server/app.ts`; `server.ts` chỉ là trình khởi động local). Xem `docs/DEPLOYMENT.md`.
- Lưu trữ server (`src/server/persistence.ts`): trên Vercel mọi bản ghi nằm trong `cc_documents` (Supabase). Map trong bộ nhớ chỉ là cache của instance: mỗi request đọc phần thay đổi, thay đổi được ghi xong trước khi phản hồi. Xung đột: dự án bị từ chối (409); bản ghi khác được gộp theo trường cấp cao nhất; hai instance cùng tạo một bản ghi thì giữ bản đầu tiên. Chạy local dùng `data/*.json`.
- OTP và rate limit (`src/server/sharedState.ts`) dùng hàm SQL nguyên tử để các instance cùng thấy một trạng thái; thu hồi phiên đi qua `cc_documents`.
- Nội dung trả phí: danh sách công khai chỉ có đề cương (`src/server/contentAccess.ts`). Nội dung bài học qua `GET /api/courses/:id/content`, bản thiết kế qua `GET /api/products/:id/design` (`src/server/catalogDesigns.ts`, không có trong bundle client). Ảnh và video nằm trong bucket riêng tư, truy cập bằng liên kết ký có hạn.
- `GET /api/courses` trả toàn bộ giáo trình (slide, dự án thực hành) kể cả khóa trả phí, và 6 thiết kế mẫu trả phí nằm trong bundle client: nội dung trả phí chưa được bảo vệ thật sự.
- Trạng thái gói hiển thị phía client lưu trong localStorage từng trình duyệt; quyền thật do server kiểm tra. Việc hiển thị gói khi đăng nhập trên thiết bị khác chưa được kiểm thử.
- Mô phỏng không tích phân theo thời gian: tụ chỉ báo τ = R·C; dao động (NE555 astable, chương trình mẫu Arduino) được giải ở từng mức cao/thấp và báo tần số + độ rộng xung. Arduino chỉ chạy 4 chương trình mẫu (không biên dịch sketch). OLED (I2C) và HC-SR04 (TRIG/ECHO) chỉ được kiểm tra nguồn. Chi tiết: `docs/reports/COMPONENT_SIMULATION_AUDIT_2026-11-08.md`.
- Chưa có cổng thanh toán thật: ở chế độ real, đơn chỉ được xác nhận khi admin đánh dấu đã thanh toán.

## Mô phỏng & linh kiện (cập nhật 2026-11-08)

- **Pin system:** mỗi `PinDefinition` có `id` duy nhất trong linh kiện, `localOffset` (mm) là điểm nối mà cả lỗ breadboard, dây 3D và bộ giải cùng dùng; `designator` theo số chân datasheet. IC DIP dùng bước 2,54 mm, hai hàng cách 7,62 mm, chân 1 ở phía khuyết (−x), đếm ngược chiều kim đồng hồ.
- **Kết nối (`buildConnectivity`)**: union-find gom dây, lỗ breadboard (cột A–E / F–J, thanh nguồn liền hoặc ngắt giữa theo `railSplit`), chân cắm vào lỗ trong bán kính 3 mm và các chân nối liền bên trong linh kiện (GND của Arduino, nút nhấn 1A–1B/2A–2B, 2 chân COM của LED 7 đoạn). Bộ giải và DRC dùng chung hàm này.
- **Bộ giải:** phần tử nguyên thủy R, nguồn áp V, nguồn dòng I, nguồn dòng điều khiển bằng dòng F (dùng cho transistor, 7805, LM35); mỗi thiết bị là một `Device` có chế độ (`stamp` → giải → `update`) lặp tới khi không thiết bị nào đổi chế độ (tối đa 80 vòng, 400 ms mỗi pha). Nút "được lái" là nút nối tới nguồn áp qua trở kháng < 100 MΩ — dùng để phát hiện ngõ vào thả nổi.
- **Dao động:** mỗi bộ dao động (NE555 astable, Blink, PWM D9, xung servo) được giải thêm một lần ở mức thấp; linh kiện đổi trạng thái giữa hai lần giải nhận `pwm {frequencyHz, duty}`. Cảnh 3D nhấp nháy theo tần số đó nếu ≤ 20 Hz, trên mức này vẽ ở độ sáng trung bình.
- **Đồng bộ 3D:** `ComponentSimulationState.visual` (độ sáng LED, mức từng chip RGB, từng đoạn LED 7 đoạn, góc servo, vòng/phút động cơ, tiếp điểm rơ-le) là thứ duy nhất điều khiển hình ảnh mô phỏng; chữ ký hình ảnh được làm tròn để thay đổi rất nhỏ không dựng lại mesh. Hoạt ảnh nhấp nháy/quay chạy trong vòng lặp render, không dựng lại cảnh. Dây chỉ có hiệu ứng dòng điện khi một đầu dây nối với linh kiện đang có dòng.

## Cảnh 3D: thư viện tài nguyên, bộ model, bàn làm việc (VISUAL-1, 2026-11-14)

- **Thư viện tài nguyên `src/scene/assets/`** (hướng dẫn: `src/scene/assets/README.md`): `materials/` (bảng vật liệu PBR dùng chung), `primitives/` (khối dựng có cache theo khóa tham số, `bakeStatic` gộp mesh theo material), `builders/` (khuôn dựng: axial, LED tròn, vỏ trụ, DIP, TO-92 / TO-220, nút nhấn, rơ-le, LDR, màn hình, module, hộp pin, công tắc gạt, biến trở, cọc đấu dây), `pins/` (chuẩn chân + vùng chạm + lớp marker), `specs/` (mỗi linh kiện một file khai báo theo mm thật), `registry.ts` (spec → `definitionId`). Quy đổi mm → đơn vị scene ở một chỗ: `assets/units.ts`. Mọi geometry/material/texture của thư viện đi qua `assets/cache.ts` và được `markShared`, nên `disposal.ts` / `sceneReconciler.ts` không dispose chúng khi xóa một mesh; geometry gộp riêng của từng model thì được dispose cùng model.
- **Vị trí chân có một nguồn duy nhất:** `ComponentDefinition.pins[].localOffset` (domain). Spec không khai báo tọa độ chân; builder, vùng chạm, marker, dây và bộ giải cùng đọc từ definition. Test `test/visual_assets.test.ts` chặn mọi sai lệch > 0,01 so với definition và bộ legacy.
- **Registry bộ model `src/scene/models/`:** `modelSet: 'legacy' | 'v2'` (mặc định `v2`, xem `modelSet.ts`). `legacy/proceduralModels.ts` là model cũ giữ nguyên; `v2/buildComponent.ts` dựng từ spec. Registry có 23 spec cho 23/25 linh kiện thư viện; linh kiện GLB (Arduino, breadboard), hai định nghĩa deprecated và alias `terminal_block_2pin` dùng model legacy trong cả hai bộ. `modelSet` và mức chi tiết là cài đặt hiển thị, nằm trong chữ ký hình ảnh, không bao giờ ghi vào ProjectDocument. **Bộ legacy chỉ được gỡ khi chủ dự án xác nhận.**
- **Lớp trang trí `src/scene/workbench/`:** `buildWorkbench` dựng thảm ESD, mặt bàn và dụng cụ từ thư viện assets; `backdrop.ts` tạo phông gradient + sương. Lớp này chỉ tồn tại trong scene: không đọc/ghi ProjectDocument, không qua CommandHistory, không được đưa cho raycaster và mọi object đều bỏ qua raycast. Vùng trống giữa bàn tính từ kích thước board và vùng kéo thả, nên trang trí không lấn vào vùng làm việc.
- **Mức Chất lượng:** `qualityPreset` (low / balanced / high) quyết định số đoạn của primitive, số món trang trí, environment map, bóng và đèn bàn. Ngân sách tam giác ghi trong `assets/quality.ts` và được test.
- **Lưới:** không còn nút lưới và chấm vàng (bộ v2). Snapping vẫn dùng `board.gridSpacing` của ProjectDocument.
- **Marker chân:** khi bật Nối dây, `assets/pins/markers.ts` vẽ mọi chân bằng một InstancedMesh, màu theo trạng thái (trống / đã nối / hợp lệ / hover / chân bắt đầu); cường độ đèn của cảnh giảm còn 62 % để marker nổi bật.
- **Xuất model:** `npm run export:models` (`scripts/export-models.ts`) xuất mỗi model v2 ra `exports/models/*.glb`.
- **Trang thử dev:** `test/harness/scene.html` gắn `ThreeScene` thật với `CommandHistory` và bộ giải thật, không đăng nhập, không nằm trong bản build.

## Admin Console & analytics (2026-11-08)

- **Giao diện:** `src/pages/AdminDashboardPage.tsx` giữ 10 khu vực quản trị; điều hướng mới `src/components/admin/AdminSidebar.tsx` (4 nhóm Tổng quan / Kinh doanh / Nền tảng / Quản trị, thu gọn thành thanh icon có tooltip và lưu trạng thái trong localStorage, drawer trên điện thoại). Trang Tổng quan là `src/components/admin/AdminAnalyticsDashboard.tsx` (6 phần, bộ lọc kỳ và môi trường thanh toán dùng chung) với biểu đồ SVG tự viết trong `src/components/admin/charts.tsx` (không thêm thư viện).
- **Tính toán:** toàn bộ ở server, hàm thuần `computeAdminAnalytics(snapshot, query)` trong `src/server/adminAnalytics.ts`; route chỉ dựng snapshot từ các kho và trả JSON. Ngày theo `Asia/Ho_Chi_Minh` (UTC+7). Không có số tính ở React.
- **Ghi nhận hoạt động:** `src/server/activityStore.ts` (collection `activity_days`, HMAC userId, không có dữ liệu cá nhân) ghi khi có request đã đăng nhập và qua `POST /api/analytics/events`; client gửi `simulation_run`/`simulation_error` từ `src/services/usageEvents.ts`.
- **Sức khỏe hệ thống:** bộ đếm request/4xx/5xx/độ trễ là của instance đang trả lời (ghi rõ trên giao diện); không có kho metric chung.
- **Giới hạn:** gói thành viên không có hạn nên không có churn/MRR; lịch sử hoạt động trước ngày bật ghi nhận không khôi phục được. Chi tiết: `docs/ADMIN_ANALYTICS_DATA_AUDIT.md`, `docs/ADMIN_DASHBOARD_IMPLEMENTATION_REPORT.md`.

## Phân loại module không nằm trong import graph của client

Xác định bằng metafile esbuild từ `src/main.tsx` (2026-11-01). **Chưa xóa** — cần quyết định của chủ dự án.

| Nhóm | File | Phân loại |
|---|---|---|
| Kiến trúc engine cũ | `src/engine/commandEngine.ts`, `lessonEngine.ts`, `simulationEngine.ts`, `validationEngine.ts`, `src/types/circuit.ts`, `src/domain/schema.ts`, `src/domain/componentLibrary.ts`, `src/domain/fixtures.ts` | Legacy — được thay thế bởi `src/domain/*`; `test/task_2_1/2_2/2_3` vẫn import một phần (phục vụ test) |
| View cũ | `src/views/EditorView.tsx`, `HomeView.tsx`, `LessonsView.tsx`, `MarketplaceView.tsx`, `PricingView.tsx` | Legacy — thay bằng `src/pages/*` |
| Component cũ | `src/components/canvas3d/CircuitCanvas.tsx`, `layout/Navbar.tsx`, `minibot/MinibotWidget.tsx`, `CloudStatusModal.tsx`, `auth/AccountAuthModal.tsx`, `ui/designSystem.tsx` | Legacy / chuẩn bị tích hợp — bản đang dùng: `components/Navbar.tsx`, `components/MinibotWidget.tsx`, `components/AuthModal.tsx` |
| Service cũ | `src/services/aiAssistantService.ts`, `src/services/projectRepository.ts`, `src/router/NavigationContext.tsx` | Legacy — thay bằng `src/ai/assistantService.ts`, `src/persistence/*`, `src/router/routes.ts` |
| Chỉ type | `*/types.ts`, `src/vite-env.d.ts` | Đang dùng (bị xóa khi biên dịch) |
| Hàm không có caller | `courseService.purchaseCourse` (chỉ ghi localStorage) | Dead code — không ảnh hưởng quyền phía server |
- Responsive: `useDeviceProfile` (phone/tablet/desktop theo khả năng con trỏ và kích thước màn hình), `LandscapeGate` cho Workspace/Practice Lab/Theory (hướng dẫn xoay phủ lên trên, không unmount), biến thể Tailwind `short`/`coarse`/`compact`. Cử chỉ cảm ứng nằm trong `ThreeScene` (pinch, pan hai ngón, nhấn giữ, chạm gần chân, palm rejection).
