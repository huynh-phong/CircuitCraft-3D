# CircuitCraft 3D — Kế hoạch kiểm thử

## Lệnh

| Lệnh | Phạm vi | Ghi chú |
|---|---|---|
| `npm run lint` | TypeScript strict cho client (`tsconfig.json`) **và** server + test (`tsconfig.server.json`) | |
| `npm run build` | Vite client + esbuild `dist/server.cjs` | |
| `npm test` | Toàn bộ test **không** đụng dữ liệu thật | Xem danh sách dưới |
| `npm run test:supabase-live` | `test/user_data_isolation.test.ts` | ⚠️ Đăng nhập tài khoản test và ghi/xóa dữ liệu trên **Supabase thật** trong `.env`. Chỉ chạy trên project Supabase dành cho test. |

## Bộ test

| File | Nội dung | Dữ liệu |
|---|---|---|
| `test/verify.ts` | Hình học bo mạch, router dây, lệnh bo mạch, dự án mẫu | Thuần domain |
| `test/task_2_1.test.ts`, `task_2_2.test.ts`, `task_2_3.test.ts` | Schema & command engine (gồm module legacy) | Thuần domain |
| `test/task_3_1.test.ts` | node:test domain | Thuần domain |
| `test/e2e_isolation.test.ts` | Cách ly dữ liệu localStorage theo user (mock storage) | Bộ nhớ |
| `test/domain_simulation_ai.test.ts` | Giải mạch DC có giá trị tham chiếu (nối tiếp, song song, chia áp, chia dòng, biến trở, mạch hở, ngắn mạch, LED + R, LED quá dòng, LED ngược, tụ DC, 2 nguồn song song, linh kiện chưa hỗ trợ, Arduino), ID cũ, DRC↔mô phỏng, validate đề xuất AI, Undo/Redo nguyên tử, hợp đồng request AI | Thuần domain |
| `test/components_simulation.test.ts` | Kiểm định thư viện linh kiện (2026-11-08): cấu trúc mọi định nghĩa (ID, chân, kiểu chân, giá trị mặc định, mức hỗ trợ), sơ đồ chân theo datasheet, IC DIP cắm đúng lỗ breadboard, nhóm nối thông breadboard (cột, rãnh giữa, thanh nguồn liền/ngắt, chân `strip_N` cũ), mạch tham chiếu cho từng linh kiện được mô phỏng (R, phân áp, LED theo màu, diode, tụ + τ, biến trở 0–100 %, công tắc, nút 4 chân, nguồn, còi, LDR, rơ-le NO/NC, transistor 3 chế độ, 7805 ổn áp/sụt áp/quá áp, LM35, 74HC08 bảng chân lý + thả nổi, NE555 astable/monostable, RGB, 7 đoạn, động cơ, servo, OLED), 4 chương trình mẫu Arduino, DRC↔bộ giải, dự án mẫu/sản phẩm/bài học, Undo/Redo tham số, tham số hỏng, thời gian giải mạch lớn | Thuần domain |
| `test/security_payment.integration.test.ts` | Chạy **server thật** trong thư mục tạm cách ly (không `.env`, không Supabase/Gemini/email): giả mạo session/JWT/header, OTP (lộ mã, 1 lần, khóa 5 lần, log), hash scrypt + nâng cấp hash cũ, cách ly dự án, vai trò, mock payment (Student, Creator, Marketplace, idempotent, chặn đơn người khác), creator ownership, chống lộ thiết kế trả phí, thu hồi phiên, kiểm duyệt khóa học bền vững sau restart, chế độ real chặn mock | Thư mục tạm, tự xóa |
| `test/scene_incremental.test.ts` | Dựng lại từng phần với mesh builder thật (three.js trong Node, không GPU): chọn linh kiện, mô phỏng, công tắc, di chuyển, xóa/undo, dây; thời gian dựng cảnh 20/100/400 linh kiện | Thuần domain |
| `test/deploy_hardening.integration.test.ts` | Server thật, thư mục tạm: proxy và giả mạo IP/userId, giới hạn theo email, ghi đồng thời, tắt đột ngột, file hỏng, phiên theo thiết bị, giới hạn body, ảnh PPTX, 6 preview Marketplace, giá, bản sao dữ liệu hiện có | Thư mục tạm, tự xóa |

## Kiểm thử giao diện thủ công (bản cách ly)

Tạo bản sao app trong thư mục tạm (không `.env`), chạy `NODE_ENV=development ENABLE_DEV_OTP_PREVIEW=true PAYMENT_MODE=mock`, rồi kiểm tra: Landing → Đăng ký OTP → Membership mua gói (nhãn "Thanh toán mô phỏng") → Dự án → Editor 3D → Minibot đề xuất → Áp dụng → Mô phỏng → Undo/Redo → Khóa học → Phòng học lý thuyết → Creator (chặn khi chưa có gói) → Admin (403 với user thường).

## Chưa có / cần bổ sung

- Đo FPS / RAM / GPU memory của Workspace 3D (cần trình duyệt hiển thị thật và công cụ profiling; pane trình duyệt nhúng tạm dừng `requestAnimationFrame` khi ẩn).
- Test RLS trên một project Supabase test riêng sau khi áp dụng migration `20261101000000_security_hardening.sql`.
- E2E tự động trên trình duyệt (Playwright) cho các workflow A–H.

## Serverless và Vercel
- `test/serverless_persistence.integration.test.ts`: nhiều instance server thật, chỉ dùng chung database. Database là PGlite (Postgres thật) chạy migration thật; Storage/Auth là bản giả lập trong `test/helpers/fakeSupabase.ts`. Bao gồm OTP, phiên, rate limit, đồng thời, nội dung trả phí, mock, lỗi database, script di trú.
- `test/vercel_output.test.ts`: build `.vercel/output`, áp dụng routes đã sinh, nạp function bundle trong thư mục trống.
- Hai test này **không phải kiểm thử online**. Kiểm thử trên Vercel và Supabase thật theo mục 5 của `docs/DEPLOYMENT.md`.

