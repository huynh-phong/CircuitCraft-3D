import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getPersistenceClient, isRemotePersistence } from './persistence.ts';
import { getSessionSecret } from './security.ts';

/**
 * Slide images extracted from PPTX files are stored as content-addressed files instead of base64
 * inside the course JSON: Supabase Storage (private bucket) in the cloud, data/course-media locally.
 *
 * Images may belong to paid courses, so `/api/media/course/:file` only answers links signed by the
 * server. Signed links are added when an entitled user receives the course content. Older courses
 * that still embed data URLs keep working: the theory room renders either form.
 */

export const MAX_SLIDE_IMAGE_BYTES = 1.5 * 1024 * 1024;
export const COURSE_MEDIA_URL_PREFIX = '/api/media/course/';
export const COURSE_MEDIA_BUCKET = 'course-media';
export const COURSE_VIDEO_URL_PREFIX = '/api/media/video/';
export const COURSE_VIDEO_BUCKET = 'course-video';
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // the per-file limit of Supabase's Free plan
const VIDEO_FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm)$/;

const SIGNED_LINK_TTL_MS = 6 * 60 * 60 * 1000;
const MEDIA_FILE_RE = /^[0-9a-f]{64}\.(png|jpg|gif|webp|svg)$/;

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

export class CourseMediaError extends Error {
  constructor(message: string, public status: 400 | 413 | 415) {
    super(message);
  }
}

function mediaDir(): string {
  return path.join(process.cwd(), 'data', 'course-media');
}

/** The stored type comes from the file's own bytes, never from the claimed MIME type. */
function detectImageExtension(bytes: Buffer): string | null {
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes.length > 6 && (bytes.subarray(0, 6).toString('latin1') === 'GIF87a' || bytes.subarray(0, 6).toString('latin1') === 'GIF89a')) return 'gif';
  if (bytes.length > 12 && bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  const head = bytes.subarray(0, 512).toString('utf-8').trimStart();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'svg';
  return null;
}

export function mediaFileNameFor(bytes: Buffer): string | null {
  const ext = detectImageExtension(bytes);
  return ext ? `${crypto.createHash('sha256').update(bytes).digest('hex')}.${ext}` : null;
}

export async function storeMediaBytes(fileName: string, bytes: Buffer): Promise<void> {
  if (isRemotePersistence()) {
    const ext = fileName.split('.').pop()!;
    const { error } = await getPersistenceClient()
      .storage.from(COURSE_MEDIA_BUCKET)
      .upload(fileName, bytes, { contentType: MIME_BY_EXT[ext], upsert: true, cacheControl: '31536000' });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return;
  }
  const target = path.join(mediaDir(), fileName);
  if (!fs.existsSync(target)) {
    fs.mkdirSync(mediaDir(), { recursive: true });
    const tmp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, bytes);
    fs.renameSync(tmp, target);
  }
}

/** Stores a `data:image/...;base64,` URL and returns the (unsigned) path recorded in the course. */
export async function saveCourseImage(dataUrl: unknown): Promise<string> {
  if (typeof dataUrl !== 'string') throw new CourseMediaError('Thiếu dữ liệu ảnh.', 400);
  const match = /^data:image\/[a-z0-9.+-]+;base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) throw new CourseMediaError('Ảnh phải ở dạng data URL base64.', 400);
  const bytes = Buffer.from(match[1], 'base64');
  if (bytes.length === 0) throw new CourseMediaError('Ảnh rỗng.', 400);
  if (bytes.length > MAX_SLIDE_IMAGE_BYTES) throw new CourseMediaError('Ảnh vượt quá kích thước cho phép (1,5 MB).', 413);
  const fileName = mediaFileNameFor(bytes);
  if (!fileName) throw new CourseMediaError('Định dạng ảnh không được hỗ trợ (PNG, JPEG, GIF, WebP, SVG).', 415);
  await storeMediaBytes(fileName, bytes);
  return `${COURSE_MEDIA_URL_PREFIX}${fileName}`;
}

function forEachLesson(sections: unknown, visit: (lesson: any) => void) {
  if (!Array.isArray(sections)) return;
  for (const section of sections as any[]) {
    visit(section);
    for (const lesson of Array.isArray(section?.lessons) ? section.lessons : []) visit(lesson);
  }
}

function forEachSlide(sections: unknown, visit: (slide: any) => void) {
  forEachLesson(sections, (lesson) => {
    for (const slide of Array.isArray(lesson?.slides) ? lesson.slides : []) visit(slide);
  });
}

/**
 * Moves any embedded slide images in a syllabus / chapter tree to storage (for API callers that
 * still post data URLs). An image that cannot be stored is left as sent.
 */
export async function externalizeSlideImages<T>(sections: T): Promise<T> {
  const slides: any[] = [];
  forEachLesson(sections, (lesson) => {
    if (typeof lesson?.videoUrl !== 'string') return;
    // A blob: link only exists in the creator's browser tab and would be a dead link for students
    if (lesson.videoUrl.startsWith('blob:')) delete lesson.videoUrl;
    else if (lesson.videoUrl.startsWith(COURSE_VIDEO_URL_PREFIX)) lesson.videoUrl = lesson.videoUrl.split('?')[0];
  });
  forEachSlide(sections, (slide) => {
    if (typeof slide?.imageDataUrl !== 'string') return;
    // A course saved from a content response carries signed links: only the plain path is stored
    if (slide.imageDataUrl.startsWith(COURSE_MEDIA_URL_PREFIX)) slide.imageDataUrl = slide.imageDataUrl.split('?')[0];
    else if (slide.imageDataUrl.startsWith('data:')) slides.push(slide);
  });
  for (const slide of slides) {
    try {
      slide.imageDataUrl = await saveCourseImage(slide.imageDataUrl);
    } catch (err) {
      if (!(err instanceof CourseMediaError)) throw err;
    }
  }
  return sections;
}

/** Videos go straight from the browser to Storage: request bodies through a function are limited to 4.5 MB. */
export async function createVideoUploadLink(contentType: unknown, size: unknown): Promise<{ uploadUrl: string; url: string }> {
  const ext = contentType === 'video/mp4' ? 'mp4' : contentType === 'video/webm' ? 'webm' : null;
  if (!ext) throw new CourseMediaError('Chỉ hỗ trợ video MP4 hoặc WebM.', 415);
  if (!(Number(size) > 0)) throw new CourseMediaError('Thiếu dung lượng video.', 400);
  if (Number(size) > MAX_VIDEO_BYTES) throw new CourseMediaError('Video vượt quá 50 MB. Hãy dùng liên kết YouTube cho video dài.', 413);
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const { data, error } = await getPersistenceClient().storage.from(COURSE_VIDEO_BUCKET).createSignedUploadUrl(fileName);
  if (error || !data?.signedUrl) throw new Error(`Storage upload link failed: ${error?.message || 'no link'}`);
  return { uploadUrl: data.signedUrl, url: `${COURSE_VIDEO_URL_PREFIX}${fileName}` };
}

export async function resolveCourseVideoLink(fileName: string): Promise<string | null> {
  if (!VIDEO_FILE_RE.test(fileName) || !isRemotePersistence()) return null;
  const { data, error } = await getPersistenceClient().storage.from(COURSE_VIDEO_BUCKET).createSignedUrl(fileName, 3600);
  return error || !data?.signedUrl ? null : data.signedUrl;
}

export function isValidVideoFileName(fileName: string): boolean {
  return VIDEO_FILE_RE.test(fileName);
}

function mediaSignature(fileName: string, expires: number): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(`course-media:${fileName}:${expires}`).digest('base64url');
}

export function signMediaPath(mediaPath: string, now: number = Date.now()): string {
  const prefix = [COURSE_MEDIA_URL_PREFIX, COURSE_VIDEO_URL_PREFIX].find((p) => mediaPath.startsWith(p));
  if (!prefix) return mediaPath;
  const fileName = mediaPath.slice(prefix.length).split('?')[0];
  const expires = now + SIGNED_LINK_TTL_MS;
  return `${prefix}${fileName}?exp=${expires}&sig=${mediaSignature(fileName, expires)}`;
}

export function verifyMediaSignature(fileName: string, exp: unknown, sig: unknown): boolean {
  const expires = Number(exp);
  if (!Number.isFinite(expires) || expires < Date.now() || typeof sig !== 'string') return false;
  const expected = Buffer.from(mediaSignature(fileName, expires));
  const actual = Buffer.from(sig);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/** A deep copy of a course's sections with signed image links, for one authorized response. */
export function withSignedSlideImages<T>(sections: T): T {
  if (!Array.isArray(sections)) return sections;
  const copy = JSON.parse(JSON.stringify(sections));
  forEachLesson(copy, (lesson) => {
    if (typeof lesson?.videoUrl === 'string') lesson.videoUrl = signMediaPath(lesson.videoUrl);
  });
  forEachSlide(copy, (slide) => {
    if (typeof slide?.imageDataUrl === 'string') slide.imageDataUrl = signMediaPath(slide.imageDataUrl);
  });
  return copy;
}

export type ResolvedMedia =
  | { kind: 'file'; filePath: string; mime: string; isSvg: boolean }
  | { kind: 'redirect'; url: string };

export async function resolveCourseMedia(fileName: string): Promise<ResolvedMedia | null> {
  if (!MEDIA_FILE_RE.test(fileName)) return null;
  if (isRemotePersistence()) {
    // A short-lived Storage link: function responses are limited in size, so the bytes do not pass through
    const { data, error } = await getPersistenceClient().storage.from(COURSE_MEDIA_BUCKET).createSignedUrl(fileName, 300);
    return error || !data?.signedUrl ? null : { kind: 'redirect', url: data.signedUrl };
  }
  const filePath = path.join(mediaDir(), fileName);
  if (!fs.existsSync(filePath)) return null;
  const ext = fileName.split('.').pop()!;
  return { kind: 'file', filePath, mime: MIME_BY_EXT[ext], isSvg: ext === 'svg' };
}

export function isValidMediaFileName(fileName: string): boolean {
  return MEDIA_FILE_RE.test(fileName);
}
