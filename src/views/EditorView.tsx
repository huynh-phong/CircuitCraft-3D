import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Square,
  Undo2,
  Redo2,
  Save,
  Download,
  Upload,
  RotateCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Layers,
  Sliders,
  Sparkles,
  BookOpen,
  HelpCircle,
  Plus,
  FolderOpen,
  X,
} from 'lucide-react';
import {
  ProjectDocument,
  ComponentType,
  ComponentInstance,
  ValidationResult,
  SimulationResult,
  AIProposal,
  ProjectSummary,
} from '../types/circuit.ts';
import { COMPONENT_CATALOG, createDefaultProject } from '../domain/componentLibrary.ts';
import {
  CommandHistory,
  AddComponentCommand,
  RemoveComponentCommand,
  MoveComponentCommand,
  RotateComponentCommand,
  UpdatePropertyCommand,
  AddConnectionCommand,
  RemoveConnectionCommand,
} from '../engine/commandEngine.ts';
import { ValidationEngine } from '../engine/validationEngine.ts';
import { SimulationEngine } from '../engine/simulationEngine.ts';
import { ProjectRepository, defaultProjectRepository } from '../services/projectRepository.ts';
import { CircuitCanvas } from '../components/canvas3d/CircuitCanvas.tsx';
import { MinibotWidget } from '../components/minibot/MinibotWidget.tsx';
import { Button, Badge, ToastMessage } from '../components/ui/designSystem.tsx';
import { Lesson } from '../engine/lessonEngine.ts';

interface EditorViewProps {
  initialDocument?: ProjectDocument;
  activeLesson?: Lesson | null;
  onClearLesson?: () => void;
  onAddToast: (msg: Omit<ToastMessage, 'id'>) => void;
}

export const EditorView: React.FC<EditorViewProps> = ({
  initialDocument,
  activeLesson,
  onClearLesson,
  onAddToast,
}) => {
  // Single Source of Truth
  const [doc, setDoc] = useState<ProjectDocument>(() => initialDocument || ProjectRepository.loadActiveProject() || createDefaultProject());
  const historyRef = useRef<CommandHistory>(new CommandHistory(50));

  // Selection & Transient interaction
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [activePinWiring, setActivePinWiring] = useState<{ componentId: string; pinId: string } | null>(null);

  // Simulation & Validation
  const [isSimulating, setIsSimulating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult>(() => ValidationEngine.validate(doc));
  const [simulationResult, setSimulationResult] = useState<SimulationResult>(() => SimulationEngine.simulate(doc, false));

  const [activeTab, setActiveTab] = useState<'library' | 'diagnostics' | 'lesson'>('library');
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [savedProjects, setSavedProjects] = useState<ProjectSummary[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Run validation whenever document structure updates
  useEffect(() => {
    const val = ValidationEngine.validate(doc);
    setValidationResult(val);

    if (isSimulating) {
      const sim = SimulationEngine.simulate(doc, true);
      setSimulationResult(sim);
    } else {
      setSimulationResult(SimulationEngine.simulate(doc, false));
    }
  }, [doc, isSimulating]);

  // Keyboard shortcuts (Escape, Delete, Undo/Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Escape') {
        setActivePinWiring(null);
        setSelectedComponentId(null);
        setSelectedWireId(null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedComponentId) {
          handleDeleteComponent(selectedComponentId);
        } else if (selectedWireId) {
          handleDeleteWire(selectedWireId);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedComponentId, selectedWireId, doc]);

  // Command execution wrapper
  const executeCommands = (desc: string, commands: any[]) => {
    const newDoc = historyRef.current.execute(doc, desc, commands);
    setDoc(newDoc);
  };

  const handleUndo = () => {
    const undoneDoc = historyRef.current.undo(doc);
    if (undoneDoc) {
      setDoc(undoneDoc);
      onAddToast({ type: 'info', message: 'Đã hoàn tác thao tác trước' });
    }
  };

  const handleRedo = () => {
    const redoneDoc = historyRef.current.redo(doc);
    if (redoneDoc) {
      setDoc(redoneDoc);
      onAddToast({ type: 'info', message: 'Đã làm lại thao tác' });
    }
  };

  // Component manipulation
  const handleAddComponent = (type: ComponentType) => {
    const meta = COMPONENT_CATALOG[type];
    const offsetIndex = doc.components.length;
    const posX = (offsetIndex % 4) * 30 - 45;
    const posZ = Math.floor(offsetIndex / 4) * 25 - 20;

    const newComp: ComponentInstance = {
      id: 'comp_' + Math.random().toString(36).substring(2, 7),
      type,
      name: `${meta.title} ${doc.components.filter((c) => c.type === type).length + 1}`,
      position: { x: posX, y: 0, z: posZ },
      rotation: 0,
      properties: { ...meta.defaultProperties },
      pins: [...meta.pins],
    };

    executeCommands(`Thêm ${newComp.name}`, [new AddComponentCommand(newComp)]);
    setSelectedComponentId(newComp.id);
    onAddToast({ type: 'success', message: `Đã thêm ${newComp.name} vào bo mạch 3D` });
  };

  const handleDeleteComponent = (id: string) => {
    executeCommands('Xóa linh kiện', [new RemoveComponentCommand(id)]);
    setSelectedComponentId(null);
    onAddToast({ type: 'info', message: 'Đã xóa linh kiện khỏi mạch' });
  };

  const handleDeleteWire = (wireId: string) => {
    executeCommands('Xóa dây nối', [new RemoveConnectionCommand(wireId)]);
    setSelectedWireId(null);
    onAddToast({ type: 'info', message: 'Đã tháo dây nối' });
  };

  const handleMoveComponent = (id: string, newPos: { x: number; y: number; z: number }) => {
    const comp = doc.components.find((c) => c.id === id);
    if (!comp) return;
    executeCommands('Di chuyển linh kiện', [new MoveComponentCommand(id, newPos, comp.position)]);
  };

  const handleRotateComponent = (id: string) => {
    const comp = doc.components.find((c) => c.id === id);
    if (!comp) return;
    const nextRot = (comp.rotation + 90) % 360;
    executeCommands('Xoay linh kiện', [new RotateComponentCommand(id, nextRot, comp.rotation)]);
  };

  const handleToggleSwitch = (id: string) => {
    const comp = doc.components.find((c) => c.id === id);
    if (!comp || comp.type !== 'switch_spst') return;
    const newState = !comp.properties.isClosed;
    executeCommands('Gạt công tắc', [
      new UpdatePropertyCommand(id, { isClosed: newState }, comp.properties),
    ]);
  };

  // Wiring interactions
  const handleStartWire = (componentId: string, pinId: string) => {
    setActivePinWiring({ componentId, pinId });
    onAddToast({ type: 'info', message: 'Đã chọn chân đầu tiên. Hãy nhấp vào chân thứ hai để kết nối.' });
  };

  const handleFinishWire = (toComponentId: string, toPinId: string) => {
    if (!activePinWiring) return;
    const fromComp = doc.components.find((c) => c.id === activePinWiring.componentId);
    const toComp = doc.components.find((c) => c.id === toComponentId);

    if (!fromComp || !toComp) {
      setActivePinWiring(null);
      return;
    }

    // Determine wire color based on pin type
    const fromPin = fromComp.pins.find((p) => p.id === activePinWiring.pinId);
    let wireColor = '#22c55e'; // default green
    if (fromPin?.type === 'power_pos' || fromPin?.type === 'anode') {
      wireColor = '#ef4444'; // red for positive
    } else if (fromPin?.type === 'power_neg' || fromPin?.type === 'cathode') {
      wireColor = '#0284c7'; // blue for negative
    }

    const wire = {
      id: 'wire_' + Math.random().toString(36).substring(2, 7),
      fromComponentId: activePinWiring.componentId,
      fromPinId: activePinWiring.pinId,
      toComponentId,
      toPinId,
      color: wireColor,
    };

    executeCommands('Nối dây mạch', [new AddConnectionCommand(wire)]);
    setActivePinWiring(null);
    onAddToast({ type: 'success', message: 'Đã nối dây thành công!' });
  };

  // Project persistence & project management
  const handleNewProject = () => {
    const newDoc = defaultProjectRepository.createProject({ name: 'Mạch điện mới' });
    historyRef.current.clear();
    setDoc(newDoc);
    setSelectedComponentId(null);
    setSelectedWireId(null);
    setActivePinWiring(null);
    onAddToast({ type: 'info', message: 'Đã khởi tạo dự án mạch điện mới' });
  };

  const handleOpenProjectPicker = async () => {
    try {
      const list = await defaultProjectRepository.listProjects();
      setSavedProjects(list);
      setShowProjectPicker(true);
    } catch (err: any) {
      onAddToast({ type: 'error', message: err?.message || 'Không thể lấy danh sách dự án' });
    }
  };

  const handleLoadSavedProject = async (projectId: string) => {
    try {
      const loaded = await defaultProjectRepository.getProject(projectId);
      historyRef.current.clear();
      setDoc(loaded);
      setSelectedComponentId(null);
      setSelectedWireId(null);
      setActivePinWiring(null);
      setShowProjectPicker(false);
      onAddToast({ type: 'success', message: `Đã mở dự án "${loaded.name}"` });
    } catch (err: any) {
      onAddToast({ type: 'error', message: err.message || 'Không thể mở dự án' });
    }
  };

  const handleDeleteSavedProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await defaultProjectRepository.deleteProject(projectId);
      setSavedProjects((prev) => prev.filter((p) => p.id !== projectId));
      onAddToast({ type: 'info', message: 'Đã xóa dự án khỏi bộ nhớ cục bộ' });
    } catch (err: any) {
      onAddToast({ type: 'error', message: err?.message || 'Lỗi xóa dự án' });
    }
  };

  const handleSaveProject = async () => {
    const res = await defaultProjectRepository.saveProject(doc, doc.revision);
    if (res.success) {
      onAddToast({ type: 'success', message: `Đã lưu dự án "${doc.name}" (Revision #${doc.revision})` });
    } else if (res.conflict) {
      onAddToast({ type: 'warning', message: res.message || 'Xung đột phiên bản' });
    } else {
      onAddToast({ type: 'error', message: res.message || 'Lỗi lưu dự án' });
    }
  };

  const handleExportJson = () => {
    defaultProjectRepository.exportProjectJson(doc);
    onAddToast({ type: 'success', message: 'Đã tải về tệp thiết kế JSON.' });
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Strictly validate & migrate. If invalid, the currently open project remains 100% intact!
      const importedDoc = await defaultProjectRepository.parseProjectJsonFile(file);
      historyRef.current.clear();
      setDoc(importedDoc);
      setSelectedComponentId(null);
      setSelectedWireId(null);
      setActivePinWiring(null);
      onAddToast({ type: 'success', message: `Đã mở dự án "${importedDoc.name}"` });
    } catch (err: any) {
      onAddToast({ type: 'error', message: err.message || 'Tệp tin không hợp lệ' });
    }
    e.target.value = '';
  };

  const handleApplyAIProposal = (proposal: AIProposal) => {
    const commands: any[] = [];
    proposal.changes.forEach((ch) => {
      if (ch.action === 'add_component') {
        const meta = COMPONENT_CATALOG[ch.payload.type as ComponentType];
        if (meta) {
          commands.push(
            new AddComponentCommand({
              id: 'comp_ai_' + Math.random().toString(36).substring(2, 7),
              type: ch.payload.type,
              name: ch.payload.name || meta.title,
              position: ch.payload.position || { x: 0, y: 0, z: 0 },
              rotation: 0,
              properties: { ...meta.defaultProperties },
              pins: [...meta.pins],
            })
          );
        }
      } else if (ch.action === 'add_connection') {
        commands.push(
          new AddConnectionCommand({
            id: 'wire_ai_' + Math.random().toString(36).substring(2, 7),
            fromComponentId: ch.payload.fromComponentId,
            fromPinId: ch.payload.fromPinId,
            toComponentId: ch.payload.toComponentId,
            toPinId: ch.payload.toPinId,
            color: ch.payload.color || '#3b82f6',
          })
        );
      }
    });

    if (commands.length > 0) {
      executeCommands(`AI: ${proposal.summary}`, commands);
      onAddToast({ type: 'success', message: 'Đã áp dụng đề xuất của Minibot AI!' });
    }
  };

  const selectedComp = doc.components.find((c) => c.id === selectedComponentId);

  return (
    <div className="relative w-full h-[calc(100vh-64px)] flex flex-col bg-slate-950 overflow-hidden select-none">
      {/* Top Toolbar */}
      <header className="h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 flex items-center justify-between shrink-0 z-30">
        {/* Left: Project title & History */}
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">{doc.name}</span>
              <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                r#{doc.revision}
              </span>
            </div>
            {activeLesson && (
              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> Đang học: {activeLesson.title}
              </span>
            )}
          </div>

          <div className="h-5 w-[1px] bg-slate-800 mx-1" />

          {/* Undo / Redo */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={!historyRef.current.canUndo()}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
              title="Hoàn tác (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={!historyRef.current.canRedo()}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
              title="Làm lại (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: Simulation Toggle & Quick Status */}
        <div className="flex items-center gap-3">
          <Button
            variant={isSimulating ? 'danger' : 'success'}
            size="sm"
            onClick={() => setIsSimulating(!isSimulating)}
            leftIcon={isSimulating ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          >
            {isSimulating ? 'Dừng mô phỏng' : 'Chạy mô phỏng 3D'}
          </Button>

          {/* Circuit Health Pill */}
          <div
            onClick={() => setActiveTab('diagnostics')}
            className={`cursor-pointer px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-2 transition ${
              validationResult.isValid
                ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
                : 'bg-rose-950/60 border-rose-800/80 text-rose-300 animate-pulse'
            }`}
          >
            {validationResult.isValid ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span>
              {validationResult.isValid
                ? 'Mạch hợp lệ'
                : `${validationResult.stats.errorsCount} cảnh báo lỗi`}
            </span>
          </div>
        </div>

        {/* Right: Save & Export / Import & Project Management */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewProject}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            title="Tạo dự án mới"
          >
            Mới
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenProjectPicker}
            leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
            title="Mở dự án đã lưu"
          >
            Dự án
          </Button>

          <Button variant="outline" size="sm" onClick={handleSaveProject} leftIcon={<Save className="w-3.5 h-3.5" />}>
            Lưu
          </Button>

          <Button variant="ghost" size="sm" onClick={handleExportJson} leftIcon={<Download className="w-3.5 h-3.5" />}>
            Tải JSON
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            leftIcon={<Upload className="w-3.5 h-3.5" />}
          >
            Nhập JSON
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportJson}
            accept=".json"
            className="hidden"
          />
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar: Component Catalog */}
        <aside className="w-64 bg-slate-900/90 backdrop-blur-md border-r border-slate-800 p-4 flex flex-col justify-between shrink-0 z-20 overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                Thư viện linh kiện
              </span>
              <span className="text-[10px] text-slate-500">{Object.keys(COMPONENT_CATALOG).length} loại</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {(Object.keys(COMPONENT_CATALOG) as ComponentType[]).map((type) => {
                const meta = COMPONENT_CATALOG[type];
                return (
                  <button
                    key={type}
                    onClick={() => handleAddComponent(type)}
                    className="p-3 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <h4 className="text-xs font-semibold text-slate-200 group-hover:text-emerald-400 transition">
                        {meta.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">{meta.description}</p>
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-slate-800 group-hover:bg-emerald-500/20 text-slate-400 group-hover:text-emerald-400 flex items-center justify-center shrink-0 ml-2 transition">
                      <Plus className="w-4 h-4" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Circuit Stats Footer */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1 mt-4">
            <div className="flex justify-between">
              <span>Số linh kiện:</span>
              <strong className="text-slate-200">{doc.components.length}</strong>
            </div>
            <div className="flex justify-between">
              <span>Số dây nối:</span>
              <strong className="text-slate-200">{doc.connections.length}</strong>
            </div>
            <div className="flex justify-between">
              <span>Lưới PCB:</span>
              <span className="text-slate-400">Snap 10mm</span>
            </div>
          </div>
        </aside>

        {/* Center: Interactive 3D Canvas */}
        <main className="flex-1 relative h-full">
          <CircuitCanvas
            document={doc}
            selectedComponentId={selectedComponentId}
            selectedWireId={selectedWireId}
            activePinWiring={activePinWiring}
            simulationResult={simulationResult}
            isSimulating={isSimulating}
            onSelectComponent={(id) => {
              setSelectedComponentId(id);
              if (id) setSelectedWireId(null);
            }}
            onSelectWire={(id) => {
              setSelectedWireId(id);
              if (id) setSelectedComponentId(null);
            }}
            onStartWire={handleStartWire}
            onFinishWire={handleFinishWire}
            onCancelWire={() => setActivePinWiring(null)}
            onMoveComponent={handleMoveComponent}
            onToggleSwitch={handleToggleSwitch}
          />
        </main>

        {/* Right Inspector & Diagnostics Panel */}
        <aside className="w-80 bg-slate-900/90 backdrop-blur-md border-l border-slate-800 p-4 flex flex-col justify-between shrink-0 z-20 overflow-y-auto">
          <div className="space-y-4">
            {/* Inspector Tabs */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setActiveTab('library')}
                className={`flex-1 py-1.5 rounded text-xs font-medium transition cursor-pointer ${
                  activeTab === 'library' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Thuộc tính
              </button>
              <button
                onClick={() => setActiveTab('diagnostics')}
                className={`flex-1 py-1.5 rounded text-xs font-medium transition cursor-pointer ${
                  activeTab === 'diagnostics' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Chẩn đoán
              </button>
              {activeLesson && (
                <button
                  onClick={() => setActiveTab('lesson')}
                  className={`flex-1 py-1.5 rounded text-xs font-medium transition cursor-pointer ${
                    activeTab === 'lesson' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Bài học
                </button>
              )}
            </div>

            {/* TAB 1: Selected Component Properties */}
            {activeTab === 'library' && (
              <div>
                {selectedComp ? (
                  <div className="space-y-4 text-xs">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div>
                        <h3 className="font-semibold text-white text-sm">{selectedComp.name}</h3>
                        <span className="text-[10px] text-emerald-400">{selectedComp.type.toUpperCase()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRotateComponent(selectedComp.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          title="Xoay 90 độ"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteComponent(selectedComp.id)}
                          className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 transition"
                          title="Xóa linh kiện"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Properties Form */}
                    <div className="space-y-3">
                      {selectedComp.type === 'dc_power_supply' && (
                        <div className="space-y-1">
                          <label className="text-slate-400">Điện áp nguồn (V DC)</label>
                          <input
                            type="number"
                            value={selectedComp.properties.voltage || 5}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              executeCommands('Cập nhật điện áp', [
                                new UpdatePropertyCommand(selectedComp.id, { voltage: val }, selectedComp.properties),
                              ]);
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                          />
                        </div>
                      )}

                      {selectedComp.type === 'resistor' && (
                        <div className="space-y-1">
                          <label className="text-slate-400">Trở kháng (Ω)</label>
                          <input
                            type="number"
                            value={selectedComp.properties.resistance || 220}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              executeCommands('Cập nhật trở kháng', [
                                new UpdatePropertyCommand(selectedComp.id, { resistance: val }, selectedComp.properties),
                              ]);
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                          />
                        </div>
                      )}

                      {selectedComp.type === 'led' && (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-slate-400">Màu phát quang</label>
                            <div className="flex gap-2">
                              {['#ef4444', '#22c55e', '#3b82f6', '#eab308'].map((c) => (
                                <button
                                  key={c}
                                  onClick={() =>
                                    executeCommands('Đổi màu LED', [
                                      new UpdatePropertyCommand(selectedComp.id, { color: c }, selectedComp.properties),
                                    ])
                                  }
                                  className={`w-7 h-7 rounded-full border-2 transition ${
                                    selectedComp.properties.color === c ? 'border-white scale-110' : 'border-transparent'
                                  }`}
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedComp.type === 'switch_spst' && (
                        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-300">Trạng thái tiếp điểm:</span>
                            <Badge variant={selectedComp.properties.isClosed ? 'emerald' : 'slate'}>
                              {selectedComp.properties.isClosed ? 'ĐÓNG (ON)' : 'MỞ (OFF)'}
                            </Badge>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full"
                            onClick={() => handleToggleSwitch(selectedComp.id)}
                          >
                            {selectedComp.properties.isClosed ? 'Ngắt công tắc' : 'Đóng công tắc'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : selectedWireId ? (
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-white">Dây nối được chọn</h4>
                      <button
                        onClick={() => handleDeleteWire(selectedWireId)}
                        className="p-1 rounded bg-rose-950/80 text-rose-300 hover:bg-rose-900 transition"
                        title="Xóa dây"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Nhấn nút Thùng rác hoặc phím Delete trên bàn phím để gỡ bỏ dây nối này.
                    </p>
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                    <Sliders className="w-8 h-8 mx-auto text-slate-600" />
                    <p>Nhấp chọn linh kiện hoặc dây nối trên mặt bo mạch để xem thông số kỹ thuật.</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Diagnostics */}
            {activeTab === 'diagnostics' && (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="font-semibold text-white">Chẩn đoán lỗi quy chuẩn</span>
                  <span className="text-[10px] text-slate-400">{validationResult.diagnostics.length} cảnh báo</span>
                </div>

                {validationResult.diagnostics.length === 0 ? (
                  <div className="p-4 bg-emerald-950/30 border border-emerald-800/60 rounded-xl text-center space-y-1">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                    <h5 className="font-semibold text-emerald-300">Không có lỗi!</h5>
                    <p className="text-[11px] text-emerald-400/80">Cấu trúc mạch đảm bảo quy chuẩn an toàn.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {validationResult.diagnostics.map((diag, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-xl border text-left space-y-1 ${
                          diag.severity === 'error'
                            ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                            : 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{diag.message}</span>
                        </div>
                        {diag.details && <p className="text-[11px] opacity-80 pl-5">{diag.details}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Guided Lesson Progress */}
            {activeTab === 'lesson' && activeLesson && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="font-semibold text-white">{activeLesson.title}</span>
                  <button onClick={onClearLesson} className="text-[10px] text-slate-400 hover:text-white">
                    Thoát bài
                  </button>
                </div>

                <div className="space-y-2.5">
                  {activeLesson.steps.map((step, sIdx) => {
                    const done = step.isCompleted(doc, simulationResult);
                    return (
                      <div
                        key={step.id}
                        className={`p-3 rounded-xl border transition ${
                          done
                            ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-medium">
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                              done ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {done ? '✓' : sIdx + 1}
                          </span>
                          <span>{step.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 pl-6">{step.instruction}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Minibot Companion 3D Agent */}
      <MinibotWidget
        document={doc}
        validationResult={validationResult}
        isSimulating={isSimulating}
        onApplyProposal={handleApplyAIProposal}
      />

      {/* Saved Projects Modal */}
      {showProjectPicker && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-white text-base">Danh sách dự án đã lưu</h3>
              </div>
              <button
                onClick={() => setShowProjectPicker(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 max-h-80 overflow-y-auto space-y-2">
              {savedProjects.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Chưa có dự án nào được lưu trong bộ nhớ cục bộ.
                </div>
              ) : (
                savedProjects.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleLoadSavedProject(p.id)}
                    className="p-3 bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/50 rounded-xl cursor-pointer transition flex items-center justify-between group"
                  >
                    <div>
                      <h4 className="font-medium text-white text-sm group-hover:text-emerald-300 transition">
                        {p.name}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Revision #{p.revision} • Cập nhật: {new Date(p.updatedAt).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDeleteSavedProject(p.id, e)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
                        title="Xóa dự án"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/50 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowProjectPicker(false)}>
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
