import React, { useState } from 'react';
import { Box, Eye, Layers, Zap, ShieldCheck, History, ArrowRight, Maximize2, RotateCcw } from 'lucide-react';
import { useI18n } from '../../i18n/context';

export interface WorkspaceShowcaseSectionProps {
  onStartDesigning: () => void;
}

export const WorkspaceShowcaseSection: React.FC<WorkspaceShowcaseSectionProps> = ({
  onStartDesigning,
}) => {
  const { language } = useI18n();
  const [selectedFeature, setSelectedFeature] = useState<string>('camera');

  const features = [
    {
      id: 'camera',
      icon: Eye,
      titleVi: 'Xoay Camera 360° & Góc nhìn chuẩn',
      titleEn: '360° Orbit & Camera Presets',
      descVi: 'Tự do xoay, phóng to, thu nhỏ mượt mà với quán tính cao cấp. Chuyển đổi nhanh giữa góc nhìn Trực diện (Top), Nghiêng (Isometric) và Chiếu cạnh (Side).',
      descEn: 'Fluid 360° camera orbit with damped inertia. Instant switching between Top-down, Isometric 3D, and Side inspection views.',
    },
    {
      id: 'snapping',
      icon: Layers,
      titleVi: 'Cơ chế hút chân Breadboard 2.54mm',
      titleEn: '2.54mm Grid Pin Snapping',
      descVi: 'Không cần căng mắt chỉnh tay. Linh kiện tự động hút chuẩn xác vào các lỗ cắm breadboard theo bước chân chuẩn quốc tế 2.54mm.',
      descEn: 'Zero micro-alignment hassle. Pins snap seamlessly to international standard 2.54mm breadboard tie-points.',
    },
    {
      id: 'wires',
      icon: Zap,
      titleVi: 'Dây dẫn Bezier uốn lượn thông minh',
      titleEn: 'Dynamic Bezier Wiring',
      descVi: 'Thuật toán tính toán đường cong Bezier tự nhiên theo thời gian thực. Tùy chọn mã màu chuẩn công nghiệp (Đỏ VCC, Đen GND, Xanh tín hiệu).',
      descEn: 'Real-time Bezier spline generation for organic wire curves. Standardized color coding (Red VCC, Black GND, Cyan Signals).',
    },
    {
      id: 'drc',
      icon: ShieldCheck,
      titleVi: 'Kiểm tra luật thiết kế mạch (DRC)',
      titleEn: 'Real-Time DRC Rule Checker',
      descVi: 'Tự động phát hiện đoản mạch, chân linh kiện lơ lửng, hoặc LED thiếu điện trở bảo vệ trước khi cấp nguồn, bảo đảm mạch hoàn toàn an toàn.',
      descEn: 'Instant detection of short circuits, floating pins, and unprotected LEDs prior to running live current.',
    },
    {
      id: 'history',
      icon: History,
      titleVi: 'Quản lý lịch sử Undo/Redo & JSON',
      titleEn: 'Undo/Redo & JSON Export/Import',
      descVi: 'Lưu trữ tới 50 bước thao tác, hỗ trợ hoàn tác tức thì. Xuất file mạch dạng JSON tiêu chuẩn để lưu trữ hoặc chia sẻ với bạn bè.',
      descEn: '50-step undo/redo stack for fear-free experimentation. Export & import standard JSON circuit files anytime.',
    },
  ];

  const currentFeature = features.find((f) => f.id === selectedFeature) || features[0];

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-[1380px] mx-auto select-none">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200/80 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-xs font-bold uppercase tracking-wider">
          <Box className="w-3.5 h-3.5 text-cyan-500" />
          <span>{language === 'vi' ? 'Không gian thiết kế chuyên nghiệp' : 'Engineering Workspace'}</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          {language === 'vi' ? 'Phòng thí nghiệm điện tử 3D. ' : 'Your Electronics Lab. '}
          <span className="bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 bg-clip-text text-transparent">
            {language === 'vi' ? 'Ngay trên trình duyệt.' : 'In Your Browser.'}
          </span>
        </h2>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
          {language === 'vi'
            ? 'Trải nghiệm không gian thiết kế CAD 3D hiện đại với đầy đủ công cụ của một kỹ sư vi mạch: xoay tự do, cắm dây thông minh, chẩn đoán lỗi tức thì.'
            : 'Experience a modern 3D CAD workspace equipped with everything a hardware engineer needs: 360° orbit, smart wiring, and live DRC diagnostics.'}
        </p>
      </div>

      {/* Big Workspace Showcase Frame */}
      <div className="rounded-[32px] overflow-hidden border border-[#bfe3f7] dark:border-cyan-500/40 bg-white/95 dark:bg-[#061224]/95 shadow-[0_24px_70px_rgba(6,182,212,0.18)] dark:shadow-[0_25px_80px_rgba(0,0,0,0.8),_0_0_35px_rgba(6,182,212,0.2)] backdrop-blur-2xl">
        {/* Workspace Toolbar Mockup Header */}
        <div className="px-6 py-4 border-b border-[#e0f2fe] dark:border-cyan-900/60 bg-gradient-to-r from-slate-50 via-white to-cyan-50/50 dark:from-[#08182b] dark:via-[#071526] dark:to-[#091b30] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>CircuitCraft 3D CAD Viewport</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 font-bold">
                  60 FPS WebGL
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Project: UNO_R3_Core_Breadboard.cc3d
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onStartDesigning}
              className="tech-btn-3d px-5 py-2.5 rounded-xl text-white font-extrabold text-xs flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>{language === 'vi' ? 'Vào phòng thí nghiệm 3D' : 'Launch 3D Workspace'}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </div>

        {/* Feature Navigation Tabs */}
        <div className="p-3 bg-slate-100/70 dark:bg-[#071324]/80 border-b border-[#e2e8f0] dark:border-cyan-950 flex flex-wrap gap-2">
          {features.map((f) => {
            const Icon = f.icon;
            const isSelected = f.id === selectedFeature;

            return (
              <button
                key={f.id}
                onClick={() => setSelectedFeature(f.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'bg-white/80 dark:bg-[#0b1c30] text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-[#0f243d]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{language === 'vi' ? f.titleVi.split('&')[0].trim() : f.titleEn.split('&')[0].trim()}</span>
              </button>
            );
          })}
        </div>

        {/* CAD Canvas Preview Stage */}
        <div className="relative aspect-[16/9] max-h-[520px] bg-gradient-to-b from-[#08182b] via-[#051120] to-[#030b15] flex items-center justify-center overflow-hidden p-6 text-center select-none">
          {/* Subtle 3D Grid Overlay */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #00f0ff 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Central Image and Highlights */}
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 border-2 border-cyan-400 text-cyan-400 flex items-center justify-center mx-auto shadow-[0_0_35px_rgba(6,182,212,0.3)] animate-pulse">
              {React.createElement(currentFeature.icon, { className: 'w-10 h-10' })}
            </div>

            <div>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {language === 'vi' ? currentFeature.titleVi : currentFeature.titleEn}
              </h3>
              <p className="text-xs sm:text-sm text-cyan-200/90 max-w-lg mx-auto leading-relaxed mt-2 font-normal">
                {language === 'vi' ? currentFeature.descVi : currentFeature.descEn}
              </p>
            </div>

            {/* Quick Action Bar inside preview */}
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={onStartDesigning}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-xs shadow-lg shadow-cyan-500/25 transition cursor-pointer flex items-center gap-2"
              >
                <span>{language === 'vi' ? 'Khám phá ngay' : 'Try it Live'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
