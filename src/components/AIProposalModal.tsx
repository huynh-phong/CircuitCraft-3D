import React from 'react';
import { AIProposal } from '../ai/types';
import { Sparkles, X, Check, ArrowRight, Layers } from 'lucide-react';
import { useI18n } from '../i18n/context';

export interface AIProposalModalProps {
  proposal: AIProposal | null;
  onClose: () => void;
  onApply: (proposal: AIProposal) => void;
}

export const AIProposalModal: React.FC<AIProposalModalProps> = ({
  proposal,
  onClose,
  onApply,
}) => {
  const { language } = useI18n();

  if (!proposal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in select-none">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-gradient-to-r dark:from-cyan-950 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-500/20 border border-cyan-200 dark:border-cyan-500/40 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {language === 'vi' ? 'Đề xuất thiết kế từ AI Assistant' : 'AI Assistant Design Proposal'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'vi' ? 'Kiểm tra thông tin thay đổi trước khi áp dụng vào mạch' : 'Review changes before applying to the circuit'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Explanation */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
              {language === 'vi' ? 'Mô tả giải pháp' : 'Solution Description'}
            </span>
            <p className="text-slate-800 dark:text-slate-200 leading-relaxed">{proposal.explanation}</p>
          </div>

          {/* Planned Components */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              {language === 'vi'
                ? `Linh kiện sẽ được thêm mới (${proposal.componentsToAdd.length})`
                : `Components to be added (${proposal.componentsToAdd.length})`}
            </span>
            <div className="grid grid-cols-2 gap-2">
              {proposal.componentsToAdd.map((comp, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
                  <div className="font-semibold text-slate-900 dark:text-slate-200">{comp.name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    {language === 'vi' ? 'Loại:' : 'Type:'} {comp.definitionId} | X:{comp.position.x}, Z:{comp.position.z}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Planned Connections */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              {language === 'vi'
                ? `Dây nối mạch mới (${proposal.connectionsToAdd.length})`
                : `New circuit connections (${proposal.connectionsToAdd.length})`}
            </span>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {proposal.connectionsToAdd.map((conn, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-slate-700 dark:text-slate-300"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: conn.wireColor || '#06b6d4' }} />
                    <span className="font-mono">{conn.fromComponentId} ({conn.fromPinId})</span>
                    <ArrowRight className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                    <span className="font-mono">{conn.toComponentId} ({conn.toPinId})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition"
          >
            {language === 'vi' ? 'Hủy bỏ' : 'Cancel'}
          </button>
          <button
            onClick={() => onApply(proposal)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/30 transition"
          >
            <Check className="w-4 h-4" />
            <span>{language === 'vi' ? 'Áp dụng vào mạch' : 'Apply to Circuit'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
