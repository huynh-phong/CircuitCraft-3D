import React, { useState } from 'react';
import { Check, Zap, Sparkles, Shield, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button, Dialog, Badge } from '../components/ui/designSystem.tsx';
import { UserTier, UserProfile } from '../types/circuit.ts';
import { ProjectRepository } from '../services/projectRepository.ts';

interface PricingViewProps {
  currentUser: UserProfile | null;
  onUserUpdate: (user: UserProfile) => void;
}

export const PricingView: React.FC<PricingViewProps> = ({ currentUser, onUserUpdate }) => {
  const [activeDialog, setActiveDialog] = useState<{ isOpen: boolean; plan: any } | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'review' | 'processing' | 'success'>('review');
  const [orderInfo, setOrderInfo] = useState<{ orderId: string; planId: string } | null>(null);

  const plans = [
    {
      id: 'free',
      tier: 'free' as UserTier,
      name: 'Gói Free',
      price: '0 đ',
      period: 'trọn đời',
      description: 'Phù hợp để trải nghiệm thiết kế mạch và làm quen với mô phỏng 3D cơ bản.',
      features: [
        'Tối đa 3 dự án lưu trữ',
        'Thư viện 4 linh kiện cơ bản',
        'Mô phỏng hành vi DC nối tiếp',
        'Minibot hỗ trợ hướng dẫn tại chỗ',
        'Không giới hạn thao tác Undo/Redo',
      ],
      isPopular: false,
      cta: 'Đang sử dụng',
      disabled: currentUser?.tier === 'free',
    },
    {
      id: 'student',
      tier: 'student' as UserTier,
      name: 'Gói Student',
      price: '49.000 đ',
      period: '/ tháng',
      description: 'Dành cho học sinh, sinh viên học tập môn kỹ thuật điện tử và STEM.',
      features: [
        'Tối đa 25 dự án trên Cloud',
        'Mở khóa toàn bộ bài thực hành hướng dẫn',
        '50 lần yêu cầu AI Copilot sửa mạch / tháng',
        'Tải về file JSON & báo cáo mạch',
        'Ưu tiên giải đáp lỗi từ Minibot',
      ],
      isPopular: true,
      cta: 'Nâng cấp Student',
      disabled: currentUser?.tier === 'student',
    },
    {
      id: 'creator',
      tier: 'creator' as UserTier,
      name: 'Gói Creator',
      price: '149.000 đ',
      period: '/ tháng',
      description: 'Dành cho giảng viên, content creator và chuyên gia thiết kế bài giảng mạch.',
      features: [
        'Không giới hạn số lượng dự án',
        'Không giới hạn yêu cầu Gemini AI Copilot',
        'Quyền đăng tải mạch lên Marketplace',
        'Tùy biến kích thước bo mạch PCB tùy ý',
        'Huy hiệu Creator độc quyền',
      ],
      isPopular: false,
      cta: 'Nâng cấp Creator',
      disabled: currentUser?.tier === 'creator',
    },
    {
      id: 'pro_soon',
      tier: 'pro_soon' as UserTier,
      name: 'Gói Pro Enterprise',
      price: 'Liên hệ',
      period: '',
      description: 'Tích hợp mô phỏng SPICE sâu và xuất file Gerber cho xưởng gia công PCB.',
      features: [
        'Bộ giải SPICE cao tần',
        'Xuất file chuẩn sản xuất Gerber',
        'API tích hợp doanh nghiệp',
      ],
      isPopular: false,
      cta: 'Sắp ra mắt',
      disabled: true,
    },
  ];

  const handleStartCheckout = async (plan: any) => {
    try {
      const response = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          amount: plan.id === 'student' ? 49000 : 149000,
        }),
      });
      const data = await response.json();
      setOrderInfo(data);
      setCheckoutStep('review');
      setActiveDialog({ isOpen: true, plan });
    } catch {
      alert('Không thể tạo phiên thanh toán');
    }
  };

  const handleConfirmPayment = async () => {
    if (!orderInfo || !activeDialog) return;
    setCheckoutStep('processing');

    try {
      const res = await fetch('/api/payments/verify-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderInfo.orderId }),
      });
      await res.json();

      // Update user state
      const updatedUser: UserProfile = {
        id: currentUser?.id || 'usr_' + Math.random().toString(36).substring(2, 8),
        email: currentUser?.email || 'user@circuitverse3d.io',
        name: currentUser?.name || 'Kỹ Sư Mạch',
        tier: activeDialog.plan.tier,
        createdAt: currentUser?.createdAt || new Date().toISOString(),
      };

      ProjectRepository.setCurrentUser(updatedUser);
      onUserUpdate(updatedUser);
      setCheckoutStep('success');
    } catch {
      setCheckoutStep('review');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
      {/* Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <Badge variant="emerald">HỆ THỐNG GÓI BẢN QUYỀN VÀ TÍNH NĂNG</Badge>
        <h1 className="text-3xl font-bold text-white tracking-tight sm:text-4xl">
          Lựa chọn gói phù hợp với nhu cầu của bạn
        </h1>
        <p className="text-sm text-slate-400">
          Trải nghiệm thiết kế mạch 3D trực quan, mở khóa dung lượng cloud và sức mạnh hỗ trợ từ Gemini AI Copilot.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((p) => {
          const isCurrentTier = currentUser?.tier === p.tier;
          return (
            <div
              key={p.id}
              className={`relative rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 ${
                p.isPopular
                  ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-emerald-500 shadow-xl shadow-emerald-500/10'
                  : 'bg-slate-900/80 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {p.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 font-bold text-[10px] uppercase tracking-wider px-3 py-0.5 rounded-full shadow-md">
                  Phổ biến nhất
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center justify-between">
                    {p.name}
                    {isCurrentTier && <Badge variant="emerald">Đang dùng</Badge>}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">{p.description}</p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-white">{p.price}</span>
                  <span className="text-xs text-slate-400">{p.period}</span>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-2.5">
                  <span className="text-[11px] font-medium text-slate-300 uppercase tracking-wider">Quyền lợi:</span>
                  <ul className="space-y-2">
                    {p.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80">
                <Button
                  variant={p.isPopular ? 'primary' : 'secondary'}
                  size="sm"
                  className="w-full text-xs"
                  disabled={p.disabled || isCurrentTier}
                  onClick={() => handleStartCheckout(p)}
                >
                  {isCurrentTier ? 'Gói hiện tại' : p.cta}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sandbox Payment Dialog */}
      <Dialog
        isOpen={Boolean(activeDialog?.isOpen)}
        onClose={() => setActiveDialog(null)}
        title="Thanh toán Sandbox (Thử nghiệm an toàn)"
        description="Môi trường Sandbox kiểm thử tính năng nâng cấp gói mà không trừ tiền thật."
      >
        {checkoutStep === 'review' && activeDialog && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
              <div className="flex justify-between text-slate-300">
                <span>Gói đăng ký:</span>
                <strong className="text-white">{activeDialog.plan.name}</strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Mã đơn hàng:</span>
                <span className="font-mono text-emerald-400">{orderInfo?.orderId}</span>
              </div>
              <div className="flex justify-between text-slate-300 text-sm font-semibold pt-2 border-t border-slate-800">
                <span>Tổng tiền:</span>
                <span className="text-emerald-400">{activeDialog.plan.price}</span>
              </div>
            </div>

            <div className="p-3 bg-blue-950/40 border border-blue-800/60 rounded-lg text-blue-200 flex items-start gap-2">
              <Shield className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Đây là cổng thanh toán Sandbox tự động giả lập theo yêu cầu dự án. Nhấn Xác nhận để kích hoạt gói ngay lập tức.
              </span>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setActiveDialog(null)}>
                Hủy
              </Button>
              <Button variant="primary" size="sm" onClick={handleConfirmPayment}>
                Xác nhận thanh toán Sandbox
              </Button>
            </div>
          </div>
        )}

        {checkoutStep === 'processing' && (
          <div className="py-8 text-center space-y-3">
            <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-200">Đang xác thực giao dịch với cổng thanh toán...</p>
          </div>
        )}

        {checkoutStep === 'success' && activeDialog && (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Nâng cấp thành công!</h4>
              <p className="text-xs text-slate-400 mt-1">
                Tài khoản của bạn đã được chuyển sang hạng <strong>{activeDialog.plan.name}</strong>.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              className="mx-auto"
              onClick={() => setActiveDialog(null)}
            >
              Đóng và tiếp tục làm việc
            </Button>
          </div>
        )}
      </Dialog>
    </div>
  );
};
