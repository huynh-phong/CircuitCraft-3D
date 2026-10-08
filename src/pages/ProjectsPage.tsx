import React, { useState, useEffect, useCallback } from 'react';
import { ProjectDocument } from '../domain/project/types';
import { projectRepositoryManager } from '../persistence/repositoryManager';
import { ProjectVersionSnapshot } from '../persistence/repository';
import { createDefaultProjectDocument, cloneProjectDocument } from '../domain/project/document';
import { authService, UserProfile } from '../persistence/authService';
import { SAMPLE_PROJECTS } from '../persistence/sampleProjects';
import { useI18n } from '../i18n/context';
import {
  Plus,
  FolderOpen,
  Copy,
  Trash2,
  History,
  Download,
  Box,
  Clock,
  Cloud,
  HardDrive,
  AlertCircle,
  RefreshCw,
  Edit2,
  Cpu,
  Layers,
  Sparkles,
  CheckCircle2,
  X,
  ArrowRight,
  Search,
} from 'lucide-react';

export interface ProjectsPageProps {
  onOpenProject: (project: ProjectDocument) => void;
  onOpenAuthModal?: () => void;
  onProjectDeleted?: (projectId: string) => void;
  currentUser?: any;
  currentProfile?: UserProfile | null;
  activeProjectId?: string | null;
}

export interface BoardPreset {
  id: string;
  name: string;
  description: string;
  width: number;
  depth: number;
  tag: string;
}

const BOARD_PRESETS: BoardPreset[] = [
  {
    id: 'standard',
    name: 'Kích thước Chuẩn',
    description: 'Phù hợp cho hầu hết các mạch cơ bản đến trung bình',
    width: 80,
    depth: 60,
    tag: '80 × 60 mm',
  },
  {
    id: 'compact',
    name: 'Nhỏ gọn (Mini)',
    description: 'Tối ưu cho vi mạch điều khiển nhỏ hoặc cảm biến',
    width: 50,
    depth: 40,
    tag: '50 × 40 mm',
  },
  {
    id: 'extended',
    name: 'Mở rộng (UNO / Pro)',
    description: 'Không gian rộng cho mạch Arduino UNO và nhiều ngoại vi',
    width: 120,
    depth: 80,
    tag: '120 × 80 mm',
  },
];

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  onOpenProject,
  onProjectDeleted,
  currentUser,
  activeProjectId,
}) => {
  const { language } = useI18n();
  const [activeTab, setActiveTab] = useState<'my-projects' | 'create-new'>('my-projects');
  const [projects, setProjects] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // New Blank Project State
  const [selectedBoardPreset, setSelectedBoardPreset] = useState<BoardPreset>(BOARD_PRESETS[0]);
  const [blankProjectName, setBlankProjectName] = useState('Mạch 3D Mới');
  const [blankProjectDesc, setBlankProjectDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Delete Confirmation Modal State
  const [projectToDelete, setProjectToDelete] = useState<ProjectDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Rename Project Modal State
  const [projectToRename, setProjectToRename] = useState<ProjectDocument | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Version History Modal
  const [selectedHistoryProjectId, setSelectedHistoryProjectId] = useState<string | null>(null);
  const [versionsList, setVersionsList] = useState<ProjectVersionSnapshot[]>([]);

  const isCloudActive = projectRepositoryManager.isCloudMode();

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const repo = projectRepositoryManager.getActiveRepository();
      const list = await repo.listProjects();

      // Deduplicate by projectId
      const seen = new Set<string>();
      const cleanList: ProjectDocument[] = [];
      for (const p of list) {
        if (!p || !p.projectId) continue;
        if (!seen.has(p.projectId)) {
          seen.add(p.projectId);
          // If currentUser is logged in, ensure only projects belonging to this user are shown
          if (currentUser?.id) {
            if (!p.authorId || p.authorId === currentUser.id) {
              cleanList.push({
                ...p,
                authorId: currentUser.id,
              });
            }
          } else {
            // Guest mode: show guest/sample circuits
            cleanList.push(p);
          }
        }
      }

      setProjects(cleanList);
    } catch (err) {
      console.warn('Lỗi tải danh sách dự án:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects, currentUser]);

  // Create Blank Project
  const handleCreateBlank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blankProjectName.trim()) return;

    setIsCreating(true);
    try {
      const doc = createDefaultProjectDocument(blankProjectName.trim(), {
        width: selectedBoardPreset.width,
        depth: selectedBoardPreset.depth,
        description: blankProjectDesc.trim() || `Bo mạch ${selectedBoardPreset.name} (${selectedBoardPreset.tag})`,
      });

      if (currentUser) {
        doc.authorId = currentUser.id;
      }

      const repo = projectRepositoryManager.getActiveRepository();
      await repo.saveProject(doc);
      await loadProjects();
      onOpenProject(doc);
    } catch (err) {
      console.error('Lỗi khi tạo dự án mới:', err);
    } finally {
      setIsCreating(false);
    }
  };

  // Create Project from Template
  const handleCreateFromTemplate = async (template: ProjectDocument) => {
    setIsCreating(true);
    try {
      const newId = `proj-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
      const doc: ProjectDocument = {
        ...cloneProjectDocument(template),
        projectId: newId,
        name: `${template.name} (Bản mới)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        revision: 1,
      };

      if (currentUser) {
        doc.authorId = currentUser.id;
      }

      const repo = projectRepositoryManager.getActiveRepository();
      await repo.saveProject(doc);
      await loadProjects();
      onOpenProject(doc);
    } catch (err) {
      console.error('Lỗi khi tạo dự án từ mẫu:', err);
    } finally {
      setIsCreating(false);
    }
  };

  // Safe Delete Flow
  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;

    setIsDeleting(true);
    try {
      const id = projectToDelete.projectId;
      const repo = projectRepositoryManager.getActiveRepository();
      await repo.deleteProject(id);

      // Invalidate and refresh list
      await loadProjects();

      // If this project was currently open in editor, notify parent to exit editor
      if (onProjectDeleted) {
        onProjectDeleted(id);
      }

      setProjectToDelete(null);
    } catch (err) {
      console.error('Lỗi khi xóa dự án:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Rename Flow
  const handleSaveRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectToRename || !renameValue.trim()) return;

    setIsRenaming(true);
    try {
      const repo = projectRepositoryManager.getActiveRepository();
      const updated: ProjectDocument = {
        ...projectToRename,
        name: renameValue.trim(),
        updatedAt: new Date().toISOString(),
      };
      await repo.saveProject(updated, { force: true });
      await loadProjects();
      setProjectToRename(null);
    } catch (err) {
      console.error('Lỗi đổi tên dự án:', err);
    } finally {
      setIsRenaming(false);
    }
  };

  // Duplicate Flow
  const handleDuplicate = async (p: ProjectDocument) => {
    const repo = projectRepositoryManager.getActiveRepository();
    const copy = await repo.duplicateProject(p.projectId);
    if (copy) {
      await loadProjects();
    }
  };

  // Export Flow
  const handleExport = (p: ProjectDocument) => {
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${p.name.replace(/\s+/g, '_')}_v${p.revision}.circuitcraft.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Version History Flow
  const handleOpenVersions = async (id: string) => {
    setSelectedHistoryProjectId(id);
    const repo = projectRepositoryManager.getActiveRepository();
    const vers = await repo.listVersions(id);
    setVersionsList(vers);
  };

  const handleRestoreVersion = async (snap: ProjectVersionSnapshot) => {
    const repo = projectRepositoryManager.getActiveRepository();
    const currentDoc = await repo.getProject(snap.projectId);
    const nextRev = (currentDoc?.revision || snap.revision) + 1;

    const restoredDoc: ProjectDocument = {
      ...cloneProjectDocument(snap.document),
      projectId: snap.projectId,
      revision: nextRev,
      updatedAt: new Date().toISOString(),
    };

    await repo.saveProject(restoredDoc, { force: true });
    setSelectedHistoryProjectId(null);
    await loadProjects();
    onOpenProject(restoredDoc);
  };

  // Filter projects by search query
  const filteredProjects = projects.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      p.projectId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 overflow-y-auto bg-transparent p-4 sm:p-6 md:p-8 select-none text-slate-800 dark:text-slate-100 transition-colors">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Hero Banner with signature tech-panel & circuit-traces */}
        <div className="tech-panel p-6 sm:p-10 relative overflow-hidden circuit-traces-overlay">
          {/* Subtle ambient lighting accent */}
          <div className="absolute top-0 right-1/4 w-80 h-80 bg-cyan-500/10 dark:bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200/90 dark:border-cyan-500/40 text-xs font-semibold shadow-xs">
                <Box className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>{language === 'vi' ? 'Không Gian Thiết Kế Mạch 3D' : '3D Circuit Design Workspace'}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {language === 'vi' ? 'Dự Án Thiết Kế Mạch Điện Tử 3D' : '3D Electronic Circuit Projects'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal max-w-2xl">
                {language === 'vi'
                  ? 'Quản lý các bản vẽ sơ đồ mạch cá nhân, tiếp tục dự án đang thực hiện hoặc khởi tạo bo mạch mới với kích thước và template tiêu chuẩn công nghiệp.'
                  : 'Manage personal schematics, resume active PCB hardware designs, or initialize blank boards with standard dimensions.'}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setActiveTab('create-new')}
                className={`px-5 py-2.5 text-xs font-extrabold flex items-center gap-2 transition-all ${
                  activeTab === 'create-new'
                    ? 'tech-btn-3d shadow-[0_8px_22px_rgba(6,182,212,0.45)] -translate-y-0.5'
                    : 'tech-btn-control border border-[#cbe6f7] dark:border-cyan-800/60 bg-white dark:bg-[#091526] text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 shadow-xs'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'vi' ? 'Tạo dự án mới' : 'New Project'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section Navigation Tabs & Search Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setActiveTab('my-projects')}
              className={`px-4.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                activeTab === 'my-projects'
                  ? 'tech-btn-primary shadow-[0_4px_14px_rgba(6,182,212,0.35)] -translate-y-0.5'
                  : 'tech-btn-control border border-[#cbe6f7] dark:border-cyan-800/60 bg-white dark:bg-[#091526] text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-400 dark:hover:border-cyan-500 shadow-xs'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>{language === 'vi' ? `Dự án của tôi (${projects.length})` : `My Projects (${projects.length})`}</span>
            </button>

            <button
              onClick={() => setActiveTab('create-new')}
              className={`px-4.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                activeTab === 'create-new'
                  ? 'tech-btn-primary shadow-[0_4px_14px_rgba(6,182,212,0.35)] -translate-y-0.5'
                  : 'tech-btn-control border border-[#cbe6f7] dark:border-cyan-800/60 bg-white dark:bg-[#091526] text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-400 dark:hover:border-cyan-500 shadow-xs'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'vi' ? 'Khởi tạo dự án mới' : 'Initialize New Project'}</span>
            </button>
          </div>

          {/* Quick Search for My Projects */}
          {activeTab === 'my-projects' && projects.length > 0 && (
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'vi' ? 'Tìm kiếm dự án...' : 'Search projects...'}
                className="w-full pl-9 pr-3.5 py-2 bg-white dark:bg-[#091526] border border-[#cbe6f7] dark:border-cyan-800/60 rounded-xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 shadow-xs transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* TAB 1: DỰ ÁN CỦA TÔI */}
        {/* ============================================================ */}
        {activeTab === 'my-projects' && (
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-20 text-slate-500 text-sm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                {language === 'vi' ? 'Đang tải danh sách dự án của bạn...' : 'Loading your projects...'}
              </div>
            ) : projects.length === 0 ? (
              /* Empty State */
              <div className="tech-panel p-12 text-center space-y-4 relative overflow-hidden circuit-traces-overlay">
                <div className="w-16 h-16 rounded-2xl bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200 dark:border-cyan-500/30 text-cyan-500 flex items-center justify-center mx-auto shadow-inner">
                  <Box className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {language === 'vi' ? 'Bạn chưa có dự án mạch 3D nào' : 'No 3D projects created yet'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                    {language === 'vi'
                      ? 'Hãy khởi tạo dự án mạch điện 3D đầu tiên hoặc chọn từ các mẫu mạch có sẵn để bắt đầu lắp ráp và mô phỏng tương tác.'
                      : 'Launch your first 3D electronic circuit or select from pre-designed hardware templates to start building.'}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setActiveTab('create-new')}
                    className="tech-btn-3d px-5 py-2.5 text-xs font-extrabold flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{language === 'vi' ? 'Tạo dự án mới' : 'Create New Project'}</span>
                  </button>
                </div>
              </div>
            ) : filteredProjects.length === 0 ? (
              /* Search Empty State */
              <div className="tech-panel p-10 text-center space-y-3">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {language === 'vi' ? `Không tìm thấy dự án khớp với từ khóa "${searchQuery}"` : `No projects matching "${searchQuery}"`}
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-cyan-600 dark:text-cyan-400 underline font-medium"
                >
                  {language === 'vi' ? 'Xóa bộ lọc tìm kiếm' : 'Clear search query'}
                </button>
              </div>
            ) : (
              /* Project Cards Grid with 3D Tech-Card frame & hover effects */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProjects.map((p) => {
                  const compCount = p.components?.length || 0;
                  const connCount = p.connections?.length || 0;
                  const boardW = p.board?.width || 80;
                  const boardD = p.board?.depth || 60;
                  const copperLayers = p.board?.copperLayerCount || 2;
                  const isCurrentOpen = activeProjectId === p.projectId;

                  return (
                    <div
                      key={p.projectId}
                      className={`relative rounded-[24px] overflow-hidden flex flex-col justify-between transition-all duration-300 group ${
                        isCurrentOpen
                          ? 'border-2 border-cyan-400 dark:border-cyan-400 shadow-[0_0_28px_rgba(6,182,212,0.3),0_20px_50px_-10px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(34,211,238,0.35)] bg-gradient-to-b from-[#ffffff] via-[#f7fbfe] to-[#edf6fb] dark:from-[#0a1b2f] dark:via-[#071526] dark:to-[#040e1b]'
                          : 'tech-card'
                      }`}
                    >
                      {/* Top Preview Canvas Header */}
                      <div className="h-32 bg-slate-100/90 dark:bg-gradient-to-br dark:from-[#050f1d] dark:via-[#081527] dark:to-[#040b15] border-b border-[#d7e7f0] dark:border-cyan-950/70 relative p-4 flex flex-col justify-between overflow-hidden">
                        {/* Decorative PCB Grid Background */}
                        <div
                          className="absolute inset-0 opacity-20 pointer-events-none"
                          style={{
                            backgroundImage: `radial-gradient(#06b6d4 1.2px, transparent 1.2px)`,
                            backgroundSize: '16px 16px',
                          }}
                        />

                        {/* Top Badges */}
                        <div className="relative z-10 flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-white/90 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200/90 dark:border-cyan-500/40 shadow-xs">
                            #rev {p.revision}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {isCurrentOpen && (
                              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/90 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 shadow-xs flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>{language === 'vi' ? 'Đang mở' : 'Active'}</span>
                              </span>
                            )}
                            <span
                              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg font-medium shadow-xs ${
                                isCloudActive
                                  ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                                  : 'bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                              }`}
                              title={isCloudActive ? 'Đã lưu trên Supabase Cloud' : 'Lưu trữ cục bộ'}
                            >
                              {isCloudActive ? <Cloud className="w-3 h-3 text-emerald-500" /> : <HardDrive className="w-3 h-3" />}
                              <span>{isCloudActive ? 'Cloud' : 'Local'}</span>
                            </span>
                          </div>
                        </div>

                        {/* Center Icon & Dimensions */}
                        <div className="relative z-10 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shadow-md shadow-cyan-500/10 group-hover:scale-105 transition-transform">
                            <Layers className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white tracking-wide">
                              {language === 'vi' ? 'Bo mạch:' : 'Board:'} {boardW} × {boardD} mm
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              PCB {copperLayers} {language === 'vi' ? 'lớp đồng • Pitch 2.54mm' : 'copper layers • Pitch 2.54mm'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Body Content */}
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h3
                              onClick={() => onOpenProject(p)}
                              className="font-bold text-slate-900 dark:text-white text-base group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition cursor-pointer truncate"
                              title={p.name}
                            >
                              {p.name}
                            </h3>
                            <button
                              onClick={() => {
                                setProjectToRename(p);
                                setRenameValue(p.name);
                              }}
                              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              title={language === 'vi' ? 'Đổi tên dự án' : 'Rename project'}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 min-h-[32px] leading-relaxed font-normal">
                            {p.description || (language === 'vi' ? 'Dự án mạch điện 3D được thiết kế trên CircuitCraft 3D.' : 'CircuitCraft 3D board design project.')}
                          </p>
                        </div>

                        {/* Specs Grid */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-2.5 border-t border-[#e2eef5] dark:border-slate-800/80">
                          <div>
                            <span className="text-slate-400 dark:text-slate-500">{language === 'vi' ? 'Linh kiện:' : 'Components:'}</span>{' '}
                            <span className="text-slate-800 dark:text-slate-200 font-bold font-mono tabular-nums">{compCount}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 dark:text-slate-500">{language === 'vi' ? 'Đường nối:' : 'Wires:'}</span>{' '}
                            <span className="text-slate-800 dark:text-slate-200 font-bold font-mono tabular-nums">{connCount}</span>
                          </div>
                          <div className="col-span-2 text-[10px] text-slate-400 dark:text-slate-500 truncate flex items-center gap-1.5 font-mono">
                            <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                            <span>{language === 'vi' ? 'Cập nhật:' : 'Updated:'} {new Date(p.updatedAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}</span>
                          </div>
                        </div>

                        {/* Footer Action Buttons with 3D button styling */}
                        <div className="pt-3 border-t border-[#e2eef5] dark:border-slate-800/80 flex items-center justify-between gap-2.5">
                          <button
                            onClick={() => onOpenProject(p)}
                            className="tech-btn-3d flex-1 py-2.5 px-4 text-xs font-extrabold flex items-center justify-center gap-2"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>{language === 'vi' ? 'Mở thiết kế 3D' : 'Open 3D Design'}</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenVersions(p.projectId)}
                              className="tech-btn-control p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400"
                              title={language === 'vi' ? 'Lịch sử phiên bản' : 'Version history'}
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDuplicate(p)}
                              className="tech-btn-control p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400"
                              title={language === 'vi' ? 'Tạo bản sao' : 'Duplicate project'}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleExport(p)}
                              className="tech-btn-control p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400"
                              title={language === 'vi' ? 'Xuất file JSON' : 'Export JSON'}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => setProjectToDelete(p)}
                              className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition"
                              title={language === 'vi' ? 'Xóa dự án' : 'Delete project'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: KHỞI TẠO DỰ ÁN MỚI */}
        {/* ============================================================ */}
        {activeTab === 'create-new' && (
          <div className="space-y-8">
            {/* 2.1 Dự án trống (Blank Project) */}
            <div className="tech-panel p-6 sm:p-8 relative overflow-hidden circuit-traces-overlay space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-[#d7e7f0] dark:border-cyan-950/60">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200 dark:border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shadow-sm">
                  <Box className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {language === 'vi' ? 'Khởi tạo Dự Án Trống (Blank Board)' : 'Initialize Blank Project'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {language === 'vi' ? 'Chọn kích thước bo mạch phù hợp với ý tưởng mạch của bạn' : 'Select board size that fits your circuit design needs'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateBlank} className="space-y-6">
                {/* Board Preset Options */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === 'vi' ? 'Chọn kích thước bo mạch (Board Dimension)' : 'Select Board Dimension'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {BOARD_PRESETS.map((preset) => {
                      const isSelected = selectedBoardPreset.id === preset.id;
                      return (
                        <div
                          key={preset.id}
                          onClick={() => setSelectedBoardPreset(preset)}
                          className={`p-4 rounded-2xl cursor-pointer transition-all flex flex-col justify-between space-y-2.5 ${
                            isSelected
                              ? 'bg-gradient-to-b from-[#ffffff] via-[#f7fbfe] to-[#edf6fb] dark:from-[#0a1b2f] dark:via-[#071526] dark:to-[#040e1b] border-2 border-cyan-400 dark:border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)] ring-2 ring-cyan-400/20'
                              : 'tech-card hover:-translate-y-1'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{preset.name}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/40">
                              {preset.tag}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-normal">{preset.description}</p>
                          <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono font-semibold">
                            {language === 'vi' ? 'Kích thước:' : 'Size:'} {preset.width}mm × {preset.depth}mm
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Form Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === 'vi' ? 'Tên dự án' : 'Project Name'}
                    </label>
                    <input
                      type="text"
                      required
                      value={blankProjectName}
                      onChange={(e) => setBlankProjectName(e.target.value)}
                      placeholder={language === 'vi' ? 'VD: Mạch Cảm Biến Ánh Sáng...' : 'e.g. Light Sensor Circuit...'}
                      className="w-full px-4 py-2.5 bg-white dark:bg-[#061224] border border-[#cbe6f7] dark:border-cyan-900/60 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 shadow-xs transition"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === 'vi' ? 'Mô tả ngắn' : 'Short Description'}
                    </label>
                    <input
                      type="text"
                      value={blankProjectDesc}
                      onChange={(e) => setBlankProjectDesc(e.target.value)}
                      placeholder={language === 'vi' ? 'Mục đích, điện áp hoạt động, tải dự kiến...' : 'Purpose, operating voltage, target load...'}
                      className="w-full px-4 py-2.5 bg-white dark:bg-[#061224] border border-[#cbe6f7] dark:border-cyan-900/60 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 shadow-xs transition"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="tech-btn-3d px-6 py-2.5 text-xs font-extrabold flex items-center gap-2"
                  >
                    {isCreating ? (
                      <span>{language === 'vi' ? 'Đang khởi tạo...' : 'Creating...'}</span>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>{language === 'vi' ? 'Tạo dự án & Vào Editor 3D' : 'Create Project & Open 3D Editor'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* 2.2 Tạo nhanh từ Template cơ bản */}
            <div className="tech-panel p-6 sm:p-8 relative overflow-hidden circuit-traces-overlay space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-[#d7e7f0] dark:border-cyan-950/60">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center text-amber-500 shadow-sm">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {language === 'vi' ? 'Hoặc Tạo Nhanh Từ Template Mạch Chuẩn' : 'Or Start with Standard Templates'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {language === 'vi' ? 'Bắt đầu ngay từ các cấu hình mạch kinh điển đã có sẵn linh kiện và đường dây' : 'Start instantly from classic circuits with components pre-wired'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {SAMPLE_PROJECTS.slice(0, 3).map((template) => {
                  const diff = template.metadata?.difficulty || 'Dễ';
                  const diffColor =
                    diff === 'Dễ'
                      ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/40'
                      : diff === 'Trung bình'
                      ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/40'
                      : 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/40';

                  return (
                    <div
                      key={template.projectId}
                      className="tech-card p-5 rounded-[22px] flex flex-col justify-between space-y-4 group"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${diffColor}`}>
                              {diff}
                            </span>
                            {template.metadata?.category && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {template.metadata.category}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            {template.components.length} {language === 'vi' ? 'linh kiện' : 'components'} • {template.board.width}×{template.board.depth}mm
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition">
                          {template.name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {template.description}
                        </p>

                        {template.metadata?.learningObjectives && (
                          <div className="pt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                            🎯 {template.metadata.learningObjectives[0]}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleCreateFromTemplate(template)}
                        disabled={isCreating}
                        className="tech-btn-3d w-full py-2.5 px-4 text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>{language === 'vi' ? 'Sử dụng mẫu này' : 'Use this template'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* SAFE DELETE CONFIRMATION MODAL */}
        {/* ============================================================ */}
        {projectToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="tech-panel bg-white/95 dark:bg-[#071322]/95 border border-rose-300 dark:border-rose-500/40 rounded-[28px] max-w-md w-full p-6 sm:p-7 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),0_0_35px_rgba(244,63,94,0.2)] space-y-5 text-slate-800 dark:text-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 shadow-sm">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {language === 'vi' ? 'Xác nhận xóa vĩnh viễn dự án' : 'Confirm Permanent Deletion'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {language === 'vi' ? 'Hành động này không thể hoàn tác' : 'This action cannot be undone'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#050e1a] border border-[#d7e7f0] dark:border-slate-800 space-y-1.5">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'vi' ? 'Tên dự án sẽ bị xóa:' : 'Project to be deleted:'}
                </div>
                <div className="font-extrabold text-slate-900 dark:text-white text-sm">{projectToDelete.name}</div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500">
                  {language === 'vi' ? 'Mã dự án:' : 'Project ID:'} <span className="font-mono text-cyan-600 dark:text-cyan-400">{projectToDelete.projectId}</span>
                </div>
              </div>

              <p className="text-xs text-rose-600 dark:text-rose-300 leading-relaxed font-normal">
                {language === 'vi'
                  ? 'Cảnh báo: Toàn bộ linh kiện, đường nối và lịch sử phiên bản của dự án này sẽ bị xóa khỏi hệ thống máy chủ và bộ nhớ lưu trữ.'
                  : 'Warning: All components, wiring tracks, and version snapshots will be removed permanently.'}
              </p>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#d7e7f0] dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setProjectToDelete(null)}
                  disabled={isDeleting}
                  className="tech-btn-control px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  {language === 'vi' ? 'Hủy bỏ' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteProject}
                  disabled={isDeleting}
                  className="tech-btn-3d-rose px-5 py-2 text-xs font-extrabold flex items-center gap-1.5"
                >
                  {isDeleting ? (
                    <span>{language === 'vi' ? 'Đang xóa...' : 'Deleting...'}</span>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{language === 'vi' ? 'Xác nhận xóa' : 'Confirm Delete'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* RENAME MODAL */}
        {/* ============================================================ */}
        {projectToRename && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="tech-panel bg-white/95 dark:bg-[#071322]/95 border border-[#cbe6f7] dark:border-cyan-500/40 rounded-[28px] max-w-md w-full p-6 sm:p-7 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),0_0_35px_rgba(6,182,212,0.2)] space-y-4 text-slate-800 dark:text-slate-100">
              <div className="flex items-center justify-between border-b border-[#d7e7f0] dark:border-cyan-950/60 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span>{language === 'vi' ? 'Đổi tên dự án' : 'Rename Project'}</span>
                </h3>
                <button
                  onClick={() => setProjectToRename(null)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveRename} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === 'vi' ? 'Tên dự án mới' : 'New Project Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#061224] border border-[#cbe6f7] dark:border-cyan-900/60 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 shadow-xs"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setProjectToRename(null)}
                    className="tech-btn-control px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {language === 'vi' ? 'Hủy' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isRenaming}
                    className="tech-btn-3d px-5 py-2 text-xs font-extrabold"
                  >
                    {isRenaming ? (language === 'vi' ? 'Đang lưu...' : 'Saving...') : (language === 'vi' ? 'Lưu tên' : 'Save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VERSION HISTORY MODAL */}
        {/* ============================================================ */}
        {selectedHistoryProjectId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="tech-panel bg-white/95 dark:bg-[#071322]/95 border border-[#cbe6f7] dark:border-cyan-500/40 rounded-[28px] max-w-lg w-full p-6 sm:p-7 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),0_0_35px_rgba(6,182,212,0.2)] space-y-4 text-slate-800 dark:text-slate-100 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-[#d7e7f0] dark:border-cyan-950/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <History className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {language === 'vi' ? 'Lịch Sử Phiên Bản Dự Án' : 'Project Version History'}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedHistoryProjectId(null)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {versionsList.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400 dark:text-slate-500">
                    {language === 'vi' ? 'Chưa có bản chụp mốc lịch sử nào được ghi lại cho dự án này.' : 'No version snapshots recorded for this project yet.'}
                  </div>
                ) : (
                  versionsList.map((snap) => (
                    <div
                      key={snap.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#050e1a] border border-[#d7e7f0] dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 font-mono">
                          <span className="font-extrabold text-cyan-600 dark:text-cyan-400">#rev {snap.revision}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {new Date(snap.createdAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}
                          </span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 text-[11px]">{snap.note || (language === 'vi' ? 'Lưu tự động' : 'Auto-save')}</div>
                      </div>

                      <button
                        onClick={() => handleRestoreVersion(snap)}
                        className="tech-btn-control px-3 py-1.5 text-[11px] font-extrabold text-cyan-600 dark:text-cyan-400 hover:border-cyan-400"
                      >
                        {language === 'vi' ? 'Khôi phục' : 'Restore'}
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-[#d7e7f0] dark:border-cyan-950/60">
                <button
                  onClick={() => setSelectedHistoryProjectId(null)}
                  className="tech-btn-control px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  {language === 'vi' ? 'Đóng' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
