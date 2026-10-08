import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu,
  Box,
  GraduationCap,
  ShoppingBag,
  ShieldCheck,
  LogIn,
  Home,
  Sun,
  Moon,
  Globe,
  Sparkles,
  LayoutDashboard,
  Menu,
  X,
  User,
  LogOut,
  ChevronDown,
  Layers,
  BookOpen,
} from 'lucide-react';
import { authService, UserProfile } from '../persistence/authService';
import { paymentService } from '../billing/paymentService';
import { useI18n } from '../i18n/context';
import { RouteKey, ROUTE_PATH_MAP } from '../router/routes';

export interface NavbarProps {
  currentRoute: RouteKey;
  onNavigate: (route: RouteKey) => void;
  isAutosaving?: boolean;
  saveStatusText?: string;
  currentUser?: any;
  currentProfile?: UserProfile | null;
  onOpenAuthModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRoute,
  onNavigate,
  isAutosaving = false,
  saveStatusText,
  currentUser,
  currentProfile,
  onOpenAuthModal,
}) => {
  const { language, effectiveTheme, toggleTheme, toggleLanguage, t } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [, setPaymentTick] = useState(0);

  useEffect(() => {
    const unsub = paymentService.subscribe(() => setPaymentTick((v) => v + 1));
    return () => unsub();
  }, [currentUser]);

  // Close dropdowns on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileDropdownOpen(false);
  }, [currentRoute]);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isCreator = Boolean(currentUser) && paymentService.hasCreatorPlan();
  const isAdmin = Boolean(currentUser) && authService.isAdmin();

  const navItems = [
    {
      id: 'landing' as const,
      label: language === 'vi' ? 'Trang chủ' : 'Home',
      icon: Home,
      path: '/',
    },
    {
      id: 'projects' as const,
      label: language === 'vi' ? 'Thiết kế 3D' : '3D Design',
      icon: Box,
      path: '/projects',
    },
    {
      id: 'courses' as const,
      label: language === 'vi' ? 'Khóa học' : 'Courses',
      icon: GraduationCap,
      path: '/courses',
    },
    {
      id: 'marketplace' as const,
      label: language === 'vi' ? 'Cửa hàng' : 'Marketplace',
      icon: ShoppingBag,
      path: '/marketplace',
    },
    {
      id: 'membership' as const,
      label: language === 'vi' ? 'Gói thành viên' : 'Membership',
      icon: ShieldCheck,
      path: '/membership',
    },
    ...(isCreator
      ? [
          {
            id: 'creator' as const,
            label: language === 'vi' ? 'Nhà sáng tạo' : 'Creator',
            icon: Sparkles,
            path: '/creator',
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            id: 'admin' as const,
            label: 'Admin',
            icon: LayoutDashboard,
            path: '/admin',
          },
        ]
      : []),
  ];

  const userDisplayName = currentProfile?.fullName || currentUser?.email?.split('@')[0] || t('nav.account');
  const userInitial = userDisplayName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    try {
      await authService.signOut();
      onNavigate('landing');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div className="w-full max-w-[1380px] mx-auto pt-3 sm:pt-4 px-4 z-30 shrink-0 select-none">
      <header className="h-16 px-4 sm:px-6 rounded-[28px] border border-[#cbe6f7] dark:border-cyan-800/40 bg-white/95 dark:bg-[#061224]/95 shadow-[0_12px_36px_rgba(6,182,212,0.12),inset_0_1px_1px_rgba(255,255,255,0.9)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.7),0_0_25px_rgba(6,182,212,0.12),inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-xl flex items-center justify-between transition-all duration-300 relative">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-3 group focus:outline-none text-left cursor-pointer"
            aria-label="Về trang chủ CircuitCraft 3D"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-teal-500 to-sky-400 p-[1.5px] shadow-md shadow-cyan-500/25 group-hover:shadow-cyan-500/40 transition-all">
              <div className="w-full h-full bg-white dark:bg-[#061224] rounded-[10px] flex items-center justify-center transition-all group-hover:scale-[0.98]">
                <Cpu className="w-4 h-4 text-cyan-500 dark:text-cyan-400 drop-shadow-[0_1px_2px_rgba(6,182,212,0.4)]" />
              </div>
            </div>
            <div className="flex flex-col text-left">
              <span className="font-extrabold tracking-tight text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>CircuitCraft</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-cyan-50 dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-400 rounded-md border border-cyan-200/80 dark:border-cyan-500/30 shadow-xs">
                  3D
                </span>
              </span>
            </div>
          </button>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                currentRoute === item.id ||
                (item.id === 'courses' && currentRoute === 'lessons') ||
                (item.id === 'projects' && currentRoute === 'editor');

              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold transition-all duration-200 rounded-full cursor-pointer ${
                    isActive
                      ? 'bg-[#e0f2fe] dark:bg-[#0c233f] text-[#0284c7] dark:text-[#38bdf8] border border-[#bae6fd] dark:border-cyan-500/50 shadow-[0_4px_12px_rgba(6,182,212,0.15)] dark:shadow-[0_4px_16px_rgba(6,182,212,0.3)] font-bold -translate-y-[1px]'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60 active:scale-[0.98]'
                  }`}
                >
                  <div
                    className={`w-4.5 h-4.5 rounded-md flex items-center justify-center transition-transform ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300'
                        : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Status & Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Autosave Status Indicator for Editor Mode */}
          {saveStatusText && currentRoute === 'editor' && (
            <div className="hidden sm:flex text-[11px] text-slate-600 dark:text-slate-400 items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/90 dark:bg-[#0e1625] border border-[#cbe6f7] dark:border-cyan-800/40 font-mono shadow-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  isAutosaving
                    ? 'bg-amber-500 animate-ping'
                    : saveStatusText.includes('Xung đột')
                    ? 'bg-red-500 ring-2 ring-red-400/30'
                    : 'bg-emerald-500 ring-2 ring-emerald-400/30'
                }`}
              />
              <span className={saveStatusText.includes('Xung đột') ? 'text-red-600 dark:text-red-300 font-bold' : ''}>
                {saveStatusText}
              </span>
            </div>
          )}

          {/* Quick Language Switcher */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#cbe6f7] dark:border-cyan-800/40 bg-white dark:bg-[#0c1a2e] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs hover:-translate-y-[1px] active:translate-y-[1px] text-xs font-semibold transition-all duration-200 cursor-pointer"
            title={t('lang.switch')}
            aria-label={t('lang.switch')}
          >
            <Globe className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span className="uppercase tracking-wider font-mono text-[11px]">
              {language}
            </span>
          </button>

          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-full border border-[#cbe6f7] dark:border-cyan-800/40 bg-white dark:bg-[#0c1a2e] flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs hover:-translate-y-[1px] active:translate-y-[1px] transition-all duration-200 cursor-pointer"
            title={effectiveTheme === 'dark' ? t('theme.light') : t('theme.dark')}
            aria-label={t('theme.switch')}
          >
            {effectiveTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform drop-shadow-[0_1px_3px_rgba(251,191,36,0.4)]" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700 hover:-rotate-12 transition-transform" />
            )}
          </button>

          {/* User Auth Action or Profile Dropdown */}
          {currentUser ? (
            <div className="relative" ref={profileDropdownRef}>
              <button
                onClick={() => setProfileDropdownOpen((prev) => !prev)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                  currentRoute === 'account' || profileDropdownOpen
                    ? 'border-cyan-400 bg-cyan-50 dark:bg-cyan-950/70 text-cyan-900 dark:text-white shadow-xs'
                    : 'border-[#cbe6f7] dark:border-cyan-800/40 bg-white dark:bg-[#0c1a2e] hover:border-cyan-300 text-slate-800 dark:text-slate-200 shadow-xs'
                } text-xs font-semibold`}
                title={userDisplayName}
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center text-slate-950 text-[10px] font-black shadow-xs">
                  {userInitial}
                </div>
                <span className="hidden sm:inline max-w-[110px] truncate">
                  {userDisplayName}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 p-2 rounded-2xl bg-white dark:bg-[#08172b] border border-cyan-500/30 shadow-[0_16px_40px_rgba(0,0,0,0.4),0_0_24px_rgba(6,182,212,0.15)] backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 mb-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {userDisplayName}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
                      {currentUser?.email}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      onNavigate('account');
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-cyan-50 dark:hover:bg-cyan-950/60 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all text-left"
                  >
                    <User className="w-4 h-4 text-cyan-500" />
                    <span>{language === 'vi' ? 'Hồ sơ tài khoản' : 'Account Profile'}</span>
                  </button>

                  <button
                    onClick={() => {
                      onNavigate('projects');
                      setProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-cyan-50 dark:hover:bg-cyan-950/60 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all text-left"
                  >
                    <Box className="w-4 h-4 text-cyan-500" />
                    <span>{language === 'vi' ? 'Dự án của tôi' : 'My Projects'}</span>
                  </button>

                  {isCreator && (
                    <button
                      onClick={() => {
                        onNavigate('creator');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-cyan-50 dark:hover:bg-cyan-950/60 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all text-left"
                    >
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>{language === 'vi' ? 'Khu vực Creator' : 'Creator Studio'}</span>
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => {
                        onNavigate('admin');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-200 hover:bg-cyan-50 dark:hover:bg-cyan-950/60 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all text-left"
                    >
                      <LayoutDashboard className="w-4 h-4 text-cyan-400" />
                      <span>{language === 'vi' ? 'Trang quản trị (Admin)' : 'Admin Dashboard'}</span>
                    </button>
                  )}

                  <div className="my-1 border-t border-slate-100 dark:border-slate-800/80" />

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{language === 'vi' ? 'Đăng xuất' : 'Sign Out'}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="tech-btn-3d flex items-center gap-2 px-4.5 py-2 rounded-2xl text-xs font-extrabold text-white cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
              <span className="tracking-wide">{t('nav.signIn')}</span>
            </button>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="lg:hidden w-9 h-9 rounded-full border border-[#cbe6f7] dark:border-cyan-800/40 bg-white dark:bg-[#0c1a2e] flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> : <Menu className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-2 p-3 rounded-2xl border border-[#cbe6f7] dark:border-cyan-800/40 bg-white/95 dark:bg-[#061224]/95 backdrop-blur-xl shadow-xl flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-200 z-40">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentRoute === item.id ||
              (item.id === 'courses' && currentRoute === 'lessons') ||
              (item.id === 'projects' && currentRoute === 'editor');
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#e0f2fe] dark:bg-[#0c233f] text-[#0284c7] dark:text-[#38bdf8] font-bold border border-[#bae6fd] dark:border-cyan-500/50'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300'
                      : 'text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
