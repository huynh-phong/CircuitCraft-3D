import React, { useState } from 'react';
import { Cpu, Power, RotateCcw, Activity } from 'lucide-react';
import { useI18n } from '../../i18n/context';

interface CalloutItem {
  id: string;
  titleVi: string;
  titleEn: string;
  descVi: string;
  descEn: string;
  icon: 'usb' | 'cpu' | 'digital' | 'power' | 'reset' | 'analog';
  // CSS percentage positioning for card
  positionClass: string;
  // SVG leader line path in 1000x800 coordinate space
  pathD: string;
  // Target circle coordinate on the Arduino board
  target: { x: number; y: number };
}

const CALLOUTS: CalloutItem[] = [
  {
    id: 'reset',
    titleVi: 'Nút Reset',
    titleEn: 'Reset Button',
    descVi: 'Khởi động lại vi điều khiển',
    descEn: 'Restart microcontroller core',
    icon: 'reset',
    positionClass: 'top-[2%] left-[-15px] sm:left-[-25px] lg:left-[-35px]',
    pathD: 'M 195 65 L 290 65 L 290 284',
    target: { x: 290, y: 284 },
  },
  {
    id: 'usb',
    titleVi: 'USB Type-B',
    titleEn: 'USB Type-B',
    descVi: 'Nạp chương trình & cấp nguồn 5V',
    descEn: 'Program upload & 5V DC power',
    icon: 'usb',
    positionClass: 'top-[30%] left-[-25px] sm:left-[-35px] lg:left-[-45px]',
    pathD: 'M 185 285 L 235 285 L 235 365',
    target: { x: 235, y: 365 },
  },
  {
    id: 'digital',
    titleVi: 'Digital I/O 0–13',
    titleEn: 'Digital I/O 0–13',
    descVi: '14 chân Digital (hỗ trợ PWM)',
    descEn: '14 Digital Pins (PWM Support)',
    icon: 'digital',
    positionClass: 'top-[4%] right-[2%] sm:right-[3%]',
    pathD: 'M 730 75 L 579 75 L 579 189',
    target: { x: 579, y: 189 },
  },
  {
    id: 'cpu',
    titleVi: 'ATmega328P',
    titleEn: 'ATmega328P',
    descVi: 'Vi điều khiển chính',
    descEn: 'Main 8-bit Microcontroller',
    icon: 'cpu',
    positionClass: 'top-[36%] right-[1%] sm:right-[2%]',
    pathD: 'M 740 330 L 640 330 L 640 405',
    target: { x: 640, y: 405 },
  },
  {
    id: 'power',
    titleVi: 'Nguồn',
    titleEn: 'Power Supply',
    descVi: '5V / 3.3V / GND',
    descEn: '5V / 3.3V / GND',
    icon: 'power',
    positionClass: 'bottom-[6%] left-[6%] sm:left-[10%]',
    pathD: 'M 260 690 L 340 690 L 340 525',
    target: { x: 340, y: 525 },
  },
  {
    id: 'analog',
    titleVi: 'Analog A0–A5',
    titleEn: 'Analog A0–A5',
    descVi: '6 đầu vào Analog',
    descEn: '6 Analog Inputs',
    icon: 'analog',
    positionClass: 'bottom-[6%] right-[2%] sm:right-[3%]',
    pathD: 'M 740 680 L 673 680 L 673 495',
    target: { x: 673, y: 495 },
  },
];

export const ArduinoShowcase: React.FC = () => {
  const { language } = useI18n();
  const [hoveredCallout, setHoveredCallout] = useState<string | null>(null);

  const renderIcon = (type: CalloutItem['icon'], isHighlighted: boolean) => {
    const iconClass = isHighlighted
      ? 'w-4 h-4 text-cyan-400 drop-shadow-[0_0_8px_#00f0ff]'
      : 'w-4 h-4 text-cyan-500 dark:text-cyan-400';

    switch (type) {
      case 'usb':
        return (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="19" r="1.5" />
            <path d="M12 17.5V5" />
            <path d="M12 11l-4-3" />
            <circle cx="8" cy="8" r="1.5" />
            <path d="M12 8l4-3" />
            <rect x="15" y="4" width="3" height="3" />
            <path d="M10 3h4" />
          </svg>
        );
      case 'cpu':
        return <Cpu className={iconClass} />;
      case 'digital':
        return (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <path d="M7 14l2.5-4 3 4 2.5-4 2 4" />
          </svg>
        );
      case 'power':
        return <Power className={iconClass} />;
      case 'reset':
        return <RotateCcw className={iconClass} />;
      case 'analog':
        return <Activity className={iconClass} />;
    }
  };

  return (
    <div className="relative w-full max-w-[780px] aspect-[1000/800] mx-auto flex items-center justify-center select-none">
      {/* 1. Ambient Lighting & Floor Cyber Halo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Soft cyan atmospheric radial bloom */}
        <div className="absolute top-[22%] w-[80%] h-[56%] bg-gradient-to-t from-cyan-400/25 via-cyan-500/15 to-transparent dark:from-cyan-500/35 dark:via-cyan-400/15 blur-3xl rounded-full" />
        
        {/* Horizontal Laser Floor Line with Cyan Center Bloom */}
        <div className="absolute bottom-[24%] w-[94%] h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_16px_#00f0ff]" />
      </div>

      {/* 2. Concentric Holographic Stage (Beveled Elliptical Rings on floor) */}
      <div className="absolute inset-x-0 bottom-[6%] h-[50%] flex items-center justify-center pointer-events-none">
        {/* Outer Circular Stage Ring (Metallic & Beveled Depth) */}
        <div
          className="relative w-[92%] sm:w-[88%] h-[80%] rounded-[50%] border-4 border-cyan-400/40 dark:border-cyan-400/60 bg-gradient-to-b from-white/95 via-cyan-50/40 to-cyan-500/20 dark:from-[#08182d]/95 dark:via-[#051121]/80 dark:to-cyan-950/50 shadow-[0_20px_50px_rgba(6,182,212,0.35),inset_0_2px_4px_rgba(255,255,255,0.9)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_40px_rgba(6,182,212,0.35),inset_0_1px_2px_rgba(255,255,255,0.2)] flex items-center justify-center transition-all duration-300"
          style={{ transform: 'rotateX(60deg)' }}
        >
          {/* Concentric Neon Circular Track with Tick Marks */}
          <div className="w-[88%] h-[86%] rounded-[50%] border-2 border-dashed border-cyan-400 dark:border-cyan-300 shadow-[0_0_25px_#00f0ff] flex items-center justify-center animate-[spin_90s_linear_infinite]">
            {/* Inner Glowing Track */}
            <div className="w-[82%] h-[82%] rounded-[50%] border-2 border-cyan-300/80 dark:border-cyan-200/80 shadow-[0_0_18px_rgba(6,182,212,0.7)]" />
          </div>

          {/* Innermost Core Glowing Disc */}
          <div className="absolute w-[60%] h-[60%] rounded-[50%] bg-gradient-to-t from-cyan-400/35 to-teal-300/15 dark:from-cyan-500/50 dark:to-transparent border border-cyan-300 shadow-[0_0_35px_#00f0ff]" />
        </div>
      </div>

      {/* 3. High-Definition Transparent Arduino UNO R3 Board */}
      <div className="relative z-10 w-[64%] sm:w-[65%] flex items-center justify-center -translate-y-2 pointer-events-auto">
        <img
          src="/picture/ArdruinoUNO.png"
          alt="Arduino UNO R3 3D Circuit Board"
          className="w-full h-auto object-contain filter drop-shadow-[0_20px_35px_rgba(6,182,212,0.25)] dark:drop-shadow-[0_25px_45px_rgba(0,0,0,0.85)] drop-shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-transform duration-300 hover:scale-[1.02]"
        />
      </div>

      {/* 4. SVG Leader Lines Layer (Accurate component pins & glowing target dots) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-20"
        viewBox="0 0 1000 800"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="cyanGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {CALLOUTS.map((item) => {
          const isHighlighted = hoveredCallout === item.id;
          return (
            <g key={`leader-${item.id}`} className="transition-all duration-300">
              {/* Leader Line Trace */}
              <path
                d={item.pathD}
                stroke={isHighlighted ? '#38bdf8' : '#00e5ff'}
                strokeWidth={isHighlighted ? 3 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity={isHighlighted ? 1 : 0.85}
                filter="url(#cyanGlow)"
              />

              {/* Target Dot on Board Component */}
              <g transform={`translate(${item.target.x}, ${item.target.y})`}>
                {/* Outer pulsing halo ring */}
                <circle
                  r={isHighlighted ? 9 : 7}
                  fill="none"
                  stroke="#00f0ff"
                  strokeWidth={isHighlighted ? 2.5 : 1.8}
                  opacity={isHighlighted ? 1 : 0.75}
                  className="animate-pulse"
                />
                {/* Inner solid glowing core */}
                <circle
                  r={isHighlighted ? 4.5 : 3.5}
                  fill="#ffffff"
                  stroke="#00e5ff"
                  strokeWidth={1.5}
                />
              </g>
            </g>
          );
        })}
      </svg>

      {/* 5. The 6 Callout Cards (Neumorphic Glass Tiles) */}
      {CALLOUTS.map((item) => {
        const isHighlighted = hoveredCallout === item.id;
        const title = language === 'vi' ? item.titleVi : item.titleEn;
        const desc = language === 'vi' ? item.descVi : item.descEn;

        return (
          <div
            key={item.id}
            onMouseEnter={() => setHoveredCallout(item.id)}
            onMouseLeave={() => setHoveredCallout(null)}
            className={`absolute ${item.positionClass} z-30 transition-all duration-300 cursor-pointer ${
              isHighlighted ? '-translate-y-1 scale-[1.03]' : ''
            }`}
          >
            <div
              className={`flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl border transition-all duration-300 ${
                isHighlighted
                  ? 'bg-white/98 dark:bg-[#07162b]/95 border-cyan-400 dark:border-cyan-400 shadow-[0_12px_30px_rgba(6,182,212,0.35),0_0_20px_rgba(6,182,212,0.3)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.85),0_0_28px_rgba(6,182,212,0.45)]'
                  : 'bg-white/95 dark:bg-[#071324]/90 border-[#cbe6f7] dark:border-cyan-700/40 shadow-[0_8px_24px_rgba(6,182,212,0.14),0_2px_4px_rgba(0,0,0,0.04)] dark:shadow-[0_12px_28px_rgba(0,0,0,0.7),0_0_18px_rgba(6,182,212,0.18)]'
              } backdrop-blur-xl`}
            >
              {/* Mini Icon Tile */}
              <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-sky-400 to-teal-400 p-[1.5px] shadow-sm shadow-cyan-500/25 shrink-0">
                <div className="w-full h-full rounded-[10px] bg-cyan-50/70 dark:bg-[#08182b] flex items-center justify-center transition-all">
                  {renderIcon(item.icon, isHighlighted)}
                </div>
              </div>

              {/* Text Info */}
              <div className="text-left pr-0.5 sm:pr-1">
                <div className="font-extrabold text-[11px] sm:text-xs md:text-sm text-slate-900 dark:text-white tracking-tight leading-tight flex items-center gap-1.5">
                  <span>{title}</span>
                </div>
                <div className="text-[9px] sm:text-[10px] md:text-[11px] text-slate-500 dark:text-slate-300 font-medium leading-tight mt-0.5 whitespace-nowrap">
                  {desc}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
