import React from 'react';
import { Cpu, Home, Box, GraduationCap, ShoppingBag, ArrowLeft, AlertTriangle } from 'lucide-react';
import { useI18n } from '../i18n/context';

export interface NotFoundPageProps {
  currentPath?: string;
  onNavigate: (route: string) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ currentPath, onNavigate }) => {
  const { language } = useI18n();
  const displayPath = currentPath || (typeof window !== 'undefined' ? window.location.pathname : '/');

  return (
    <div className="flex-1 overflow-y-auto flex items-center justify-center p-6 text-slate-800 dark:text-slate-100 select-none animate-in fade-in duration-300">
      <div className="max-w-xl w-full p-8 sm:p-10 rounded-3xl tech-panel text-center relative overflow-hidden shadow-2xl border border-cyan-500/30">
        {/* Glow backdrop ambient */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* 404 Tech Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-500 dark:text-rose-400 text-xs font-mono font-bold mb-6">
          <AlertTriangle className="w-4 h-4 animate-pulse" />
          <span>ERROR 404 · CIRCUIT_NOT_FOUND</span>
        </div>

        {/* Huge 404 Glitch Style Display */}
        <div className="relative mb-6">
          <h1 className="text-7xl sm:text-8xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-cyan-400 to-sky-400 drop-shadow-sm font-mono">
            404
          </h1>
          <p className="text-xs uppercase font-mono tracking-widest text-slate-400 mt-2">
            Mã ngắt kết nối đường dẫn hệ thống
          </p>
        </div>

        {/* Error Explanation */}
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mb-3">
          {language === 'vi' ? 'Không tìm thấy trang yêu cầu' : 'Page Not Found'}
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-5 leading-relaxed">
          {language === 'vi'
            ? 'Đường dẫn bạn đang truy cập không tồn tại hoặc đã được di chuyển sang phân hệ khác.'
            : 'The URL you requested does not exist or has been relocated to another module.'}
        </p>

        {/* Target Path Display */}
        <div className="inline-block px-4 py-2 rounded-xl bg-slate-900/60 border border-slate-700/60 font-mono text-xs text-cyan-300 mb-8 max-w-full truncate shadow-inner">
          <span className="text-slate-500 mr-2">URL:</span>
          {displayPath}
        </div>

        {/* Quick Recovery Navigation Actions */}
        <div className="space-y-3">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {language === 'vi' ? 'Chuyển hướng đến các trang chính:' : 'Quick Navigation:'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              onClick={() => onNavigate('/')}
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-cyan-400 hover:bg-cyan-500/10 transition-all text-xs font-bold text-slate-700 dark:text-slate-200 group"
            >
              <Home className="w-4 h-4 text-cyan-500 mb-1 group-hover:scale-110 transition-transform" />
              <span>{language === 'vi' ? 'Trang chủ' : 'Home'}</span>
            </button>

            <button
              onClick={() => onNavigate('/projects')}
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-cyan-400 hover:bg-cyan-500/10 transition-all text-xs font-bold text-slate-700 dark:text-slate-200 group"
            >
              <Box className="w-4 h-4 text-cyan-500 mb-1 group-hover:scale-110 transition-transform" />
              <span>{language === 'vi' ? 'Dự án 3D' : 'Projects'}</span>
            </button>

            <button
              onClick={() => onNavigate('/courses')}
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-cyan-400 hover:bg-cyan-500/10 transition-all text-xs font-bold text-slate-700 dark:text-slate-200 group"
            >
              <GraduationCap className="w-4 h-4 text-cyan-500 mb-1 group-hover:scale-110 transition-transform" />
              <span>{language === 'vi' ? 'Khóa học' : 'Courses'}</span>
            </button>

            <button
              onClick={() => onNavigate('/marketplace')}
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-cyan-400 hover:bg-cyan-500/10 transition-all text-xs font-bold text-slate-700 dark:text-slate-200 group"
            >
              <ShoppingBag className="w-4 h-4 text-cyan-500 mb-1 group-hover:scale-110 transition-transform" />
              <span>{language === 'vi' ? 'Cửa hàng' : 'Store'}</span>
            </button>
          </div>

          <div className="pt-4 flex items-center justify-center">
            <button
              onClick={() => onNavigate('/')}
              className="tech-btn-3d flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-extrabold text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{language === 'vi' ? 'Quay lại Trang chủ ngay' : 'Return to Home'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
