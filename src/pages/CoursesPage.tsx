import React, { useState, useEffect } from 'react';
import { Course } from '../domain/courses/types';
import { courseService } from '../domain/courses/courseService';
import { useI18n } from '../i18n/context';
import {
  BookOpen,
  GraduationCap,
  CheckCircle2,
  Clock,
  Star,
  PlayCircle,
  ShieldCheck,
  Search,
  X,
  Cpu,
  Eye,
  FileSpreadsheet,
  Video,
  Layers,
} from 'lucide-react';
import { PaymentModal, PaymentOrderDetails } from '../components/PaymentModal';
import { Portal } from '../components/ui/Portal';

export interface CoursesPageProps {
  onStartCourseLab: (course: Course, labId?: string) => void;
  onOpenMyCourses?: (courseId?: string) => void;
  currentUser?: any;
  onOpenAuthModal?: () => void;
}

export const CoursesPage: React.FC<CoursesPageProps> = ({
  onStartCourseLab,
  onOpenMyCourses,
  currentUser,
  onOpenAuthModal,
}) => {
  const { language } = useI18n();
  const [activeFilter, setActiveFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseForDetail, setSelectedCourseForDetail] = useState<Course | null>(null);
  const [courseToBuy, setCourseToBuy] = useState<Course | null>(null);
  const [activePaymentOrder, setActivePaymentOrder] = useState<PaymentOrderDetails | null>(null);
  const [, setIsProcessingBuy] = useState(false);
  const [buySuccessMessage, setBuySuccessMessage] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>(() => courseService.getCourses());
  const [enrollments, setEnrollments] = useState<Record<string, any>>(() =>
    courseService.getEnrollments()
  );

  useEffect(() => {
    courseService.fetchPublishedCoursesFromServer();
    const update = () => {
      setCourses([...courseService.getCourses()]);
      setEnrollments({ ...courseService.getEnrollments() });
    };
    update();
    const unsub = courseService.subscribe(update);
    return () => unsub();
  }, [currentUser]);

  const filteredCourses = courses.filter((course) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = course.title.toLowerCase().includes(q);
      const matchDesc = course.description.toLowerCase().includes(q);
      const matchTag = course.tagline.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchTag) return false;
    }

    if (activeFilter === 'free') return course.isFree;
    if (activeFilter === 'paid') return !course.isFree;
    return true;
  });

  const handleEnrollFree = (course: Course) => {
    if (!currentUser && onOpenAuthModal) {
      onOpenAuthModal();
      return;
    }
    courseService.enroll(course.id);
    setBuySuccessMessage(
      language === 'vi'
        ? `Đã đăng ký thành công khóa học "${course.title}"! Bạn có thể vào học ngay trong mục Khóa học của tôi.`
        : `Successfully enrolled in "${course.title}"!`
    );
    setTimeout(() => setBuySuccessMessage(null), 4000);
  };

  const handleOpenBuy = async (course: Course) => {
    setCourseToBuy(course);
    setBuyError(null);
    setIsProcessingBuy(true);

    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: course.id,
          productId: course.id,
          productTitle: course.title,
          amount: course.price,
          authorName: course.author?.name || course.instructor?.name || 'Huỳnh Phong',
          userId: currentUser?.id || currentUser?.uid || 'guest',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.order) {
        setActivePaymentOrder(data.order);
        return;
      }
      setBuyError(data.error || 'Không thể tạo đơn hàng lúc này. Vui lòng thử lại sau.');
    } catch (err) {
      console.warn('Could not create order:', err);
      setBuyError('Không kết nối được máy chủ để tạo đơn hàng. Vui lòng thử lại sau.');
    } finally {
      setIsProcessingBuy(false);
    }
  };

  const handlePaymentSuccess = () => {
    if (courseToBuy) {
      courseService.enroll(courseToBuy.id);
      setBuySuccessMessage(
        language === 'vi'
          ? `Chúc mừng! Bạn đã thanh toán thành công khóa học "${courseToBuy.title}".`
          : `Congratulations! Unlocked "${courseToBuy.title}".`
      );
      setActivePaymentOrder(null);
      setCourseToBuy(null);
      setTimeout(() => setBuySuccessMessage(null), 4500);
    }
  };

  const handleEnterCourse = (course: Course) => {
    if (onOpenMyCourses) {
      onOpenMyCourses(course.id);
    } else {
      onStartCourseLab(course);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-transparent p-4 sm:p-6 md:p-8 select-none text-slate-800 dark:text-slate-100 transition-colors">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Hero Banner */}
        <div className="tech-panel p-6 sm:p-10 relative overflow-hidden circuit-traces-overlay">
          <div className="relative z-10 max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200/90 dark:border-cyan-500/40 text-xs font-semibold shadow-xs">
              <GraduationCap className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>{language === 'vi' ? 'Học Viện Thiết Kế Mạch Điện Tử 3D' : '3D Circuit Design Academy'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {language === 'vi'
                ? 'Khóa Học Lý Thuyết Slide & Thực Hành 3D Tương Tác'
                : 'Interactive Courses & 3D Practice Labs'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
              {language === 'vi'
                ? 'Mỗi khóa học bao gồm 2 phần: Học Lý thuyết qua Slide bài giảng có Trợ giảng AI đồng hành và Thực hành lắp ráp mạch 3D theo 3 giai đoạn chuẩn từ dự án của Nhà sáng tạo.'
                : 'Every course includes two parts: Theory Slide lectures with a dedicated AI Teaching Assistant, and 3-stage 3D Practice Labs.'}
            </p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeFilter === 'all'
                  ? 'tech-btn-primary shadow-[0_4px_14px_rgba(6,182,212,0.35)] -translate-y-0.5'
                  : 'tech-btn-control border border-[#cbe6f7] dark:border-cyan-800/60 bg-white dark:bg-[#091526] text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400'
              }`}
            >
              {language === 'vi' ? `Tất cả (${courses.length})` : `All (${courses.length})`}
            </button>
            <button
              onClick={() => setActiveFilter('free')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeFilter === 'free'
                  ? 'tech-btn-primary shadow-[0_4px_14px_rgba(6,182,212,0.35)] -translate-y-0.5'
                  : 'tech-btn-control border border-[#cbe6f7] dark:border-cyan-800/60 bg-white dark:bg-[#091526] text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400'
              }`}
            >
              {language === 'vi'
                ? `Miễn phí (${courses.filter((c) => c.isFree).length})`
                : `Free (${courses.filter((c) => c.isFree).length})`}
            </button>
            <button
              onClick={() => setActiveFilter('paid')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeFilter === 'paid'
                  ? 'tech-btn-primary shadow-[0_4px_14px_rgba(6,182,212,0.35)] -translate-y-0.5'
                  : 'tech-btn-control border border-[#cbe6f7] dark:border-cyan-800/60 bg-white dark:bg-[#091526] text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400'
              }`}
            >
              {language === 'vi'
                ? `Khóa Pro (${courses.filter((c) => !c.isFree).length})`
                : `Pro (${courses.filter((c) => !c.isFree).length})`}
            </button>
          </div>

          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={language === 'vi' ? 'Tìm kiếm khóa học...' : 'Search courses...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="tech-input w-full pl-10 pr-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
        </div>

        {/* Courses Grid or Empty State */}
        {filteredCourses.length === 0 ? (
          <div className="tech-panel p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-500">
              <GraduationCap className="w-8 h-8" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {language === 'vi' ? 'Chưa có khóa học nào được xuất bản' : 'No published courses yet'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {language === 'vi'
                  ? 'Nhà sáng tạo có thể vào mục "Khu vực Creator -> Tạo khóa học" để tải lên phần Lý thuyết (Slide .pptx, Video) và phần Thực hành (Dự án mạch 3D).'
                  : 'Creators can visit the Creator Studio to publish new courses with PPTX theory slides and 3D practice projects.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => {
              const isEnrolled = Boolean(enrollments[course.id]);
              const enrollment = enrollments[course.id];
              const theoryCount = course.syllabus.filter((s) => s.sectionType === 'theory' || !s.isPracticalLab).length;
              const practiceCount = course.syllabus.filter((s) => s.sectionType === 'practice' || s.isPracticalLab).length;

              return (
                <div
                  key={course.id}
                  className="tech-card flex flex-col overflow-hidden transition-all"
                >
                  {/* Thumbnail Header */}
                  <div
                    className={`h-40 bg-gradient-to-tr ${course.thumbnailGradient} p-4 flex flex-col justify-between relative`}
                  >
                    <div className="flex items-center justify-between z-10">
                      <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-lg bg-slate-950/70 backdrop-blur-sm text-slate-200 border border-white/10 shadow-xs">
                        {course.level}
                      </span>
                      {course.badge && (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 shadow-xs">
                          {course.badge}
                        </span>
                      )}
                    </div>
                    <div className="z-10 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] text-white font-medium bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-lg">
                        <Clock className="w-3.5 h-3.5 text-cyan-300" />
                        <span>
                          {theoryCount} Lý thuyết • {practiceCount} Thực hành
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-amber-300 font-bold bg-slate-950/70 backdrop-blur-xs px-2.5 py-1 rounded-lg">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>{course.rating}</span>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug line-clamp-2">
                        {course.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {course.tagline}
                      </p>
                      <div className="text-[11px] text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5 pt-1 font-medium">
                        <span>{language === 'vi' ? 'Giảng viên:' : 'Instructor:'}</span>
                        <span className="text-slate-800 dark:text-slate-200 font-semibold">
                          {course.author?.name || course.instructor?.name || 'Huỳnh Phong'}
                        </span>
                      </div>
                    </div>

                    {/* Enrollment Progress if already enrolled */}
                    {isEnrolled && enrollment && (
                      <div className="tech-card-nested p-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {language === 'vi' ? 'Đã sở hữu khóa học' : 'Enrolled'}
                          </span>
                          <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                            {enrollment.progressPercent}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full transition-all"
                            style={{ width: `${enrollment.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Pricing & Actions (Removed 3D preview button per Requirement 0) */}
                    <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="shrink-0">
                          {course.isFree ? (
                            <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono leading-tight">
                              {language === 'vi' ? 'Miễn phí' : 'Free'}
                            </span>
                          ) : (
                            <div className="flex flex-col justify-center">
                              <span className="text-base font-extrabold text-cyan-600 dark:text-cyan-400 font-mono leading-tight">
                                {course.price.toLocaleString('vi-VN')} ₫
                              </span>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => setSelectedCourseForDetail(course)}
                          className="tech-btn-secondary px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 border border-[#cbe6f7] dark:border-cyan-800/60 shadow-xs cursor-pointer"
                          title={language === 'vi' ? 'Xem chi tiết giáo trình khóa học' : 'Course Details'}
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          <span>{language === 'vi' ? 'Chi tiết' : 'Details'}</span>
                        </button>
                      </div>

                      <div>
                        {isEnrolled ? (
                          <button
                            onClick={() => handleEnterCourse(course)}
                            className="w-full tech-btn-3d-green flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-extrabold text-white rounded-2xl cursor-pointer"
                          >
                            <PlayCircle className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                            <span className="tracking-wide">
                              {language === 'vi' ? 'Vào học (Lý thuyết & Thực hành)' : 'Start Learning'}
                            </span>
                          </button>
                        ) : course.isFree ? (
                          <button
                            onClick={() => handleEnrollFree(course)}
                            className="w-full tech-btn-3d-green flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-extrabold text-white rounded-2xl cursor-pointer"
                          >
                            <span className="tracking-wide">
                              {language === 'vi' ? 'Đăng ký học miễn phí' : 'Enroll Free'}
                            </span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenBuy(course)}
                            className="w-full tech-btn-3d flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-extrabold text-white rounded-2xl cursor-pointer"
                          >
                            <ShieldCheck className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                            <span className="tracking-wide">
                              {language === 'vi' ? 'Mua ngay qua VietQR' : 'Buy with VietQR'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Syllabus / Detail Modal (No 3D preview button per Requirement 0) */}
        {selectedCourseForDetail && (
          <Portal>
            <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
              <div className="my-auto w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30">
                        {selectedCourseForDetail.level}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedCourseForDetail.duration}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {selectedCourseForDetail.title}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {selectedCourseForDetail.tagline}
                    </p>
                    <div className="text-xs text-cyan-600 dark:text-cyan-300 flex items-center gap-1.5 mt-2 font-medium">
                      <span>{language === 'vi' ? 'Giảng viên:' : 'Instructor:'}</span>
                      <span className="font-semibold text-slate-800 dark:text-white">
                        {selectedCourseForDetail.author?.name ||
                          selectedCourseForDetail.instructor?.name ||
                          'Huỳnh Phong'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedCourseForDetail(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5 flex-1">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      {language === 'vi' ? 'Mô tả khóa học' : 'Course Description'}
                    </h4>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {selectedCourseForDetail.description}
                    </p>
                  </div>

                  {/* Theory Section */}
                  <div>
                    <h4 className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4" />
                      <span>
                        1. Phần Lý thuyết (
                        {
                          selectedCourseForDetail.syllabus.filter(
                            (s) => s.sectionType === 'theory' || !s.isPracticalLab
                          ).length
                        }{' '}
                        bài giảng Slide)
                      </span>
                    </h4>
                    <div className="space-y-2">
                      {selectedCourseForDetail.syllabus
                        .filter((s) => s.sectionType === 'theory' || !s.isPracticalLab)
                        .map((item, idx) => (
                          <div
                            key={item.id || idx}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-start gap-3">
                              <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <div>
                                <div className="text-xs font-bold text-slate-900 dark:text-white">
                                  {item.title}
                                </div>
                                {item.summary && (
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    {item.summary}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 mt-1 text-[10px] font-semibold text-cyan-600 dark:text-cyan-400">
                                  <span className="flex items-center gap-1">
                                    <FileSpreadsheet className="w-3 h-3" />
                                    {item.slideCount ?? item.slides?.length ?? 0} slide bài giảng
                                  </span>
                                  {(item.hasVideo || item.videoUrl) && (
                                    <span className="flex items-center gap-1 text-indigo-500">
                                      <Video className="w-3 h-3" />
                                      Có video
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Practice Section */}
                  <div>
                    <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Cpu className="w-4 h-4" />
                      <span>
                        2. Phần Thực hành 3D (
                        {
                          selectedCourseForDetail.syllabus.filter(
                            (s) => s.sectionType === 'practice' || s.isPracticalLab
                          ).length
                        }{' '}
                        phòng Lab)
                      </span>
                    </h4>
                    <div className="space-y-2">
                      {selectedCourseForDetail.syllabus
                        .filter((s) => s.sectionType === 'practice' || s.isPracticalLab)
                        .map((item, idx) => (
                          <div
                            key={item.id || idx}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-start gap-3">
                              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <div>
                                <div className="text-xs font-bold text-slate-900 dark:text-white">
                                  {item.title}
                                </div>
                                {item.summary && (
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    {item.summary}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {selectedCourseForDetail.isFree ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {language === 'vi' ? 'Miễn phí' : 'Free'}
                      </span>
                    ) : (
                      <span className="text-cyan-600 dark:text-cyan-400 font-mono">
                        {selectedCourseForDetail.price.toLocaleString('vi-VN')} ₫
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedCourseForDetail(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      {language === 'vi' ? 'Đóng' : 'Close'}
                    </button>

                    {enrollments[selectedCourseForDetail.id] ? (
                      <button
                        onClick={() => {
                          const c = selectedCourseForDetail;
                          setSelectedCourseForDetail(null);
                          handleEnterCourse(c);
                        }}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 shadow-md flex items-center gap-1.5 cursor-pointer"
                      >
                        <PlayCircle className="w-4 h-4" />
                        <span>{language === 'vi' ? 'Vào học ngay' : 'Start Learning'}</span>
                      </button>
                    ) : selectedCourseForDetail.isFree ? (
                      <button
                        onClick={() => {
                          const c = selectedCourseForDetail;
                          setSelectedCourseForDetail(null);
                          handleEnrollFree(c);
                        }}
                        className="tech-btn-3d-green px-5 py-2.5 rounded-2xl text-xs font-extrabold text-white cursor-pointer"
                      >
                        <span className="tracking-wide">
                          {language === 'vi' ? 'Đăng ký miễn phí' : 'Enroll Free'}
                        </span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          const c = selectedCourseForDetail;
                          setSelectedCourseForDetail(null);
                          handleOpenBuy(c);
                        }}
                        className="tech-btn-3d px-6 py-2.5 rounded-2xl text-xs font-extrabold text-white flex items-center gap-2 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                        <span className="tracking-wide">
                          {language === 'vi' ? 'Thanh toán ngay qua VietQR' : 'Pay with VietQR'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Portal>
        )}

        {/* Success Alert */}
        {buyError && (
          <div role="alert" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] max-w-md p-3 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 shadow-lg">
            {buyError}
          </div>
        )}
        {buySuccessMessage && (
          <div className="p-3.5 bg-emerald-50/95 dark:bg-emerald-950/80 border border-emerald-400 dark:border-emerald-500 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-2xl text-center shadow-lg animate-in fade-in transition-all">
            {buySuccessMessage}
          </div>
        )}

        {/* Official VietQR Payment Modal */}
        <PaymentModal
          order={activePaymentOrder}
          isOpen={Boolean(activePaymentOrder)}
          onClose={() => {
            setActivePaymentOrder(null);
            setCourseToBuy(null);
          }}
          onPaymentSuccess={handlePaymentSuccess}
        />
      </div>
    </div>
  );
};
