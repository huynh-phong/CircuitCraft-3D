import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bot,
  Sparkles,
  MessageSquare,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Send,
  RotateCcw,
  Trash2,
  Zap,
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
  isSimulating,
  onApplyProposal,
}) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  // Compute Minibot mood reactively
  let mood: MinibotMood = 'idle';
  let speechText = 'Chào bạn! Tôi là Minibot. Hãy kéo linh kiện để bắt đầu thiết kế!';

  if (isLoadingAI) {
    mood = 'thinking';
    speechText = 'Tôi đang suy nghĩ và tính toán giải pháp tối ưu cho mạch điện của bạn...';
  } else if (validationResult.stats.errorsCount > 0) {
    mood = 'warning';
    speechText = `Phát hiện ${validationResult.stats.errorsCount} lỗi mạch: ${validationResult.diagnostics[0]?.message}`;
  } else if (isSimulating) {
    mood = 'success';
    speechText = 'Mạch đang chạy mô phỏng trơn tru! Các thông số dòng điện đều an toàn.';
  } else if (doc.components.length > 0 && doc.connections.length === 0) {
    mood = 'guiding';
    speechText = 'Tuyệt vời! Bây giờ hãy nhấp vào các chân pin để nối dây khép kín mạch nhé.';
  }

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
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      {/* AI Chat & Proposal Window */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-[420px] max-w-[calc(100vw-32px)] bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[560px] max-h-[75vh]"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-emerald-950/80 to-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                    Minibot Circuit Copilot
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  </h4>
                  <p className="text-[10px] text-slate-400">Trợ lý phân tích & sửa mạch thông minh</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleClearHistory}
                  title="Xóa lịch sử hội thoại"
                  className="text-slate-400 hover:text-rose-400 p-1.5 rounded transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="text-slate-400 hover:text-white p-1.5 rounded transition cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content / Messages Timeline */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs text-slate-300">
              {/* Context Summary Badge */}
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] space-y-1">
                <div className="flex items-center justify-between text-slate-400 font-medium">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-emerald-400" />
                    Hiện trạng mạch:
                  </span>
                  <span className="text-[10px] text-slate-500">Rev #{doc.revision}</span>
                </div>
                <p className="text-slate-300">
                  • {doc.components.length} linh kiện, {doc.connections.length} dây nối
                </p>
                {validationResult.diagnostics.length > 0 && (
                  <p className="text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {validationResult.diagnostics[0].message}
                  </p>
                )}
              </div>

              {/* Chat Messages */}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-emerald-600 text-white rounded-br-xs'
                        : msg.role === 'system'
                        ? 'bg-rose-950/70 border border-rose-800 text-rose-300 rounded-bl-xs'
                        : 'bg-slate-800/90 border border-slate-700/60 text-slate-200 rounded-bl-xs'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold mb-1">
                        <Bot className="w-3 h-3" />
                        Minibot AI
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* Proposal Card if attached */}
                    {msg.proposal && (
                      <div className="mt-3 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-emerald-300 flex items-center gap-1 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {msg.proposal.summary}
                          </span>
                          {msg.proposal.isMockFallback && (
                            <span className="text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">Demo</span>
                          )}
                        </div>

                        {msg.proposal.changes && msg.proposal.changes.length > 0 && (
                          <div className="pt-2 border-t border-emerald-900/60">
                            <p className="text-[10px] text-emerald-400 font-medium mb-1.5">
                              Thay đổi dự kiến ({msg.proposal.changes.length} thao tác):
                            </p>
                            <button
                              onClick={() => {
                                onApplyProposal(msg.proposal);
                              }}
                              className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              Áp dụng đề xuất này (Có thể hoàn tác)
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-500 px-1 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}

              {/* Typing / Loading indicator */}
              {isLoadingAI && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/60 text-slate-400 border border-slate-700/40 w-fit">
                  <Bot className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                  <span className="text-[11px]">Minibot đang tính toán và phân tích mạch...</span>
                </div>
              )}

              {errorMessage && (
                <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompts */}
            <div className="px-4 py-2 bg-slate-950/40 border-t border-slate-800/80 space-y-1.5 shrink-0">
              <span className="text-[10px] text-slate-400 font-medium">Gợi ý câu hỏi nhanh:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleAskAI('Giải thích nguyên lý hoạt động của mạch này')}
                  disabled={isLoadingAI}
                  className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition cursor-pointer"
                >
                  💡 Giải thích nguyên lý
                </button>
                <button
                  onClick={() => handleAskAI('Kiểm tra xem mạch có nguy cơ đoản mạch hay cháy LED không?')}
                  disabled={isLoadingAI}
                  className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition cursor-pointer"
                >
                  ⚠️ Kiểm tra an toàn
                </button>
                <button
                  onClick={() => handleAskAI('Đề xuất cách mắc thêm công tắc SPST vào mạch')}
                  disabled={isLoadingAI}
                  className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition cursor-pointer"
                >
                  🔘 Thêm công tắc
                </button>
              </div>
            </div>

            {/* Input Footer */}
            <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                placeholder="Hỏi Minibot về mạch điện..."
                disabled={isLoadingAI}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={() => handleAskAI()}
                disabled={isLoadingAI || !promptInput.trim()}
                className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition cursor-pointer"
              >
                {isLoadingAI ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minibot Floating Avatar & Speech Bubble */}
      <div className="flex items-end gap-3">
        {/* Reactive Speech Bubble */}
        <AnimatePresence>
          {!isChatOpen && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onClick={() => setIsChatOpen(true)}
              className="cursor-pointer max-w-xs p-3 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-800 shadow-xl text-xs text-slate-200 hover:border-emerald-500/50 transition relative group"
            >
              <p className="leading-snug">{speechText}</p>
              <div className="mt-1 flex items-center justify-between text-[10px] text-emerald-400 font-medium">
                <span>Nhấp để mở AI Copilot</span>
                <Sparkles className="w-3 h-3" />
              </div>
              {/* Bubble pointer */}
              <div className="absolute right-[-6px] bottom-4 w-3 h-3 bg-slate-900 border-r border-b border-slate-800 rotate-[-45deg]" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3D-styled Minibot Floating Orb */}
        <motion.div
          animate={{
            y: [0, -6, 0],
            rotate: mood === 'warning' ? [-2, 2, -2] : [0, 1, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: mood === 'warning' ? 0.3 : 3,
            ease: 'easeInOut',
          }}
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center cursor-pointer border-2 transition-all duration-300 relative select-none ${
            mood === 'warning'
              ? 'bg-amber-950/90 border-amber-500 shadow-amber-500/20'
              : mood === 'thinking'
              ? 'bg-purple-950/90 border-purple-500 shadow-purple-500/20'
              : mood === 'success'
              ? 'bg-emerald-950/90 border-emerald-400 shadow-emerald-500/20'
              : 'bg-slate-900/90 border-cyan-400 shadow-cyan-500/20'
          }`}
          title="Minibot AI Assistant"
        >
          {/* Glowing Visor */}
          <div
            className={`w-8 h-4 rounded-full flex items-center justify-center gap-1.5 transition-colors ${
              mood === 'warning'
                ? 'bg-amber-400/80'
                : mood === 'thinking'
                ? 'bg-purple-400/80 animate-pulse'
                : mood === 'success'
                ? 'bg-emerald-400/80'
                : 'bg-cyan-400/80'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
          </div>

          {/* Floating Orbit Ring */}
          <div
            className="absolute -inset-1 rounded-full border border-dashed border-cyan-400/30 animate-spin"
            style={{ animationDuration: '12s' }}
          />
        </motion.div>
      </div>
    </div>
  );
};
