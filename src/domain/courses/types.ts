import { ProjectDocument } from '../project/types';

export type CourseLevel = 'Cơ bản' | 'Trung cấp' | 'Nâng cao' | 'Chuyên sâu';
export type CourseCategory = 'stem' | 'analog' | 'digital' | 'power' | 'pcb';

export interface CourseSyllabusItem {
  id: string;
  title: string;
  duration: string;
  summary?: string;
  isPracticalLab?: boolean;
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
  lastAccessedAt: string;
}
