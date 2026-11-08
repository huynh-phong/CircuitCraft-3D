# CircuitCraft 3D — Hợp đồng dữ liệu & API

Tài liệu này mô tả hợp đồng **đang được code thực thi** (V3.7 sau đợt sửa REPAIR-2026-11). Khi code và tài liệu mâu thuẫn, code là nguồn sự thật — hãy cập nhật tài liệu.

## 1. Xác thực & phiên đăng nhập

| Mục | Hợp đồng |
|---|---|
| Danh tính | **Chỉ** lấy từ header `Authorization: Bearer <token>`. Các header `X-User-Email`, `X-User-Id` và các trường `userId`/`creatorId`/`email` trong body **không** được dùng để xác thực. |
| Token CircuitCraft | `base64url(payload).HMAC-SHA256(payload, SESSION_SECRET)`; payload `{ id, email, sv, sid, iat, exp }`. Hạn 7 ngày, làm mới khi mở trang. `sid` = phiên của một thiết bị (giữ nguyên khi làm mới). `sv` = `sessionVersion`: tăng khi đặt lại mật khẩu hoặc đăng xuất mọi thiết bị ⇒ thu hồi mọi token cũ. |
| Token Supabase | JWT 3 phần chỉ được chấp nhận sau khi Supabase Auth xác nhận (`auth.getUser`), email phải đã xác minh. Kết quả cache 60 s. |
| `POST /api/auth/session` | Đổi credential hợp lệ (Bearer) lấy token phiên mới. Body: `fullName`, `previousSessionToken` (tùy chọn; giữ `sid` của thiết bị khi đổi từ token Supabase). Không có Bearer hợp lệ ⇒ `401`. |
| `POST /api/auth/logout` | Chỉ thu hồi phiên của thiết bị hiện tại (lưu tại `data/revoked_sessions.json`). |
| `POST /api/auth/logout-all` | Thu hồi mọi phiên của tài khoản. Chưa có nút trên giao diện. |
| Admin | Chỉ tài khoản có email = `ADMIN_EMAIL` và đã xác minh. Không có API nào cấp quyền `admin`. |
| OTP | 6 số, sinh bằng `crypto.randomInt`, lưu dạng SHA-256, so sánh timing-safe, hết hạn 10 phút (SMS 5 phút), dùng 1 lần, khóa sau 5 lần sai, cooldown 60 s/email, giới hạn theo IP và theo email/SĐT đích (6 lần gửi, 30 lần xác thực / 10 phút). Mật khẩu sai: 10 lần / 15 phút theo tài khoản. **Không bao giờ** trả mã/`previewHtml` trong response, trừ chế độ dev cách ly (`ENABLE_DEV_OTP_PREVIEW=true` và `NODE_ENV !== 'production'`). |
| Mật khẩu | `scrypt$N$r$p$salt$hash` (N=16384, r=8, p=1, salt 16 byte). Hash SHA-256 cũ vẫn đăng nhập được và tự nâng cấp sang scrypt ở lần đăng nhập thành công kế tiếp. |

Client: `src/persistence/apiAuthFetch.ts` tự gắn `Authorization` cho mọi request `/api/*` cùng origin.

### Giới hạn tần suất và địa chỉ client

- Định danh giới hạn: người dùng đã xác thực tính theo tài khoản; khách tính theo `req.ip` theo chính sách `TRUST_PROXY`. Không có giá trị nào từ body được dùng (`userId`, `guestSessionId` của chatbot bị bỏ qua).
- Bộ đếm nằm trong bộ nhớ từng process: nhiều instance sẽ nhân giới hạn lên (xem `docs/DEPLOYMENT.md`).

### Định dạng lỗi API

`{ "success": false, "error": "...", "message": "...", "code": "..." }`. Mã: `INVALID_JSON` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `PAYLOAD_TOO_LARGE` (413), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500). Không trả stack trace.

### Dung lượng request (JSON)

| Route | Giới hạn | Điều kiện |
|---|---|---|
| Mặc định | 100 KB | |
| `/api/ai/*`, `/api/courses/theory-tutor`, `/api/courses/analyze-practice-project` | 1 MB | Có rate limit |
| `/api/projects*` | 5 MB | Đã đăng nhập |
| `/api/creator/products*` | 5 MB | Creator |
| `/api/creator/courses*` | 8 MB | Creator |
| `/api/creator/media` | 2,5 MB | Creator |

Không đủ điều kiện thì áp dụng giới hạn mặc định.

### Ảnh slide

`POST /api/creator/media` (Creator) nhận `{ dataUrl }`, tối đa 1,5 MB/ảnh; loại ảnh xác định từ nội dung file (PNG, JPEG, GIF, WebP, SVG), trả `{ url }`. Ảnh lưu tại `data/course-media/<sha256>.<ext>`, phục vụ công khai qua `GET /api/media/course/:file` (SVG kèm CSP sandbox). `slide.imageDataUrl` chứa URL này hoặc data URL với khóa học cũ; cả hai đều hiển thị được. Trợ giảng lý thuyết chỉ nhận chữ.

## 2. Phân quyền tài nguyên

| Tài nguyên | Quy tắc |
|---|---|
| Dự án cá nhân `/api/projects*` | Chỉ chủ sở hữu (khớp `ownerId` **hoặc** email chủ sở hữu đã xác minh — giữ tương thích bản ghi cũ) hoặc admin. Khách không token nhận `[]`. Không thể ghi đè `projectId` của người khác (`403`). |
| Vai trò `/api/user/role` | Chỉ đổi vai trò của chính mình; lên `pro`/`creator` cần quyền đã được server ghi nhận (gói đã thanh toán hoặc admin cấp). Admin đổi được người khác (trừ cấp `admin`). |
| Creator `/api/creator/*` | Creator = người dùng đăng nhập. `creatorId`/`userId` trong request phải trùng (admin được thao tác thay). Sửa/xóa/đổi trạng thái sản phẩm & khóa học: chủ sở hữu hoặc admin. |
| Phiên bản sản phẩm `GET /api/creator/products/:id/versions` | Bản thiết kế đầy đủ (`projectSnapshot`) chỉ cho chủ sở hữu, admin, người đã mua (entitlement) hoặc sản phẩm miễn phí; người khác nhận metadata với `restricted: true`. |
| Công khai | `GET /api/products/catalog`, `GET /api/products/:id`, `GET /api/products/:id/preview`, `GET /api/courses`, `GET /api/creator/profile/:userId`. |
| Xem trước 3D | Dựng từ phiên bản đã xuất bản của Creator hoặc mẫu trong `src/marketplace/catalogData.ts`. Không có thiết kế ⇒ `404 PREVIEW_UNAVAILABLE`. Sản phẩm trả phí: chưa mua thì ẩn thông số linh kiện (chỉ giữ màu), bố trí và dây nối vẫn hiển thị. |
| Đơn hàng / entitlement | Chỉ chủ đơn hoặc admin đọc được; chỉ chủ đơn được xác nhận thanh toán mô phỏng. |

## 3. Thanh toán (Mock vs Real)

| Biến | Ý nghĩa |
|---|---|
| `PAYMENT_MODE=real` | Luôn ưu tiên, khóa hoàn toàn mock. |
| `PAYMENT_MODE=mock` hoặc `ENABLE_MOCK_PAYMENT=true` | Bật thanh toán mô phỏng. |
| Không đặt | `development` ⇒ mock; `production` ⇒ real. |

- `GET /api/payments/config` → `{ mode, mockEnabled }` (client chỉ đọc để gắn nhãn "Thanh toán mô phỏng").
- `POST /api/orders/create` (cần đăng nhập): giá do server quyết định. Sản phẩm chỉ có trong catalog phía client được chấp nhận **chỉ ở chế độ mock** và đánh dấu `priceSource: "client-unverified"`.
- Đơn hàng mới có `paymentMode` và `isMock`. Đơn cũ không có các trường này được coi là **mock** (hệ thống chưa từng tích hợp ngân hàng).
- `POST /api/orders/mock-verify` & `POST /api/orders/:id/verify`: chỉ chủ đơn; idempotent; ở chế độ real hoặc với đơn real ⇒ `409 MOCK_PAYMENT_DISABLED`.
- Doanh thu thật (`confirmedRevenue`) không gồm đơn mock; doanh thu mô phỏng báo riêng (`mockRevenue`, sale `isMock`).
- Bảng giá gói: `src/billing/membershipPlans.ts` (Student 99.000 ₫, Creator 249.000 ₫ / tháng).
- Giá 6 sản phẩm mẫu: `src/marketplace/catalogData.ts`, dùng chung cho hiển thị và checkout.

## 4. AI

### `POST /api/ai/chat`
```json
{
  "prompt": "string (≤ 4000 ký tự)",
  "history": [{ "role": "user|assistant", "content": "string" }],
  "context": {
    "locale": "vi|en", "projectName": "…", "revision": 12,
    "components": [{ "instanceId", "definitionId (chuẩn)", "name", "parameters", "position" }],
    "connections": [{ "id", "from": "comp.pin", "to": "comp.pin" }],
    "connectionsCount": 3,
    "issues": [{ "ruleId", "severity", "message" }],
    "simulation": { "status", "summary", "issues", "unsupportedComponents" },
    "selectedComponentId": "…",
    "practiceContext": { "courseTitle", "lessonTitle", "lessonSummary", "targetComponents", "targetConnections", "stages": [{ "stageNumber", "title", "steps" }] }
  }
}
```
Response: `{ reply, source: "gemini" | "local-fallback" | "error" }`. Payload cũ `{ prompt, project, issues, simResult, practiceContext }` vẫn được chấp nhận (`normalizeChatRequest`). Định nghĩa: `src/ai/circuitContext.ts`. Không gửi token/email/mật khẩu cho AI.

### `POST /api/ai/propose`
Body `{ requirement, baseRevision, context }`. Response `200 { proposal, warnings }`; `503 AI_UNCONFIGURED`; `502 AI_INVALID_JSON`; `422 AI_PROPOSAL_INVALID { errors }`.
Proposal: `{ proposalId, explanation, layoutDescription, baseRevision, componentsToAdd: ComponentInstance[], connectionsToAdd: Connection[], source: "ai"|"template" }`.
Mọi proposal được kiểm tra bằng `validateAIProposal` (`src/domain/ai/proposalValidation.ts`) ở server (cấu trúc) **và** ở client với tài liệu hiện tại (trước khi xem trước và trước khi áp dụng). Áp dụng = 1 `BatchCommand` (1 bước Undo).

## 5. Linh kiện chuẩn & tương thích ngược

Schema chuẩn: `src/domain/components/definitions.ts`. Bản đồ ID cũ: `src/domain/components/aliases.ts` (`dc_power_supply`/`dc_source`/`terminal_block_2pin` → `dc-source`; `switch_spst` → `switch`; `resistor_axial` → `resistor`; `led_basic` → `led`; `arduino_uno` → `arduino-uno`; chân `pin_pos`→`vcc`, `pin_1`→`pin1`, `p1`→`pin1`, `pin_anode`→`anode`…). Mô phỏng, DRC và AI dùng bản chuẩn hóa **dẫn xuất**; dữ liệu đã lưu không bị ghi lại.

Bổ sung 2026-11-08 (tương thích ngược, không đổi ID đã lưu):
- Định nghĩa trùng `servo-motor` → `servo-sg90` (chân `signal` → `pwm`), `ultrasonic-sensor` → `ultrasonic-sr04`, `logic_and` → `logic-and`, `temp_sensor` → `temp-sensor`. Hai định nghĩa cũ có `deprecatedBy` nên không còn hiện trong thư viện nhưng dự án cũ vẫn mở được.
- Chân Arduino viết tắt: `d0`…`d13`, `a0`…`a5`, `5v`, `3v3`, `vin`, `gnd1/gnd2/gnd3`, `ioref`, `reset`, `aref`, `sda`, `scl`; tụ/còi `pos`/`neg`; NE555 `trigger/output/threshold/discharge/control`; 7805 `in/out`; LM35 `out`; động cơ `pin1/pin2`.
- Chân mới (ID cũ giữ nguyên): NE555 thêm `reset`, `ctrl`, `thr`, `dis`; 74HC08 thêm `in_2a … out_4y` (cổng 1 giữ `in_a`, `in_b`, `out_y`); rơ-le thêm `nc`; nút nhấn thêm `pin1b`, `pin2b`; LED 7 đoạn thêm `seg_d`, `seg_e`, `seg_f`, `seg_g`, `com2`. Vị trí chân IC/LED 7 đoạn đổi theo package thật, nên linh kiện IC cũ đang cắm trên breadboard có thể cắm vào lỗ khác.
- `ComponentDefinition.deprecatedBy?: string`; `ComponentCategory` thêm `actuators`.
- Tham số mới: breadboard `railSplit: boolean`; rơ-le `coilResistance`, `pickupVoltage`, `releaseVoltage`; còi `minVoltage`, `maxVoltage`; động cơ `ratedVoltage`, `equivalentResistance`, `startVoltage`; Arduino `codeProgram` thêm `'none'`. Không còn dùng (bị bỏ qua, vẫn giữ trong dữ liệu cũ): breadboard `tiePoints`, `railVoltage`; Arduino `operatingVoltage`, `d13State`; LED RGB `colorState`; LED 7 đoạn `digit`; LED `forwardVoltage: 2` lưu sẵn cho LED không phải màu đỏ (được hiểu là "chưa chọn", dùng Vf theo màu).

## 6. Kết quả mô phỏng (`SimulationResult`)

Thêm (tùy chọn, tương thích ngược): `solver: "mna-dc"`, `unsupportedComponents: string[]`, `nodeVoltages`, và mỗi linh kiện `currentA`, `voltageV` (đơn vị SI). Các trường cũ (`status`, `isClosedLoop`, `components[id].isOn/stateLabel/currentEstimate/voltageDrop`, `issues`, `summary`) giữ nguyên ý nghĩa.

Bổ sung 2026-11-08 (đều tùy chọn):
- `diagnostics: Array<{ ruleId, severity: 'error'|'warning'|'info', message, objectRefs, suggestion? }>` — DRC hiển thị đúng các mục này; `issues` = message của mục error/warning (+ "Mạch hở…" khi dừng).
- Mỗi linh kiện: `powerW`, `mode` (vd. `cutoff`/`active`/`saturation`, `regulating`/`dropout`, `astable`), `pwm { frequencyHz, duty, sourceId }` (linh kiện đi theo bộ dao động; `currentA` khi đó là dòng trung bình), `timeConstantS` (tụ), `visual { brightness, rgb, segments, angleDeg, rpm, sounding, displayOn, contact }`.
- `ruleId` do bộ giải sinh: `SHORT_CIRCUIT`, `SOURCE_OVERLOAD`, `LED_OVERCURRENT_RISK`, `OVERCURRENT`, `OVERPOWER`, `OVERVOLTAGE`, `REVERSE_POLARITY`, `FLOATING_INPUT`, `REGULATOR_DROPOUT`, `THERMAL` (info), `RELAY_FLYBACK` (info), `PIN_CONFLICT`, `SIMULATION_LIMIT`. DRC thêm `INVALID_PIN` (error) và `MISSING_POWER` (warning).

## 7. Admin analytics (2026-11-08)

`GET /api/admin/analytics?range=today|7d|30d|90d|month|custom&from=YYYY-MM-DD&to=YYYY-MM-DD&env=all|real|mock` — chỉ admin (401/403), rate limit 120/phút. Tham số sai → `400 { code: 'INVALID_QUERY' }`. `from`/`to` là ngày theo giờ Việt Nam, gồm cả hai đầu, tối đa 2 năm.

Phản hồi (rút gọn):
```
{ generatedAt, timezone: 'Asia/Ho_Chi_Minh', currency: 'VND',
  range: { preset, from, to, days, granularity: 'day'|'week'|'month', previous: { from, to } },
  filters: { env }, buckets: [{ key, label }],
  revenue:  { kpis: {Metric}, statusDistribution, series: { real, mock, orders, paidOrders }, composition, compositionSeries, topProducts, recentTransactions },
  users:    { kpis, series: { newUsers, cumulative, activeUsers }, activityTrackedSince, byRole, funnel, retention },
  memberships: { distribution: [{ plan, total, viaSimulatedPayment, viaRealOrAdmin }], kpis },
  learning: { kpis, topCourses, salesByCreator, productCategories, salesByCategory },
  projects: { kpis, series: { newProjects, simulationRuns }, topComponents, componentsBasis },
  system:   { environment, logLevels, logCategories, authFailures, paymentWarnings, recentProblems, instance },
  dataQuality: [{ id, severity: 'critical'|'warning'|'info', title, count, sampleIds, note }] }
Metric = { value: number | null, previous?: number | null, status: 'ok'|'not_tracked'|'insufficient_data'|'not_applicable', unit: 'count'|'vnd'|'percent'|'ms', definition: string, trackedSince?: string | null }
```
Quy ước: `null` = chưa ghi nhận / không áp dụng (không bao giờ thay bằng 0); mảng chuỗi thời gian có `null` cho các mốc trước khi bắt đầu ghi nhận; tiền là số nguyên VND; doanh thu thật không bao gồm đơn mô phỏng. Định nghĩa từng chỉ số: `docs/ADMIN_ANALYTICS_DATA_AUDIT.md` mục 6.

`GET /api/admin/analytics/export.csv` (cùng tham số) — chỉ admin, 30/phút, UTF-8 có BOM, ghi nhật ký `ADMIN_ANALYTICS_EXPORT`. Cột: orderCode, createdAt, paidAt, status, environment, kind, productId, productTitle, amountVnd, currency, userId. Ô bắt đầu bằng `= + - @` được thêm `'`.

`POST /api/analytics/events { event: 'simulation_run' | 'simulation_error' }` — cần đăng nhập, 240/10 phút, tên khác → `400 UNKNOWN_EVENT`. Lưu vào collection `activity_days` (id `${ngày VN}:${HMAC(userId)}`, `{ day, u, events }`), mỗi sự kiện tối đa 2000 lần/người/ngày. Mọi request đã đăng nhập cũng đánh dấu người dùng hoạt động trong ngày.

Thay đổi tương thích ngược: `revenue` của khóa học/sản phẩm trong `/api/admin/courses`, `/api/admin/marketplace` giờ chỉ là doanh thu thật, thêm `mockRevenue`; `componentCount` của sản phẩm Creator thiếu dữ liệu là `null` thay vì 3; `dailySeries.revenue` (overview) và `timeline.revenue` (reports) chỉ còn doanh thu thật, ngày theo giờ Việt Nam; reports 90 ngày trả đủ mọi ngày.

## Serverless (Vercel + Supabase)

### Nội dung trả phí
- `GET /api/courses`: tóm tắt công khai; mỗi bài có `id, title, duration, summary, sectionType, isPracticalLab, slideCount, hasVideo, practiceProjectName, practiceComponentCount, practiceConnectionCount`. Khóa có `contentRestricted: true`. Không có slide, ghi chú, mạch mục tiêu hay link video.
- `GET /api/courses/:id/content`: khóa đầy đủ, link media đã ký. Miễn phí: ai cũng đọc được. Trả phí: chủ khóa, admin, người mua. Lỗi: `401 UNAUTHORIZED`, `403 PAYMENT_REQUIRED`, `404 COURSE_NOT_FOUND`.
- `POST /api/courses/enroll|progress`: khóa trả phí chưa mua trả `403 PAYMENT_REQUIRED`.
- `GET /api/products/:id/design`: bản thiết kế đầy đủ, cùng mã lỗi; `404 PRODUCT_NOT_FOUND | DESIGN_UNAVAILABLE`.
- `GET /api/products/:id/preview`: sản phẩm trả phí chưa mua có `limitedPreview: true`, `connections: []`, tên linh kiện chung, không có thông số ngoài màu.

### Media
- `POST /api/creator/media` trả `{ url, previewUrl }`: `url` là đường dẫn lưu trong khóa học, `previewUrl` có chữ ký.
- `POST /api/creator/media/video-upload-url` `{ contentType, size }` trả `{ uploadUrl, url }`: trình duyệt `PUT` thẳng lên Storage; MP4/WebM tối đa 50 MB; local trả `501 VIDEO_STORAGE_UNAVAILABLE`.
- `GET /api/media/course/:file?exp&sig`, `GET /api/media/video/:file?exp&sig`: thiếu hoặc sai chữ ký trả `403 MEDIA_LINK_INVALID`; trên Vercel chuyển hướng 302 tới link Storage ngắn hạn. Liên kết ký có hiệu lực 6 giờ.

### Dự án
- `POST /api/projects/sync` `{ project, force? }`: nếu `project.revision` nhỏ hơn revision trên server, hoặc instance khác vừa lưu cùng dự án, trả `409 { code: 'PROJECT_CONFLICT', remoteRevision }` và không ghi. Gửi lại với `force: true` để chủ động ghi đè.
- Client đã đăng nhập đọc danh sách dự án từ `GET /api/projects` (gộp với bản trong trình duyệt, lấy bản mới hơn theo revision, rồi theo `updatedAt`).

### Đơn hàng
- `POST /api/orders/create` không tạo đơn trùng. Đơn đang chờ cùng sản phẩm, cùng giá, cùng chế độ trong 30 phút được dùng lại. Sản phẩm đã sở hữu thì trả đơn đã thanh toán kèm `alreadyOwned: true`. Mã đơn được tính tất định từ người mua, sản phẩm và số đơn trước đó.

### Vercel Function
- Route `^/api(/.*)?$` → `/api/index?__path=$1`. `src/server/vercelHandler.ts` dựng lại URL gốc từ `__path` trước khi chuyển cho Express.

### Lỗi hạ tầng
- `503 SERVER_NOT_CONFIGURED`: thiếu biến bắt buộc. `GET /api/health` trả `{ status, persistence, missingSettings }`.
- `503 PERSISTENCE_UNAVAILABLE`: không đọc được database, request không được xử lý.
- `503 PERSISTENCE_FAILED`: không ghi được, thay đổi chưa được ghi nhận.
- `503 PAYMENT_NOT_CONFIGURED`: chế độ thật chưa có `PAYMENT_ACCOUNT_NUMBER`.

### OTP
- Mã gắn mục đích: `auth` (`/api/auth/send-otp`, `verify-otp`) và `recovery` (`forgot-password/*`), không dùng lẫn. Hiệu lực 10 phút (điện thoại 5 phút), chờ 60 giây giữa hai lần gửi, sai 5 lần thì vô hiệu, dùng một lần.

### Thanh toán mô phỏng
- Đơn mock vẫn có thông tin chuyển khoản và `qrUrl` VietQR (từ `PAYMENT_ACCOUNT_*`, hoặc giá trị mặc định); nút "Thanh toán thành công (Demo)" gọi `/api/orders/mock-verify` và mở quyền ngay, không chuyển tiền.
- Ở chế độ thật, quyền và gói từ mô phỏng không có hiệu lực (`entitlement.isMock`, `user.tierGrantedByMock`).

### Collection trong `cc_documents`
`users` (khóa: email chữ thường), `removed_users`, `projects`, `project_versions`, `enrollments`, `logs`, `settings`, `revoked_sessions`, `orders` (orderId), `entitlements` (`userId_productId`), `creator_profiles`, `creator_products`, `creator_versions`, `creator_courses`, `creator_sales` (`sale-<orderId>`).

