import React from 'react';
import { Sparkles, Box, Cpu, BookOpen, ShoppingBag, ShieldCheck, ArrowRight, Zap, PlayCircle } from 'lucide-react';
import { Button, Badge } from '../components/ui/designSystem.tsx';

interface HomeViewProps {
  onNavigate: (view: 'editor' | 'lessons' | 'marketplace' | 'pricing') => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate }) => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-16">
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-3xl mx-auto pt-6">
        <Badge variant="emerald">
          <Sparkles className="w-3 h-3 mr-1 text-emerald-400" />
          NỀN TẢNG THIẾT KẾ MẠCH 3D & AI COPILOT
        </Badge>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight">
          Thiết kế mạch điện trực quan trong{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">
            không gian 3D
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
          Tương tác trực tiếp với linh kiện, nối dây tự do, chạy mô phỏng hành vi DC tức thì và nhận trợ giúp từ
          Minibot AI theo thời gian thực.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button
            variant="primary"
            size="lg"
            onClick={() => onNavigate('editor')}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Vào 3D Editor ngay
          </Button>

          <Button
            variant="secondary"
            size="lg"
            onClick={() => onNavigate('lessons')}
            leftIcon={<BookOpen className="w-4 h-4 text-emerald-400" />}
          >
            Bài thực hành từng bước
          </Button>
        </div>
      </section>

      {/* Feature Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-xl">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Box className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-white">Không gian 3D Chân Thực</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Bo mạch PCB chuẩn kích thước, lưới snap 10mm, camera orbit/pan/zoom mượt mà. Mô hình 3D tỉ mỉ cho nguồn DC, điện trở, LED và công tắc.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-xl">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-white">Mô Phỏng Hành Vi Tức Thì</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Kiểm tra đoản mạch, hở mạch, phân cực diode LED và tính toán dòng điện khép kín. LED phát quang rực rỡ và công tắc đóng mở cơ học.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3 shadow-xl">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-white">Minibot AI Đồng Hành</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Trợ lý robot bay tự động phản ứng với thao tác của bạn, cảnh báo nguy cơ hỏng mạch và đề xuất giải pháp sửa mạch bằng Gemini AI.
          </p>
        </div>
      </section>

      {/* Quick Launch CTA Banner */}
      <section className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border border-emerald-900/60 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Sẵn sàng trải nghiệm mạch điện 3D?</h2>
          <p className="text-xs sm:text-sm text-slate-300">
            Khách có thể sử dụng ngay trên trình duyệt mà không bắt buộc đăng ký tài khoản.
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={() => onNavigate('editor')}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Bắt đầu thiết kế
        </Button>
      </section>
    </div>
  );
};
