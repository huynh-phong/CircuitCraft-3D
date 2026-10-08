import React from 'react';
import { AlertTriangle, RefreshCw, Copy, ShieldAlert } from 'lucide-react';
import { useI18n } from '../i18n/context';

export interface ConcurrencyConflictModalProps {
  isOpen: boolean;
  projectName: string;
  localRevision: number;
  remoteRevision: number;
  onReloadRemote: () => void;
  onSaveAsCopy: () => void;
  onForceOverwrite: () => void;
  onCancel: () => void;
}

export const ConcurrencyConflictModal: React.FC<ConcurrencyConflictModalProps> = ({
  isOpen,
  projectName,
  localRevision,
  remoteRevision,
  onReloadRemote,
  onSaveAsCopy,
  onForceOverwrite,
  onCancel,
}) => {
  const { language } = useI18n();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-500/50 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-800 dark:text-slate-100">
        <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg border border-amber-200 dark:border-amber-500/30">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {language === 'vi' ? 'Xung đột phiên bản dữ liệu (OCC)' : 'Data Concurrency Conflict (OCC)'}
            </h2>
            <p className="text-xs text-amber-700 dark:text-amber-400/80">
              {language === 'vi'
                ? 'Dự án đã được chỉnh sửa và lưu từ thiết bị hoặc tab khác'
                : 'Project was modified and saved from another device or browser tab'}
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-3">
          <p>
            {language === 'vi' ? (
              <>Dự án <span className="font-semibold text-slate-900 dark:text-white">"{projectName}"</span> trên Cloud đang có phiên bản mới hơn phiên bản bạn đang làm việc:</>
            ) : (
              <>Project <span className="font-semibold text-slate-900 dark:text-white">"{projectName}"</span> on Cloud has a newer version than your local workspace:</>
            )}
          </p>

          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-950/80 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-[11px]">
            <div>
              <span className="text-slate-400 dark:text-slate-500 block">
                {language === 'vi' ? 'Bản đang mở (Local):' : 'Active Local:'}
              </span>
              <span className="text-amber-600 dark:text-amber-400 font-bold">Revision #{localRevision}</span>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500 block">
                {language === 'vi' ? 'Bản trên Cloud (Remote):' : 'Cloud Version:'}
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Revision #{remoteRevision}</span>
            </div>
          </div>

          <p className="text-slate-500 dark:text-slate-400 text-[11px]">
            {language === 'vi'
              ? 'Để tránh việc âm thầm ghi đè làm mất công sức thiết kế của phiên làm việc khác, vui lòng chọn cách xử lý:'
              : 'To avoid accidental data loss and maintain project integrity, please choose an action:'}
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <button
            onClick={onReloadRemote}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-cyan-50 dark:bg-cyan-600/20 hover:bg-cyan-100 dark:hover:bg-cyan-600/30 border border-cyan-200 dark:border-cyan-500/40 text-cyan-800 dark:text-cyan-200 transition text-xs font-semibold"
          >
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>{language === 'vi' ? 'Tải lại bản mới nhất từ Cloud (Khuyên dùng)' : 'Reload newest from Cloud (Recommended)'}</span>
            </div>
            <span className="text-[10px] text-cyan-600 dark:text-cyan-400/70">#rev {remoteRevision}</span>
          </button>

          <button
            onClick={onSaveAsCopy}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition text-xs font-semibold"
          >
            <div className="flex items-center gap-2">
              <Copy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{language === 'vi' ? 'Lưu các thay đổi này thành một Bản sao mới' : 'Save changes as a new Project copy'}</span>
            </div>
            <span className="text-[10px] text-slate-400">{language === 'vi' ? 'Tạo copy' : 'New Copy'}</span>
          </button>

          <button
            onClick={onForceOverwrite}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-rose-50 dark:bg-red-950/30 hover:bg-rose-100 dark:hover:bg-red-900/40 border border-rose-200 dark:border-red-800/40 text-rose-700 dark:text-red-300 transition text-xs"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-red-400" />
              <span>{language === 'vi' ? 'Ghi đè bản trên Cloud (Bắt buộc)' : 'Force overwrite Cloud copy'}</span>
            </div>
            <span className="text-[10px] text-rose-600 dark:text-red-400/70">{language === 'vi' ? 'Nguy hiểm' : 'Dangerous'}</span>
          </button>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition"
          >
            {language === 'vi' ? 'Đóng thông báo' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
