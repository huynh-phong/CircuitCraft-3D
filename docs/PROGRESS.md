# CircuitCraft 3D — Nhật ký thực thi (PROGRESS)

## 2026-11-05 — Đợt HARDENING-2026-11 (H1–H6)

Commit/checkpoint: **chưa commit**. Điểm khôi phục: `.backups/src-20261105-*/` (`worktree.tar` không chứa `.env`, và bản sao `data/`), cùng tag `pre-repair-checkpoint-20261101-171612`.

### Đã sửa
| Nhóm | File | Lỗi → cách sửa |
|---|---|---|
| Proxy, rate limit | `src/server/security.ts`, `server.ts` | Không có `trust proxy` nên sau proxy mọi người dùng chung một bộ đếm → `TRUST_PROXY` theo số hop/danh sách (`true` bị từ chối; mặc định 1 trên Render/Vercel), giới hạn theo tài khoản đã xác thực hoặc IP, thêm giới hạn theo email/SĐT đích và số lần sai mật khẩu, `GET /api/admin/request-info` để đối chiếu. |
| Chatbot | `server.ts` | Giới hạn theo `userId`/`guestSessionId` do client gửi → theo danh tính server. |
| Ghi file | `src/server/atomicJson.ts` (mới), `userStore.ts`, `creatorStore.ts`, `server.ts` | Ghi cả file người dùng mỗi request, ghi không nguyên tử, file hỏng bị ghi đè khi lưu tiếp → `lastActiveAt` tối đa 5 phút/lần, chỉ ghi khi đổi, ghi nguyên tử, giữ bản sao file hỏng. |
| Lưu trữ tài khoản giả | `userStore.ts` | `admin@circuitcraft3d.com` bị xóa hẳn khi khởi động → vẫn không nạp nhưng được lưu vào `data/removed_users_archive.json`. |
| Body & PPTX | `server.ts`, `src/server/courseMedia.ts` (mới), `CreateCourseModal.tsx`, `pptxAndPracticeParser.ts`, `TheoryLearningPage.tsx` | Khóa học PPTX có ảnh và Trợ giảng bị 413 → giới hạn theo route và quyền, ảnh lưu thành file theo hash, Trợ giảng chỉ nhận chữ, ảnh slide tối đa 1,5 MB (trước đây ảnh > 450 KB bị bỏ). |
| Lỗi API | `server.ts` | JSON sai / quá dung lượng trả HTML → JSON thống nhất, không stack trace. |
| Preview & giá | `server.ts` | 5/6 sản phẩm mẫu 404, `prod-terminal-splitter` hiện mạch giả dựng cứng → dựng từ thiết kế thật trong catalog dùng chung; chưa mua thì ẩn thông số. Giá checkout theo giá hiển thị. |
| Phiên | `security.ts`, `server.ts`, `authService.ts` | Đăng xuất một máy làm mất phiên mọi máy → `sid` theo thiết bị, thu hồi lưu file, thêm `POST /api/auth/logout-all`; Supabase `signOut` scope `local`. |
| 3D | `src/scene/sceneReconciler.ts` (mới), `ThreeScene.tsx`, `proceduralModels.ts`, `wires.ts` | Dựng lại toàn bộ mesh khi chọn linh kiện/đổi mô phỏng; vòng render dùng `document`, `simulationResult`, `isExplodedView` cũ từ lúc tạo scene nên xung điện và Exploded View không cập nhật; fallback GLB không dispose → cập nhật từng phần theo chữ ký hình ảnh, render loop đọc props mới nhất. |
| Bundle | `src/App.tsx`, `PageTransition.tsx`, `Product3DViewerModal.tsx`, `vite.config.ts` | Một file 2,35 MB → lazy load trang, editor, modal đăng nhập, Three.js, JSZip. |
| Điều hướng | `src/App.tsx`, `authService.ts` | F5 ở `/projects` về trang chủ; F5 trong editor mất dự án và URL ghi sai `id=sample-auto-nightlight`; closure cũ bật modal đăng nhập → chờ khôi phục phiên, id tường minh được ưu tiên. |
| Dev | `vite.config.ts` | Server ghi `data/` làm Vite tải lại trang liên tục → bỏ theo dõi `data/`. |

### Thay đổi giá cần chủ dự án xác nhận
Checkout nay thu đúng giá hiển thị trên Marketplace: `prod-555-pwm-controller` 99.000 → 79.000 ₫, `prod-arduino-radar-node` 189.000 → 129.000 ₫, `prod-regulated-5v-psu` 79.000 → 0 ₫. Đơn cũ giữ nguyên số tiền.

### Kiểm tra thực tế
| Lệnh / hạng mục | Kết quả |
|---|---|
| `npm run lint` (client + server + test) | PASS |
| `npm run build` | PASS |
| `npm test` (10 script) | PASS: `domain_simulation_ai` 30/30, `scene_incremental` 15/15, `security_payment` 56/56, `deploy_hardening` 41/41, các script cũ PASS |
| `npm run test:supabase-live` | NOT RUN (ghi vào Supabase production) |
| UI trên bản dev cách ly | PASS: F5 `/projects` và editor; preview sản phẩm mẫu; template 10 linh kiện/18 dây: chọn linh kiện dựng lại 0 mesh, bật mô phỏng dựng lại 1 mesh; Creator tạo khóa học từ PPTX thật 12 slide có ảnh và notes (12 lần tải ảnh, localStorage 77 KB); mua khóa học bằng mock; ảnh hiển thị; Trợ giảng trả lời |
| Bundle production (trình duyệt) | PASS: trang đầu tải 1.005 KB JS, ~291 KB gzip (trước 2.348 / 609 KB), không tải Three.js; không lỗi console |
| Thời gian dựng cảnh (JS, không GPU) | 400 linh kiện: dựng lại toàn bộ 176 ms; chọn linh kiện 0,7 ms |
| FPS / RAM / GPU trước-sau | NOT RUN (pane trình duyệt ẩn, `requestAnimationFrame` không chạy) |
| Render/Vercel thật, Gemini thật, Supabase thật | NOT RUN |
| Toàn vẹn dữ liệu thật | PASS: SHA-256 4 file `data/*.json` không đổi so với đầu đợt; test trên bản sao không mất bản ghi nào (trừ tài khoản giả đã lưu trữ) |

### Lỗi / rủi ro còn mở
- `GET /api/courses` trả toàn bộ nội dung khóa trả phí; 6 thiết kế mẫu trả phí nằm trong bundle client.
- Server Express không nén gzip; cần nền tảng hoặc CDN nén.
- `logout-all` chưa có nút trên giao diện.
- Vercel chưa chạy được (nhiệm vụ D1). Render cần Persistent Disk và đúng 1 instance.


## 2026-11-01 — Đợt REPAIR-2026-11 (R0–R8)

Commit/checkpoint: **chưa commit** (thay đổi đang nằm trong working tree). Điểm rollback: tag `pre-repair-checkpoint-20261101-171612` (= HEAD `b9662c9`) và bản sao dữ liệu `.backups/data-20261101-171612/` (đã thêm vào `.gitignore`).

### Baseline (R0)
| Lệnh | Kết quả |
|---|---|
| `npx tsc --noEmit` (client) | PASS |
| `npm run build` | PASS (cảnh báo chunk > 500 kB, có từ trước) |
| 7 script `test/*` | PASS (lưu ý: `user_data_isolation.test.ts` ghi/xóa dữ liệu trên Supabase thật — đã tách thành `npm run test:supabase-live`, không chạy lại) |
| `tsc -p tsconfig.server.json` (server + test, mới tạo) | 4 lỗi (env Vite, 2 lỗi kiểu trong test) |

### Thay đổi chính

| Nhóm | File | Lỗi ban đầu → cách sửa |
|---|---|---|
| Session | `src/server/security.ts` (mới), `server.ts` | `/api/auth/session` cấp token chỉ từ email; JWT 3 phần không kiểm chữ ký; tin `X-User-*`; secret hardcode; token không hết hạn → chỉ tin Bearer token đã xác minh (HMAC timing-safe hoặc Supabase `auth.getUser`), token có `exp` 7 ngày + `sessionVersion` để thu hồi, secret từ `SESSION_SECRET` (dev: tự sinh và lưu `data/.session_secret`), thêm `/api/auth/logout`. |
| OTP | `src/server/otpService.ts`, `server.ts` | `previewHtml` chứa mã OTP trả về client; `email-preview`/`sms-preview` công khai; `Math.random`; mã lưu dạng rõ; SMS trả mã khi không có Twilio; log mã OTP → chỉ trả preview ở chế độ dev cách ly, CSPRNG, lưu hash + so sánh timing-safe, không log mã, rate limit theo IP; khôi phục mật khẩu qua SMS fallback chỉ khi số điện thoại thuộc đúng tài khoản. |
| Mật khẩu | `src/server/userStore.ts` | SHA-256 không salt → scrypt có salt; hash cũ vẫn đăng nhập được và tự nâng cấp; đặt lại mật khẩu thu hồi phiên; `registerNewUser` không còn ghi đè tài khoản đã có; Supabase mirror không còn gán dự án cho UUID mặc định của admin. |
| Ownership | `server.ts`, `src/server/creatorStore.ts` | Đọc/xóa/ghi đè dự án người khác, đổi vai trò người khác, tin `creatorId` từ body, khối kiểm tra quyền rỗng trong `updateProduct`, fallback trả dữ liệu của mọi creator, lộ `projectSnapshot` sản phẩm trả phí → kiểm tra quyền ở server cho mọi CRUD, store từ chối sửa tài nguyên không sở hữu, versions chỉ trả bản đầy đủ cho chủ/admin/người mua. |
| Route trùng | `server.ts` | 8 route đăng ký trùng; các handler cũ (yêu cầu `creatorId`) che mất handler mà UI dùng ⇒ **đăng bán sản phẩm, đổi trạng thái, tạo phiên bản luôn trả 403** → hợp nhất 1 handler/route chấp nhận cả 2 dạng payload. Thêm `/api/courses/progress` (client gọi nhưng route chưa tồn tại). Còn 83 route, không trùng. |
| Mock Payment | `src/server/paymentMode.ts` (mới), `server.ts`, `src/components/PaymentModal.tsx`, `src/pages/CreatorDashboardPage.tsx`, `src/pages/AdminDashboardPage.tsx` | `mock-verify` công khai, xác nhận được đơn của bất kỳ ai → giữ Mock Payment nhưng: chỉ chủ đơn, idempotent, chỉ khi server `PAYMENT_MODE=mock`, đơn gắn `isMock/paymentMode`, doanh thu mô phỏng tách riêng, UI có nhãn "Thanh toán mô phỏng". |
| Giá | `src/billing/membershipPlans.ts` (mới), `server.ts`, `src/pages/MembershipPage.tsx` | 99k/249k (checkout + trang Membership) vs 49k/120k (bảng Admin) → một nguồn cấu hình 99.000/249.000 ₫ (**cần chủ dự án xác nhận**). Đơn cũ giữ nguyên số tiền. |
| Seed | `src/server/creatorStore.ts` | Khóa học mẫu bị ghi đè mỗi lần khởi động (mất trạng thái kiểm duyệt/thống kê) → chỉ seed khi chưa tồn tại. Hệ quả: chỉnh sửa nội dung khóa mẫu trong code sẽ không tự áp vào store đã có. |
| AI | `src/ai/circuitContext.ts` (mới), `src/ai/assistantService.ts`, `server.ts` | Client gửi `{project, issues…}` còn server đọc `{context, history}` ⇒ AI không thấy mạch → hợp đồng chuẩn hóa (vẫn nhận payload cũ). Yêu cầu thiết kế gọi `/api/ai/propose`; đề xuất mẫu khi không có AI được gắn nhãn rõ và dùng ID chuẩn (`dc-source`, `pin1/pin2`). Rate limit các endpoint AI; bỏ lộ tiền tố API key ở `/api/ai/status`. |
| Proposal | `src/domain/ai/proposalValidation.ts` (mới), `src/App.tsx` | Đề xuất được áp dụng không kiểm tra → validate ID linh kiện/chân/tham chiếu/trùng/giới hạn ở server và client (trước xem trước và trước áp dụng), áp dụng = 1 Undo, lệnh lỗi giữ nguyên mạch. |
| Linh kiện | `src/domain/components/aliases.ts` (mới), `src/domain/validation/engine.ts` | 3 bộ ID không thống nhất → bản đồ alias; DRC và mô phỏng dùng bản chuẩn hóa dẫn xuất (không ghi đè dữ liệu), DRC tính cả chân cắm vào breadboard như bộ mô phỏng. |
| Mô phỏng | `src/domain/simulation/engine.ts`, `types.ts` | BFS dò đường, dòng hardcode `~15 mA`, tụ dẫn DC, nhãn giả ("ARDUINO CHẠY CHƯƠNG TRÌNH", "NE555 DAO ĐỘNG"), terminal block bị coi là dây nối → giải MNA DC, mô hình LED/diode/rơ-le lặp, tụ hở mạch, linh kiện chưa hỗ trợ được đánh dấu. |
| 3D | `src/scene/disposal.ts` (mới), `ThreeScene.tsx`, `materials.ts`, `modelLoader.ts` | Mesh bị gỡ khỏi scene nhưng không dispose (đặc biệt dây xem trước tạo lại mỗi lần di chuột) → dispose tài nguyên không dùng chung; vật liệu registry và tài nguyên GLB cache được đánh dấu dùng chung, không bị dispose. |
| Auth client | `src/persistence/apiAuthFetch.ts` (mới), `src/main.tsx`, `src/persistence/authService.ts` | Client gửi `email/isVerified` để lấy session → gắn Bearer tự động cho `/api/*`, đồng bộ phiên bằng token thật, phiên bị từ chối thì đăng xuất cục bộ, logout thu hồi phiên server. |
| RLS | `supabase/migrations/20261101000000_security_hardening.sql` (mới) | Tự đổi `role`, đọc email mọi người, tự tạo đơn `paid`, tự nâng gói → policy/trigger mới, không xóa dữ liệu, có SQL rollback. **Chưa áp dụng lên Supabase.** |
| TS/Build | `tsconfig.server.json` (mới), `package.json`, `test/e2e_isolation.test.ts`, `test/task_2_2.test.ts` | Server & test không được typecheck → `npm run lint` kiểm cả hai; `npm test`; sửa 2 lỗi kiểu trong test. |
| Cấu hình | `.env.example`, `.gitignore` | Thêm `SESSION_SECRET`, `PAYMENT_MODE`, `ENABLE_MOCK_PAYMENT`, `ENABLE_DEV_OTP_PREVIEW`; ignore dữ liệu runtime mới, `.session_secret`, `.backups/`. |
| Tài liệu | `ROADMAP.md`, `docs/*.md`, `SYSTEM_ARCHITECTURE_DETAILED.md` | Tạo ROADMAP/docs theo AGENTS.md; đính chính mô tả sai (Command Engine, giới hạn Undo, model Gemini, hash, mô phỏng, AI Admin, RLS, Mock Payment). |

### Kiểm tra cuối (R8)
| Lệnh | Kết quả |
|---|---|
| `npm run lint` (client + server + test, strict) | PASS |
| `npm run build` | PASS (client 2.35 MB chưa chia chunk — cảnh báo có từ trước) |
| Smoke `node dist/server.cjs` (production, thư mục tạm) | PASS: health OK, payment mode `real`, session chỉ-email → 401, X-User-Email → 401, email-preview → 404 |
| `npm test` (9 script) | PASS: verify 18/18, task 2.1/2.2/2.3, task 3.1 4/4, e2e isolation, `domain_simulation_ai` **30/30**, `security_payment.integration` **56/56** |
| `npm run test:supabase-live` | NOT RUN (ghi vào Supabase production) |
| UI (trình duyệt, bản sao cách ly) | PASS: đăng ký OTP, F5 giữ phiên, mua gói Student mô phỏng (có nhãn), tạo dự án, Minibot đề xuất mẫu → xem trước → áp dụng (3 linh kiện/3 dây) → mô phỏng 13,0 mA → Undo/Redo, tự lưu đúng chủ, ghi danh khóa học, phòng học lý thuyết, Creator bị chặn khi chưa có gói, Admin 403 với user thường. Không có lỗi console ngoài ảnh QR `api.vietqr.io` bị chặn CORS (có từ trước). |
| UI: Admin dashboard, Creator Studio đăng bán, Marketplace mua, Practice Lab checklist, upload PPTX | NOT RUN trên trình duyệt (luồng API tương ứng đã PASS trong test tích hợp) |
| Đo FPS / RAM / GPU | NOT RUN |
| Toàn vẹn dữ liệu thật | PASS: SHA-256 của `data/creator_store.json`, `orders_store.json`, `registered_users.json`, `system_logs.json` không đổi; không có file mới trong `data/` |

### Thay đổi hành vi cần biết
- Phiên đăng nhập cũ (ký bằng secret hardcode) **không còn hợp lệ**: người dùng phải đăng nhập lại một lần.
- Production (`NODE_ENV=production`) mặc định `PAYMENT_MODE=real` ⇒ Mock Payment **bị khóa** trên server deploy cho tới khi đặt `PAYMENT_MODE=mock` (chỉ nên làm với dữ liệu demo cách ly).
- Production chưa đặt `SESSION_SECRET` ⇒ mọi phiên mất khi restart.
- Kết quả mô phỏng thay đổi theo vật lý thật: "Mạch đèn tự động LDR" (10 kΩ nối tiếp LED trắng ⇒ < 0,2 mA) không còn báo LED sáng; mạch có NE555/transistor/servo báo "Chưa hỗ trợ mô phỏng điện" thay vì kết quả giả; chiết áp 50% ⇒ LED "sáng mờ".
- Mua hàng/khóa học/vai trò yêu cầu đăng nhập ở server (UI đã yêu cầu đăng nhập trước khi mua).

### Lỗi / rủi ro còn mở
- R1-RLS, R1-SECRETS, R3-LIVE, R6-3D (đo lường): BLOCKED — xem ROADMAP.
- Lưu trữ JSON + bộ nhớ (OTP, rate limit, cache) không phù hợp nhiều instance/serverless.
- Đơn cũ không có `paymentMode` được coi là mock (chưa từng có tích hợp ngân hàng).
- Các file `AISC26-0048-DarkLand_*.pdf/.pptx`, `KICH_BAN_THUYET_TRINH_12_15_PHUT.md`, `extracted_slide_text.txt` (chưa track trong git) **không còn trong thư mục dự án ngay từ đầu đợt sửa** (lệnh `git status` đầu tiên của đợt R0 đã không thấy chúng); đợt sửa này không chạy lệnh nào trên các file đó. Cần chủ dự án kiểm tra Thùng rác/nơi đã di chuyển.

### Bước nhỏ tiếp theo
1. Chủ dự án xác nhận giá 99.000/249.000 ₫.
2. Đặt `SESSION_SECRET` (và `PAYMENT_MODE` mong muốn) trên môi trường deploy.
3. Áp dụng migration RLS trên một project Supabase test rồi production.
4. Quyết định xử lý `data/*.json` đang được track trong git.

## D1 — Vercel + Supabase (2026-11-05 → 2026-11-06)
Status: [BLOCKED] — phần trong repository đã xong và đã kiểm thử bằng môi trường mô phỏng. Chưa deploy, chưa chạy gì trên Supabase/Vercel thật (thiếu quyền truy cập).

### Đã làm
- `src/server/app.ts` (Express) tách khỏi `server.ts` (chỉ chạy local). `src/server/vercelHandler.ts`, `scripts/build-vercel.mjs`, `vercel.json` tạo Build Output v3: CDN cho client, một Function cho `/api/*`.
- `src/server/persistence.ts`: dữ liệu trong `cc_documents`, đọc thay đổi trước mỗi request, ghi xong trước khi phản hồi. Xung đột: dự án → 409 `PROJECT_CONFLICT`; bản ghi khác gộp theo trường; hai instance cùng tạo → giữ bản đầu.
- `src/server/sharedState.ts` + migration `20261105000000`: OTP (mục đích, hết hạn, số lần sai, dùng một lần), rate limit dùng chung; thu hồi phiên dùng chung.
- Media trên Storage riêng tư (ảnh, video tải thẳng lên Storage), liên kết ký có hạn.
- Nội dung trả phí: `/api/courses` chỉ đề cương; `/api/courses/:id/content`, `/api/products/:id/design` kiểm tra quyền; thiết kế mẫu chuyển khỏi bundle client.
- Mock Payment: giữ nguyên các luồng mua thử. Đơn mock chỉ hiện tài khoản giả và không có QR; ở chế độ thật, quyền có từ mô phỏng không được tính. Đơn hàng không bị tạo trùng.
- Client: dự án của người đăng nhập đọc từ server (thiết bị khác, sau khi xóa bộ nhớ trình duyệt); xung đột phiên bản hiện hộp thoại sẵn có; bỏ đơn hàng giả dùng số tài khoản cố định.
- `scripts/migrate-to-supabase.ts`: chạy thử / áp dụng có backup / đối chiếu / chạy lại an toàn.

### Lỗi tìm thấy và đã sửa trong đợt tiếp tục (2026-11-06)
- Store nhận chính đối tượng làm "bản gốc" khi gộp xung đột, nên thay đổi đồng thời có thể bị mất. Đã sửa bằng cách luôn tách bản sao; test `[10]` chứng minh.
- Người đăng nhập bằng OTP không thấy dự án trên thiết bị khác. Đã sửa: `src/persistence/serverProjects.ts`.
- Lưu dự án từ bản cũ hoặc ghi đồng thời từng âm thầm ghi đè. Giờ trả 409.
- Bấm mua hai lần tạo hai đơn. Giờ dùng lại đơn đang chờ; sản phẩm đã sở hữu thì không bán lại.

### Kiểm tra thực tế (2026-11-06, trên code hiện tại)
| Lệnh | Kết quả |
|---|---|
| `npm run lint` (tsc client + server + test + scripts) | PASS |
| `npm run build` | PASS |
| `npm test` (12 script) | PASS: verify 18/18, task 2.1/2.2/2.3/3.1, e2e isolation, domain_simulation_ai 30/30, scene_incremental 15/15, security_payment 56/56, deploy_hardening 41/41, **serverless_persistence 48/48**, **vercel_output 29/29** (thời gian 1m33s) |
| Dry-run `scripts/migrate-to-supabase.ts` trên `data/` | PASS: users 8, removed_users 1, logs 10, orders 2, creator_profiles 3, creator_products 1; không ghi gì |
| E2E trình duyệt trên bản build + Supabase giả lập | PASS: deep link + F5 editor, xem trước 3D giới hạn, đăng ký OTP, mua mock sản phẩm (mở thiết kế 4 linh kiện/4 dây), Creator tải PPTX (2 slide + ảnh) → học viên mua mock → phòng lý thuyết hiện ảnh ký → Trợ giảng trả lời; đơn mock không có QR |
| `npx vercel@65.11.0 build` | BLOCKED: Windows chặn tạo symlink (cần Developer Mode/quyền admin), cả trong lẫn ngoài sandbox |
| Online trên Vercel/Supabase thật | NOT RUN |
| Upload video thật lên Supabase Storage; Admin UI trên trình duyệt; đo FPS/cold start | NOT RUN |
| Toàn vẹn dữ liệu thật | PASS: SHA-256 4 file `data/*.json` không đổi |

Ghi chú: các test "nhiều instance" chạy nhiều tiến trình server thật trên Postgres thật (PGlite) với migration thật; Storage/Auth là bản giả lập. Đây **không phải** kiểm thử online.

### Còn mở / cần chủ dự án
- Commit + push; tạo project Vercel; đặt biến môi trường; sao lưu và chạy migration; chạy script chép dữ liệu; kiểm thử Preview. Xem `docs/DEPLOYMENT.md` (13 bước).
- Xác nhận giá 99.000/249.000 ₫ và giá sản phẩm (chưa thay đổi).
- `.env.example` không còn email quản trị thật; hãy đặt `ADMIN_EMAIL` trên Vercel.

### Bước tiếp theo
Chủ dự án thực hiện bước 1-10 của `docs/DEPLOYMENT.md` trên staging. Chưa có commit.
