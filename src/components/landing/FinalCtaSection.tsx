import React from 'react';
import { Box, BookOpen, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../../i18n/context';

export interface FinalCtaSectionProps {
  onStartDesigning: () => void;
  onExploreLessons: () => void;
}

export const FinalCtaSection: React.FC<FinalCtaSectionProps> = ({
  onStartDesigning,
  onExploreLessons,
}) => {
  const { language } = useI18n();

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-[1380px] mx-auto select-none">
      <div className="relative rounded-[36px] overflow-hidden p-8 sm:p-14 lg:p-16 bg-gradient-to-br from-[#0c233f] via-[#071629] to-[#040e1b] border-2 border-cyan-400/50 shadow-[0_25px_80px_rgba(6,182,212,0.25),_inset_0_1px_2px_rgba(255,255,255,0.2)] text-white text-center">
        {/* Subtle Cyber Circuit Overlay */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 50%, #00f0ff 1px, transparent 1px), linear-gradient(to right, rgba(6,182,212,0.1) 1px, transparent 1px)',
            backgroundSize: '32px 32px, 64px 64px',
          }}
        />

        {/* Ambient Top Glow Line */}
        <div className="absolute top-0 left-1/4 right-1/4 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80" />

        <div className="relative z-10 max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-400/40 text-cyan-300 text-xs font-bold uppercase tracking-wider shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>{language === 'vi' ? 'Bắt đầu hành trình của bạn' : 'Start Your Hardware Journey'}</span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
            {language === 'vi' ? 'Sẵn sàng thiết kế ' : 'Ready to Build '} <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">
              {language === 'vi' ? 'mạch điện 3D đầu tiên?' : 'Your First 3D Circuit?'}
            </span>
          </h2>

          <p className="text-sm sm:text-base text-cyan-100/90 max-w-xl mx-auto leading-relaxed font-normal">
            {language === 'vi'
              ? 'Khám phá điện tử trong không gian 3D tương tác hoàn toàn miễn phí. Thực hành không rủi ro, nắm vững nguyên lý và hiện thực hóa mọi ý tưởng sáng tạo.'
              : 'Explore electronics in an interactive 3D environment for free. Learn by doing, master core principles, and bring your hardware ideas to life.'}
          </p>

          {/* Dual Action CTA Buttons */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={onStartDesigning}
              className="tech-btn-3d px-8 py-4 rounded-2xl text-white font-extrabold text-sm sm:text-base flex items-center gap-3 cursor-pointer shadow-xl shadow-cyan-500/25"
            >
              <div className="w-6 h-6 rounded-lg bg-white/20 border border-white/40 flex items-center justify-center">
                <Box className="w-4 h-4 text-white" />
              </div>
              <span>{language === 'vi' ? 'Bắt đầu thiết kế ngay' : 'Start Designing Now'}</span>
              <ArrowRight className="w-4 h-4 text-white/90" />
            </button>

            <button
              onClick={onExploreLessons}
              className="px-8 py-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-extrabold text-sm sm:text-base border border-cyan-400/40 hover:border-cyan-300 transition-all flex items-center gap-2.5 backdrop-blur-md cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <span>{language === 'vi' ? 'Khám phá các khóa học' : 'Explore Courses'}</span>
            </button>
          </div>

          {/* Trust badges */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-cyan-200/80 font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {language === 'vi' ? 'Miễn phí bắt đầu' : 'Free to start'}
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {language === 'vi' ? 'Chạy ngay trên trình duyệt web' : 'Zero installation required'}
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {language === 'vi' ? 'Trợ lý AI Minibot đồng hành' : 'In-editor Minibot AI'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
