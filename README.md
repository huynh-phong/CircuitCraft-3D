# ⚡ CircuitCraft 3D

<div align="center">

![CircuitCraft 3D Banner](https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&h=420&q=80)

**Nền tảng học tập, thiết kế và mô phỏng mạch điện 3D trực quan với AI Assistant & Minibot đồng hành**

[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r186-black?style=flat-square&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![Gemini](https://img.shields.io/badge/Google_Gemini-AI-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Database_%26_Auth-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

[Tính năng](#-tính-năng-nổi-bật) •
[Công nghệ](#-công-nghệ-sử-dụng) •
[Cài đặt](#-cài-đặt-và-chạy-local) •
[Biến môi trường](#-cấu-hình-biến-môi-trường-env) •
[Cấu trúc dự án](#-cấu-trúc-thư-mục) •
[Đóng góp](#-đóng-góp)

</div>

---

## 📖 Giới thiệu

**CircuitCraft 3D** là ứng dụng web toàn diện kết hợp công nghệ đồ họa không gian 3D, mô phỏng kỹ thuật điện tử và trí tuệ nhân tạo (Generative AI). Nền tảng cung cấp không gian tương tác trực quan cho sinh viên, kỹ sư và người yêu thích điện tử có thể:

- Lắp ráp linh kiện thực tế trên breadboard trong môi trường 3D chân thực.
- Kiểm tra tính đúng đắn mạch điện theo thời gian thực (Rule Checking & Simulation).
- Nhận phân tích, hỗ trợ và đề xuất thiết kế mạch từ trợ lý AI cùng robot Minibot 3D tương tác.
- Học tập theo lộ trình từ cơ bản đến nâng cao và tham gia sàn giao dịch thiết kế (Marketplace).

---

## 🚀 Tính năng nổi bật

### 1. 🎛️ Không gian thiết kế mạch 3D tương tác (Three.js Canvas)
- **Mô hình Procedural 3D phong phú**: Breadboard tiêu chuẩn, Arduino/vi điều khiển, điện trở, tụ điện, transistor, diode, LED, IC, nguồn điện, nút nhấn, còi buzzer...
- **Hệ thống dây dẫn linh hoạt**: Đi dây tự do giữa các chân linh kiện (pin-to-pin wiring) với thuật toán tính toán độ uốn cong tự nhiên (bezier curve).
- **Điều khiển góc nhìn tự do**: Orbit controls 360°, zoom, pan, focus linh kiện và chế độ trình diễn (Presentation Mode).
- **Engine Command & Lịch sử thao tác**: Hỗ trợ đầy đủ **Undo / Redo**, nhân bản linh kiện, snapshot trạng thái không phá hủy dữ liệu.

### 2. ⚡ Bộ mô phỏng & Kiểm tra luật thiết kế (Simulation & DRC Engine)
- Tính toán dòng điện, điện áp và phân tích mạch kín/mở.
- Phát hiện đoản mạch (short circuit), linh kiện thiếu nguồn hoặc quá áp tức thời.
- Cảnh báo trực quan trên mô hình 3D và bảng điều khiển chi tiết.

### 3. 🤖 AI Assistant & Chú Minibot 3D đồng hành
- Tích hợp **Google Gemini AI SDK** xử lý ngôn ngữ tự nhiên và phân tích mạch.
- Đề xuất sơ đồ nguyên lý, tính toán giá trị linh kiện phù hợp với yêu cầu người dùng.
- **Minibot 3D tương tác**: Biểu cảm động, cử chỉ phản hồi theo trạng thái mạch và trò chuyện giải đáp thắc mắc kỹ thuật.

### 4. 📚 Học tập & Lộ trình thực hành (Courses & Interactive Lessons)
- Hệ thống bài học từ cơ bản (Định luật Ohm, LED căn bản) đến nâng cao (vi điều khiển, cảm biến).
- Hướng dẫn thực hành từng bước (step-by-step guidance) kèm bộ kiểm tra hoàn thành bài tập tự động.

### 5. 🛒 Marketplace & Creator Studio
- Khám phá, tải về và trải nghiệm các dự án mạch điện được chia sẻ bởi cộng đồng.
- Bảng điều khiển dành riêng cho Creator: Đăng tải sản phẩm, quản lý phiên bản, kiểm duyệt nội dung và xem thống kê doanh thu.

### 6. 🛡️ Quản trị hệ thống & Xác thực đa kênh (Admin & Multi-auth)
- Hỗ trợ đăng nhập linh hoạt: Email & Password, Mã xác thực OTP qua Email (Nodemailer) / SMS (Twilio), tích hợp Supabase Auth.
- Bảng điều khiển Quản trị viên (Admin Dashboard): Quản lý người dùng, phân quyền (User / Creator / Admin), theo dõi doanh thu và trạng thái đơn hàng.
- Nâng cấp gói thành viên (Free / Pro / Enterprise) cùng cơ chế quét mã thanh toán VietQR tiện lợi.

---

## 🛠️ Công nghệ sử dụng

| Lớp (Layer) | Công nghệ |
| :--- | :--- |
| **Frontend Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Build Tool & Bundler** | [Vite 6](https://vitejs.dev/) |
| **Đồ họa 3D** | [Three.js](https://threejs.org/) (@types/three) |
| **Giao diện & Styling** | [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/), [Motion](https://motion.dev/) |
| **Backend & API Server** | [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/) (chạy qua `tsx` / `esbuild`) |
| **Trí tuệ nhân tạo (AI)** | [Google Gen AI SDK](https://github.com/google-gemini/generative-ai-js) (`@google/genai`) |
| **Cơ sở dữ liệu & Auth** | [Supabase](https://supabase.com/) (PostgreSQL + RLS + Realtime) |
| **Dịch vụ Email / SMS** | [Nodemailer](https://nodemailer.com/), Twilio API |

---

## 📂 Cấu trúc thư mục

```text
circuitcraft-3d/
├── data/                  # Dữ liệu cục bộ, catalog sản phẩm & cấu hình mẫu
├── public/                # Tài nguyên tĩnh (favicon, textures, fonts)
├── src/
│   ├── ai/                # Dịch vụ tích hợp Gemini AI & Minibot chat
│   ├── billing/           # Xử lý hóa đơn, gói thành viên & thanh toán
│   ├── components/        # UI components (Canvas 3D, Toolbar, Auth, Modals...)
│   │   ├── auth/          # Component form đăng ký/đăng nhập & OTP
│   │   ├── canvas3d/      # Renderer, viewport & công cụ tương tác 3D
│   │   ├── creator/       # Giao diện quản lý nội dung của Creator
│   │   └── ui/            # UI kit cơ sở (Buttons, Inputs, Dialogs...)
│   ├── domain/            # Models, logic nghiệp vụ & validation
│   ├── engine/            # Động cơ mô phỏng điện, DRC & command history
│   ├── pages/             # Trang ứng dụng (Landing, Projects, Marketplace, Admin...)
│   ├── scene/             # Tạo hình procedural linh kiện 3D, vật liệu & dây nối
│   ├── server/            # Services xử lý phía server (OTP, User store, Store sync)
│   ├── App.tsx            # Main Application Root
│   └── main.tsx           # Client entry point
├── supabase/              # Schema migration & cấu hình cơ sở dữ liệu Supabase
├── server.ts              # Express API Server tích hợp Vite middleware
├── package.json           # Danh sách dependencies & NPM scripts
├── tsconfig.json          # Cấu hình TypeScript
└── vite.config.ts         # Cấu hình Vite & Tailwind v4
```

---

## 💻 Cài đặt và chạy Local

### Yêu cầu tiên quyết
- **Node.js**: Phiên bản `>= 20.x` (khuyến nghị Node 22+)
- **NPM** hoặc **Bun** (dự án hỗ trợ cả hai)
- Khóa API **Google Gemini** ([Lấy khóa tại Google AI Studio](https://aistudio.google.com/))

### 1. Clone repository về máy

```bash
git clone https://github.com/huynh-phong/CircuitCraft-3D.git
cd CircuitCraft-3D
```

### 2. Cài đặt các thư viện phụ thuộc

Sử dụng `npm`:
```bash
npm install
```

*Hoặc nếu bạn ưu tiên dùng `bun`:*
```bash
bun install
```

### 3. Cấu hình biến môi trường

Sao chép file cấu hình mẫu:
```bash
cp .env.example .env
```

Mở file `.env` và điền các thông tin cần thiết (xem chi tiết mục [Biến môi trường](#-cấu-hình-biến-môi-trường-env)).

### 4. Khởi chạy môi trường phát triển (Development)

```bash
npm run dev
```

Server sẽ khởi động tại:
👉 **`http://localhost:3000`**

---

## ⚙️ Cấu hình biến môi trường (.env)

| Biến | Bắt buộc | Mô tả |
| :--- | :---: | :--- |
| `GEMINI_API_KEY` | **Có** | API Key từ Google AI Studio để kích hoạt AI Assistant & Minibot |
| `VITE_SUPABASE_URL` | Tùy chọn | URL của dự án Supabase (nếu kết nối cloud database) |
| `VITE_SUPABASE_ANON_KEY` | Tùy chọn | Khóa Public Anonymous của Supabase |
| `SUPABASE_SERVICE_ROLE_KEY`| Tùy chọn | Khóa Service Role quản trị của Supabase |
| `ADMIN_EMAIL` | Tùy chọn | Email tài khoản quản trị hệ thống mặc định |
| `SMTP_HOST` | Tùy chọn | Máy chủ gửi thư SMTP (VD: `smtp.gmail.com`) |
| `SMTP_PORT` | Tùy chọn | Cổng kết nối SMTP (thường là `587` hoặc `465`) |
| `SMTP_USER` | Tùy chọn | Tài khoản email gửi thư |
| `SMTP_PASS` | Tùy chọn | Mật khẩu ứng dụng (App Password) cho email |
| `SMTP_FROM` | Tùy chọn | Tên người gửi hiển thị (VD: `"CircuitCraft 3D <no-reply@domain.com>"`) |
| `TWILIO_ACCOUNT_SID` | Tùy chọn | SID tài khoản Twilio (nếu sử dụng tính năng gửi SMS OTP) |
| `TWILIO_AUTH_TOKEN` | Tùy chọn | Auth Token dịch vụ Twilio |
| `TWILIO_PHONE_NUMBER` | Tùy chọn | Số điện thoại gửi SMS từ Twilio |

---

## 📜 Các lệnh thao tác (Scripts)

| Lệnh | Công dụng |
| :--- | :--- |
| `npm run dev` | Khởi chạy server phát triển Express + Vite tại cổng `3000` |
| `npm run build` | Build tối ưu giao diện với Vite và đóng gói server thành `dist/server.cjs` |
| `npm start` | Chạy production server từ gói đã build (`node dist/server.cjs`) |
| `npm run lint` | Chạy kiểm tra kiểu tĩnh TypeScript (`tsc --noEmit`) |
| `npm run clean` | Xóa thư mục build `dist/` |

---

## 🚢 Hướng dẫn Build & Deploy Production

1. Chạy lệnh build:
   ```bash
   npm run build
   ```
2. Khởi chạy ứng dụng ở chế độ production:
   ```bash
   npm start
   ```
3. Ứng dụng đã sẵn sàng để deploy lên các nền tảng như **Render**, **Railway**, **Fly.io**, **VPS (Ubuntu + PM2)** hoặc **Docker container**.

---

## 🤝 Đóng góp (Contributing)

Đóng góp luôn được hoan nghênh! Mọi cải tiến, sửa lỗi hoặc tính năng mới vui lòng thực hiện theo các bước:

1. **Fork** repository này về tài khoản của bạn.
2. Tạo nhánh tính năng mới:
   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. Commit các thay đổi:
   ```bash
   git commit -m "feat: Add AmazingFeature"
   ```
4. Đẩy lên remote branch:
   ```bash
   git push origin feature/AmazingFeature
   ```
5. Mở một **Pull Request** trên GitHub.

---

## 📄 Giấy phép (License)

Dự án được phân phối dưới giấy phép **MIT License**. Chi tiết xem tại file [LICENSE](LICENSE).

---

<div align="center">
Made with ❤️ by <b>CircuitCraft 3D Team</b>
</div>
