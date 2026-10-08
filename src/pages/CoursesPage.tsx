import React, { useState, useEffect } from 'react';
import { Course } from '../domain/courses/types';
import { COURSES } from '../domain/courses/coursesData';
import { courseService } from '../domain/courses/courseService';
import { paymentService } from '../billing/paymentService';
import { projectRepositoryManager } from '../persistence/repositoryManager';
import { useI18n } from '../i18n/context';
import {
  BookOpen,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  Clock,
  Star,
  Users,
  ChevronRight,
  PlayCircle,
  Tag,
  CreditCard,
  ShieldCheck,
  Search,
  Award,
  Layers,
  X,
  Cpu,
  Copy,
  Check,
  QrCode,
  RefreshCw,
  Box,
  Eye,
} from 'lucide-react';
import { Product3DViewerModal } from '../components/Product3DViewerModal';
import { PaymentModal, PaymentOrderDetails } from '../components/PaymentModal';

export interface CoursesPageProps {
  onStartCourseLab: (course: Course, labId?: string) => void;
  currentUser?: any;
  onOpenAuthModal?: () => void;
}

export const CoursesPage: React.FC<CoursesPageProps> = ({
  onStartCourseLab,
  currentUser,
  onOpenAuthModal,
}) => {
  const { language } = useI18n();
  const [activeFilter, setActiveFilter] = useState<'all' | 'free' | 'paid' | 'enrolled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseForDetail, setSelectedCourseForDetail] = useState<Course | null>(null);
  const [viewerCourse, setViewerCourse] = useState<Course | null>(null);
  const [courseToBuy, setCourseToBuy] = useState<Course | null>(null);
  const [activePaymentOrder, setActivePaymentOrder] = useState<PaymentOrderDetails | null>(null);
  const [isProcessingBuy, setIsProcessingBuy] = useState(false);
  const [buySuccessMessage, setBuySuccessMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [enrollments, setEnrollments] = useState<Record<string, any>>(() => courseService.getEnrollments());

  useEffect(() => {
    const update = () => setEnrollments({ ...courseService.getEnrollments() });
    update();
    const unsub = courseService.subscribe(update);
    return () => unsub();
  }, [currentUser]);

  const filteredCourses = COURSES.filter((course) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = course.title.toLowerCase().includes(q);
      const matchDesc = course.description.toLowerCase().includes(q);
      const matchTag = course.tagline.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchTag) return false;
    }

    // Filter tab
    if (activeFilter === 'free') return course.isFree;
    if (activeFilter === 'paid') return !course.isFree;
    if (activeFilter === 'enrolled') return Boolean(enrollments[course.id]);
    return true;
  });

  const handleEnrollFree = (course: Course) => {
    if (!currentUser && onOpenAuthModal) {
      onOpenAuthModal();
      return;
    }
    courseService.enroll(course.id);
    setRefreshKey((prev) => prev + 1);
    setBuySuccessMessage(
      language === 'vi'
        ? `Đã đăng ký thành công khóa học "${course.title}"!`
        : `Successfully enrolled in "${course.title}"!`
    );
    setTimeout(() => setBuySuccessMessage(null), 4000);
  };

  const handleOpenBuy = async (course: Course) => {
    setCourseToBuy(course);
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

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          setActivePaymentOrder(data.order);
          return;
        }
      }

      // Fallback authoritative VietQR order ensures payment QR always shows up immediately
      const bankName = 'MB Bank';
      const bankId = '970422';
      const accountNumber = '0988888888';
      const accountName = 'Huỳnh Phong';
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const cleanCode = course.id.replace(/^(course-|market-|plan-|prod-)/, '').toUpperCase().substring(0, 8);
      const orderCode = `CC3D_${cleanCode}_${randomSuffix}`;
      const transferContent = `CC3D ${orderCode}`;
      const qrUrl = `https://api.vietqr.io/image/${bankId}-${accountNumber}-compact.jpg?accountName=${encodeURIComponent(
        accountName
      )}&amount=${course.price}&addInfo=${encodeURIComponent(transferContent)}`;

      const fallbackOrder: PaymentOrderDetails = {
        orderId: `ord-${Date.now()}-${randomSuffix}`,
        orderCode,
        productId: course.id,
        productTitle: course.title,
        amount: course.price,
        currency: 'VND',
        bankDetails: {
          bankName,
          accountNumber,
          accountNumberMasked: '098****888',
          accountName,
          orderCode,
          transferContent,
          qrUrl,
        },
      };

      setActivePaymentOrder(fallbackOrder);
    } catch (err) {
      console.warn('Backend order error, launching client VietQR order:', err);
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const cleanCode = course.id.replace(/^(course-|market-|plan-|prod-)/, '').toUpperCase().substring(0, 8);
      const orderCode = `CC3D_${cleanCode}_${randomSuffix}`;
      const transferContent = `CC3D ${orderCode}`;
      const qrUrl = `https://api.vietqr.io/image/970422-0988888888-compact.jpg?accountName=Hu%E1%BB%B3nh%20Phong&amount=${course.price}&addInfo=${encodeURIComponent(
        transferContent
      )}`;

      setActivePaymentOrder({
        orderId: `ord-${Date.now()}-${randomSuffix}`,
        orderCode,
        productId: course.id,
        productTitle: course.title,
        amount: course.price,
        currency: 'VND',
        bankDetails: {
          bankName: 'MB Bank',
          accountNumber: '0988888888',
          accountNumberMasked: '098****888',
          accountName: 'Huỳnh Phong',
          orderCode,
          transferContent,
          qrUrl,
        },
      });
    } finally {
      setIsProcessingBuy(false);
    }
  };

  const handlePaymentSuccess = (order: PaymentOrderDetails) => {
    if (courseToBuy) {
      courseService.enroll(courseToBuy.id);
      setRefreshKey((prev) => prev + 1);
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
              {language === 'vi' ? 'Khóa Học Chuyên Nghiệp & Thực Hành 3D Tương Tác' : 'Professional Courses & Interactive 3D Labs'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
              {language === 'vi'
                ? 'Trang bị kiến thức từ cơ bản đến kỹ sư chuyên nghiệp: học lý thuyết cô đọng kết hợp thực hành trực tiếp trên mô hình mạch 3D tương tác. Có sẵn các khóa học miễn phí và chương trình Pro chuyên sâu.'
                : 'Master electronics fundamentals to advanced embedded engineering through interactive 3D simulation labs.'}
            </p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeFilter === 'all'
                  ? 'tech-btn-primary shadow-[0_4px_14px_rgba(6,182,212,0.35)] -translate-y-0.5'
                  : 'tech-btn-control border border-[#cbe6f7] dark:border-cyan-800/60 bg-white dark:bg-[#091526] text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-400 dark:hover:border-cyan-500 shadow-xs'
              }`}
            >
              {language === 'vi' ? `Tất cả (${COURSES.length})` : `All (${COURSES.length})`}
            </button>
            <button
              onClick={() => setActiveFilter('free')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeFilter === 'free'
                  ? 'tech-btn-primary shadow-[0_4px_14px_rgba(6,182,212,0.35)] -translate-y-0.5'
                  : 'tech-btn-control border border-[#cbe6f7] dark:border-cyan-800/60 bg-white dark:bg-[#091526] text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-400 dark:hover:border-cyan-500 shadow-xs'
              }`}
            >
              {language === 'vi' ? `Miễn phí (${COURSES.filter((c) => c.isFree).length})` : `Free (${COURSES.filter((c) => c.isFree).length})`}
            </button>
            <button
              onClick={() => setActiveFilter('paid')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeFilter === 'paid'
                  ? 'tech-btn-primary shadow-[0_4px_14px_rgba(6,182,212,0.35)] -translate-y-0.5'
                  : 'tech-btn-control border border-[#cbe6f7] dark:border-cyan-800/60 bg-white dark:bg-[#091526] text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-400 dark:hover:border-cyan-500 shadow-xs'
              }`}
            >
              {language === 'vi' ? `Khóa Pro (${COURSES.filter((c) => !c.isFree).length})` : `Pro (${COURSES.filter((c) => !c.isFree).length})`}
            </button>
            <button
              onClick={() => setActiveFilter('enrolled')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeFilter === 'enrolled'
                  ? 'tech-btn-primary shadow-[0_4px_14px_rgba(6,182,212,0.35)] -translate-y-0.5'
                  : 'tech-btn-control border border-[#cbe6f7] dark:border-cyan-800/60 bg-white dark:bg-[#091526] text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-400 dark:hover:border-cyan-500 shadow-xs'
              }`}
            >
              {language === 'vi' ? `Khóa của tôi (${Object.keys(enrollments).length})` : `My Courses (${Object.keys(enrollments).length})`}
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

        {/* Courses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => {
            const isEnrolled = Boolean(enrollments[course.id]);
            const enrollment = enrollments[course.id];

            return (
              <div
                key={course.id}
                className="tech-card flex flex-col overflow-hidden transition-all"
              >
                {/* Thumbnail Header */}
                <div className={`h-40 bg-gradient-to-tr ${course.thumbnailGradient} p-4 flex flex-col justify-between relative`}>
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
                      <span>{course.duration}</span>
                      <span className="mx-0.5">•</span>
                      <span>{course.lessonCount} {language === 'vi' ? 'bài' : 'lessons'}</span>
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
                      <span>{language === 'vi' ? 'Tác giả:' : 'Instructor:'}</span>
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
                        <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">{enrollment.progressPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full transition-all"
                          style={{ width: `${enrollment.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Pricing & Actions */}
                  <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
                    {/* Top sub-row: Price on left, Secondary actions (Xem 3D, Chi tiết) on right */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="shrink-0">
                        {course.isFree ? (
                          <div className="flex flex-col justify-center">
                            <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono leading-tight">
                              {language === 'vi' ? 'Miễn phí' : 'Free'}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col justify-center">
                            <span className="text-base font-extrabold text-cyan-600 dark:text-cyan-400 font-mono leading-tight">
                              {course.price.toLocaleString('vi-VN')} ₫
                            </span>
                            {course.originalPrice && (
                              <span className="text-[10px] line-through text-slate-400 dark:text-slate-500 font-mono leading-tight mt-0.5">
                                {course.originalPrice.toLocaleString('vi-VN')} ₫
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setViewerCourse(course)}
                          className="tech-btn-secondary px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 border border-[#cbe6f7] dark:border-cyan-800/60 shadow-xs"
                          title={language === 'vi' ? 'Xem trước mô hình 3D xoay turntable' : '3D Turntable Preview'}
                        >
                          <Box className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                          <span>{language === 'vi' ? 'Xem 3D' : '3D'}</span>
                        </button>

                        <button
                          onClick={() => setSelectedCourseForDetail(course)}
                          className="tech-btn-secondary px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 border border-[#cbe6f7] dark:border-cyan-800/60 shadow-xs"
                          title={language === 'vi' ? 'Xem chi tiết giáo trình khóa học' : 'Course Details'}
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          <span>{language === 'vi' ? 'Chi tiết' : 'Details'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Bottom sub-row: Prominent Primary Action Button (no clipping, ample padding from card frame) */}
                    <div>
                      {isEnrolled ? (
                        <button
                          onClick={() => onStartCourseLab(course)}
                          className="w-full tech-btn-3d-green flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-extrabold text-white rounded-2xl"
                        >
                          <PlayCircle className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                          <span className="tracking-wide">{language === 'vi' ? 'Thực hành 3D' : 'Launch Lab'}</span>
                        </button>
                      ) : course.isFree ? (
                        <button
                          onClick={() => handleEnrollFree(course)}
                          className="w-full tech-btn-3d-green flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-extrabold text-white rounded-2xl"
                        >
                          <span className="tracking-wide">{language === 'vi' ? 'Học miễn phí' : 'Enroll Free'}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenBuy(course)}
                          className="w-full tech-btn-3d flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-extrabold text-white rounded-2xl"
                        >
                          <ShieldCheck className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                          <span className="tracking-wide">{language === 'vi' ? 'Mua ngay qua VietQR' : 'Buy with VietQR'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Syllabus / Detail Modal */}
        {selectedCourseForDetail && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30">
                      {selectedCourseForDetail.level}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{selectedCourseForDetail.duration}</span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedCourseForDetail.title}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{selectedCourseForDetail.tagline}</p>
                  <div className="text-xs text-cyan-600 dark:text-cyan-300 flex items-center gap-1.5 mt-2 font-medium">
                    <span>{language === 'vi' ? 'Tác giả:' : 'Instructor:'}</span>
                    <span className="font-semibold text-slate-800 dark:text-white">
                      {selectedCourseForDetail.author?.name || selectedCourseForDetail.instructor?.name || 'Huỳnh Phong'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCourseForDetail(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-2">
                    {language === 'vi' ? 'Mô tả khóa học' : 'Course Description'}
                  </h4>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{selectedCourseForDetail.description}</p>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-2">
                    {language === 'vi' ? `Chương trình đào tạo (${selectedCourseForDetail.syllabus.length} bài thực hành)` : `Syllabus (${selectedCourseForDetail.syllabus.length} interactive labs)`}
                  </h4>
                  <div className="space-y-2">
                    {selectedCourseForDetail.syllabus.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">{item.summary}</div>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono whitespace-nowrap">
                          {item.duration || '15 min'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {selectedCourseForDetail.isFree ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{language === 'vi' ? 'Miễn phí' : 'Free'}</span>
                  ) : (
                    <span className="text-cyan-600 dark:text-cyan-400 font-mono">
                      {selectedCourseForDetail.price.toLocaleString('vi-VN')} ₫
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setViewerCourse(selectedCourseForDetail);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-cyan-50 dark:bg-cyan-950/80 hover:bg-cyan-100 dark:hover:bg-cyan-900 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/80 flex items-center gap-1.5 transition"
                  >
                    <Box className="w-4 h-4" />
                    <span>{language === 'vi' ? 'Xem mạch 3D' : '3D Preview'}</span>
                  </button>

                  <button
                    onClick={() => setSelectedCourseForDetail(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    {language === 'vi' ? 'Đóng' : 'Close'}
                  </button>

                  {enrollments[selectedCourseForDetail.id] ? (
                    <button
                      onClick={() => {
                        const c = selectedCourseForDetail;
                        setSelectedCourseForDetail(null);
                        onStartCourseLab(c);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 shadow-md flex items-center gap-1.5"
                    >
                      <PlayCircle className="w-4 h-4" />
                      <span>{language === 'vi' ? 'Vào phòng thực hành' : 'Launch Lab'}</span>
                    </button>
                  ) : selectedCourseForDetail.isFree ? (
                    <button
                      onClick={() => {
                        const c = selectedCourseForDetail;
                        setSelectedCourseForDetail(null);
                        handleEnrollFree(c);
                      }}
                      className="tech-btn-3d-green px-5 py-2.5 rounded-2xl text-xs font-extrabold text-white"
                    >
                      <span className="tracking-wide">{language === 'vi' ? 'Đăng ký miễn phí' : 'Enroll Free'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const c = selectedCourseForDetail;
                        setSelectedCourseForDetail(null);
                        handleOpenBuy(c);
                      }}
                      className="tech-btn-3d px-6 py-2.5 rounded-2xl text-xs font-extrabold text-white flex items-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                      <span className="tracking-wide">{language === 'vi' ? 'Thanh toán ngay qua VietQR' : 'Pay with VietQR'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {buySuccessMessage && (
          <div className="p-3.5 bg-emerald-50/95 dark:bg-emerald-950/80 border border-emerald-400 dark:border-emerald-500 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-2xl text-center shadow-lg animate-in fade-in transition-all">
            {buySuccessMessage}
          </div>
        )}

        {/* Official VietQR Payment Modal (Unified with Membership) */}
        <PaymentModal
          order={activePaymentOrder}
          isOpen={Boolean(activePaymentOrder)}
          onClose={() => {
            setActivePaymentOrder(null);
            setCourseToBuy(null);
          }}
          onPaymentSuccess={handlePaymentSuccess}
        />

        {/* 3D Product & Course Viewer Modal */}
        {viewerCourse && (
          <Product3DViewerModal
            productId={viewerCourse.id}
            productTitle={`Khóa học: ${viewerCourse.title}`}
            authorName={viewerCourse.author?.name || viewerCourse.instructor?.name || 'Huỳnh Phong'}
            price={viewerCourse.price}
            isOpen={Boolean(viewerCourse)}
            currentUser={currentUser}
            onOpenAuthModal={onOpenAuthModal}
            fallbackProject={viewerCourse.createLabProject ? viewerCourse.createLabProject() : undefined}
            onClose={() => setViewerCourse(null)}
            onBuy={() => {
              const c = viewerCourse;
              setViewerCourse(null);
              handleOpenBuy(c);
            }}
            onOpenInEditor={(doc) => {
              const c = viewerCourse;
              setViewerCourse(null);
              onStartCourseLab(c);
            }}
            onSaveToMyProjects={async (doc) => {
              const repo = projectRepositoryManager.getActiveRepository();
              await repo.saveProject(doc, { force: true });
            }}
          />
        )}
      </div>
    </div>
  );
};
