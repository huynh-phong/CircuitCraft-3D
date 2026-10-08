import React, { useState, useEffect } from 'react';
import {
  X,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Box,
  Layers,
  Sparkles,
  Cpu,
  Tag,
  DollarSign,
  FileText,
  HelpCircle,
  ShieldCheck,
  RotateCw,
} from 'lucide-react';
import { ProjectDocument } from '../../domain/project/types';
import { projectRepositoryManager } from '../../persistence/repositoryManager';
import { useI18n } from '../../i18n/context';

interface PublishProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  currentProject?: ProjectDocument;
  onProductPublished: (product: any) => void;
}

export const PublishProductModal: React.FC<PublishProductModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentProject,
  onProductPublished,
}) => {
  const { language, formatCurrency } = useI18n();
  const [userProjects, setUserProjects] = useState<ProjectDocument[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(currentProject?.projectId || (currentProject as any)?.id || '');
  const [title, setTitle] = useState(currentProject?.name || '');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(50000);
  const [isFree, setIsFree] = useState(false);
  const [versionNumber, setVersionNumber] = useState('1.0.0');
  const [releaseNotes, setReleaseNotes] = useState('Khởi tạo phiên bản đầu tiên sẵn sàng trên Marketplace.');
  const [tagsInput, setTagsInput] = useState('Arduino, Mạch 3D, IoT');
  const [deliverablesInput, setDeliverablesInput] = useState('Sơ đồ nguyên lý 3D hoàn chỉnh\nMạch in 3D kiểm tra va chạm\nDanh sách linh kiện chi tiết');
  const [prerequisitesInput, setPrerequisitesInput] = useState('Kiến thức điện tử cơ bản');

  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load user's projects
  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingProjects(true);
    const repo = projectRepositoryManager.getActiveRepository();
    repo.listProjects()
      .then((list) => {
        setUserProjects(list);
        if (list.length > 0 && !selectedProjectId) {
          const firstId = list[0].projectId || (list[0] as any).id;
          setSelectedProjectId(firstId);
          setTitle(list[0].name);
        }
      })
      .catch((err) => console.error('Failed to list projects:', err))
      .finally(() => setIsLoadingProjects(false));
  }, [isOpen]);

  const selectedProjectDoc = userProjects.find((p) => (p.projectId || (p as any).id) === selectedProjectId) || currentProject;

  const handleSelectProject = (projId: string) => {
    setSelectedProjectId(projId);
    const p = userProjects.find((x) => (x.projectId || (x as any).id) === projId);
    if (p) {
      if (!title || title === currentProject?.name) {
        setTitle(p.name);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!selectedProjectDoc) {
      setValidationError(language === 'vi' ? 'Vui lòng chọn một dự án mạch để đăng bán.' : 'Please select a circuit project to publish.');
      return;
    }

    if (title.trim().length < 5) {
      setValidationError(language === 'vi' ? 'Tiêu đề sản phẩm phải có ít nhất 5 ký tự.' : 'Title must be at least 5 characters.');
      return;
    }

    if (description.trim().length < 20) {
      setValidationError(language === 'vi' ? 'Mô tả chi tiết phải có ít nhất 20 ký tự để người mua hiểu rõ sản phẩm.' : 'Description must be at least 20 characters.');
      return;
    }

    if (selectedProjectDoc.components.length === 0) {
      setValidationError(language === 'vi' ? 'Dự án chưa có linh kiện nào. Hãy lắp ít nhất 1 linh kiện trước khi đăng bán.' : 'The project has no components. Please place at least 1 component.');
      return;
    }

    setIsSubmitting(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const deliverables = deliverablesInput
        .split('\n')
        .map((d) => d.trim())
        .filter(Boolean);
      const prerequisites = prerequisitesInput
        .split('\n')
        .map((p) => p.trim())
        .filter(Boolean);

      const res = await fetch('/api/creator/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id || 'creator-demo',
          title: title.trim(),
          tagline: tagline.trim() || 'Mạch điện thiết kế chuyên nghiệp bởi Creator CircuitCraft 3D',
          description: description.trim(),
          price: isFree ? 0 : price,
          currency: 'VND',
          tags,
          deliverables,
          prerequisites,
          sourceProjectId: selectedProjectDoc.projectId || (selectedProjectDoc as any)?.id,
          projectDocument: selectedProjectDoc,
          versionNumber: versionNumber.trim() || '1.0.0',
          releaseNotes: releaseNotes.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Không thể xuất bản sản phẩm');
      }

      const data = await res.json();
      if (data.success && data.product) {
        onProductPublished(data.product);
        onClose();
      } else {
        throw new Error(data.error || 'Xuất bản thất bại');
      }
    } catch (err: any) {
      setValidationError(err.message || 'Lỗi trong quá trình xuất bản');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in select-none">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-cyan-50 to-slate-100 dark:from-cyan-950 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-600 text-white flex items-center justify-center shadow-md">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {language === 'vi' ? 'Đăng bán Mạch điện lên Marketplace' : 'Publish Circuit to Marketplace'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {language === 'vi'
                  ? 'Tạo snapshot phiên bản bất biến (v1.0.0) và phân phối tới cộng đồng kỹ sư'
                  : 'Create an immutable version snapshot (v1.0.0) and publish to engineers'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {validationError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* 1. Chọn Project nguồn */}
          <div>
            <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>{language === 'vi' ? '1. Chọn dự án mạch 3D gốc để đóng gói:' : '1. Select Source 3D Project:'}</span>
            </label>
            {isLoadingProjects ? (
              <div className="p-3 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Đang tải danh sách dự án...</span>
              </div>
            ) : userProjects.length > 0 ? (
              <select
                value={selectedProjectId}
                onChange={(e) => handleSelectProject(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 font-medium"
              >
                {userProjects.map((p) => {
                  const pid = p.projectId || (p as any).id;
                  return (
                    <option key={pid} value={pid}>
                      {p.name} ({p.components.length} linh kiện, {p.connections.length} đường dây)
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 text-[11px]">
                {language === 'vi'
                  ? 'Không tìm thấy dự án đã lưu. Bản thiết kế hiện tại sẽ được dùng làm bản phát hành đầu tiên.'
                  : 'No saved projects found. The current active design will be packaged.'}
              </div>
            )}
          </div>

          {/* Snapshot Architecture Explainer */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5 text-[11px] text-slate-600 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {language === 'vi' ? 'Cơ chế Bất biến (Immutable Versioning):' : 'Immutable Versioning:'}
              </span>{' '}
              {language === 'vi'
                ? 'Hệ thống sẽ sao chép một snapshot độc lập của mạch. Bạn vẫn có thể tiếp tục sửa dự án cá nhân mà không làm hỏng mạch đã bán cho khách hàng.'
                : 'A safe snapshot will be generated. Future edits to your private workspace will not mutate published customer versions.'}
            </div>
          </div>

          {/* 2. Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                {language === 'vi' ? 'Tiêu đề sản phẩm thương mại *' : 'Product Title *'}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Mạch Giám sát Nhiệt độ Độ ẩm ESP32 v2"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                {language === 'vi' ? 'Mô tả ngắn gọn (Tagline)' : 'Short Tagline'}
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="VD: Mạch đo cảm biến chính xác, thiết kế tối ưu kích thước bỏ túi"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                {language === 'vi' ? 'Mô tả chi tiết tính năng & ứng dụng *' : 'Detailed Description *'}
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả nguyên lý hoạt động, cách lắp ráp, cấu hình và tính ứng dụng của mạch..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 leading-relaxed"
              />
            </div>

            {/* Pricing */}
            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                {language === 'vi' ? 'Giá bán (VND)' : 'Price (VND)'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  disabled={isFree}
                  min={10000}
                  step={5000}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 disabled:opacity-40 font-mono font-bold"
                />
                <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFree}
                    onChange={(e) => setIsFree(e.target.checked)}
                    className="rounded text-cyan-600 focus:ring-0"
                  />
                  <span>{language === 'vi' ? 'Miễn phí (0đ)' : 'Free (0đ)'}</span>
                </label>
              </div>
            </div>

            {/* Versioning */}
            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                {language === 'vi' ? 'Phiên bản ban đầu' : 'Initial Version'}
              </label>
              <input
                type="text"
                value={versionNumber}
                onChange={(e) => setVersionNumber(e.target.value)}
                placeholder="1.0.0"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                {language === 'vi' ? 'Tags / Từ khóa tìm kiếm (phân cách bằng dấu phẩy)' : 'Tags (comma-separated)'}
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Arduino, ESP32, Robotics, Sensor, PWM"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                {language === 'vi' ? 'Kiến thức đạt được (mỗi dòng 1 ý)' : 'Deliverables (1 per line)'}
              </label>
              <textarea
                rows={2}
                value={deliverablesInput}
                onChange={(e) => setDeliverablesInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 leading-relaxed font-sans"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                {language === 'vi' ? 'Yêu cầu tiên quyết' : 'Prerequisites'}
              </label>
              <textarea
                rows={2}
                value={prerequisitesInput}
                onChange={(e) => setPrerequisitesInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 leading-relaxed font-sans"
              />
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {language === 'vi' ? 'Creator nhận:' : 'Creator payout:'}{' '}
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {isFree ? '0 đ' : formatCurrency(price * 0.85)} (85%)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition"
              >
                {language === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold shadow-md shadow-cyan-600/20 transition"
              >
                {isSubmitting ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>{language === 'vi' ? 'Đang xuất bản...' : 'Publishing...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{language === 'vi' ? 'Xác nhận Đăng bán' : 'Publish Product'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
