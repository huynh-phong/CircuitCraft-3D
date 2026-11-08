import React, { Suspense, lazy, useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  ProjectDocument,
  ComponentInstance,
  Connection,
  Vector3D,
  ComponentDefinition,
  WireStyle,
  BoardDefinition,
  BoardShape,
} from './domain/project/types';
import { createDefaultProjectDocument } from './domain/project/document';
import { CommandHistory } from './domain/commands/history';
import {
  AddComponentCommand,
  MoveComponentCommand,
  RotateComponentCommand,
  DeleteComponentCommand,
  CreateConnectionCommand,
  DeleteConnectionCommand,
  UpdateConnectionCommand,
  BatchCommand,
  ResizeBoardCommand,
  ChangeBoardShapeCommand,
  CutBoardCommand,
  UpdateComponentParameterCommand,
  RenameComponentCommand,
  UpdateProjectFieldsCommand,
} from './domain/commands/commands';
import {
  areAllComponentsContained,
  splitPolygonByCutPath,
  getBoardPerimeter,
  calculatePolygonArea,
  Point2D,
} from './domain/project/boardGeometry';
import { validateProjectDocument } from './domain/validation/engine';
import { ValidationIssue } from './domain/validation/types';
import { simulateBehavior } from './domain/simulation/engine';
import { SimulationResult } from './domain/simulation/types';
import { projectRepositoryManager } from './persistence/repositoryManager';
import { localProjectRepository } from './persistence/localRepository';
import { authService, UserProfile } from './persistence/authService';
import { SAMPLE_PROJECTS } from './persistence/sampleProjects';
import { Lesson } from './domain/lessons/types';
import { AIChatMessage, AIProposal } from './ai/types';
import { assistantService } from './ai/assistantService';
import { minibotChatService } from './ai/minibotChatService';
import { paymentService } from './billing/paymentService';
import type { MinibotState } from './scene/minibot3D';
import { calculatePinWorldPosition } from './domain/project/coordinates';
import { COMPONENT_DEFINITION_MAP } from './domain/components/definitions';

// UI Components
import { Navbar } from './components/Navbar';
import { validateAIProposal } from './domain/ai/proposalValidation';
import { ConcurrencyConflictModal } from './components/ConcurrencyConflictModal';

// Pages
import { MobileBottomNav } from './components/MobileBottomNav';
import { RouteKey, resolveRouteFromUrl, syncBrowserUrl } from './router/routes';

import { Course, CourseSyllabusItem } from './domain/courses/types';
import { courseService } from './domain/courses/courseService';
import { buildDeterministicPracticeStages } from './domain/courses/pptxAndPracticeParser';
import { GraduationCap, CheckCircle2, PanelLeftOpen, PanelRightOpen, AlertTriangle, Cpu, FolderOpen } from 'lucide-react';
import { useI18n } from './i18n/context';
import { AnimatePresence } from 'motion/react';
import { PageTransition, RouteFallback } from './components/ui/PageTransition';
import { LandscapeGate } from './components/layout/LandscapeGate';
import { useDeviceProfile } from './hooks/useDeviceProfile';

// Route-level code splitting: each page and the 3D editor load on demand
const AuthModal = lazy(() => import('./components/AuthModal').then((m) => ({ default: m.AuthModal })));
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })));
const CoursesPage = lazy(() => import('./pages/CoursesPage').then((m) => ({ default: m.CoursesPage })));
const LessonsPage = lazy(() => import('./pages/LessonsPage').then((m) => ({ default: m.LessonsPage })));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage').then((m) => ({ default: m.MarketplacePage })));
const MembershipPage = lazy(() => import('./pages/MembershipPage').then((m) => ({ default: m.MembershipPage })));
const AccountPage = lazy(() => import('./pages/AccountPage').then((m) => ({ default: m.AccountPage })));
const CreatorDashboardPage = lazy(() => import('./pages/CreatorDashboardPage').then((m) => ({ default: m.CreatorDashboardPage })));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const MyCoursesPage = lazy(() => import('./pages/MyCoursesPage').then((m) => ({ default: m.MyCoursesPage })));
const TheoryLearningPage = lazy(() => import('./pages/TheoryLearningPage').then((m) => ({ default: m.TheoryLearningPage })));
const Toolbar = lazy(() => import('./components/Toolbar').then((m) => ({ default: m.Toolbar })));
const ComponentLibrary = lazy(() => import('./components/ComponentLibrary').then((m) => ({ default: m.ComponentLibrary })));
const PropertyPanel = lazy(() => import('./components/PropertyPanel').then((m) => ({ default: m.PropertyPanel })));
const ValidationPanel = lazy(() => import('./components/ValidationPanel').then((m) => ({ default: m.ValidationPanel })));
const MinibotWidget = lazy(() => import('./components/MinibotWidget').then((m) => ({ default: m.MinibotWidget })));
const AIProposalModal = lazy(() => import('./components/AIProposalModal').then((m) => ({ default: m.AIProposalModal })));
const PresentationControls = lazy(() => import('./components/PresentationControls').then((m) => ({ default: m.PresentationControls })));
const ThreeScene = lazy(() => import('./scene/ThreeScene').then((m) => ({ default: m.ThreeScene })));

export const App: React.FC = () => {
  const { language, t } = useI18n();

  // 1. Navigation Route - Fully synchronized with browser URL (HTML5 History API)
  const [currentRoute, setCurrentRoute] = useState<RouteKey>(() => {
    return resolveRouteFromUrl().route;
  });
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'signup' | 'forgot'>('signin');

  // 2. Project Document & Command History
  const [project, setProject] = useState<ProjectDocument>(() => SAMPLE_PROJECTS[0]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const historyRef = useRef<CommandHistory>(new CommandHistory(SAMPLE_PROJECTS[0]));
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Autosave status
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [saveStatusText, setSaveStatusText] = useState('Đã lưu');
  const autosaveTimerRef = useRef<any>(null);

  // Snapshot of last saved project state (to detect dirty changes on exit)
  const lastSavedSnapshotRef = useRef<string>(JSON.stringify(SAMPLE_PROJECTS[0]));
  // Collapsible panels state for 3D workspace
  const deviceProfile = useDeviceProfile();
  // Phones and narrow tablets (portrait, Split View): two 320px panels would cover the canvas
  const isNarrowWorkspace = deviceProfile.device !== 'desktop' && deviceProfile.width < 900;
  const isPhone = isNarrowWorkspace;
  // They open the workspace with the canvas free; panels slide in on demand, one at a time.
  // Tablets in landscape and desktops keep both panels, as before.
  const [isLeftLibraryCollapsed, setIsLeftLibraryCollapsed] = useState(() => isNarrowWorkspace);
  const [isRightInspectorCollapsed, setIsRightInspectorCollapsed] = useState(() => isNarrowWorkspace);
  const openLibraryPanel = useCallback(() => {
    setIsLeftLibraryCollapsed(false);
    if (isNarrowWorkspace) setIsRightInspectorCollapsed(true);
  }, [isNarrowWorkspace]);
  const openInspectorPanel = useCallback(() => {
    setIsRightInspectorCollapsed(false);
    if (isNarrowWorkspace) setIsLeftLibraryCollapsed(true);
  }, [isNarrowWorkspace]);
  // Rotating to a narrow layout with both panels open: keep only the inspector
  useEffect(() => {
    if (isNarrowWorkspace && !isLeftLibraryCollapsed && !isRightInspectorCollapsed) setIsLeftLibraryCollapsed(true);
  }, [isNarrowWorkspace]); // eslint-disable-line react-hooks/exhaustive-deps
  const [placingComponentId, setPlacingComponentId] = useState<string | null>(null);
  // Unsaved changes exit confirmation modal
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);

  // Auth state
  const [currentUser, setCurrentUser] = useState<any>(null);
  // Protected routes wait for the stored session, so refreshing /projects does not bounce to the landing page
  const [isAuthRestored, setIsAuthRestored] = useState(false);
  useEffect(() => {
    let cancelled = false;
    authService.ready.finally(() => {
      if (!cancelled) setIsAuthRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  // Loaded on first use, then kept mounted so a half-filled form survives closing the dialog
  const authModalMountedRef = useRef(false);
  if (isAuthModalOpen) authModalMountedRef.current = true;

  // Active commercial course lab & theory classroom state
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [activePracticeItem, setActivePracticeItem] = useState<CourseSyllabusItem | null>(null);
  const [selectedMyCourseId, setSelectedMyCourseId] = useState<string | null>(null);
  const [activeTheoryContext, setActiveTheoryContext] = useState<{
    course: Course;
    lesson: CourseSyllabusItem;
  } | null>(null);

  // Concurrency Conflict State
  const [concurrencyConflict, setConcurrencyConflict] = useState<{
    isOpen: boolean;
    projectName: string;
    localRevision: number;
    remoteRevision: number;
  } | null>(null);

  const prevUserIdRef = useRef<string | null>(authService.getCurrentUser()?.id || null);

  useEffect(() => {
    const unsub = authService.onAuthStateChange((user, profile) => {
      const newUserId = user?.id || null;
      const oldUserId = prevUserIdRef.current;
      const userChanged = oldUserId !== newUserId;
      prevUserIdRef.current = newUserId;

      setCurrentUser(user);
      setCurrentProfile(profile);
      setSaveStatusText(projectRepositoryManager.isCloudMode() ? 'Đã lưu Cloud' : 'Đã lưu');

      if (user?.id) {
        localProjectRepository.setUserId(user.id);
      } else {
        localProjectRepository.setUserId(null);
      }

      if (userChanged) {
        if (user && !oldUserId) {
          // User just logged in: update authorId in active memory document,
          // but DO NOT auto-save into the user's database. The user's project list remains clean until they explicitly save.
          setProject((prev) => ({
            ...prev,
            authorId: user.id,
          }));
        } else if (!user || (oldUserId && user.id !== oldUserId)) {
          // Only reset when explicitly logging out or switching between distinct accounts
          const freshDoc = createDefaultProjectDocument('Mạch mới');
          if (user) freshDoc.authorId = user.id;
          historyRef.current.setDocument(freshDoc);
          setProject(freshDoc);
          setActiveProjectId(null);
          setActiveLesson(null);
          setActiveCourse(null);
          setSelectedComponentId(null);
          setSelectedConnectionId(null);
          setWiringStartPin(null);
          setIsWiringMode(false);
          setIsCutMode(false);
          setIsSimulating(false);
          setSimulationResult(null);
          setConcurrencyConflict(null);
          setCompletedLessonIds(courseService.getCompletedLessonIds());
          setActiveProposal(null);
          setAiMessages(minibotChatService.getMessages());
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsubChat = minibotChatService.subscribe(() => {
      setAiMessages(minibotChatService.getMessages());
    });
    return () => unsubChat();
  }, []);

  useEffect(() => {
    const unsubCourse = courseService.subscribe(() => {
      setCompletedLessonIds(courseService.getCompletedLessonIds());
    });
    return () => unsubCourse();
  }, []);

  // 3. Selection & Wiring State
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [isWiringMode, setIsWiringMode] = useState(false);
  const [activeWireColor, setActiveWireColor] = useState<string>('#06b6d4');
  const [isCutMode, setIsCutMode] = useState(false);
  const [wiringStartPin, setWiringStartPin] = useState<{
    componentId: string;
    pinId: string;
    worldPos: Vector3D;
  } | null>(null);

  // 4. Behavioral Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [switchStates, setSwitchStates] = useState<Record<string, boolean>>({});

  // 5. Validation Engine Issues
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);

  // 6. Presentation / Exploded View
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isExplodedView, setIsExplodedView] = useState(false);

  // 7. Graphics Quality & Grid
  // Phones with little memory start at Low (no shadows, no antialiasing); everything else as before
  const [qualityPreset, setQualityPreset] = useState<'low' | 'balanced' | 'high'>(() => {
    const memory = (navigator as any).deviceMemory as number | undefined;
    return deviceProfile.device === 'phone' && memory !== undefined && memory <= 3 ? 'low' : 'balanced';
  });
  const [showGrid, setShowGrid] = useState(true);

  // 8. AI Assistant & Minibot 3D
  const [minibotTargetCompId, setMinibotTargetCompId] = useState<string | null>(null);
  const [minibotState, setMinibotState] = useState<MinibotState>('idle');
  const [aiMessages, setAiMessages] = useState<AIChatMessage[]>(() => minibotChatService.getMessages());
  const [isAILoading, setIsAILoading] = useState(false);
  const [activeProposal, setActiveProposal] = useState<AIProposal | null>(null);

  // 9. Active Lesson Curriculum
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>(() => {
    return courseService.getCompletedLessonIds();
  });

  // Rename modal
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameInput, setRenameInput] = useState('');

  // Update History Status
  const syncHistoryState = useCallback(() => {
    setCanUndo(historyRef.current.canUndo);
    setCanRedo(historyRef.current.canRedo);
  }, []);

  // Update Project state with undo history recording
  const executeCommand = useCallback(
    (cmd: any) => {
      const newDoc = historyRef.current.execute(cmd);
      setProject(newDoc);
      syncHistoryState();
      triggerAutosave(newDoc);
    },
    [syncHistoryState]
  );

  const [isManualSaving, setIsManualSaving] = useState(false);
  const [manualSaveSuccess, setManualSaveSuccess] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Trigger Debounced Autosave
  const triggerAutosave = useCallback((doc: ProjectDocument) => {
    setIsAutosaving(true);
    setSaveStatusText('Đang lưu...');
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(async () => {
      const repo = projectRepositoryManager.getActiveRepository();
      const res = await repo.saveProject(doc);
      setIsAutosaving(false);

      if (res.conflict) {
        setSaveStatusText('⚠️ Xung đột phiên bản');
        setConcurrencyConflict({
          isOpen: true,
          projectName: doc.name,
          localRevision: doc.revision,
          remoteRevision: res.remoteRevision || doc.revision + 1,
        });
      } else if (res.success) {
        setSaveStatusText(projectRepositoryManager.isCloudMode() ? 'Đã lưu Cloud' : 'Đã lưu');
      } else {
        setSaveStatusText('Lỗi lưu');
      }
    }, 600);
  }, []);

  // Instant Explicit Manual Save (with instant tactile button state & toast confirmation)
  const handleManualSave = useCallback(async () => {
    if (isManualSaving) return;
    setIsManualSaving(true);
    setSaveStatusText(language === 'vi' ? 'Đang lưu vào Dự án...' : 'Saving to Projects...');

    try {
      const activeUser = authService.getCurrentUser() || currentUser;
      const effectiveAuthorId = activeUser?.id || project.authorId || 'guest';

      let targetProjectId = project.projectId;
      if (!targetProjectId || targetProjectId.startsWith('preview-')) {
        targetProjectId = `proj-${Date.now()}`;
      }

      const cleanName = project.name
        .replace(/^\[Xem thử\]\s*/, '')
        .replace(/^Bản xem trước:\s*/, '');

      const docToSave: ProjectDocument = {
        ...project,
        projectId: targetProjectId,
        name: cleanName,
        authorId: effectiveAuthorId,
        revision: (project.revision || 1) + 1,
        updatedAt: new Date().toISOString(),
      };

      if (activeUser?.id) {
        localProjectRepository.setUserId(activeUser.id);
      }

      const repo = projectRepositoryManager.getActiveRepository();
      const res = await repo.saveProject(docToSave, { force: true });

      if (repo !== localProjectRepository) {
        await localProjectRepository.saveProject(docToSave, { force: true });
      }

      setProject(docToSave);
      setActiveProjectId(targetProjectId);
      historyRef.current.setDocument(docToSave);

      if (res && res.success !== false) {
        lastSavedSnapshotRef.current = JSON.stringify({
          components: docToSave.components,
          connections: docToSave.connections,
          board: docToSave.board,
          name: docToSave.name,
        });
        setManualSaveSuccess(true);
        setSaveStatusText(projectRepositoryManager.isCloudMode() ? 'Đã lưu Cloud' : 'Đã lưu vào Dự án');
        setSaveToast(
          language === 'vi'
            ? `Đã lưu thành công "${docToSave.name}" vào Dự án của bạn!`
            : `Successfully saved "${docToSave.name}" to My Projects!`
        );
        setTimeout(() => setManualSaveSuccess(false), 3000);
        setTimeout(() => setSaveToast(null), 4000);
      } else {
        setSaveStatusText(language === 'vi' ? 'Lỗi lưu dự án' : 'Save Error');
      }
    } catch (err) {
      console.error('Lỗi khi lưu dự án thủ công:', err);
      setSaveStatusText(language === 'vi' ? 'Lỗi lưu dự án' : 'Save Error');
    } finally {
      setIsManualSaving(false);
    }
  }, [project, currentUser, language, isManualSaving]);

  const handleReloadRemoteConflict = async () => {
    if (!concurrencyConflict) return;
    const repo = projectRepositoryManager.getActiveRepository();
    const remote = await repo.getProject(project.projectId);
    if (remote) {
      setProject(remote);
      historyRef.current = new CommandHistory(remote);
      syncHistoryState();
      setSaveStatusText(projectRepositoryManager.isCloudMode() ? 'Đã lưu Cloud' : 'Đã lưu');
    }
    setConcurrencyConflict(null);
  };

  const handleSaveAsCopyConflict = async () => {
    if (!concurrencyConflict) return;
    const repo = projectRepositoryManager.getActiveRepository();
    const copy = await repo.duplicateProject(project.projectId);
    if (copy) {
      setProject(copy);
      historyRef.current = new CommandHistory(copy);
      syncHistoryState();
      setSaveStatusText(projectRepositoryManager.isCloudMode() ? 'Đã lưu Cloud' : 'Đã lưu');
    }
    setConcurrencyConflict(null);
  };

  const handleForceOverwriteConflict = async () => {
    if (!concurrencyConflict) return;
    const repo = projectRepositoryManager.getActiveRepository();
    await repo.saveProject(project, { force: true });
    setSaveStatusText(projectRepositoryManager.isCloudMode() ? 'Đã lưu Cloud' : 'Đã lưu');
    setConcurrencyConflict(null);
  };

  // Run Reactive Validation DRC
  useEffect(() => {
    const issues = validateProjectDocument(project);
    setValidationIssues(issues);

    if (issues.some((i: ValidationIssue) => i.severity === 'error')) {
      setMinibotState('warning');
    } else {
      setMinibotState('idle');
    }
  }, [project]);

  // Run or Update Simulation when simulating
  useEffect(() => {
    if (isSimulating) {
      const result = simulateBehavior(project, switchStates);
      setSimulationResult(result);

      if (result.issues.some((i) => i.toLowerCase().includes('đoản mạch'))) {
        setMinibotState('warning');
      } else if (result.isClosedLoop) {
        setMinibotState('success');
      }

      // Check Lesson goal completion
      if (activeLesson) {
        const evalResult = activeLesson.evaluate(project, result, switchStates);
        if (evalResult.isCompleted) {
          if (!completedLessonIds.includes(activeLesson.id)) {
            const cId = activeCourse?.id || 'course-intro-stem-3d';
            courseService.completeLesson(cId, activeLesson.id);
            const updated = courseService.getCompletedLessonIds();
            setCompletedLessonIds(updated);
            confetti({
              particleCount: 120,
              spread: 80,
              origin: { y: 0.6 },
            });
          }
        }
      }
    } else {
      setSimulationResult(null);
      setMinibotState('idle');
    }
  }, [isSimulating, project, switchStates, activeLesson, completedLessonIds]);

  // Undo / Redo
  const handleUndo = useCallback(() => {
    const prev = historyRef.current.undo();
    if (prev) {
      setProject(prev);
      syncHistoryState();
      triggerAutosave(prev);
    }
  }, [syncHistoryState, triggerAutosave]);

  const handleRedo = useCallback(() => {
    const next = historyRef.current.redo();
    if (next) {
      setProject(next);
      syncHistoryState();
      triggerAutosave(next);
    }
  }, [syncHistoryState, triggerAutosave]);

  // Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Delete, Esc, W, Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      const targetTag = (e.target as HTMLElement)?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleManualSave();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected();
      } else if (e.key === 'Escape') {
        setIsWiringMode(false);
        setWiringStartPin(null);
        setIsCutMode(false);
      } else if (e.key.toLowerCase() === 'w' && !e.ctrlKey && !e.metaKey) {
        setIsWiringMode((prev) => {
          const next = !prev;
          if (next) setIsCutMode(false);
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleManualSave]);

  // Component Management Actions
  const handleAddComponent = (def: ComponentDefinition) => {
    const countSameType = project.components.filter((c) => c.definitionId === def.definitionId).length;
    const instanceId = `${def.definitionId}-${countSameType + 1}`;

    const newComp: ComponentInstance = {
      instanceId,
      definitionId: def.definitionId,
      name: `${def.name} ${countSameType + 1}`,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      parameters: { ...def.defaultParameters },
      state: def.definitionId === 'switch' ? { open: false } : undefined,
    };

    const cmd = new AddComponentCommand(newComp);
    executeCommand(cmd);
    setSelectedComponentId(instanceId);
    setSelectedConnectionId(null);
    setPlacingComponentId(instanceId);
  };

  const handleMoveComponent = (id: string, oldPos: Vector3D, newPos: Vector3D) => {
    const cmd = new MoveComponentCommand(id, oldPos, newPos);
    executeCommand(cmd);
  };

  const handleRotateComponent = (id: string, angleDelta: number) => {
    const comp = project.components.find((c) => c.instanceId === id);
    if (!comp) return;
    const oldRot = comp.rotation.y;
    const newRot = (oldRot + angleDelta) % 360;
    const cmd = new RotateComponentCommand(
      id,
      { x: 0, y: oldRot, z: 0 },
      { x: 0, y: newRot, z: 0 }
    );
    executeCommand(cmd);
  };

  const handleDeleteSelected = () => {
    if (selectedComponentId) {
      const cmd = new DeleteComponentCommand(selectedComponentId);
      executeCommand(cmd);
      setSelectedComponentId(null);
    } else if (selectedConnectionId) {
      const cmd = new DeleteConnectionCommand(selectedConnectionId);
      executeCommand(cmd);
      setSelectedConnectionId(null);
    }
  };

  const handleStartWiring = (startPin: { componentId: string; pinId: string; worldPos: Vector3D }) => {
    setIsWiringMode(true);
    setWiringStartPin(startPin);
    setSelectedComponentId(null);
    setSelectedConnectionId(null);
  };

  const handleConnectPins = (fromCompId: string, fromPinId: string, toCompId: string, toPinId: string) => {
    // Use user-selected activeWireColor, or smart power/ground default if unchanged
    let wireColor = activeWireColor || '#06b6d4';
    if (activeWireColor === '#06b6d4') {
      if (fromPinId === 'vcc' || toPinId === 'vcc') wireColor = '#ef4444';
      if (fromPinId === 'gnd' || toPinId === 'gnd') wireColor = '#0f172a';
    }

    const newConn: Connection = {
      id: `conn-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      fromComponentId: fromCompId,
      fromPinId,
      toComponentId: toCompId,
      toPinId,
      wireColor,
      wireStyle: 'curved',
      thickness: 0.55,
      sag: 1.0,
    };

    const cmd = new CreateConnectionCommand(newConn);
    executeCommand(cmd);
    setIsWiringMode(false);
    setWiringStartPin(null);
    setSelectedConnectionId(newConn.id);
    setSelectedComponentId(null);
  };

  const handleUpdateWireColor = (id: string, color: string) => {
    const conn = project.connections.find((c) => c.id === id);
    if (!conn) return;
    const cmd = new UpdateConnectionCommand(id, { wireColor: conn.wireColor }, { wireColor: color });
    executeCommand(cmd);
  };

  const handleUpdateWireStyle = (id: string, style: WireStyle) => {
    const conn = project.connections.find((c) => c.id === id);
    if (!conn) return;
    const cmd = new UpdateConnectionCommand(id, { wireStyle: conn.wireStyle }, { wireStyle: style });
    executeCommand(cmd);
  };

  const handleUpdateWireThickness = (id: string, thickness: number) => {
    const conn = project.connections.find((c) => c.id === id);
    if (!conn) return;
    const cmd = new UpdateConnectionCommand(id, { thickness: conn.thickness }, { thickness });
    executeCommand(cmd);
  };

  const handleUpdateWireSag = (id: string, sag: number) => {
    const conn = project.connections.find((c) => c.id === id);
    if (!conn) return;
    const cmd = new UpdateConnectionCommand(id, { sag: conn.sag }, { sag });
    executeCommand(cmd);
  };

  // Board Size, Shape & Cutting Handlers
  const handleChangeBoardDimensions = (width: number, depth: number) => {
    const oldBoard = project.board;
    const newBoard: BoardDefinition = {
      ...oldBoard,
      width,
      depth,
      radius: oldBoard.shape === 'circle' ? width / 2 : oldBoard.radius,
    };
    if (areAllComponentsContained(project.components, newBoard).ok) {
      executeCommand(new ResizeBoardCommand(oldBoard, newBoard));
    } else {
      alert('Không thể thu nhỏ bo mạch: Một hoặc nhiều linh kiện sẽ bị rơi ra ngoài bo mạch!');
    }
  };

  const handleChangeBoardShape = (shape: BoardShape) => {
    const oldShape = project.board.shape || 'rectangle';
    if (oldShape === shape) return;
    const oldBoard = project.board;
    let newWidth = oldBoard.width;
    let newDepth = oldBoard.depth;
    if (shape === 'square') {
      const maxDim = Math.max(newWidth, newDepth);
      newWidth = maxDim;
      newDepth = maxDim;
    }
    const newBoard: BoardDefinition = {
      ...oldBoard,
      shape,
      width: newWidth,
      depth: newDepth,
      radius: shape === 'circle' ? newWidth / 2 : oldBoard.radius,
    };
    if (areAllComponentsContained(project.components, newBoard).ok) {
      executeCommand(new ChangeBoardShapeCommand(oldBoard, newBoard));
    } else {
      alert('Không thể chuyển đổi hình dạng bo mạch: Một hoặc nhiều linh kiện hiện tại sẽ nằm ngoài biên dạng mới!');
    }
  };

  const handleResizeBoard = (oldBoard: BoardDefinition, newBoard: BoardDefinition) => {
    if (areAllComponentsContained(project.components, newBoard).ok) {
      executeCommand(new ResizeBoardCommand(oldBoard, newBoard));
    } else {
      alert('Không thể thu nhỏ bo mạch: Các linh kiện phải nằm trọn vẹn trong bo mạch!');
    }
  };

  const handleCutPathComplete = (cutPath: Point2D[]) => {
    setIsCutMode(false);
    const perimeter = getBoardPerimeter(project.board);
    const splitResult = splitPolygonByCutPath(perimeter, cutPath);
    if (!splitResult) {
      alert('Đường cắt không hợp lệ hoặc không cắt qua đủ hai cạnh viền!');
      return;
    }

    const checkA = areAllComponentsContained(project.components, splitResult.regionA);
    const checkB = areAllComponentsContained(project.components, splitResult.regionB);

    let chosenOutline: Point2D[] | null = null;
    if (checkA.ok && !checkB.ok) {
      chosenOutline = splitResult.regionA;
    } else if (!checkA.ok && checkB.ok) {
      chosenOutline = splitResult.regionB;
    } else if (checkA.ok && checkB.ok) {
      chosenOutline =
        calculatePolygonArea(splitResult.regionA) >= calculatePolygonArea(splitResult.regionB)
          ? splitResult.regionA
          : splitResult.regionB;
    } else {
      alert('Không thể thực hiện cắt bo mạch: Đường cắt làm rơi linh kiện ra ngoài hoặc chia tách linh kiện!');
      return;
    }

    const oldBoard = project.board;
    const newBoard: BoardDefinition = {
      ...oldBoard,
      shape: 'polygon',
      outline: chosenOutline,
      cutHistory: [
        ...(oldBoard.cutHistory || []),
        { path: cutPath, timestamp: new Date().toISOString() },
      ],
    };
    executeCommand(new CutBoardCommand(oldBoard, newBoard));
  };

  const handleToggleSwitch = (instanceId: string) => {
    setSwitchStates((prev) => ({
      ...prev,
      [instanceId]: !prev[instanceId],
    }));
  };

  const handleFocusIssue = (compId?: string) => {
    if (compId) {
      setSelectedComponentId(compId);
      setSelectedConnectionId(null);
      setMinibotTargetCompId(compId);
      setMinibotState('warning');
    }
  };

  // AI Assistant Chat & Proposals
  const handleSendMessage = async (text: string) => {
    const userMsg: AIChatMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    await minibotChatService.addMessage(userMsg);
    setIsAILoading(true);
    setMinibotState('thinking');

    try {
      const historySnapshot = minibotChatService.getMessages();
      const practiceLabContext =
        activeCourse && activePracticeItem
          ? {
              courseTitle: activeCourse.title,
              lessonTitle: activePracticeItem.title,
              shortDescription:
                activePracticeItem.summary ||
                activePracticeItem.shortDescription ||
                activePracticeItem.desc,
              practiceSummary:
                activePracticeItem.practiceGuideSummary || activePracticeItem.practiceSummary,
              targetProject:
                activePracticeItem.practiceProject || activePracticeItem.practiceProjectSnapshot,
              practiceStages:
                activePracticeItem.practiceStages && activePracticeItem.practiceStages.length === 3
                  ? activePracticeItem.practiceStages
                  : activePracticeItem.practiceProject || activePracticeItem.practiceProjectSnapshot
                  ? buildDeterministicPracticeStages(
                      (activePracticeItem.practiceProject ||
                        activePracticeItem.practiceProjectSnapshot)!,
                      activePracticeItem.title,
                      activePracticeItem.summary ||
                        activePracticeItem.shortDescription ||
                        activePracticeItem.desc ||
                        ''
                    ).stages
                  : [],
            }
          : null;

      const result = await assistantService.askQuestion(text, historySnapshot, {
        document: project,
        selectedComponentId,
        validationIssues,
        simulationResult,
        lessonGoal: activeLesson?.goal,
        practiceContext: practiceLabContext,
        locale: language,
      });

      // AI output is untrusted: validate against the live document before any preview
      let replyText = result.text;
      let safeProposal: AIProposal | undefined;
      if (result.proposal) {
        const check = validateAIProposal(result.proposal, project);
        if (check.valid && check.proposal) {
          safeProposal = check.proposal as AIProposal;
          if (check.warnings.length > 0) {
            replyText += `\n\n⚠️ Lưu ý khi kiểm tra đề xuất:\n- ${check.warnings.join('\n- ')}`;
          }
        } else {
          replyText += `\n\n❌ Đề xuất không hợp lệ nên không được hiển thị/áp dụng:\n- ${check.errors.slice(0, 6).join('\n- ')}`;
        }
      }

      const botMsg: AIChatMessage = {
        id: `msg-b-${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: new Date().toISOString(),
        proposal: safeProposal,
      };

      await minibotChatService.addMessage(botMsg);
      paymentService.recordAiQuery();

      if (safeProposal) {
        setActiveProposal(safeProposal);
      }
      setMinibotState('idle');
    } catch (err) {
      console.error(err);
      setMinibotState('idle');
    } finally {
      setIsAILoading(false);
    }
  };

  const handleClearChat = async () => {
    await minibotChatService.clearChat();
    setActiveProposal(null);
  };

  // Apply AI Proposal atomically into project history
  const handleApplyProposal = (proposal: AIProposal) => {
    // Re-validate against the CURRENT document (it may have changed since the preview opened)
    const check = validateAIProposal(proposal, project);
    if (!check.valid || !check.proposal) {
      alert(`Không thể áp dụng đề xuất vì không còn hợp lệ với mạch hiện tại:\n- ${check.errors.slice(0, 6).join('\n- ')}`);
      return;
    }
    const safe = check.proposal;
    const commands: any[] = [];
    for (const comp of safe.componentsToAdd) {
      commands.push(new AddComponentCommand(comp));
    }
    for (const conn of safe.connectionsToAdd) {
      commands.push(new CreateConnectionCommand(conn));
    }

    // One BatchCommand = one Undo step; CommandHistory keeps the document untouched if it throws
    const before = historyRef.current.currentDocument;
    const batch = new BatchCommand(safe.explanation || 'Áp dụng đề xuất AI', commands);
    executeCommand(batch);
    setActiveProposal(null);
    if (historyRef.current.currentDocument === before) {
      alert('Áp dụng đề xuất thất bại; mạch được giữ nguyên.');
      return;
    }
    alert('Đề xuất thiết kế đã được áp dụng vào bo mạch! Nhấn Undo để hoàn tác toàn bộ đề xuất.');
  };

  // Open Project from Projects Page or Marketplace
  const handleOpenProject = async (doc: ProjectDocument) => {
    const activeUser = authService.getCurrentUser() || currentUser;
    if (activeUser?.id && (!doc.authorId || doc.authorId === 'guest' || doc.authorId === 'sample')) {
      doc.authorId = activeUser.id;
    }
    if (doc.projectId.startsWith('preview-')) {
      doc.projectId = `proj-${Date.now()}`;
    }

    setActiveProjectId(doc.projectId);
    historyRef.current = new CommandHistory(doc);
    setProject(doc);
    setSelectedComponentId(null);
    setSelectedConnectionId(null);
    setIsSimulating(false);
    setActiveLesson(null);
    syncHistoryState();

    // Determine whether opened project is a Course Practice Lab or a Real Personal Project
    const isLab =
      doc.metadata?.projectType === 'practice_lab' ||
      doc.projectType === 'practice_lab' ||
      Boolean(doc.metadata?.courseId) ||
      doc.name.startsWith('Thực hành:');

    if (isLab) {
      const allCourses = courseService.getCourses();
      const matchedCourse =
        (doc.metadata?.courseId && courseService.getCourseById(doc.metadata.courseId)) ||
        allCourses.find((c) => doc.name.includes(c.title)) ||
        allCourses[0];
      const matchedItem =
        (matchedCourse && doc.metadata?.lessonId && matchedCourse.syllabus.find((s) => s.id === doc.metadata?.lessonId)) ||
        matchedCourse?.syllabus.find((s) => s.sectionType === 'practice' || s.isPracticalLab) ||
        null;

      setActiveCourse(matchedCourse || null);
      setActivePracticeItem(matchedItem || null);
      if (matchedCourse) {
        setSelectedMyCourseId(matchedCourse.id);
        if (matchedItem) {
          // Reopened lab: the instructor's target circuit comes with the lesson content
          courseService
            .ensureCourseContent(matchedCourse.id)
            .then((full) => {
              const fullItem = full?.syllabus.find((s) => s.id === matchedItem.id);
              if (full && fullItem) {
                setActiveCourse(full);
                setActivePracticeItem(fullItem);
              }
            })
            .catch(() => undefined);
        }
      }
    } else {
      // Real Personal Project (Dự án cá nhân thật):
      // CRITICAL: Reset activeCourse & activePracticeItem so editor and bottom panel run in pure personal mode!
      setActiveCourse(null);
      setActivePracticeItem(null);
    }

    lastSavedSnapshotRef.current = JSON.stringify({
      components: doc.components,
      connections: doc.connections,
      board: doc.board,
      name: doc.name,
    });

    // Ensure the opened project is persisted into the active repository AND local repository
    try {
      const repo = projectRepositoryManager.getActiveRepository();
      await repo.saveProject(doc, { force: true });
      if (activeUser?.id) {
        localProjectRepository.setUserId(activeUser.id);
        await localProjectRepository.saveProject(doc, { force: true });
      }
      setSaveStatusText(projectRepositoryManager.isCloudMode() ? 'Đã lưu Cloud' : 'Đã lưu vào Dự án');
    } catch (err) {
      console.warn('Auto-save on open note:', err);
    }

    handleNavigate('editor', { projectId: doc.projectId });
  };

  // Lessons are loaded when opened: the server checks that this user may read them
  const loadCourseLesson = async (
    course: Course,
    lesson: CourseSyllabusItem
  ): Promise<{ course: Course; lesson: CourseSyllabusItem } | null> => {
    try {
      const full = (await courseService.ensureCourseContent(course.id)) || course;
      return { course: full, lesson: full.syllabus.find((item) => item.id === lesson.id) || lesson };
    } catch (err: any) {
      alert(
        err?.code === 'PAYMENT_REQUIRED'
          ? 'Bạn cần mua khóa học này để mở bài học.'
          : err?.message || 'Không thể tải nội dung khóa học. Vui lòng thử lại.'
      );
      return null;
    }
  };

  // Open Theory Classroom for a Course Lesson
  const handleOpenTheoryLesson = async (outlineCourse: Course, outlineLesson: CourseSyllabusItem) => {
    if (!currentUser) {
      setAuthModalTab('signin');
      setIsAuthModalOpen(true);
      return;
    }
    const loaded = await loadCourseLesson(outlineCourse, outlineLesson);
    if (!loaded) return;
    const { course, lesson } = loaded;
    setActiveCourse(course);
    setSelectedMyCourseId(course.id);
    setActiveTheoryContext({ course, lesson });
    handleNavigate('theory-learning');
  };

  // Start Practice Lab in 3D Workspace (always starts with an EMPTY workspace per Requirement 2.3)
  const handleStartPracticeLab = async (outlineCourse: Course, outlineItem: CourseSyllabusItem) => {
    if (!currentUser) {
      setAuthModalTab('signin');
      setIsAuthModalOpen(true);
      return;
    }
    const loaded = await loadCourseLesson(outlineCourse, outlineItem);
    if (!loaded) return;
    const { course, lesson: practiceItem } = loaded;

    // Create a completely empty 3D board workspace so the student builds the circuit across the 3 stages
    const emptyLabDoc = createDefaultProjectDocument(
      `Thực hành: ${practiceItem.title} (${course.title})`
    );
    emptyLabDoc.components = [];
    emptyLabDoc.connections = [];
    emptyLabDoc.projectType = 'practice_lab';
    emptyLabDoc.metadata = {
      ...emptyLabDoc.metadata,
      projectType: 'practice_lab',
      courseId: course.id,
      courseTitle: course.title,
      lessonId: practiceItem.id,
      lessonTitle: practiceItem.title,
    };
    if (currentUser?.id) {
      emptyLabDoc.authorId = currentUser.id;
    }

    setActiveProjectId(emptyLabDoc.projectId);
    historyRef.current = new CommandHistory(emptyLabDoc);
    setProject(emptyLabDoc);
    setActiveCourse(course);
    setActivePracticeItem(practiceItem);
    setSelectedMyCourseId(course.id);
    setActiveLesson(null);
    setSelectedComponentId(null);
    setSelectedConnectionId(null);
    setIsSimulating(false);
    syncHistoryState();

    lastSavedSnapshotRef.current = JSON.stringify({
      components: emptyLabDoc.components,
      connections: emptyLabDoc.connections,
      board: emptyLabDoc.board,
      name: emptyLabDoc.name,
    });

    try {
      const repo = projectRepositoryManager.getActiveRepository();
      await repo.saveProject(emptyLabDoc, { force: true });
      if (currentUser?.id) {
        await localProjectRepository.saveProject(emptyLabDoc, { force: true });
      }
      setSaveStatusText(projectRepositoryManager.isCloudMode() ? 'Đã lưu Cloud' : 'Đã lưu vào Dự án');
    } catch (err) {
      console.warn('Auto-save lab note:', err);
    }

    handleNavigate('editor', { projectId: emptyLabDoc.projectId });
  };

  // Start Commercial Course (from Courses catalog or Account page -> opens My Courses with Theory & Practice sections)
  const handleStartCourseLab = async (course: Course, labId?: string) => {
    if (!currentUser) {
      setAuthModalTab('signin');
      setIsAuthModalOpen(true);
      return;
    }

    setSelectedMyCourseId(course.id);

    // If a specific syllabus item ID was passed, open that Theory or Practice lesson directly
    if (labId) {
      const foundItem = (course.syllabus || []).find((s) => s.id === labId);
      if (foundItem) {
        if (foundItem.sectionType === 'theory' || (!foundItem.isLab && foundItem.sectionType !== 'practice')) {
          handleOpenTheoryLesson(course, foundItem);
          return;
        } else {
          await handleStartPracticeLab(course, foundItem);
          return;
        }
      }
    }

    // Otherwise navigate to "Khóa học của tôi" showing the 2 tabs: Lý thuyết & Thực hành
    handleNavigate('my-courses');
  };

  // Start Lesson (STEM Interactive Lab)
  const handleStartLesson = async (lesson: Lesson) => {
    const doc = lesson.createInitialProject();
    if (currentUser?.id) {
      doc.authorId = currentUser.id;
    }
    setActiveProjectId(doc.projectId);
    historyRef.current = new CommandHistory(doc);
    setProject(doc);
    setActiveLesson(lesson);
    setActiveCourse(null);
    setSelectedComponentId(null);
    setSelectedConnectionId(null);
    setIsSimulating(false);
    syncHistoryState();

    try {
      const repo = projectRepositoryManager.getActiveRepository();
      await repo.saveProject(doc, { force: true });
      if (currentUser?.id) {
        await localProjectRepository.saveProject(doc, { force: true });
      }
    } catch (err) {
      console.warn('Auto-save lesson note:', err);
    }

    handleNavigate('editor', { projectId: doc.projectId });
  };

  // Centralized Navigation Dispatcher
  const handleNavigate = useCallback(
    (target: RouteKey | string, options?: { projectId?: string | null; replace?: boolean }) => {
      let targetRoute: RouteKey = 'landing';
      let targetProjectId: string | null = options?.projectId ?? null;

      if (typeof target === 'string' && target.startsWith('/')) {
        const res = resolveRouteFromUrl(target);
        targetRoute = res.route;
        if (res.authIntent) {
          setAuthModalTab(res.authIntent);
          setIsAuthModalOpen(true);
        }
        if (res.projectId) {
          targetProjectId = res.projectId;
        }
      } else {
        targetRoute = target as RouteKey;
      }

      // Route Guards & Permissions
      // Callers may hold this callback from an earlier render, so also ask the auth service directly
      const signedInUser = currentUser || authService.getCurrentUser();
      if (targetRoute === 'admin') {
        const isAdmin = authService.isAdmin();
        if (!isAdmin) {
          if (!signedInUser) {
            setAuthModalTab('signin');
            setIsAuthModalOpen(true);
          } else {
            alert(language === 'vi' ? 'Bạn không có quyền truy cập bảng quản trị Admin.' : 'Administrator credentials required.');
          }
          return;
        }
      }

      if (targetRoute === 'creator') {
        if (!signedInUser) {
          setAuthModalTab('signin');
          setIsAuthModalOpen(true);
          return;
        }
        if (!paymentService.hasCreatorPlan()) {
          alert(
            language === 'vi'
              ? 'Khu vực này dành riêng cho tài khoản Nhà Sáng Tạo. Vui lòng đăng ký gói Creator để kích hoạt.'
              : 'Creator subscription plan required.'
          );
          handleNavigate('membership');
          return;
        }
      }

      if ((targetRoute === 'projects' || targetRoute === 'editor') && !signedInUser) {
        setAuthModalTab('signin');
        setIsAuthModalOpen(true);
        return;
      }

      // An explicit project id wins: callers may hold this callback from before their own state update
      if (targetRoute === 'editor' && !activeProjectId && !targetProjectId) {
        setActiveProjectId(project.projectId);
        targetProjectId = project.projectId;
      }

      setCurrentRoute(targetRoute);
      syncBrowserUrl(targetRoute, {
        replace: options?.replace,
        projectId: targetProjectId || (targetRoute === 'editor' ? activeProjectId : null),
        language,
      });

      if (targetRoute !== 'editor' && typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [currentUser, activeProjectId, project.projectId, language]
  );

  // Synchronize browser history (Back / Forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const res = resolveRouteFromUrl();
      if (res.authIntent) {
        setAuthModalTab(res.authIntent);
        setIsAuthModalOpen(true);
      }
      setCurrentRoute(res.route);
      if (res.projectId && res.projectId !== activeProjectId) {
        const repo = projectRepositoryManager.getActiveRepository();
        repo.getProject(res.projectId).then((loaded) => {
          if (loaded) {
            handleOpenProject(loaded);
          }
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeProjectId]);

  // Initial mount check for auth intents or deep-linked projects
  useEffect(() => {
    const initial = resolveRouteFromUrl();
    if (initial.authIntent) {
      setAuthModalTab(initial.authIntent);
      setIsAuthModalOpen(true);
    }
    if (initial.projectId && initial.projectId !== activeProjectId) {
      // The repository depends on the signed-in user, so wait for the stored session first
      authService.ready
        .catch(() => undefined)
        .then(() => projectRepositoryManager.getActiveRepository().getProject(initial.projectId!))
        .then((loaded) => {
          if (loaded) {
            handleOpenProject(loaded);
          } else {
            handleNavigate('projects', { replace: true });
          }
        })
        .catch(() => handleNavigate('projects', { replace: true }));
    }
  }, []);

  const handleProjectDeleted = (deletedId: string) => {
    if (activeProjectId === deletedId) {
      setActiveProjectId(null);
      if (currentRoute === 'editor') {
        handleNavigate('projects');
      }
    }
  };

  // Route protection: Editor 3D requires an activeProjectId. Without it, redirect to project selection.
  useEffect(() => {
    // A project id in the URL is being restored by the mount effect above (e.g. after pressing F5)
    if (currentRoute === 'editor' && !activeProjectId && !resolveRouteFromUrl().projectId) {
      handleNavigate('projects');
    }
  }, [currentRoute, activeProjectId, handleNavigate]);

  // Guest mode route protection: do not allow guests into 3D editor or personal projects
  useEffect(() => {
    if (isAuthRestored && !currentUser && (currentRoute === 'editor' || currentRoute === 'projects')) {
      handleNavigate('landing');
    }
  }, [isAuthRestored, currentUser, currentRoute, handleNavigate]);

  // Export JSON
  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}.circuitcraft.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON
  const handleImportJson = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed.board || !Array.isArray(parsed.components)) {
          alert('Tệp JSON không đúng định dạng CircuitCraft Project.');
          return;
        }
        handleOpenProject(parsed);
      } catch (err) {
        alert('Lỗi đọc tệp JSON.');
      }
    };
    input.click();
  };

  const selectedCompObj = project.components.find((c) => c.instanceId === selectedComponentId) || null;
  const selectedConnObj = project.connections.find((c) => c.id === selectedConnectionId) || null;

  return (
    <div data-has-bottom-nav={currentRoute !== 'editor' && currentRoute !== 'theory-learning' ? 'true' : 'false'} className="app-shell flex flex-col w-full overflow-hidden circuit-bg circuit-traces-overlay font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 relative">
      {/* 1. Global Navigation Bar (Hidden in 3D design / editor mode and Theory classroom to maximize workspace) */}
      {currentRoute !== 'editor' && currentRoute !== 'theory-learning' && (
        <Navbar
          currentRoute={currentRoute}
          onNavigate={handleNavigate}
          isAutosaving={isAutosaving}
          saveStatusText={saveStatusText}
          currentUser={currentUser}
          currentProfile={currentProfile}
          onOpenAuthModal={() => {
            setAuthModalTab('signin');
            setIsAuthModalOpen(true);
          }}
        />
      )}

      {/* 2. Main Content Route Switcher with Fluid Page Transitions */}
      <AnimatePresence mode="wait">
        {currentRoute === 'landing' && (
          <PageTransition routeKey="landing">
            <LandingPage
              onStartDesigning={() => {
                if (!currentUser) {
                  setAuthModalTab('signin');
                  setIsAuthModalOpen(true);
                } else {
                  handleNavigate('projects');
                }
              }}
              onExploreLessons={() => handleNavigate('courses')}
              onExploreMarketplace={() => handleNavigate('marketplace')}
              onNavigate={handleNavigate}
              onOpenProject={handleOpenProject}
              currentUser={currentUser}
            />
          </PageTransition>
        )}

        {currentRoute === 'projects' && (
          <PageTransition routeKey="projects">
            <ProjectsPage
              onOpenProject={handleOpenProject}
              onOpenAuthModal={() => {
                setAuthModalTab('signin');
                setIsAuthModalOpen(true);
              }}
              onProjectDeleted={handleProjectDeleted}
              activeProjectId={activeProjectId}
              currentUser={currentUser}
              currentProfile={currentProfile}
            />
          </PageTransition>
        )}

        {currentRoute === 'courses' && (
          <PageTransition routeKey="courses">
            <CoursesPage
              onStartCourseLab={handleStartCourseLab}
              onOpenMyCourses={(courseId) => {
                if (courseId) setSelectedMyCourseId(courseId);
                handleNavigate('my-courses');
              }}
              currentUser={currentUser}
              onOpenAuthModal={() => {
                setAuthModalTab('signin');
                setIsAuthModalOpen(true);
              }}
            />
          </PageTransition>
        )}

        {currentRoute === 'my-courses' && (
          <PageTransition routeKey="my-courses">
            <MyCoursesPage
              currentUser={currentUser}
              selectedCourseId={selectedMyCourseId}
              onSelectCourse={setSelectedMyCourseId}
              onOpenTheoryLesson={handleOpenTheoryLesson}
              onStartPracticeLab={handleStartPracticeLab}
              onExploreCatalog={() => handleNavigate('courses')}
            />
          </PageTransition>
        )}

        {currentRoute === 'theory-learning' && (
          <PageTransition routeKey="theory-learning">
            {activeTheoryContext ? (
              <LandscapeGate area="theory">
              <TheoryLearningPage
                course={activeTheoryContext.course}
                initialLesson={activeTheoryContext.lesson}
                currentUser={currentUser}
                onBackToMyCourse={() => {
                  setSelectedMyCourseId(activeTheoryContext.course.id);
                  handleNavigate('my-courses');
                }}
                onSwitchPracticeLab={handleStartPracticeLab}
              />
              </LandscapeGate>
            ) : (
              <MyCoursesPage
                currentUser={currentUser}
                selectedCourseId={selectedMyCourseId}
                onSelectCourse={setSelectedMyCourseId}
                onOpenTheoryLesson={handleOpenTheoryLesson}
                onStartPracticeLab={handleStartPracticeLab}
                onExploreCatalog={() => handleNavigate('courses')}
              />
            )}
          </PageTransition>
        )}

        {currentRoute === 'lessons' && (
          <PageTransition routeKey="lessons">
            <LessonsPage
              completedLessonIds={completedLessonIds}
              onStartLesson={handleStartLesson}
            />
          </PageTransition>
        )}

        {currentRoute === 'marketplace' && (
          <PageTransition routeKey="marketplace">
            <MarketplacePage
              onOpenProject={handleOpenProject}
              currentUser={currentUser}
              onOpenAuthModal={() => {
                setAuthModalTab('signin');
                setIsAuthModalOpen(true);
              }}
              onNavigate={handleNavigate}
            />
          </PageTransition>
        )}

        {currentRoute === 'membership' && (
          <PageTransition routeKey="membership">
            <MembershipPage
              onPlanUpdated={() => {}}
              currentUser={currentUser}
              onOpenAuthModal={() => {
                setAuthModalTab('signin');
                setIsAuthModalOpen(true);
              }}
            />
          </PageTransition>
        )}

        {currentRoute === 'account' && (
          <PageTransition routeKey="account">
            <AccountPage
              currentUser={currentUser}
              currentProfile={currentProfile}
              onOpenProject={handleOpenProject}
              onStartCourseLab={handleStartCourseLab}
              onNavigate={handleNavigate}
              onOpenAuthModal={() => {
                setAuthModalTab('signin');
                setIsAuthModalOpen(true);
              }}
            />
          </PageTransition>
        )}

        {currentRoute === 'creator' && (
          <PageTransition routeKey="creator">
            <CreatorDashboardPage
              currentUser={currentUser}
              currentProfile={currentProfile}
              currentProject={project}
              onOpenProject={handleOpenProject}
              onNavigate={handleNavigate}
              onOpenAuthModal={() => {
                setAuthModalTab('signin');
                setIsAuthModalOpen(true);
              }}
            />
          </PageTransition>
        )}

        {currentRoute === 'admin' && (
          <PageTransition routeKey="admin">
            <AdminDashboardPage
              currentUser={currentUser}
              onNavigate={handleNavigate}
              onOpenProject={handleOpenProject}
            />
          </PageTransition>
        )}

        {currentRoute === 'not-found' && (
          <PageTransition routeKey="not-found">
            <NotFoundPage
              currentPath={typeof window !== 'undefined' ? window.location.pathname : undefined}
              onNavigate={handleNavigate}
            />
          </PageTransition>
        )}
      </AnimatePresence>

      {currentRoute === 'editor' && (
        <Suspense fallback={<RouteFallback />}>
        <LandscapeGate area={activeCourse ? 'practice' : 'workspace'}>
        <div className="flex-1 flex flex-col overflow-hidden relative safe-x">
          {/* Active Course Guidance Banner */}
          {activeCourse && (
            <div className="h-10 short:h-8 px-4 short:px-2 bg-cyan-950/95 border-b border-cyan-500/40 text-cyan-200 text-xs flex items-center justify-between gap-2 z-20 shrink-0 shadow-md">
              <div className="flex items-center gap-2.5 truncate min-w-0">
                <span className="font-bold text-cyan-300 flex items-center gap-1.5 shrink-0">
                  <GraduationCap className="w-4 h-4 text-cyan-400" />
                  <span className="short:hidden">Đang thực hành Lab:</span>
                </span>
                <span className="truncate font-semibold text-white">
                  {activePracticeItem ? `${activePracticeItem.title} — ` : ''}
                  {activeCourse.title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const targetLessonId =
                      activePracticeItem?.id ||
                      activeCourse.syllabus.find(
                        (s) => s.sectionType === 'practice' || s.isLab
                      )?.id ||
                      activeCourse.syllabus[0]?.id;
                    if (targetLessonId) {
                      courseService.completeLesson(activeCourse.id, targetLessonId);
                    }
                    confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
                  }}
                  className="text-[11px] text-slate-950 font-bold px-2.5 py-1 coarse:py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 transition shadow-sm flex items-center gap-1 shrink-0"
                  title="Hoàn thành bài thực hành"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="short:hidden">Hoàn thành bài thực hành</span>
                  <span className="hidden short:inline">Hoàn thành</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedMyCourseId(activeCourse.id);
                    handleNavigate('my-courses');
                  }}
                  className="text-[11px] text-cyan-300 hover:text-white px-2.5 py-1 coarse:py-1.5 rounded-lg bg-cyan-900/50 hover:bg-cyan-900/80 border border-cyan-500/20 shrink-0"
                >
                  <span className="short:hidden">Về Khóa học của tôi</span>
                  <span className="hidden short:inline">Khóa học</span>
                </button>
              </div>
            </div>
          )}

          {/* Personal Project Banner (Dự án cá nhân - Không gian tự do) */}
          {!activeCourse && !activeLesson && !activePracticeItem && (
            <div className="h-9 short:hidden px-4 bg-slate-900/95 dark:bg-[#061224]/95 border-b border-slate-700/60 dark:border-cyan-900/50 text-slate-200 text-xs flex items-center justify-between z-20 shrink-0 shadow-xs">
              <div className="flex items-center gap-2.5 truncate">
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-bold text-[10px] flex items-center gap-1 shadow-xs">
                  <Cpu className="w-3 h-3 text-cyan-400" />
                  Dự án cá nhân
                </span>
                <span className="font-bold text-white truncate">
                  {project.name}
                </span>
                <span className="hidden md:inline text-slate-400 font-mono text-[11px]">
                  • Bo mạch: {project.board?.width || 80}×{project.board?.depth || 60}mm • {project.components?.length || 0} linh kiện • {project.connections?.length || 0} dây nối
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleNavigate('projects')}
                  className="text-[11px] text-cyan-300 hover:text-white px-2.5 py-1 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-500/30 transition flex items-center gap-1 cursor-pointer"
                >
                  <FolderOpen className="w-3 h-3" />
                  <span>Danh sách dự án</span>
                </button>
              </div>
            </div>
          )}

          {/* Active Lesson Guidance Banner */}
          {activeLesson && (
            <div className="h-9 px-4 bg-cyan-950/90 border-b border-cyan-500/40 text-cyan-200 text-xs flex items-center justify-between z-20 shrink-0">
              <div className="flex items-center gap-2 truncate">
                <span className="font-bold text-cyan-300">Đang thực hành bài học:</span>
                <span className="truncate">{activeLesson.title}</span>
                <span className="hidden sm:inline text-cyan-400 font-mono">({activeLesson.difficulty})</span>
              </div>
              <button
                onClick={() => setActiveLesson(null)}
                className="text-[11px] text-cyan-400 hover:text-white px-2 py-0.5 rounded bg-cyan-900/60"
              >
                Rời bài học
              </button>
            </div>
          )}

          {/* Editor Top Toolbar */}
          <Toolbar
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
            isSimulating={isSimulating}
            onToggleSimulation={() => setIsSimulating(!isSimulating)}
            isWiringMode={isWiringMode}
            onToggleWiringMode={() => {
              const nextWiring = !isWiringMode;
              setIsWiringMode(nextWiring);
              setWiringStartPin(null);
              if (nextWiring) {
                setIsCutMode(false);
                setSelectedComponentId(null);
                setSelectedConnectionId(null);
              }
            }}
            activeWireColor={activeWireColor}
            onChangeWireColor={setActiveWireColor}
            isCutMode={isCutMode}
            onToggleCutMode={() => {
              const nextCut = !isCutMode;
              setIsCutMode(nextCut);
              if (nextCut) {
                setIsWiringMode(false);
                setWiringStartPin(null);
                setSelectedComponentId(null);
                setSelectedConnectionId(null);
              }
            }}
            onSave={handleManualSave}
            isSaving={isManualSaving || isAutosaving}
            saveSuccess={manualSaveSuccess}
            onExportJson={handleExportJson}
            onImportJson={handleImportJson}
            hasSelection={Boolean(selectedComponentId || selectedConnectionId)}
            onDeleteSelected={handleDeleteSelected}
            isPresentationMode={isPresentationMode}
            onTogglePresentation={() => setIsPresentationMode(!isPresentationMode)}
            qualityPreset={qualityPreset}
            onChangeQuality={setQualityPreset}
            showGrid={showGrid}
            onToggleGrid={() => setShowGrid(!showGrid)}
            projectName={project.name}
            onRenameProject={() => {
              setRenameInput(project.name);
              setIsRenameOpen(true);
            }}
            onBackToProjectSelect={() => {
              // Check if project has unsaved changes compared to lastSavedSnapshotRef
              const currentSnapshot = JSON.stringify({
                components: project.components,
                connections: project.connections,
                board: project.board,
                name: project.name,
              });

              const isDirty = currentSnapshot !== lastSavedSnapshotRef.current;
              if (isDirty) {
                setIsExitConfirmOpen(true);
              } else {
                handleNavigate('projects');
              }
            }}
            isLeftLibraryCollapsed={isLeftLibraryCollapsed}
            onToggleLeftLibrary={() => (isLeftLibraryCollapsed ? openLibraryPanel() : setIsLeftLibraryCollapsed(true))}
            isRightInspectorCollapsed={isRightInspectorCollapsed}
            onToggleRightInspector={() => (isRightInspectorCollapsed ? openInspectorPanel() : setIsRightInspectorCollapsed(true))}
          />

          {/* Middle 3D Viewport with Floating Overlays */}
          <div className="flex-1 relative overflow-hidden">
            {/* Center Three.js 3D Canvas (Full width & height, never displaced by floating panels) */}
            <main className="w-full h-full relative overflow-hidden">
              <ThreeScene
                document={project}
                selectedComponentId={selectedComponentId}
                selectedConnectionId={selectedConnectionId}
                onSelectComponent={(id) => {
                  setSelectedComponentId(id);
                  if (id) {
                    setMinibotTargetCompId(id);
                    setMinibotState('guiding');
                  }
                }}
                onSelectConnection={setSelectedConnectionId}
                onMoveComponent={handleMoveComponent}
                onConnectPins={handleConnectPins}
                onToggleSwitch={handleToggleSwitch}
                isWiringMode={isWiringMode}
                wiringStartPin={wiringStartPin}
                onStartWiring={handleStartWiring}
                onCancelWiring={() => {
                  setIsWiringMode(false);
                  setWiringStartPin(null);
                }}
                isCutMode={isCutMode}
                onCutPathComplete={handleCutPathComplete}
                onCancelCutMode={() => setIsCutMode(false)}
                onResizeBoard={handleResizeBoard}
                simulationResult={simulationResult}
                switchStates={switchStates}
                isPresentationMode={isPresentationMode}
                isExplodedView={isExplodedView}
                minibotTargetCompId={minibotTargetCompId}
                minibotState={minibotState}
                qualityPreset={qualityPreset}
                showGrid={showGrid}
                activeWireColor={activeWireColor}
                isRightInspectorCollapsed={isRightInspectorCollapsed}
                onToggleRightInspector={() => (isRightInspectorCollapsed ? openInspectorPanel() : setIsRightInspectorCollapsed(true))}
                onLongPressComponent={(id) => {
                  // Touch: press and hold a part to edit it
                  setSelectedComponentId(id);
                  setSelectedConnectionId(null);
                  openInspectorPanel();
                }}
                placingComponentId={placingComponentId}
                onPlacedComponent={() => setPlacingComponentId(null)}
              />

              {/* Floating Presentation Controls */}
              {isPresentationMode && (
                <PresentationControls
                  isExplodedView={isExplodedView}
                  onToggleExplodedView={() => setIsExplodedView(!isExplodedView)}
                  onExitPresentation={() => {
                    setIsPresentationMode(false);
                    setIsExplodedView(false);
                  }}
                />
              )}
            </main>

            {/* Left Component Library Floating Panel (Hidden in presentation mode or when collapsed) */}
            {!isPresentationMode && (
              <ComponentLibrary
                onAddComponent={(defId) => {
                  handleAddComponent(defId);
                  // On a phone the library would cover where the part is being placed
                  if (isPhone) setIsLeftLibraryCollapsed(true);
                }}
                isCollapsed={isLeftLibraryCollapsed}
                onToggleCollapse={() => setIsLeftLibraryCollapsed(true)}
              />
            )}

            {/* Floating Reopen Button for Left Library when collapsed */}
            {!isPresentationMode && isLeftLibraryCollapsed && (
              <div className="absolute top-4 left-4 short:top-2 short:left-2 z-20 flex items-center bg-white/85 dark:bg-slate-900/80 backdrop-blur-md p-1.5 short:p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-lg text-xs">
                <button
                  onClick={openLibraryPanel}
                  className="touch-target flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/70 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800/60 font-semibold transition cursor-pointer hover:border-cyan-400 hover:scale-105 active:scale-95 shadow-xs"
                  title={language === 'vi' ? 'Mở Thư viện linh kiện' : 'Open Component Library'}
                >
                  <PanelLeftOpen className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span className="font-semibold short:hidden">
                    {language === 'vi' ? 'Thư viện linh kiện' : 'Component Library'}
                  </span>
                  <span className="font-semibold hidden short:inline">{language === 'vi' ? 'Linh kiện' : 'Parts'}</span>
                </button>
              </div>
            )}

            {/* Floating Reopen Button for Right Inspector when collapsed */}
            {!isPresentationMode && isRightInspectorCollapsed && (
              <div className="absolute top-4 right-4 short:top-2 short:right-2 z-20 flex items-center bg-white/85 dark:bg-slate-900/80 backdrop-blur-md p-1.5 short:p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-lg text-xs">
                <button
                  onClick={openInspectorPanel}
                  className="touch-target flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/70 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800/60 font-semibold transition cursor-pointer hover:border-cyan-400 hover:scale-105 active:scale-95 shadow-xs"
                  title={language === 'vi' ? 'Mở Thông tin & chỉ số' : 'Open Info & Parameters'}
                >
                  <span className="font-semibold short:hidden">
                    {language === 'vi' ? 'Thông tin & chỉ số' : 'Info & Parameters'}
                  </span>
                  <span className="font-semibold hidden short:inline">{language === 'vi' ? 'Thuộc tính' : 'Properties'}</span>
                  <PanelRightOpen className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                </button>
              </div>
            )}

            {/* Right Property Panel (Hidden in presentation mode or when collapsed) */}
            {!isPresentationMode && (
              <PropertyPanel
                selectedComponent={selectedCompObj}
                selectedConnection={selectedConnObj}
                board={project.board}
                componentsCount={project.components.length}
                connectionsCount={project.connections.length}
                isCollapsed={isRightInspectorCollapsed}
                onToggleCollapse={() => setIsRightInspectorCollapsed(true)}
                onChangeBoardShape={handleChangeBoardShape}
                onChangeBoardDimensions={handleChangeBoardDimensions}
                onUpdateComponentParams={(id, params) => {
                  const comp = project.components.find((c) => c.instanceId === id);
                  if (!comp) return;
                  // Design changes go through the command engine so they can be undone
                  const before = comp.parameters || {};
                  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(params)]));
                  const changes = keys
                    .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(params[k]))
                    .map((k) => new UpdateComponentParameterCommand(id, k, before[k], params[k]));
                  if (changes.length === 0) return;
                  executeCommand(changes.length === 1 ? changes[0] : new BatchCommand(`Đổi thông số ${comp.name}`, changes));
                }}
                onUpdateComponentName={(id, name) => {
                  const comp = project.components.find((c) => c.instanceId === id);
                  if (!comp || comp.name === name) return;
                  executeCommand(new RenameComponentCommand(id, comp.name, name));
                }}
                onRotateComponent={handleRotateComponent}
                onDeleteComponent={(id) => {
                  setSelectedComponentId(id);
                  handleDeleteSelected();
                }}
                onDeleteConnection={(id) => {
                  setSelectedConnectionId(id);
                  handleDeleteSelected();
                }}
                onUpdateWireColor={handleUpdateWireColor}
                onUpdateWireStyle={handleUpdateWireStyle}
                onUpdateWireThickness={handleUpdateWireThickness}
                onUpdateWireSag={handleUpdateWireSag}
                onUpdateBoardColor={(colorHex) => {
                  if (project.board.solderMaskColor === colorHex) return;
                  executeCommand(
                    new UpdateProjectFieldsCommand('Đổi màu bo mạch', { solderMaskColor: project.board.solderMaskColor }, { solderMaskColor: colorHex })
                  );
                }}
              />
            )}
          </div>

          {/* Bottom Validation, Simulation & Practice Lab Panel (Hidden in presentation mode) */}
          {!isPresentationMode && (
            <ValidationPanel
              issues={validationIssues}
              simulationResult={simulationResult}
              onFocusIssue={handleFocusIssue}
              practiceContext={
                activeCourse && activePracticeItem
                  ? {
                      course: activeCourse,
                      practiceItem: activePracticeItem,
                      studentProject: project,
                      isSimulating,
                      isLessonCompleted: Boolean(
                        courseService
                          .getEnrollment(activeCourse.id)
                          ?.completedLessons?.includes(activePracticeItem.id)
                      ),
                      onCompletePractice: () => {
                        courseService.completeLesson(activeCourse.id, activePracticeItem.id);
                        confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
                      },
                      onBackToMyCourses: () => {
                        setSelectedMyCourseId(activeCourse.id);
                        handleNavigate('my-courses');
                      },
                      onAskAIAboutStage: (promptText) => {
                        handleSendMessage(promptText);
                      },
                    }
                  : null
              }
            />
          )}

          {/* Floating Minibot AI Chat Widget (Hidden in presentation mode) */}
          {!isPresentationMode && (
            <MinibotWidget
              messages={aiMessages}
              onSendMessage={handleSendMessage}
              isLoading={isAILoading}
              onOpenProposal={(prop) => setActiveProposal(prop)}
              activeProposal={activeProposal}
              onClearChat={handleClearChat}
              userEmail={currentUser?.email || null}
            />
          )}

          {/* AI Proposal Review Modal */}
          {activeProposal && (
            <AIProposalModal
              proposal={activeProposal}
              onClose={() => setActiveProposal(null)}
              onApply={handleApplyProposal}
            />
          )}

          {/* Rename Project Modal */}
          {isRenameOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Đổi tên dự án</h4>
                <input
                  type="text"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsRenameOpen(false)}
                    className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => {
                      if (renameInput.trim() && renameInput.trim() !== project.name) {
                        executeCommand(new UpdateProjectFieldsCommand('Đổi tên dự án', { name: project.name }, { name: renameInput.trim() }));
                      }
                      setIsRenameOpen(false);
                    }}
                    className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white cursor-pointer"
                  >
                    Lưu tên
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Unsaved Changes Exit Confirmation Modal (Lưu, Không lưu, Hủy bỏ) */}
          {isExitConfirmOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-md bg-white dark:bg-[#0c1424] border border-[#d7e7f0] dark:border-cyan-900/60 rounded-2xl p-6 space-y-4 shadow-2xl">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/30">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {language === 'vi' ? 'Dự án có thay đổi chưa lưu' : 'Unsaved Project Changes'}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {language === 'vi'
                        ? `Dự án "${project.name}" đã được chỉnh sửa nhưng chưa được lưu lại. Bạn có muốn lưu các thay đổi này trước khi thoát không?`
                        : `Project "${project.name}" has unsaved modifications. Do you want to save before exiting?`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  {/* Hủy bỏ button */}
                  <button
                    onClick={() => setIsExitConfirmOpen(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    {language === 'vi' ? 'Hủy bỏ' : 'Cancel'}
                  </button>

                  {/* Không lưu button */}
                  <button
                    onClick={() => {
                      setIsExitConfirmOpen(false);
                      handleNavigate('projects');
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 transition cursor-pointer"
                  >
                    {language === 'vi' ? 'Không lưu' : 'Don’t Save'}
                  </button>

                  {/* Lưu button */}
                  <button
                    onClick={async () => {
                      try {
                        await handleManualSave();
                      } catch {}
                      setIsExitConfirmOpen(false);
                      handleNavigate('projects');
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/25 transition cursor-pointer"
                  >
                    {language === 'vi' ? 'Lưu' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        </LandscapeGate>
        </Suspense>
      )}

      {/* Mobile Bottom Navigation Bar (Phones / Small Screens) */}
      <MobileBottomNav
        currentRoute={currentRoute}
        onNavigate={handleNavigate}
        currentUser={currentUser}
        onOpenAuthModal={() => {
          setAuthModalTab('signin');
          setIsAuthModalOpen(true);
        }}
      />

      {/* Global Auth Modal */}
      {authModalMountedRef.current && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen={isAuthModalOpen}
            initialTab={authModalTab}
            onClose={() => {
              setIsAuthModalOpen(false);
              // If user landed on an auth route like /login, sync address bar cleanly
              if (typeof window !== 'undefined') {
                const p = window.location.pathname.toLowerCase();
                if (p === '/login' || p === '/register' || p === '/forgot-password' || p === '/signin' || p === '/signup') {
                  syncBrowserUrl(currentRoute);
                }
              }
            }}
            currentUser={currentUser}
            currentProfile={currentProfile}
            onSuccess={() => {
              setSaveStatusText(projectRepositoryManager.isCloudMode() ? 'Đã lưu Cloud' : 'Đã lưu');
            }}
          />
        </Suspense>
      )}

      {concurrencyConflict && (
        <ConcurrencyConflictModal
          isOpen={concurrencyConflict.isOpen}
          projectName={concurrencyConflict.projectName}
          localRevision={concurrencyConflict.localRevision}
          remoteRevision={concurrencyConflict.remoteRevision}
          onReloadRemote={handleReloadRemoteConflict}
          onSaveAsCopy={handleSaveAsCopyConflict}
          onForceOverwrite={handleForceOverwriteConflict}
          onCancel={() => setConcurrencyConflict(null)}
        />
      )}

      {/* Floating Save Success Toast Notification */}
      {saveToast && (
        <div className="fixed top-20 right-8 z-50 flex items-center gap-3 px-4 py-3 bg-white/95 dark:bg-[#071629]/95 border-2 border-emerald-400 dark:border-emerald-500 rounded-2xl shadow-[0_12px_36px_rgba(16,185,129,0.35)] backdrop-blur-xl animate-in slide-in-from-top-4 duration-300 pointer-events-none">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 stroke-[2.5]" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-slate-900 dark:text-white">
              {language === 'vi' ? 'Đã lưu vào Dự án của tôi!' : 'Saved to My Projects!'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {saveToast}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
