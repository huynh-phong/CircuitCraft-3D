import React from 'react';
import { Layers, X } from 'lucide-react';
import { useI18n } from '../i18n/context';

export interface PresentationControlsProps {
  isExplodedView: boolean;
  onToggleExplodedView: () => void;
  onExitPresentation: () => void;
}

export const PresentationControls: React.FC<PresentationControlsProps> = ({
  isExplodedView,
  onToggleExplodedView,
  onExitPresentation,
}) => {
  const { language } = useI18n();

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl select-none">
      <div className="flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-slate-800">
        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
          {language === 'vi' ? 'Chế độ Trình chiếu 3D' : '3D Presentation Mode'}
        </span>
      </div>

      <button
        onClick={onToggleExplodedView}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
          isExplodedView
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750'
        }`}
        title={language === 'vi' ? 'Tách các lớp linh kiện lên không trung theo thứ tự tầng' : 'Disassemble component layers upwards'}
      >
        <Layers className="w-3.5 h-3.5" />
        <span>
          {isExplodedView
            ? language === 'vi'
              ? 'Thu gọn linh kiện'
              : 'Collapse View'
            : language === 'vi'
            ? 'Nổ tung chi tiết (Exploded)'
            : 'Exploded View'}
        </span>
      </button>

      <button
        onClick={onExitPresentation}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition"
        title={language === 'vi' ? 'Thoát về giao diện biên tập thiết kế' : 'Exit to Editor'}
      >
        <X className="w-3.5 h-3.5" />
        <span>{language === 'vi' ? 'Thoát' : 'Exit'}</span>
      </button>
    </div>
  );
};
