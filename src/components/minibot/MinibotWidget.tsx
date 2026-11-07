import { ChatMarkdown } from '../ui/ChatMarkdown';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bot,
  Sparkles,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Send,
  RotateCcw,
  Trash2,
  Zap,
  ArrowRight,
  ChevronRight,
  Loader2,
  Cpu,
} from 'lucide-react';
import { ValidationResult, ProjectDocument, AIProposal } from '../../types/circuit.ts';
import { AIAssistantService } from '../../services/aiAssistantService.ts';
import { minibotChatService } from '../../ai/minibotChatService.ts';
import { AIChatMessage } from '../../ai/types.ts';

export type MinibotMood = 'idle' | 'guiding' | 'thinking' | 'warning' | 'success';

interface MinibotWidgetProps {
  document: ProjectDocument;
  validationResult: ValidationResult;
  isSimulating: boolean;
  onApplyProposal: (proposal: AIProposal) => void;
}

export const MinibotWidget: React.FC<MinibotWidgetProps> = ({
  document: doc,
  validationResult,
  isSimulating: _isSimulating,
  onApplyProposal,
}) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [messages, setMessages] = useState<AIChatMessage[]>(() => minibotChatService.getMessages());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to Minibot chat messages service
  useEffect(() => {
    setMessages(minibotChatService.getMessages());
    const unsubscribe = minibotChatService.subscribe(() => {
      setMessages(minibotChatService.getMessages());
    });
    return unsubscribe;
  }, []);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (isChatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen, isLoadingAI]);

  const quickPrompts = [
    'Giải thích nguyên lý hoạt động của mạch này',
    'Kiểm tra xem mạch có nguy cơ đoản mạch hay cháy linh kiện không?',
    'Đề xuất cách mắc thêm công tắc SPST vào mạch',
    'Tối ưu hóa các chân cắm và đường dây nối',
  ];

  const handleAskAI = async (customPrompt?: string) => {
    const text = customPrompt || promptInput;
    if (!text.trim() || isLoadingAI) return;

    const userMessage: AIChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    await minibotChatService.addMessage(userMessage);
    setPromptInput('');
    setIsLoadingAI(true);
    setErrorMessage(null);

    try {
      const proposal = await AIAssistantService.requestCircuitProposal(text, doc, 'suggest_fix');

      const assistantMessage: AIChatMessage = {
        id: `msg-ai-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        role: 'assistant',
        content: proposal.explanation || proposal.summary || 'Đây là giải pháp Minibot đề xuất cho mạch của bạn:',
        timestamp: new Date().toISOString(),
        proposal,
      };

      await minibotChatService.addMessage(assistantMessage);
    } catch (err: any) {
      const errMsg = err?.message || 'Không thể kết nối với máy chủ AI. Vui lòng thử lại sau.';
      setErrorMessage(errMsg);
      await minibotChatService.addMessage({
        id: `msg-err-${Date.now()}`,
        role: 'system',
        content: `Lỗi kết nối AI: ${errMsg}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('Bạn có chắc muốn xóa lịch sử trò chuyện với Minibot?')) {
      await minibotChatService.clearChat();
      setErrorMessage(null);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 select-none">
      {/* 1. Floating Action Trigger Button (identical animation & style as homepage chatbot) */}
      <AnimatePresence>
        {!isChatOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            {/* Tooltip bubble with smooth entrance/exit */}
            <AnimatePresence>
              {showTooltip && (
                <motion.div
                  initial={{ opacity: 0, x: 10, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 10, scale: 0.95 }}
                  className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap px-3 py-1.5 rounded-xl bg-slate-900/95 dark:bg-[#061224]/95 text-white text-xs font-semibold border border-cyan-500/40 shadow-xl shadow-cyan-500/10 flex items-center gap-1.5 pointer-events-none"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Trợ lý mạch 3D • Hỏi Minibot AI</span>
                  <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-slate-900/95 dark:bg-[#061224]/95 border-r border-t border-cyan-500/40" />
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => setIsChatOpen(true)}
              aria-label="Mở trợ lý AI thiết kế mạch 3D"
              className="group relative w-14 h-14 rounded-2xl p-[2px] bg-gradient-to-tr from-cyan-500 via-sky-400 to-teal-400 shadow-[0_8px_25px_rgba(6,182,212,0.4)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.8),0_0_20px_rgba(6,182,212,0.35)] hover:shadow-[0_12px_32px_rgba(6,182,212,0.55)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center"
            >
              <div className="w-full h-full rounded-[14px] bg-white dark:bg-[#061224] flex items-center justify-center transition-colors group-hover:bg-cyan-50/50 dark:group-hover:bg-[#08182b]">
                <Bot className="w-6 h-6 text-cyan-600 dark:text-cyan-400 transition-transform group-hover:scale-110 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
              </div>

              {/* Pulsing online badge */}
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white dark:border-[#061224]" />
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Chatbot Window Panel (Spring opening animation, glassmorphic layout) */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className="fixed inset-x-3 bottom-3 sm:inset-auto sm:bottom-5 sm:right-5 w-auto sm:w-[420px] h-[590px] max-h-[88vh] rounded-[26px] bg-white/95 dark:bg-[#071324]/95 border border-[#bfe3f7] dark:border-cyan-500/40 shadow-[0_20px_60px_rgba(6,182,212,0.22),_0_0_1px_rgba(0,0,0,0.1)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.9),_0_0_40px_rgba(6,182,212,0.25)] backdrop-blur-2xl flex flex-col overflow-hidden z-50 text-slate-800 dark:text-slate-100"
          >
            {/* Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b border-[#e0f2fe] dark:border-cyan-900/50 bg-gradient-to-r from-cyan-50/80 via-white to-sky-50/60 dark:from-[#091b30] dark:via-[#071526] dark:to-[#08182b] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-sky-400 to-teal-400 p-[1.5px] shadow-sm">
                  <div className="w-full h-full rounded-[10px] bg-white dark:bg-[#071526] flex items-center justify-center">
                    <Bot className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                      Minibot Circuit Copilot
                    </h3>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Online
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                    <Cpu className="w-3 h-3 text-cyan-500" />
                    <span>Không gian thiết kế 3D</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    title="Xóa hội thoại"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsChatOpen(false)}
                  title="Thu nhỏ"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Message History Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
              {/* Context Summary Badge */}
              <div className="p-3 rounded-2xl bg-cyan-50/70 dark:bg-[#0c223a] border border-[#dbeafe] dark:border-cyan-800/40 text-[11px] space-y-1 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-semibold">
                  <span className="flex items-center gap-1 text-cyan-700 dark:text-cyan-300">
                    <Zap className="w-3.5 h-3.5 text-cyan-500" />
                    Hiện trạng mạch:
                  </span>
                  <span className="text-[10px] text-slate-400">Rev #{doc.revision}</span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 font-medium">
                  • {doc.components.length} linh kiện, {doc.connections.length} dây nối
                </p>
                {validationResult.diagnostics.length > 0 && (
                  <p className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {validationResult.diagnostics[0].message}
                  </p>
                )}
              </div>

              {/* Welcome message bubble */}
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-950/80 border border-cyan-300 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm p-3.5 bg-slate-100/90 dark:bg-[#0c223a] border border-[#dbeafe] dark:border-cyan-800/40 text-slate-800 dark:text-slate-200 leading-relaxed shadow-xs">
                  <p className="font-semibold text-slate-900 dark:text-white mb-1">
                    Minibot AI Thiết kế 3D 👋
                  </p>
                  <p>
                    Tôi có thể hỗ trợ bạn kiểm tra quy tắc an toàn mạch điện, giải thích nguyên lý hoạt động, phát hiện đoản mạch và đề xuất các giải pháp nối dây tối ưu.
                  </p>
                </div>
              </div>

              {/* Starter suggested question chips when conversation is fresh */}
              {messages.length === 0 && (
                <div className="pt-2">
                  <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    Gợi ý câu hỏi nhanh:
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {quickPrompts.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleAskAI(q)}
                        disabled={isLoadingAI}
                        className="text-left px-3 py-2 rounded-xl bg-white dark:bg-[#0a1c30] hover:bg-cyan-50 dark:hover:bg-[#0e2744] border border-[#e2e8f0] dark:border-cyan-900/50 text-slate-700 dark:text-slate-300 hover:text-cyan-700 dark:hover:text-cyan-300 text-xs font-medium transition shadow-xs flex items-center justify-between group cursor-pointer"
                      >
                        <span>{q}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-500 transition-transform group-hover:translate-x-0.5 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat messages */}
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                const isSystem = msg.role === 'system';

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}
                  >
                    {!isUser && (
                      <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-950/80 border border-cyan-300 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                    )}

                    <div className="max-w-[85%] space-y-2">
                      <div
                        className={`p-3 rounded-2xl text-xs leading-relaxed ${
                          isUser
                            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-sm shadow-md shadow-cyan-600/20'
                            : isSystem
                            ? 'bg-rose-950/70 border border-rose-800 text-rose-300 rounded-tl-sm shadow-xs'
                            : 'bg-slate-100/90 dark:bg-[#0c223a] border border-[#dbeafe] dark:border-cyan-800/40 text-slate-800 dark:text-slate-200 rounded-tl-sm shadow-xs'
                        }`}
                      >
                        {isUser || isSystem ? <div className="whitespace-pre-wrap">{msg.content}</div> : <ChatMarkdown text={msg.content} />}
                      </div>

                      {/* Proposal Card if attached */}
                      {msg.proposal && (
                        <div className="p-3 rounded-2xl bg-cyan-50/90 dark:bg-[#071f33] border border-cyan-300 dark:border-cyan-700/60 space-y-2 shadow-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-cyan-800 dark:text-cyan-300 flex items-center gap-1.5 text-xs">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              {msg.proposal.summary || 'Đề xuất cải tiến mạch'}
                            </span>
                            {msg.proposal.isMockFallback && (
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                Demo
                              </span>
                            )}
                          </div>

                          {msg.proposal.changes && msg.proposal.changes.length > 0 && (
                            <div className="pt-2 border-t border-cyan-200 dark:border-cyan-800/60">
                              <p className="text-[10px] text-cyan-700 dark:text-cyan-300 font-semibold mb-1.5">
                                Thay đổi dự kiến ({msg.proposal.changes.length} thao tác):
                              </p>
                              <button
                                type="button"
                                onClick={() => onApplyProposal(msg.proposal!)}
                                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:brightness-110 text-white font-semibold text-xs shadow-md shadow-emerald-900/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Áp dụng đề xuất này (Có thể hoàn tác)</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Thinking loader */}
              {isLoadingAI && (
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-950/80 border border-cyan-300 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  </div>
                  <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-slate-100/90 dark:bg-[#0c223a] border border-[#dbeafe] dark:border-cyan-800/40 flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <div className="p-3 border-t border-[#e0f2fe] dark:border-cyan-900/50 bg-white/90 dark:bg-[#071526]/90 backdrop-blur-md">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAskAI();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder="Hỏi Minibot về mạch điện, kiểm tra an toàn..."
                  disabled={isLoadingAI}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#091b30] border border-slate-200 dark:border-cyan-900/60 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 transition"
                />
                <button
                  type="submit"
                  disabled={!promptInput.trim() || isLoadingAI}
                  className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition hover:shadow-md hover:shadow-cyan-500/25 cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
              <div className="text-[10px] text-center text-slate-400 dark:text-slate-500 mt-2 font-medium">
                Minibot Circuit Copilot • Hỗ trợ thiết kế & mô phỏng mạch 3D
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
