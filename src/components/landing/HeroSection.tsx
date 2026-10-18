import React, { useState, useEffect } from 'react';
import { Box, Sparkles, BookOpen, ArrowRight, Zap, GraduationCap, ChevronDown } from 'lucide-react';
import { useI18n } from '../../i18n/context';
import { ArduinoShowcase } from './ArduinoShowcase';

export interface HeroSectionProps {
  onStartDesigning: () => void;
  onExploreLessons: () => void;
  onScrollDown: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onStartDesigning,
  onExploreLessons,
  onScrollDown,
}) => {
  const { language } = useI18n();
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 80) {
        setHasScrolled(true);
      } else {
        setHasScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section className="relative px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-8 min-h-[calc(100vh-80px)] flex flex-col justify-between">
      {/* Background Ambient Glow & Subtle Circuit Grid */}
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[10%] left-[5%] w-[45%] h-[50%] bg-gradient-to-br from-cyan-400/10 via-sky-500/5 to-transparent blur-3xl rounded-full" />
        <div className="absolute top-[15%] right-[5%] w-[40%] h-[55%] bg-gradient-to-bl from-teal-400/10 via-cyan-500/5 to-transparent blur-3xl rounded-full" />
      </div>

      <div className="max-w-[1400px] w-full mx-auto flex flex-col lg:flex-row items-center gap-8 lg:gap-6 justify-between my-auto">
        {/* ========================================================================= */}
        {/* HERO LEFT (45% – 48%)                                                     */}
        {/* ========================================================================= */}
        <div className="w-full lg:w-[47%] space-y-6 sm:space-y-7 text-left z-10 animate-in fade-in slide-in-from-left-4 duration-500">
          {/* Top Pill Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/95 dark:bg-[#061224]/95 border border-[#bfe3f7] dark:border-cyan-800/50 text-[#0284c7] dark:text-[#38bdf8] text-xs font-bold shadow-[0_4px_16px_rgba(6,182,212,0.12)] dark:shadow-[0_4px_20px_rgba(6,182,212,0.25)] transition-all duration-200 hover:-translate-y-0.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-500 animate-pulse" />
            <span>
              {language === 'vi'
                ? 'Nền tảng học tập & mô phỏng mạch điện 3D thế hệ mới'
                : 'Next-Generation 3D Circuit Learning & Simulation Platform'}
            </span>
          </div>

          {/* Massive Tech Headline with Sequential Reveal */}
          <h1 className="text-4xl sm:text-5xl lg:text-[54px] xl:text-[60px] font-black tracking-tight leading-[1.08] transition-colors duration-300">
            <span className="text-[#0c192c] dark:text-[#f8fafc]">
              {language === 'vi' ? 'Thiết kế & Khám phá' : 'Design & Explore'}
            </span>{' '}
            <br />
            <span className="bg-gradient-to-r from-[#0094ff] via-[#00c5df] to-[#00d89f] bg-clip-text text-transparent">
              {language === 'vi' ? 'Mạch Điện Tử Trong' : 'Electronic Circuits'}
            </span>{' '}
            <br />
            <span className="bg-gradient-to-r from-[#0094ff] via-[#00c5df] to-[#00d89f] bg-clip-text text-transparent">
              {language === 'vi' ? 'Không Gian 3D' : 'in 3D Space'}
            </span>
          </h1>

          {/* Subtitle Description */}
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed font-normal transition-colors duration-300">
            {language === 'vi'
              ? 'Học tập trực quan với linh kiện 3D tương tác, mô phỏng dòng điện thời gian thực, và sự đồng hành của trợ lý ảo Minibot thông minh.'
              : 'Interactive 3D electronic components, real-time DC simulation, and smart AI Minibot assistant on your browser.'}
          </p>

          {/* CTA Buttons Row */}
          <div className="flex flex-wrap items-center gap-4 pt-1">
            {/* PRIMARY 3D BUTTON */}
            <button
              onClick={onStartDesigning}
              className="tech-btn-3d group flex items-center gap-3 px-6 sm:px-7 py-3.5 rounded-2xl text-white font-extrabold text-sm sm:text-base tracking-wide cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-white/20 border border-white/40 flex items-center justify-center shadow-xs">
                <Box className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
              </div>
              <span>{language === 'vi' ? 'Vào phòng thí nghiệm 3D' : 'Enter 3D Lab'}</span>
              <ArrowRight className="w-4 h-4 text-white/90 transition-transform group-hover:translate-x-1 drop-shadow-xs" />
            </button>

            {/* SECONDARY 3D BUTTON */}
            <button
              onClick={onExploreLessons}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-[22px] bg-white/95 dark:bg-[#0c1a2e]/90 hover:bg-slate-50 dark:hover:bg-[#11243d] text-slate-900 dark:text-slate-100 font-bold text-sm sm:text-base border border-[#cbe6f7] dark:border-cyan-800/40 shadow-[0_8px_20px_rgba(6,182,212,0.08)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)] hover:shadow-[0_10px_24px_rgba(6,182,212,0.15)] transition-all duration-200 transform hover:-translate-y-0.5 active:scale-[0.97] active:translate-y-0.5 cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-cyan-50 dark:bg-cyan-950/80 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <span>{language === 'vi' ? 'Khóa học thực hành' : 'Interactive Courses'}</span>
            </button>
          </div>

          {/* 3 Bottom Feature Cards */}
          <div className="flex flex-wrap items-center gap-3 pt-3">
            {/* Feature Card 1: 3D Models */}
            <div className="group flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/95 dark:bg-[#061224]/95 border border-[#cbe6f7] dark:border-cyan-800/40 shadow-[0_6px_18px_rgba(6,182,212,0.1)] dark:shadow-[0_6px_20px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400 dark:hover:border-cyan-500">
              <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200/80 dark:border-cyan-800/80 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0 group-hover:scale-105 transition-transform duration-200">
                <Box className="w-4 h-4" />
              </div>
              <div className="text-left pr-1">
                <div className="text-xs font-extrabold text-slate-900 dark:text-white leading-tight">
                  {language === 'vi' ? 'Mô hình 3D' : '3D Models'}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 font-medium">
                  {language === 'vi' ? 'chất lượng cao' : 'High Quality'}
                </div>
              </div>
            </div>

            {/* Feature Card 2: Simulation */}
            <div className="group flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/95 dark:bg-[#061224]/95 border border-[#cbe6f7] dark:border-cyan-800/40 shadow-[0_6px_18px_rgba(6,182,212,0.1)] dark:shadow-[0_6px_20px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400 dark:hover:border-cyan-500">
              <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200/80 dark:border-cyan-800/80 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0 group-hover:scale-105 transition-transform duration-200">
                <Zap className="w-4 h-4" />
              </div>
              <div className="text-left pr-1">
                <div className="text-xs font-extrabold text-slate-900 dark:text-white leading-tight">
                  {language === 'vi' ? 'Mô phỏng' : 'Simulation'}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 font-medium">
                  {language === 'vi' ? 'thời gian thực' : 'Real-time'}
                </div>
              </div>
            </div>

            {/* Feature Card 3: Labs & Projects */}
            <div className="group flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/95 dark:bg-[#061224]/95 border border-[#cbe6f7] dark:border-cyan-800/40 shadow-[0_6px_18px_rgba(6,182,212,0.1)] dark:shadow-[0_6px_20px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400 dark:hover:border-cyan-500">
              <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200/80 dark:border-cyan-800/80 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0 group-hover:scale-105 transition-transform duration-200">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div className="text-left pr-1">
                <div className="text-xs font-extrabold text-slate-900 dark:text-white leading-tight">
                  {language === 'vi' ? 'Bài tập & dự án' : 'Labs & Projects'}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 font-medium">
                  {language === 'vi' ? 'thực hành' : 'Interactive'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* HERO RIGHT (52% – 55%) — 3D Showcase Stage                                */}
        {/* ========================================================================= */}
        <div className="w-full lg:w-[53%] relative flex items-center justify-center pt-4 lg:pt-0 animate-in fade-in slide-in-from-right-4 duration-500">
          <ArduinoShowcase />
        </div>
      </div>

      {/* Scroll Invitation Indicator */}
      <div
        className={`w-full flex justify-center pt-4 pb-2 transition-opacity duration-300 ${
          hasScrolled ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <button
          onClick={onScrollDown}
          className="group flex flex-col items-center gap-1.5 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition cursor-pointer"
          aria-label={language === 'vi' ? 'Cuộn xuống khám phá' : 'Scroll to explore'}
        >
          <span className="text-[11px] font-bold tracking-widest uppercase">
            {language === 'vi' ? 'Cuộn để khám phá' : 'Scroll to Explore'}
          </span>
          <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center group-hover:scale-110 transition shadow-xs">
            <ChevronDown className="w-4 h-4 text-cyan-500 animate-bounce" />
          </div>
        </button>
      </div>
    </section>
  );
};
