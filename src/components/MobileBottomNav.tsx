import React from 'react';
import { Home, Box, GraduationCap, ShoppingBag, User, LogIn } from 'lucide-react';
import { RouteKey } from '../router/routes';
import { useI18n } from '../i18n/context';

export interface MobileBottomNavProps {
  currentRoute: RouteKey;
  onNavigate: (route: RouteKey) => void;
  currentUser?: any;
  onOpenAuthModal?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentRoute,
  onNavigate,
  currentUser,
  onOpenAuthModal,
}) => {
  const { language } = useI18n();

  // If in 3D full-screen editor, hide bottom nav to give maximum canvas space
  if (currentRoute === 'editor') {
    return null;
  }

  const items = [
    {
      id: 'landing' as const,
      label: language === 'vi' ? 'Trang chủ' : 'Home',
      icon: Home,
    },
    {
      id: 'projects' as const,
      label: language === 'vi' ? 'Dự án 3D' : 'Projects',
      icon: Box,
    },
    {
      id: 'courses' as const,
      label: language === 'vi' ? 'Khóa học' : 'Courses',
      icon: GraduationCap,
    },
    {
      id: 'marketplace' as const,
      label: language === 'vi' ? 'Cửa hàng' : 'Store',
      icon: ShoppingBag,
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-3 left-4 right-4 z-40 select-none pb-safe">
      <div className="h-15 px-3 rounded-2xl bg-white/95 dark:bg-[#071629]/95 border border-cyan-500/30 dark:border-cyan-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.36),0_0_20px_rgba(6,182,212,0.18)] backdrop-blur-xl flex items-center justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            currentRoute === item.id ||
            (item.id === 'courses' && currentRoute === 'lessons');

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative ${
                isActive
                  ? 'text-cyan-600 dark:text-cyan-400 font-bold scale-105'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-cyan-500/15 dark:bg-cyan-500/25 shadow-xs'
                    : ''
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[64px]">
                {item.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 absolute -bottom-1 shadow-[0_0_6px_#06b6d4]" />
              )}
            </button>
          );
        })}

        {/* User Account / Sign In Tab */}
        {currentUser ? (
          <button
            onClick={() => onNavigate('account')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative ${
              currentRoute === 'account'
                ? 'text-cyan-600 dark:text-cyan-400 font-bold scale-105'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                currentRoute === 'account'
                  ? 'bg-cyan-500/15 dark:bg-cyan-500/25 shadow-xs'
                  : ''
              }`}
            >
              <User className={`w-4 h-4 ${currentRoute === 'account' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[64px]">
              {language === 'vi' ? 'Hồ sơ' : 'Profile'}
            </span>
            {currentRoute === 'account' && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 absolute -bottom-1 shadow-[0_0_6px_#06b6d4]" />
            )}
          </button>
        ) : (
          <button
            onClick={onOpenAuthModal}
            className="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 dark:text-slate-400 hover:text-cyan-500"
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center">
              <LogIn className="w-4 h-4 stroke-[1.8]" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[64px]">
              {language === 'vi' ? 'Đăng nhập' : 'Sign In'}
            </span>
          </button>
        )}
      </div>
    </nav>
  );
};
