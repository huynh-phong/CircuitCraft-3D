import React, { useState, useEffect } from 'react';
import {
  X,
  GraduationCap,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Box,
  RotateCw,
  Layers,
  BookOpen,
} from 'lucide-react';
import { ProjectDocument } from '../../domain/project/types';
import { projectRepositoryManager } from '../../persistence/repositoryManager';
import { useI18n } from '../../i18n/context';

interface CreateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onCourseCreated: (course: any) => void;
}

export const CreateCourseModal: React.FC<CreateCourseModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onCourseCreated,
}) => {
  const { language, formatCurrency } = useI18n();
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(150000);
  const [isFree, setIsFree] = useState(false);
  const [level, setLevel] = useState<'Cơ bản' | 'Trung cấp' | 'Nâng cao' | 'Chuyên gia'>('Cơ bản');
  const [duration, setDuration] = useState('4 tuần • 8 bài thực hành');
  const [userProjects, setUserProjects] = useState<ProjectDocument[]>([]);
  const [featuredProjectId, setFeaturedProjectId] = useState<string>('');

  // Curriculum lessons
  const [lessons, setLessons] = useState<
    Array<{ id: string; title: string; duration: string; isLab: boolean }>
  >([
    { id: 'l1', title: 'Giới thiệu tổng quan và cấu tạo phần cứng', duration: '30 phút', isLab: false },
    { id: 'l2', title: 'Thực hành 3D: Thiết kế và đấu nối mạch nguyên lý', duration: '45 phút', isLab: true },
    { id: 'l3', title: 'Kiểm tra mô phỏng tín hiệu và chống chập cháy', duration: '40 phút', isLab: true },
  ]);

  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const repo = projectRepositoryManager.getActiveRepository();
    repo.listProjects()
      .then((list) => {
        setUserProjects(list);
        if (list.length > 0 && !featuredProjectId) {
          setFeaturedProjectId(list[0].projectId || (list[0] as any).id);
        }
      })
      .catch((err) => console.error(err));
  }, [isOpen]);

  const handleAddLesson = () => {
    if (!newLessonTitle.trim()) return;
    setLessons([
      ...lessons,
      {
        id: `l-${Date.now()}`,
        title: newLessonTitle.trim(),
        duration: '45 phút',
        isLab: true,
      },
    ]);
    setNewLessonTitle('');
  };

  const handleRemoveLesson = (index: number) => {
    setLessons(lessons.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (title.trim().length < 5) {
      setValidationError(language === 'vi' ? 'Tiêu đề khóa học phải có ít nhất 5 ký tự.' : 'Course title must be at least 5 characters.');
      return;
    }

    if (description.trim().length < 20) {
      setValidationError(language === 'vi' ? 'Mô tả khóa học phải có ít nhất 20 ký tự.' : 'Description must be at least 20 characters.');
      return;
    }

    if (lessons.length === 0) {
      setValidationError(language === 'vi' ? 'Khóa học cần ít nhất 1 bài học/lab thực hành.' : 'Course requires at least 1 lesson/lab.');
      return;
    }

    setIsSubmitting(true);
    try {
      const syllabus = lessons.map((l) => ({
        id: l.id,
        title: l.title,
        duration: l.duration,
        type: l.isLab ? ('lab' as const) : ('theory' as const),
      }));

      const res = await fetch('/api/creator/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id || 'creator-demo',
          title: title.trim(),
          tagline: tagline.trim() || 'Khóa học thiết kế điện tử chuyên sâu trên CircuitCraft 3D',
          description: description.trim(),
          price: isFree ? 0 : price,
          currency: 'VND',
          level,
          duration,
          featuredProjectId: featuredProjectId || (userProjects[0]?.projectId || (userProjects[0] as any)?.id || 'featured-demo'),
          syllabus,
          prerequisites: ['Đam mê điện tử', 'Máy tính có trình duyệt hiện đại'],
          tags: ['Khóa học', 'CircuitCraft', '3D Lab'],
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Lỗi khi tạo khóa học');
      }

      const data = await res.json();
      if (data.success && data.course) {
        onCourseCreated(data.course);
        onClose();
      } else {
        throw new Error(data.error || 'Tạo khóa học thất bại');
      }
    } catch (err: any) {
      setValidationError(err.message || 'Lỗi trong quá trình tạo khóa học');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in select-none">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-50 to-slate-100 dark:from-teal-950 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shadow-md">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {language === 'vi' ? 'Tạo Khóa học & Phòng Lab 3D mới' : 'Create New Course & 3D Lab'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {language === 'vi'
                  ? 'Đóng gói kiến thức, bài tập mô phỏng 3D và phân phối tới học viên'
                  : 'Package knowledge, 3D labs, and publish to students'}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                {language === 'vi' ? 'Tên khóa học *' : 'Course Title *'}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Làm chủ Vi điều khiển & Thiết kế Mạch 3D Thực chiến"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
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
                placeholder="VD: Học lý thuyết song song thực hành lắp ráp mô phỏng mạch 3D không lo cháy nổ"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                {language === 'vi' ? 'Mô tả khóa học & Mục tiêu đào tạo *' : 'Course Description & Outcomes *'}
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Khóa học này sẽ hướng dẫn bạn từ chưa biết gì về điện tử đến thiết kế thành thạo..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500 leading-relaxed"
              />
            </div>

            {/* 3D Featured Project Cover */}
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>
                  {language === 'vi'
                    ? 'Dự án mạch đại diện (3D Cover Interactive Preview):'
                    : 'Featured 3D Circuit Project (3D Cover):'}
                </span>
              </label>
              {userProjects.length > 0 ? (
                <select
                  value={featuredProjectId}
                  onChange={(e) => setFeaturedProjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
                >
                  {userProjects.map((p) => {
                    const pid = p.projectId || (p as any).id;
                    return (
                      <option key={pid} value={pid}>
                        {p.name} ({p.components.length} linh kiện)
                      </option>
                    );
                  })}
                </select>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px]">
                  {language === 'vi'
                    ? 'Hệ thống sẽ dùng mạch thực hành mẫu để hiển thị 3D xoay cho học viên.'
                    : 'A demo circuit will be assigned as the interactive 3D hero cover.'}
                </div>
              )}
            </div>

            {/* Pricing & Level */}
            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                {language === 'vi' ? 'Học phí (VND)' : 'Tuition (VND)'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  disabled={isFree}
                  min={20000}
                  step={10000}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500 disabled:opacity-40 font-mono font-bold"
                />
                <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFree}
                    onChange={(e) => setIsFree(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-0"
                  />
                  <span>{language === 'vi' ? 'Miễn phí' : 'Free'}</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                {language === 'vi' ? 'Cấp độ học viên' : 'Level'}
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500"
              >
                <option value="Cơ bản">Cơ bản (Beginner)</option>
                <option value="Trung cấp">Trung cấp (Intermediate)</option>
                <option value="Nâng cao">Nâng cao (Advanced)</option>
                <option value="Chuyên gia">Chuyên gia (Expert)</option>
              </select>
            </div>
          </div>

          {/* Curriculum Section */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <label className="block font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>{language === 'vi' ? 'Giáo trình & Bài thực hành 3D (Curriculum):' : 'Curriculum & Labs:'}</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                {lessons.length} {language === 'vi' ? 'bài học' : 'lessons'}
              </span>
            </label>

            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {lessons.map((lesson, idx) => (
                <div
                  key={lesson.id}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-750 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-700 dark:text-teal-300 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-slate-900 dark:text-slate-100 text-xs">
                      {lesson.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-teal-950/60 text-teal-300 border border-teal-500/30">
                      {lesson.isLab ? '3D Lab' : 'Lý thuyết'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLesson(idx)}
                      className="p-1 rounded text-slate-400 hover:text-rose-500 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick add lesson */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newLessonTitle}
                onChange={(e) => setNewLessonTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddLesson();
                  }
                }}
                placeholder="Nhập tên bài học/lab mới..."
                className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500 text-xs"
              />
              <button
                type="button"
                onClick={handleAddLesson}
                className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1 transition shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? 'Thêm bài' : 'Add'}</span>
              </button>
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {language === 'vi' ? 'Doanh thu Creator:' : 'Creator payout:'}{' '}
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
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold shadow-md shadow-teal-600/20 transition"
              >
                {isSubmitting ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>{language === 'vi' ? 'Đang tạo khóa học...' : 'Creating...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{language === 'vi' ? 'Xác nhận Tạo Khóa học' : 'Create Course'}</span>
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
