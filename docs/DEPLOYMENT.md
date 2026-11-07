# Triển khai CircuitCraft 3D lên Vercel + Supabase

## Kiến trúc khi chạy online

| Phần | Chạy ở đâu | Ghi chú |
|---|---|---|
| Giao diện React/Vite, Three.js, model GLB | CDN của Vercel (file tĩnh build sẵn) | Không build lại khi có người truy cập; chỉ build khi deploy code mới |
| API Express (`/api/*`) | Một Vercel Function (`src/server/app.ts`) | Có thể khởi động lạnh (cold start) sau một thời gian không dùng; không dùng cron/ping để giữ thức |
| Dữ liệu (tài khoản, dự án, khóa học, đơn hàng, quyền...) | Supabase Postgres, bảng `cc_documents` | Function không ghi gì xuống đĩa |
| OTP, giới hạn tần suất, thu hồi phiên | Supabase (hàm SQL nguyên tử) | Mọi instance thấy cùng một trạng thái |
| Ảnh slide, video bài học | Supabase Storage, bucket riêng tư `course-media`, `course-video` | Truy cập bằng liên kết ký có hạn |

`npm run build:vercel` (được `vercel.json` gọi) tạo `.vercel/output` theo Build Output API v3:
`static/` cho CDN, `functions/api/index.func/` cho API, `config.json` cho định tuyến
(`/api/*` vào Function trước, file tĩnh, rồi mọi đường dẫn khác trả `index.html` để F5 deep link hoạt động).
Lệnh build không đọc `data/`, không kết nối Supabase và không chạy migration.

## Ai làm gì

| Việc | Ai làm |
|---|---|
| Sửa code, build, test cục bộ, script di trú, tài liệu | Đã làm trong repository |
| Tạo project Vercel, kết nối GitHub, nhập biến môi trường | **Chủ dự án** (cần đăng nhập Vercel) |
| Sao lưu Supabase, chạy migration SQL, chạy script chép dữ liệu | **Chủ dự án** (cần quyền Supabase) |
| Kiểm thử trên URL Preview/Production | **Chủ dự án**, theo mục 10 và 12 |

## Các bước

Làm toàn bộ trên một project Supabase **staging** trước. Chỉ lặp lại trên production khi staging đã đạt.

### 1. Tạo Vercel Project
Vercel Dashboard → **Add New… → Project**.

### 2. Kết nối GitHub repository
Chọn **Import Git Repository** → `huynh-phong/CircuitCraft-3D`. Mỗi commit lên nhánh khác `main` tạo một bản Preview, còn `main` là Production.
Code của đợt này **chưa được commit**: cần commit và push trước khi Vercel nhìn thấy.

### 3. Framework / Build Settings
Để nguyên giá trị đọc từ `vercel.json`: Framework Preset **Other**, Build Command `npm run build:vercel`.
Không đặt Output Directory, vì build tự tạo `.vercel/output`. Node.js Version: 22.x.

### 4. Biến môi trường
Settings → Environment Variables. Đặt riêng cho **Preview** (trỏ tới Supabase staging) và **Production**.

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `SUPABASE_URL` | Có | URL project Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Có | Chỉ dùng ở server. Tuyệt đối không tạo bản `VITE_*` |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Có | Gửi tới trình duyệt, chỉ dùng khóa **anon**. Đổi giá trị thì phải build lại |
| `SESSION_SECRET` | Có | ≥ 32 ký tự ngẫu nhiên (`openssl rand -base64 48`). Giữ cố định; đổi là mọi người bị đăng xuất |
| `ADMIN_EMAIL` | Có | Email quản trị |
| `PAYMENT_MODE` | Có | `mock` để giữ thanh toán mô phỏng. Không đặt thì Vercel (production) dùng chế độ thật và khóa mock |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` | Cho OTP email | Gửi qua HTTPS. Cổng SMTP có thể bị chặn trên serverless |
| `GEMINI_API_KEY` | Cho AI | Không có thì chatbot/Trợ giảng trả lời cục bộ, có ghi rõ |
| `VERCEL_FUNCTION_REGION` | Không | Mặc định `sin1`. Chọn vùng gần project Supabase nhất (xem Supabase → Settings → General) |
| `PAYMENT_ACCOUNT_NAME/NUMBER`, `PAYMENT_BANK_NAME/ID` | Không | Thông tin chuyển khoản và mã QR hiện trong hộp thanh toán (cả demo). Chế độ thật bắt buộc có `PAYMENT_ACCOUNT_NUMBER` |

Không đặt `ENABLE_DEV_OTP_PREVIEW` và `PERSISTENCE_BACKEND` trên Vercel (Vercel luôn dùng Supabase).
Thiếu biến bắt buộc thì API trả `503 SERVER_NOT_CONFIGURED`, còn `/api/health` liệt kê **tên** các biến còn thiếu.

### 5. Chuẩn bị Supabase
Cần project Supabase (staging, rồi production) đã bật Storage. Ghi lại region của project để đặt `VERCEL_FUNCTION_REGION`.

### 6. Sao lưu dữ liệu cũ
- Supabase → Database → Backups: kiểm tra có bản sao lưu mới, hoặc chạy `pg_dump`.
- Sao chép thư mục `data/` của máy đang chạy hiện tại ra nơi an toàn.

### 7. Chạy migration an toàn
SQL Editor, đúng thứ tự, mỗi file một lần:
1. `20260914000000_create_circuitcraft_schema.sql`, `20260914000001_user_data_isolation_and_courses.sql`, `20260914000002_minibot_chat_isolation.sql` (nếu project chưa có).
2. `20261101000000_security_hardening.sql`
3. `20261105000000_serverless_persistence.sql`: chỉ **thêm** bảng/hàm mới, không đụng bảng cũ. Lệnh rollback nằm ở phần đầu file.

Sau đó chép dữ liệu bằng script (đặt `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` của **đúng** project trong terminal):
```bash
npm run migrate:supabase -- --include-supabase-tables --compare
```
`--include-supabase-tables` chép thêm dữ liệu mà phiên bản cũ đã lưu trong các bảng Supabase: `profiles`, `subscriptions`, `entitlements`, `orders`, `course_enrollments`, `lesson_progress`. Các bảng cũ chỉ được đọc, không bị sửa. Tài khoản trùng email với `data/*.json` giữ bản trong file. Quyền và gói lấy từ bảng cũ được đánh dấu là mô phỏng (trước đây chưa từng có thanh toán thật). Tài khoản cũ đăng nhập bằng mật khẩu Supabase Auth hoặc bằng OTP như trước.
Lệnh này chỉ đọc. Kiểm tra số bản ghi theo nhóm, lỗi và cảnh báo. Khi đã đúng thì chạy:
```bash
npm run migrate:supabase -- --include-supabase-tables --apply
```
Script:
- sao lưu `data/` vào `.backups/migrate-*`;
- chỉ thêm bản ghi còn thiếu, giữ nguyên ID, chủ sở hữu, đơn hàng, quyền và lịch sử;
- chuyển ảnh nhúng sang Storage;
- đọc lại toàn bộ để đối chiếu, rồi ghi `report.json`.

Kết quả phải là `VERIFIED`. Nếu là `DIFFERENCES_FOUND`, database đã có bản ghi cùng mã nhưng khác nội dung: script không ghi đè, hãy xem `differentFromSource`. Chạy lại nhiều lần vẫn an toàn.
**Chép dữ liệu xong rồi mới deploy**: instance đầu tiên gặp database rỗng sẽ tạo hồ sơ Creator mặc định.

### 8. Cấu hình Supabase Storage
Migration đã tạo bucket `course-media` (ảnh, 1,5 MB/tệp) và `course-video` (MP4/WebM, 50 MB/tệp), cả hai **riêng tư**.
Kiểm tra trong Storage rằng hai bucket tồn tại và không bật Public. Không cần thêm policy, vì chỉ server dùng khóa service role.

### 9. Deploy Vercel Preview
Push một nhánh (không phải `main`) hoặc bấm **Deploy** trong Vercel. Theo dõi Build Logs: phải thấy `Build output ready in .vercel/output`.

### 10. Kiểm thử Preview
Ghi kết quả vào `docs/PROGRESS.md`:
- `/api/health` trả `status: "ok"`, `persistence: "remote"`, `database: "ok"`, `missingSettings: []`.
- `/api/khong-ton-tai` trả JSON 404, không phải trang HTML.
- Mở trực tiếp rồi F5: `/projects`, `/editor?id=...`, `/courses`, `/my-courses`, `/theory-learning`, `/marketplace`, `/membership`, `/creator`, `/admin`.
- Workspace 3D: model Arduino/breadboard hiện, nối dây, mô phỏng, DRC, Undo/Redo, Minibot.
- Đăng ký bằng OTP email thật, đăng xuất, đăng nhập lại; mở dự án trên trình duyệt khác; "Đăng xuất mọi thiết bị".
- Tài khoản, đơn hàng và quyền đã di trú hiển thị đúng.
- Mua mô phỏng: gói Student, Creator Pro, một khóa học, một sản phẩm. Hộp thanh toán hiện QR và thông tin chuyển khoản; bấm "Thanh toán thành công (Demo)" là mở được nội dung ngay. Tài khoản khác chưa mua phải bị từ chối.
- Creator: tạo khóa có PPTX (và một video MP4 ≤ 50 MB); học viên đã mua thấy ảnh và video; Trợ giảng trả lời.
- Admin: vào được bằng `ADMIN_EMAIL`; tài khoản thường bị 403.
- Kiểm tra định tuyến sau rewrite: mọi API ở trên hoạt động (Function nhận đường dẫn gốc qua tham số `__path`).

### 11. Deploy Production
Lặp lại bước 6-8 trên project Supabase production, đặt biến môi trường Production, rồi merge vào `main`.

### 12. Kiểm tra URL thật
Mở URL production (`*.vercel.app` hoặc tên miền riêng) và lặp lại mục 10. Hạn chế tạo giao dịch thử không cần thiết.

### 13. Kiểm tra API, OTP, AI, Marketplace, Mock Payment và dữ liệu
- Supabase → Table Editor → `cc_documents`: số dòng theo `collection` khớp `report.json`.
- Vercel → Logs: không có `[Config] Missing`, `[Persistence]` hay lỗi 5xx lặp lại.
- Gửi OTP thật tới một email, mở chatbot AI, mua mô phỏng một sản phẩm rồi mở thiết kế.

## Khắc phục sự cố: không đăng nhập, không đăng ký được
Mở `https://<tên-miền>/api/health` và đọc các trường:

| Kết quả | Nguyên nhân | Cách sửa |
|---|---|---|
| `missingSettings` có tên biến | Thiếu biến môi trường trên Vercel | Thêm biến (bước 4), rồi **Redeploy** |
| `database: "not_migrated"` (API trả `DATABASE_NOT_MIGRATED`) | Chưa chạy `20261105000000_serverless_persistence.sql` trên đúng project | Chạy migration (bước 7). Không cần deploy lại |
| `database: "unreachable"` | Sai `SUPABASE_URL` hoặc sai khóa, hoặc project bị tạm dừng | Kiểm tra biến; khôi phục project trên Supabase |
| Mọi thứ `ok` nhưng tài khoản cũ báo "chưa đăng ký" hoặc mất quyền | Chưa chép dữ liệu | Chạy script với `--include-supabase-tables --apply` (bước 7) |
| Không nhận được email OTP | Chưa có `BREVO_API_KEY`/`BREVO_SENDER_EMAIL`, hoặc email gửi chưa được xác minh trên Brevo | Đặt biến, xác minh sender trên Brevo, Redeploy |
| Đăng nhập bằng mật khẩu thất bại với tài khoản cũ | Thiếu `VITE_SUPABASE_ANON_KEY` ở runtime | Đặt biến cho cả Production và Preview, Redeploy |

## Rollback
- Code: Vercel → Deployments → **Promote** bản trước.
- Dữ liệu: khôi phục bản sao lưu của bước 6. Migration `20261105000000` chỉ thêm đối tượng mới; lệnh xóa nằm trong phần đầu file, chỉ chạy sau khi đã xuất `cc_documents`.

## Giới hạn đã biết
- **Khởi động lạnh:** giao diện đến từ CDN ngay. Request API đầu tiên của một instance mới phải chờ khởi động và đọc toàn bộ `cc_documents`. Chưa đo thực tế trên Vercel.
- **Mô hình dữ liệu:** phù hợp quy mô hiện tại. Khi dữ liệu lớn, thời gian khởi động lạnh tăng, nên tách bảng theo chức năng.
- **Ghi đồng thời:** dự án sửa cùng lúc ở hai nơi thì bên sau nhận `409 PROJECT_CONFLICT`, không bị ghi đè. Bản ghi khác được gộp theo từng trường cấp cao nhất; cùng một trường thì lần ghi sau thắng.
- **Xóa dự án:** dự án đã xóa trên thiết bị A có thể vẫn còn trong bộ nhớ trình duyệt của thiết bị B, và sẽ được lưu lại nếu B tiếp tục sửa nó.
- **Vercel:** body tối đa 4,5 MB (API giới hạn 4 MB để trả lỗi JSON rõ ràng). Gói Hobby chỉ dùng phi thương mại: thu tiền thật cần gói Pro.
- **Supabase Free:** tệp tối đa 50 MB; project có thể bị tạm dừng khi lâu không dùng.
- **Thanh toán thật:** chưa có webhook ngân hàng, Admin xác nhận thủ công. Khi chuyển sang chế độ thật, quyền và gói có từ mô phỏng hết hiệu lực.
- **Chạy local:** `npm run dev` dùng `data/*.json`, trừ khi đặt `PERSISTENCE_BACKEND=supabase`. Chỉ đặt giá trị này với project test.
- **Kiểm chứng:** `vercel build` chưa chạy được trên máy phát triển (Windows chặn tạo symlink khi chưa bật Developer Mode). Build thật sẽ chạy trên Vercel ở bước 9.
