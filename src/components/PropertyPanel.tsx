import React, { useState } from 'react';
import { ComponentInstance, Connection, BoardDefinition, WireStyle } from '../domain/project/types';
import { getResistorColorBands } from '../domain/components/colorCode';
import { COMPONENT_DEFINITIONS, getComponentDefinition } from '../domain/components/definitions';
import {
  RotateCw,
  RotateCcw,
  Trash2,
  Spline,
  CornerDownRight,
  Minus,
  MoveVertical,
  PanelRightClose,
  Box,
  Layers,
  Cpu,
  Info,
  ChevronDown,
  ChevronRight,
  Zap,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { useI18n } from '../i18n/context';

export interface PropertyPanelProps {
  selectedComponent: ComponentInstance | null;
  selectedConnection: Connection | null;
  board: BoardDefinition;
  componentsCount: number;
  connectionsCount: number;
  onUpdateComponentParams: (id: string, params: Record<string, any>) => void;
  onUpdateComponentName: (id: string, name: string) => void;
  onRotateComponent: (id: string, angleDelta: number) => void;
  onDeleteComponent: (id: string) => void;
  onDeleteConnection: (id: string) => void;
  onUpdateWireColor: (id: string, color: string) => void;
  onUpdateWireThickness?: (id: string, thickness: number) => void;
  onUpdateWireStyle?: (id: string, style: WireStyle) => void;
  onUpdateWireSag?: (id: string, sag: number) => void;
  onUpdateBoardColor: (colorHex: string) => void;
  onChangeBoardShape?: (shape: 'rectangle' | 'square' | 'circle' | 'triangle') => void;
  onChangeBoardDimensions?: (width: number, depth: number) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedComponent,
  selectedConnection,
  board,
  componentsCount,
  connectionsCount,
  onUpdateComponentParams,
  onUpdateComponentName,
  onRotateComponent,
  onDeleteComponent,
  onDeleteConnection,
  onUpdateWireColor,
  onUpdateWireThickness,
  onUpdateWireStyle,
  onUpdateWireSag,
  onUpdateBoardColor,
  onChangeBoardShape,
  onChangeBoardDimensions,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { t, language } = useI18n();
  const [showPinsList, setShowPinsList] = useState(false);

  if (isCollapsed) {
    return null;
  }

  const panelTitle = language === 'vi' ? 'Thông tin & chỉ số' : 'Info & Parameters';

  return (
    <aside className="absolute top-4 right-4 bottom-14 short:top-2 short:right-2 short:bottom-2 short:w-72 z-20 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200/90 dark:border-cyan-900/60 bg-white/95 dark:bg-[#0c1424]/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200 select-none">
      {/* Top Universal Panel Header */}
      <div className="px-4 py-2.5 border-b border-[#d7e7f0] dark:border-cyan-950/40 flex items-center justify-between bg-slate-50/50 dark:bg-[#070e1c]/40 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-xs" />
          <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
            {panelTitle}
          </span>
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={language === 'vi' ? 'Thu gọn bảng thông tin & chỉ số' : 'Collapse panel'}
            aria-label="Collapse panel"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="overflow-y-auto flex-1">
        {selectedComponent ? (() => {
        const def =
          getComponentDefinition(selectedComponent.definitionId) ||
          COMPONENT_DEFINITIONS.find((d) => d.definitionId === selectedComponent.definitionId);

        return (
          /* Component Selected View */
          <div className="p-4 space-y-4">
            {/* 1. Header & Actions */}
            <div className="flex items-center justify-between pb-2.5 border-b border-[#d7e7f0] dark:border-cyan-950/60">
              <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-xs" />
                {t('prop.componentProps')}
              </span>
              <button
                onClick={() => onDeleteComponent(selectedComponent.instanceId)}
                className="p-1.5 rounded-xl text-rose-500 hover:text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-100 transition cursor-pointer"
                title={t('editor.delete')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* 2. Visual Identity & Model Badges */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#070e1c] border border-slate-200/90 dark:border-cyan-950/50 flex items-center gap-3">
              {def?.imageUrl ? (
                <div className="w-12 h-12 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-cyan-950/60 overflow-hidden flex items-center justify-center shrink-0 p-1">
                  <img
                    src={def.imageUrl}
                    alt={def.name}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg bg-slate-200/60 dark:bg-slate-900 border border-slate-200/80 dark:border-cyan-950/60 flex items-center justify-center shrink-0 text-slate-400">
                  <Box className="w-6 h-6 text-cyan-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {def?.name || selectedComponent.definitionId}
                </div>
                <div className="flex flex-wrap items-center gap-1 mt-1">
                  {def?.modelUrl && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 font-semibold flex items-center gap-1">
                      <Box className="w-2.5 h-2.5" />
                      3D Model GLB
                    </span>
                  )}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/50 font-mono font-medium uppercase">
                    {def?.category || 'component'}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Name Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
                {t('prop.name')}
              </label>
              <input
                type="text"
                value={selectedComponent.name}
                onChange={(e) => onUpdateComponentName(selectedComponent.instanceId, e.target.value)}
                className="tech-input w-full px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 rounded-xl"
              />
            </div>

            {/* 4. Detailed Description (Thông tin chi tiết) */}
            {def?.description && (
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Info className="w-3 h-3 text-cyan-500" />
                  {language === 'vi' ? 'Thông tin chi tiết:' : 'Detailed Description:'}
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50/80 dark:bg-[#070e1c]/80 p-2.5 rounded-xl border border-slate-200/80 dark:border-cyan-950/40 leading-relaxed">
                  {def.description}
                </p>
              </div>
            )}

            {/* 5. Technical Specifications & Indicators (Chỉ số kỹ thuật) */}
            <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-50/80 dark:bg-[#070e1c]/80 border border-slate-200/80 dark:border-cyan-950/40">
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <Layers className="w-3 h-3 text-cyan-500" />
                {language === 'vi' ? 'Chỉ số & Kích thước' : 'Specifications & Indicators'}
              </span>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div className="flex flex-col bg-white dark:bg-slate-900/60 p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800/80">
                  <span className="text-slate-500 text-[10px]">{language === 'vi' ? 'Kích thước 3D' : 'Dimensions'}</span>
                  <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                    {def ? `${def.dimensions.x}×${def.dimensions.z}×${def.dimensions.y}mm` : 'N/A'}
                  </span>
                </div>
                <div className="flex flex-col bg-white dark:bg-slate-900/60 p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800/80">
                  <span className="text-slate-500 text-[10px]">{language === 'vi' ? 'Đóng gói' : 'Footprint'}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">
                    {def?.footprintType || 'through-hole'}
                  </span>
                </div>
                <div className="flex flex-col bg-white dark:bg-slate-900/60 p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800/80">
                  <span className="text-slate-500 text-[10px]">{language === 'vi' ? 'Số chân kết nối' : 'Pin Count'}</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {def?.pins.length || 0} {language === 'vi' ? 'chân' : 'pins'}
                  </span>
                </div>
                <div className="flex flex-col bg-white dark:bg-slate-900/60 p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800/80">
                  <span className="text-slate-500 text-[10px]">{language === 'vi' ? 'Trạng thái' : 'Status'}</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Sẵn sàng
                  </span>
                </div>
              </div>
            </div>

            {/* 6. Position & Orientation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
                <span>{t('prop.coordinates')}</span>
                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  X: {selectedComponent.position.x.toFixed(1)} | Z: {selectedComponent.position.z.toFixed(1)} mm
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onRotateComponent(selectedComponent.instanceId, -90)}
                  className="tech-btn-control flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>-90°</span>
                </button>
                <button
                  onClick={() => onRotateComponent(selectedComponent.instanceId, 90)}
                  className="tech-btn-control flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold"
                >
                  <RotateCw className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>+90°</span>
                </button>
              </div>
            </div>

            {/* 7. Dedicated Parameters Section */}

            {/* Arduino UNO Parameters */}
            {(selectedComponent.definitionId === 'arduino-uno' || selectedComponent.definitionId === 'arduino_uno') && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#070e1c] border border-cyan-500/30 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-teal-500" />
                    {language === 'vi' ? 'Cấu hình Arduino UNO' : 'Arduino UNO Setup'}
                  </span>
                  <span className="font-mono text-[10px] text-teal-600 dark:text-teal-400">16 MHz ATmega328P</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    {language === 'vi' ? 'Chương trình nhúng nạp sẵn:' : 'Embedded Program:'}
                  </label>
                  <select
                    value={selectedComponent.parameters?.codeProgram || 'blink_led'}
                    onChange={(e) =>
                      onUpdateComponentParams(selectedComponent.instanceId, {
                        ...selectedComponent.parameters,
                        codeProgram: e.target.value,
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-cyan-950/60 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:border-cyan-500"
                  >
                    <option value="blink_led">{language === 'vi' ? 'Blink LED D13 (1Hz chu kỳ chuẩn)' : 'Blink LED D13 (1Hz)'}</option>
                    <option value="button_read">{language === 'vi' ? 'Đọc nút bấm D12 điều khiển LED' : 'Read Pushbutton D12'}</option>
                    <option value="analog_read">{language === 'vi' ? 'Đọc biến trở Analog A0' : 'Read Analog A0 Potentiometer'}</option>
                    <option value="servo_control">{language === 'vi' ? 'Điều khiển góc Servo PWM D9' : 'Control Servo PWM D9'}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    {language === 'vi' ? 'Điện áp Logic chân cấp:' : 'Logic Voltage:'}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[5.0, 3.3].map((v) => (
                      <button
                        key={v}
                        onClick={() =>
                          onUpdateComponentParams(selectedComponent.instanceId, {
                            ...selectedComponent.parameters,
                            operatingVoltage: v,
                          })
                        }
                        className={`py-1 rounded text-xs font-mono font-semibold transition ${
                          (selectedComponent.parameters?.operatingVoltage || 5.0) === v
                            ? 'bg-teal-500 text-slate-950 font-bold shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        {v}V {v === 5.0 ? '(Chuẩn)' : '(Low Power)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Breadboard Parameters */}
            {selectedComponent.definitionId === 'breadboard' && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#070e1c] border border-cyan-500/30 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-500" />
                    {language === 'vi' ? 'Thông số Breadboard' : 'Breadboard Specs'}
                  </span>
                  <span className="font-mono text-[10px] text-cyan-600 dark:text-cyan-400">Solderless Prototyping</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    {language === 'vi' ? 'Quy cách điểm cắm (Tie-points):' : 'Tie-Points Specification:'}
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { val: 400, label: '400 (Half)' },
                      { val: 830, label: '830 (Full)' },
                      { val: 170, label: '170 (Mini)' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        onClick={() =>
                          onUpdateComponentParams(selectedComponent.instanceId, {
                            ...selectedComponent.parameters,
                            tiePoints: opt.val,
                          })
                        }
                        className={`py-1 px-1 rounded text-[11px] font-mono transition text-center ${
                          (selectedComponent.parameters?.tiePoints || 400) === opt.val
                            ? 'bg-cyan-500 text-slate-950 font-bold shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    {language === 'vi' ? 'Điện áp thanh bus nguồn (+/-):' : 'Bus Rail Voltage (+/-):'}
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {[5.0, 3.3, 12.0].map((v) => (
                      <button
                        key={v}
                        onClick={() =>
                          onUpdateComponentParams(selectedComponent.instanceId, {
                            ...selectedComponent.parameters,
                            railVoltage: v,
                          })
                        }
                        className={`py-1 rounded text-xs font-mono font-semibold transition ${
                          (selectedComponent.parameters?.railVoltage || 5.0) === v
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        {v}V
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    {language === 'vi' ? 'Ghi chú bo mạch:' : 'Board Notes:'}
                  </label>
                  <input
                    type="text"
                    value={selectedComponent.parameters?.notes || ''}
                    onChange={(e) =>
                      onUpdateComponentParams(selectedComponent.instanceId, {
                        ...selectedComponent.parameters,
                        notes: e.target.value,
                      })
                    }
                    placeholder={language === 'vi' ? 'Ghi chú cắm linh kiện...' : 'Notes...'}
                    className="w-full px-2.5 py-1 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-cyan-950/60 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
            )}

            {/* Resistor Parameters */}
            {selectedComponent.definitionId === 'resistor' && (
              <div className="tech-card-nested space-y-2.5 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">
                    {language === 'vi' ? 'Trị số điện trở:' : 'Resistance:'}
                  </span>
                  <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                    {selectedComponent.parameters?.resistance || 220} Ω
                  </span>
                </div>

                {/* Common Values Presets */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[100, 220, 330, 470, 1000, 4700, 10000, 100000].map((val) => (
                    <button
                      key={val}
                      onClick={() =>
                        onUpdateComponentParams(selectedComponent.instanceId, {
                          ...selectedComponent.parameters,
                          resistance: val,
                        })
                      }
                      className={`px-1 py-1 rounded-lg text-[10px] font-mono transition-all cursor-pointer ${
                        selectedComponent.parameters?.resistance === val
                          ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-bold shadow-xs'
                          : 'tech-btn-control'
                      }`}
                    >
                      {val >= 1000 ? `${val / 1000}k` : `${val}Ω`}
                    </button>
                  ))}
                </div>

                {/* 4-Color Band Visual preview */}
                {(() => {
                  const ohms = selectedComponent.parameters?.resistance || 220;
                  const bands = getResistorColorBands(ohms);
                  return (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {language === 'vi' ? 'Vạch màu chuẩn EIA:' : 'EIA Color code:'}
                      </span>
                      <div className="flex items-center h-4 rounded-full overflow-hidden border border-slate-300 dark:border-slate-700">
                        <div className="flex-1 h-full" style={{ backgroundColor: bands.hex1 }} title={bands.band1} />
                        <div className="flex-1 h-full" style={{ backgroundColor: bands.hex2 }} title={bands.band2} />
                        <div className="flex-1 h-full" style={{ backgroundColor: bands.hexMultiplier }} title={bands.multiplier} />
                        <div className="flex-1 h-full" style={{ backgroundColor: bands.hexTolerance }} title={bands.tolerance} />
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* LED Parameters */}
            {selectedComponent.definitionId === 'led' && (
              <div className="space-y-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  {language === 'vi' ? 'Màu sắc LED phát quang:' : 'LED Color:'}
                </span>
                <div className="flex items-center gap-2 pt-1">
                  {[
                    { id: 'red', hex: '#ef4444', label: 'Đỏ' },
                    { id: 'green', hex: '#22c55e', label: 'Xanh lá' },
                    { id: 'blue', hex: '#3b82f6', label: 'Xanh dương' },
                    { id: 'yellow', hex: '#eab308', label: 'Vàng' },
                    { id: 'white', hex: '#f8fafc', label: 'Trắng' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      onClick={() =>
                        onUpdateComponentParams(selectedComponent.instanceId, {
                          ...selectedComponent.parameters,
                          color: c.id,
                        })
                      }
                      className={`w-7 h-7 rounded-full transition flex items-center justify-center border-2 cursor-pointer ${
                        (selectedComponent.parameters?.color || 'red') === c.id
                          ? 'border-cyan-500 scale-110 shadow-md'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* DC Source Parameters */}
            {selectedComponent.definitionId === 'dc-source' && (
              <div className="space-y-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  {language === 'vi' ? 'Điện áp nguồn cấp (V):' : 'DC Supply Voltage (V):'}
                </span>
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[3.3, 5.0, 9.0, 12.0].map((v) => (
                    <button
                      key={v}
                      onClick={() =>
                        onUpdateComponentParams(selectedComponent.instanceId, {
                          ...selectedComponent.parameters,
                          voltage: v,
                        })
                      }
                      className={`px-2 py-1.5 rounded text-xs font-mono font-medium transition cursor-pointer ${
                        selectedComponent.parameters?.voltage === v
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-transparent'
                      }`}
                    >
                      {v}V
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Switch Parameters */}
            {selectedComponent.definitionId === 'switch' && (
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  {language === 'vi' ? 'Trạng thái tiếp điểm:' : 'Switch State:'}
                </span>
                <button
                  onClick={() =>
                    onUpdateComponentParams(selectedComponent.instanceId, {
                      ...selectedComponent.parameters,
                      open: !selectedComponent.state?.open,
                    })
                  }
                  className={`w-full py-1.5 px-3 rounded text-xs font-medium transition cursor-pointer ${
                    selectedComponent.state?.open === false
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300'
                  }`}
                >
                  {selectedComponent.state?.open === false
                    ? (language === 'vi' ? 'Đang ĐÓNG (Dẫn điện)' : 'CLOSED (Conducting)')
                    : (language === 'vi' ? 'Đang MỞ (Ngắt điện)' : 'OPEN (Disconnected)')}
                </button>
              </div>
            )}

            {/* 8. Pinout & Terminals Breakdown (Sơ đồ chân) */}
            {def?.pins && def.pins.length > 0 && (
              <div className="border border-slate-200/90 dark:border-cyan-950/50 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowPinsList(!showPinsList)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-[#070e1c] flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    {language === 'vi' ? 'Sơ đồ chân & Điểm nối' : 'Pinout & Terminals'}
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 font-mono">
                      {def.pins.length}
                    </span>
                  </span>
                  {showPinsList ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {showPinsList && (
                  <div className="p-2 space-y-1.5 max-h-48 overflow-y-auto bg-white dark:bg-[#0a1222] text-[11px] divide-y divide-slate-100 dark:divide-slate-800">
                    {def.pins.map((pin) => (
                      <div key={pin.id} className="pt-1.5 first:pt-0 flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-cyan-600 dark:text-cyan-400 shrink-0">
                            {pin.designator || pin.id}
                          </span>
                          <span className="text-slate-700 dark:text-slate-300 truncate font-medium">
                            {pin.name}
                          </span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase font-mono shrink-0">
                          {pin.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })() : selectedConnection ? (
        /* Wire Connection Selected View */
        <div className="p-3.5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedConnection.wireColor || '#06b6d4' }} />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                {t('prop.wireProps')}
              </span>
            </div>
            <button
              onClick={() => onDeleteConnection(selectedConnection.id)}
              className="p-1.5 rounded text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 transition flex items-center gap-1"
              title={t('editor.delete')}
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-[10px]">{t('editor.delete')}</span>
            </button>
          </div>

          {/* Connection Terminals Summary */}
          <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">{language === 'vi' ? 'Đầu nối 1:' : 'Terminal 1:'}</span>
              <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                {selectedConnection.fromComponentId} <span className="text-slate-500 font-normal">({selectedConnection.fromPinId})</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">{language === 'vi' ? 'Đầu nối 2:' : 'Terminal 2:'}</span>
              <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                {selectedConnection.toComponentId} <span className="text-slate-500 font-normal">({selectedConnection.toPinId})</span>
              </span>
            </div>
          </div>

          {/* 1. Wire Routing Style */}
          <div className="space-y-2">
            <label className="text-[11px] text-slate-700 dark:text-slate-300 font-medium flex items-center justify-between">
              <span>{language === 'vi' ? 'Kiểu uốn dây:' : 'Routing Style:'}</span>
              <span className="text-[10px] text-cyan-600 dark:text-cyan-400 capitalize font-mono">
                {selectedConnection.wireStyle === 'orthogonal'
                  ? (language === 'vi' ? 'Vuông góc 90°' : 'Orthogonal 90°')
                  : selectedConnection.wireStyle === 'straight'
                  ? (language === 'vi' ? 'Thẳng tắp' : 'Straight')
                  : (language === 'vi' ? 'Cong mềm mại' : 'Curved')}
              </span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onUpdateWireStyle && onUpdateWireStyle(selectedConnection.id, 'curved')}
                className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-medium transition gap-1 ${
                  !selectedConnection.wireStyle || selectedConnection.wireStyle === 'curved'
                    ? 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-500 text-cyan-700 dark:text-cyan-300 font-bold'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Spline className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span className="text-[10px]">{language === 'vi' ? 'Cong' : 'Curved'}</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateWireStyle && onUpdateWireStyle(selectedConnection.id, 'orthogonal')}
                className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-medium transition gap-1 ${
                  selectedConnection.wireStyle === 'orthogonal'
                    ? 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-500 text-cyan-700 dark:text-cyan-300 font-bold'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <CornerDownRight className="w-4 h-4 text-amber-500" />
                <span className="text-[10px]">{language === 'vi' ? 'Vuông 90°' : '90° Angle'}</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateWireStyle && onUpdateWireStyle(selectedConnection.id, 'straight')}
                className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-medium transition gap-1 ${
                  selectedConnection.wireStyle === 'straight'
                    ? 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-500 text-cyan-700 dark:text-cyan-300 font-bold'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Minus className="w-4 h-4 text-emerald-500" />
                <span className="text-[10px]">{language === 'vi' ? 'Thẳng' : 'Straight'}</span>
              </button>
            </div>
          </div>

          {/* 2. Wire Thickness */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-700 dark:text-slate-300 font-medium">
              <span>{t('prop.thickness')}</span>
              <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold text-xs">
                {(selectedConnection.thickness ?? 0.55).toFixed(2)} mm
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1 text-[10px]">
              {[
                { label: language === 'vi' ? 'Mảnh' : 'Thin', val: 0.35 },
                { label: language === 'vi' ? 'Chuẩn' : 'Std', val: 0.55 },
                { label: language === 'vi' ? 'Dày' : 'Thick', val: 0.9 },
                { label: language === 'vi' ? 'To' : 'Max', val: 1.4 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onUpdateWireThickness && onUpdateWireThickness(selectedConnection.id, p.val)}
                  className={`py-1 rounded border font-medium transition ${
                    Math.abs((selectedConnection.thickness ?? 0.55) - p.val) < 0.05
                      ? 'bg-cyan-600 text-white border-cyan-500 font-bold'
                      : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <input
              type="range"
              min="0.25"
              max="2.0"
              step="0.05"
              value={selectedConnection.thickness ?? 0.55}
              onChange={(e) =>
                onUpdateWireThickness && onUpdateWireThickness(selectedConnection.id, parseFloat(e.target.value))
              }
              className="w-full accent-cyan-500 bg-slate-200 dark:bg-slate-950 h-1.5 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* 3. Wire Sag */}
          {selectedConnection.wireStyle !== 'straight' && (
            <div className="space-y-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                <span className="flex items-center gap-1">
                  <MoveVertical className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>{t('prop.sag')}</span>
                </span>
                <span className="font-mono text-cyan-600 dark:text-cyan-400 text-xs">
                  {((selectedConnection.sag ?? 1.0) * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.4"
                max="2.4"
                step="0.1"
                value={selectedConnection.sag ?? 1.0}
                onChange={(e) =>
                  onUpdateWireSag && onUpdateWireSag(selectedConnection.id, parseFloat(e.target.value))
                }
                className="w-full accent-cyan-500 bg-slate-200 dark:bg-slate-900 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          )}

          {/* 4. Wire Colors */}
          <div className="space-y-2">
            <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium flex items-center justify-between">
              <span>{t('prop.color')}</span>
              <span className="font-mono text-[10px] text-slate-500">{selectedConnection.wireColor || '#06b6d4'}</span>
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { hex: '#ef4444', label: 'Đỏ (VCC)' },
                { hex: '#0f172a', label: 'Đen (GND)' },
                { hex: '#3b82f6', label: 'Xanh dương' },
                { hex: '#10b981', label: 'Xanh lá' },
                { hex: '#f59e0b', label: 'Vàng' },
                { hex: '#8b5cf6', label: 'Tím' },
                { hex: '#f97316', label: 'Cam' },
                { hex: '#06b6d4', label: 'Cyan' },
              ].map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => onUpdateWireColor(selectedConnection.id, c.hex)}
                  className={`flex items-center gap-1.5 p-1 rounded-md border text-[10px] transition ${
                    selectedConnection.wireColor === c.hex
                      ? 'border-cyan-500 bg-cyan-50 dark:bg-slate-800 text-cyan-900 dark:text-white font-bold'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                  title={c.label}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 border border-slate-300 dark:border-white/20"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="truncate">{c.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Default Board View */
        <div className="p-3.5 space-y-4">
          <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider">
              {t('prop.boardProps')}
            </span>
          </div>

          {/* Board stats */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">{t('component.title')}</span>
              <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{componentsCount}</div>
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">{t('wiring.wire')}</span>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{connectionsCount}</div>
            </div>
          </div>

          {/* Board Shape Selection */}
          <div className="space-y-2">
            <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">{t('prop.shape')}</span>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'rectangle', label: language === 'vi' ? 'Hình chữ nhật' : 'Rectangle' },
                { id: 'square', label: language === 'vi' ? 'Hình vuông' : 'Square' },
                { id: 'circle', label: language === 'vi' ? 'Hình tròn' : 'Circle' },
                { id: 'triangle', label: language === 'vi' ? 'Hình tam giác' : 'Triangle' },
              ].map((s) => {
                const currentShape = board.shape || 'rectangle';
                const isSelected = currentShape === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onChangeBoardShape && onChangeBoardShape(s.id as any)}
                    className={`px-2 py-1.5 rounded text-xs font-medium border text-left transition ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-200 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Board Dimensions */}
          <div className="space-y-2">
            <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">{t('prop.dimensions')}</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">{t('prop.width')}</label>
                <input
                  type="number"
                  min="30"
                  max="300"
                  step={board.gridSpacing || 2.54}
                  value={board.width}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 30 && onChangeBoardDimensions) {
                      onChangeBoardDimensions(val, board.depth);
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">{t('prop.depth')}</label>
                <input
                  type="number"
                  min="30"
                  max="300"
                  step={board.gridSpacing || 2.54}
                  value={board.depth}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 30 && onChangeBoardDimensions) {
                      onChangeBoardDimensions(board.width, val);
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Solder Mask Color Selection */}
          <div className="space-y-2">
            <span className="text-[11px] text-slate-700 dark:text-slate-400 font-medium">{t('prop.solderMask')}</span>
            <div className="flex items-center gap-2">
              {[
                { hex: '#104936', label: 'Xanh lá truyền thống' },
                { hex: '#0e3952', label: 'Xanh dương kỹ thuật' },
                { hex: '#18181b', label: 'Đen nhám Matte' },
                { hex: '#4c1d95', label: 'Tím OSH Park' },
              ].map((c) => (
                <button
                  key={c.hex}
                  onClick={() => onUpdateBoardColor(c.hex)}
                  className={`w-7 h-7 rounded-lg transition border-2 ${
                    board.solderMaskColor === c.hex ? 'border-cyan-500 scale-105' : 'border-transparent opacity-80'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-500/20 text-cyan-800 dark:text-cyan-300 text-[11px] leading-relaxed">
            💡 {language === 'vi'
              ? 'Mẹo: Bạn có thể click vào bất kỳ linh kiện nào để xoay hoặc chỉnh trị số, hoặc click vào chân để kéo dây nối trong không gian 3D.'
              : 'Tip: Click any component to rotate or edit values, or click pins to draw wires in 3D.'}
          </div>
        </div>
      )}
      </div>
    </aside>
  );
};
