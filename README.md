# ⚡ CircuitCraft 3D

<div align="center">

![CircuitCraft 3D Banner](https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&h=420&q=80)

**Nền tảng học tập, thiết kế và mô phỏng mạch điện 3D trực quan thế hệ mới với AI Assistant & Minibot đồng hành**

[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-3D_Graphics-black?style=flat-square&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-Modern_Web-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Gemini](https://img.shields.io/badge/Google_Gemini-AI_Engine-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

[Tổng quan](#-tổng-quan-dự-án) •
[Bối cảnh & Sứ mệnh](#-bối-cảnh--sứ-mệnh) •
[Tính năng cốt lõi](#-tính-năng-cốt-lõi) •
[Hệ sinh thái công nghệ](#-hệ-sinh-thái-công-nghệ) •
[Đối tượng sử dụng](#-đối-tượng-hướng-đến) •
[Lộ trình phát triển](#-lộ-trình-phát-triển)

</div>

---

## 💡 Tổng quan dự án

**CircuitCraft 3D** là nền tảng mô phỏng điện tử thực tế ảo đột phá, số hóa hoàn toàn trải nghiệm thực hành điện - điện tử trên nền web. Khác biệt với các phần mềm sơ đồ 2D truyền thống (vốn khô khan và khó tiếp cận với người mới bắt đầu), CircuitCraft 3D đưa linh kiện, breadboard và các vi điều khiển vào **không gian 3D tương tác chân thực**, kết hợp cùng trí tuệ nhân tạo **Google Gemini** để biến việc học mạch điện thành trải nghiệm trực quan, thú vị và an toàn.

---

## 🎯 Bối cảnh & Sứ mệnh

### Vấn đề thực tế
- **Chi phí & Rủi ro**: Thực hành mạch điện thực tế tiềm ẩn nguy cơ chập cháy linh kiện, chi phí mua sắm bo mạch (Arduino, IC, cảm biến...) tốn kém với học sinh, sinh viên.
- **Rào cản tiếp cận**: Các phần mềm mô phỏng 2D kinh điển (như Proteus, Multisim) đòi hỏi cài đặt phức tạp, giao diện nặng nề và thiếu tính trực quan thực tế (không giống như khi cắm dây trên Breadboard ngoài đời).
- **Thiếu trợ giảng đồng hành**: Khi gặp lỗi không sáng đèn, đoản mạch hay sai chân linh kiện, người học thường mất nhiều giờ loay hoay mà không biết sai ở đâu.

### Giải pháp từ CircuitCraft 3D
- **Thực hành 3D như ngoài đời thực**: Nhìn thấy tận mắt từng chân cắm, màu sắc điện trở, đèn LED phát sáng hay khói cảnh báo khi quá áp.
- **AI trợ giảng 24/7**: Trí tuệ nhân tạo tích hợp sẵn giúp giải thích nguyên lý, tìm lỗi sai và gợi ý thiết kế tối ưu ngay lập tức.
- **Mọi lúc, mọi nơi**: Hoạt động hoàn toàn trên trình duyệt hiện đại, không cần cài đặt phần mềm cồng kềnh.

---

## 🌟 Tính năng cốt lõi

### 1. 🎛️ Không gian thiết kế 3D chân thực (3D Virtual Workbench)
- **Procedural 3D Components**: Bộ sưu tập mô hình 3D chi tiết cao được render bằng Three.js: Breadboard tiêu chuẩn, Arduino Uno, Điện trở (vạch màu chuẩn quốc tế), Tụ điện, Transistor, Diode, LED đa màu, IC số, Nguồn cấp, Công tắc, Nút nhấn, Còi buzzer...
- **Dây nối tự nhiên (Dynamic Bezier Wires)**: Hệ thống nối dây từ chân đến chân (Pin-to-Pin) với thuật toán tính toán độ cong vật lý mềm mại như dây điện ngoài đời.
- **Góc nhìn tương tác 360°**: Hỗ trợ xoay, phóng to, thu nhỏ, chế độ quan sát chuyên sâu từng linh kiện và chế độ trình chiếu (Presentation View).
- **Hệ thống Command Undo/Redo**: Quản lý lịch sử thao tác thông minh, cho phép hoàn tác/làm lại không giới hạn mà không làm mất trạng thái mạch.

### 2. ⚡ Động cơ mô phỏng & Kiểm tra luật thiết kế (Simulation & DRC)
- **Tính toán điện trường tức thời**: Đo lường dòng điện, điện thế, phân tích mạch kín và mạch hở trong thời gian thực.
- **Bảo vệ & Cảnh báo an toàn**: Tự động phát hiện đoản mạch (short circuit), linh kiện ngược cực, quá dòng hoặc quá công suất định mức với hiệu ứng cảnh báo trực quan.
- **Bảng đo lường & Đồng hồ kỹ thuật**: Tích hợp các công cụ đo đạc ảo trực quan giúp người học kiểm tra thông số tại bất kỳ điểm nào trên mạch.

### 3. 🤖 AI Assistant & Chú Robot Minibot 3D đồng hành
- **Trợ lý thiết kế Gemini AI**: Người dùng có thể mô tả ý tưởng bằng ngôn ngữ tự nhiên (VD: *"Hãy hướng dẫn tôi làm mạch đèn LED nhấp nháy dùng vi điều khiển"*), AI sẽ phân tích và đưa ra sơ đồ linh kiện chuẩn xác.
- **Minibot 3D tương tác**: Một chú robot đại diện ảo hiện diện ngay trên bàn làm việc 3D, biểu cảm linh hoạt theo trạng thái của mạch (vui mừng khi mạch chạy đúng, hoảng hốt khi phát hiện chập mạch) và sẵn sàng giải đáp thắc mắc lý thuyết.

### 4. 📚 Học viện thực hành tương tác (Interactive Learning Academy)
- **Giáo trình phân cấp khoa học**: Lộ trình bài học từ cơ bản (Định luật Ohm, phân áp, điều khiển LED) đến chuyên sâu (giao tiếp vi điều khiển, mạch logic).
- **Thử thách theo thời gian thực (Hands-on Labs)**: Hệ thống bài tập có cơ chế tự động chấm điểm và kiểm tra xem người học đã cắm đúng dây và đạt yêu cầu bài học hay chưa.

### 5. 🛒 Sàn chia sẻ & Không gian sáng tạo (Marketplace & Creator Studio)
- **Cộng đồng chia sẻ dự án**: Thư viện mạch điện phong phú do cộng đồng đóng góp; người dùng có thể mở và tương tác ngay lập tức với các mạch điện mẫu.
- **Creator Dashboard**: Dành cho các tác giả, giảng viên đăng tải giáo án, bán hoặc chia sẻ các thiết kế mạch điện độc đáo.

### 6. 🛡️ Nền tảng quản trị & Hệ sinh thái dịch vụ
- **Phân quyền người dùng đa cấp**: Hệ thống tài khoản phân tách rõ ràng giữa Học viên (Student), Nhà sáng tạo (Creator) và Quản trị viên (Admin).
- **Gói hội viên & Tiện ích mở rộng**: Nâng cấp tài khoản (Free / Pro / Enterprise) cùng tính năng quét mã thanh toán VietQR thông minh.

---

## 🏗️ Hệ sinh thái công nghệ

Dự án được xây dựng dựa trên những công nghệ web và đồ họa hiện đại nhất hiện nay:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          CIRCUIT_CRAFT 3D ARCHITECTURE                 │
├───────────────────────────────────┬────────────────────────────────────┤
│         GIAO DIỆN & ĐỒ HỌA        │         ĐỘNG CƠ XỬ LÝ & AI         │
│  • React 19 (Modern UI)           │  • Three.js Scene Engine           │
│  • Tailwind CSS v4 (Glassmorphism)│  • Simulation & DRC Engine         │
│  • Motion / Lucide Icons          │  • Google Gemini Generative AI SDK │
├───────────────────────────────────┼────────────────────────────────────┤
│          NỀN TẢNG SERVER          │       DỮ LIỆU & BẢO MẬT            │
│  • Express API Gateway            │  • Supabase (PostgreSQL / RLS)     │
│  • TypeScript End-to-End          │  • OTP Authentication Engine       │
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
- [x] Chế độ học tập tương tác & Hệ thống bài tập tự chấm điểm
- [x] Marketplace & Creator Dashboard chia sẻ dự án
- [ ] Bổ sung mô phỏng nạp code C++ trực tiếp cho Arduino ảo và quan sát thực thi
- [ ] Xuất sơ đồ mạch ra định dạng Gerber / PCB Layout và Schematic 2D tiêu chuẩn
- [ ] Hỗ trợ chế độ cộng tác thời gian thực nhiều người cùng lắp ráp mạch (Real-time Multiplayer)
- [ ] Mở rộng không gian thực tế ảo VR/AR (WebXR)

---

## 📄 Bản quyền (License)

Dự án được phát hành dưới giấy phép mã nguồn mở **MIT License**. Mọi chi tiết vui lòng tham khảo file [LICENSE](LICENSE).

---

<div align="center">

**CircuitCraft 3D** — *Nâng tầm trải nghiệm học tập và sáng tạo điện tử.*

Designed & Developed with passion by **huynh-phong**

</div>
