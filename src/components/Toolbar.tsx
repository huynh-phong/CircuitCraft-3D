import React from 'react';
import {
  Undo2,
  Redo2,
  Play,
  Square,
  Cable,
  Scissors,
  Save,
  Check,
  Loader2,
  Download,
  Upload,
  Layers,
  Grid,
  Trash2,
  ArrowLeft,
} from 'lucide-react';
import { useI18n } from '../i18n/context';

export interface ToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  isSimulating: boolean;
  onToggleSimulation: () => void;
  isWiringMode: boolean;
  onToggleWiringMode: () => void;
  activeWireColor?: string;
  onChangeWireColor?: (color: string) => void;
  isCutMode?: boolean;
  onToggleCutMode?: () => void;
  onSave: () => void;
  isSaving?: boolean;
  saveSuccess?: boolean;
  onExportJson: () => void;
  onImportJson: () => void;
  hasSelection: boolean;
  onDeleteSelected: () => void;
  isPresentationMode: boolean;
  onTogglePresentation: () => void;
  qualityPreset: 'low' | 'balanced' | 'high';
  onChangeQuality: (q: 'low' | 'balanced' | 'high') => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  projectName: string;
  onRenameProject: () => void;
  onBackToProjectSelect?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isSimulating,
  onToggleSimulation,
  isWiringMode,
  onToggleWiringMode,
  activeWireColor = '#06b6d4',
  onChangeWireColor,
  isCutMode = false,
  onToggleCutMode,
  onSave,
  isSaving = false,
  saveSuccess = false,
  onExportJson,
  onImportJson,
  hasSelection,
  onDeleteSelected,
  isPresentationMode,
  onTogglePresentation,
  qualityPreset,
  onChangeQuality,
  showGrid,
  onToggleGrid,
  projectName,
  onRenameProject,
  onBackToProjectSelect,
}) => {
  const { t, language } = useI18n();

  const wireColors = [
    { hex: '#06b6d4', label: language === 'vi' ? 'Xanh Cyan (Tín hiệu)' : 'Cyan (Signal)' },
    { hex: '#ef4444', label: language === 'vi' ? 'Đỏ (VCC +)' : 'Red (VCC +)' },
    { hex: '#0f172a', label: language === 'vi' ? 'Đen (GND -)' : 'Black (GND -)' },
    { hex: '#22c55e', label: language === 'vi' ? 'Xanh lá (Dữ liệu)' : 'Green (Data)' },
    { hex: '#eab308', label: language === 'vi' ? 'Vàng (Xung/Clock)' : 'Yellow (Clock)' },
    { hex: '#3b82f6', label: language === 'vi' ? 'Xanh dương (I2C/SPI)' : 'Blue (I2C/SPI)' },
    { hex: '#f97316', label: language === 'vi' ? 'Cam (PWM)' : 'Orange (PWM)' },
    { hex: '#a855f7', label: language === 'vi' ? 'Tím (Aux)' : 'Purple (Aux)' },
  ];

  return (
    <div className="h-13 border-b border-[#d7e7f0] dark:border-cyan-950/40 bg-white/90 dark:bg-[#0c1422]/90 backdrop-blur-md px-4 py-1.5 flex items-center justify-between gap-3 z-20 select-none overflow-x-auto transition-colors shadow-xs">
      {/* Left: Project title & History */}
      <div className="flex items-center gap-2">
        {onBackToProjectSelect && (
          <button
            onClick={onBackToProjectSelect}
            className="tech-btn-control flex items-center gap-1.5 px-3 py-1.5 text-xs shrink-0 font-medium"
            title={t('editor.changeProject')}
          >
            <ArrowLeft className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span className="hidden sm:inline">{t('editor.changeProject')}</span>
          </button>
        )}

        <button
          onClick={onRenameProject}
          className="text-xs font-bold text-slate-800 dark:text-slate-100 hover:text-cyan-600 dark:hover:text-cyan-400 max-w-[180px] truncate px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left"
          title={t('project.rename')}
        >
          {projectName || t('editor.untitledProject')}
        </button>

        <div className="h-4 w-[1px] bg-slate-200 dark:border-cyan-950" />

        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="tech-btn-control p-1.5 disabled:opacity-30 disabled:hover:scale-100"
            title={`${t('editor.undo')} (Ctrl+Z)`}
            aria-label={t('editor.undo')}
          >
            <Undo2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="tech-btn-control p-1.5 disabled:opacity-30 disabled:hover:scale-100"
            title={`${t('editor.redo')} (Ctrl+Y)`}
            aria-label={t('editor.redo')}
          >
            <Redo2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
          </button>

          {hasSelection && (
            <button
              onClick={onDeleteSelected}
              className="p-1.5 rounded-xl text-rose-500 hover:text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-100 transition ml-1"
              title={`${t('editor.delete')} (Delete)`}
              aria-label={t('editor.delete')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Middle: Key Mode Actions (Wiring, Simulating, Presentation) */}
      <div className="flex items-center gap-2">
        {/* Wiring Mode Toggle */}
        <button
          onClick={onToggleWiringMode}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
            isWiringMode
              ? 'tech-btn-3d shadow-[0_6px_18px_rgba(6,182,212,0.4)]'
              : 'tech-btn-control'
          }`}
          title={`${t('wiring.wire')} (W)`}
        >
          <Cable className="w-3.5 h-3.5" />
          <span>{isWiringMode ? t('wiring.cancel') : t('wiring.wire')}</span>
        </button>

        {/* Quick Wire Color Palette when Wiring Mode is active */}
        {isWiringMode && onChangeWireColor && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-[#0c1320] border border-[#d7e7f0] dark:border-cyan-950 shadow-xs">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mr-0.5 hidden xl:inline font-medium">
              {language === 'vi' ? 'Màu dây:' : 'Wire:'}
            </span>
            {wireColors.map((wc) => (
              <button
                key={wc.hex}
                type="button"
                onClick={() => onChangeWireColor(wc.hex)}
                title={wc.label}
                className={`w-4 h-4 rounded-full transition-transform border ${
                  activeWireColor === wc.hex
                    ? 'scale-125 border-white ring-2 ring-cyan-500 shadow-xs'
                    : 'border-slate-400/40 opacity-75 hover:opacity-100 hover:scale-110'
                }`}
                style={{ backgroundColor: wc.hex }}
              />
            ))}
          </div>
        )}

        {/* Board Cut Tool Button (Immediately next to Wiring Mode) */}
        {onToggleCutMode && (
          <button
            onClick={onToggleCutMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              isCutMode
                ? 'tech-btn-3d-rose shadow-md shadow-rose-500/25'
                : 'tech-btn-control'
            }`}
            title={t('cut.title')}
          >
            <Scissors className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
            <span>{isCutMode ? t('cut.cancel') : t('cut.title')}</span>
          </button>
        )}

        {/* Behavioral Simulation Play/Stop with 3D green button */}
        <button
          onClick={onToggleSimulation}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
            isSimulating
              ? 'bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/30 border-t border-amber-200 border-b-2 border-amber-700 animate-pulse'
              : 'tech-btn-3d-green shadow-[0_6px_18px_rgba(16,185,129,0.35)]'
          }`}
          title={isSimulating ? t('editor.stop') : t('editor.run')}
        >
          {isSimulating ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{isSimulating ? t('editor.stop') : t('editor.simulation')}</span>
        </button>

        {/* Presentation / Exploded Mode */}
        <button
          onClick={onTogglePresentation}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            isPresentationMode
              ? 'bg-gradient-to-b from-indigo-500 via-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30 border-t border-indigo-300 border-b-2 border-indigo-900 font-bold'
              : 'tech-btn-control'
          }`}
          title={t('editor.presentation')}
        >
          <Layers className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
          <span>{t('editor.presentation')}</span>
        </button>
      </div>

      {/* Right: File Ops, Grid, Quality */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleGrid}
          className={`tech-btn-control p-1.5 ${
            showGrid
              ? 'border-cyan-400 text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60'
              : ''
          }`}
          title={t('editor.grid')}
          aria-label={t('editor.grid')}
        >
          <Grid className="w-3.5 h-3.5" />
        </button>

        <select
          value={qualityPreset}
          onChange={(e) => onChangeQuality(e.target.value as any)}
          className="tech-input text-[11px] py-1 px-2 cursor-pointer font-medium"
          title="Graphics Quality"
        >
          <option value="low">{t('editor.qualityLow')}</option>
          <option value="balanced">{t('editor.qualityBalanced')}</option>
          <option value="high">{t('editor.qualityHigh')}</option>
        </select>

        <div className="h-4 w-[1px] bg-slate-200 dark:border-cyan-950" />

        <button
          onClick={onSave}
          disabled={isSaving}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all rounded-xl cursor-pointer shadow-xs ${
            saveSuccess
              ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-400 dark:border-emerald-500 shadow-[0_2px_10px_rgba(16,185,129,0.25)]'
              : 'tech-btn-control text-cyan-700 dark:text-cyan-300 hover:text-cyan-600 dark:hover:text-cyan-400'
          }`}
          title={`${t('editor.save')} (Ctrl+S)`}
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500" />
          ) : saveSuccess ? (
            <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[2.5]" />
          ) : (
            <Save className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          )}
          <span className="hidden sm:inline">
            {isSaving
              ? language === 'vi'
                ? 'Đang lưu...'
                : 'Saving...'
              : saveSuccess
              ? language === 'vi'
                ? 'Đã lưu vào Dự án!'
                : 'Saved to Projects!'
              : language === 'vi'
              ? 'Lưu vào Dự án'
              : t('editor.save')}
          </span>
        </button>

        <button
          onClick={onExportJson}
          className="tech-btn-control p-1.5"
          title={t('editor.export')}
          aria-label={t('editor.export')}
        >
          <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
        </button>

        <button
          onClick={onImportJson}
          className="tech-btn-control p-1.5"
          title={t('editor.import')}
          aria-label={t('editor.import')}
        >
          <Upload className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
        </button>
      </div>
    </div>
  );
};
