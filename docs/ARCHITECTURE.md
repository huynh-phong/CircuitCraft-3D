# CircuitCraft 3D — Kiến trúc (theo code thực tế)

Tài liệu chi tiết lịch sử: `SYSTEM_ARCHITECTURE_DETAILED.md` (file nội bộ, không đẩy lên GitHub). Tài liệu này tóm tắt kiến trúc **đã chốt** và các module đang chạy.

## Thành phần đang chạy

| Lớp | Module chính |
|---|---|
| Entry client | `src/main.tsx` → `src/App.tsx` (định tuyến, trạng thái editor) |
| Định tuyến | `src/router/routes.ts` (History API, alias URL) |
| Dữ liệu thiết kế | `src/domain/project/*` (ProjectDocument là nguồn sự thật) |
| Lệnh / Undo-Redo | `src/domain/commands/commands.ts`, `history.ts` (`CommandHistory`, tối đa **50** bước) |
| Linh kiện | `src/domain/components/definitions.ts` + `aliases.ts` (chuẩn hóa ID cũ) |
| Mô phỏng | `src/domain/simulation/engine.ts` — giải mạch DC xác lập bằng **Modified Nodal Analysis** |
| DRC | `src/domain/validation/engine.ts` (8 luật; dùng chung quy tắc breadboard & ID chuẩn với mô phỏng) |
| AI | `src/ai/assistantService.ts`, `circuitContext.ts`, `src/domain/ai/proposalValidation.ts` |
| 3D | `src/scene/ThreeScene.tsx`, `proceduralModels.ts`, `modelLoader.ts`, `materials.ts`, `wires.ts`, `disposal.ts`, `sceneReconciler.ts` (chỉ dựng lại object có chữ ký hình ảnh thay đổi) |
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
- Mô phỏng chỉ DC xác lập: không có quá độ (nạp/xả tụ), không chạy chương trình Arduino (chỉ mô phỏng các chân nguồn và giả định D13 = HIGH), chưa có mô hình cho NE555, transistor, IC logic, cảm biến số, servo, OLED, 7805, motor…
- Chưa có cổng thanh toán thật: ở chế độ real, đơn chỉ được xác nhận khi admin đánh dấu đã thanh toán.

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
