import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Flame, ShieldAlert, Cpu, Sparkles, Layers, RefreshCw } from 'lucide-react';
import { useI18n } from '../../i18n/context';

export const WhySection: React.FC = () => {
  const { language } = useI18n();
  const [activeTab, setActiveTab] = useState<'compare' | 'solution'>('compare');

  const challenges = [
    {
      icon: Flame,
      titleVi: 'Cháy nổ & Hỏng linh kiện',
      titleEn: 'Component Burnout & Damage',
      descVi: 'Nối sai cực tính hoặc quên điện trở hạn dòng là cháy LED hoặc hỏng chip thật ngay lập tức.',
      descEn: 'Reverse polarity or forgetting a resistor instantly fries your real physical LEDs or ICs.',
    },
    {
      icon: ShieldAlert,
      titleVi: 'Chi phí mua sắm đắt đỏ',
      titleEn: 'High Kit & Equipment Costs',
      descVi: 'Bộ kit Arduino, breadboard, cảm biến và đồng hồ vạn năng tốn hàng triệu đồng và thời gian chờ ship.',
      descEn: 'Arduino starter kits, breadboards, sensors, and multimeters cost hundreds of dollars with delivery delays.',
    },
    {
      icon: Layers,
      titleVi: 'Sơ đồ 2D khó hình dung',
      titleEn: 'Abstract 2D Schematics',
      descVi: 'Các bản vẽ ký hiệu điện tử trừu tượng khiến người mới bối rối khi cắm chân thực tế trên breadboard.',
      descEn: 'Abstract symbolic circuit schematics make it hard for beginners to map pin connections onto real hardware.',
    },
  ];

  const solutions = [
    {
      icon: Sparkles,
      titleVi: 'Không gian 3D an toàn tuyệt đối',
      titleEn: '100% Risk-Free 3D Sandbox',
      descVi: 'Thoải mái thử nghiệm sai sót, đoản mạch hay đổi nguồn mà không lo hư hỏng hay tốn kém chi phí.',
      descEn: 'Experiment freely with zero risk of burning parts, short circuits, or costly hardware replacements.',
    },
    {
      icon: Cpu,
      titleVi: 'Linh kiện 3D tương tác chân thực',
      titleEn: 'Authentic 3D Interactive Parts',
      descVi: 'Mô hình chuẩn xác của Arduino Uno R3, breadboard cắm lỗ 2.54mm và dây dẫn Bezier uốn lượn tự nhiên.',
      descEn: 'True-to-life 3D models of Arduino Uno R3, 2.54mm breadboard pitch, and dynamic curved Bezier wiring.',
    },
    {
      icon: RefreshCw,
      titleVi: 'Mô phỏng DC & Bắt lỗi DRC tự động',
      titleEn: 'Live Simulation & DRC Rules Check',
      descVi: 'Quan sát dòng điện chạy qua dây dẫn, LED phát sáng theo định luật Ohm và trợ lý Minibot chỉ ra lỗi tức thì.',
      descEn: 'Observe live current flow beads, LED brightness by Ohm’s Law, and instant DRC warnings before turning on.',
    },
  ];

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-[1380px] mx-auto select-none">
      {/* Background Accent Gradient */}
      <div className="absolute inset-0 pointer-events-none -z-10 flex items-center justify-center">
        <div className="w-[80%] h-[60%] bg-gradient-to-r from-blue-500/5 via-cyan-400/8 to-teal-400/5 blur-3xl rounded-full" />
      </div>

      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200/80 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
          <span>{language === 'vi' ? 'Tại sao chọn CircuitCraft 3D?' : 'Why CircuitCraft 3D?'}</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          {language === 'vi' ? 'Học điện tử, ' : 'Electronics Learning, '}
          <span className="bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 bg-clip-text text-transparent">
            {language === 'vi' ? 'được định nghĩa lại.' : 'Reimagined.'}
          </span>
        </h2>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
          {language === 'vi'
            ? 'Xóa bỏ nỗi sợ cháy nổ linh kiện và chi phí đắt đỏ. Khám phá cách học trực quan, chạm tay vào từng chân linh kiện ngay trên trình duyệt của bạn.'
            : 'Eliminate the fear of blown components and expensive equipment. Discover an intuitive way to touch, connect, and understand hardware directly in your browser.'}
        </p>
      </div>

      {/* Interactive Comparison Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* Left Side: Traditional Hurdles */}
        <div className="p-6 sm:p-8 rounded-[28px] bg-gradient-to-b from-rose-50/70 via-white to-orange-50/40 dark:from-[#1a0f16] dark:via-[#130b10] dark:to-[#0d070b] border border-rose-200/80 dark:border-rose-900/40 shadow-xl shadow-rose-500/5 flex flex-col justify-between transition-all">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">
                  {language === 'vi' ? 'Cách học truyền thống' : 'Traditional Hurdles'}
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                  {language === 'vi' ? 'Rào cản khi bắt đầu với phần cứng thật' : 'The Frustrations of Physical Hardware'}
                </h3>
              </div>
            </div>

            <div className="space-y-4">
              {challenges.map((c, i) => {
                const Icon = c.icon;
                return (
                  <div
                    key={i}
                    className="p-4 rounded-2xl bg-white/90 dark:bg-[#1f1019]/80 border border-rose-100 dark:border-rose-900/50 shadow-xs flex items-start gap-3.5"
                  >
                    <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white mb-1">
                        {language === 'vi' ? c.titleVi : c.titleEn}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {language === 'vi' ? c.descVi : c.descEn}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-rose-200/60 dark:border-rose-900/40 text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>{language === 'vi' ? 'Dễ làm nản lòng người học ngay từ những bài đầu tiên' : 'Often leads to frustration before your first working circuit'}</span>
          </div>
        </div>

        {/* Right Side: CircuitCraft 3D Advantage */}
        <div className="p-6 sm:p-8 rounded-[28px] bg-gradient-to-b from-cyan-50/70 via-white to-sky-50/50 dark:from-[#091f33] dark:via-[#061726] dark:to-[#05111c] border border-cyan-300/90 dark:border-cyan-500/40 shadow-2xl shadow-cyan-500/10 flex flex-col justify-between transition-all">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-cyan-100 dark:bg-cyan-950/80 border border-cyan-300 dark:border-cyan-700 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
                  {language === 'vi' ? 'Giải pháp CircuitCraft 3D' : 'The CircuitCraft 3D Advantage'}
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                  {language === 'vi' ? 'Môi trường thực nghiệm trực quan & an toàn' : 'Visual, Intuitive & Risk-Free Learning'}
                </h3>
              </div>
            </div>

            <div className="space-y-4">
              {solutions.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div
                    key={i}
                    className="p-4 rounded-2xl bg-white/95 dark:bg-[#071d30]/90 border border-cyan-100 dark:border-cyan-800/60 shadow-xs flex items-start gap-3.5"
                  >
                    <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white mb-1">
                        {language === 'vi' ? s.titleVi : s.titleEn}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {language === 'vi' ? s.descVi : s.descEn}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-cyan-200/60 dark:border-cyan-900/60 text-xs text-cyan-700 dark:text-cyan-300 font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            <span>{language === 'vi' ? 'Tiếp thu nguyên lý nhanh hơn gấp 3 lần với phản hồi thị giác tức thì' : 'Grasp concepts 3x faster with instant visual tactile feedback'}</span>
          </div>
        </div>
      </div>
    </section>
  );
};
