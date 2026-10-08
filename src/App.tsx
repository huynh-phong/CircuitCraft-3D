import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { MinibotState } from './scene/minibot3D';
import { calculatePinWorldPosition } from './domain/project/coordinates';
import { COMPONENT_DEFINITION_MAP } from './domain/components/definitions';

// UI Components
import { Navbar } from './components/Navbar';
import { Toolbar } from './components/Toolbar';
import { ComponentLibrary } from './components/ComponentLibrary';
import { PropertyPanel } from './components/PropertyPanel';
import { ValidationPanel } from './components/ValidationPanel';
import { MinibotWidget } from './components/MinibotWidget';
import { AIProposalModal } from './components/AIProposalModal';
import { PresentationControls } from './components/PresentationControls';
import { ThreeScene } from './scene/ThreeScene';
import { AuthModal } from './components/AuthModal';
import { ConcurrencyConflictModal } from './components/ConcurrencyConflictModal';

// Pages
import { LandingPage } from './pages/LandingPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { CoursesPage } from './pages/CoursesPage';
import { LessonsPage } from './pages/LessonsPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { MembershipPage } from './pages/MembershipPage';
import { AccountPage } from './pages/AccountPage';
import { CreatorDashboardPage } from './pages/CreatorDashboardPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { MobileBottomNav } from './components/MobileBottomNav';
import { RouteKey, resolveRouteFromUrl, syncBrowserUrl } from './router/routes';

import { Course } from './domain/courses/types';
import { courseService } from './domain/courses/courseService';
import { GraduationCap, CheckCircle2 } from 'lucide-react';
import { useI18n } from './i18n/context';

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

  // Auth state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Active commercial course lab
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);

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
  const [qualityPreset, setQualityPreset] = useState<'low' | 'balanced' | 'high'>('balanced');
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
            alert(`🎉 Chúc mừng! Bạn đã hoàn thành xuất sắc bài học: "${activeLesson.title}"!`);
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
      position: { x: (Math.random() - 0.5) * 40, y: 0, z: (Math.random() - 0.5) * 30 },
      rotation: { x: 0, y: 0, z: 0 },
      parameters: { ...def.defaultParameters },
      state: def.definitionId === 'switch' ? { open: false } : undefined,
    };

    const cmd = new AddComponentCommand(newComp);
    executeCommand(cmd);
    setSelectedComponentId(instanceId);
    setSelectedConnectionId(null);
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
      const result = await assistantService.askQuestion(text, historySnapshot, {
        document: project,
        selectedComponentId,
        validationIssues,
        lessonGoal: activeLesson?.goal,
        locale: language,
      });

      const botMsg: AIChatMessage = {
        id: `msg-b-${Date.now()}`,
        role: 'assistant',
        content: result.text,
        timestamp: new Date().toISOString(),
        proposal: result.proposal,
      };

      await minibotChatService.addMessage(botMsg);
      paymentService.recordAiQuery();

      if (result.proposal) {
        setActiveProposal(result.proposal);
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
    const commands: any[] = [];
    for (const comp of proposal.componentsToAdd) {
      commands.push(new AddComponentCommand(comp));
    }
    for (const conn of proposal.connectionsToAdd) {
      commands.push(new CreateConnectionCommand(conn));
    }

    const batch = new BatchCommand(proposal.explanation, commands);
    executeCommand(batch);
    setActiveProposal(null);
    alert('Đề xuất thiết kế của AI đã được áp dụng thành công vào bo mạch!');
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

  // Start Commercial Course Lab
  const handleStartCourseLab = async (course: Course, labId?: string) => {
    if (!currentUser) {
      setAuthModalTab('signin');
      setIsAuthModalOpen(true);
      return;
    }
    const doc = course.createLabProject
      ? course.createLabProject(labId)
      : createDefaultProjectDocument(`Thực hành: ${course.title}`);
    if (currentUser?.id) {
      doc.authorId = currentUser.id;
    }
    setActiveProjectId(doc.projectId);
    historyRef.current = new CommandHistory(doc);
    setProject(doc);
    setActiveCourse(course);
    setActiveLesson(null);
    setSelectedComponentId(null);
    setSelectedConnectionId(null);
    setIsSimulating(false);
    syncHistoryState();

    // Immediately persist into repository so user can see it in "Dự án của tôi"
    try {
      const repo = projectRepositoryManager.getActiveRepository();
      await repo.saveProject(doc, { force: true });
      if (currentUser?.id) {
        await localProjectRepository.saveProject(doc, { force: true });
      }
      setSaveStatusText(projectRepositoryManager.isCloudMode() ? 'Đã lưu Cloud' : 'Đã lưu vào Dự án');
    } catch (err) {
      console.warn('Auto-save lab note:', err);
    }

    handleNavigate('editor', { projectId: doc.projectId });
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
      if (targetRoute === 'admin') {
        const isAdmin = authService.isAdmin();
        if (!isAdmin) {
          if (!currentUser) {
            setAuthModalTab('signin');
            setIsAuthModalOpen(true);
          } else {
            alert(language === 'vi' ? 'Bạn không có quyền truy cập bảng quản trị Admin.' : 'Administrator credentials required.');
          }
          return;
        }
      }

      if (targetRoute === 'creator') {
        if (!currentUser) {
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

      if ((targetRoute === 'projects' || targetRoute === 'editor') && !currentUser) {
        setAuthModalTab('signin');
        setIsAuthModalOpen(true);
        return;
      }

      if (targetRoute === 'editor' && !activeProjectId) {
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
      const repo = projectRepositoryManager.getActiveRepository();
      repo.getProject(initial.projectId).then((loaded) => {
        if (loaded) {
          handleOpenProject(loaded);
        }
      });
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
    if (currentRoute === 'editor' && !activeProjectId) {
      handleNavigate('projects');
    }
  }, [currentRoute, activeProjectId, handleNavigate]);

  // Guest mode route protection: do not allow guests into 3D editor or personal projects
  useEffect(() => {
    if (!currentUser && (currentRoute === 'editor' || currentRoute === 'projects')) {
      handleNavigate('landing');
    }
  }, [currentUser, currentRoute, handleNavigate]);

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
    <div className="flex flex-col w-screen h-screen overflow-hidden circuit-bg circuit-traces-overlay font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 relative">
      {/* 1. Global Navigation Bar */}
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

      {/* 2. Main Content Route Switcher */}
      {currentRoute === 'landing' && (
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
        />
      )}

      {currentRoute === 'projects' && (
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
      )}

      {currentRoute === 'courses' && (
        <CoursesPage
          onStartCourseLab={handleStartCourseLab}
          currentUser={currentUser}
          onOpenAuthModal={() => {
            setAuthModalTab('signin');
            setIsAuthModalOpen(true);
          }}
        />
      )}

      {currentRoute === 'lessons' && (
        <LessonsPage
          completedLessonIds={completedLessonIds}
          onStartLesson={handleStartLesson}
        />
      )}

      {currentRoute === 'marketplace' && (
        <MarketplacePage
          onOpenProject={handleOpenProject}
          currentUser={currentUser}
          onOpenAuthModal={() => {
            setAuthModalTab('signin');
            setIsAuthModalOpen(true);
          }}
          onNavigate={handleNavigate}
        />
      )}

      {currentRoute === 'membership' && (
        <MembershipPage
          onPlanUpdated={() => {}}
          currentUser={currentUser}
          onOpenAuthModal={() => {
            setAuthModalTab('signin');
            setIsAuthModalOpen(true);
          }}
        />
      )}

      {currentRoute === 'account' && (
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
      )}

      {currentRoute === 'creator' && (
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
      )}

      {currentRoute === 'admin' && (
        <AdminDashboardPage
          currentUser={currentUser}
          onNavigate={handleNavigate}
          onOpenProject={handleOpenProject}
        />
      )}

      {currentRoute === 'not-found' && (
        <NotFoundPage
          currentPath={typeof window !== 'undefined' ? window.location.pathname : undefined}
          onNavigate={handleNavigate}
        />
      )}

      {currentRoute === 'editor' && (
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Active Course Guidance Banner */}
          {activeCourse && (
            <div className="h-10 px-4 bg-cyan-950/95 border-b border-cyan-500/40 text-cyan-200 text-xs flex items-center justify-between z-20 shrink-0 shadow-md">
              <div className="flex items-center gap-2.5 truncate">
                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-cyan-400" />
                  Đang thực hành khóa học:
                </span>
                <span className="truncate font-semibold text-white">{activeCourse.title}</span>
                <span className="hidden sm:inline text-cyan-400 font-mono text-[11px] px-2 py-0.5 rounded bg-cyan-900/60 border border-cyan-500/30">
                  {activeCourse.level}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const enrollment = courseService.getEnrollment(activeCourse.id);
                    const firstUnfinished = activeCourse.syllabus.find(
                      (s) => !enrollment?.completedLessons.includes(s.id)
                    ) || activeCourse.syllabus[0];
                    if (firstUnfinished) {
                      courseService.completeLesson(activeCourse.id, firstUnfinished.id);
                    }
                    alert(`Chúc mừng! Bạn đã hoàn thành một bài thực hành trong khóa "${activeCourse.title}". Tiến độ đã được ghi nhận vào Hồ sơ cá nhân của bạn.`);
                  }}
                  className="text-[11px] text-slate-950 font-bold px-2.5 py-1 rounded-lg bg-emerald-400 hover:bg-emerald-300 transition shadow-sm flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Hoàn thành bài tập</span>
                </button>
                <button
                  onClick={() => {
                    setActiveCourse(null);
                    handleNavigate('courses');
                  }}
                  className="text-[11px] text-cyan-300 hover:text-white px-2.5 py-1 rounded-lg bg-cyan-900/50 hover:bg-cyan-900/80 border border-cyan-500/20"
                >
                  Rời phòng thực hành
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
            onBackToProjectSelect={async () => {
              try {
                const repo = projectRepositoryManager.getActiveRepository();
                await repo.saveProject(project, { force: true });
              } catch {}
              handleNavigate('projects');
            }}
          />

          {/* Middle 3D Viewport with Sidebars */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Left Component Library (Hidden in presentation mode) */}
            {!isPresentationMode && <ComponentLibrary onAddComponent={handleAddComponent} />}

            {/* Center Three.js 3D Canvas */}
            <main className="flex-1 relative overflow-hidden">
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

            {/* Right Property Panel (Hidden in presentation mode) */}
            {!isPresentationMode && (
              <PropertyPanel
                selectedComponent={selectedCompObj}
                selectedConnection={selectedConnObj}
                board={project.board}
                componentsCount={project.components.length}
                connectionsCount={project.connections.length}
                onChangeBoardShape={handleChangeBoardShape}
                onChangeBoardDimensions={handleChangeBoardDimensions}
                onUpdateComponentParams={(id, params) => {
                  const comp = project.components.find((c) => c.instanceId === id);
                  if (!comp) return;
                  const updated: ComponentInstance = { ...comp, parameters: params };
                  const newDoc = {
                    ...project,
                    components: project.components.map((c) => (c.instanceId === id ? updated : c)),
                    revision: project.revision + 1,
                  };
                  setProject(newDoc);
                  triggerAutosave(newDoc);
                }}
                onUpdateComponentName={(id, name) => {
                  const newDoc = {
                    ...project,
                    components: project.components.map((c) => (c.instanceId === id ? { ...c, name } : c)),
                    revision: project.revision + 1,
                  };
                  setProject(newDoc);
                  triggerAutosave(newDoc);
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
                  const newDoc = {
                    ...project,
                    board: { ...project.board, solderMaskColor: colorHex },
                    revision: project.revision + 1,
                  };
                  setProject(newDoc);
                  triggerAutosave(newDoc);
                }}
              />
            )}
          </div>

          {/* Bottom Validation & Simulation Panel (Hidden in presentation mode) */}
          {!isPresentationMode && (
            <ValidationPanel
              issues={validationIssues}
              simulationResult={simulationResult}
              onFocusIssue={handleFocusIssue}
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
                      if (renameInput.trim()) {
                        const newDoc = { ...project, name: renameInput.trim(), revision: project.revision + 1 };
                        setProject(newDoc);
                        triggerAutosave(newDoc);
                      }
                      setIsRenameOpen(false);
                    }}
                    className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white"
                  >
                    Lưu tên
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
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
