import React from 'react';
import { Cpu, ShieldCheck, Box, BookOpen, ShoppingBag, Sparkles, HelpCircle, Heart, ArrowUp } from 'lucide-react';
import { useI18n } from '../../i18n/context';

export interface FooterSectionProps {
  onNavigate: (route: string) => void;
  onOpenSupportChat: () => void;
}

export const FooterSection: React.FC<FooterSectionProps> = ({
  onNavigate,
  onOpenSupportChat,
}) => {
  const { language } = useI18n();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="w-full border-t border-[#cbe6f7] dark:border-cyan-900/40 bg-white/90 dark:bg-[#040e1b]/95 backdrop-blur-xl pt-16 pb-12 text-slate-700 dark:text-slate-300 select-none">
      <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-200/80 dark:border-slate-800/80">
          {/* Brand Info (2 Cols on LG) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-teal-500 to-sky-400 p-[1.5px] shadow-md shadow-cyan-500/25">
                <div className="w-full h-full bg-white dark:bg-[#061224] rounded-[10px] flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
                </div>
              </div>
              <div className="flex flex-col text-left">
                <span className="font-extrabold tracking-tight text-lg text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>CircuitCraft</span>
                  <span className="text-xs font-bold px-1.5 py-0.5 bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 rounded-md border border-cyan-200 dark:border-cyan-800">
                    3D
                  </span>
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
              {language === 'vi'
                ? 'Nền tảng thiết kế mạch điện tử 3D tương tác và mô phỏng DC thời gian thực thế hệ mới. Học tập trực quan, an toàn và chuyên nghiệp ngay trên trình duyệt.'
                : 'Next-generation interactive 3D electronic circuit design and real-time DC simulation platform. Learn by doing in a risk-free browser lab.'}
            </p>

            <div className="flex items-center gap-2 pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Systems Operational • 60 FPS
              </span>
            </div>
          </div>

          {/* Column 1: Platform */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {language === 'vi' ? 'Nền tảng' : 'Platform'}
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('projects')}
                  className="hover:text-cyan-600 dark:hover:text-cyan-400 transition cursor-pointer"
                >
                  {language === 'vi' ? 'Thiết kế 3D (3D Lab)' : '3D Workspace'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('courses')}
                  className="hover:text-cyan-600 dark:hover:text-cyan-400 transition cursor-pointer"
                >
                  {language === 'vi' ? 'Khóa học thực hành' : 'Interactive Courses'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('marketplace')}
                  className="hover:text-cyan-600 dark:hover:text-cyan-400 transition cursor-pointer"
                >
                  {language === 'vi' ? 'Cửa hàng linh kiện' : 'Marketplace'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('membership')}
                  className="hover:text-cyan-600 dark:hover:text-cyan-400 transition cursor-pointer"
                >
                  {language === 'vi' ? 'Gói thành viên' : 'Membership Plans'}
                </button>
              </li>
            </ul>
          </div>

          {/* Column 2: Explore */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {language === 'vi' ? 'Khám phá' : 'Explore'}
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('creator')}
                  className="hover:text-cyan-600 dark:hover:text-cyan-400 transition cursor-pointer"
                >
                  {language === 'vi' ? 'Studio Sáng tạo' : 'Creator Studio'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('lessons')}
                  className="hover:text-cyan-600 dark:hover:text-cyan-400 transition cursor-pointer"
                >
                  {language === 'vi' ? 'Danh mục bài học' : 'Lesson Directory'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('account')}
                  className="hover:text-cyan-600 dark:hover:text-cyan-400 transition cursor-pointer"
                >
                  {language === 'vi' ? 'Quản lý tài khoản' : 'Account Settings'}
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Support */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {language === 'vi' ? 'Hỗ trợ' : 'Support'}
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={onOpenSupportChat}
                  className="hover:text-cyan-600 dark:hover:text-cyan-400 transition cursor-pointer flex items-center gap-1.5 font-bold text-cyan-600 dark:text-cyan-400"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{language === 'vi' ? 'Hỏi trợ lý AI (24/7)' : 'Ask Support AI (24/7)'}</span>
                </button>
              </li>
              <li>
                <span className="text-slate-500 dark:text-slate-400">
                  {language === 'vi' ? 'Cổng thanh toán VietQR tự động' : 'Automated VietQR Gateway'}
                </span>
              </li>
              <li>
                <span className="text-slate-500 dark:text-slate-400">
                  {language === 'vi' ? 'Email: support@circuitcraft3d.com' : 'support@circuitcraft3d.com'}
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Scroll to top */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div>
            © {new Date().getFullYear()} CircuitCraft 3D. {language === 'vi' ? 'Bảo lưu mọi quyền.' : 'All rights reserved.'}
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span>Được xây dựng với</span>
              <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
              <span>dành cho cộng đồng STEM</span>
            </span>

            <button
              onClick={scrollToTop}
              title={language === 'vi' ? 'Lên đầu trang' : 'Scroll to top'}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-950 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition cursor-pointer"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
