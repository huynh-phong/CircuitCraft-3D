import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  GraduationCap,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  BookOpen,
  FileSpreadsheet,
  Video,
  Upload,
  Cpu,
  Sparkles,
  Layers,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ProjectDocument } from '../../domain/project/types';
import { projectRepositoryManager } from '../../persistence/repositoryManager';
import { useI18n } from '../../i18n/context';
import { CourseSlide, CourseSyllabusItem, PracticeStage } from '../../domain/courses/types';
import {
  parsePptxFileToSlides,
  analyzePracticeProjectWithAI,
  buildDeterministicPracticeStages,
} from '../../domain/courses/pptxAndPracticeParser';
import { courseService } from '../../domain/courses/courseService';
import { createDefaultProjectDocument } from '../../domain/project/document';

interface CreateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onCourseCreated: (course: any) => void;
}

export const CreateCourseModal: React.FC<CreateCourseModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onCourseCreated,
}) => {
  const { language, formatCurrency } = useI18n();
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(150000);
  const [isFree, setIsFree] = useState(false);
  const [level, setLevel] = useState<'Cơ bản' | 'Trung cấp' | 'Nâng cao' | 'Chuyên gia'>('Cơ bản');
  const [userProjects, setUserProjects] = useState<ProjectDocument[]>([]);

  // Curriculum: Theory items & Practice items
  const [theoryItems, setTheoryItems] = useState<CourseSyllabusItem[]>([]);
  const [practiceItems, setPracticeItems] = useState<CourseSyllabusItem[]>([]);

  // Active builder tab: 'theory' | 'practice'
  const [activeBuilderTab, setActiveBuilderTab] = useState<'theory' | 'practice'>('theory');

  // --- Theory Item Draft State (1.1) ---
  const [theoryTitle, setTheoryTitle] = useState('');
  const [theorySummary, setTheorySummary] = useState('');
  const [theoryPptxFileName, setTheoryPptxFileName] = useState('');
  const [theorySlides, setTheorySlides] = useState<CourseSlide[]>([]);
  const [isParsingPptx, setIsParsingPptx] = useState(false);
  const [theoryVideoUrl, setTheoryVideoUrl] = useState('');
  const [theoryVideoFileName, setTheoryVideoFileName] = useState('');
  const [previewSlidesOpen, setPreviewSlidesOpen] = useState(false);
  const pptxInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // --- Practice Item Draft State (1.2 & 2.3) ---
  const [practiceTitle, setPracticeTitle] = useState('');
  const [practiceSummary, setPracticeSummary] = useState('');
  const [selectedPracticeProjectId, setSelectedPracticeProjectId] = useState<string>('');
  const [uploadedPracticeProject, setUploadedPracticeProject] = useState<ProjectDocument | null>(null);
  const [uploadedPracticeFileName, setUploadedPracticeFileName] = useState('');
  const [practiceStagesPreview, setPracticeStagesPreview] = useState<PracticeStage[]>([]);
  const [isAnalyzingProject, setIsAnalyzingProject] = useState(false);
  const projectFileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const repo = projectRepositoryManager.getActiveRepository();
    repo
      .listProjects()
      .then((list) => {
        setUserProjects(list);
      })
      .catch((err) => console.error(err));
  }, [isOpen]);

  // Handle .pptx file upload for Theory section
  const handlePptxFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setValidationError(null);
    setIsParsingPptx(true);
    try {
      const extractedSlides = await parsePptxFileToSlides(file);
      setTheoryPptxFileName(file.name);
      setTheorySlides(extractedSlides);
      if (!theoryTitle.trim()) {
        setTheoryTitle(file.name.replace(/\.pptx$/i, ''));
      }
    } catch (err: any) {
      setValidationError(err?.message || 'Lỗi đọc file slide .pptx');
    } finally {
      setIsParsingPptx(false);
      if (pptxInputRef.current) pptxInputRef.current.value = '';
    }
  };

  // Optional: Generate structured slides from title & short description if user doesn't have a .pptx file handy
  const handleGenerateSlidesFromSummary = () => {
    const baseTitle = theoryTitle.trim() || 'Bài giảng Lý thuyết Điện tử';
    const baseSummary =
      theorySummary.trim() || 'Nguyên lý cấu tạo linh kiện, sơ đồ mạch điện và định luật cơ bản.';

    const generated: CourseSlide[] = [
      {
        id: 'slide-1',
        slideNumber: 1,
        title: `Slide 1: Tổng quan — ${baseTitle}`,
        bullets: [
          `Mục tiêu bài học: ${baseSummary}`,
          'Nắm vững khái niệm nền tảng trước khi bước vào lắp ráp trên phòng Lab 3D.',
          'Hiểu rõ thông số kỹ thuật, ký hiệu chân pin và nguyên tắc an toàn mạch.',
        ],
        contentText: `Slide 1: Tổng quan — ${baseTitle}. ${baseSummary}`,
        notes: 'Giới thiệu mục tiêu cốt lõi của bài học lý thuyết.',
      },
      {
        id: 'slide-2',
        slideNumber: 2,
        title: `Slide 2: Cấu tạo & Nguyên lý hoạt động — ${baseTitle}`,
        bullets: [
          'Phân tích cấu tạo các phần tử trong mạch điện và vai trò của từng linh kiện.',
          'Chiều dòng điện quy ước đi từ cực dương (+VCC) qua linh kiện bảo vệ tới tải và về cực âm (GND).',
          'Áp dụng định luật Ohm (I = U / R) để tính toán thông số điện trở hạn dòng phù hợp.',
        ],
        contentText: `Slide 2: Cấu tạo & Nguyên lý hoạt động của ${baseTitle}.`,
        notes: 'Giải thích nguyên lý điện học và phân cực chân linh kiện.',
      },
      {
        id: 'slide-3',
        slideNumber: 3,
        title: `Slide 3: Lưu ý an toàn & Chuẩn bị thực hành 3D`,
        bullets: [
          'Kiểm tra kỹ cực tính Anode (+) và Cathode (-) trước khi cấp nguồn mô phỏng.',
          'Tránh nối trực tiếp VCC vào GND gây hiện tượng đoản mạch (Short Circuit).',
          'Tổng kết kiến thức lý thuyết và sẵn sàng chuyển sang phần Thực hành Lab 3D.',
        ],
        contentText: 'Slide 3: Lưu ý an toàn và tổng kết trước khi thực hành 3D.',
        notes: 'Nhắc học viên kiểm tra DRC trước khi chạy mô phỏng.',
      },
    ];

    setTheoryPptxFileName(`${baseTitle.slice(0, 24).replace(/\s+/g, '_')}.pptx`);
    setTheorySlides(generated);
  };

  // Handle video file upload (optional)
  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objUrl = URL.createObjectURL(file);
    setTheoryVideoFileName(file.name);
    setTheoryVideoUrl(objUrl);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  // Add Theory Lesson to list
  const handleAddTheoryItem = () => {
    setValidationError(null);
    if (!theoryTitle.trim()) {
      setValidationError('Vui lòng nhập tiêu đề cho phần Lý thuyết.');
      return;
    }
    if (!theorySummary.trim()) {
      setValidationError('Vui lòng nhập mô tả ngắn cho phần Lý thuyết.');
      return;
    }
    if (theorySlides.length === 0) {
      setValidationError('Vui lòng tải file Slide .pptx lên (hoặc nhấn Tạo nhanh Slide từ mô tả) cho phần Lý thuyết.');
      return;
    }

    const newItem: CourseSyllabusItem = {
      id: `theory-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: theoryTitle.trim(),
      summary: theorySummary.trim(),
      duration: `${Math.max(10, theorySlides.length * 5)} phút`,
      sectionType: 'theory',
      isPracticalLab: false,
      pptxFileName: theoryPptxFileName || 'Bai_giang_ly_thuyet.pptx',
      slides: theorySlides,
      videoUrl: theoryVideoUrl.trim() || undefined,
      videoFileName: theoryVideoFileName || undefined,
    };

    setTheoryItems([...theoryItems, newItem]);
    setTheoryTitle('');
    setTheorySummary('');
    setTheoryPptxFileName('');
    setTheorySlides([]);
    setTheoryVideoUrl('');
    setTheoryVideoFileName('');
    setPreviewSlidesOpen(false);
  };

  // Trigger AI 3-stage analysis whenever a Practice project is chosen or uploaded
  const runPracticeProjectAnalysis = async (
    proj: ProjectDocument,
    titleText: string,
    summaryText: string
  ) => {
    setIsAnalyzingProject(true);
    try {
      const result = await analyzePracticeProjectWithAI(
        proj,
        titleText || proj.name || 'Bài thực hành 3D',
        summaryText
      );
      setPracticeStagesPreview(result.stages);
      if (!practiceSummary.trim() && result.summary) {
        setPracticeSummary(result.summary);
      }
    } catch {
      const fallback = buildDeterministicPracticeStages(
        proj,
        titleText || proj.name || 'Bài thực hành 3D',
        summaryText
      );
      setPracticeStagesPreview(fallback.stages);
    } finally {
      setIsAnalyzingProject(false);
    }
  };

  // Handle uploading a project .json file for Practice section
  const handlePracticeProjectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setValidationError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.components)) {
        throw new Error('File dự án không hợp lệ (thiếu danh sách linh kiện components).');
      }
      const doc: ProjectDocument = {
        ...createDefaultProjectDocument(parsed.name || file.name.replace(/\.json$/i, '')),
        ...parsed,
      };
      setUploadedPracticeProject(doc);
      setUploadedPracticeFileName(file.name);
      setSelectedPracticeProjectId('');
      if (!practiceTitle.trim()) {
        setPracticeTitle(`Thực hành: ${doc.name}`);
      }
      await runPracticeProjectAnalysis(doc, practiceTitle || doc.name, practiceSummary);
    } catch (err: any) {
      setValidationError(err?.message || 'Không thể đọc file dự án .json.');
    } finally {
      if (projectFileInputRef.current) projectFileInputRef.current.value = '';
    }
  };

  // Handle selecting an existing creator project from dropdown
  const handleSelectSavedProject = async (projId: string) => {
    setSelectedPracticeProjectId(projId);
    const found = userProjects.find((p) => (p.projectId || (p as any).id) === projId);
    if (found) {
      setUploadedPracticeProject(found);
      setUploadedPracticeFileName(`${found.name}.circuitcraft.json`);
      if (!practiceTitle.trim()) {
        setPracticeTitle(`Thực hành: ${found.name}`);
      }
      await runPracticeProjectAnalysis(found, practiceTitle || found.name, practiceSummary);
    }
  };

  // Add Practice Lab item to list
  const handleAddPracticeItem = async () => {
    setValidationError(null);
    if (!practiceTitle.trim()) {
      setValidationError('Vui lòng nhập tiêu đề cho phần Thực hành.');
      return;
    }
    if (!practiceSummary.trim()) {
      setValidationError('Vui lòng nhập mô tả ngắn / hướng dẫn cho phần Thực hành.');
      return;
    }
    if (!uploadedPracticeProject) {
      setValidationError('Phần thực hành bắt buộc phải tải dự án của Nhà sáng tạo lên để học sinh thực hành.');
      return;
    }

    const stages =
      practiceStagesPreview.length === 3
        ? practiceStagesPreview
        : buildDeterministicPracticeStages(
            uploadedPracticeProject,
            practiceTitle.trim(),
            practiceSummary.trim()
          ).stages;

    const newItem: CourseSyllabusItem = {
      id: `practice-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: practiceTitle.trim(),
      summary: practiceSummary.trim(),
      duration: '45 phút',
      sectionType: 'practice',
      isPracticalLab: true,
      practiceProjectId: uploadedPracticeProject.projectId,
      practiceProjectName: uploadedPracticeFileName || uploadedPracticeProject.name,
      practiceProjectSnapshot: JSON.parse(JSON.stringify(uploadedPracticeProject)),
      practiceStages: stages,
      practiceGuideSummary: practiceSummary.trim(),
      labGoal: practiceSummary.trim(),
    };

    setPracticeItems([...practiceItems, newItem]);
    setPracticeTitle('');
    setPracticeSummary('');
    setSelectedPracticeProjectId('');
    setUploadedPracticeProject(null);
    setUploadedPracticeFileName('');
    setPracticeStagesPreview([]);
  };

  const handleRemoveTheoryItem = (idx: number) => {
    setTheoryItems(theoryItems.filter((_, i) => i !== idx));
  };

  const handleRemovePracticeItem = (idx: number) => {
    setPracticeItems(practiceItems.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (title.trim().length < 5) {
      setValidationError(
        language === 'vi'
          ? 'Tiêu đề khóa học phải có ít nhất 5 ký tự.'
          : 'Course title must be at least 5 characters.'
      );
      return;
    }

    if (description.trim().length < 15) {
      setValidationError(
        language === 'vi'
          ? 'Mô tả khóa học phải có ít nhất 15 ký tự.'
          : 'Description must be at least 15 characters.'
      );
      return;
    }

    if (theoryItems.length === 0 && practiceItems.length === 0) {
      setValidationError(
        'Khóa học cần có ít nhất 1 phần Lý thuyết (Slide .pptx) hoặc 1 phần Thực hành (Dự án 3D).'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const combinedSyllabus: CourseSyllabusItem[] = [...theoryItems, ...practiceItems];
      const computedDuration = `${theoryItems.length} bài lý thuyết • ${practiceItems.length} bài thực hành`;

      const payload = {
        userId: currentUser?.id || 'creator-demo',
        creatorId: currentUser?.id || 'creator-demo',
        title: title.trim(),
        tagline:
          tagline.trim() ||
          `Khóa học gồm ${theoryItems.length} phần Lý thuyết Slide & ${practiceItems.length} phòng Thực hành 3D`,
        description: description.trim(),
        price: isFree ? 0 : price,
        currency: 'VND',
        level,
        duration: computedDuration,
        syllabus: combinedSyllabus,
        prerequisites: ['Đam mê điện tử', 'Trình duyệt web hiện đại'],
        tags: ['Khóa học', 'Lý thuyết Slide', 'Thực hành 3D'],
      };

      const res = await fetch('/api/creator/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Lỗi khi tạo khóa học');
      }

      const data = await res.json();
      if (data.success && data.course) {
        // Ensure full syllabus (with slides & practice snapshots) is registered in courseService immediately
        const fullCourseObj = {
          ...data.course,
          level,
          duration: computedDuration,
          syllabus: combinedSyllabus,
        };
        courseService.registerCreatedCourse(fullCourseObj);
        onCourseCreated(fullCourseObj);
        onClose();
      } else {
        throw new Error(data.error || 'Tạo khóa học thất bại');
      }
    } catch (err: any) {
      setValidationError(err.message || 'Lỗi trong quá trình tạo khóa học');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="relative w-full max-w-3xl tech-panel border border-[#d7e7f0] dark:border-cyan-800/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-cyan-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="tech-icon-tile w-9 h-9 rounded-xl text-teal-600 dark:text-teal-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {language === 'vi' ? 'Tạo Khóa học Mới (Lý thuyết & Thực hành 3D)' : 'Create New Course (Theory & 3D Practice)'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {language === 'vi'
                  ? 'Tải lên Slide bài giảng (.pptx), Video lý thuyết và Dự án mạch 3D để AI tự chia 3 giai đoạn thực hành'
                  : 'Upload PPTX slides, optional video, and creator 3D projects with AI 3-stage decomposition'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="tech-btn-control p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 text-xs">
          {validationError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Basic Course Information (Kept intact) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                {language === 'vi' ? 'Tên khóa học *' : 'Course Title *'}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Làm chủ Vi điều khiển & Thiết kế Mạch 3D Thực chiến"
                className="tech-input w-full px-3 py-2 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                {language === 'vi' ? 'Mô tả ngắn gọn (Tagline)' : 'Short Tagline'}
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="VD: Học lý thuyết qua Slide chuẩn cùng Trợ giảng AI và thực hành lắp mạch 3D theo 3 giai đoạn"
                className="tech-input w-full px-3 py-2 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                {language === 'vi' ? 'Mô tả khóa học & Mục tiêu đào tạo *' : 'Course Description & Outcomes *'}
              </label>
              <textarea
                required
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Khóa học này sẽ hướng dẫn bạn từ nguyên lý lý thuyết đến tự tay lắp ráp và mô phỏng mạch điện..."
                className="tech-input w-full px-3 py-2 text-slate-900 dark:text-slate-100 leading-relaxed font-sans"
              />
            </div>

            {/* Pricing & Level */}
            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                {language === 'vi' ? 'Học phí (VND)' : 'Tuition (VND)'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  disabled={isFree}
                  min={20000}
                  step={10000}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="tech-input w-full px-3 py-2 text-slate-900 dark:text-slate-100 disabled:opacity-40 font-mono font-bold"
                />
                <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFree}
                    onChange={(e) => setIsFree(e.target.checked)}
                    className="rounded text-teal-600 focus:ring-0"
                  />
                  <span>{language === 'vi' ? 'Miễn phí' : 'Free'}</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-800 dark:text-slate-200 mb-1">
                {language === 'vi' ? 'Cấp độ học viên' : 'Level'}
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as any)}
                className="tech-input w-full px-3 py-2 text-slate-900 dark:text-slate-100 font-medium"
              >
                <option value="Cơ bản">Cơ bản (Beginner)</option>
                <option value="Trung cấp">Trung cấp (Intermediate)</option>
                <option value="Nâng cao">Nâng cao (Advanced)</option>
                <option value="Chuyên gia">Chuyên gia (Expert)</option>
              </select>
            </div>
          </div>

          {/* ==================================================================== */}
          {/* 2 PHẦN: LÝ THUYẾT (SLIDE PPTX + VIDEO) & THỰC HÀNH (DỰ ÁN + AI 3 BƯỚC) */}
          {/* ==================================================================== */}
          <div className="pt-3 border-t border-slate-200/80 dark:border-cyan-900/40 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-500" />
                <span>Cấu trúc Khóa học (2 Phần: Lý thuyết & Thực hành)</span>
              </div>

              {/* Switcher between Part 1 (Theory) and Part 2 (Practice) */}
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/90 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveBuilderTab('theory')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    activeBuilderTab === 'theory'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>1. Phần Lý thuyết ({theoryItems.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBuilderTab('practice')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    activeBuilderTab === 'practice'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>2. Phần Thực hành ({practiceItems.length})</span>
                </button>
              </div>
            </div>

            {/* -------------------------------------------------- */}
            {/* TAB 1: PHẦN LÝ THUYẾT (SLIDE PPTX & VIDEO NẾU CÓ)   */}
            {/* -------------------------------------------------- */}
            {activeBuilderTab === 'theory' && (
              <div className="p-4 rounded-2xl bg-cyan-50/40 dark:bg-slate-900/70 border border-cyan-200/80 dark:border-cyan-800/50 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-cyan-800 dark:text-cyan-300 text-xs flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-cyan-500" />
                      Thêm bài học vào Phần Lý thuyết
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Có mô tả ngắn, tải file Slide bài giảng (.pptx) và Video bài giảng (nếu có).
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Tiêu đề bài lý thuyết *
                    </label>
                    <input
                      type="text"
                      value={theoryTitle}
                      onChange={(e) => setTheoryTitle(e.target.value)}
                      placeholder="VD: Chương 1: Nguyên lý mạch phân cực LED và Định luật Ohm"
                      className="tech-input w-full px-3 py-2 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Mô tả ngắn về bài lý thuyết *
                    </label>
                    <textarea
                      rows={2}
                      value={theorySummary}
                      onChange={(e) => setTheorySummary(e.target.value)}
                      placeholder="Tóm tắt ngắn gọn nội dung lý thuyết người học sẽ nắm được qua bộ slide này..."
                      className="tech-input w-full px-3 py-2 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  {/* Upload PPTX Slide File */}
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-950/70 border border-cyan-200 dark:border-cyan-800/60 space-y-2">
                    <label className="block font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-cyan-500" />
                      <span>Tải file Slide bài giảng (.pptx) *</span>
                    </label>
                    <input
                      ref={pptxInputRef}
                      type="file"
                      accept=".pptx"
                      onChange={handlePptxFileChange}
                      className="hidden"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => pptxInputRef.current?.click()}
                        disabled={isParsingPptx}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isParsingPptx ? 'Đang trích xuất slide...' : 'Chọn file .pptx'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleGenerateSlidesFromSummary}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-300 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition border border-cyan-300/40"
                        title="Tạo tự động bộ slide chuẩn từ tiêu đề và mô tả ngắn"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Tạo slide mẫu từ mô tả</span>
                      </button>
                    </div>

                    {theorySlides.length > 0 && (
                      <div className="pt-1 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          <span className="flex items-center gap-1 truncate">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            Đã nạp: {theoryPptxFileName} ({theorySlides.length} slide)
                          </span>
                          <button
                            type="button"
                            onClick={() => setPreviewSlidesOpen(!previewSlidesOpen)}
                            className="text-cyan-600 dark:text-cyan-400 underline flex items-center gap-0.5 shrink-0 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>{previewSlidesOpen ? 'Ẩn' : 'Xem slide'}</span>
                          </button>
                        </div>

                        {previewSlidesOpen && (
                          <div className="max-h-32 overflow-y-auto p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1 text-[11px]">
                            {theorySlides.map((s) => (
                              <div key={s.id} className="truncate text-slate-700 dark:text-slate-300">
                                <span className="font-bold text-cyan-600 dark:text-cyan-400">
                                  Slide {s.slideNumber}:
                                </span>{' '}
                                {s.title}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Upload Video or Video URL (Optional) */}
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2">
                    <label className="block font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Video className="w-4 h-4 text-indigo-500" />
                      <span>Video bài giảng (Tùy chọn - nếu có)</span>
                    </label>
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleVideoFileChange}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => videoInputRef.current?.click()}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 font-semibold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Tải video</span>
                      </button>
                      <input
                        type="text"
                        value={theoryVideoUrl}
                        onChange={(e) => setTheoryVideoUrl(e.target.value)}
                        placeholder="Hoặc dán link video (MP4 / YouTube)..."
                        className="tech-input flex-1 px-2.5 py-1.5 text-[11px] text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    {theoryVideoFileName && (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Video đính kèm: {theoryVideoFileName}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddTheoryItem}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm bài vào Phần Lý thuyết</span>
                  </button>
                </div>

                {/* List of added Theory lessons */}
                {theoryItems.length > 0 && (
                  <div className="pt-2 border-t border-cyan-200/60 dark:border-cyan-900/50 space-y-2">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                      Danh sách bài Lý thuyết đã thêm ({theoryItems.length}):
                    </div>
                    {theoryItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-950/80 border border-cyan-200 dark:border-cyan-800/50 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                            Lý thuyết {idx + 1}: {item.title}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {item.summary}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] font-semibold text-cyan-600 dark:text-cyan-400">
                            <span>📊 {item.pptxFileName} ({item.slides?.length || 0} slide)</span>
                            {item.videoUrl && <span>• 🎬 Có video bài giảng</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveTheoryItem(idx)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* -------------------------------------------------- */}
            {/* TAB 2: PHẦN THỰC HÀNH (TẢI DỰ ÁN + AI CHIA 3 BƯỚC)  */}
            {/* -------------------------------------------------- */}
            {activeBuilderTab === 'practice' && (
              <div className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-slate-900/70 border border-emerald-200/80 dark:border-emerald-800/50 space-y-3.5">
                <div>
                  <h4 className="font-extrabold text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-emerald-500" />
                    Thêm bài vào Phần Thực hành 3D
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Tải dự án 3D của Nhà sáng tạo lên — AI sẽ tự động phân tích và chia thành 3 giai đoạn (1. Thêm thiết bị/mạch → 2. Nối dây → 3. Chạy mô phỏng) cho học sinh thực hành từ bo mạch trống.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Tiêu đề bài thực hành *
                    </label>
                    <input
                      type="text"
                      value={practiceTitle}
                      onChange={(e) => setPracticeTitle(e.target.value)}
                      placeholder="VD: Thực hành 1: Lắp ráp & mô phỏng mạch điều khiển đèn LED"
                      className="tech-input w-full px-3 py-2 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Mô tả ngắn / Yêu cầu thực hành *
                    </label>
                    <textarea
                      rows={2}
                      value={practiceSummary}
                      onChange={(e) => setPracticeSummary(e.target.value)}
                      placeholder="Mô tả ngắn gọn mục tiêu bài thực hành để học sinh và AI nắm rõ..."
                      className="tech-input w-full px-3 py-2 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  {/* Upload Creator Project File OR Pick from Creator's Saved Projects */}
                  <div className="sm:col-span-2 p-3 rounded-xl bg-white dark:bg-slate-950/70 border border-emerald-200 dark:border-emerald-800/60 space-y-2.5">
                    <label className="block font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-emerald-500" />
                      <span>Tải dự án của Nhà sáng tạo lên để học sinh thực hành *</span>
                    </label>

                    <input
                      ref={projectFileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handlePracticeProjectFileUpload}
                      className="hidden"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => projectFileInputRef.current?.click()}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition shadow-xs"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Tải file Dự án (.json) từ máy tính</span>
                      </button>

                      <select
                        value={selectedPracticeProjectId}
                        onChange={(e) => handleSelectSavedProject(e.target.value)}
                        className="tech-input px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-medium"
                      >
                        <option value="">-- Hoặc chọn từ Dự án 3D đã lưu của bạn --</option>
                        {userProjects.map((p) => {
                          const pid = p.projectId || (p as any).id;
                          return (
                            <option key={pid} value={pid}>
                              {p.name} ({p.components?.length || 0} linh kiện, {p.connections?.length || 0} dây nối)
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {isAnalyzingProject && (
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold pt-1">
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>AI đang tự động phân tích dự án và chia thành 3 giai đoạn thực hành...</span>
                      </div>
                    )}

                    {uploadedPracticeProject && !isAnalyzingProject && (
                      <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Dự án đã tải: {uploadedPracticeProject.name} ({uploadedPracticeProject.components.length} thiết bị,{' '}
                            {uploadedPracticeProject.connections.length} dây nối)
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold">
                            AI đã chia 3 giai đoạn
                          </span>
                        </div>

                        {/* Preview of the 3 AI-generated stages */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                          {practiceStagesPreview.map((st) => (
                            <div
                              key={st.stageNumber}
                              className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60 text-[11px]"
                            >
                              <div className="font-extrabold text-emerald-700 dark:text-emerald-400 mb-1">
                                {st.title}
                              </div>
                              <div className="text-slate-600 dark:text-slate-400 text-[10px] line-clamp-2">
                                {st.steps[0] || st.description}
                              </div>
                              <div className="mt-1 text-[10px] font-mono text-slate-400">
                                {st.steps.length} bước hướng dẫn
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddPracticeItem}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm bài vào Phần Thực hành</span>
                  </button>
                </div>

                {/* List of added Practice items */}
                {practiceItems.length > 0 && (
                  <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/50 space-y-2">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                      Danh sách bài Thực hành đã thêm ({practiceItems.length}):
                    </div>
                    {practiceItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-950/80 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                            Thực hành {idx + 1}: {item.title}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {item.summary}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <span>
                              🔌 Dự án: {item.practiceProjectName} (
                              {item.practiceProjectSnapshot?.components?.length || 0} thiết bị •{' '}
                              {item.practiceProjectSnapshot?.connections?.length || 0} dây nối)
                            </span>
                            <span>• ✨ Đã chia 3 giai đoạn AI</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePracticeItem(idx)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-200/80 dark:border-cyan-900/40 flex items-center justify-between">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              <span>Tổng cộng: </span>
              <span className="font-bold text-cyan-600 dark:text-cyan-400">
                {theoryItems.length} Lý thuyết
              </span>
              <span> + </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {practiceItems.length} Thực hành
              </span>
              <span className="mx-2">•</span>
              <span>Doanh thu Creator (85%): </span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {isFree ? '0 đ' : formatCurrency(price * 0.85)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="tech-btn-secondary px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                {language === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="tech-btn-3d-green flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold text-white cursor-pointer shadow-md disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin text-white" />
                    <span>{language === 'vi' ? 'Đang tạo khóa học...' : 'Creating...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>{language === 'vi' ? 'Xác nhận Tạo Khóa học' : 'Create Course'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
