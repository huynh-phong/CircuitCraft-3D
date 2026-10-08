import React from 'react';
import { BookOpen, CheckCircle, ArrowRight, Clock, Award } from 'lucide-react';
import { LESSONS, Lesson } from '../engine/lessonEngine.ts';
import { Button, Badge } from '../components/ui/designSystem.tsx';
import { ProjectDocument } from '../types/circuit.ts';
import { createDefaultProject } from '../domain/componentLibrary.ts';

interface LessonsViewProps {
  onSelectLesson: (lesson: Lesson, initialDoc: ProjectDocument) => void;
  onNavigateEditor: () => void;
}

export const LessonsView: React.FC<LessonsViewProps> = ({ onSelectLesson, onNavigateEditor }) => {
  const handleStartLesson = (lesson: Lesson) => {
    const doc = createDefaultProject();
    doc.name = `Thực hành: ${lesson.title}`;
    onSelectLesson(lesson, doc);
    onNavigateEditor();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2 border-b border-slate-800 pb-6">
        <Badge variant="emerald">HỌC VIỆN THỰC HÀNH MẠCH ĐIỆN 3D</Badge>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <BookOpen className="w-6 h-6 text-emerald-400" />
          Bài thực hành theo từng bước
        </h1>
        <p className="text-sm text-slate-400">
          Khám phá nguyên lý kỹ thuật điện thông qua các thí nghiệm mô phỏng trực quan tương tác 3D cùng Minibot.
        </p>
      </div>

      {/* Lessons List */}
      <div className="space-y-6">
        {LESSONS.map((lesson, idx) => (
          <div
            key={lesson.id}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-6 transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-lg"
          >
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center">
                  {idx + 1}
                </span>
                <h3 className="text-base font-semibold text-white">{lesson.title}</h3>
                <Badge variant={lesson.difficulty === 'Cơ bản' ? 'emerald' : 'amber'}>
                  {lesson.difficulty}
                </Badge>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {lesson.description}
              </p>

              {/* Steps summary */}
              <div className="space-y-1.5 pt-2">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Nội dung các bước thực hành:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {lesson.steps.map((step, sIdx) => (
                    <div
                      key={step.id}
                      className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-300 flex items-start gap-2"
                    >
                      <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] shrink-0 font-medium">
                        {sIdx + 1}
                      </span>
                      <span>{step.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-400 pt-2">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Thời lượng dự kiến: ~{lesson.estimatedMinutes} phút
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <Award className="w-3.5 h-3.5" />
                  Có hướng dẫn Minibot
                </span>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => handleStartLesson(lesson)}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Bắt đầu bài học
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
