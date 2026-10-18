import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Bot, Sparkles, MessageSquare } from 'lucide-react';
import { useI18n } from '../../i18n/context';

export interface FaqSectionProps {
  onOpenSupportChat: () => void;
}

export const FaqSection: React.FC<FaqSectionProps> = ({ onOpenSupportChat }) => {
  const { language } = useI18n();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      qVi: 'CircuitCraft 3D là gì và khác biệt gì so với phần mềm 2D?',
      qEn: 'What is CircuitCraft 3D and how does it differ from 2D software?',
      aVi: 'CircuitCraft 3D là nền tảng thiết kế mạch điện tử 3D và mô phỏng điện học DC trực tiếp trên trình duyệt. Khác với sơ đồ 2D ký hiệu khô khan, CircuitCraft 3D tái hiện chính xác bo mạch breadboard, Arduino UNO R3 và linh kiện với kích thước thật, hỗ trợ cắm chân 2.54mm và dây uốn Bezier mượt mà.',
      aEn: 'CircuitCraft 3D is a browser-based 3D electronic design and real-time DC simulation platform. Unlike dry 2D schematic tools, it presents authentic 3D breadboards, Arduino UNO R3, and components with 2.54mm pin-snapping and organic Bezier wiring.',
    },
    {
      qVi: 'Tôi là người hoàn toàn mới, chưa biết gì về điện tử có học được không?',
      qEn: 'Can I start as a complete beginner with zero prior experience?',
      aVi: 'Hoàn toàn được! Hệ thống có sẵn lộ trình Khóa học UNO R3 gồm 8 chương bắt đầu từ những khái niệm đơn giản nhất như thắp sáng đèn LED đỏ với điện trở hạn dòng. Trợ lý ảo Minibot luôn sẵn sàng giải thích từng hiện tượng vật lý dễ hiểu nhất.',
      aEn: 'Absolutely! Our structured UNO R3 Curriculum guides you from the very first step—lighting an LED safely with a resistor. Minibot AI is always on hand to explain physics concepts in plain language.',
    },
    {
      qVi: 'Tôi có cần mua bo mạch Arduino hay linh kiện thật để thực hành không?',
      qEn: 'Do I need to purchase physical Arduino boards or kits?',
      aVi: 'Không cần! Tất cả linh kiện từ nguồn DC, công tắc, biến trở, LED, điện trở đến vi điều khiển Arduino UNO R3 đều được mô phỏng 3D tương tác 100% trong trình duyệt. Bạn có thể thực hành không giới hạn mà không tốn một đồng chi phí mua sắm hay sợ cháy nổ linh kiện.',
      aEn: 'No! All components including DC supplies, switches, potentiometers, LEDs, and Arduino UNO R3 are fully interactive in 3D right in your web browser. You learn with zero equipment costs or burn risks.',
    },
    {
      qVi: 'Tôi có thể học các kiến thức cơ bản ở đâu trên website?',
      qEn: 'Where can I access beginner lessons on the website?',
      aVi: 'Bạn chỉ cần truy cập tab "Khóa học" (Courses) trên thanh điều hướng. Tại đây bạn có thể đăng ký khóa học cơ bản và bấm "Vào phòng thực hành" để hệ thống tự động tải mẫu bài tập vào không gian 3D kèm mục tiêu bài học.',
      aEn: 'Simply head to the "Courses" tab in the navigation bar. Enroll in foundational courses and click "Launch Lab" to load the project template directly into the 3D workspace with goal tracking.',
    },
    {
      qVi: 'Hệ thống hỗ trợ mô phỏng những loại mạch và linh kiện nào?',
      qEn: 'What types of circuits and components are currently supported?',
      aVi: 'Hệ thống hỗ trợ giải mạch DC tĩnh thời gian thực với: Nguồn điện 5V/GND, Bo mạch thử nghiệm Breadboard, Arduino Uno R3, Điện trở nhiều mức ôm, LED nhiều màu sắc, Công tắc gạt SPST, Biến trở xoay Potentiometer và cổng kết nối dây dẫn. Bộ kiểm tra DRC sẽ tự động kiểm tra đoản mạch.',
      aEn: 'We support real-time steady-state DC circuit simulation with 5V/GND sources, solderless breadboards, Arduino UNO R3, resistors, colored LEDs, SPST switches, and potentiometers with live DRC rules checking.',
    },
    {
      qVi: 'Trợ lý ảo Minibot và Trợ lý Hỗ trợ Website khác nhau như thế nào?',
      qEn: 'What is the difference between Minibot and the Website Support AI?',
      aVi: 'Minibot là người bạn 3D nằm bên trong không gian Thiết kế 3D, chuyên phân tích mạch, định luật Ohm và bắt lỗi DRC. Trong khi đó, Trợ lý Hỗ trợ Website (góc dưới bên phải) đóng vai trò hướng dẫn tổng quan về nền tảng, điều hướng, khóa học và các gói thành viên.',
      aEn: 'Minibot is the 3D companion inside the 3D Workspace dedicated to circuit analysis and DRC rules. The Website Support AI (bottom-right floating assistant) guides you through platform features, navigation, courses, and account tiers.',
    },
    {
      qVi: 'Tôi có thể lưu trữ và chia sẻ thiết kế của mình như thế nào?',
      qEn: 'How can I save and share my circuit designs?',
      aVi: 'Mọi dự án của bạn đều được tự động lưu vào bộ nhớ trình duyệt hoặc đồng bộ đám mây Supabase khi đăng nhập. Bạn có thể bấm "Xuất JSON" để tải file .cc3d về máy, hoặc chia sẻ lên Marketplace cộng đồng để mọi người cùng mở.',
      aEn: 'Your projects auto-save locally and sync to the cloud when signed in. You can click "Export JSON" to download your .circuitcraft.json file, or publish it to the Marketplace for the community.',
    },
    {
      qVi: 'Sự khác nhau giữa tài khoản Miễn phí và các gói Thành viên là gì?',
      qEn: 'What is the difference between the Free tier and Membership plans?',
      aVi: 'Gói Sinh viên (Student) hoàn toàn miễn phí, cho phép thiết kế 3D và học các bài cơ bản. Gói Creator và Pro mở khóa đầy đủ kho dự án nâng cao, công cụ phân tích mở rộng và cấp quyền xuất bản khóa học lên Marketplace với tính năng thanh toán VietQR tự động.',
      aEn: 'The Student tier is 100% free with unlimited 3D lab access and core labs. Creator & Pro memberships unlock advanced templates, deep analysis tools, and creator studio publishing with automated VietQR payouts.',
    },
  ];

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-[1100px] mx-auto select-none">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200/80 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-xs font-bold uppercase tracking-wider">
          <HelpCircle className="w-3.5 h-3.5 text-cyan-500" />
          <span>{language === 'vi' ? 'Hỏi đáp cho người mới' : 'FAQ for Beginners'}</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          {language === 'vi' ? 'Giải đáp những thắc mắc ' : 'Answers to Your '}
          <span className="bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 bg-clip-text text-transparent">
            {language === 'vi' ? 'thường gặp nhất.' : 'Common Questions.'}
          </span>
        </h2>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
          {language === 'vi'
            ? 'Những thông tin cần biết để bạn bắt đầu khám phá thế giới vi mạch 3D một cách dễ dàng và tự tin nhất.'
            : 'Essential information to help you start your journey into 3D electronics with confidence.'}
        </p>
      </div>

      {/* Accordion List */}
      <div className="space-y-3.5">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;

          return (
            <div
              key={idx}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isOpen
                  ? 'bg-white dark:bg-[#07172b] border-cyan-400 dark:border-cyan-600/70 shadow-lg shadow-cyan-500/5'
                  : 'bg-white/80 dark:bg-[#061224]/80 border-slate-200/90 dark:border-slate-800 hover:border-cyan-300 dark:hover:border-cyan-900'
              }`}
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer"
              >
                <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white leading-snug">
                  {language === 'vi' ? faq.qVi : faq.qEn}
                </span>
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                    isOpen ? 'bg-cyan-100 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 rotate-180' : 'text-slate-400'
                  }`}
                >
                  <ChevronDown className="w-4 h-4" />
                </div>
              </button>

              {isOpen && (
                <div className="px-4 sm:px-5 pb-5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-cyan-950/60 pt-3">
                  {language === 'vi' ? faq.aVi : faq.aEn}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Ask AI Banner at bottom of FAQ */}
      <div className="mt-10 p-6 rounded-3xl bg-gradient-to-r from-cyan-50/80 via-white to-sky-50/80 dark:from-[#091f35] dark:via-[#071628] dark:to-[#081b30] border border-cyan-200 dark:border-cyan-700/50 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-cyan-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-cyan-600/30">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
              {language === 'vi' ? 'Bạn vẫn còn câu hỏi khác?' : 'Still have more questions?'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {language === 'vi'
                ? 'Trò chuyện ngay với Trợ lý Hướng dẫn Website để được giải đáp tức thì.'
                : 'Chat directly with our Website Guide Assistant for instant answers.'}
            </p>
          </div>
        </div>

        <button
          onClick={onOpenSupportChat}
          className="tech-btn-3d px-5 py-2.5 rounded-xl text-white font-extrabold text-xs flex items-center gap-2 cursor-pointer shadow-md shrink-0"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{language === 'vi' ? 'Hỏi trợ lý AI ngay' : 'Ask Support AI Now'}</span>
        </button>
      </div>
    </section>
  );
};
