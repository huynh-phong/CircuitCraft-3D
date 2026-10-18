import React, { useState } from 'react';
import { Box, Layers, Play, Sparkles, Check, ArrowRight, Zap, ShieldCheck } from 'lucide-react';
import { useI18n } from '../../i18n/context';

export const HowItWorksSection: React.FC = () => {
  const { language } = useI18n();
  const [activeStep, setActiveStep] = useState<number>(0);

  const steps = [
    {
      num: '01',
      icon: Box,
      titleVi: 'Chọn linh kiện từ Thư viện',
      titleEn: 'Choose Components',
      descVi: 'Lựa chọn Arduino UNO R3, bo mạch test breadboard, điện trở, bóng LED, công tắc SPST hay chiết áp xoay từ kho linh kiện phong phú.',
      descEn: 'Pick Arduino UNO R3, solderless breadboards, LEDs, resistors, SPST switches, or potentiometers from our modular catalog.',
      badgeVi: 'Bước 1: Khởi tạo',
      badgeEn: 'Step 1: Assembly',
    },
    {
      num: '02',
      icon: Layers,
      titleVi: 'Lắp ráp & Cắm dây trong không gian 3D',
      titleEn: 'Build in 3D Space',
      descVi: 'Kéo thả linh kiện với cơ chế tự động hút chân cắm 2.54mm. Nối dây điện uốn cong tự nhiên bằng thuật toán Dynamic Bezier thông minh.',
      descEn: 'Drag and place parts with auto-snapping 2.54mm grid pins. Connect terminal points with sleek, organic dynamic Bezier curve wires.',
      badgeVi: 'Bước 2: Kết nối',
      badgeEn: 'Step 2: Wiring',
    },
    {
      num: '03',
      icon: Play,
      titleVi: 'Bật Mô phỏng thời gian thực',
      titleEn: 'Run Real-time Simulation',
      descVi: 'Khởi động nguồn điện và quan sát dòng điện DC tuần hoàn. Đèn LED phát quang theo định luật Ohm, đồng hồ hiển thị điện áp tức thời.',
      descEn: 'Energize the power source and watch DC current flow. LEDs illuminate with realistic physics and voltage meters calculate live drops.',
      badgeVi: 'Bước 3: Vận hành',
      badgeEn: 'Step 3: Simulation',
    },
    {
      num: '04',
      icon: Sparkles,
      titleVi: 'Chẩn đoán DRC & Học cùng Minibot',
      titleEn: 'Inspect & Improve with AI',
      descVi: 'Bộ kiểm tra luật mạch (DRC) tự động cảnh báo đoản mạch hoặc thiếu điện trở. Trợ lý AI Minibot giải thích chi tiết nguyên nhân và cách khắc phục.',
      descEn: 'DRC engine instantly flags short circuits and floating pins. Minibot AI provides instant pedagogical explanations to refine your design.',
      badgeVi: 'Bước 4: Nâng cao',
      badgeEn: 'Step 4: AI Debugging',
    },
  ];

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-[1380px] mx-auto select-none">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200/80 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-xs font-bold uppercase tracking-wider">
          <Zap className="w-3.5 h-3.5 text-cyan-500" />
          <span>{language === 'vi' ? 'Quy trình đơn giản' : 'Simple Workflow'}</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          {language === 'vi' ? 'Từ linh kiện đầu tiên đến ' : 'From Your First Component to '}
          <span className="bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 bg-clip-text text-transparent">
            {language === 'vi' ? 'mạch điện hoàn chỉnh.' : 'Your First Circuit.'}
          </span>
        </h2>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
          {language === 'vi'
            ? 'Thiết kế mạch điện chưa bao giờ trực quan và dễ dàng đến thế. Hãy làm theo 4 bước tiêu chuẩn của một kỹ sư vi mạch thực thụ.'
            : 'Designing electronic circuits has never been this intuitive. Follow 4 straightforward steps to master circuit building.'}
        </p>
      </div>

      {/* Main Interactive Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left: 4 Steps Interactive Tabs (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeStep === idx;

            return (
              <button
                key={step.num}
                onClick={() => setActiveStep(idx)}
                className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 flex items-start gap-4 cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-[#07192d] border-cyan-400 dark:border-cyan-500/70 shadow-lg shadow-cyan-500/10 scale-[1.01]'
                    : 'bg-white/60 dark:bg-[#061224]/50 border-slate-200/80 dark:border-slate-800 hover:bg-white dark:hover:bg-[#07162b] opacity-80 hover:opacity-100'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-mono font-bold text-sm transition-all ${
                    isActive
                      ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 pr-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
                      {language === 'vi' ? step.badgeVi : step.badgeEn}
                    </span>
                    <span className="text-xs font-mono font-extrabold text-slate-400 dark:text-slate-500">
                      {step.num}
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                    {language === 'vi' ? step.titleVi : step.titleEn}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    {language === 'vi' ? step.descVi : step.descEn}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Dynamic Interactive Visual Demo (7 Cols) */}
        <div className="lg:col-span-7">
          <div className="relative aspect-[16/11] rounded-[28px] overflow-hidden bg-gradient-to-b from-[#091b30] via-[#061324] to-[#040e1b] border border-cyan-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.5),_0_0_30px_rgba(6,182,212,0.15)] flex flex-col justify-between p-6 sm:p-8 select-none">
            {/* Top Bar with Status Pill */}
            <div className="flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs font-mono text-cyan-400 font-bold ml-2">
                  CircuitCraft-3D // Step_{steps[activeStep].num}
                </span>
              </div>

              <div className="px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-[11px] font-mono text-cyan-300 font-bold">
                {activeStep === 0 && (language === 'vi' ? 'Thư viện: 12 linh kiện' : 'Catalog: 12 Items')}
                {activeStep === 1 && (language === 'vi' ? 'Đã nối: 6 dây Bezier' : 'Wiring: 6 Bezier Wires')}
                {activeStep === 2 && (language === 'vi' ? 'Dòng điện DC: 14.2 mA' : 'DC Current: 14.2 mA')}
                {activeStep === 3 && (language === 'vi' ? 'Kiểm tra DRC: Hợp lệ' : 'DRC Status: Passed')}
              </div>
            </div>

            {/* Central Animated Scene according to active step */}
            <div className="my-auto flex flex-col items-center justify-center text-center relative py-6">
              {/* Step 0 Visual: Component Picker Showcase */}
              {activeStep === 0 && (
                <div className="w-full max-w-md space-y-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl bg-[#0b213b] border border-cyan-500/40 text-center shadow-lg hover:border-cyan-400 transition">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto mb-2 font-bold text-xs">
                        5V
                      </div>
                      <div className="text-xs font-bold text-white">Nguồn DC</div>
                      <div className="text-[10px] text-cyan-300 font-mono">5.0V / 2A</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-[#0b213b] border border-cyan-500/40 text-center shadow-lg hover:border-cyan-400 transition">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-2 font-bold text-xs">
                        220Ω
                      </div>
                      <div className="text-xs font-bold text-white">Điện trở</div>
                      <div className="text-[10px] text-amber-300 font-mono">1/4W 5%</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-[#0b213b] border border-cyan-500/40 text-center shadow-lg hover:border-cyan-400 transition">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-2 font-bold text-xs">
                        LED
                      </div>
                      <div className="text-xs font-bold text-white">LED Đỏ</div>
                      <div className="text-[10px] text-rose-300 font-mono">5mm 2.0V</div>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800 text-xs text-cyan-200">
                    {language === 'vi'
                      ? 'Kéo thả linh kiện trực tiếp vào không gian làm việc 3D với 1 cú click chuột.'
                      : 'Drag & drop components directly onto the 3D PCB workspace in one click.'}
                  </div>
                </div>
              )}

              {/* Step 1 Visual: Dynamic Bezier Wiring */}
              {activeStep === 1 && (
                <div className="w-full max-w-md space-y-4 animate-in fade-in zoom-in-95 duration-300 text-center">
                  <div className="relative h-36 flex items-center justify-center">
                    {/* SVG curve wiring */}
                    <svg className="w-full h-full" viewBox="0 0 300 120" fill="none">
                      <path
                        d="M 40 60 C 100 10, 200 110, 260 60"
                        stroke="#00e5ff"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray="6 6"
                        className="animate-[dash_1s_linear_infinite]"
                      />
                      <circle cx="40" cy="60" r="8" fill="#38bdf8" />
                      <circle cx="260" cy="60" r="8" fill="#38bdf8" />
                    </svg>
                    <div className="absolute top-2 left-4 text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40">
                      Pin VCC (5V)
                    </div>
                    <div className="absolute bottom-2 right-4 text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40">
                      Anode Pin (LED)
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800 text-xs text-cyan-200">
                    {language === 'vi'
                      ? 'Dây điện uốn lượn tự nhiên theo đường cong Bezier 3D, không lo chồng chéo hay rối mắt.'
                      : 'Wires form smooth organic 3D Bezier curves, eliminating messy visual tangles.'}
                  </div>
                </div>
              )}

              {/* Step 2 Visual: Real-time DC Simulation Running */}
              {activeStep === 2 && (
                <div className="w-full max-w-md space-y-4 animate-in fade-in zoom-in-95 duration-300 text-center">
                  <div className="flex items-center justify-center gap-6 py-4">
                    {/* Glowing LED */}
                    <div className="relative flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-rose-500 blur-xl animate-pulse" />
                      <div className="absolute w-12 h-12 rounded-full bg-gradient-to-t from-rose-600 to-rose-400 border-2 border-white shadow-[0_0_30px_#ff0055] flex items-center justify-center text-white font-bold text-xs">
                        ON
                      </div>
                    </div>

                    <div className="text-left font-mono space-y-1">
                      <div className="text-xs text-slate-400">Điện áp nguồn: <span className="text-white font-bold">5.00 V</span></div>
                      <div className="text-xs text-slate-400">Sụt áp LED: <span className="text-rose-400 font-bold">2.00 V</span></div>
                      <div className="text-xs text-slate-400">Dòng qua tải: <span className="text-cyan-400 font-bold">13.6 mA</span></div>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/50 text-xs text-emerald-200">
                    {language === 'vi'
                      ? 'Mô phỏng DC thời gian thực tính toán sụt áp và cường độ dòng điện chính xác.'
                      : 'Real-time DC solver computes live voltage drops and current intensity.'}
                  </div>
                </div>
              )}

              {/* Step 3 Visual: DRC Inspection & Minibot AI */}
              {activeStep === 3 && (
                <div className="w-full max-w-md space-y-3.5 animate-in fade-in zoom-in-95 duration-300 text-left">
                  <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/60 text-white flex items-center gap-3 shadow-lg">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Kiểm tra luật thiết kế: Đạt chuẩn (0 lỗi)</div>
                      <div className="text-xs text-emerald-300">Không có đoản mạch, LED có điện trở bảo vệ 220Ω</div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#0a1e35] border border-cyan-500/40 text-xs text-cyan-100 flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-white block mb-0.5">Minibot AI Advice:</span>
                      Mạch của bạn đang vận hành lý tưởng. Để mở rộng, bạn có thể thay điện trở bằng chiết áp Potentiometer để điều chỉnh độ sáng biến thiên!
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Stepper Indicator */}
            <div className="flex items-center justify-between pt-4 border-t border-cyan-900/60 z-10">
              <span className="text-xs font-mono text-slate-400">
                {language === 'vi' ? 'Tiến độ' : 'Progress'}: {activeStep + 1} / 4
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveStep((prev) => (prev > 0 ? prev - 1 : 3))}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
                >
                  {language === 'vi' ? 'Trước' : 'Prev'}
                </button>
                <button
                  onClick={() => setActiveStep((prev) => (prev < 3 ? prev + 1 : 0))}
                  className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1"
                >
                  <span>{language === 'vi' ? 'Tiếp theo' : 'Next'}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
