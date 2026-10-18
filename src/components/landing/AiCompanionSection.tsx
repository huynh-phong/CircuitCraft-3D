import React from 'react';
import { Bot, Sparkles, CheckCircle2, MessageSquare, Cpu, ArrowRight } from 'lucide-react';
import { useI18n } from '../../i18n/context';

export interface AiCompanionSectionProps {
  onStartDesigning: () => void;
}

export const AiCompanionSection: React.FC<AiCompanionSectionProps> = ({
  onStartDesigning,
}) => {
  const { language } = useI18n();

  const values = [
    {
      titleVi: 'Sư phạm điện tử trực quan',
      titleEn: 'Pedagogical Hardware Guidance',
      descVi: 'Minibot không chỉ đưa ra đáp án mà giải thích cặn kẽ bản chất vật lý: định luật Ohm, cầu phân áp, cực tính bán dẫn.',
      descEn: 'Minibot breaks down fundamental physics: Ohm’s Law, voltage dividers, and diode semiconductor polarities in plain terms.',
    },
    {
      titleVi: 'Tự động chẩn đoán lỗi DRC',
      titleEn: 'Instant DRC Design Diagnostics',
      descVi: 'Phát hiện đoản mạch, chân linh kiện chưa nối hoặc giá trị điện trở chưa tối ưu trước khi bạn đóng điện.',
      descEn: 'Pinpoints short circuits, floating unconnected pins, and missing current-limiting resistors before energizing.',
    },
    {
      titleVi: 'Đồng hành theo từng bài thực hành',
      titleEn: 'Step-by-Step Lab Tutoring',
      descVi: 'Cung cấp gợi ý thông minh khi bạn gặp khó khăn trong các bài lab mà không làm mất đi niềm vui tự mình khám phá.',
      descEn: 'Provides intelligent hints when you are stuck in interactive course labs without spoiling the joy of discovery.',
    },
  ];

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-[1380px] mx-auto select-none">
      {/* Background Glow */}
      <div className="absolute inset-0 pointer-events-none -z-10 flex items-center justify-center">
        <div className="w-[80%] h-[60%] bg-gradient-to-r from-cyan-500/10 via-blue-500/8 to-teal-400/5 blur-3xl rounded-full" />
      </div>

      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200/80 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-xs font-bold uppercase tracking-wider">
          <Bot className="w-3.5 h-3.5 text-cyan-500" />
          <span>{language === 'vi' ? 'Trợ lý AI đồng hành' : 'In-Editor AI Companion'}</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          {language === 'vi' ? 'Học thông minh hơn cùng ' : 'Learn Smarter With Your '}
          <span className="bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 bg-clip-text text-transparent">
            {language === 'vi' ? 'Trợ lý ảo Minibot.' : 'AI Companion.'}
          </span>
        </h2>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
          {language === 'vi'
            ? 'Minibot là người bạn đồng hành 3D luôn có mặt trong không gian thiết kế để phân tích sơ đồ mạch, giải thích lỗi kỹ thuật và hướng dẫn bạn từng bước.'
            : 'Minibot is your friendly 3D robot companion inside the workspace, analyzing circuit schematics, explaining errors, and coaching you step-by-step.'}
        </p>
      </div>

      {/* 2-Column Split: Minibot Stage & Interactive Dialogue Demo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left: 3 Core Values (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {values.map((v, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-white/95 dark:bg-[#07172b]/95 border border-[#cbe6f7] dark:border-cyan-800/40 shadow-md shadow-cyan-500/5 flex items-start gap-3.5"
            >
              <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white mb-1">
                  {language === 'vi' ? v.titleVi : v.titleEn}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {language === 'vi' ? v.descVi : v.descEn}
                </p>
              </div>
            </div>
          ))}

          <div className="pt-2">
            <button
              onClick={onStartDesigning}
              className="tech-btn-3d px-6 py-3 rounded-2xl text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <Bot className="w-4 h-4 text-white" />
              <span>{language === 'vi' ? 'Trải nghiệm cùng Minibot trong 3D' : 'Meet Minibot in 3D Lab'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Minibot Card & Live Interactive Dialogue Mockup (7 Cols) */}
        <div className="lg:col-span-7">
          <div className="p-6 sm:p-8 rounded-[30px] bg-gradient-to-b from-[#0a1e35] via-[#071628] to-[#040e1b] border border-cyan-500/40 shadow-[0_20px_60px_rgba(0,0,0,0.6),_0_0_30px_rgba(6,182,212,0.2)] text-white space-y-6 select-none">
            {/* Minibot Header Badge */}
            <div className="flex items-center justify-between pb-4 border-b border-cyan-900/60">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-400 to-blue-600 p-[2px] shadow-lg shadow-cyan-500/30">
                  <div className="w-full h-full rounded-[14px] bg-[#071628] flex items-center justify-center">
                    <Bot className="w-7 h-7 text-cyan-400 animate-pulse" />
                  </div>
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-white flex items-center gap-2">
                    <span>Minibot 3D Assistant</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  </h4>
                  <span className="text-xs text-cyan-300 font-mono">
                    AI Hardware Debugger • In-Workspace
                  </span>
                </div>
              </div>

              <div className="px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-[11px] font-mono text-cyan-300">
                Gemini 3.8 Powered
              </div>
            </div>

            {/* Conversation Preview Demonstration */}
            <div className="space-y-4 text-xs leading-relaxed">
              {/* User Question */}
              <div className="flex items-start gap-3 justify-end">
                <div className="max-w-[85%] p-3.5 rounded-2xl rounded-tr-sm bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md">
                  <p className="font-medium">
                    {language === 'vi'
                      ? 'Minibot ơi, tại sao tôi đóng công tắc mà bóng LED màu đỏ vẫn không sáng?'
                      : "Hey Minibot, why isn't my red LED lighting up when I close the switch?"}
                  </p>
                </div>
              </div>

              {/* Minibot Response */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="max-w-[85%] p-4 rounded-2xl rounded-tl-sm bg-[#0c233c] border border-cyan-800/60 text-cyan-100 shadow-md space-y-2">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>
                      {language === 'vi'
                        ? 'Tôi đã phân tích mạch của bạn! Dưới đây là 2 nguyên nhân:'
                        : 'I analyzed your circuit! Here are 2 likely causes:'}
                    </span>
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 text-slate-200">
                    <li>
                      <strong className="text-cyan-300">Cực tính LED bị ngược (Reverse Polarity):</strong> Chân Anode (dương) cần được nối với nguồn 5V qua điện trở. Chân Cathode phải về GND.
                    </li>
                    <li>
                      <strong className="text-cyan-300">Điện trở hạn dòng:</strong> Đảm bảo bạn đang sử dụng điện trở 220Ω để dòng điện đạt mức 13.6mA an toàn cho LED.
                    </li>
                  </ul>
                  <div className="pt-1 text-[11px] text-cyan-400 font-mono">
                    👉 Gợi ý: Hãy xoay bóng LED 180° và bấm lại "Chạy mô phỏng"!
                  </div>
                </div>
              </div>
            </div>

            {/* Footer note */}
            <div className="pt-3 border-t border-cyan-900/60 text-[11px] text-slate-400 flex items-center justify-between">
              <span>* Trợ lý kỹ thuật chuyên sâu phục vụ phân tích mạch trong không gian 3D.</span>
              <span className="text-cyan-400 font-mono">Status: Ready</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
