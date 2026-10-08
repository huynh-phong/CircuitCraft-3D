import React, { useState, useRef, useEffect } from 'react';
import { AIChatMessage, AIProposal } from '../ai/types';
import { Bot, Send, Sparkles, X, ChevronRight, Trash2, User } from 'lucide-react';
import { useI18n } from '../i18n/context';

export interface MinibotWidgetProps {
  messages: AIChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
  onOpenProposal: (proposal: AIProposal) => void;
  activeProposal: AIProposal | null;
  onClearChat?: () => void;
  userEmail?: string | null;
}

export const MinibotWidget: React.FC<MinibotWidgetProps> = ({
  messages,
  onSendMessage,
  isLoading,
  onOpenProposal,
  onClearChat,
  userEmail,
}) => {
  const { language } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickPrompts = language === 'vi' ? [
    'Mạch của tôi sai ở đâu?',
    'Tại sao cần điện trở cho LED?',
    'Tạo mạch công tắc bật tắt đèn',
  ] : [
    'Where is my circuit wrong?',
    'Why do LEDs need resistors?',
    'Create a switch-controlled light',
  ];

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputVal.trim() || isLoading) return;
    const text = inputVal;
    setInputVal('');
    await onSendMessage(text);
  };

  const handleQuickPrompt = async (text: string) => {
    if (isLoading) return;
    await onSendMessage(text);
  };

  return (
    <div className="fixed bottom-14 right-4 z-30 select-none">
      {!isOpen ? (
        /* Minibot Floating Trigger Pill */
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-full bg-gradient-to-r from-cyan-600 via-teal-600 to-cyan-500 text-white shadow-xl shadow-cyan-950/40 hover:scale-105 transition transform active:scale-95 group border border-cyan-300/30"
          title={language === 'vi' ? 'Mở trợ lý ảo Minibot' : 'Open Minibot AI Assistant'}
        >
          <div className="w-6 h-6 rounded-full bg-slate-950/40 flex items-center justify-center">
            <Bot className="w-4 h-4 text-cyan-200 group-hover:rotate-12 transition" />
          </div>
          <span className="text-xs font-bold tracking-wide">
            {language === 'vi' ? 'Hỏi Minibot AI' : 'Ask Minibot AI'}
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      ) : (
        /* Minibot Chat Window */
        <div className="w-80 sm:w-96 h-[460px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200 transition-colors">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-600/20 dark:bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center">
                <Bot className="w-4 h-4 text-cyan-600 dark:text-cyan-300" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  Minibot AI Assistant
                  <span className="text-[10px] px-1 py-0.2 rounded bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30">
                    Online
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span>{language === 'vi' ? 'Trợ lý mạch 3D' : '3D Circuit Copilot'}</span>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span
                    className="text-cyan-600 dark:text-cyan-400/90 font-medium truncate max-w-[130px] inline-flex items-center gap-1"
                    title={`Đoạn chat thuộc tài khoản: ${userEmail || 'Khách'}`}
                  >
                    <User className="w-2.5 h-2.5 inline" />
                    {userEmail ? userEmail.split('@')[0] : (language === 'vi' ? 'Khách' : 'Guest')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {onClearChat && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(language === 'vi' ? 'Bạn có chắc chắn muốn xóa đoạn chat hiện tại không?' : 'Clear conversation history?')) {
                      onClearChat();
                    }
                  }}
                  className="p-1.5 rounded-md text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition"
                  title={language === 'vi' ? 'Xóa lịch sử chat' : 'Clear chat history'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition"
                title={language === 'vi' ? 'Đóng cửa sổ' : 'Close window'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs">
            {messages.length === 0 ? (
              <div className="text-center py-6 text-slate-500 dark:text-slate-400 space-y-3">
                <Sparkles className="w-8 h-8 text-cyan-500 mx-auto opacity-70" />
                <p className="text-xs">
                  {language === 'vi'
                    ? 'Xin chào! Tôi có thể giúp bạn kiểm tra quy tắc an toàn mạch, giải thích nguyên lý hoặc tạo sơ đồ mạch theo yêu cầu.'
                    : 'Hello! I can help you check circuit safety rules, explain electronic principles, or synthesize a circuit diagram.'}
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${
                      msg.role === 'user'
                        ? 'bg-cyan-600 text-white rounded-br-none'
                        : 'bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-bl-none shadow-xs'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Proposal Button inside Message if generated */}
                  {msg.proposal && (
                    <button
                      onClick={() => onOpenProposal(msg.proposal!)}
                      className="mt-1.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-medium shadow-md hover:brightness-110 transition"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{language === 'vi' ? 'Xem & Áp dụng đề xuất thiết kế' : 'View & Apply Circuit Proposal'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs italic bg-slate-50 dark:bg-slate-950/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
                {language === 'vi' ? 'Minibot đang tính toán và phân tích mạch...' : 'Minibot is analyzing circuit...'}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-850 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickPrompt(qp)}
                className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-[10px] whitespace-nowrap border border-slate-300 dark:border-slate-700/60 transition"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className="p-2.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <input
              type="text"
              placeholder={language === 'vi' ? 'Nhập câu hỏi hoặc yêu cầu thiết kế...' : 'Ask a question or request a circuit...'}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              disabled={isLoading}
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={!inputVal.trim() || isLoading}
              className="p-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white transition"
              title={language === 'vi' ? 'Gửi' : 'Send'}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
