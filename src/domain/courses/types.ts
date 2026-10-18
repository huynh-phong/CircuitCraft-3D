import { ProjectDocument } from '../project/types';

export type CourseLevel = 'Cơ bản' | 'Trung cấp' | 'Nâng cao' | 'Chuyên sâu' | 'Chuyên gia';
export type CourseCategory = 'stem' | 'analog' | 'digital' | 'power' | 'pcb';

export interface CourseSlide {
  id: string;
  slideNumber: number;
  title: string;
  bullets: string[];
  contentText: string;
  notes?: string;
  imageDataUrl?: string;
}

export interface PracticeStageChecklistItem {
  id: string;
  label: string;
  detail?: string;
  componentDefId?: string;
  expectedCount?: number;
  connectionRef?: {
    fromComponentName: string;
    fromDefinitionId: string;
    fromPinId: string;
    toComponentName: string;
    toDefinitionId: string;
    toPinId: string;
  };
}

export interface PracticeStage {
  stageNumber: 1 | 2 | 3;
  stageKey: 'components' | 'wiring' | 'simulation';
  title: string;
  description: string;
  steps: string[];
  checklist: PracticeStageChecklistItem[];
}

export interface CourseSyllabusItem {
  id: string;
  title: string;
  duration: string;
  summary?: string; // Mô tả ngắn của phần lý thuyết hoặc thực hành
  shortDescription?: string;
  desc?: string;
  sectionType?: 'theory' | 'practice';
  isPracticalLab?: boolean;
  isLab?: boolean;
  // Phần lý thuyết (1.1)
  pptxFileName?: string;
  slides?: CourseSlide[];
  videoUrl?: string;
  videoFileName?: string;
  // Phần thực hành (1.2 & 2.3)
  practiceProjectId?: string;
  practiceProjectName?: string;
  practiceProjectSnapshot?: ProjectDocument;
  practiceProject?: ProjectDocument;
  practiceStages?: PracticeStage[];
  practiceGuideSummary?: string;
  practiceSummary?: string;
  labGoal?: string;
  labLessonId?: string;
}

export interface CourseAuthor {
  id: string;
  name: string;
  role?: string;
  avatarUrl?: string;
  bio?: string;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  tagline: string;
  description: string;
  author: CourseAuthor;
  instructor?: {
    name: string;
    role: string;
    avatarUrl?: string;
  };
  price: number; // in VND integer. e.g. 799000. 0 = free
  currency?: string; // e.g. 'VND'
  originalPrice?: number;
  isFree: boolean;
  level: CourseLevel;
  category: CourseCategory;
  duration: string;
  lessonCount: number;
  rating: number;
  reviewsCount: number;
  studentsCount: number;
  thumbnailGradient: string;
  badge?: string;
  highlights: string[];
  syllabus: CourseSyllabusItem[];
  createLabProject?: (labId?: string) => ProjectDocument;
}

export interface UserCourseEnrollment {
  courseId: string;
  enrolledAt: string;
  progressPercent: number;
  completedLessons: string[];
  viewedSlidesByLesson?: Record<string, number[]>;
  lastAccessedAt: string;
}
