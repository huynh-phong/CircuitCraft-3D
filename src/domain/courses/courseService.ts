import { COURSES } from './coursesData';
import { Course, CourseSyllabusItem, UserCourseEnrollment } from './types';
import { paymentService } from '../../billing/paymentService';
import { getUserStorageKey, purgeLegacyGlobalStorage } from '../../persistence/storageNamespace';
import { authService } from '../../persistence/authService';
import { getSupabase } from '../../persistence/supabaseClient';
import { createDefaultProjectDocument } from '../project/document';

const DYNAMIC_COURSES_STORAGE_KEY = 'cc3d_dynamic_courses_v3';
const LEGACY_COURSE_IDS = new Set([
  'course-uno-r3-basic',
  'course-intro-stem-3d',
  'course-switch-relays',
  'course-analog-pot-sensors',
  'course-buzzer-alarm-ne555',
  'course-digital-logic',
  'course-timer-555',
  'course-pcb-design-gerber',
]);

/**
 * Normalize a raw backend CreatorCourse or Course object into a frontend Course object
 */
export function normalizeToFrontendCourse(raw: any): Course {
  // If raw is our built-in complete course, preserve its full syllabus and slides
  const builtInMatch = COURSES.find((c) => c.id === raw.id);
  if (builtInMatch && (!Array.isArray(raw.syllabus) || raw.syllabus.length === 0)) {
    return builtInMatch;
  }

  const price = typeof raw.price === 'number' ? raw.price : 0;
  const isFree = Boolean(raw.isFree || price === 0);

  // Build syllabus from raw.syllabus or raw.chapters
  let syllabus: CourseSyllabusItem[] = [];
  if (Array.isArray(raw.syllabus) && raw.syllabus.length > 0) {
    syllabus = raw.syllabus.map((item: any, idx: number) => {
      const isPractice =
        item.sectionType === 'practice' ||
        item.type === 'lab' ||
        Boolean(item.isPracticalLab || item.isLab);
      const proj = item.practiceProjectSnapshot || item.practiceProject;
      const sum = item.summary || item.shortDescription || item.description || item.desc || '';
      return {
        id: item.id || `syl-${idx + 1}`,
        title: item.title || `Bài ${idx + 1}`,
        duration: item.duration || (isPractice ? '45 phút' : '30 phút'),
        summary: sum,
        shortDescription: sum,
        sectionType: isPractice ? 'practice' : 'theory',
        isPracticalLab: isPractice,
        isLab: isPractice,
        pptxFileName: item.pptxFileName,
        slides: Array.isArray(item.slides) ? item.slides : [],
        videoUrl: item.videoUrl,
        videoFileName: item.videoFileName,
        practiceProjectId: item.practiceProjectId || proj?.projectId,
        practiceProjectName: item.practiceProjectName || proj?.name,
        practiceProjectSnapshot: proj,
        practiceProject: proj,
        practiceStages: Array.isArray(item.practiceStages) ? item.practiceStages : [],
        practiceGuideSummary: item.practiceGuideSummary || item.practiceSummary,
        practiceSummary: item.practiceSummary || item.practiceGuideSummary,
        labGoal: item.labGoal || sum,
        labLessonId: item.labLessonId || item.id,
      };
    });
  } else if (Array.isArray(raw.chapters) && raw.chapters.length > 0) {
    for (const ch of raw.chapters) {
      if (Array.isArray(ch.lessons)) {
        for (const les of ch.lessons) {
          const proj = les.practiceProjectSnapshot || les.practiceProject;
          const isPractice = Boolean(
            proj || les.isPracticalLab || les.isLab || les.sectionType === 'practice'
          );
          const sum = les.summary || les.shortDescription || les.content || '';
          syllabus.push({
            id: les.id || `les-${syllabus.length + 1}`,
            title: les.title || `Bài ${syllabus.length + 1}`,
            duration: les.duration || '35 phút',
            summary: sum,
            shortDescription: sum,
            sectionType: isPractice ? 'practice' : 'theory',
            isPracticalLab: isPractice,
            isLab: isPractice,
            pptxFileName: les.pptxFileName,
            slides: Array.isArray(les.slides) ? les.slides : [],
            videoUrl: les.videoUrl,
            videoFileName: les.videoFileName,
            practiceProjectId: les.practiceProjectId || proj?.projectId,
            practiceProjectName: les.practiceProjectName || proj?.name,
            practiceProjectSnapshot: proj,
            practiceProject: proj,
            practiceStages: Array.isArray(les.practiceStages) ? les.practiceStages : [],
            practiceGuideSummary: les.practiceGuideSummary || les.practiceSummary,
            practiceSummary: les.practiceSummary || les.practiceGuideSummary,
            labGoal: sum,
          });
        }
      }
    }
  }

  const authorName =
    raw.author?.name ||
    raw.creatorName ||
    raw.instructor?.name ||
    'Huỳnh Phong';

  return {
    id: raw.id,
    title: raw.title || 'Khóa học thiết kế mạch',
    slug:
      raw.slug ||
      String(raw.title || raw.id)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-'),
    tagline: raw.tagline || 'Khóa học lý thuyết & thực hành mô phỏng trên CircuitCraft 3D',
    description: raw.description || '',
    author: {
      id: raw.author?.id || raw.creatorId || 'creator-1',
      name: authorName,
      role: raw.author?.role || 'Giảng viên & Nhà sáng tạo CircuitCraft',
    },
    instructor: {
      name: authorName,
      role: raw.instructor?.role || 'Giảng viên & Nhà sáng tạo CircuitCraft',
    },
    price,
    currency: raw.currency || 'VND',
    originalPrice: raw.originalPrice,
    isFree,
    level: raw.level || raw.difficulty || 'Cơ bản',
    category: raw.category || 'stem',
    duration: raw.duration || `${Math.max(1, syllabus.length)} bài học`,
    lessonCount: syllabus.length,
    rating: typeof raw.rating === 'number' ? raw.rating : 5.0,
    reviewsCount: typeof raw.reviewsCount === 'number' ? raw.reviewsCount : 0,
    studentsCount: typeof raw.studentsCount === 'number' ? raw.studentsCount : 0,
    thumbnailGradient:
      raw.thumbnailGradient || 'from-cyan-600 via-blue-600 to-indigo-700',
    badge: raw.badge || (isFree ? 'Miễn phí' : 'Khóa học Creator'),
    highlights:
      Array.isArray(raw.highlights) && raw.highlights.length > 0
        ? raw.highlights
        : syllabus.map((s) => s.title),
    syllabus,
    // Requirement 2.3: When student enters Practice Lab, the 3D workspace starts completely empty!
    createLabProject: (_labId?: string) => {
      const emptyDoc = createDefaultProjectDocument(`Thực hành: ${raw.title || 'Khóa học'}`);
      emptyDoc.components = [];
      emptyDoc.connections = [];
      return emptyDoc;
    },
  };
}

class CourseService {
  private memoryEnrollments: Record<string, UserCourseEnrollment> | null = null;
  private dynamicCourses: Course[] = [];
  private currentUserId: string | null = null;
  private listeners: Array<() => void> = [];

  constructor() {
    purgeLegacyGlobalStorage();
    try {
      localStorage.removeItem('cc3d_dynamic_courses_v2');
      localStorage.removeItem('cc3d_dynamic_courses_v1');
    } catch {}
    this.loadDynamicCoursesFromLocal();
    this.fetchPublishedCoursesFromServer();
    this.initAuthListener();
  }

  private initAuthListener(): void {
    authService.onAuthStateChange((user) => {
      const newUserId = user?.id || null;
      if (newUserId !== this.currentUserId) {
        this.currentUserId = newUserId;
        this.memoryEnrollments = null;
        this.loadEnrollments();
        this.notify();
      }
    });
  }

  private loadDynamicCoursesFromLocal(): void {
    try {
      const raw = localStorage.getItem(DYNAMIC_COURSES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.dynamicCourses = parsed
            .filter((c) => c && c.id && !LEGACY_COURSE_IDS.has(c.id))
            .map(normalizeToFrontendCourse);
        }
      }
    } catch {}
  }

  private saveDynamicCoursesToLocal(): void {
    try {
      localStorage.setItem(DYNAMIC_COURSES_STORAGE_KEY, JSON.stringify(this.dynamicCourses));
    } catch {}
  }

  public async fetchPublishedCoursesFromServer(): Promise<Course[]> {
    try {
      const res = await fetch('/api/courses');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.courses)) {
          const serverCourses = data.courses
            .filter((c: any) => c && c.id && !LEGACY_COURSE_IDS.has(c.id))
            .map(normalizeToFrontendCourse);

          // Merge with local courses (preferring latest syllabus data)
          const map = new Map<string, Course>();
          for (const lc of this.dynamicCourses) {
            if (!LEGACY_COURSE_IDS.has(lc.id)) {
              map.set(lc.id, lc);
            }
          }
          for (const sc of serverCourses) {
            const existing = map.get(sc.id);
            if (existing && existing.syllabus.length >= sc.syllabus.length) {
              // Merge keeping rich local slides/snapshots if server truncated anything
              map.set(sc.id, {
                ...sc,
                syllabus: sc.syllabus.length > 0 ? sc.syllabus : existing.syllabus,
              });
            } else {
              map.set(sc.id, sc);
            }
          }

          this.dynamicCourses = Array.from(map.values());
          this.saveDynamicCoursesToLocal();
          this.notify();
        }
      }
    } catch {}
    return this.getCourses();
  }

  public getCourses(): Course[] {
    const map = new Map<string, Course>();
    for (const c of COURSES) {
      if (!LEGACY_COURSE_IDS.has(c.id)) {
        map.set(c.id, c);
      }
    }
    for (const dc of this.dynamicCourses) {
      if (!LEGACY_COURSE_IDS.has(dc.id)) {
        map.set(dc.id, dc);
      }
    }
    return Array.from(map.values());
  }

  public getCourseById(courseId: string): Course | undefined {
    return this.getCourses().find((c) => c.id === courseId);
  }

  public registerCreatedCourse(rawCourse: any): Course {
    const normalized = normalizeToFrontendCourse(rawCourse);
    const idx = this.dynamicCourses.findIndex((c) => c.id === normalized.id);
    if (idx >= 0) {
      this.dynamicCourses[idx] = normalized;
    } else {
      this.dynamicCourses.unshift(normalized);
    }
    this.saveDynamicCoursesToLocal();
    this.notify();
    return normalized;
  }

  public removeCourse(courseId: string): void {
    this.dynamicCourses = this.dynamicCourses.filter((c) => c.id !== courseId);
    this.saveDynamicCoursesToLocal();
    this.notify();
  }

  private getEffectiveUserId(): string | null {
    if (this.currentUserId) return this.currentUserId;
    return authService.getCurrentUser()?.id || null;
  }

  private getStorageKey(): string {
    return getUserStorageKey('course-enrollments-v2', this.getEffectiveUserId());
  }

  private getLessonProgressKey(): string {
    return getUserStorageKey('lesson-progress-v2', this.getEffectiveUserId());
  }

  public async loadEnrollments(): Promise<Record<string, UserCourseEnrollment>> {
    const userId = this.getEffectiveUserId();
    const supabase = getSupabase();

    if (supabase && userId) {
      try {
        const { data: cloudEnrollments, error: enrErr } = await supabase
          .from('course_enrollments')
          .select('*')
          .eq('user_id', userId);

        const { data: cloudProgress } = await supabase
          .from('lesson_progress')
          .select('*')
          .eq('user_id', userId);

        if (!enrErr && cloudEnrollments) {
          const result: Record<string, UserCourseEnrollment> = {};

          for (const enr of cloudEnrollments) {
            if (LEGACY_COURSE_IDS.has(enr.course_id)) continue;
            const courseLessons = (cloudProgress || [])
              .filter((p: any) => p.course_id === enr.course_id && p.status === 'completed')
              .map((p: any) => p.lesson_id);

            const course = this.getCourseById(enr.course_id);
            const total = course?.syllabus.length || 1;
            const progressPercent = Math.min(100, Math.round((courseLessons.length / total) * 100));

            result[enr.course_id] = {
              courseId: enr.course_id,
              enrolledAt: enr.enrolled_at || new Date().toISOString(),
              progressPercent,
              completedLessons: courseLessons,
              lastAccessedAt: enr.created_at || new Date().toISOString(),
            };
          }

          this.memoryEnrollments = result;
          try {
            localStorage.setItem(this.getStorageKey(), JSON.stringify(result));
          } catch {}
          return result;
        }
      } catch {}
    }

    try {
      const raw = localStorage.getItem(this.getStorageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        const filtered: Record<string, UserCourseEnrollment> = {};
        for (const [k, v] of Object.entries(parsed || {})) {
          if (!LEGACY_COURSE_IDS.has(k)) {
            filtered[k] = v as UserCourseEnrollment;
          }
        }
        this.memoryEnrollments = filtered;
        return this.memoryEnrollments;
      }
    } catch (e) {
      console.warn('Storage error in CourseService', e);
    }

    this.memoryEnrollments = {};
    return {};
  }

  public getEnrollments(): Record<string, UserCourseEnrollment> {
    if (this.memoryEnrollments !== null) {
      return this.memoryEnrollments;
    }

    try {
      const raw = localStorage.getItem(this.getStorageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        const filtered: Record<string, UserCourseEnrollment> = {};
        for (const [k, v] of Object.entries(parsed || {})) {
          if (!LEGACY_COURSE_IDS.has(k)) {
            filtered[k] = v as UserCourseEnrollment;
          }
        }
        this.memoryEnrollments = filtered;
        return this.memoryEnrollments;
      }
    } catch {}

    this.memoryEnrollments = {};
    this.loadEnrollments().then(() => this.notify());
    return this.memoryEnrollments;
  }

  public isEnrolled(courseId: string): boolean {
    const enrollments = this.getEnrollments();
    return Boolean(enrollments[courseId]);
  }

  public getEnrollment(courseId: string): UserCourseEnrollment | null {
    const enrollments = this.getEnrollments();
    return enrollments[courseId] || null;
  }

  public enroll(courseId: string): boolean {
    try {
      const enrollments = this.getEnrollments();
      const userId = this.getEffectiveUserId();

      if (!enrollments[courseId]) {
        enrollments[courseId] = {
          courseId,
          enrolledAt: new Date().toISOString(),
          progressPercent: 0,
          completedLessons: [],
          viewedSlidesByLesson: {},
          lastAccessedAt: new Date().toISOString(),
        };
        this.memoryEnrollments = enrollments;
        localStorage.setItem(this.getStorageKey(), JSON.stringify(enrollments));

        if (typeof fetch !== 'undefined' && userId) {
          const courseObj = this.getCourseById(courseId);
          fetch('/api/courses/enroll', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authService.getAuthHeaders(),
            },
            body: JSON.stringify({
              userId,
              courseId,
              courseTitle: courseObj?.title || courseId,
            }),
          }).catch(() => {});
        }

        const supabase = getSupabase();
        if (supabase && userId) {
          supabase
            .from('course_enrollments')
            .upsert(
              {
                user_id: userId,
                course_id: courseId,
                enrolled_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,course_id' }
            )
            .then(() => {});
        }

        this.notify();
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  public async purchaseCourse(course: Course): Promise<{ success: boolean; error?: string }> {
    try {
      const order = await paymentService.createOrder(
        course.id,
        `Khóa học: ${course.title}`,
        course.price
      );
      await paymentService.processSandboxPayment(order.orderId);
      this.enroll(course.id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Giao dịch không thành công' };
    }
  }

  /**
   * Mark a slide as viewed in a Theory Lesson.
   * When the learner has viewed all slides in the lesson, automatically complete the lesson!
   */
  public markSlideViewed(
    courseId: string,
    lessonId: string,
    slideNumber: number,
    totalSlides: number
  ): { viewedSlides: number[]; isLessonCompleted: boolean } {
    const enrollments = this.getEnrollments();
    if (!enrollments[courseId]) {
      this.enroll(courseId);
    }
    const enrollment = enrollments[courseId];
    if (!enrollment) {
      return { viewedSlides: [slideNumber], isLessonCompleted: false };
    }

    if (!enrollment.viewedSlidesByLesson) {
      enrollment.viewedSlidesByLesson = {};
    }
    const list = enrollment.viewedSlidesByLesson[lessonId] || [];
    if (!list.includes(slideNumber)) {
      list.push(slideNumber);
      list.sort((a, b) => a - b);
      enrollment.viewedSlidesByLesson[lessonId] = list;
    }

    this.memoryEnrollments = enrollments;
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(enrollments));
    } catch {}

    const allViewed = totalSlides > 0 && list.length >= totalSlides;
    if (allViewed) {
      this.completeLesson(courseId, lessonId);
    } else {
      this.notify();
    }

    const isLessonCompleted = enrollment.completedLessons.includes(lessonId) || allViewed;
    return { viewedSlides: list, isLessonCompleted };
  }

  public getViewedSlides(courseId: string, lessonId: string): number[] {
    const enrollment = this.getEnrollment(courseId);
    return enrollment?.viewedSlidesByLesson?.[lessonId] || [];
  }

  public completeLesson(courseId: string, lessonId: string): void {
    try {
      const enrollments = this.getEnrollments();
      const userId = this.getEffectiveUserId();
      let enrollment = enrollments[courseId];

      if (!enrollment) {
        this.enroll(courseId);
        enrollment = enrollments[courseId];
      }

      if (enrollment) {
        if (!enrollment.completedLessons.includes(lessonId)) {
          enrollment.completedLessons.push(lessonId);
        }
        const course = this.getCourseById(courseId);
        if (course && course.syllabus.length > 0) {
          enrollment.progressPercent = Math.min(
            100,
            Math.round((enrollment.completedLessons.length / course.syllabus.length) * 100)
          );
        } else {
          enrollment.progressPercent = Math.min(100, enrollment.completedLessons.length * 50);
        }
        enrollment.lastAccessedAt = new Date().toISOString();
        this.memoryEnrollments = enrollments;
        localStorage.setItem(this.getStorageKey(), JSON.stringify(enrollments));

        this.recordLessonCompletedLocally(lessonId);

        if (typeof fetch !== 'undefined' && userId) {
          fetch('/api/courses/progress', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authService.getAuthHeaders(),
            },
            body: JSON.stringify({
              userId,
              courseId,
              lessonId,
              progressPercent: enrollment.progressPercent,
              completedLessons: enrollment.completedLessons,
            }),
          }).catch(() => {});
        }

        const supabase = getSupabase();
        if (supabase && userId) {
          supabase
            .from('lesson_progress')
            .upsert(
              {
                user_id: userId,
                course_id: courseId,
                lesson_id: lessonId,
                status: 'completed',
                progress_percent: 100,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,lesson_id' }
            )
            .then(() => {});
        }

        this.notify();
      }
    } catch (e) {
      console.error(e);
    }
  }

  public recordLessonCompletedLocally(lessonId: string): void {
    try {
      const key = this.getLessonProgressKey();
      const raw = localStorage.getItem(key);
      const list: string[] = raw ? JSON.parse(raw) : [];
      if (!list.includes(lessonId)) {
        list.push(lessonId);
        localStorage.setItem(key, JSON.stringify(list));
      }
    } catch {}
  }

  public getCompletedLessonIds(): string[] {
    try {
      const key = this.getLessonProgressKey();
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}

    const enrollments = this.getEnrollments();
    const set = new Set<string>();
    for (const enr of Object.values(enrollments)) {
      if (Array.isArray(enr.completedLessons)) {
        enr.completedLessons.forEach((l) => set.add(l));
      }
    }
    return Array.from(set);
  }

  public getMyCourses(): { course: Course; enrollment: UserCourseEnrollment }[] {
    const enrollments = this.getEnrollments();
    const allCourses = this.getCourses();
    const result: { course: Course; enrollment: UserCourseEnrollment }[] = [];

    for (const course of allCourses) {
      if (enrollments[course.id]) {
        result.push({
          course,
          enrollment: enrollments[course.id],
        });
      }
    }

    return result;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    for (const l of this.listeners) {
      try {
        l();
      } catch {}
    }
  }

  public clearCache(): void {
    this.memoryEnrollments = null;
    this.notify();
  }
}

export const courseService = new CourseService();
