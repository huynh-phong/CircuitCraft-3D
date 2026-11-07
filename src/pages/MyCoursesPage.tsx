import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  BookOpen,
  Cpu,
  PlayCircle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  FileSpreadsheet,
  Video,
  Layers,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { Course, CourseSyllabusItem, UserCourseEnrollment } from '../domain/courses/types';
import { courseService } from '../domain/courses/courseService';
import { useI18n } from '../i18n/context';

export interface MyCoursesPageProps {
  currentUser: any;
  selectedCourseId?: string | null;
  onSelectCourse?: (courseId: string | null) => void;
  onOpenTheoryLesson: (course: Course, lesson: CourseSyllabusItem) => void;
  onStartPracticeLab: (course: Course, practiceItem: CourseSyllabusItem) => void;
  onExploreCatalog: () => void;
}

export const MyCoursesPage: React.FC<MyCoursesPageProps> = ({
  currentUser,
  selectedCourseId,
  onSelectCourse,
  onOpenTheoryLesson,
  onStartPracticeLab,
  onExploreCatalog,
}) => {
  const { language } = useI18n();
  const [myCourses, setMyCourses] = useState<
    Array<{ course: Course; enrollment: UserCourseEnrollment }>
  >(() => courseService.getMyCourses());
  const [activeCourseId, setActiveCourseId] = useState<string | null>(selectedCourseId || null);

  useEffect(() => {
    if (selectedCourseId !== undefined) {
      setActiveCourseId(selectedCourseId);
    }
  }, [selectedCourseId]);

  useEffect(() => {
    courseService.fetchPublishedCoursesFromServer();
    const update = () => {
      setMyCourses([...courseService.getMyCourses()]);
    };
    update();
    return courseService.subscribe(update);
  }, [currentUser]);

  const handleChooseCourse = (courseId: string | null) => {
    setActiveCourseId(courseId);
    if (onSelectCourse) onSelectCourse(courseId);
  };

  const activeEntry = myCourses.find((item) => item.course.id === activeCourseId) || null;

  // ============================================================================
  // VIEW 2: INSIDE A SELECTED COURSE -> SHOW 2 SECTIONS: LÝ THUYẾT & THỰC HÀNH
  // ============================================================================
  if (activeEntry) {
    const { course, enrollment } = activeEntry;
    const theoryLessons = course.syllabus.filter(
      (s) => s.sectionType === 'theory' || !s.isPracticalLab
    );
    const practiceLessons = course.syllabus.filter(
      (s) => s.sectionType === 'practice' || s.isPracticalLab
    );

    const completedCount = enrollment.completedLessons.length;
    const totalCount = Math.max(1, course.syllabus.length);
    const progressPct = Math.min(100, Math.round((completedCount / totalCount) * 100));

    return (
      <div className="flex-1 overflow-y-auto bg-transparent p-4 sm:p-6 md:p-8 select-none text-slate-800 dark:text-slate-100">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Top Navigation & Course Progress Header */}
          <div className="tech-panel p-5 sm:p-7 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => handleChooseCourse(null)}
                className="tech-btn-secondary px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại Khóa học của tôi</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-600 dark:text-cyan-300 text-xs font-bold">
                  {course.level}
                </span>
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-300 text-xs font-bold">
                  Đã hoàn thành {completedCount}/{course.syllabus.length} nội dung ({progressPct}%)
                </span>
              </div>
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                {course.title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                {course.description}
              </p>
            </div>

            {/* Overall Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600 dark:text-slate-400">
                  Tiến độ hoàn thành khóa học
                </span>
                <span className="text-cyan-600 dark:text-cyan-400 font-mono">{progressPct}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* 2 MỤC CHÍNH: 1. PHẦN LÝ THUYẾT & 2. PHẦN THỰC HÀNH */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* MỤC 1: LÝ THUYẾT (SLIDE BÀI GIẢNG & TRỢ GIẢNG AI) */}
            <div className="tech-panel p-5 sm:p-6 flex flex-col justify-between space-y-5 border-t-4 border-t-cyan-500">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                        Mục 1 • Học Lý Thuyết
                      </span>
                      <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                        Phần Lý Thuyết ({theoryLessons.length} bài)
                      </h2>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Học trên trang trình chiếu Slide (.pptx) của giảng viên kèm Video bài giảng (nếu có) và khung <strong>Trợ giảng AI riêng biệt</strong> theo dõi sát từng slide bạn đang xem.
                </p>

                {theoryLessons.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                    Khóa học này chưa có bài giảng lý thuyết.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {theoryLessons.map((lesson, idx) => {
                      const isCompleted = enrollment.completedLessons.includes(lesson.id);
                      const viewedSlides = courseService.getViewedSlides(course.id, lesson.id);
                      const totalSlides = lesson.slideCount ?? lesson.slides?.length ?? 0;

                      return (
                        <div
                          key={lesson.id}
                          className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-cyan-200/80 dark:border-cyan-800/50 hover:border-cyan-500 transition space-y-3 shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5">
                              <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                                  {lesson.title}
                                </h3>
                                {lesson.summary && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                    {lesson.summary}
                                  </p>
                                )}
                              </div>
                            </div>

                            <span
                              className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                                isCompleted
                                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {isCompleted ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  Hoàn thành
                                </>
                              ) : (
                                <>Chưa hoàn thành</>
                              )}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                              <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-semibold">
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                {totalSlides} slide ({viewedSlides.length}/{totalSlides} đã xem)
                              </span>
                              {(lesson.hasVideo || lesson.videoUrl) && (
                                <span className="flex items-center gap-1 text-indigo-500 font-semibold">
                                  <Video className="w-3.5 h-3.5" />
                                  Có Video
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => onOpenTheoryLesson(course, lesson)}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-600/20 cursor-pointer transition"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>Vào học lý thuyết</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* MỤC 2: THỰC HÀNH (PHÒNG LAB 3D & HƯỚNG DẪN 3 GIAI ĐOẠN) */}
            <div className="tech-panel p-5 sm:p-6 flex flex-col justify-between space-y-5 border-t-4 border-t-emerald-500">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Cpu className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Mục 2 • Thực Hành Lab 3D
                      </span>
                      <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                        Phần Thực Hành ({practiceLessons.length} bài Lab)
                      </h2>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Không gian thực hành lắp ráp và mô phỏng mạch điện 3D trực quan.
                </p>

                {practiceLessons.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                    Khóa học này chưa có bài thực hành 3D.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {practiceLessons.map((lab, idx) => {
                      const isCompleted = enrollment.completedLessons.includes(lab.id);
                      const compCount = lab.practiceComponentCount ?? lab.practiceProjectSnapshot?.components?.length ?? 0;
                      const wireCount = lab.practiceConnectionCount ?? lab.practiceProjectSnapshot?.connections?.length ?? 0;

                      return (
                        <div
                          key={lab.id}
                          className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-emerald-200/80 dark:border-emerald-800/50 hover:border-emerald-500 transition space-y-3 shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5">
                              <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                                  {lab.title}
                                </h3>
                                {lab.summary && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                    {lab.summary}
                                  </p>
                                )}
                              </div>
                            </div>

                            <span
                              className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                                isCompleted
                                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {isCompleted ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  Hoàn thành
                                </>
                              ) : (
                                <>Chưa hoàn thành</>
                              )}
                            </span>
                          </div>

                          <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button
                              onClick={() => onStartPracticeLab(course, lab)}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer transition"
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                              <span>Vào thực hành Lab</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 1: MY ENROLLED COURSES LIST ("KHÓA HỌC CỦA TÔI")
  // ============================================================================
  return (
    <div className="flex-1 overflow-y-auto bg-transparent p-4 sm:p-6 md:p-8 select-none text-slate-800 dark:text-slate-100">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="tech-panel p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              <GraduationCap className="w-4 h-4" />
              <span>Không gian Học tập Cá nhân</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {language === 'vi' ? 'Khóa học của tôi' : 'My Enrolled Courses'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              Quản lý tiến độ học tập, nhấn <strong>"Vào học"</strong> để chọn học <strong>Lý thuyết (Slide & Trợ giảng AI)</strong> hoặc <strong>Thực hành Lab 3D (3 giai đoạn)</strong>.
            </p>
          </div>

          <button
            onClick={onExploreCatalog}
            className="tech-btn-secondary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-cyan-500" />
            <span>Khám phá thêm khóa học</span>
          </button>
        </div>

        {myCourses.length === 0 ? (
          <div className="tech-panel p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 flex items-center justify-center mx-auto">
              <GraduationCap className="w-8 h-8" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Bạn chưa đăng ký khóa học nào
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Hãy khám phá danh mục Khóa học hoặc vào Khu vực Creator để tạo khóa học mới với phần Lý thuyết và Thực hành.
              </p>
            </div>
            <button
              onClick={onExploreCatalog}
              className="tech-btn-3d-green px-6 py-2.5 rounded-xl text-xs font-extrabold text-white inline-flex items-center gap-2 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Xem danh sách Khóa học</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myCourses.map(({ course, enrollment }) => {
              const theoryCount = course.syllabus.filter(
                (s) => s.sectionType === 'theory' || !s.isPracticalLab
              ).length;
              const practiceCount = course.syllabus.filter(
                (s) => s.sectionType === 'practice' || s.isPracticalLab
              ).length;

              return (
                <div
                  key={course.id}
                  className="tech-card flex flex-col justify-between overflow-hidden transition-all"
                >
                  <div>
                    <div
                      className={`h-36 bg-gradient-to-tr ${course.thumbnailGradient} p-4 flex flex-col justify-between`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-lg bg-slate-950/70 text-slate-200 border border-white/10">
                          {course.level}
                        </span>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg bg-emerald-400 text-slate-950">
                          Đã sở hữu
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-white font-semibold bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-lg w-fit">
                        <Layers className="w-3.5 h-3.5 text-cyan-300" />
                        <span>
                          {theoryCount} Phần Lý thuyết • {practiceCount} Phần Thực hành
                        </span>
                      </div>
                    </div>

                    <div className="p-5 space-y-3">
                      <h3 className="font-bold text-slate-900 dark:text-white text-base line-clamp-2">
                        {course.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {course.tagline}
                      </p>

                      {/* Progress bar */}
                      <div className="tech-card-nested p-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            Tiến độ hoàn thành
                          </span>
                          <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                            {enrollment.progressPercent}% ({enrollment.completedLessons.length}/
                            {course.syllabus.length})
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all"
                            style={{ width: `${enrollment.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 pt-0">
                    <button
                      onClick={() => handleChooseCourse(course.id)}
                      className="w-full tech-btn-3d-green py-2.5 px-4 rounded-2xl text-xs font-extrabold text-white flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      <PlayCircle className="w-4 h-4" />
                      <span>Vào học (Lý thuyết & Thực hành)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
