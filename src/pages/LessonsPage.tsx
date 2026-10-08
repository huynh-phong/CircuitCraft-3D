import React from 'react';
import { Lesson, LessonEvaluation } from '../domain/lessons/types';
import { LESSONS } from '../domain/lessons/lessonsData';
import { ProjectDocument } from '../domain/project/types';
import { BookOpen, CheckCircle2, Circle, ArrowRight, Award, Zap, Clock, ShieldAlert } from 'lucide-react';
import { useI18n } from '../i18n/context';

export interface LessonsPageProps {
  completedLessonIds: string[];
  onStartLesson: (lesson: Lesson) => void;
}

export const LessonsPage: React.FC<LessonsPageProps> = ({
  completedLessonIds,
  onStartLesson,
}) => {
  const { language } = useI18n();
  const completedCount = completedLessonIds.length;
  const progressPercent = Math.round((completedCount / LESSONS.length) * 100);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 md:p-8 select-none text-slate-800 dark:text-slate-100 transition-colors">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header & Progress Stats */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 text-[11px] font-semibold mb-2">
              <Award className="w-3.5 h-3.5" />
              <span>{language === 'vi' ? 'Chương trình thực hành STEM Điện tử 3D' : 'STEM 3D Interactive Electronics Curriculum'}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {language === 'vi' ? 'Giáo trình bài học tương tác' : 'Interactive Lab Syllabus'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {language === 'vi'
                ? 'Học qua thực hành: mỗi bài học có mục tiêu thiết kế và hệ thống tự động chấm điểm mạch.'
                : 'Learn by doing: each lesson features interactive goals and automated circuit grading.'}
            </p>
          </div>

          {/* Progress Card */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center gap-4 min-w-[240px] shadow-sm">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <svg className="w-12 h-12 -rotate-90">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-slate-200 dark:text-slate-800"
                  fill="transparent"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={125.6}
                  strokeDashoffset={125.6 - (125.6 * progressPercent) / 100}
                  className="text-cyan-500 dark:text-cyan-400 transition-all duration-500"
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <span className="absolute text-xs font-bold text-slate-900 dark:text-white font-mono">{progressPercent}%</span>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {completedCount} / {LESSONS.length} {language === 'vi' ? 'Bài hoàn thành' : 'Lessons Completed'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                {language === 'vi' ? 'Tiến độ chứng chỉ cơ sở' : 'Certificate Progress'}
              </div>
            </div>
          </div>
        </div>

        {/* Lessons List */}
        <div className="space-y-4">
          {LESSONS.map((lesson: Lesson, idx: number) => {
            const isCompleted = completedLessonIds.includes(lesson.id);

            return (
              <div
                key={lesson.id}
                className={`rounded-2xl border transition overflow-hidden shadow-xs ${
                  isCompleted
                    ? 'bg-white dark:bg-slate-900/40 border-emerald-300 dark:border-emerald-500/30'
                    : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-cyan-500/40'
                }`}
              >
                <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  {/* Left info */}
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">{lesson.title}</h3>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          lesson.difficulty === 'Cơ bản'
                            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                            : lesson.difficulty === 'Trung bình'
                            ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                            : 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30'
                        }`}
                      >
                        {lesson.difficulty}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        <Clock className="w-3 h-3" />
                        {lesson.estimatedMinutes} {language === 'vi' ? 'phút' : 'min'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pl-9">{lesson.subtitle}</p>

                    {/* Objectives / Steps bullets */}
                    <div className="pl-9 space-y-1 pt-1">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        {language === 'vi' ? 'Mục tiêu bài học:' : 'Lesson Objectives:'}
                      </span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{lesson.goal}</p>
                      <div className="pt-2">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          {language === 'vi' ? 'Các bước thực hành:' : 'Lab Steps:'}
                        </span>
                        <ul className="space-y-1 mt-1 text-xs text-slate-700 dark:text-slate-300">
                          {lesson.steps.map((step, si) => (
                            <li key={si} className="flex items-start gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 shrink-0" />
                              <span>{step.title}: <span className="text-slate-500 dark:text-slate-400">{step.instruction}</span></span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Right CTA */}
                  <div className="flex items-center gap-3 pl-9 md:pl-0 shrink-0">
                    {isCompleted && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{language === 'vi' ? 'Đã đạt' : 'Passed'}</span>
                      </div>
                    )}

                    <button
                      onClick={() => onStartLesson(lesson)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md transition transform active:scale-95"
                    >
                      <span>{isCompleted ? (language === 'vi' ? 'Luyện tập lại' : 'Practice Again') : (language === 'vi' ? 'Bắt đầu thực hành' : 'Start Lab')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
