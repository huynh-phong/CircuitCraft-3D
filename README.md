# ⚡ CircuitCraft 3D

<div align="center">

![CircuitCraft 3D Banner](https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&h=420&q=80)

**Nền tảng học tập, thiết kế và mô phỏng mạch điện 3D trực quan thế hệ mới với AI Assistant & Minibot đồng hành**

[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-3D_Graphics-black?style=flat-square&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![Gemini](https://img.shields.io/badge/Google_Gemini-AI_Engine-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend_%26_Auth-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

[Tổng quan](#-tổng-quan-dự-án) •
[Bối cảnh & Sứ mệnh](#-bối-cảnh--sứ-mệnh) •
[Tính năng nâng cấp](#-tính-năng-nổi-bật-phiên-bản-mới) •
[Hệ sinh thái AI](#-hệ-sinh-thái-trí-tuệ-nhân-tạo-đa-tầng) •
[Kiến trúc hệ sinh thái](#-hệ-sinh-thái-công-nghệ) •
[Lộ trình phát triển](#-lộ-trình-phát-triển)

</div>

---

## 💡 Tổng quan dự án

**CircuitCraft 3D** là nền tảng mô phỏng điện tử thực tế ảo đột phá, số hóa hoàn toàn trải nghiệm thực hành điện - điện tử trên nền web. Khác biệt với các phần mềm sơ đồ 2D truyền thống (vốn khô khan và khó tiếp cận với người mới bắt đầu), CircuitCraft 3D đưa linh kiện, breadboard và các vi điều khiển vào **không gian 3D tương tác chân thực**, kết hợp cùng trí tuệ nhân tạo **Google Gemini** để biến việc học mạch điện thành trải nghiệm trực quan, thú vị và an toàn.

Ở phiên bản nâng cấp mới nhất, CircuitCraft 3D mang đến bước tiến vượt bậc về **đồ họa 3D thực tế**, **hệ sinh thái Trợ giảng AI đa tầng**, **bộ phân tích giáo trình PowerPoint tự động** và **hệ thống phòng học lý thuyết kết hợp phòng lab thực hành đồng bộ**.

---

## 🎯 Bối cảnh & Sứ mệnh

### Vấn đề thực tế
- **Chi phí & Rủi ro**: Thực hành mạch điện thực tế tiềm ẩn nguy cơ chập cháy linh kiện, chi phí mua sắm bo mạch (Arduino, IC, cảm biến...) tốn kém với học sinh, sinh viên.
- **Rào cản tiếp cận**: Các phần mềm mô phỏng 2D kinh điển (như Proteus, Multisim) đòi hỏi cài đặt phức tạp, giao diện nặng nề và thiếu tính trực quan thực tế (không giống như khi cắm dây trên Breadboard ngoài đời).
- **Thiếu trợ giảng đồng hành**: Khi gặp lỗi không sáng đèn, đoản mạch hay sai chân linh kiện, người học thường mất nhiều giờ loay hoay mà không biết sai ở đâu.

### Giải pháp từ CircuitCraft 3D
- **Thực hành 3D như ngoài đời thực**: Nhìn thấy tận mắt từng chân cắm, màu sắc điện trở, đèn LED phát sáng hay khói cảnh báo khi quá áp.
- **Hệ sinh thái AI trợ giảng 24/7**: Trí tuệ nhân tạo tích hợp sẵn giúp giải thích nguyên lý, tìm lỗi sai, bám sát slide bài giảng và gợi ý thiết kế tối ưu ngay lập tức.
- **Mọi lúc, mọi nơi**: Hoạt động hoàn toàn trên trình duyệt hiện đại, không cần cài đặt phần mềm cồng kềnh.

---

## 🚀 Tính năng nổi bật (Phiên bản mới)

### 1. 🎛️ Không gian thiết kế 3D chân thực (3D Virtual Workbench)
- **Tích hợp Mô hình 3D Chuẩn Thực tế (.GLB)**: Nạp trực tiếp các mô hình 3D thực tế chi tiết cao của **Arduino Uno R3** và **Breadboard 830 lỗ tiêu chuẩn**, tích hợp thuật toán tự động căn chỉnh tọa độ, tỷ lệ và chân cắm phẳng tuyệt đối tại mặt phẳng $Y=0$.
- **Bộ sưu tập Procedural Components phong phú**: Tạo hình bằng toán học hình học cho hơn 15 linh kiện: Điện trở (vạch màu quốc tế), Tụ điện, Transistor, Diode, LED, IC số (DIP-8, DIP-14, NE555), Nguồn DC, Công tắc SPST, Biến trở, Cảm biến ánh sáng LDR, Cảm biến nhiệt LM35, Rơ-le, Còi Buzzer...
- **Dây nối tự nhiên (Dynamic Bezier Wires)**: Hệ thống nối dây từ chân đến chân (Pin-to-Pin) với thuật toán tính toán độ cong vật lý mềm mại như dây điện ngoài đời thực cùng hiệu ứng phát sáng khi có dòng điện.
- **Góc nhìn tương tác 360° & Hít chân cắm (Pin Snapping)**: Tự động hít chân linh kiện vào đúng hàng và cột trên Breadboard với độ chính xác cơ học cao.
- **Hệ thống Command Undo/Redo**: Quản lý lịch sử thao tác thông minh theo mô hình Command Pattern, cho phép hoàn tác/làm lại không giới hạn mà không làm mất trạng thái mạch.

### 2. ⚡ Động cơ mô phỏng & Kiểm tra luật thiết kế (Simulation & DRC)
- **Tính toán điện trường tức thời**: Đo lường dòng điện, điện áp và phân tích mạch kín/mở theo thời gian thực dựa trên đồ thị nút mạch.
- **Bảo vệ & Cảnh báo an toàn**: Tự động phát hiện đoản mạch (short circuit), linh kiện ngược cực, quá dòng hoặc quá công suất định mức với hiệu ứng cảnh báo trực quan trên mô hình 3D.
- **Đồng hồ đo ảo**: Hỗ trợ đo đạc thông số điện áp và dòng điện tại bất kỳ vị trí chân cắm nào trên mạch.

### 3. 📚 Phòng Học Lý thuyết & Phòng Thí nghiệm Thực hành Kép
- **Phòng học Lý thuyết Tương tác (Theory Classroom)**:
  - Trình chiếu slide bài giảng chất lượng cao, hỗ trợ chuyển đổi linh hoạt giữa Slide giáo trình và Video hướng dẫn.
  - Tích hợp **Trợ giảng AI (Theory Tutor)** bám sát theo từng Slide đang hiển thị để giải thích công thức, định luật và liên hệ thực tế.
- **Phòng Thí nghiệm Thực hành (Practice Lab)**:
  - Bàn thực hành 3D kết hợp bộ **Checklist nhiệm vụ tự động**.
  - Động cơ chấm điểm tự động kiểm tra xem học viên đã cắm đúng dây, đúng chân và bật nguồn thành công hay chưa, kích hoạt hiệu ứng chúc mừng khi hoàn thành bài lab.
- **Bộ đọc Giáo trình PowerPoint (.PPTX) Tự động**:
  - Tự động giải nén và phân tích cấu trúc bài giảng PowerPoint `.pptx`, trích xuất slide, nội dung, ghi chú và hình ảnh.
  - Tự động nhận diện ngữ nghĩa để sinh ra bộ checklist nhiệm vụ và khung dự án mạch thực hành tương ứng.

### 4. 🛒 Sàn Giao dịch (Marketplace) & Bảng điều khiển Tác giả (Creator Studio)
- **Marketplace Mạch 3D**: Khám phá, tải về và trải nghiệm các thiết kế mạch điện từ cộng đồng; hỗ trợ chế độ xem trước 3D xoay 360 độ trước khi tải.
- **Creator Studio**: Dành cho giảng viên và kỹ sư thiết kế đăng tải giáo trình, xuất bản khóa học, quản lý các phiên bản (Version Control) và theo dõi doanh thu.

### 5. 🌐 Giao diện Landing Page Thế hệ mới
- Thiết kế 12 phân khúc hiện đại: Hero Section, Interactive Simulation Mini, Workspace Showcase, Why CircuitCraft, AI Companion, Courses Showcase, Marketplace Showcase, Personas, How It Works, FAQ, Final CTA và Footer Section.
- Tích hợp hiệu ứng chuyển trang mượt mà (Page Transitions) và chuẩn thẩm mỹ cao cấp.

### 6. 🧭 Hệ thống Điều hướng Hợp nhất (Unified Routing Engine)
- Đồng bộ hai chiều giữa URL trình duyệt và trạng thái ứng dụng qua HTML5 History API.
- Hỗ trợ đầy đủ Deep Linking, phím F5 làm mới trang, nút Back/Forward của trình duyệt và đường dẫn thân thiện (VD: `/courses`, `/editor?id=...`, `/my-courses`, `/theory-learning`).

### 7. 🛡️ Bảo mật Đa kênh & Cổng Thanh toán VietQR
- Đăng nhập linh hoạt: Email/Password, Mã xác thực OTP 6 số qua Email (tích hợp chuẩn **Brevo HTTPS API** và Nodemailer SMTP) hoặc SMS.
- Phân quyền người dùng 3 cấp: Học viên (User), Giảng viên (Creator) và Quản trị viên (Admin).
- Tạo mã **VietQR** động cho đơn hàng gói thành viên (Free, Student, Creator Pro), khóa học và sản phẩm. Xác nhận thanh toán hiện là **Thanh toán mô phỏng (Mock Payment)** dùng để kiểm thử luồng cấp quyền — chưa tích hợp xác nhận ngân hàng tự động (xem `docs/CONTRACTS.md`).

---

## 🤖 Hệ sinh thái Trí tuệ Nhân tạo Đa tầng

Dự án tích hợp bộ ba trợ lý AI chuyên biệt được tối ưu hóa theo từng ngữ cảnh sử dụng:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              CIRCUIT_CRAFT 3D AI ECOSYSTEM                             │
├──────────────────────────┬─────────────────────────────┬───────────────────────────────┤
│   AI CIRCUIT ASSISTANT   │      MINIBOT COMPANION      │       THEORY TUTOR AI         │
│  (Không gian thiết kế)   │     (Robot 3D đồng hành)    │    (Phòng học lý thuyết)      │
├──────────────────────────┼─────────────────────────────┼───────────────────────────────┤
│ • Đọc trạng thái mạch    │ • Phản ứng cảm xúc 3D       │ • Nhận biết số Slide hiện tại │
│ • Tìm lỗi đoản mạch/cháy │ • Vui mừng khi mạch chạy    │ • Đọc toàn bộ nội dung PPTX   │
│ • Sinh đề xuất lắp linh  │ • Hoảng hốt khi có chập     │ • Giảng giải lý thuyết, công  │
│   kiện tự động vào bảng  │ • Trò chuyện giải trí Maker │   thức sư phạm chi tiết       │
├──────────────────────────┴─────────────────────────────┴───────────────────────────────┤
│                              SUPPORT HELPDESK AI CHATBOT                               │
│  • Thường trực góc màn hình, tư vấn lộ trình học, giải đáp thanh toán, điều hướng URL  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Hệ sinh thái công nghệ

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          CIRCUIT_CRAFT 3D ARCHITECTURE                 │
├───────────────────────────────────┬────────────────────────────────────┤
│         GIAO DIỆN & ĐỒ HỌA        │         ĐỘNG CƠ XỬ LÝ & AI         │
│  • React 19 (Modern UI)           │  • Three.js Scene Engine           │
│  • Tailwind CSS v4 (Glassmorphism)│  • Simulation & DRC Engine         │
│  • Motion / Lucide Icons          │  • Google Gemini Generative AI SDK │
│  • GLTF / GLB Real-World Loader   │  • JSZip PowerPoint PPTX Parser    │
├───────────────────────────────────┼────────────────────────────────────┤
│          NỀN TẢNG SERVER          │       DỮ LIỆU & BẢO MẬT            │
│  • Express API Gateway (Node.js)  │  • Supabase (PostgreSQL / RLS)     │
│  • esbuild Production CJS Bundle  │  • Brevo HTTPS REST Mail API       │
│  • Dynamic PORT Binding Engine    │  • VietQR Napas 24/7 Gateway       │
└───────────────────────────────────┴────────────────────────────────────┘
```

---

## 👥 Đối tượng hướng đến

- **Học sinh, Sinh viên**: Tiếp cận các môn Vật lý, Kỹ thuật điện, Điện tử viễn thông và STEM một cách trực quan, không sợ chập cháy hư hỏng thiết bị.
- **Giảng viên & Giáo viên STEM**: Công cụ giảng dạy trực quan trên máy chiếu hoặc học trực tuyến, tạo bài tập thực hành sinh động cho học sinh.
- **Kỹ sư Maker & Người yêu thích IoT/DIY**: Phác thảo nhanh ý tưởng mạch, kiểm tra tính đúng đắn trước khi đặt mua linh kiện hoặc hàn mạch thực tế.

---

## 🗺️ Lộ trình phát triển (Roadmap)

- [x] Không gian thực hành 3D với Breadboard và bộ linh kiện cơ bản
- [x] Động cơ mô phỏng điện học thời gian thực & kiểm tra đoản mạch
- [x] Tích hợp AI Assistant với Google Gemini và Minibot 3D
- [x] Tích hợp mô hình 3D thực tế định dạng `.glb` (Arduino Uno, Breadboard)
- [x] Phòng học lý thuyết đồng bộ slide và Trợ giảng AI riêng biệt
- [x] Bộ phân tích tự động giáo án PowerPoint `.pptx` thành bài thực hành
- [x] Hệ thống điều hướng hợp nhất Unified Routing Engine (deep links, history API)
- [x] Hỗ trợ gửi mail OTP qua Brevo HTTPS API chuẩn cloud hosting
- [x] Marketplace & Creator Dashboard chia sẻ dự án
- [ ] Bổ sung mô phỏng nạp code C++ trực tiếp cho Arduino ảo và quan sát thực thi
- [ ] Xuất sơ đồ mạch ra định dạng Gerber / PCB Layout và Schematic 2D tiêu chuẩn
- [ ] Hỗ trợ chế độ cộng tác thời gian thực nhiều người cùng lắp ráp mạch (Real-time Multiplayer)
- [ ] Mở rộng không gian thực tế ảo VR/AR (WebXR)

---

## 📄 Bản quyền (License)

Dự án được phát hành dưới giấy phép mã nguồn mở **MIT License**. Mọi chi tiết xem tại file [LICENSE](LICENSE).

---

<div align="center">

**CircuitCraft 3D** — *Nâng tầm trải nghiệm học tập và sáng tạo điện tử.*

Designed & Developed with passion by **huynh-phong**

</div>
