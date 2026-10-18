import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  Loader2,
  PlayCircle,
  RotateCcw,
  Send,
  Sparkles,
  Video,
  PanelLeft,
  MessageSquare,
} from 'lucide-react';
import { Course, CourseSlide, CourseSyllabusItem } from '../domain/courses/types';
import { courseService } from '../domain/courses/courseService';

export interface TheoryLearningPageProps {
  course: Course;
  initialLesson: CourseSyllabusItem;
  currentUser?: any;
  onBackToMyCourse: () => void;
  onSwitchPracticeLab: (course: Course, practiceItem: CourseSyllabusItem) => void;
}

interface TheoryTutorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  slideNumber?: number;
  lessonTitle?: string;
  timestamp: string;
}

export const TheoryLearningPage: React.FC<TheoryLearningPageProps> = ({
  course,
  initialLesson,
  currentUser,
  onBackToMyCourse,
  onSwitchPracticeLab,
}) => {
  const [activeLesson, setActiveLesson] = useState<CourseSyllabusItem>(initialLesson);
  const [currentSlideIdx, setCurrentSlideIdx] = useState<number>(0);
  const [activeMediaMode, setActiveMediaMode] = useState<'slides' | 'video'>('slides');
  const [viewedSlides, setViewedSlides] = useState<number[]>([]);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);

  // Responsive mobile view tab switcher ('content' = Bảng trái, 'slides' = Ở giữa, 'tutor' = Bảng phải)
  const [mobileActiveTab, setMobileActiveTab] = useState<'content' | 'slides' | 'tutor'>('slides');

  // Dedicated AI Theory Tutor State (completely independent from homepage & 3D workspace AI)
  const [tutorMessages, setTutorMessages] = useState<TheoryTutorMessage[]>([]);
  const [tutorInput, setTutorInput] = useState('');
  const [isTutorLoading, setIsTutorLoading] = useState(false);
  const tutorEndRef = useRef<HTMLDivElement>(null);

  // Build effective slides list (guarantee at least 1 slide even if empty)
  const slides: CourseSlide[] =
    Array.isArray(activeLesson.slides) && activeLesson.slides.length > 0
      ? activeLesson.slides
      : [
          {
            id: 'slide-1',
            slideNumber: 1,
            title: activeLesson.title,
            bullets: [
              activeLesson.summary || 'Nội dung bài giảng lý thuyết trọng tâm.',
              'Hãy xem kỹ các khái niệm trên slide và đặt câu hỏi cho Trợ giảng AI ở khung bên phải nếu bạn có bất kỳ thắc mắc nào.',
            ],
            contentText: `${activeLesson.title}\n${activeLesson.summary || ''}`,
          },
        ];

  const currentSlide = slides[Math.min(currentSlideIdx, slides.length - 1)] || slides[0];

  // Storage key for Theory AI Tutor chat per course (preserved across all chapters/lessons within this course)
  const tutorStorageKey = `cc3d_theory_tutor_${course.id}`;

  // Synchronize active lesson if initialLesson changes from external navigation
  useEffect(() => {
    if (initialLesson && initialLesson.id !== activeLesson.id) {
      setActiveLesson(initialLesson);
      setCurrentSlideIdx(0);
      setActiveMediaMode('slides');
    }
  }, [initialLesson.id]);

  // Load course tutor history when course changes (preserved across all chapters/lessons)
  useEffect(() => {
    try {
      const raw =
        localStorage.getItem(tutorStorageKey) ||
        (currentUser?.id ? localStorage.getItem(`cc3d_theory_tutor_${currentUser.id}_${course.id}`) : null) ||
        localStorage.getItem(`cc3d_theory_tutor_guest_${course.id}`);
      if (raw) {
        setTutorMessages(JSON.parse(raw));
      } else {
        setTutorMessages([]);
      }
    } catch {
      setTutorMessages([]);
    }
  }, [course.id, tutorStorageKey, currentUser?.id]);

  // Save tutor history across the course
  useEffect(() => {
    try {
      if (tutorMessages.length > 0) {
        localStorage.setItem(tutorStorageKey, JSON.stringify(tutorMessages));
      }
    } catch {}
  }, [tutorMessages, tutorStorageKey]);

  // Auto-scroll tutor chat
  useEffect(() => {
    tutorEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tutorMessages, isTutorLoading]);

  // Sync enrollment & mark current slide as viewed
  useEffect(() => {
    const result = courseService.markSlideViewed(
      course.id,
      activeLesson.id,
      currentSlide.slideNumber,
      slides.length
    );

    setViewedSlides([...result.viewedSlides]);
    const updatedEnr = courseService.getEnrollment(course.id);
    setCompletedLessons(updatedEnr?.completedLessons || []);
  }, [course.id, activeLesson.id, currentSlide.slideNumber, slides.length]);

  // Keyboard navigation Left/Right arrows for slide viewing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.key === 'ArrowRight') {
        setCurrentSlideIdx((prev) => Math.min(slides.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlideIdx((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slides.length]);

  const handleSelectLesson = (item: CourseSyllabusItem) => {
    if (item.sectionType === 'practice' || item.isPracticalLab) {
      onSwitchPracticeLab(course, item);
      return;
    }
    setActiveLesson(item);
    setCurrentSlideIdx(0);
    setActiveMediaMode('slides');
    setMobileActiveTab('slides');
  };

  const handleAskTutor = async (customQuestion?: string) => {
    const q = (customQuestion || tutorInput).trim();
    if (!q || isTutorLoading) return;

    setTutorInput('');
    const userMsg: TheoryTutorMessage = {
      id: `t-usr-${Date.now()}`,
      role: 'user',
      content: q,
      slideNumber: currentSlide.slideNumber,
      lessonTitle: activeLesson.title,
      timestamp: new Date().toISOString(),
    };

    const nextHistory = [...tutorMessages, userMsg];
    setTutorMessages(nextHistory);
    setIsTutorLoading(true);

    try {
      const courseSyllabusSummary = course.syllabus
        .map(
          (s, i) =>
            `${i + 1}. [${s.sectionType === 'practice' || s.isPracticalLab ? 'Thực hành' : 'Lý thuyết'}] ${s.title}: ${
              s.summary || ''
            }`
        )
        .join('\n');

      const res = await fetch('/api/courses/theory-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseTitle: course.title,
          courseDescription: course.description,
          lessonTitle: activeLesson.title,
          lessonSummary: activeLesson.summary,
          currentSlideNumber: currentSlide.slideNumber,
          currentSlide,
          allSlides: slides,
          courseSyllabusSummary,
          prompt: q,
          history: nextHistory,
        }),
      });

      const data = await res.json();
      const assistantMsg: TheoryTutorMessage = {
        id: `t-ast-${Date.now()}`,
        role: 'assistant',
        content:
          data.reply ||
          `Mình đang theo dõi Slide ${currentSlide.slideNumber} ("${currentSlide.title}"). Nội dung chính: ${currentSlide.bullets.join(
            '; '
          )}`,
        slideNumber: currentSlide.slideNumber,
        lessonTitle: activeLesson.title,
        timestamp: new Date().toISOString(),
      };
      setTutorMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const fallbackMsg: TheoryTutorMessage = {
        id: `t-err-${Date.now()}`,
        role: 'assistant',
        content: `**[Trợ giảng AI — Đang ở ${activeLesson.title} • Slide ${currentSlide.slideNumber}: "${currentSlide.title}"]**\nNội dung chính của slide này:\n${currentSlide.bullets
          .map((b) => `• ${b}`)
          .join('\n')}`,
        slideNumber: currentSlide.slideNumber,
        lessonTitle: activeLesson.title,
        timestamp: new Date().toISOString(),
      };
      setTutorMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTutorLoading(false);
    }
  };

  const handleClearTutorChat = () => {
    localStorage.removeItem(tutorStorageKey);
    setTutorMessages([]);
  };

  const isLessonDone =
    completedLessons.includes(activeLesson.id) || viewedSlides.length >= slides.length;
  const slideProgressPct = Math.min(100, Math.round((viewedSlides.length / slides.length) * 100));
  const courseProgressPct = Math.min(
    100,
    Math.round((completedLessons.length / Math.max(1, course.syllabus.length)) * 100)
  );

  const theoryLessons = course.syllabus.filter(
    (s) => s.sectionType === 'theory' || !s.isPracticalLab
  );
  const practiceLessons = course.syllabus.filter(
    (s) => s.sectionType === 'practice' || s.isPracticalLab
  );

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-slate-100/70 dark:bg-[#050d1a] text-slate-800 dark:text-slate-100 select-none">
      {/* 1. TOP HEADER BAR: Back Button + Lesson Info + Completion Progress */}
      <div className="h-14 px-4 sm:px-6 bg-white/95 dark:bg-[#071426]/95 border-b border-slate-200 dark:border-cyan-900/50 flex items-center justify-between gap-4 shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBackToMyCourse}
            className="tech-btn-secondary px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer hover:border-cyan-500 transition"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-500" />
            <span className="hidden sm:inline">Quay lại khóa học</span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30 shrink-0">
                Học Lý Thuyết
              </span>
              <h1 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                {activeLesson.title}
              </h1>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Khóa học: {course.title}
            </p>
          </div>
        </div>

        {/* Completion Status Bar */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex flex-col items-end">
            <div className="flex items-center gap-2 text-[11px] font-bold">
              <span className="text-slate-500 dark:text-slate-400">
                Tiến độ xem Slide: {viewedSlides.length}/{slides.length} ({slideProgressPct}%)
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 font-semibold ${
                  isLessonDone
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                }`}
              >
                {isLessonDone ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    Đã hoàn thành
                  </>
                ) : (
                  <>Chưa hoàn thành</>
                )}
              </span>
            </div>
            <div className="w-36 md:w-44 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${slideProgressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Segment Switcher (< lg screens only) */}
      <div className="lg:hidden flex items-center bg-white dark:bg-[#071629] border-b border-slate-200 dark:border-cyan-900/50 p-1.5 shrink-0 justify-around text-xs font-bold">
        <button
          onClick={() => setMobileActiveTab('content')}
          className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
            mobileActiveTab === 'content'
              ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/40'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <PanelLeft className="w-3.5 h-3.5" />
          <span>Nội dung & Slide</span>
        </button>
        <button
          onClick={() => setMobileActiveTab('slides')}
          className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
            mobileActiveTab === 'slides'
              ? 'bg-cyan-600 text-white'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Slide ({currentSlide.slideNumber}/{slides.length})</span>
        </button>
        <button
          onClick={() => setMobileActiveTab('tutor')}
          className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
            mobileActiveTab === 'tutor'
              ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/40'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Bot className="w-3.5 h-3.5 text-cyan-500" />
          <span>Trợ giảng AI</span>
        </button>
      </div>

      {/* 2. MAIN WORKSPACE: 3 DISTINCT COLUMNS
          [ BẢNG TRÁI: NỘI DUNG KHÓA HỌC & SLIDE ] | [ Ở GIỮA: SLIDE BÀI GIẢNG ] | [ BẢNG PHẢI: TRỢ GIẢNG AI LÝ THUYẾT ]
      */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* ========================================================================= */}
        {/* BẢNG TRÁI: NỘI DUNG KHÓA HỌC & DANH SÁCH SLIDE (CURRICULUM & SLIDE JUMP)  */}
        {/* ========================================================================= */}
        <aside
          className={`w-full lg:w-72 xl:w-80 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-cyan-900/50 bg-white/95 dark:bg-[#061222]/95 flex flex-col shrink-0 overflow-hidden ${
            mobileActiveTab === 'content' ? 'flex flex-1' : 'hidden lg:flex'
          }`}
        >
          {/* Progress Header */}
          <div className="p-3.5 bg-slate-50 dark:bg-[#08192e] border-b border-slate-200 dark:border-cyan-900/40 space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-500" />
                Nội dung Khóa học & Slide
              </span>
              <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {completedLessons.length}/{course.syllabus.length} bài ({courseProgressPct}%)
              </span>
            </div>

            {/* Overall Course Progress Bar */}
            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${courseProgressPct}%` }}
              />
            </div>
          </div>

          {/* Scrollable Curriculum List: Theory Lessons with Slides & Practice Labs */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
            {/* Part 1: Theory Lessons & Slides */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 px-1">
                Phần 1: Lý thuyết ({theoryLessons.length} bài)
              </div>
              {theoryLessons.map((item, idx) => {
                const isCurrentLesson = item.id === activeLesson.id;
                const isDone = completedLessons.includes(item.id);
                const itemSlides = item.slides || [];

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border transition overflow-hidden ${
                      isCurrentLesson
                        ? 'border-cyan-500/60 bg-cyan-50/40 dark:bg-cyan-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50'
                    }`}
                  >
                    <button
                      onClick={() => handleSelectLesson(item)}
                      className="w-full p-2.5 text-left flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <BookOpen
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isCurrentLesson ? 'text-cyan-500' : 'text-slate-400'
                          }`}
                        />
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          Bài {idx + 1}: {item.title}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          isDone
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {isDone ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            Xong
                          </>
                        ) : (
                          'Chưa'
                        )}
                      </span>
                    </button>

                    {/* Slide list inside the active Theory Lesson for instant jumping */}
                    {isCurrentLesson && itemSlides.length > 0 && (
                      <div className="px-2 pb-2 pt-1 border-t border-cyan-200/50 dark:border-cyan-900/40 space-y-1">
                        {itemSlides.map((sl, sIdx) => {
                          const isActiveSlide = sIdx === currentSlideIdx;
                          const isSlViewed = viewedSlides.includes(sl.slideNumber);
                          return (
                            <button
                              key={sl.id}
                              onClick={() => {
                                setActiveMediaMode('slides');
                                setCurrentSlideIdx(sIdx);
                                setMobileActiveTab('slides');
                              }}
                              className={`w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] flex items-center justify-between gap-2 transition cursor-pointer ${
                                isActiveSlide
                                  ? 'bg-cyan-600 text-white font-bold shadow-xs'
                                  : 'hover:bg-cyan-100/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span className="truncate">
                                Slide {sl.slideNumber}: {sl.title}
                              </span>
                              {isSlViewed && (
                                <CheckCircle2
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    isActiveSlide ? 'text-white' : 'text-emerald-500'
                                  }`}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Part 2: Practice Labs */}
            {practiceLessons.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 px-1">
                  Phần 2: Thực hành Lab 3D ({practiceLessons.length} bài)
                </div>
                {practiceLessons.map((lab, idx) => {
                  const isDone = completedLessons.includes(lab.id);
                  return (
                    <button
                      key={lab.id}
                      onClick={() => onSwitchPracticeLab(course, lab)}
                      className="w-full p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20 hover:border-emerald-500 text-left flex items-center justify-between gap-2 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Cpu className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          Lab {idx + 1}: {lab.title}
                        </span>
                      </div>
                      <span className="shrink-0 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        {isDone ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            Xong
                          </>
                        ) : (
                          <>
                            <PlayCircle className="w-3 h-3" />
                            Vào Lab
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* Ở GIỮA: TRÌNH CHIẾU SLIDE BÀI GIẢNG (READ-ONLY SLIDE VIEWER & CONTROLS)   */}
        {/* ========================================================================= */}
        <main
          className={`flex-1 flex flex-col overflow-y-auto p-3 sm:p-5 lg:p-6 justify-between gap-4 ${
            mobileActiveTab === 'slides' ? 'flex flex-1' : 'hidden lg:flex'
          }`}
        >
          {/* Top Media Switcher / Slide Counter Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 max-w-4xl mx-auto w-full">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-cyan-600 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>
                  Slide {currentSlide.slideNumber} / {slides.length}
                </span>
              </span>
              {activeLesson.pptxFileName && (
                <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 font-mono truncate max-w-[220px]">
                  {activeLesson.pptxFileName} (Chỉ đọc)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {activeLesson.videoUrl && (
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => setActiveMediaMode('slides')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                      activeMediaMode === 'slides'
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Slide</span>
                  </button>
                  <button
                    onClick={() => setActiveMediaMode('video')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                      activeMediaMode === 'video'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Video</span>
                  </button>
                </div>
              )}

              {/* Quick Jump to AI Assistant on Mobile */}
              <button
                onClick={() => setMobileActiveTab('tutor')}
                className="lg:hidden px-2.5 py-1 rounded-xl bg-indigo-500/15 border border-indigo-500/40 text-indigo-600 dark:text-indigo-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Hỏi AI</span>
              </button>
            </div>
          </div>

          {/* Slide Presentation Card or Video Player */}
          {activeMediaMode === 'video' && activeLesson.videoUrl ? (
            <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-center">
              <div className="w-full aspect-video rounded-3xl overflow-hidden bg-black border-2 border-indigo-500/40 shadow-2xl flex items-center justify-center">
                {activeLesson.videoUrl.includes('youtube.com') ||
                activeLesson.videoUrl.includes('youtu.be') ? (
                  <iframe
                    src={activeLesson.videoUrl
                      .replace('watch?v=', 'embed/')
                      .replace('youtu.be/', 'youtube.com/embed/')}
                    title={activeLesson.title}
                    className="w-full h-full"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={activeLesson.videoUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            </div>
          ) : (
            /* Large Read-Only Slide Presentation Canvas */
            <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-center">
              <div className="relative w-full min-h-[380px] sm:min-h-[440px] rounded-[28px] bg-white dark:bg-[#08172b] border-2 border-cyan-500/30 shadow-[0_20px_60px_rgba(6,182,212,0.12)] p-6 sm:p-10 flex flex-col justify-between overflow-hidden">
                {/* Top Accent Gradient Bar */}
                <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-cyan-500 via-sky-500 to-teal-400" />

                {/* Slide Header */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-600 dark:text-cyan-300 font-mono font-black text-sm flex items-center justify-center">
                        {currentSlide.slideNumber}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 truncate max-w-[280px]">
                        {activeLesson.title}
                      </span>
                    </div>
                  </div>

                  {/* Slide Title */}
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight pt-1">
                    {currentSlide.title}
                  </h2>

                  {/* Slide Content Body: Bullets + Embedded PPTX Image */}
                  <div
                    className={`grid gap-5 pt-2 ${
                      currentSlide.imageDataUrl ? 'grid-cols-1 md:grid-cols-12 items-center' : 'grid-cols-1'
                    }`}
                  >
                    <div className={currentSlide.imageDataUrl ? 'md:col-span-7 space-y-3' : 'space-y-3.5'}>
                      {currentSlide.bullets.map((bullet, bIdx) => (
                        <div
                          key={bIdx}
                          className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50/90 dark:bg-[#0c223c]/80 border border-slate-200/70 dark:border-cyan-900/40 text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-relaxed"
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shrink-0 mt-2" />
                          <span>{bullet}</span>
                        </div>
                      ))}
                    </div>

                    {currentSlide.imageDataUrl && (
                      <div className="md:col-span-5 flex items-center justify-center">
                        <img
                          src={currentSlide.imageDataUrl}
                          alt={currentSlide.title}
                          className="max-h-60 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md object-contain bg-white p-2"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Slide Footer / Notes */}
                <div className="pt-5 mt-5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  {currentSlide.notes ? (
                    <div className="italic text-slate-600 dark:text-slate-300">
                      💡 <strong>Ghi chú bài giảng:</strong> {currentSlide.notes}
                    </div>
                  ) : (
                    <div>
                      Chế độ chỉ xem • Dùng phím ◀ ▶ hoặc các nút bên dưới để chuyển slide
                    </div>
                  )}
                  <div className="font-mono font-bold text-cyan-600 dark:text-cyan-400 shrink-0">
                    Trang {currentSlide.slideNumber} / {slides.length}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Slide Navigation Controls Bar */}
          <div className="max-w-4xl mx-auto w-full bg-white dark:bg-[#071526] border border-slate-200 dark:border-cyan-900/50 rounded-2xl p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-md">
            <button
              onClick={() => setCurrentSlideIdx((prev) => Math.max(0, prev - 1))}
              disabled={currentSlideIdx === 0}
              className="px-3 sm:px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-slate-700 disabled:opacity-40 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Slide trước</span>
            </button>

            {/* Quick Slide Number Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1 px-2">
              {slides.map((s, idx) => {
                const isCurrent = idx === currentSlideIdx;
                const isViewed = viewedSlides.includes(s.slideNumber);
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveMediaMode('slides');
                      setCurrentSlideIdx(idx);
                    }}
                    className={`w-7 sm:w-8 h-7 sm:h-8 rounded-xl font-mono text-xs font-extrabold flex items-center justify-center transition cursor-pointer shrink-0 ${
                      isCurrent
                        ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/30 scale-105'
                        : isViewed
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                    }`}
                    title={`Slide ${s.slideNumber}: ${s.title}`}
                  >
                    {s.slideNumber}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentSlideIdx((prev) => Math.min(slides.length - 1, prev + 1))}
              disabled={currentSlideIdx >= slides.length - 1}
              className="px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-sm"
            >
              <span>Slide tiếp theo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </main>

        {/* ========================================================================= */}
        {/* BẢNG PHẢI: TRỢ GIẢNG AI LÝ THUYẾT (DEDICATED THEORY AI ASSISTANT)        */}
        {/* ========================================================================= */}
        <aside
          className={`w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-cyan-900/50 bg-white/95 dark:bg-[#061222]/95 flex flex-col shrink-0 overflow-hidden ${
            mobileActiveTab === 'tutor' ? 'flex flex-1' : 'hidden lg:flex'
          }`}
        >
          {/* AI Tutor Header */}
          <div className="px-3.5 py-3 border-b border-slate-200 dark:border-cyan-900/50 flex items-center justify-between shrink-0 bg-slate-50/80 dark:bg-[#08182d]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-teal-400 p-[1.5px] shrink-0 shadow-sm">
                <div className="w-full h-full rounded-[10px] bg-white dark:bg-[#071526] flex items-center justify-center">
                  <Bot className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-extrabold text-xs text-slate-900 dark:text-white">
                    Trợ giảng AI Lý thuyết
                  </h3>
                </div>
                <p className="text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold truncate">
                  Đang theo dõi Slide {currentSlide.slideNumber}/{slides.length}: "{currentSlide.title}"
                </p>
              </div>
            </div>

            {tutorMessages.length > 0 && (
              <button
                onClick={handleClearTutorChat}
                title="Làm mới hội thoại Trợ giảng"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* AI Tutor Chat Scrollable Messages Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs bg-gradient-to-b from-cyan-50/30 to-white dark:from-[#071629] dark:to-[#05101f]">
            {/* Context & Welcome Bubble */}
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3 h-3" />
              </div>
              <div className="p-3 rounded-2xl rounded-tl-xs bg-slate-100 dark:bg-[#0c223a] border border-cyan-200/70 dark:border-cyan-800/50 text-slate-800 dark:text-slate-200 leading-relaxed shadow-xs">
                Mình là <strong>Trợ giảng AI</strong> của khóa học. Mình đồng hành cùng bạn xuyên suốt toàn bộ các chương bài học và luôn nắm rõ bạn đang xem{' '}
                <strong className="text-cyan-600 dark:text-cyan-400">
                  {activeLesson.title} — Slide {currentSlide.slideNumber}: "{currentSlide.title}"
                </strong>
                . Có bất kỳ thắc mắc nào, hãy hỏi mình nhé!
              </div>
            </div>

            {/* Quick Suggested Prompt Chips */}
            {tutorMessages.length === 0 && (
              <div className="flex flex-col gap-1.5 pl-8 pt-1">
                <button
                  onClick={() =>
                    handleAskTutor(
                      `Giải thích chi tiết và dễ hiểu nội dung trọng tâm của Slide ${currentSlide.slideNumber} ("${currentSlide.title}")`
                    )
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#0a1c30] hover:bg-cyan-50 dark:hover:bg-[#0e2744] border border-cyan-300/60 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-[11px] font-semibold text-left transition cursor-pointer"
                >
                  💡 Giải thích chi tiết Slide {currentSlide.slideNumber} này
                </button>
                <button
                  onClick={() =>
                    handleAskTutor('Tóm tắt trọng tâm toàn bộ các slide trong bài học lý thuyết này')
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#0a1c30] hover:bg-cyan-50 dark:hover:bg-[#0e2744] border border-cyan-300/60 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-[11px] font-semibold text-left transition cursor-pointer"
                >
                  📚 Tóm tắt toàn bộ bài giảng
                </button>
                <button
                  onClick={() =>
                    handleAskTutor(
                      `Cho ví dụ thực tế áp dụng kiến thức của Slide ${currentSlide.slideNumber}`
                    )
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#0a1c30] hover:bg-cyan-50 dark:hover:bg-[#0e2744] border border-cyan-300/60 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-[11px] font-semibold text-left transition cursor-pointer"
                >
                  ⚡ Ví dụ mạch thực tế liên quan
                </button>
              </div>
            )}

            {/* Message History */}
            {tutorMessages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}
                >
                  {!isUser && (
                    <div className="w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-xs shadow-sm'
                        : 'bg-slate-100 dark:bg-[#0c223a] border border-cyan-200/70 dark:border-cyan-800/50 text-slate-800 dark:text-slate-200 rounded-tl-xs'
                    }`}
                  >
                    {msg.lessonTitle && (
                      <div
                        className={`text-[9px] font-mono mb-1 ${
                          isUser ? 'text-cyan-100/90' : 'text-cyan-600 dark:text-cyan-400 font-semibold'
                        }`}
                      >
                        [{msg.lessonTitle} • Slide {msg.slideNumber}]
                      </div>
                    )}
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {isTutorLoading && (
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 text-xs pl-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Trợ giảng AI đang phân tích Slide {currentSlide.slideNumber}...</span>
              </div>
            )}

            <div ref={tutorEndRef} />
          </div>

          {/* AI Tutor Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAskTutor();
            }}
            className="p-2.5 border-t border-slate-200 dark:border-cyan-900/50 bg-white dark:bg-[#071526] flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={tutorInput}
              onChange={(e) => setTutorInput(e.target.value)}
              placeholder={`Hỏi Trợ giảng AI về Slide ${currentSlide.slideNumber}...`}
              disabled={isTutorLoading}
              className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#091b30] border border-slate-200 dark:border-cyan-900/60 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={!tutorInput.trim() || isTutorLoading}
              className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center disabled:opacity-40 cursor-pointer shrink-0 shadow-xs hover:scale-105 active:scale-95 transition"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
};
