import { COMPONENT_DEFINITION_MAP } from '../domain/components/definitions.ts';

/**
 * What the public may see of paid content. These functions list the allowed fields, so a field added
 * to a course or design later stays private unless it is added here on purpose.
 */

function lessonsOf(course: any): any[] {
  if (Array.isArray(course?.syllabus) && course.syllabus.length > 0) return course.syllabus;
  if (!Array.isArray(course?.chapters)) return [];
  return course.chapters.flatMap((chapter: any) => (Array.isArray(chapter?.lessons) ? chapter.lessons : []));
}

function lessonOutline(lesson: any, index: number) {
  const practice = lesson?.practiceProjectSnapshot || lesson?.practiceProject;
  const isPractice = Boolean(
    practice || lesson?.sectionType === 'practice' || lesson?.type === 'lab' || lesson?.isPracticalLab || lesson?.isLab
  );
  const summary = lesson?.summary || lesson?.shortDescription || lesson?.description || lesson?.desc || '';
  return {
    id: lesson?.id || `lesson-${index + 1}`,
    title: lesson?.title || `Bài ${index + 1}`,
    duration: lesson?.duration,
    summary: String(summary).slice(0, 300),
    sectionType: isPractice ? 'practice' : 'theory',
    isPracticalLab: isPractice,
    slideCount: Array.isArray(lesson?.slides) ? lesson.slides.length : 0,
    hasVideo: Boolean(lesson?.videoUrl),
    practiceProjectName: lesson?.practiceProjectName || practice?.name,
    practiceComponentCount: Array.isArray(practice?.components) ? practice.components.length : 0,
    practiceConnectionCount: Array.isArray(practice?.connections) ? practice.connections.length : 0,
  };
}

/** A course without its lessons' content: the outline, counts and the sales information. */
export function courseSummary(course: any) {
  const { chapters: _chapters, syllabus: _syllabus, ...info } = course;
  const lessons = lessonsOf(course);
  return { ...info, chapters: [], syllabus: lessons.map(lessonOutline), lessonCount: lessons.length, contentRestricted: true };
}

/** Which parts sit where. No wiring, no values, and generic part names (a name can carry a value). */
export function publicPreviewOnly(snapshot: any) {
  if (!snapshot) return snapshot;
  return {
    name: snapshot.name,
    board: snapshot.board,
    readOnlyPreview: true,
    limitedPreview: true,
    connections: [],
    components: (Array.isArray(snapshot.components) ? snapshot.components : []).map((component: any) => ({
      instanceId: component.instanceId,
      definitionId: component.definitionId,
      name: COMPONENT_DEFINITION_MAP.get(component.definitionId)?.name || component.definitionId,
      position: component.position,
      rotation: component.rotation,
      parameters: component.parameters?.color ? { color: component.parameters.color } : {},
    })),
  };
}
