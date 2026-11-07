# CircuitCraft 3D — ROADMAP

Trạng thái hợp lệ: `[TODO]` `[IN_PROGRESS]` `[PASS]` `[FAIL]` `[BLOCKED]` (xem `AGENTS.md`). Nhật ký thực thi: `docs/PROGRESS.md`.

---

## Task ID: R0 — Baseline, backup, checkpoint
Status: [PASS]
Depends on: —
Acceptance: baseline `tsc`, build và test hiện có được ghi lại; dữ liệu `data/` được sao lưu; có điểm rollback Git.

## Task ID: R1 — Vá bảo mật Auth / OTP / Session / Ownership
Status: [PASS]
Depends on: R0
Acceptance: không lấy được session chỉ bằng email; JWT/Header/secret cũ bị từ chối; OTP không lộ qua API public, dùng 1 lần, khóa 5 lần sai, rate limit; mật khẩu scrypt + nâng cấp hash cũ; dự án, đơn hàng, entitlement, creator resources được kiểm tra quyền sở hữu; thiết kế trả phí không lộ qua API versions. Bằng chứng: `test/security_payment.integration.test.ts`.

## Task ID: R1-RLS — Áp dụng migration RLS lên Supabase
Status: [BLOCKED]
Depends on: R1
Acceptance: migration `supabase/migrations/20261101000000_security_hardening.sql` (và `20260914000002`) được áp dụng trên project Supabase; kiểm thử RLS trên project **test** (không phải production).
Blocker: cần quyền quản trị Supabase và một project test riêng; không được chạy test ghi dữ liệu trên production.

## Task ID: R1-SECRETS — Xử lý dữ liệu đã lộ trên GitHub
Status: [BLOCKED]
Depends on: R1
Acceptance: quyết định gỡ `data/*.json` khỏi git (`git rm --cached`) và/hoặc làm sạch lịch sử; đặt `SESSION_SECRET` thật; đổi mật khẩu các tài khoản có hash bị lộ; rotate key trong `.env` nếu nghi lộ.
Blocker: thao tác ảnh hưởng lịch sử Git / production / credential — cần chủ dự án quyết định.

## Task ID: R2 — Mock Payment an toàn
Status: [PASS]
Depends on: R1
Acceptance: mua Student/Creator/sản phẩm Marketplace bằng thanh toán mô phỏng cấp đúng quyền, idempotent, không xác nhận được đơn người khác, khóa hoàn toàn ở chế độ real, doanh thu mock tách khỏi doanh thu thật, UI gắn nhãn "Thanh toán mô phỏng".

## Task ID: R3 — AI context & Proposal validation
Status: [PASS]
Depends on: R1
Acceptance: hợp đồng `/api/ai/chat` thống nhất (gửi linh kiện, tham số, dây/chân, DRC, mô phỏng, lịch sử, ngôn ngữ, bài lab); proposal được validate ở server và client trước xem trước/áp dụng; ID fallback chuẩn hóa; áp dụng = 1 bước Undo.

## Task ID: R3-LIVE — Kiểm thử AI với Gemini thật
Status: [BLOCKED]
Depends on: R3
Acceptance: chạy các workflow AI với `GEMINI_API_KEY` thật trên môi trường test, đối chiếu chất lượng đề xuất.
Blocker: không dùng key/dữ liệu production trong môi trường kiểm thử cách ly.

## Task ID: R4 — Chuẩn hóa linh kiện & giải mạch DC
Status: [PASS]
Depends on: R0
Acceptance: alias ID cũ, dự án cũ vẫn mở/mô phỏng được; solver MNA cho kết quả khớp giá trị tham chiếu; linh kiện chưa hỗ trợ được đánh dấu; DRC và mô phỏng không mâu thuẫn. Bằng chứng: `test/domain_simulation_ai.test.ts`.

## Task ID: R5 — Backend: route trùng, giá, seed
Status: [PASS]
Depends on: R1
Acceptance: không còn route đăng ký trùng; bảng giá thống nhất (`src/billing/membershipPlans.ts`, cần chủ dự án xác nhận 99.000/249.000 ₫); seed khóa học idempotent, trạng thái kiểm duyệt tồn tại sau restart.

## Task ID: R6-3D — Giải phóng tài nguyên Three.js
Status: [BLOCKED]
Depends on: R0
Acceptance: dispose geometry/material/texture không dùng chung; không mất mesh/texture; đo RAM/GPU/FPS trước-sau.
Ghi chú: code đã sửa và kiểm tra chức năng trên trình duyệt (thêm/undo/redo/mô phỏng không lỗi). Blocker: chưa có môi trường profiling GPU để đo số liệu bộ nhớ/FPS — không được tự tạo số liệu.

## Task ID: R6-TS — TypeScript & build
Status: [PASS]
Depends on: R0
Acceptance: `npm run lint` kiểm tra client + server + test ở strict mode; `npm run build` thành công.

## Task ID: R7 — Đồng bộ tài liệu
Status: [PASS]
Depends on: R1–R6
Acceptance: `SYSTEM_ARCHITECTURE_DETAILED.md`, `docs/ARCHITECTURE.md`, `docs/CONTRACTS.md`, `docs/TEST-PLAN.md` phản ánh code thực tế, ghi rõ Mock Payment.

## Task ID: R8 — Hồi quy cuối
Status: [PASS]
Depends on: R1–R7
Acceptance: lint, build, toàn bộ `npm test` PASS; kiểm thử UI các luồng chính trên bản cách ly; dữ liệu thật không thay đổi.

## Task ID: H1 — Proxy, rate limit, chatbot
Status: [PASS]
Depends on: R1
Acceptance: `trust proxy` theo số hop/danh sách, không bật `true`; giới hạn theo danh tính server xác thực; OTP giới hạn theo đích; không giả được IP/userId. Bằng chứng: `test/deploy_hardening.integration.test.ts` (mô phỏng proxy).
Ghi chú: số hop trên Render thật chưa kiểm chứng; xem `docs/DEPLOYMENT.md`.

## Task ID: H2 — Ghi dữ liệu an toàn
Status: [PASS]
Depends on: R1
Acceptance: không ghi file người dùng trên mỗi request; ghi nguyên tử; tắt đột ngột không hỏng file; file hỏng được giữ bản sao.

## Task ID: H3 — Khóa học PPTX & giới hạn body
Status: [PASS]
Depends on: R5
Acceptance: giới hạn theo route và quyền; ảnh slide lưu file; Trợ giảng chỉ nhận chữ; 413 dạng JSON; khóa học PPTX có ảnh tạo và mở được trên giao diện.

## Task ID: H4 — Preview Marketplace, phiên theo thiết bị, lỗi JSON
Status: [PASS]
Depends on: R1
Acceptance: 6/6 sản phẩm mẫu có preview từ thiết kế thật; đăng xuất chỉ ảnh hưởng thiết bị hiện tại; JSON sai trả 400 JSON.

## Task ID: H5 — Tối ưu Workspace 3D
Status: [BLOCKED]
Depends on: R6-3D
Acceptance: không dựng lại mesh khi chọn linh kiện; chỉ dựng lại linh kiện đổi hình ảnh; so sánh FPS/RAM trước-sau.
Ghi chú: phần chức năng và số lần dựng đã kiểm chứng. Blocker: chưa đo được FPS/RAM/GPU (pane trình duyệt bị ẩn); không tự tạo số liệu.

## Task ID: H6 — Giảm bundle trang đầu
Status: [PASS]
Depends on: R6-TS
Acceptance: Admin, Creator, Workspace, Three.js và JSZip tải theo nhu cầu; trang đầu không tải Three.js; deep link hoạt động.

---

## Task ID: D1 — Triển khai Vercel + Supabase
Status: [BLOCKED]
Depends on: R1-SECRETS
Mô tả: chuyển lưu trữ sang Supabase, OTP/rate limit/phiên dùng chung, Express trên Vercel Function, media trên Storage, bảo vệ nội dung trả phí, giữ Mock Payment.
Acceptance: deploy thành công trên Vercel với URL hoạt động; các mục kiểm tra trong `docs/DEPLOYMENT.md` (bước 10, 12, 13) đạt trên Preview và Production.
Hiện trạng: toàn bộ code, migration, script di trú, tài liệu và test mô phỏng đã xong và đạt (xem `docs/PROGRESS.md`). Blocker: chưa có quyền Vercel/Supabase để chạy migration, chép dữ liệu, deploy và kiểm thử online; `vercel build` chưa chạy được trên máy này.
