import React, { useState } from 'react';
import { ValidationIssue } from '../domain/validation/types';
import { SimulationResult } from '../domain/simulation/types';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Activity } from 'lucide-react';
import { useI18n } from '../i18n/context';

export interface ValidationPanelProps {
  issues: ValidationIssue[];
  simulationResult: SimulationResult | null;
  onFocusIssue: (componentId?: string) => void;
}

export const ValidationPanel: React.FC<ValidationPanelProps> = ({
  issues,
  simulationResult,
  onFocusIssue,
}) => {
  const { t, language } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'validation' | 'simulation'>('validation');

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-20 shrink-0 select-none transition-all">
      {/* Tab Header Bar */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          {/* Validation Tab */}
          <button
            onClick={() => {
              setActiveTab('validation');
              setIsExpanded(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition ${
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

          {/* Simulation Tab */}
          <button
            onClick={() => {
              setActiveTab('simulation');
              setIsExpanded(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition ${
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
                  simulationResult.issues.some((i) => i.toLowerCase().includes('đoản mạch') || i.toLowerCase().includes('short'))
                    ? 'bg-red-500 animate-ping'
                    : simulationResult.isClosedLoop
                    ? 'bg-emerald-500'
                    : 'bg-slate-400'
                }`}
              />
            )}
          </button>
        </div>

        {/* Expand / Collapse Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
          title={isExpanded ? (language === 'vi' ? 'Thu gọn bảng' : 'Collapse') : (language === 'vi' ? 'Mở rộng bảng' : 'Expand')}
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded Content Drawer */}
      {isExpanded && (
        <div className="h-44 overflow-y-auto p-3 text-xs">
          {activeTab === 'validation' ? (
            issues.length === 0 ? (
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
                        <div className="font-semibold text-slate-900 dark:text-slate-200">{iss.message}</div>
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
            )
          ) : (
            /* Simulation Tab Content */
            !simulationResult ? (
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
                        simulationResult.issues.some((i) => i.toLowerCase().includes('đoản mạch') || i.toLowerCase().includes('short'))
                          ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/40'
                          : simulationResult.isClosedLoop
                          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/40'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {simulationResult.issues.some((i) => i.toLowerCase().includes('đoản mạch') || i.toLowerCase().includes('short'))
                        ? (language === 'vi' ? 'ĐOẢN MẠCH (NGUY HIỂM)' : 'SHORT CIRCUIT')
                        : simulationResult.isClosedLoop
                        ? (language === 'vi' ? 'KHÉP KÍN (DẪN ĐIỆN)' : 'CLOSED LOOP (ACTIVE)')
                        : (language === 'vi' ? 'HỞ MẠCH' : 'OPEN CIRCUIT')}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                    {simulationResult.summary}
                  </div>
                </div>

                {/* Component conduction table */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(simulationResult.components).map(([cId, state]) => (
                    <div key={cId} className="p-2 rounded bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-[11px]">
                      <div className="font-semibold text-slate-800 dark:text-slate-300 truncate">{cId}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-slate-500 dark:text-slate-400">{language === 'vi' ? 'Trạng thái:' : 'State:'}</span>
                        <span className={state.isOn ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400 dark:text-slate-500'}>
                          {state.isOn ? (language === 'vi' ? 'BẬT (SÁNG)' : 'ON') : (language === 'vi' ? 'TẮT' : 'OFF')}
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
            )
          )}
        </div>
      )}
    </div>
  );
};
