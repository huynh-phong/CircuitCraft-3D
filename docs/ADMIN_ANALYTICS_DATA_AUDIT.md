# Kiểm toán dữ liệu Admin & Analytics — 2026-11-08

Phạm vi: toàn bộ Admin Console (`src/pages/AdminDashboardPage.tsx`), các API `/api/admin/*` trong `src/server/app.ts`, các kho dữ liệu phía server (`userStore.ts`, `creatorStore.ts`, `security.ts`, kho đơn hàng/quyền sở hữu trong `app.ts`), lớp lưu trữ (`persistence.ts`, bảng `cc_documents`) và các migration trong `supabase/migrations/`.

Phương pháp: đọc code đường đi của từng số liệu (kho → API → giao diện), viết lại phép tính dưới dạng hàm thuần có test, rồi đối soát trên một server cách ly (thư mục dữ liệu tạm, không `.env`, thanh toán mô phỏng). **Không đọc hay sửa dữ liệu production** trong đợt này; mọi phát hiện về chất lượng dữ liệu được tính bằng các phép kiểm tra chỉ đọc mà dashboard tự chạy trên dữ liệu thật khi admin mở trang.

---

## 1. Module được kiểm tra

| Module | Kho dữ liệu | API admin | Giao diện |
|---|---|---|---|
| Người dùng | `users` (`RegisteredUser`) | `GET/PATCH /api/admin/users[/:id]` | Người dùng |
| Giao dịch | `orders` (Map trong `app.ts`) | `GET/PATCH /api/admin/transactions[/:id]` | Giao dịch |
| Quyền sở hữu | `entitlements` | (qua chi tiết người dùng) | — |
| Gói thành viên | trường `tier` + `tierGrantedByMock` của user, đơn `plan-*` | `GET /api/admin/memberships` | Gói thành viên |
| Khóa học | danh mục hệ thống + `creator_courses`, `enrollments` | `GET/PATCH /api/admin/courses` | Khóa học |
| Cửa hàng / Creator | danh mục hệ thống + `creator_products`, `creator_versions`, `creator_sales`, `creator_profiles` | `GET/PATCH /api/admin/marketplace` | Cửa hàng |
| Dự án & mạch | `projects`, `project_versions` | `GET /api/admin/projects` | Dự án & Mạch |
| Nhật ký | `logs` | `GET /api/admin/logs` | Nhật ký hệ thống |
| Cài đặt | `settings` | `GET/PATCH /api/admin/settings` | Cài đặt |
| Báo cáo | (tính từ các kho trên) | `GET /api/admin/reports` | Báo cáo |
| Tổng quan | (tính từ các kho trên) | `GET /api/admin/overview` (cũ), `GET /api/admin/analytics` (mới) | Tổng quan |
| Phiên đăng nhập | `revoked_sessions`, token HMAC | `/api/auth/*` | — |

## 2. Bảng dữ liệu và quan hệ

Mọi bản ghi server nằm trong **một bảng** `public.cc_documents (collection, id, data jsonb, version, deleted, updated_at)` (migration `20261105000000_serverless_persistence.sql`). Không có foreign key ở mức database: các quan hệ dưới đây là **quan hệ logic** trong JSON, nên tính toàn vẹn phải kiểm bằng code (mục 3). Chạy local dùng file `data/*.json` cùng cấu trúc.

| Collection | Khóa | Trường chính | Quan hệ logic |
|---|---|---|---|
| `users` | email (thường) | id, email, role (`user/admin/creator/pro`), tier (`free/student/creator`), status (`active/suspended`), createdAt, verifiedAt, lastActiveAt, tierGrantedByMock | — |
| `orders` | orderId | userId, productId, amount (số nguyên VND), currency, status (`pending/paid/failed/expired/cancelled/refunded`), paymentMode (`mock/real`), isMock, orderType, creatorId, createdAt, paidAt | userId → users.id; productId → sản phẩm/khóa/gói |
| `entitlements` | `${userId}_${productId}` | orderId, grantedAt, isMock | userId → users; orderId → orders |
| `projects` | id | ownerId, ownerEmail, componentCount, connectionCount, status (`active/archived`), isPublic, createdAt, updatedAt, document | ownerId → users |
| `project_versions` | id | projectId, revision, createdAt | projectId → projects |
| `enrollments` | id | userId, courseId, enrolledAt, progressPercent | userId → users; courseId → khóa học |
| `creator_products`, `creator_courses` | id | creatorId, status (`DRAFT/PENDING/PUBLISHED/REJECTED/ARCHIVED`), price, category | creatorId → users.id |
| `creator_sales` | id | orderId, creatorId, productId, unitPrice, isMock | orderId → orders |
| `logs` | id | timestamp, level, category, action | actorId → users |
| `activity_days` (**mới**) | `${ngày}:${hash}` | day, u (HMAC của userId), events | (ẩn danh) |

Ràng buộc database duy nhất: khóa chính `(collection, id)` và cột `version` cho khóa lạc quan. Enum trạng thái chỉ được kiểm ở server (`PATCH /api/admin/transactions` chỉ nhận 6 trạng thái hợp lệ).

## 3. Phát hiện về chất lượng dữ liệu

Dashboard mới chạy 15 phép kiểm tra chỉ đọc mỗi lần tải (`computeDataQuality` trong `src/server/adminAnalytics.ts`): đơn không có tài khoản, đơn thiếu thời điểm tạo, trạng thái lạ, số tiền/tiền tệ không cộng được, đơn đã thanh toán thiếu `paidAt`, đơn đã thanh toán chưa cấp quyền sở hữu, mua trùng, quyền sở hữu không có đơn, quyền sở hữu của tài khoản không tồn tại, gói trả phí không có đơn, đơn gói đã hoàn nhưng vẫn giữ gói, dự án mồ côi, ghi danh mồ côi, tài khoản thiếu thời điểm tạo, trùng email.

Kết quả trên **dữ liệu production: CHƯA CHẠY** (đợt này không truy cập production). Admin xem kết quả thật trong thẻ "Chất lượng dữ liệu" của trang Tổng quan. Trên dữ liệu cách ly có 4 đơn hàng, 4 tài khoản và 3 dự án, kết quả là 0 vấn đề trong 15 phép kiểm tra.

Phát hiện từ đọc code (không cần dữ liệu):

| # | Loại | Phát hiện |
|---|---|---|
| Q1 | Data integrity | Không có foreign key: xóa tài khoản không xóa/đánh dấu đơn, dự án, ghi danh của tài khoản đó. Đã thêm phép kiểm tra bản ghi mồ côi; không tự sửa dữ liệu lịch sử. |
| Q2 | Data integrity | `data/registered_users.json`, `orders_store.json`, `creator_store.json`, `system_logs.json` vẫn được git theo dõi (đã ghi nhận từ trước trong `docs/PROGRESS.md`). File mới `data/activity_days.json` đã được thêm vào `.gitignore`. |
| Q3 | Business rule | Đổi đơn gói sang `refunded` không hạ gói của tài khoản. Đã thêm phép kiểm tra "đơn gói đã hoàn nhưng vẫn giữ gói"; **chưa đổi nghiệp vụ** (cần quyết định của chủ sản phẩm). |
| Q4 | Business rule | Gói thành viên ghi "Tháng" nhưng không có ngày hết hạn: gói giữ vĩnh viễn sau một lần thanh toán. Hệ quả: không thể tính hết hạn, gia hạn, churn, MRR/ARR. |
| Q5 | Business rule | Thời điểm hoàn tiền không được lưu: hoàn tiền chỉ xếp được theo thời điểm thanh toán ban đầu. |
| Q6 | Business rule | Đơn 0đ có `isMock = true` khi hệ thống ở chế độ mock. Không ảnh hưởng doanh thu (0đ) nhưng trước đây làm tăng "đơn mô phỏng thành công"; nay đơn 0đ được đếm riêng. |

## 4. Phát hiện về phép tính (số liệu hiển thị sai trước khi sửa)

| # | Mức | Nơi | Trước | Sau |
|---|---|---|---|---|
| C1 | **Sai doanh thu** | `/api/admin/overview` `dailySeries.revenue` | Cộng mọi đơn `paid`, **kể cả đơn mô phỏng**: biểu đồ 7 ngày hiện doanh thu trong khi thẻ "Doanh thu xác nhận" là 0đ | Chỉ doanh thu thật |
| C2 | **Sai doanh thu** | `/api/admin/reports` `timeline.revenue` | Như C1 | Chỉ doanh thu thật |
| C3 | **Sai doanh thu** | `revenue` của từng khóa học / sản phẩm (`getUnifiedCoursesList`, `getUnifiedMarketplaceList`) | Cộng cả đơn mô phỏng | Chỉ thật; thêm `mockRevenue` riêng |
| C4 | Sai ngày | overview, reports | Ngày theo UTC (`toISOString`) nhưng nhãn theo giờ máy: đơn từ 0h–7h giờ Việt Nam bị xếp vào ngày hôm trước | Ngày theo `Asia/Ho_Chi_Minh` |
| C5 | Mất dữ liệu biểu đồ | reports 90 ngày | Chỉ lấy 1 ngày trong mỗi 3 ngày, bỏ qua 2/3 dữ liệu | Đủ mọi ngày |
| C6 | Sai nhãn | reports `creatorActivityCount` | Tổng mọi sản phẩm + khóa học từ trước tới nay, hiển thị như hoạt động trong kỳ | Chỉ những cái tạo trong kỳ |
| C7 | Lẫn khái niệm | overview `totalCreators` | `tier === 'creator' OR role === 'creator'` (gộp vai trò và gói) | Theo gói `tier` |
| C8 | Số giả | Sản phẩm Creator không có `componentsSummary` | `componentCount` mặc định **3** | `null` (không biết) |
| C9 | Nhãn sai thực tế | Tổng quan cũ ghi "Dữ liệu thời gian thực", "gói trả phí đang bật" | Gói không có hết hạn nên "đang bật" chỉ là tier hiện tại | Dashboard mới ghi rõ định nghĩa từng chỉ số |

Đối chiếu ảnh tham chiếu ("Tổng doanh thu xác nhận 0đ; 4 giao dịch; 3 thành công; 1 chờ; 597.000đ mô phỏng"): công thức tạo ra các số này là đúng (doanh thu thật chỉ gồm đơn `paymentMode = real`), nhưng biểu đồ 7 ngày bên cạnh cộng 597.000đ mô phỏng vào "doanh thu" (lỗi C1). Không thể xác nhận từng đơn của ảnh vì không truy cập dữ liệu production.

## 5. Chỉ số hiện có (trước đợt này)

Tổng người dùng, người dùng mới 7 ngày, tổng dự án, sản phẩm đang bán, tổng khóa học, số creator, tổng giao dịch, đơn thành công, doanh thu xác nhận, doanh thu mô phỏng, đơn chờ, gói trả phí; chuỗi 7 ngày (người dùng, đơn, doanh thu, dự án); phân bố gói; báo cáo 7/30/90 ngày.

## 6. Chỉ số mới, công thức và nguồn

Mọi chỉ số do `computeAdminAnalytics` (`src/server/adminAnalytics.ts`) tính, trả qua `GET /api/admin/analytics`. Kỳ báo cáo: ngày theo giờ Việt Nam, gồm cả ngày đầu và ngày cuối; kỳ so sánh là kỳ liền trước cùng độ dài. Tiền: số nguyên VND; đơn khác VND bị loại khỏi tổng và được báo trong chất lượng dữ liệu.

| Chỉ số | Công thức | Nguồn |
|---|---|---|
| Doanh thu thật đã xác nhận | Σ amount của đơn `paid`, không mock, có `paidAt` (hoặc `createdAt` với bản ghi cũ) trong kỳ | orders |
| Giá trị mô phỏng | Σ amount đơn `paid` mock trong kỳ (không phải doanh thu) | orders |
| Gross payment volume | Thật đã thanh toán + thật đã hoàn (theo thời điểm thanh toán) | orders |
| Hoàn tiền | Σ đơn thật `refunded` | orders |
| Net revenue | Gross − hoàn tiền (phí cổng thanh toán không được ghi nhận nên không trừ) | orders |
| Đang chờ (số tiền, số đơn) | Đơn có giá > 0 đang `pending` ở thời điểm hiện tại | orders |
| Số giao dịch | Đơn tạo trong kỳ, mọi trạng thái, theo bộ lọc môi trường | orders |
| Tỉ lệ thành công / thất bại | Trên đơn có giá tạo trong kỳ đã có kết quả: (paid+refunded)/(paid+refunded+failed+expired+cancelled); đơn chờ không tính | orders |
| Giá trị đơn trung bình | Doanh thu thật / số đơn thật có giá đã thanh toán | orders |
| Đơn 0đ | Đơn giá 0 tạo trong kỳ | orders |
| Cơ cấu theo loại | membership (`orderType` hoặc `plan-*`), course (`course-*`), còn lại là cửa hàng | orders |
| Top sản phẩm, doanh số theo Creator, theo danh mục | Nhóm đơn `paid` trong kỳ theo productId / creatorId / category | orders, danh mục |
| Tổng / mới / tăng trưởng người dùng | Đếm tài khoản; mới = createdAt trong kỳ; tăng trưởng = mới / có trước kỳ | users |
| DAU / WAU / MAU | Tài khoản có `lastActiveAt` trong 1/7/30 ngày qua (lastActiveAt cập nhật tối đa 5 phút/lần) | users |
| Hoạt động trong kỳ, quay lại ≥ 2 ngày | Người dùng khác nhau trong `activity_days`; **chỉ khi việc ghi nhận phủ cả kỳ** | activity_days |
| Phễu | Cùng nhóm đăng ký trong kỳ: đăng ký → xác minh → có dự án → có đơn trả phí đã thanh toán | users, projects, orders |
| Phân bố gói | Theo `tier` hiện tại, tách gói do thanh toán mô phỏng cấp (`tierGrantedByMock`) | users |
| Gói mới thật / mô phỏng | Đơn gói `paid` trong kỳ | orders |
| Khóa học, sản phẩm, chờ duyệt, Creator hoạt động | Theo trạng thái trong danh mục hợp nhất | danh mục |
| Ghi danh, hoàn thành | enrolledAt trong kỳ; progressPercent ≥ 100 | enrollments |
| Dự án mới / lưu trong kỳ / phiên bản / dự án mỗi người / linh kiện dùng nhiều | createdAt, updatedAt, project_versions, nhóm theo ownerId, đếm definitionId trong document | projects |
| Lượt mô phỏng, mô phỏng lỗi | Σ sự kiện `simulation_run` / `simulation_error` trong `activity_days` | activity_days |
| Nhật ký theo mức / danh mục, cảnh báo đăng nhập/thanh toán | Đếm log trong kỳ | logs |
| Request, 4xx, 5xx, p50/p95 | Bộ đếm **của instance đang trả lời**, từ lúc khởi động (ghi rõ phạm vi trên giao diện) | bộ nhớ |

## 7. Số liệu không thể tính

| Chỉ số | Lý do | Phân loại |
|---|---|---|
| Hết hạn, gia hạn, churn, MRR/ARR | Gói không có ngày hết hạn và không có thanh toán định kỳ | Ngoài chức năng hiện có |
| DAU/hoạt động **lịch sử** trước 2026-11-08 | Không có sự kiện hoạt động trước đây; `lastActiveAt` chỉ giữ lần cuối | Không khôi phục được |
| Lượt mô phỏng trước 2026-11-08 | Mô phỏng chạy trên trình duyệt, chưa từng được ghi nhận | Không khôi phục được (đã thêm ghi nhận từ nay) |
| Retention theo nhóm 7/30 ngày | Cần ít nhất 30 ngày sự kiện hoạt động | Cần thời gian thu thập |
| Visitor (khách chưa đăng nhập) trong phễu | Không theo dõi khách ẩn danh (giữ quyền riêng tư) | Không ghi nhận |
| Phí giao dịch, payout Creator | Không có dữ liệu / chức năng | Ngoài chức năng hiện có |
| Lượt xem khóa học | Không ghi nhận | Cần instrumentation |
| Thời điểm hoàn tiền | Không lưu | Cần bổ sung trường |
| p50/p95 toàn hệ thống trên Vercel | Mỗi instance có bộ đếm riêng, không có kho metric chung | Cần dịch vụ giám sát |

Các chỉ số này trả về `value: null` với `status: 'not_tracked' | 'insufficient_data' | 'not_applicable'` và giao diện hiển thị "Chưa ghi nhận"/"Không áp dụng", không hiển thị 0.

## 8. Bảo mật

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Tạo phiên admin chỉ bằng email (`POST /api/auth/session` với email/role trong body) | Bị từ chối (401): phiên chỉ cấp sau OTP hoặc Bearer token hợp lệ | `test/security_payment.integration.test.ts`, `test/admin_analytics.test.ts` |
| API phân tích không đăng nhập / người dùng thường | 401 / 403 (cả xuất CSV) | `test/admin_analytics.test.ts` |
| Role do client gửi | Không được tin: quyền admin = email admin đã xác minh phía server (`isVerifiedAdminEmail`) | `src/server/security.ts` |
| Tham số truy vấn | Kiểm tra range, định dạng ngày, from ≤ to, tối đa 2 năm, env → 400 `INVALID_QUERY` | test |
| Rate limit | 120 yêu cầu/phút cho phân tích, 30/phút cho xuất CSV, 240 sự kiện/10 phút mỗi người | `src/server/app.ts` |
| CSV formula injection | Ô bắt đầu bằng `= + - @ tab CR` được thêm dấu `'`; mọi ô được đặt trong ngoặc kép | test |
| Nhật ký thao tác nhạy cảm | Xuất CSV ghi `ADMIN_ANALYTICS_EXPORT` | test |
| Dữ liệu nhạy cảm | Payload phân tích không chứa token, hash mật khẩu; email người mua chỉ ở bảng giao dịch gần đây (admin vốn xem được ở trang Giao dịch) | code |
| Sự kiện hoạt động | Chỉ lưu HMAC của userId theo ngày; không email, IP, URL, nội dung mạch | `src/server/activityStore.ts` |
| SQL injection | Không có SQL do người dùng điều khiển: mọi truy vấn đi qua RPC cố định của `cc_documents` | code |

## 9. Danh sách phần chưa hoàn thiện

1. Nghiệp vụ gói: thêm ngày hết hạn/gia hạn nếu muốn có churn và MRR (cần quyết định sản phẩm).
2. Hoàn tiền: lưu `refundedAt` và tự hạ gói khi hoàn tiền đơn gói (Q3, Q5).
3. Retention theo nhóm: đủ dữ liệu sau khoảng 30 ngày ghi nhận.
4. Giám sát toàn hệ thống (độ trễ, lỗi trên mọi instance): cần dịch vụ log/metric bên ngoài.
5. Chạy các phép kiểm tra chất lượng dữ liệu trên production và xử lý từng phát hiện (chỉ đọc; sửa dữ liệu cần xác nhận riêng).
