import React, { useState, useEffect } from 'react';
import { GraduationCap, BookOpen, Clock, Star, ArrowRight } from 'lucide-react';
import { useI18n } from '../../i18n/context';
import { courseService } from '../../domain/courses/courseService';
import { Course } from '../../domain/courses/types';

export interface CoursesShowcaseSectionProps {
  onExploreLessons: () => void;
}

export const CoursesShowcaseSection: React.FC<CoursesShowcaseSectionProps> = ({
  onExploreLessons,
}) => {
  const { language } = useI18n();
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [courses, setCourses] = useState<Course[]>(() => courseService.getCourses());

  useEffect(() => {
    const update = () => setCourses(courseService.getCourses());
    update();
    return courseService.subscribe(update);
  }, []);

  const filteredCourses = courses.filter((c) => {
    if (filterLevel === 'all') return true;
    if (filterLevel === 'basic') return c.level === 'Cơ bản';
    if (filterLevel === 'stem') return c.category === 'stem';
    return true;
  });

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-[1380px] mx-auto select-none">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3 mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200/80 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 text-xs font-bold uppercase tracking-wider">
          <GraduationCap className="w-3.5 h-3.5 text-cyan-500" />
          <span>{language === 'vi' ? 'Học viện thực hành tương tác' : 'Interactive Learning Academy'}</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          {language === 'vi' ? 'Bắt đầu học tập. ' : 'Start Learning. '}
          <span className="bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 bg-clip-text text-transparent">
            {language === 'vi' ? 'Tự tin làm chủ mạch điện.' : 'Build With Confidence.'}
          </span>
        </h2>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
          {language === 'vi'
            ? 'Kết hợp bài giảng Slide Lý thuyết cùng Trợ giảng AI và phòng Thực hành 3D theo 3 giai đoạn chuẩn kỹ thuật.'
            : 'Structured curriculum combining interactive theory slides with AI Tutor and 3-stage 3D circuit labs.'}
        </p>

        {/* Filter Tabs */}
        {courses.length > 0 && (
          <div className="pt-4 flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() => setFilterLevel('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterLevel === 'all'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              {language === 'vi' ? 'Tất cả lộ trình' : 'All Tracks'}
            </button>
            <button
              onClick={() => setFilterLevel('basic')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterLevel === 'basic'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              {language === 'vi' ? 'Cơ bản cho người mới' : 'Beginner Friendly'}
            </button>
          </div>
        )}
      </div>

      {/* Courses Grid */}
      {filteredCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {filteredCourses.slice(0, 3).map((course) => (
            <div
              key={course.id}
              className="group rounded-[28px] overflow-hidden bg-white/95 dark:bg-[#071628]/95 border border-[#cbe6f7] dark:border-cyan-800/40 shadow-xl shadow-cyan-500/5 hover:shadow-2xl hover:shadow-cyan-500/15 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div
                  className={`p-6 bg-gradient-to-br ${course.thumbnailGradient || 'from-cyan-600 to-blue-700'} text-white relative overflow-hidden`}
                >
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-cyan-200 border border-white/20">
                    {course.level}
                  </div>

                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center mb-3">
                    <GraduationCap className="w-5 h-5 text-white" />
                  </div>

                  <h3 className="font-black text-lg sm:text-xl text-white tracking-tight leading-snug line-clamp-2">
                    {course.title}
                  </h3>

                  <div className="flex items-center gap-3 text-xs text-white/90 mt-2 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {course.duration}
                    </span>
                    <span>•</span>
                    <span>{course.syllabus.length} nội dung</span>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                    {course.description}
                  </p>

                  <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800">
                    <div className="text-slate-500 dark:text-slate-400">
                      {language === 'vi' ? 'Giảng viên:' : 'Instructor:'}{' '}
                      <strong className="text-slate-900 dark:text-white">
                        {course.author?.name || course.instructor?.name || 'Huỳnh Phong'}
                      </strong>
                    </div>
                    <div className="flex items-center gap-1 text-amber-500 font-bold">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>{course.rating || 5.0}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 pt-0 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">
                    {course.isFree ? (language === 'vi' ? 'Hình thức' : 'Access') : (language === 'vi' ? 'Học phí' : 'Tuition')}
                  </span>
                  <span className="text-base font-black font-mono text-cyan-600 dark:text-cyan-400">
                    {course.isFree
                      ? language === 'vi'
                        ? 'Miễn phí'
                        : 'Free'
                      : `${course.price.toLocaleString('vi-VN')} ₫`}
                  </span>
                </div>

                <button
                  onClick={onExploreLessons}
                  className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-xs transition flex items-center gap-1.5 shadow-md shadow-cyan-600/20 cursor-pointer"
                >
                  <span>{language === 'vi' ? 'Xem khóa học' : 'View Course'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="max-w-xl mx-auto p-8 rounded-3xl bg-white/80 dark:bg-[#071628]/80 border border-cyan-200 dark:border-cyan-800/40 text-center space-y-3">
          <GraduationCap className="w-10 h-10 text-cyan-500 mx-auto" />
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
            Các khóa học từ Nhà sáng tạo sẽ hiển thị tại đây
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Giảng viên có thể tạo khóa học mới với Slide Lý thuyết (.pptx) và Dự án Thực hành 3D trong Khu vực Creator.
          </p>
        </div>
      )}

      {/* Explore All Courses CTA Button */}
      <div className="text-center pt-10">
        <button
          onClick={onExploreLessons}
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-white dark:bg-[#0c1e33] hover:bg-cyan-50 dark:hover:bg-[#0f2640] border border-[#bfe3f7] dark:border-cyan-700/60 text-slate-900 dark:text-white font-extrabold text-sm shadow-md transition cursor-pointer"
        >
          <BookOpen className="w-4 h-4 text-cyan-500" />
          <span>{language === 'vi' ? 'Khám phá danh mục khóa học' : 'Explore All Courses'}</span>
          <ArrowRight className="w-4 h-4 text-cyan-500" />
        </button>
      </div>
    </section>
  );
};
