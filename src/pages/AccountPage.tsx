import React, { useState, useEffect } from 'react';
import { paymentService } from '../billing/paymentService';
import { CATALOG_PRODUCTS } from '../marketplace/catalogData';
import { Course } from '../domain/courses/types';
import { courseService } from '../domain/courses/courseService';
import { authService, UserProfile } from '../persistence/authService';
import { projectRepositoryManager } from '../persistence/repositoryManager';
import { ProjectDocument } from '../domain/project/types';
import { useI18n } from '../i18n/context';
import {
  User,
  ShieldCheck,
  Cpu,
  Sparkles,
  CreditCard,
  Clock,
  CheckCircle2,
  GraduationCap,
  PlayCircle,
  BookOpen,
  Edit2,
  LogOut,
  FolderOpen,
  ChevronRight,
  Award,
  Layers,
  Settings,
  Sun,
  Moon,
  Laptop,
  Languages,
} from 'lucide-react';

export interface AccountPageProps {
  currentUser?: any;
  currentProfile?: UserProfile | null;
  onOpenProject?: (project: ProjectDocument) => void;
  onStartCourseLab?: (course: Course, labId?: string) => void;
  onNavigate?: (route: any) => void;
  onOpenAuthModal?: () => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({
  currentUser,
  currentProfile,
  onOpenProject,
  onStartCourseLab,
  onNavigate,
  onOpenAuthModal,
}) => {
  const { theme, setTheme, language, setLanguage, t } = useI18n();
  const [activeTab, setActiveTab] = useState<'courses' | 'projects' | 'orders' | 'subscription' | 'settings'>('courses');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(currentProfile?.fullName || '');
  const [nameUpdateSuccess, setNameUpdateSuccess] = useState(false);
  const [savedProjects, setSavedProjects] = useState<ProjectDocument[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [account, setAccount] = useState(() => paymentService.getAccountInfo());
  const [orders, setOrders] = useState(() => paymentService.getOrders());
  const [myCourses, setMyCourses] = useState(() => courseService.getMyCourses());

  useEffect(() => {
    const refresh = () => {
      setAccount({ ...paymentService.getAccountInfo() });
      setOrders([...paymentService.getOrders()]);
      setMyCourses([...courseService.getMyCourses()]);
    };
    refresh();
    const unsubPayment = paymentService.subscribe(refresh);
    const unsubCourse = courseService.subscribe(refresh);
    return () => {
      unsubPayment();
      unsubCourse();
    };
  }, [currentUser]);

  const aiPercent = Math.min(100, Math.round((account.aiQueriesUsed / account.aiQueriesLimit) * 100));
  const projectsPercent = Math.min(100, Math.round((account.projectsCount / account.projectsLimit) * 100));
  const ownedProducts = CATALOG_PRODUCTS.filter((p) => account.entitlements.includes(p.id));

  // Average learning progress across enrolled courses
  const avgCourseProgress =
    myCourses.length > 0
      ? Math.round(myCourses.reduce((acc, c) => acc + c.enrollment.progressPercent, 0) / myCourses.length)
      : 0;

  useEffect(() => {
    if (currentProfile?.fullName) {
      setEditNameValue(currentProfile.fullName);
    }
  }, [currentProfile]);

  useEffect(() => {
    let isMounted = true;
    const loadProj = async () => {
      setLoadingProjects(true);
      try {
        const repo = projectRepositoryManager.getActiveRepository();
        const list = await repo.listProjects();
        if (isMounted) setSavedProjects(list);
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoadingProjects(false);
      }
    };
    loadProj();
    return () => { isMounted = false; };
  }, [currentUser]);

  const handleSaveName = async () => {
    if (!editNameValue.trim()) return;
    const res = await authService.updateFullName(editNameValue.trim());
    if (res.success) {
      setNameUpdateSuccess(true);
      setIsEditingName(false);
      setTimeout(() => setNameUpdateSuccess(false), 2500);
    }
  };

  const handleSignOut = async () => {
    await authService.signOut();
    onNavigate?.('landing');
  };

  // If user is guest
  if (!currentUser) {
    return (
      <div className="flex-1 overflow-y-auto bg-transparent p-6 md:p-12 select-none text-slate-800 dark:text-slate-100 flex items-center justify-center transition-colors">
        <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto">
            <User className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {language === 'vi' ? 'Chưa đăng nhập tài khoản' : 'Not Signed In'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {language === 'vi'
                ? 'Vui lòng đăng nhập để xem thông tin hồ sơ cá nhân, các khóa học đã đăng ký và thực hành thiết kế mạch 3D.'
                : 'Please sign in to view your profile, registered courses, and interactive 3D circuit designs.'}
            </p>
          </div>
          <button
            onClick={onOpenAuthModal}
            className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white dark:text-slate-950 text-xs font-bold transition shadow-md"
          >
            {language === 'vi' ? 'Đăng nhập ngay' : 'Sign In Now'}
          </button>
        </div>
      </div>
    );
  }

  const userDisplayName = currentProfile?.fullName || currentUser?.email?.split('@')[0] || (language === 'vi' ? 'Kỹ sư Thiết kế' : 'Design Engineer');
  const userInitials = userDisplayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="flex-1 overflow-y-auto bg-transparent p-6 md:p-8 select-none text-slate-800 dark:text-slate-100 transition-colors">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Profile Card */}
        <div className="p-6 md:p-8 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-600 via-teal-500 to-emerald-400 p-0.5 shadow-lg shadow-cyan-950/20">
              <div className="w-full h-full rounded-[14px] bg-slate-100 dark:bg-slate-950 flex items-center justify-center text-cyan-600 dark:text-cyan-300 text-2xl font-black">
                {userInitials || 'CC'}
              </div>
            </div>

            {/* Info */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-cyan-500/50 text-sm text-slate-900 dark:text-white font-bold focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveName}
                      className="px-2.5 py-1 rounded bg-cyan-500 text-white dark:text-slate-950 text-xs font-bold hover:bg-cyan-400"
                    >
                      {language === 'vi' ? 'Lưu' : 'Save'}
                    </button>
                    <button
                      onClick={() => setIsEditingName(false)}
                      className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs"
                    >
                      {language === 'vi' ? 'Hủy' : 'Cancel'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{userDisplayName}</h1>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="text-slate-400 hover:text-cyan-500 p-1 transition"
                      title={language === 'vi' ? 'Đổi tên hiển thị' : 'Edit display name'}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${
                  account.plan === 'creator'
                    ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40'
                    : currentProfile?.role === 'admin'
                    ? 'bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-500/40'
                    : account.plan === 'student'
                    ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                    : 'bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30'
                }`}>
                  {currentProfile?.role === 'admin'
                    ? (language === 'vi' ? 'Quản Trị Viên' : 'Administrator')
                    : account.plan === 'creator'
                    ? (language === 'vi' ? 'Nhà Sáng Tạo (Creator Pro)' : 'Creator Pro')
                    : account.plan === 'student'
                    ? (language === 'vi' ? 'Học Viên Pro' : 'Student Pro')
                    : (language === 'vi' ? 'Kỹ Sư Thiết Kế' : 'Design Engineer')}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>{currentUser.email}</span>
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[11px] font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  {language === 'vi' ? 'Đã kích hoạt' : 'Verified'}
                </span>
              </div>

              {nameUpdateSuccess && (
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  {language === 'vi' ? 'Đã cập nhật họ tên thành công!' : 'Name updated successfully!'}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-end">
            {paymentService.hasCreatorPlan() && (
              <button
                onClick={() => onNavigate?.('creator')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 text-xs font-bold shadow-md transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{language === 'vi' ? 'Mở Không gian Nhà sáng tạo' : 'Open Creator Studio'}</span>
              </button>
            )}

            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-rose-50 dark:hover:bg-red-950/40 hover:text-rose-600 dark:hover:text-red-400 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>{language === 'vi' ? 'Đăng xuất' : 'Sign Out'}</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1 shadow-xs">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              {language === 'vi' ? 'Khóa học đã đăng ký' : 'Enrolled Courses'}
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{myCourses.length}</div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1 shadow-xs">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              {language === 'vi' ? 'Tiến độ trung bình' : 'Average Progress'}
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">{avgCourseProgress}%</div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1 shadow-xs">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              {language === 'vi' ? 'Dự án đã lưu' : 'Saved Projects'}
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">{savedProjects.length}</div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1 shadow-xs">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-violet-500 dark:text-violet-400" />
              {language === 'vi' ? 'Truy vấn Minibot AI' : 'Minibot AI Queries'}
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {account.aiQueriesUsed}/{account.aiQueriesLimit}
            </div>
          </div>
        </div>

        {/* Content Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('courses')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              activeTab === 'courses'
                ? 'bg-cyan-500 text-white dark:text-slate-950 shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>{language === 'vi' ? `Khóa học của tôi (${myCourses.length})` : `My Courses (${myCourses.length})`}</span>
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              activeTab === 'projects'
                ? 'bg-cyan-500 text-white dark:text-slate-950 shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>{language === 'vi' ? `Dự án của tôi (${savedProjects.length})` : `My Projects (${savedProjects.length})`}</span>
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              activeTab === 'orders'
                ? 'bg-cyan-500 text-white dark:text-slate-950 shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>{language === 'vi' ? `Lịch sử đơn hàng (${orders.length})` : `Orders (${orders.length})`}</span>
          </button>
          <button
            onClick={() => setActiveTab('subscription')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              activeTab === 'subscription'
                ? 'bg-cyan-500 text-white dark:text-slate-950 shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{language === 'vi' ? 'Gói cước & Quyền lợi' : 'Subscription & Quota'}</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              activeTab === 'settings'
                ? 'bg-cyan-500 text-white dark:text-slate-950 shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>{language === 'vi' ? 'Giao diện & Cài đặt' : 'Appearance & Settings'}</span>
          </button>
        </div>

        {/* TAB 1: KHÓA HỌC CỦA TÔI */}
        {activeTab === 'courses' && (
          <div className="space-y-4">
            {myCourses.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <BookOpen className="w-10 h-10 text-slate-400 mx-auto" />
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {language === 'vi' ? 'Bạn chưa đăng ký khóa học nào' : 'No courses enrolled yet'}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  {language === 'vi'
                    ? 'Khám phá danh mục các khóa học điện tử 3D tương tác từ cơ bản đến nâng cao để bắt đầu hành trình học tập.'
                    : 'Explore interactive 3D hardware design courses from fundamentals to industry PCB.'}
                </p>
                <button
                  onClick={() => onNavigate?.('courses')}
                  className="px-4 py-2 rounded-xl bg-cyan-500 text-white dark:text-slate-950 font-bold text-xs hover:bg-cyan-400 shadow-sm"
                >
                  {language === 'vi' ? 'Khám phá khóa học ngay' : 'Explore Courses'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myCourses.map(({ course, enrollment }) => (
                  <div
                    key={course.id}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between space-y-4 shadow-sm"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30">
                          {course.level}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5" />
                          {course.duration}
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug">{course.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{course.tagline}</p>
                      <div className="text-[11px] text-cyan-600 dark:text-cyan-300 flex items-center gap-1.5 pt-1 font-medium">
                        <span>{language === 'vi' ? 'Tác giả:' : 'Instructor:'}</span>
                        <span className="text-slate-800 dark:text-white font-semibold">
                          {course.author?.name || course.instructor?.name || 'Huỳnh Phong'}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-850 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-300 font-medium">
                          {language === 'vi' ? 'Tiến độ hoàn thành:' : 'Completion Progress:'}
                        </span>
                        <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                          {enrollment.progressPercent}% ({enrollment.completedLessons.length}/{course.syllabus.length} {language === 'vi' ? 'bài' : 'lessons'})
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${enrollment.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Action */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {course.isFree ? (language === 'vi' ? 'Khóa học miễn phí' : 'Free Course') : (language === 'vi' ? 'Khóa học Pro' : 'Pro Course')}
                      </span>

                      <button
                        onClick={() => onStartCourseLab?.(course)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 font-bold text-xs transition shadow-xs"
                      >
                        <PlayCircle className="w-4 h-4" />
                        <span>{language === 'vi' ? 'Thực hành 3D ngay' : 'Launch 3D Lab'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DỰ ÁN CỦA TÔI */}
        {activeTab === 'projects' && (
          <div className="space-y-4">
            {savedProjects.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <Cpu className="w-10 h-10 text-slate-400 mx-auto" />
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {language === 'vi' ? 'Chưa có dự án mạch nào' : 'No saved circuit projects'}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  {language === 'vi'
                    ? 'Tạo dự án mới trong không gian 3D để bắt đầu thiết kế, lắp ráp và mô phỏng mạch điện.'
                    : 'Create a new design in the 3D space to start building, wiring, and simulating.'}
                </p>
                <button
                  onClick={() => onNavigate?.('projects')}
                  className="px-4 py-2 rounded-xl bg-cyan-500 text-white dark:text-slate-950 font-bold text-xs hover:bg-cyan-400 shadow-sm"
                >
                  {language === 'vi' ? 'Tạo thiết kế 3D mới' : 'Create 3D Design'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedProjects.map((p) => (
                  <div
                    key={p.projectId}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/40 transition flex flex-col justify-between space-y-3 shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                        <span className="font-mono">Rev #{p.revision}</span>
                        <span>{p.components?.length || 0} {language === 'vi' ? 'linh kiện' : 'components'}</span>
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">{p.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                        {p.description || (language === 'vi' ? 'Không có mô tả chi tiết' : 'No description')}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        {new Date(p.updatedAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}
                      </span>
                      <button
                        onClick={() => {
                          onOpenProject?.(p);
                          onNavigate?.('editor');
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-500/20 hover:bg-cyan-100 dark:hover:bg-cyan-500/30 text-cyan-700 dark:text-cyan-300 text-xs font-semibold transition"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>{language === 'vi' ? 'Mở thiết kế' : 'Open'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ĐƠN HÀNG & HÓA ĐƠN */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                {language === 'vi' ? 'Chưa có giao dịch phát sinh nào.' : 'No purchase orders yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5">{language === 'vi' ? 'Mã đơn hàng' : 'Order ID'}</th>
                      <th className="p-3.5">{language === 'vi' ? 'Sản phẩm / Khóa học' : 'Product / Course'}</th>
                      <th className="p-3.5">{language === 'vi' ? 'Số tiền' : 'Amount'}</th>
                      <th className="p-3.5">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                      <th className="p-3.5">{language === 'vi' ? 'Thời gian' : 'Date'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-850 bg-white dark:bg-slate-950/60">
                    {orders.map((o) => (
                      <tr key={o.orderId}>
                        <td className="p-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">{o.orderId}</td>
                        <td className="p-3.5 font-medium text-slate-800 dark:text-slate-200">{o.productName}</td>
                        <td className="p-3.5 font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                          {o.amount.toLocaleString('vi-VN')} ₫
                        </td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                            {o.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-500 dark:text-slate-400 text-[11px]">
                          {new Date(o.createdAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: GÓI CƯỚC & BẢN QUYỀN */}
        {activeTab === 'subscription' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* AI Usage */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    {language === 'vi' ? 'Truy vấn Minibot AI' : 'Minibot AI Queries'}
                  </span>
                  <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                    {account.aiQueriesUsed} / {account.aiQueriesLimit}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${aiPercent}%` }} />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {language === 'vi' ? 'Tự động đặt lại vào ngày đầu tiên của tháng kế tiếp.' : 'Automatically resets on the first day of each month.'}
                </p>
              </div>

              {/* Projects Storage */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    {language === 'vi' ? 'Dung lượng lưu trữ dự án' : 'Project Storage Quota'}
                  </span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    {account.projectsCount} / {account.projectsLimit}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${projectsPercent}%` }} />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {language === 'vi' ? 'Được đồng bộ an toàn và bảo vệ riêng tư.' : 'Encrypted and synchronized with cloud persistence.'}
                </p>
              </div>
            </div>

            {/* Marketplace Entitlements */}
            {ownedProducts.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  {language === 'vi'
                    ? `Mẫu mạch Cửa hàng đã sở hữu (${ownedProducts.length})`
                    : `Owned Marketplace Designs (${ownedProducts.length})`}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ownedProducts.map((p) => (
                    <div key={p.id} className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1 shadow-xs">
                      <div className="font-bold text-slate-900 dark:text-white text-xs">{p.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{p.tagline}</div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 pt-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{language === 'vi' ? 'Đã kích hoạt bản quyền' : 'Licensed'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: GIAO DIỆN & CÀI ĐẶT (PREFERENCES) */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Theme settings */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Sun className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {language === 'vi' ? 'Giao diện (Theme)' : 'Color Theme'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {language === 'vi'
                      ? 'Chọn chế độ hiển thị phù hợp với điều kiện ánh sáng phòng làm việc.'
                      : 'Select the color scheme that best fits your engineering environment.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {/* Light option */}
                <button
                  onClick={() => setTheme('light')}
                  className={`p-4 rounded-xl border text-left flex flex-col justify-between space-y-3 transition ${
                    theme === 'light'
                      ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/30 ring-2 ring-cyan-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Sun className="w-5 h-5 text-amber-500" />
                    {theme === 'light' && <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {language === 'vi' ? 'Giao diện Sáng (Light)' : 'Light Mode'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {language === 'vi' ? 'Không gian làm việc kỹ thuật cao cấp' : 'Clean daytime engineering workspace'}
                    </div>
                  </div>
                </button>

                {/* Dark option */}
                <button
                  onClick={() => setTheme('dark')}
                  className={`p-4 rounded-xl border text-left flex flex-col justify-between space-y-3 transition ${
                    theme === 'dark'
                      ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/30 ring-2 ring-cyan-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Moon className="w-5 h-5 text-cyan-400" />
                    {theme === 'dark' && <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {language === 'vi' ? 'Giao diện Tối (Dark)' : 'Dark Mode'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {language === 'vi' ? 'Phòng thí nghiệm điện tử hiện đại' : 'Modern electronics lab atmosphere'}
                    </div>
                  </div>
                </button>

                {/* System option */}
                <button
                  onClick={() => setTheme('system')}
                  className={`p-4 rounded-xl border text-left flex flex-col justify-between space-y-3 transition ${
                    theme === 'system'
                      ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/30 ring-2 ring-cyan-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Laptop className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    {theme === 'system' && <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {language === 'vi' ? 'Theo hệ thống (System)' : 'System Auto'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {language === 'vi' ? 'Tự động đồng bộ với hệ điều hành' : 'Sync with OS light/dark schedule'}
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Language settings */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Languages className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {language === 'vi' ? 'Ngôn ngữ hiển thị (Language)' : 'Display Language'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {language === 'vi'
                      ? 'Chọn ngôn ngữ giao diện và hướng dẫn trợ lý ảo Minibot.'
                      : 'Select UI language and Minibot AI response locale.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* Vietnamese */}
                <button
                  onClick={() => setLanguage('vi')}
                  className={`p-4 rounded-xl border text-left flex items-center justify-between transition ${
                    language === 'vi'
                      ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/30 ring-2 ring-cyan-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🇻🇳</span>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Tiếng Việt</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">Vietnamese (Cửa hàng, Khóa học, Thư viện)</div>
                    </div>
                  </div>
                  {language === 'vi' && <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />}
                </button>

                {/* English */}
                <button
                  onClick={() => setLanguage('en')}
                  className={`p-4 rounded-xl border text-left flex items-center justify-between transition ${
                    language === 'en'
                      ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/30 ring-2 ring-cyan-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🇺🇸</span>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">English</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">English (Marketplace, Courses, Library)</div>
                    </div>
                  </div>
                  {language === 'en' && <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />}
                </button>
              </div>
            </div>

            {/* Persistence Notice */}
            <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>
                {language === 'vi'
                  ? 'Tùy chọn giao diện và ngôn ngữ của bạn được lưu tự động trên trình duyệt và đồng bộ với tài khoản.'
                  : 'Your appearance and language preferences are saved automatically in local storage and synced to your profile.'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
