import React, { useEffect, useRef } from 'react';
import { motion, MotionConfig } from 'motion/react';
import { ChevronsLeft, ChevronsRight, ShieldCheck, X, Menu } from 'lucide-react';

export interface AdminNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}
export interface AdminNavGroup {
  id: string;
  label: string;
  items: AdminNavItem[];
}

interface Props {
  groups: AdminNavGroup[];
  activeId: string;
  onSelect: (id: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  adminEmail?: string;
  language: 'vi' | 'en';
}

/**
 * Admin navigation in the same visual language as the floating pill navbar: dark navy surface, thin
 * cyan border, rounded pills and a soft glow on the active item. Desktop: floating panel that folds
 * into an icon rail (tooltips on hover/focus). Phones: drawer with backdrop, Esc to close and focus
 * returned to the menu button.
 */
export const AdminSidebar: React.FC<Props> = ({
  groups,
  activeId,
  onSelect,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onMobileOpenChange,
  adminEmail,
  language,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const t = (vi: string, en: string) => (language === 'vi' ? vi : en);

  useEffect(() => {
    if (!mobileOpen) return;
    const first = drawerRef.current?.querySelector<HTMLElement>('[data-nav-item]');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMobileOpenChange(false);
      if (e.key === 'Tab' && drawerRef.current) {
        const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])'));
        if (!focusable.length) return;
        const firstEl = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      menuButtonRef.current?.focus();
    };
  }, [mobileOpen, onMobileOpenChange]);

  const renderNav = (rail: boolean, surface: 'panel' | 'drawer') => (
    // The icon rail must not clip its tooltips, so only the full panel scrolls
    <nav aria-label={t('Điều hướng quản trị', 'Admin navigation')} className={`flex-1 px-2.5 py-3 space-y-4 ${rail ? 'overflow-visible' : 'overflow-y-auto overflow-x-hidden'}`}>
      {groups.map((group) => (
        <div key={group.id} role="group" aria-label={group.label}>
          {rail ? (
            <div className="mx-auto mb-2 h-px w-6 bg-slate-200 dark:bg-cyan-900/50" aria-hidden />
          ) : (
            <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{group.label}</div>
          )}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.id === activeId;
              return (
                <li key={item.id} className="relative group/nav">
                  <button
                    type="button"
                    data-nav-item
                    onClick={() => {
                      onSelect(item.id);
                      onMobileOpenChange(false);
                    }}
                    aria-current={active ? 'page' : undefined}
                    aria-label={rail ? item.label : undefined}
                    className={`relative w-full flex items-center gap-3 rounded-full text-[13px] font-semibold transition-colors duration-150 active:scale-[0.98] motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 coarse:min-h-11 ${
                      rail ? 'justify-center h-11 w-11 mx-auto' : 'px-3.5 py-2.5'
                    } ${
                      active
                        ? 'text-cyan-800 dark:text-cyan-200'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#0c1a2e] hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {/* Same sliding pill as the navbar: it glides to the newly selected item */}
                    {active && (
                      <motion.span
                        layoutId={`admin-nav-pill-${surface}-${rail ? 'rail' : 'full'}`}
                        aria-hidden
                        className="absolute inset-0 rounded-full bg-[#e0f2fe] border border-[#bae6fd] shadow-[0_2px_10px_rgba(6,182,212,0.18)] dark:bg-gradient-to-r dark:from-[#0c2a48] dark:to-[#0b2140] dark:border-cyan-500/40 dark:shadow-[0_0_18px_rgba(6,182,212,0.22),inset_0_1px_0_rgba(255,255,255,0.05)]"
                        transition={{ type: 'spring', damping: 26, stiffness: 260, mass: 0.9 }}
                      >
                        {!rail && <span className="absolute left-1 top-1/2 -translate-y-1/2 h-4 w-1 rounded-full bg-cyan-500 dark:bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]" />}
                      </motion.span>
                    )}
                    <Icon className={`relative z-10 w-[18px] h-[18px] shrink-0 transition-transform duration-150 ${active ? 'text-cyan-600 dark:text-cyan-300 scale-105' : ''}`} />
                    {!rail && <span className="relative z-10 truncate">{item.label}</span>}
                  </button>
                  {rail && (
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 whitespace-nowrap rounded-lg border border-cyan-200 dark:border-cyan-700/50 bg-white dark:bg-[#0a1628] px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-lg opacity-0 -translate-x-1 group-hover/nav:opacity-100 group-hover/nav:translate-x-0 group-focus-within/nav:opacity-100 group-focus-within/nav:translate-x-0 transition duration-150 motion-reduce:transition-none"
                    >
                      {item.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const header = (rail: boolean, closeButton?: React.ReactNode) => (
    <div className={`flex items-center gap-3 border-b border-slate-200/80 dark:border-cyan-900/40 ${rail ? 'flex-col py-3.5 px-2' : 'px-4 py-3.5'}`}>
      <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-cyan-500 via-teal-500 to-sky-400 p-[1.5px] shadow-md shadow-cyan-500/25">
        <div className="w-full h-full rounded-[10px] bg-white dark:bg-[#061224] flex items-center justify-center">
          <ShieldCheck className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
        </div>
      </div>
      {!rail && (
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-extrabold tracking-tight text-slate-900 dark:text-white truncate">{t('Bảng quản trị', 'Admin Console')}</div>
          <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-slate-400 truncate" title={adminEmail}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden />
            <span className="truncate">{t('Đã xác thực phía máy chủ', 'Verified by the server')}</span>
          </div>
        </div>
      )}
      {closeButton}
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      {/* Phone / small tablet: menu button + drawer */}
      <div className="md:hidden px-3 pt-3">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => onMobileOpenChange(true)}
          aria-expanded={mobileOpen}
          aria-controls="admin-drawer"
          className="w-full flex items-center gap-2.5 rounded-full border border-[#cbe6f7] dark:border-cyan-800/40 bg-white/95 dark:bg-[#061224]/95 px-4 py-2.5 min-h-11 text-sm font-semibold text-slate-800 dark:text-slate-100 shadow-sm"
        >
          <Menu className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <span className="truncate">{groups.flatMap((g) => g.items).find((i) => i.id === activeId)?.label}</span>
          <span className="ml-auto text-[11px] text-slate-500">{t('Menu quản trị', 'Admin menu')}</span>
        </button>
      </div>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[60]">
          <button
            type="button"
            aria-label={t('Đóng menu', 'Close menu')}
            onClick={() => onMobileOpenChange(false)}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] animate-in fade-in duration-200 motion-reduce:animate-none"
            tabIndex={-1}
          />
          <div
            id="admin-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('Menu quản trị', 'Admin menu')}
            className="absolute inset-y-0 left-0 w-[min(300px,86vw)] flex flex-col bg-white dark:bg-[#061224] border-r border-[#cbe6f7] dark:border-cyan-800/40 shadow-2xl animate-in slide-in-from-left duration-200 motion-reduce:animate-none pt-[env(safe-area-inset-top)]"
          >
            {header(
              false,
              <button
                type="button"
                onClick={() => onMobileOpenChange(false)}
                aria-label={t('Đóng menu', 'Close menu')}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {renderNav(false, 'drawer')}
          </div>
        </div>
      )}

      {/* Tablet / desktop: floating panel that folds into an icon rail */}
      <aside
        className={`hidden md:flex flex-col shrink-0 self-start sticky top-3 my-3 ml-3 max-h-[calc(var(--app-height,100dvh)-7.5rem)] rounded-[28px] border border-[#cbe6f7] dark:border-cyan-800/40 bg-white/95 dark:bg-[#061224]/95 backdrop-blur-xl shadow-[0_12px_36px_rgba(6,182,212,0.10)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.6),0_0_25px_rgba(6,182,212,0.10)] transition-[width] duration-200 ease-out motion-reduce:transition-none ${
          collapsed ? 'w-[76px]' : 'w-[248px]'
        }`}
      >
        {header(collapsed)}
        {renderNav(collapsed, 'panel')}
        <div className="p-2.5 border-t border-slate-200/80 dark:border-cyan-900/40">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? t('Mở rộng thanh điều hướng', 'Expand navigation') : t('Thu gọn thanh điều hướng', 'Collapse navigation')}
            aria-expanded={!collapsed}
            className={`w-full flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#0c1a2e] hover:text-slate-800 dark:hover:text-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
            {!collapsed && <span>{t('Thu gọn', 'Collapse')}</span>}
          </button>
        </div>
      </aside>
    </MotionConfig>
  );
};
