import { COURSES } from './coursesData';
import { Course, UserCourseEnrollment } from './types';
import { paymentService } from '../../billing/paymentService';
import { getUserStorageKey, purgeLegacyGlobalStorage } from '../../persistence/storageNamespace';
import { authService } from '../../persistence/authService';
import { getSupabase } from '../../persistence/supabaseClient';

class CourseService {
  private memoryEnrollments: Record<string, UserCourseEnrollment> | null = null;
  private currentUserId: string | null = null;
  private listeners: Array<() => void> = [];

  constructor() {
    purgeLegacyGlobalStorage();
    this.initAuthListener();
  }

  private initAuthListener(): void {
    authService.onAuthStateChange((user) => {
      const newUserId = user?.id || null;
      if (newUserId !== this.currentUserId) {
        this.currentUserId = newUserId;
        this.memoryEnrollments = null; // Invalidate memory cache on user switch/logout
        this.loadEnrollments();
        this.notify();
      }
    });
  }

  private getEffectiveUserId(): string | null {
    if (this.currentUserId) return this.currentUserId;
    return authService.getCurrentUser()?.id || null;
  }

  private getStorageKey(): string {
    return getUserStorageKey('course-enrollments', this.getEffectiveUserId());
  }

  private getLessonProgressKey(): string {
    return getUserStorageKey('lesson-progress', this.getEffectiveUserId());
  }

  /**
   * Load enrollments from local storage or cloud
   */
  public async loadEnrollments(): Promise<Record<string, UserCourseEnrollment>> {
    const userId = this.getEffectiveUserId();
    const supabase = getSupabase();

    // 1. Try cloud database first if user is authenticated
    if (supabase && userId) {
      try {
        const { data: cloudEnrollments, error: enrErr } = await supabase
          .from('course_enrollments')
          .select('*')
          .eq('user_id', userId);

        const { data: cloudProgress, error: progErr } = await supabase
          .from('lesson_progress')
          .select('*')
          .eq('user_id', userId);

        if (!enrErr && cloudEnrollments) {
          const result: Record<string, UserCourseEnrollment> = {};

          for (const enr of cloudEnrollments) {
            const courseLessons = (cloudProgress || [])
              .filter((p: any) => p.course_id === enr.course_id && p.status === 'completed')
              .map((p: any) => p.lesson_id);

            const course = COURSES.find((c) => c.id === enr.course_id);
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
          // Sync to local namespaced storage as cache
          try {
            localStorage.setItem(this.getStorageKey(), JSON.stringify(result));
          } catch {}
          return result;
        }
      } catch {
        // Fallback to local namespaced storage
      }
    }

    // 2. Read from user's isolated local storage
    try {
      const raw = localStorage.getItem(this.getStorageKey());
      if (raw) {
        this.memoryEnrollments = JSON.parse(raw);
        return this.memoryEnrollments || {};
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
        this.memoryEnrollments = JSON.parse(raw);
        return this.memoryEnrollments || {};
      }
    } catch {}

    this.memoryEnrollments = {};
    // Trigger async cloud fetch in background
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

  /**
   * Enroll in a free or paid course
   */
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
          lastAccessedAt: new Date().toISOString(),
        };
        this.memoryEnrollments = enrollments;
        localStorage.setItem(this.getStorageKey(), JSON.stringify(enrollments));

        // Sync enrollment to backend server for Admin synchronization
        if (typeof fetch !== 'undefined' && userId) {
          const courseObj = COURSES.find((c) => c.id === courseId);
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

        // Persist to Cloud if authenticated
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
            .then(({ error }) => {
              if (error) {
                console.warn('Supabase enroll sync error (table may not be created yet):', error.message);
              }
            });
        }

        this.notify();
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  /**
   * Purchase a commercial course and record the order
   */
  public async purchaseCourse(course: Course): Promise<{ success: boolean; error?: string }> {
    try {
      // Record payment order
      const order = await paymentService.createOrder(
        course.id,
        `Khóa học: ${course.title}`,
        course.price
      );
      await paymentService.processSandboxPayment(order.orderId);

      // Enroll user
      this.enroll(course.id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Giao dịch không thành công' };
    }
  }

  /**
   * Mark a lesson as completed
   */
  public completeLesson(courseId: string, lessonId: string): void {
    try {
      const enrollments = this.getEnrollments();
      const userId = this.getEffectiveUserId();
      let enrollment = enrollments[courseId];

      if (!enrollment) {
        // Auto-enroll if completing a lesson in this course
        this.enroll(courseId);
        enrollment = enrollments[courseId];
      }

      if (enrollment) {
        if (!enrollment.completedLessons.includes(lessonId)) {
          enrollment.completedLessons.push(lessonId);
        }
        const course = COURSES.find((c) => c.id === courseId);
        if (course && course.syllabus.length > 0) {
          enrollment.progressPercent = Math.min(
            100,
            Math.round((enrollment.completedLessons.length / course.syllabus.length) * 100)
          );
        }
        enrollment.lastAccessedAt = new Date().toISOString();
        this.memoryEnrollments = enrollments;
        localStorage.setItem(this.getStorageKey(), JSON.stringify(enrollments));

        // Save lesson progress key
        this.recordLessonCompletedLocally(lessonId);

        // Sync lesson progress to backend server for Admin synchronization
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

        // Persist to Cloud if authenticated
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
            .then(({ error }) => {
              if (error) {
                console.warn('Supabase lesson progress sync error:', error.message);
              }
            });
        }

        this.notify();
      }
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Save completed lesson ID to user's isolated lesson list
   */
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

  /**
   * Get list of completed lesson IDs for current user
   */
  public getCompletedLessonIds(): string[] {
    try {
      const key = this.getLessonProgressKey();
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}

    // Fall back to collecting completed lessons from all enrollments
    const enrollments = this.getEnrollments();
    const set = new Set<string>();
    for (const enr of Object.values(enrollments)) {
      if (Array.isArray(enr.completedLessons)) {
        enr.completedLessons.forEach((l) => set.add(l));
      }
    }
    return Array.from(set);
  }

  /**
   * Get all courses that the user is enrolled in
   */
  public getMyCourses(): { course: Course; enrollment: UserCourseEnrollment }[] {
    const enrollments = this.getEnrollments();
    const result: { course: Course; enrollment: UserCourseEnrollment }[] = [];

    for (const course of COURSES) {
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
