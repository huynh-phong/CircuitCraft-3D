# Báo cáo triển khai Admin Console & Analytics Dashboard — 2026-11-08

Đi kèm: `docs/ADMIN_ANALYTICS_DATA_AUDIT.md` (kiểm toán dữ liệu, công thức, số liệu không tính được).

## 1. Kiến trúc

```
Kho dữ liệu (cc_documents / data/*.json)
   users · orders · entitlements · projects · project_versions · enrollments
   creator_* · logs · activity_days (mới)
        │  (đọc trong bộ nhớ sau khi đồng bộ đầu request)
        ▼
GET /api/admin/analytics  ── requireAdmin + rate limit + kiểm tra tham số
   buildAnalyticsSnapshot()  →  computeAdminAnalytics(snapshot, query)   [src/server/adminAnalytics.ts, hàm thuần]
        ▼  JSON có kiểu: Metric { value | null, status, unit, definition }
AdminAnalyticsDashboard (React)  ── chỉ hiển thị, không tự tính tổng
```

- Mọi phép tính ở server, trong một module thuần có test riêng.
- Một API cho cả trang, nên mọi thẻ và biểu đồ dùng cùng kỳ báo cáo và cùng bộ lọc môi trường.
- Lớp dữ liệu hiện có đã được dùng lại: không có hệ thống song song và không cần migration.

## 2. File đã thêm / sửa

| File | Thay đổi |
|---|---|
| `src/server/adminAnalytics.ts` (mới) | Kỳ báo cáo theo giờ Việt Nam, bucket ngày/tuần/tháng, mọi chỉ số, 15 phép kiểm tra chất lượng dữ liệu, CSV an toàn |
| `src/server/activityStore.ts` (mới) | Ghi nhận hoạt động theo ngày (HMAC userId) và sự kiện `simulation_run`/`simulation_error` |
| `src/server/app.ts` | Bộ đếm request theo instance; `GET /api/admin/analytics`, `GET /api/admin/analytics/export.csv`, `POST /api/analytics/events`; sửa C1–C8 (doanh thu mô phỏng, ngày UTC, 90 ngày bỏ ngày, nhãn sai, số giả) |
| `src/server/security.ts` | Đánh dấu người dùng hoạt động khi xác thực request |
| `src/server/creatorStore.ts` | `countProfiles()` |
| `src/services/usageEvents.ts` (mới), `src/App.tsx` | Gửi sự kiện khi bắt đầu mô phỏng / mô phỏng lỗi (chỉ khi đã đăng nhập, không gửi nội dung mạch) |
| `src/components/admin/AdminSidebar.tsx` (mới) | Sidebar mới |
| `src/components/admin/AdminAnalyticsDashboard.tsx` (mới) | Dashboard 6 phần |
| `src/components/admin/charts.tsx` (mới) | Biểu đồ SVG: xu hướng, cột/cột chồng, donut, thanh ngang, phễu, sparkline |
| `src/pages/AdminDashboardPage.tsx` | Dùng sidebar và dashboard mới; giữ nguyên 9 khu vực quản trị còn lại |
| `test/admin_analytics.test.ts` (mới), `package.json` | 33 test, thêm vào `npm test` |
| `.gitignore` | `data/activity_days.json` |
| Tài liệu | `docs/ADMIN_ANALYTICS_DATA_AUDIT.md`, báo cáo này, `PROGRESS.md`, `ARCHITECTURE.md`, `CONTRACTS.md` (mục 7), `DEPLOYMENT.md`, `TEST-PLAN.md`, `ROADMAP.md` (A1) |

## 3. API mới / thay đổi

Chi tiết hợp đồng: `docs/CONTRACTS.md` mục 7.

| API | Quyền | Ghi chú |
|---|---|---|
| `GET /api/admin/analytics` | admin | range `today/7d/30d/90d/month/custom`, `env=all/real/mock`, 120/phút |
| `GET /api/admin/analytics/export.csv` | admin | CSV giao dịch trong kỳ, có BOM, chống chèn công thức, ghi nhật ký |
| `POST /api/analytics/events` | đăng nhập | chỉ `simulation_run`, `simulation_error`; 240/10 phút |
| `/api/admin/overview`, `/api/admin/reports`, `/api/admin/courses`, `/api/admin/marketplace` | admin | sửa số liệu (mục 4 báo cáo kiểm toán); thêm `mockRevenue` |

## 4. Database migration

**Không có.** Bản ghi mới nằm trong collection `activity_days` của bảng `cc_documents` đã có; bảng không giới hạn tên collection. Không xóa, không đổi và không backfill bản ghi cũ nào.

## 5. Sidebar

- Kiểu viên thuốc nổi như navbar: nền `#061224`, viền cyan mảnh, bo 28px, mục đang chọn là pill có glow nhẹ và vạch sáng bên trái.
- Bốn nhóm, chỉ gồm các trang đang có (không có mục dẫn tới trang chưa làm):
  - **Tổng quan**
  - **Kinh doanh:** Giao dịch, Gói thành viên, Cửa hàng, Khóa học
  - **Nền tảng:** Người dùng, Dự án & Mạch
  - **Quản trị:** Báo cáo, Nhật ký hệ thống, Cài đặt
- Thu gọn thành thanh icon 76px (tooltip khi rê chuột hoặc focus), trạng thái lưu trong `localStorage` (`cc3d:admin:sidebar-collapsed`).
- Điện thoại: drawer có nền mờ phía sau, Esc để đóng, giữ focus trong drawer và trả focus về nút menu khi đóng.
- Chuyển động 150–200 ms ease-out, tắt khi người dùng bật `prefers-reduced-motion`.

## 6. Các phần của dashboard

| Phần | Nội dung |
|---|---|
| Tổng quan | 8 KPI có sparkline và so với kỳ trước, doanh thu theo thời gian (thật / mô phỏng tách đường), trạng thái giao dịch (donut), tăng trưởng người dùng, phân bố gói (tách mô phỏng), nội dung & cộng đồng, giao dịch gần đây, chất lượng dữ liệu |
| Doanh thu | Net, gross, hoàn tiền, giá trị mô phỏng, tỉ lệ thành công/thất bại, giá trị đơn TB, đang chờ; số giao dịch theo thời gian; cơ cấu theo loại (cột chồng); top sản phẩm; giới hạn số liệu |
| Người dùng | Tổng, mới, tăng trưởng, hoạt động trong kỳ, DAU/WAU/MAU, quay lại; tài khoản tích lũy; hoạt động theo ngày; phễu cùng nhóm; gói; vai trò |
| Nội dung & Học tập | Khóa học, ghi danh, hoàn thành, sản phẩm, Creator, chờ duyệt, payout (chưa ghi nhận); top khóa học, doanh số theo Creator, sản phẩm theo danh mục |
| Dự án & Mạch | Tổng/mới/lưu trong kỳ, phiên bản, chủ dự án, dự án mỗi người, lượt mô phỏng/lỗi; biểu đồ dự án mới và lượt mô phỏng; linh kiện dùng nhiều; công khai/lưu trữ |
| Vận hành | Database (theo lần đồng bộ của chính request), chế độ thanh toán, cấu hình AI/email; request/4xx/5xx/p50/p95 của instance; nhật ký theo mức; lỗi gần nhất; chất lượng dữ liệu |

Bộ lọc chung gồm: hôm nay, 7, 30 và 90 ngày, tháng này, tùy chọn ngày; môi trường thanh toán (tất cả / thật / mô phỏng). Có nút làm mới thủ công, không tự gọi API định kỳ. Mỗi KPI có nút ⓘ hiện định nghĩa và mở được trang chi tiết tương ứng. Có trạng thái đang tải (skeleton), lỗi (kèm nút thử lại) và rỗng cho từng biểu đồ. Giờ hiển thị theo `Asia/Ho_Chi_Minh`.

## 7. Biểu đồ

SVG tự viết, không thêm dependency (bundle không đổi thư viện). Biểu đồ đo bề rộng thật của khung để chữ trục luôn 10 px; tooltip theo vị trí chuột. Giá trị `null` (chưa ghi nhận) được vẽ thành khoảng trống, không vẽ thành 0. Mỗi biểu đồ có tiêu đề, mô tả định nghĩa, đơn vị trên trục, chú giải và trạng thái rỗng.

## 8. Công thức & data contract

Xem `docs/ADMIN_ANALYTICS_DATA_AUDIT.md` mục 6 (công thức) và `docs/CONTRACTS.md` mục 7 (kiểu dữ liệu). Nguyên tắc chính:

- Tiền là số nguyên VND.
- Doanh thu thật không bao giờ gồm đơn mô phỏng.
- Đơn đang chờ không tính là doanh thu.
- `null` khác 0.

## 9–10. Kiểm thử đã thêm và kết quả

| Lệnh / kiểm tra | Kết quả |
|---|---|
| `npm run lint` | PASS (sau khi sửa 2 lỗi kiểu trong test mới) |
| `npm run build` | PASS |
| `npm test` (15 bộ) | PASS — verify 18, task 2.1/2.2/2.3, domain 30, linh kiện 55, scene 15, AI chat 11, **admin analytics 33**, bảo mật/thanh toán 56, deploy 41, serverless 51, Vercel output 29 |
| Trình duyệt (server cách ly + Vite proxy, dữ liệu mẫu tạo qua API thật: 4 tài khoản, 4 đơn, 3 dự án, 4 sự kiện) | PASS: 1440×900 tối và sáng, 1280×860, 375×812 |
| — Số trên giao diện khớp API | 4 giao dịch = 4 dòng ở trang Giao dịch; 4 người dùng; 3 dự án; doanh thu thật 0đ, mô phỏng 284.000đ; 1 đơn chờ |
| — Bộ lọc "Chỉ thật" | 0 giao dịch, 0 đơn chờ; banner mô phỏng ẩn |
| — Sidebar | thu gọn/mở rộng, lưu trạng thái, tooltip khi thu gọn, 10 mục đều mở đúng trang |
| — Điện thoại | không tràn ngang (`scrollWidth − clientWidth = 0`); drawer: focus vào mục đầu, Esc đóng, focus trở về nút menu |
| — Console | 0 lỗi |
| Kiểm thử trên production / Vercel thật | NOT RUN |
| Thiết bị di động thật, trình đọc màn hình | NOT RUN |

Chế độ thử: dữ liệu nằm trong thư mục tạm của hệ thống, không có `.env`, Supabase trỏ vào cổng không tồn tại. File cấu hình tạm đã xóa sau khi kiểm tra.

## 11. Ảnh trước / sau

Không lưu file ảnh vào repo. Ảnh "trước" là ảnh tham chiếu người dùng gửi: sidebar danh sách phẳng, 5 thẻ KPI, phân bố gói, bảng giao dịch. Ảnh "sau" được chụp trong lần kiểm tra trên trình duyệt ở mục 9–10; các kích thước đã chụp được liệt kê ở đó.

## 12. Hạn chế còn lại

- Không có churn, MRR hay gia hạn, vì gói thành viên không có hạn dùng.
- Hoạt động và lượt mô phỏng chỉ có từ ngày bật ghi nhận. Retention theo nhóm cần khoảng 30 ngày dữ liệu.
- Bộ đếm request là của từng instance; muốn số liệu toàn hệ thống cần dịch vụ giám sát bên ngoài.
- Các phép kiểm tra chất lượng dữ liệu chưa chạy trên production (đợt này không truy cập production).
- Ảnh tham chiếu (597.000đ mô phỏng) chưa được đối chiếu với từng đơn thật.
- Nghiệp vụ hoàn tiền chưa tự hạ gói và chưa lưu thời điểm hoàn tiền; mới chỉ có phép kiểm tra để phát hiện.

## 13. Đề xuất tiếp theo

1. Quyết định nghiệp vụ gói: hạn dùng, gia hạn, hạ gói khi hoàn tiền. Sau đó bổ sung churn và MRR.
2. Lưu `refundedAt` và `cancelledAt` trên đơn hàng.
3. Gom `activity_days` theo tháng khi dữ liệu lớn.
4. Gửi log và metric sang dịch vụ giám sát (ví dụ Vercel Observability) để có số liệu nhiều instance.
5. Thêm Playwright E2E cho Admin Console.
