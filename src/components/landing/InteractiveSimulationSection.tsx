import React, { useState } from 'react';
import { Zap, Power, Sliders, Activity, Info, CheckCircle2, RefreshCw } from 'lucide-react';
import { useI18n } from '../../i18n/context';

export const InteractiveSimulationSection: React.FC = () => {
  const { language } = useI18n();
  const [isSwitchClosed, setIsSwitchClosed] = useState<boolean>(true);
  const [potResistance, setPotResistance] = useState<number>(300); // 0 to 2000 ohms
  const baseResistor = 220; // Ohms
  const vcc = 5.0; // Volts
  const vLed = 2.0; // Volts forward drop

  // Calculations
  const totalResistance = baseResistor + potResistance;
  const currentMa = isSwitchClosed ? ((vcc - vLed) / totalResistance) * 1000 : 0;
  const ledBrightness = isSwitchClosed ? Math.min(1, Math.max(0.1, currentMa / 14)) : 0;

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-[1380px] mx-auto select-none">
      {/* Background Accent */}
      <div className="absolute inset-0 pointer-events-none -z-10 flex items-center justify-center">
        <div className="w-[85%] h-[55%] bg-gradient-to-r from-teal-500/5 via-cyan-400/8 to-blue-500/5 blur-3xl rounded-full" />
      </div>

      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200/80 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-xs font-bold uppercase tracking-wider">
          <Activity className="w-3.5 h-3.5 text-cyan-500" />
          <span>{language === 'vi' ? 'Thử nghiệm trực tiếp' : 'Interactive Demo'}</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          {language === 'vi' ? 'Không chỉ lắp ráp. ' : "Don't Just Build It. "}
          <span className="bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 bg-clip-text text-transparent">
            {language === 'vi' ? 'Hãy thấu hiểu nguyên lý.' : 'Understand How It Works.'}
          </span>
        </h2>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
          {language === 'vi'
            ? 'Tương tác với mạch phân áp DC ngay bên dưới: gạt công tắc, xoay chiết áp và quan sát định luật Ohm vận hành theo thời gian thực.'
            : 'Interact with a live DC voltage divider below: toggle the switch, turn the potentiometer, and observe Ohm’s Law in real-time.'}
        </p>
      </div>

      {/* Interactive Circuit Workbench Card */}
      <div className="rounded-[32px] overflow-hidden border border-cyan-300/80 dark:border-cyan-500/40 bg-white/95 dark:bg-[#071526]/95 shadow-[0_20px_60px_rgba(6,182,212,0.16)] dark:shadow-[0_25px_80px_rgba(0,0,0,0.8),_0_0_35px_rgba(6,182,212,0.2)] backdrop-blur-2xl p-6 sm:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Controls & Measurements (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-cyan-900/60">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {language === 'vi' ? 'Bảng điều khiển thực nghiệm' : 'Circuit Controls'}
              </span>
              <button
                onClick={() => {
                  setIsSwitchClosed(true);
                  setPotResistance(300);
                }}
                className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? 'Đặt lại' : 'Reset'}</span>
              </button>
            </div>

            {/* Switch Toggle Control */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0b1e33] border border-slate-200 dark:border-cyan-900/50 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {language === 'vi' ? 'Công tắc SPST' : 'SPST Power Switch'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                  {isSwitchClosed ? (language === 'vi' ? 'ĐÓNG (Mạch kín)' : 'CLOSED (Active)') : (language === 'vi' ? 'MỞ (Mạch hở)' : 'OPEN (Cutoff)')}
                </div>
              </div>

              <button
                onClick={() => setIsSwitchClosed(!isSwitchClosed)}
                className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-xs ${
                  isSwitchClosed
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
                    : 'bg-slate-300 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{isSwitchClosed ? (language === 'vi' ? 'BẬT' : 'ON') : (language === 'vi' ? 'TẮT' : 'OFF')}</span>
              </button>
            </div>

            {/* Potentiometer Slider Control */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0b1e33] border border-slate-200 dark:border-cyan-900/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-cyan-500" />
                  <span>{language === 'vi' ? 'Biến trở Potentiometer' : 'Potentiometer'}</span>
                </span>
                <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-800">
                  {potResistance} Ω
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="1500"
                step="50"
                value={potResistance}
                onChange={(e) => setPotResistance(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer h-2 bg-slate-200 dark:bg-slate-800 rounded-lg"
              />

              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0 Ω (Sáng tối đa)</span>
                <span>1500 Ω (Dimmer tối)</span>
              </div>
            </div>

            {/* Live Measurements Readout */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="p-3 rounded-xl bg-white dark:bg-[#0a1a2e] border border-slate-200 dark:border-cyan-950 text-center shadow-xs">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Nguồn VCC</span>
                <span className="text-sm font-black font-mono text-cyan-600 dark:text-cyan-400">5.00 V</span>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-[#0a1a2e] border border-slate-200 dark:border-cyan-950 text-center shadow-xs">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Tổng trở R</span>
                <span className="text-sm font-black font-mono text-slate-800 dark:text-slate-200">{totalResistance} Ω</span>
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-[#0a1a2e] border border-slate-200 dark:border-cyan-950 text-center shadow-xs">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Dòng điện I</span>
                <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {currentMa.toFixed(1)} mA
                </span>
              </div>
            </div>
          </div>

          {/* Right Live Visual Simulation Viewport (7 Cols) */}
          <div className="lg:col-span-7">
            <div className="relative aspect-[16/10] rounded-[26px] overflow-hidden bg-gradient-to-b from-[#091b30] via-[#061426] to-[#040e1b] border border-cyan-500/40 p-6 flex flex-col justify-between select-none shadow-xl">
              {/* Header Indicator */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-cyan-400 font-bold flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isSwitchClosed ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
                  {isSwitchClosed ? 'SIMULATION_ACTIVE (DC SOLVER)' : 'CIRCUIT_OPEN'}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Ohm's Law: I = (Vcc - Vled) / R
                </span>
              </div>

              {/* Dynamic Animated Circuit Visual with SVG flow */}
              <div className="relative my-auto flex items-center justify-center py-4">
                {/* SVG Circuit Line with flowing current dashes */}
                <svg className="w-full h-36" viewBox="0 0 400 120" fill="none">
                  {/* Base Wire Trace */}
                  <path
                    d="M 30 60 L 110 60 L 190 60 L 270 60 L 370 60"
                    stroke={isSwitchClosed ? '#00e5ff' : '#475569'}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />

                  {/* Flowing current dashes if active */}
                  {isSwitchClosed && (
                    <path
                      d="M 30 60 L 110 60 L 190 60 L 270 60 L 370 60"
                      stroke="#ffffff"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeDasharray="8 12"
                      className="animate-[dash_0.8s_linear_infinite]"
                    />
                  )}

                  {/* Component Node Markers */}
                  <circle cx="30" cy="60" r="7" fill="#38bdf8" />
                  <circle cx="110" cy="60" r="7" fill="#38bdf8" />
                  <circle cx="190" cy="60" r="7" fill="#38bdf8" />
                  <circle cx="270" cy="60" r="7" fill="#38bdf8" />
                  <circle cx="370" cy="60" r="7" fill="#38bdf8" />
                </svg>

                {/* Overlay Component Badges */}
                <div className="absolute top-2 left-[4%] text-center">
                  <span className="text-[10px] font-mono text-cyan-300 bg-[#071a2e] px-2 py-0.5 rounded border border-cyan-500/40">
                    VCC (+5V)
                  </span>
                </div>

                <div className="absolute top-2 left-[25%] text-center">
                  <span className="text-[10px] font-mono text-amber-300 bg-[#071a2e] px-2 py-0.5 rounded border border-amber-500/40">
                    SW ({isSwitchClosed ? 'ON' : 'OFF'})
                  </span>
                </div>

                <div className="absolute top-2 left-[45%] text-center">
                  <span className="text-[10px] font-mono text-cyan-300 bg-[#071a2e] px-2 py-0.5 rounded border border-cyan-500/40">
                    POT ({potResistance}Ω)
                  </span>
                </div>

                <div className="absolute top-2 left-[64%] text-center">
                  <span className="text-[10px] font-mono text-cyan-300 bg-[#071a2e] px-2 py-0.5 rounded border border-cyan-500/40">
                    R (220Ω)
                  </span>
                </div>

                {/* Central Dynamic LED Indicator */}
                <div className="absolute right-[4%] top-1/2 -translate-y-1/2 flex flex-col items-center">
                  <div
                    className="w-14 h-14 rounded-full transition-all duration-200 flex items-center justify-center border-2 border-white/60 shadow-lg"
                    style={{
                      backgroundColor: isSwitchClosed ? `rgba(244, 63, 94, ${0.4 + ledBrightness * 0.6})` : '#334155',
                      boxShadow: isSwitchClosed
                        ? `0 0 ${20 + ledBrightness * 40}px rgba(244, 63, 94, ${ledBrightness * 0.9})`
                        : 'none',
                    }}
                  >
                    <span className="text-[11px] font-black text-white font-mono">
                      {isSwitchClosed ? `${Math.round(ledBrightness * 100)}%` : 'OFF'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-rose-300 mt-2 font-bold">
                    LED Đỏ (2.0V)
                  </span>
                </div>
              </div>

              {/* Educational Disclaimer Bottom Bar */}
              <div className="pt-3 border-t border-cyan-900/60 flex items-center gap-2 text-xs text-cyan-200/90">
                <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  {language === 'vi'
                    ? 'Minh họa trực quan dựa trên thuật toán giải mạch thời gian thực của CircuitCraft 3D.'
                    : 'Visual demonstration powered by CircuitCraft 3D real-time simulation principles.'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
