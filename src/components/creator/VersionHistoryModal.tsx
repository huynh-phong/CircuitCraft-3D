import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  History,
  CheckCircle2,
  Calendar,
  Box,
  Plus,
  AlertCircle,
  RotateCw,
  Cpu,
  ArrowUpRight,
} from 'lucide-react';
import { ProjectDocument } from '../../domain/project/types';
import { useI18n } from '../../i18n/context';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  currentProject?: ProjectDocument;
  onVersionCreated?: () => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  product,
  currentProject,
  onVersionCreated,
}) => {
  const { language } = useI18n();
  const [versions, setVersions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newVersionNumber, setNewVersionNumber] = useState('1.1.0');
  const [newReleaseNotes, setNewReleaseNotes] = useState('Cập nhật linh kiện và tối ưu sơ đồ nối dây 3D.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !product?.id) return;
    setIsLoading(true);
    fetch(`/api/creator/products/${product.id}/versions`)
      .then((res) => (res.ok ? res.json() : { versions: [] }))
      .then((data) => {
        setVersions(data.versions || []);
      })
      .catch((err) => console.error('Error fetching versions:', err))
      .finally(() => setIsLoading(false));
  }, [isOpen, product]);

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product?.id) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/creator/products/${product.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionNumber: newVersionNumber.trim(),
          releaseNotes: newReleaseNotes.trim(),
          projectDocument: currentProject,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Không thể tạo phiên bản mới');
      }

      const data = await res.json();
      if (data.success) {
        setIsCreatingNew(false);
        // Refresh versions list
        const res2 = await fetch(`/api/creator/products/${product.id}/versions`);
        const d2 = await res2.json();
        setVersions(d2.versions || []);
        if (onVersionCreated) onVersionCreated();
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo phiên bản');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in select-none">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-cyan-50 to-slate-100 dark:from-cyan-950 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-600 text-white flex items-center justify-center shadow-md">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {language === 'vi' ? 'Lịch sử Phiên bản Bất biến' : 'Immutable Version History'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-sm">
                {product.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* New version form toggle */}
          {!isCreatingNew ? (
            <button
              onClick={() => setIsCreatingNew(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/70 font-bold flex items-center justify-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>
                {language === 'vi'
                  ? 'Phát hành phiên bản mới từ mạch hiện tại (New Release)'
                  : 'Release New Version from Active Project'}
              </span>
            </button>
          ) : (
            <form
              onSubmit={handleCreateVersion}
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3"
            >
              <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>{language === 'vi' ? 'Phát hành bản cập nhật mới' : 'Create New Release'}</span>
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="text-slate-400 hover:text-slate-200 text-[11px]"
                >
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'vi' ? 'Số hiệu phiên bản' : 'Version Number'}
                </label>
                <input
                  type="text"
                  required
                  value={newVersionNumber}
                  onChange={(e) => setNewVersionNumber(e.target.value)}
                  placeholder="1.1.0"
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'vi' ? 'Ghi chú thay đổi (Release Notes)' : 'Release Notes'}
                </label>
                <textarea
                  required
                  rows={2}
                  value={newReleaseNotes}
                  onChange={(e) => setNewReleaseNotes(e.target.value)}
                  placeholder="Mô tả các cải tiến, sửa lỗi linh kiện hoặc tối ưu kích thước..."
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
                >
                  {isSubmitting ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{language === 'vi' ? 'Đang tạo snapshot...' : 'Snapshotting...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{language === 'vi' ? 'Xác nhận phát hành' : 'Publish Version'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Versions List */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {language === 'vi' ? 'Các phiên bản đã lưu trữ:' : 'Stored Snapshots:'}
            </span>

            {isLoading ? (
              <div className="p-6 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RotateCw className="w-4 h-4 animate-spin text-cyan-400" />
                <span>{language === 'vi' ? 'Đang tải danh sách...' : 'Loading versions...'}</span>
              </div>
            ) : versions.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-400 text-center">
                {language === 'vi' ? 'Chưa có phiên bản nào được tạo.' : 'No version snapshots yet.'}
              </div>
            ) : (
              versions.map((ver) => {
                const isCurrent = ver.id === product.currentVersionId;
                return (
                  <div
                    key={ver.id}
                    className={`p-3.5 rounded-xl border transition ${
                      isCurrent
                        ? 'bg-cyan-50/50 dark:bg-cyan-950/40 border-cyan-300 dark:border-cyan-800'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                          v{ver.versionNumber}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800/80">
                            {language === 'vi' ? 'Bản đang bán' : 'Active'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(ver.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed mb-2">
                      {ver.releaseNotes}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200 dark:border-slate-800/70">
                      <span>{ver.componentsCount} linh kiện</span>
                      <span>•</span>
                      <span>{ver.connectionsCount} đường dây</span>
                      <span>•</span>
                      <span>{ver.boardDimensions.width}x{ver.boardDimensions.height} mm</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 font-semibold transition"
          >
            {language === 'vi' ? 'Đóng' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
