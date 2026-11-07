import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Bot,
  RotateCcw,
  ArrowRight,
  Shield,
  Loader2,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { useI18n } from '../../i18n/context';
import { useDraggableFab } from '../../hooks/useDraggableFab';
import { ChatMarkdown } from '../ui/ChatMarkdown';
import {
  SupportChatMessage,
  loadSupportHistory,
  saveSupportHistory,
  clearSupportHistory,
  sendSupportMessage,
  parseNavActions,
  NavAction,
} from '../../services/supportChatService';

export interface SupportChatbotProps {
  currentUser?: { id?: string; email?: string } | null;
  onNavigate: (route: string) => void;
  isOpenControlled?: boolean;
  onToggleControlled?: (open: boolean) => void;
}

export const SupportChatbot: React.FC<SupportChatbotProps> = ({
  currentUser,
  onNavigate,
  isOpenControlled,
  onToggleControlled,
}) => {
  const { language } = useI18n();
  const fab = useDraggableFab('cc3d:fab:support');
  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const isOpen = isOpenControlled !== undefined ? isOpenControlled : isOpenInternal;
  const setIsOpen = (next: boolean) => {
    if (onToggleControlled) onToggleControlled(next);
    else setIsOpenInternal(next);
  };

  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Account Isolation: reload messages whenever currentUser changes
  useEffect(() => {
    const history = loadSupportHistory(currentUser?.id);
    setMessages(history);
  }, [currentUser?.id]);

  // 2. Persist whenever messages update
  useEffect(() => {
    if (messages.length > 0) {
      saveSupportHistory(currentUser?.id, messages);
    }
  }, [messages, currentUser?.id]);

  // 3. Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Suggested starter questions
  const starterQuestions = language === 'vi'
    ? [
        'CircuitCraft 3D là gì?',
        'Tôi là người mới thì bắt đầu ra sao?',
        'Có những khóa học thực hành nào?',
        'Làm sao để mở phòng thí nghiệm 3D?',
        'Các gói thành viên và chi phí ra sao?',
      ]
    : [
        'What is CircuitCraft 3D?',
        'How do I start as a beginner?',
        'What courses are available?',
        'How to enter the 3D Lab?',
        'How do membership plans work?',
      ];

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    setInputText('');

    const userMsg: SupportChatMessage = {
      id: 'usr_' + Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setIsLoading(true);

    try {
      const reply = await sendSupportMessage({
        prompt: text,
        history: newHistory,
        locale: language === 'vi' ? 'vi' : 'en',
        userId: currentUser?.id,
      });

      const assistantMsg: SupportChatMessage = {
        id: 'ast_' + Date.now(),
        role: 'assistant',
        content: reply,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: SupportChatMessage = {
        id: 'err_' + Date.now(),
        role: 'assistant',
        content: err?.message || (language === 'vi' ? 'Đã xảy ra sự cố kết nối. Vui lòng thử lại!' : 'A connection error occurred. Please retry!'),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    clearSupportHistory(currentUser?.id);
    setMessages([]);
  };

  const handleNavClick = (target: NavAction['target']) => {
    onNavigate(target);
    // On small screens close to avoid obstruction
    if (window.innerWidth < 640) {
      setIsOpen(false);
    }
  };

  return (
    <div className="fixed z-50 select-none" style={fab.containerStyle}>
      {/* 1. Floating Action Trigger Button (press and hold to move it) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            {/* Tooltip bubble */}
            <AnimatePresence>
              {showTooltip && (
                <motion.div
                  initial={{ opacity: 0, x: 10, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 10, scale: 0.95 }}
                  className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap px-3 py-1.5 rounded-xl bg-slate-900/95 dark:bg-[#061224]/95 text-white text-xs font-semibold border border-cyan-500/40 shadow-xl shadow-cyan-500/10 flex items-center gap-1.5 pointer-events-none"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{language === 'vi' ? 'Cần hỗ trợ? Hỏi AI' : 'Need help? Ask AI'}</span>
                  <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-slate-900/95 dark:bg-[#061224]/95 border-r border-t border-cyan-500/40" />
                </motion.div>
              )}
            </AnimatePresence>

            <button
              {...fab.handleProps}
              onClick={fab.guardClick(() => setIsOpen(true))}
              aria-label={language === 'vi' ? 'Mở trợ lý hỗ trợ website (nhấn giữ để di chuyển)' : 'Open Support AI (press and hold to move)'}
              className={`group relative w-14 h-14 ${fab.isDragging ? 'scale-110 ring-4 ring-cyan-400/40' : ''} rounded-2xl p-[2px] bg-gradient-to-tr from-cyan-500 via-sky-400 to-teal-400 shadow-[0_8px_25px_rgba(6,182,212,0.4)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.8),0_0_20px_rgba(6,182,212,0.35)] hover:shadow-[0_12px_32px_rgba(6,182,212,0.55)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center`}
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

      {/* 2. Chatbot Window Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className="fixed inset-x-3 bottom-3 sm:inset-auto sm:bottom-5 sm:right-5 w-auto sm:w-[410px] h-[580px] max-h-[calc(var(--app-height,100dvh)-1.5rem)] rounded-[26px] bg-white/95 dark:bg-[#071324]/95 border border-[#bfe3f7] dark:border-cyan-500/40 shadow-[0_20px_60px_rgba(6,182,212,0.22),_0_0_1px_rgba(0,0,0,0.1)] dark:shadow-[0_25px_70px_rgba(0,0,0,0.9),_0_0_40px_rgba(6,182,212,0.25)] backdrop-blur-2xl flex flex-col overflow-hidden z-50 text-slate-800 dark:text-slate-100"
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
                      {language === 'vi' ? 'Trợ lý CircuitCraft' : 'CircuitCraft Guide'}
                    </h3>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Online
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                    <Shield className="w-3 h-3 text-cyan-500" />
                    <span>
                      {currentUser?.email
                        ? `${currentUser.email.split('@')[0]} (Riêng tư)`
                        : language === 'vi'
                        ? 'Phiên khách cô lập'
                        : 'Isolated Guest Session'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={handleClear}
                    title={language === 'vi' ? 'Xóa hội thoại' : 'Clear conversation'}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  title={language === 'vi' ? 'Thu nhỏ' : 'Minimize'}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Message History Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
              {/* Welcome message bubble */}
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-950/80 border border-cyan-300 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm p-3.5 bg-slate-100/90 dark:bg-[#0c223a] border border-[#dbeafe] dark:border-cyan-800/40 text-slate-800 dark:text-slate-200 leading-relaxed shadow-xs">
                  <p className="font-semibold text-slate-900 dark:text-white mb-1">
                    {language === 'vi' ? 'Xin chào bạn! 👋' : 'Hello there! 👋'}
                  </p>
                  <p>
                    {language === 'vi'
                      ? 'Tôi là Trợ lý Hướng dẫn website CircuitCraft 3D. Tôi có thể giúp bạn giải đáp về tính năng, khóa học thực hành, phòng thí nghiệm 3D hay các gói thành viên.'
                      : "I am your CircuitCraft 3D platform guide. I can help you discover courses, navigate the 3D lab, or explain features and memberships."}
                  </p>
                </div>
              </div>

              {/* Starter suggested question chips when conversation is fresh */}
              {messages.length === 0 && (
                <div className="pt-2">
                  <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                    {language === 'vi' ? 'Câu hỏi gợi ý nhanh:' : 'Quick questions:'}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {starterQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(q)}
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
                const { cleanText, actions } = isUser ? { cleanText: msg.content, actions: [] } : parseNavActions(msg.content);

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

                    <div className={`max-w-[85%] space-y-2`}>
                      <div
                        className={`p-3 rounded-2xl text-xs leading-relaxed ${
                          isUser
                            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-sm shadow-md shadow-cyan-600/20'
                            : 'bg-slate-100/90 dark:bg-[#0c223a] border border-[#dbeafe] dark:border-cyan-800/40 text-slate-800 dark:text-slate-200 rounded-tl-sm shadow-xs'
                        }`}
                      >
                        {isUser ? <div className="whitespace-pre-wrap">{cleanText}</div> : <ChatMarkdown text={cleanText} />}
                      </div>

                      {/* Render Navigation Chips if any */}
                      {actions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {actions.map((act) => (
                            <button
                              key={act.target}
                              onClick={() => handleNavClick(act.target)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-300 dark:border-cyan-600/60 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900 font-bold text-[11px] transition shadow-xs cursor-pointer"
                            >
                              <span>{language === 'vi' ? act.labelVi : act.labelEn}</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Thinking loader */}
              {isLoading && (
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-950/80 border border-cyan-300 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  </div>
                  <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-slate-100/90 dark:bg-[#0c223a] border border-[#dbeafe] dark:border-cyan-800/40 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer */}
            <div className="p-3 border-t border-[#e0f2fe] dark:border-cyan-900/50 bg-white/90 dark:bg-[#071526]/90 backdrop-blur-md">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    language === 'vi'
                      ? 'Hỏi về khóa học, thiết kế 3D, gói thành viên...'
                      : 'Ask about courses, 3D lab, features...'
                  }
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#091b30] border border-slate-200 dark:border-cyan-900/60 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 transition"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isLoading}
                  className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition hover:shadow-md hover:shadow-cyan-500/25 cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
              <div className="text-[10px] text-center text-slate-400 dark:text-slate-500 mt-2 font-medium">
                {language === 'vi'
                  ? 'Trợ lý hướng dẫn website độc lập • Bảo mật theo tài khoản'
                  : 'Independent website assistant • Account-isolated'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
