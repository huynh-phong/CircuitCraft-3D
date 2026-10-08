import React from 'react';
import { Cpu, Box, BookOpen, ShoppingBag, CreditCard, User, LogIn } from 'lucide-react';
import { UserProfile } from '../../types/circuit.ts';
import { Badge, Button } from '../ui/designSystem.tsx';

interface NavbarProps {
  currentView: 'home' | 'editor' | 'lessons' | 'marketplace' | 'pricing';
  onNavigate: (view: 'home' | 'editor' | 'lessons' | 'marketplace' | 'pricing') => void;
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  currentUser,
  onOpenAuth,
}) => {
  const navItems = [
    { id: 'home', label: 'Trang chủ', icon: Cpu },
    { id: 'editor', label: '3D Editor', icon: Box },
    { id: 'lessons', label: 'Bài thực hành', icon: BookOpen },
    { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
    { id: 'pricing', label: 'Bảng giá', icon: CreditCard },
  ] as const;

  return (
    <header className="h-16 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 z-40">
      {/* Brand Logo */}
      <div
        onClick={() => onNavigate('home')}
        className="flex items-center gap-3 cursor-pointer select-none group"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-slate-950 flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition">
          <Cpu className="w-5 h-5 font-bold" />
        </div>
        <div>
          <span className="text-base font-bold text-white tracking-tight flex items-center gap-1">
            CircuitVerse <span className="text-emerald-400">3D</span>
          </span>
          <p className="text-[10px] text-slate-400 hidden sm:block">Thiết kế & Mô phỏng mạch điện trực quan</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                isActive
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Auth / Profile action */}
      <div className="flex items-center gap-3">
        {currentUser ? (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-2 p-1.5 pr-3 rounded-full bg-slate-950 hover:bg-slate-800 border border-slate-800 transition cursor-pointer"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-slate-200 font-medium max-w-[100px] truncate">
              {currentUser.name}
            </span>
            <Badge variant="emerald">{currentUser.tier.toUpperCase()}</Badge>
          </button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenAuth}
            leftIcon={<LogIn className="w-3.5 h-3.5" />}
          >
            Đăng nhập
          </Button>
        )}
      </div>
    </header>
  );
};
