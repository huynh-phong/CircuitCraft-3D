import React, { useState, useEffect, useMemo } from 'react';
import { ValidationIssue } from '../domain/validation/types';
import { SimulationResult } from '../domain/simulation/types';
import { ProjectDocument } from '../domain/project/types';
import { createDefaultProjectDocument } from '../domain/project/document';
import { Course, CourseSyllabusItem, PracticeStage } from '../domain/courses/types';
import {
  buildDeterministicPracticeStages,
  getFriendlyComponentName,
} from '../domain/courses/pptxAndPracticeParser';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Activity,
  BookOpen,
  Compass,
  Cpu,
  Cable,
  PlayCircle,
  Sparkles,
  Check,
  ArrowRight,
  GraduationCap,
} from 'lucide-react';
import { useI18n } from '../i18n/context';

export interface ActivePracticeLabContext {
  course: Course;
  practiceItem: CourseSyllabusItem;
  studentProject: ProjectDocument;
  isSimulating: boolean;
  isLessonCompleted?: boolean;
  onCompletePractice?: () => void;
  onBackToMyCourses?: () => void;
  onAskAIAboutStage?: (promptText: string) => void;
}

export interface ValidationPanelProps {
  issues: ValidationIssue[];
  simulationResult: SimulationResult | null;
  onFocusIssue: (componentId?: string) => void;
  practiceContext?: ActivePracticeLabContext | null;
}

export const ValidationPanel: React.FC<ValidationPanelProps> = ({
  issues,
  simulationResult,
  onFocusIssue,
  practiceContext,
}) => {
  const { language } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'validation' | 'simulation' | 'practice_content' | 'practice_guide'
  >('validation');
  const [selectedStageNumber, setSelectedStageNumber] = useState<1 | 2 | 3>(1);

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  // Whenever user enters a course practice lab, automatically expand the bottom panel to Practice Guide
  // When in a personal project, ensure activeTab is validation or simulation (not practice lab tabs)
  useEffect(() => {
    if (practiceContext?.practiceItem?.id) {
      setActiveTab('practice_guide');
      setIsExpanded(true);
      setSelectedStageNumber(1);
    } else {
      setActiveTab((prev) =>
        prev === 'practice_content' || prev === 'practice_guide' ? 'validation' : prev
      );
    }
  }, [practiceContext?.practiceItem?.id]);

  // Compute the 3 stages for the active practice item
  const practiceStages: PracticeStage[] = useMemo(() => {
    if (!practiceContext?.practiceItem) return [];
    const item = practiceContext.practiceItem;
    if (item.practiceStages && item.practiceStages.length === 3) {
      return item.practiceStages;
    }
    const targetProj = item.practiceProject || item.practiceProjectSnapshot;
    const descText = item.summary || item.shortDescription || item.desc || '';
    if (targetProj) {
      return buildDeterministicPracticeStages(targetProj, item.title, descText).stages;
    }
    const fallbackDoc = createDefaultProjectDocument(item.title);
    fallbackDoc.components = [];
    fallbackDoc.connections = [];
    return buildDeterministicPracticeStages(fallbackDoc, item.title, descText).stages;
  }, [practiceContext?.practiceItem]);

  // Real-time progress calculation comparing Student's 3D Workspace vs Creator's Target Practice Project
  const stageEvaluation = useMemo(() => {
    if (!practiceContext?.practiceItem) {
      return {
        stage1DoneCount: 0,
        stage1Total: 0,
        stage1Complete: false,
        stage2DoneCount: 0,
        stage2Total: 0,
        stage2Complete: false,
        stage3Complete: false,
        completedChecklistIds: new Set<string>(),
      };
    }

    const targetProject =
      practiceContext.practiceItem.practiceProject ||
      practiceContext.practiceItem.practiceProjectSnapshot;
    const studentComps = practiceContext.studentProject?.components || [];
    const studentConns = practiceContext.studentProject?.connections || [];

    const completedIds = new Set<string>();

    // Evaluate Stage 1: Component Placement
    const targetComps = targetProject?.components || [];
    const usedStudentCompIndices = new Set<number>();
    let stage1Done = 0;

    targetComps.forEach((tc, idx) => {
      const matchIdx = studentComps.findIndex(
        (sc, sIdx) => !usedStudentCompIndices.has(sIdx) && sc.definitionId === tc.definitionId
      );
      if (matchIdx !== -1) {
        usedStudentCompIndices.add(matchIdx);
        stage1Done++;
        completedIds.add(`chk-comp-${tc.instanceId || idx}`);
      }
    });

    const stage1Total = Math.max(targetComps.length, 1);
    const stage1Complete =
      targetComps.length > 0 ? stage1Done >= targetComps.length : studentComps.length > 0;

    // Evaluate Stage 2: Wiring Connections
    const targetConns = targetProject?.connections || [];
    const targetCompDefMap = new Map<string, string>();
    targetComps.forEach((tc) => targetCompDefMap.set(tc.instanceId, tc.definitionId));

    const studentCompDefMap = new Map<string, string>();
    studentComps.forEach((sc) => studentCompDefMap.set(sc.instanceId, sc.definitionId));

    const usedStudentConnIndices = new Set<number>();
    let stage2Done = 0;

    targetConns.forEach((tConn, idx) => {
      const targetFromDef = targetCompDefMap.get(tConn.fromComponentId) || '';
      const targetToDef = targetCompDefMap.get(tConn.toComponentId) || '';

      const matchConnIdx = studentConns.findIndex((sConn, sIdx) => {
        if (usedStudentConnIndices.has(sIdx)) return false;
        const sFromDef = studentCompDefMap.get(sConn.fromComponentId) || '';
        const sToDef = studentCompDefMap.get(sConn.toComponentId) || '';

        const directMatch =
          sFromDef === targetFromDef &&
          sToDef === targetToDef &&
          sConn.fromPinId.toLowerCase() === tConn.fromPinId.toLowerCase() &&
          sConn.toPinId.toLowerCase() === tConn.toPinId.toLowerCase();

        const reverseMatch =
          sFromDef === targetToDef &&
          sToDef === targetFromDef &&
          sConn.fromPinId.toLowerCase() === tConn.toPinId.toLowerCase() &&
          sConn.toPinId.toLowerCase() === tConn.fromPinId.toLowerCase();

        return directMatch || reverseMatch;
      });

      if (matchConnIdx !== -1) {
        usedStudentConnIndices.add(matchConnIdx);
        stage2Done++;
        completedIds.add(`chk-wire-${tConn.id || idx}`);
      }
    });

    const stage2Total = Math.max(targetConns.length, 1);
    const stage2Complete =
      targetConns.length > 0
        ? stage2Done >= targetConns.length
        : studentConns.length > 0 && stage1Complete;

    // Evaluate Stage 3: Simulation & DRC
    const drcClean = errorCount === 0 && studentComps.length > 0;
    if (drcClean) {
      completedIds.add('chk-sim-drc');
    }
    const simRan = Boolean(
      practiceContext.isSimulating || (simulationResult && studentComps.length > 0)
    );
    if (simRan) {
      completedIds.add('chk-sim-run');
    }
    const stage3Complete = stage1Complete && stage2Complete && drcClean && simRan;

    return {
      stage1DoneCount: targetComps.length > 0 ? stage1Done : studentComps.length > 0 ? 1 : 0,
      stage1Total,
      stage1Complete,
      stage2DoneCount: targetConns.length > 0 ? stage2Done : studentConns.length > 0 ? 1 : 0,
      stage2Total,
      stage2Complete,
      stage3Complete,
      completedChecklistIds: completedIds,
    };
  }, [practiceContext, errorCount, simulationResult]);

  const currentStageObj =
    practiceStages.find((s) => s.stageNumber === selectedStageNumber) || practiceStages[0];

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-20 shrink-0 select-none transition-all">
      {/* Tab Header Bar */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 overflow-x-auto">
        <div className="flex items-center gap-2">
          {/* ONLY DISPLAY PRACTICE TABS WHEN practiceContext EXISTS (In a Course Practice Lab) */}
          {practiceContext && (
            <>
              {/* Tab 1: Nội dung thực hành */}
              <button
                onClick={() => {
                  setActiveTab('practice_content');
                  setIsExpanded(true);
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition whitespace-nowrap ${
                  activeTab === 'practice_content' && isExpanded
                    ? 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-cyan-500" />
                <span>{language === 'vi' ? 'Nội dung thực hành' : 'Practice Content'}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 text-[10px] font-bold">
                  Lab
                </span>
              </button>

              {/* Tab 2: Hướng dẫn thực hành (3 giai đoạn) */}
              <button
                onClick={() => {
                  setActiveTab('practice_guide');
                  setIsExpanded(true);
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition whitespace-nowrap ${
                  activeTab === 'practice_guide' && isExpanded
                    ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-500/40 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-indigo-500" />
                <span>{language === 'vi' ? 'Hướng dẫn thực hành' : 'Practice Guide'}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold">
                  {[
                    stageEvaluation.stage1Complete,
                    stageEvaluation.stage2Complete,
                    stageEvaluation.stage3Complete,
                  ].filter(Boolean).length}
                  /3
                </span>
              </button>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1" />
            </>
          )}

          {/* When in Personal Project (!practiceContext), show a clear Project Mode pill */}
          {!practiceContext && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 text-[11px] font-bold mr-1">
              <Cpu className="w-3.5 h-3.5 text-cyan-500" />
              <span>{language === 'vi' ? 'Dự án cá nhân' : 'Personal Project'}</span>
            </div>
          )}

          {/* Tab 3: Validation Tab */}
          <button
            onClick={() => {
              setActiveTab('validation');
              setIsExpanded(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition whitespace-nowrap ${
              activeTab === 'validation' && isExpanded
                ? 'bg-slate-100 dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 border border-slate-200 dark:border-slate-700 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Kiểm tra mạch' : 'DRC Validation'}</span>
            {errorCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 text-[10px] font-bold">
                {errorCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 text-[10px] font-bold">
                {warningCount}
              </span>
            )}
            {errorCount === 0 && warningCount === 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>

          {/* Tab 4: Simulation Tab */}
          <button
            onClick={() => {
              setActiveTab('simulation');
              setIsExpanded(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition whitespace-nowrap ${
              activeTab === 'simulation' && isExpanded
                ? 'bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Mô phỏng hành vi' : 'Simulation'}</span>
            {simulationResult && (
              <span
                className={`w-2 h-2 rounded-full ${
                  simulationResult.issues.some(
                    (i) => i.toLowerCase().includes('đoản mạch') || i.toLowerCase().includes('short')
                  )
                    ? 'bg-red-500 animate-ping'
                    : simulationResult.isClosedLoop
                    ? 'bg-emerald-500'
                    : 'bg-slate-400'
                }`}
              />
            )}
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {practiceContext ? (
            <div className="hidden md:flex items-center gap-2 mr-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                <strong className="text-cyan-600 dark:text-cyan-400">Bài thực hành:</strong>{' '}
                {practiceContext.practiceItem.title}
              </span>
              {practiceContext.onBackToMyCourses && (
                <button
                  onClick={practiceContext.onBackToMyCourses}
                  className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition"
                >
                  Quay lại khóa học
                </button>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 mr-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              <span>Không gian thiết kế tự do</span>
            </div>
          )}

          {/* Expand / Collapse Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
            title={
              isExpanded
                ? language === 'vi'
                  ? 'Thu gọn bảng'
                  : 'Collapse'
                : language === 'vi'
                ? 'Mở rộng bảng'
                : 'Expand'
            }
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Content Drawer */}
      {isExpanded && (
        <div className="h-56 overflow-y-auto p-3.5 text-xs">
          {/* TAB 1: NỘI DUNG THỰC HÀNH */}
          {activeTab === 'practice_content' && (
            !practiceContext ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto gap-2 text-slate-500 dark:text-slate-400">
                <GraduationCap className="w-8 h-8 text-cyan-500/70" />
                <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                  Chế độ Thiết kế 3D Tự do (Sandbox)
                </div>
                <p className="text-xs leading-relaxed">
                  Hiện chưa có bài thực hành khóa học nào đang mở. Để xem Nội dung thực hành và Hướng
                  dẫn 3 giai đoạn từ dự án của nhà sáng tạo, hãy vào menu cá nhân{' '}
                  <strong>"Khóa học của tôi"</strong> và nhấn vào một bài <strong>Thực hành Lab</strong>.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Column 1: Course & Practice Overview */}
                <div className="lg:col-span-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 mb-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{practiceContext.course.title}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">
                      {practiceContext.practiceItem.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2">
                      {practiceContext.practiceItem.summary ||
                        practiceContext.practiceItem.shortDescription ||
                        practiceContext.practiceItem.desc ||
                        'Thực hành lắp ráp linh kiện, đấu nối dây dẫn trên bo mạch 3D trống và chạy mô phỏng kiểm nghiệm theo thiết kế chuẩn của giảng viên.'}
                    </p>
                    {(practiceContext.practiceItem.practiceGuideSummary ||
                      practiceContext.practiceItem.practiceSummary) && (
                      <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-800 dark:text-cyan-200">
                        <strong className="font-semibold">Tóm tắt AI phân tích:</strong>{' '}
                        {practiceContext.practiceItem.practiceGuideSummary ||
                          practiceContext.practiceItem.practiceSummary}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setActiveTab('practice_guide')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>Mở Hướng dẫn 3 giai đoạn</span>
                    </button>

                    {practiceContext.onCompletePractice && (
                      <button
                        onClick={practiceContext.onCompletePractice}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition ${
                          practiceContext.isLessonCompleted
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {practiceContext.isLessonCompleted
                            ? 'Đã hoàn thành'
                            : 'Đánh dấu Hoàn thành'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Column 2: Target Components (BOM) */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-cyan-500" />
                      Thiết bị & Linh kiện cần thêm (
                      {(
                        practiceContext.practiceItem.practiceProject ||
                        practiceContext.practiceItem.practiceProjectSnapshot
                      )?.components?.length || 0}
                      )
                    </span>
                    <span className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
                      Đã đặt: {stageEvaluation.stage1DoneCount}/{stageEvaluation.stage1Total}
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {((
                      practiceContext.practiceItem.practiceProject ||
                      practiceContext.practiceItem.practiceProjectSnapshot
                    )?.components || []).length === 0 ? (
                      <div className="text-slate-500 text-[11px]">
                        Xem chi tiết linh kiện trong mục Hướng dẫn thực hành.
                      </div>
                    ) : (
                      (
                        (
                          practiceContext.practiceItem.practiceProject ||
                          practiceContext.practiceItem.practiceProjectSnapshot
                        )?.components || []
                      ).map((comp, idx) => {
                        const isAdded = stageEvaluation.completedChecklistIds.has(
                          `chk-comp-${comp.instanceId || idx}`
                        );
                        return (
                          <div
                            key={comp.instanceId || idx}
                            className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between ${
                              isAdded
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="truncate">
                              <span className="font-semibold">
                                {comp.name || getFriendlyComponentName(comp.definitionId)}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-1.5">
                                ({getFriendlyComponentName(comp.definitionId)})
                              </span>
                            </div>
                            {isAdded ? (
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                                <Check className="w-3 h-3" /> Đã thêm
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 shrink-0">
                                Chưa thêm
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Column 3: Target Connections Summary */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Cable className="w-3.5 h-3.5 text-indigo-500" />
                      Sơ đồ nối dây chuẩn (
                      {(
                        practiceContext.practiceItem.practiceProject ||
                        practiceContext.practiceItem.practiceProjectSnapshot
                      )?.connections?.length || 0}
                      )
                    </span>
                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                      Đã nối: {stageEvaluation.stage2DoneCount}/{stageEvaluation.stage2Total}
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {(practiceStages[1]?.checklist || []).length === 0 ? (
                      <div className="text-slate-500 text-[11px]">
                        Xem các bước nối dây trong tab Hướng dẫn thực hành.
                      </div>
                    ) : (
                      (practiceStages[1]?.checklist || []).map((chk) => {
                        const isWired = stageEvaluation.completedChecklistIds.has(chk.id);
                        return (
                          <div
                            key={chk.id}
                            className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 ${
                              isWired
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <span className="truncate text-[11px]">{chk.label}</span>
                            {isWired ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <span className="text-[10px] text-slate-400 shrink-0">Chờ nối</span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )
          )}

          {/* TAB 2: HƯỚNG DẪN THỰC HÀNH (3 GIAI ĐOẠN) */}
          {activeTab === 'practice_guide' && (
            !practiceContext ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto gap-2 text-slate-500 dark:text-slate-400">
                <Compass className="w-8 h-8 text-indigo-500/70" />
                <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                  Hướng dẫn thực hành 3 giai đoạn (Thêm thiết bị → Nối dây → Mô phỏng)
                </div>
                <p className="text-xs leading-relaxed">
                  Khi bạn vào học một bài <strong>Thực hành Lab</strong> từ mục{' '}
                  <strong>"Khóa học của tôi"</strong>, AI sẽ tự động bóc tách dự án của nhà sáng tạo
                  thành 3 giai đoạn từng bước tại đây để hướng dẫn bạn thực hành từ bàn làm việc trống.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">
                {/* Left 4 cols: 3 Stage Selector Stepper */}
                <div className="lg:col-span-4 flex flex-col gap-2">
                  {[
                    {
                      num: 1 as const,
                      title: 'Giai đoạn 1: Thêm thiết bị / mạch',
                      sub: `${stageEvaluation.stage1DoneCount}/${stageEvaluation.stage1Total} linh kiện`,
                      done: stageEvaluation.stage1Complete,
                      icon: Cpu,
                    },
                    {
                      num: 2 as const,
                      title: 'Giai đoạn 2: Nối dây mạch điện',
                      sub: `${stageEvaluation.stage2DoneCount}/${stageEvaluation.stage2Total} đường dây`,
                      done: stageEvaluation.stage2Complete,
                      icon: Cable,
                    },
                    {
                      num: 3 as const,
                      title: 'Giai đoạn 3: Chạy mô phỏng',
                      sub: stageEvaluation.stage3Complete
                        ? 'Đã kiểm nghiệm mô phỏng'
                        : 'Chạy & kiểm tra mạch',
                      done: stageEvaluation.stage3Complete,
                      icon: PlayCircle,
                    },
                  ].map((st) => {
                    const Icon = st.icon;
                    const isSelected = selectedStageNumber === st.num;
                    return (
                      <button
                        key={st.num}
                        onClick={() => setSelectedStageNumber(st.num)}
                        className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-indigo-500/15 border-indigo-500 text-indigo-900 dark:text-white shadow-sm'
                            : st.done
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                            : 'bg-slate-50 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                              st.done
                                ? 'bg-emerald-500 text-white'
                                : isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {st.done ? <Check className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                          </div>
                          <div className="truncate">
                            <div className="font-bold text-xs truncate">{st.title}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {st.sub}
                            </div>
                          </div>
                        </div>
                        <ArrowRight
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected ? 'text-indigo-500' : 'text-slate-400'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Right 8 cols: Active Stage Detailed Steps & Interactive Checklist */}
                <div className="lg:col-span-8 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-y-auto">
                  {currentStageObj ? (
                    <>
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              {currentStageObj.title}
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {currentStageObj.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {practiceContext.onAskAIAboutStage && (
                              <button
                                onClick={() =>
                                  practiceContext.onAskAIAboutStage!(
                                    `Hãy hướng dẫn chi tiết cho tôi cách thực hiện "${currentStageObj.title}" trong bài thực hành "${practiceContext.practiceItem.title}" và kiểm tra xem mạch hiện tại của tôi còn thiếu gì.`
                                  )
                                }
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-[11px] shadow-sm transition"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>Hỏi AI trợ giảng giai đoạn này</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Checklist items with live verification */}
                        {currentStageObj.checklist && currentStageObj.checklist.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2.5">
                            {currentStageObj.checklist.map((item) => {
                              const done = stageEvaluation.completedChecklistIds.has(item.id);
                              return (
                                <div
                                  key={item.id}
                                  className={`p-2 rounded-lg border flex items-start gap-2 ${
                                    done
                                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200'
                                  }`}
                                >
                                  <div
                                    className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                      done
                                        ? 'bg-emerald-500 text-white'
                                        : 'border border-slate-300 dark:border-slate-600'
                                    }`}
                                  >
                                    {done && <Check className="w-2.5 h-2.5" />}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-semibold text-[11px] leading-snug">
                                      {item.label}
                                    </div>
                                    {item.detail && (
                                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        {item.detail}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Detailed Step Instructions */}
                        <div className="space-y-1">
                          {currentStageObj.steps.map((stepText, idx) => (
                            <div
                              key={idx}
                              className="text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-2 py-0.5"
                            >
                              <span className="w-4 h-4 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <span>{stepText}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Stage Navigation Footer */}
                      <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {selectedStageNumber === 1 &&
                            (stageEvaluation.stage1Complete
                              ? '✅ Đã thêm đủ linh kiện! Hãy chuyển sang Giai đoạn 2: Nối dây.'
                              : '💡 Mẹo: Nhấp vào linh kiện ở thanh bên trái để thêm vào bo mạch 3D trống.')}
                          {selectedStageNumber === 2 &&
                            (stageEvaluation.stage2Complete
                              ? '✅ Đã nối dây chính xác! Hãy chuyển sang Giai đoạn 3: Chạy mô phỏng.'
                              : '💡 Mẹo: Chọn công cụ Nối dây (Wire) và nhấp vào 2 chân linh kiện để kết nối.')}
                          {selectedStageNumber === 3 &&
                            (stageEvaluation.stage3Complete
                              ? '🎉 Chúc mừng! Bạn đã hoàn thành toàn bộ 3 giai đoạn thực hành.'
                              : '💡 Mẹo: Nhấn nút "Mô phỏng" trên thanh công cụ phía trên để kiểm nghiệm mạch.')}
                        </div>

                        <div className="flex items-center gap-2">
                          {selectedStageNumber < 3 ? (
                            <button
                              onClick={() =>
                                setSelectedStageNumber((selectedStageNumber + 1) as 1 | 2 | 3)
                              }
                              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
                            >
                              Sang Giai đoạn {selectedStageNumber + 1} →
                            </button>
                          ) : (
                            practiceContext.onCompletePractice && (
                              <button
                                onClick={practiceContext.onCompletePractice}
                                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center gap-1.5"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>
                                  {practiceContext.isLessonCompleted
                                    ? 'Đã lưu hoàn thành'
                                    : 'Hoàn thành bài thực hành'}
                                </span>
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            )
          )}

          {/* TAB 3: KIỂM TRA MẠCH (DRC VALIDATION) */}
          {activeTab === 'validation' &&
            (issues.length === 0 ? (
              <div className="h-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {language === 'vi'
                    ? 'Mạch đạt tất cả các quy tắc kiểm tra thiết kế điện tử (DRC)! Không phát hiện lỗi.'
                    : 'Circuit passes all Design Rule Checks (DRC)! No issues found.'}
                </span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {issues.map((iss) => (
                  <div
                    key={iss.id}
                    onClick={() => onFocusIssue(iss.objectRefs?.[0])}
                    className="p-2 rounded bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 hover:border-cyan-500/50 flex items-start justify-between gap-3 cursor-pointer transition"
                  >
                    <div className="flex items-start gap-2">
                      {iss.severity === 'error' ? (
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      ) : iss.severity === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-200">
                          {iss.message}
                        </div>
                        {iss.suggestion && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {language === 'vi' ? 'Gợi ý: ' : 'Tip: '}
                            {iss.suggestion}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-cyan-600 dark:text-cyan-400 underline font-mono shrink-0">
                      {language === 'vi' ? 'Xem chi tiết >' : 'Inspect >'}
                    </span>
                  </div>
                ))}
              </div>
            ))}

          {/* TAB 4: MÔ PHỎNG HÀNH VI (SIMULATION) */}
          {activeTab === 'simulation' &&
            (!simulationResult ? (
              <div className="h-full flex items-center justify-center text-slate-500">
                {language === 'vi'
                  ? 'Nhấn nút "Mô phỏng" trên thanh công cụ để bắt đầu phân tích mạch.'
                  : 'Click "Simulate" in toolbar to begin circuit analysis.'}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Circuit status alert */}
                <div className="flex items-center gap-4 p-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 dark:text-slate-400">
                      {language === 'vi' ? 'Trạng thái mạch:' : 'Circuit status:'}
                    </span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                        simulationResult.issues.some(
                          (i) =>
                            i.toLowerCase().includes('đoản mạch') ||
                            i.toLowerCase().includes('short')
                        )
                          ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/40'
                          : simulationResult.isClosedLoop
                          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/40'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {simulationResult.issues.some(
                        (i) =>
                          i.toLowerCase().includes('đoản mạch') || i.toLowerCase().includes('short')
                      )
                        ? language === 'vi'
                          ? 'ĐOẢN MẠCH (NGUY HIỂM)'
                          : 'SHORT CIRCUIT'
                        : simulationResult.isClosedLoop
                        ? language === 'vi'
                          ? 'KHÉP KÍN (DẪN ĐIỆN)'
                          : 'CLOSED LOOP (ACTIVE)'
                        : language === 'vi'
                        ? 'HỞ MẠCH'
                        : 'OPEN CIRCUIT'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                    {simulationResult.summary}
                  </div>
                </div>

                {/* Component conduction table */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(simulationResult.components).map(([cId, state]) => (
                    <div
                      key={cId}
                      className="p-2 rounded bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-[11px]"
                    >
                      <div className="font-semibold text-slate-800 dark:text-slate-300 truncate">
                        {cId}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-slate-500 dark:text-slate-400">
                          {language === 'vi' ? 'Trạng thái:' : 'State:'}
                        </span>
                        <span
                          className={
                            state.isOn
                              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                              : 'text-slate-400 dark:text-slate-500'
                          }
                        >
                          {state.isOn
                            ? language === 'vi'
                              ? 'BẬT (SÁNG)'
                              : 'ON'
                            : language === 'vi'
                            ? 'TẮT'
                            : 'OFF'}
                        </span>
                      </div>
                      {state.voltageDrop !== undefined && (
                        <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
                          <span>{language === 'vi' ? 'Sụt áp:' : 'Drop:'}</span>
                          <span className="font-mono">{state.voltageDrop}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};
