import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ShieldCheck,
  CreditCard,
  Building2,
  User,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { paymentService } from '../billing/paymentService';
import { useI18n } from '../i18n/context';

export interface PaymentOrderDetails {
  orderId: string;
  orderCode: string;
  productId: string;
  productTitle: string;
  amount: number;
  currency: string;
  bankDetails: {
    bankName: string;
    accountNumber: string;
    accountNumberMasked: string;
    accountName: string;
    orderCode: string;
    transferContent: string;
    qrUrl: string;
  };
}

interface PaymentModalProps {
  order: PaymentOrderDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess?: (order: PaymentOrderDetails) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  order,
  isOpen,
  onClose,
  onPaymentSuccess,
}) => {
  const { language, formatCurrency } = useI18n();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'verifying' | 'paid' | 'error'>('pending');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (order && isOpen) {
      setPaymentStatus('pending');
      setErrorMessage(null);
      paymentService.registerOrder({
        orderId: order.orderId,
        productId: order.productId,
        productName: order.productTitle,
        amount: order.amount,
        currency: (order.currency as any) || 'VND',
        status: 'pending',
      });
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const handleCopy = (text: string, field: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2200);
    } catch {
      // Fallback
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2200);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    setPaymentStatus('verifying');
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/orders/status?orderId=${order.orderId}`);
      if (!res.ok) throw new Error('Không thể kiểm tra trạng thái đơn hàng');
      const data = await res.json();

      if (data.status === 'paid' || data.status === 'completed') {
        setPaymentStatus('paid');
        confetti({
          particleCount: 110,
          spread: 75,
          origin: { y: 0.6 },
        });

        setTimeout(() => {
          if (onPaymentSuccess) {
            onPaymentSuccess(order);
          }
        }, 1400);
      } else {
        // Mock verification for local/demo test if server is pending
        const mockVerify = await fetch('/api/orders/mock-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.orderId }),
        });
        const mockData = await mockVerify.json();

        if (mockData.success) {
          setPaymentStatus('paid');
          confetti({
            particleCount: 110,
            spread: 75,
            origin: { y: 0.6 },
          });
          setTimeout(() => {
            if (onPaymentSuccess) {
              onPaymentSuccess(order);
            }
          }, 1400);
        } else {
          setPaymentStatus('pending');
          setErrorMessage(
            language === 'vi'
              ? 'Hệ thống chưa ghi nhận tiền vào tài khoản. Vui lòng kiểm tra lại nội dung chuyển khoản hoặc thử lại sau 30 giây.'
              : 'Payment not detected yet. Please ensure exact transfer content or retry in 30 seconds.'
          );
        }
      }
    } catch (err: any) {
      setPaymentStatus('error');
      setErrorMessage(
        err?.message ||
          (language === 'vi'
            ? 'Chưa ghi nhận giao dịch. Vui lòng kiểm tra lại số tài khoản và nội dung chuyển khoản.'
            : 'Transaction not found. Please verify account number and transfer content.')
      );
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      {/* 3D Elevated Card matching Membership reference design */}
      <div
        className="
          relative w-full max-w-xl rounded-3xl overflow-hidden flex flex-col max-h-[92vh]
          transition-all duration-300
          bg-gradient-to-b from-[#f8fafc] via-white to-[#f0f9ff] text-slate-800
          border border-cyan-300/80
          shadow-[0_16px_50px_rgba(6,182,212,0.16),_inset_0_1px_1px_rgba(255,255,255,0.95)]
          dark:bg-gradient-to-b dark:from-[#0b1c30] dark:via-[#091829] dark:to-[#071322] dark:text-slate-100
          dark:border-cyan-500/50
          dark:shadow-[0_0_40px_rgba(6,182,212,0.22),_0_24px_60px_rgba(0,0,0,0.65),_inset_0_1px_1px_rgba(255,255,255,0.12)]
        "
      >
        {/* Subtle Top Glowing Line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80" />

        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-cyan-200/60 dark:border-cyan-900/60 bg-white/70 dark:bg-[#081525]/70 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gradient-to-br from-cyan-400/20 to-blue-500/20 border border-cyan-400/40 text-cyan-600 dark:text-cyan-400 shadow-sm">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-300/60 dark:border-cyan-500/40 text-[10px] font-bold tracking-wider uppercase mb-0.5">
                <ShieldCheck className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                <span>{language === 'vi' ? 'Cổng thanh toán VietQR' : 'VietQR Gateway'}</span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                {language === 'vi' ? 'Thanh toán chuyển khoản ngân hàng' : 'Bank Transfer Payment'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition"
            title={language === 'vi' ? 'Đóng' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4.5 text-xs">
          {/* Payment Success Alert */}
          {paymentStatus === 'paid' && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-500/60 text-emerald-900 dark:text-emerald-200 flex items-center gap-3.5 shadow-md shadow-emerald-500/10 animate-in zoom-in-95">
              <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Check className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {language === 'vi' ? 'Thanh toán thành công!' : 'Payment Successful!'}
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300/90 mt-0.5">
                  {language === 'vi'
                    ? 'Quyền sở hữu đã được kích hoạt. Đang mở mạch vào dự án của bạn...'
                    : 'Access granted. Opening circuit in your projects...'}
                </p>
              </div>
            </div>
          )}

          {/* Product Info & Amount Pill Banner (Matching 3D Membership card typography) */}
          <div
            className="
              p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3
              bg-white/90 dark:bg-[#071526]/90 border border-cyan-200/90 dark:border-cyan-500/35
              shadow-[0_4px_14px_rgba(6,182,212,0.08),_inset_0_1px_1px_rgba(255,255,255,0.8)]
              dark:shadow-[0_0_18px_rgba(6,182,212,0.14),_inset_0_1px_1px_rgba(255,255,255,0.08)]
            "
          >
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {language === 'vi' ? 'Chi tiết giao dịch' : 'Order Item'}
              </span>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white line-clamp-1">
                {order.productTitle}
              </h3>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-mono">
                <span>{language === 'vi' ? 'Mã đơn:' : 'Code:'}</span>
                <span className="font-semibold text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-800">
                  {order.orderCode}
                </span>
              </div>
            </div>

            <div className="sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                {language === 'vi' ? 'Số tiền thanh toán' : 'Amount Due'}
              </span>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-cyan-600 dark:text-cyan-400 whitespace-nowrap mt-0.5">
                {formatCurrency(order.amount)}
              </div>
            </div>
          </div>

          {/* QR Code + Bank Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-stretch">
            {/* Left: QR Code in crisp 3D elevated pedestal */}
            <div
              className="
                md:col-span-2 flex flex-col items-center justify-center p-3.5 rounded-2xl
                bg-white border border-cyan-200/90 dark:border-cyan-500/40
                shadow-[0_8px_20px_rgba(6,182,212,0.12),_inset_0_1px_1px_rgba(255,255,255,0.9)]
                dark:shadow-[0_0_25px_rgba(6,182,212,0.18)]
              "
            >
              <div className="relative p-2 rounded-xl bg-white border border-slate-100 shadow-inner">
                <img
                  src={order.bankDetails.qrUrl}
                  alt="VietQR Code"
                  className="w-40 h-40 object-contain block"
                  crossOrigin="anonymous"
                />
              </div>
              <p className="text-[11px] font-semibold text-slate-700 text-center mt-2.5">
                {language === 'vi' ? 'Quét mã VietQR tự động điền' : 'Scan VietQR to auto-fill'}
              </p>
              <span className="text-[10px] text-slate-400 text-center">
                {language === 'vi' ? 'Hỗ trợ tất cả app Ngân hàng & MoMo' : 'Supports all banking apps & MoMo'}
              </span>
            </div>

            {/* Right: Bank Details in elevated tiles */}
            <div className="md:col-span-3 space-y-2.5 flex flex-col justify-between">
              {/* Bank Name */}
              <div className="p-2.5 rounded-xl bg-slate-50/90 dark:bg-[#071526]/80 border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1 font-semibold">
                  <Building2 className="w-3 h-3 text-cyan-500" />
                  {language === 'vi' ? 'Ngân hàng thụ hưởng:' : 'Beneficiary Bank:'}
                </span>
                <p className="font-extrabold text-slate-900 dark:text-white text-xs mt-0.5">
                  {order.bankDetails.bankName}
                </p>
              </div>

              {/* Account Name */}
              <div className="p-2.5 rounded-xl bg-slate-50/90 dark:bg-[#071526]/80 border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1 font-semibold">
                  <User className="w-3 h-3 text-cyan-500" />
                  {language === 'vi' ? 'Chủ tài khoản:' : 'Account Holder:'}
                </span>
                <p className="font-extrabold text-xs mt-0.5 uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                  {order.bankDetails.accountName}
                </p>
              </div>

              {/* Account Number */}
              <div className="p-2.5 rounded-xl bg-slate-50/90 dark:bg-[#071526]/80 border border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1 font-semibold">
                    <CreditCard className="w-3 h-3 text-cyan-500" />
                    {language === 'vi' ? 'Số tài khoản:' : 'Account Number:'}
                  </span>
                  <button
                    onClick={() => handleCopy(order.bankDetails.accountNumber, 'accNum')}
                    className="text-[10px] px-2 py-0.5 rounded-md font-bold text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950 flex items-center gap-1 transition"
                  >
                    {copiedField === 'accNum' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400">{language === 'vi' ? 'Đã sao chép' : 'Copied'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>{language === 'vi' ? 'Sao chép' : 'Copy'}</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="font-mono font-bold text-slate-900 dark:text-white text-xs tracking-wider">
                  {order.bankDetails.accountNumber}
                </p>
              </div>

              {/* Transfer Content (Mandatory) */}
              <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-500/40">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold uppercase tracking-wider">
                    {language === 'vi' ? 'Nội dung chuyển khoản (bắt buộc):' : 'Transfer Memo (Required):'}
                  </span>
                  <button
                    onClick={() => handleCopy(order.bankDetails.transferContent, 'content')}
                    className="text-[10px] px-2 py-0.5 rounded-md font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 flex items-center gap-1 transition"
                  >
                    {copiedField === 'content' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400">{language === 'vi' ? 'Đã sao chép' : 'Copied'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>{language === 'vi' ? 'Sao chép' : 'Copy'}</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="font-mono font-extrabold text-amber-900 dark:text-amber-200 text-xs tracking-wider">
                  {order.bankDetails.transferContent}
                </p>
              </div>
            </div>
          </div>

          {/* Secure Guarantee Notice */}
          <div className="p-3 rounded-2xl bg-cyan-50/70 dark:bg-cyan-950/40 border border-cyan-200/80 dark:border-cyan-800/60 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <span>
              {language === 'vi'
                ? 'Hệ thống tự động kích hoạt quyền truy cập ngay khi giao dịch được xác nhận. Hỗ trợ kỹ thuật 24/7.'
                : 'System auto-activates immediately upon payment confirmation. 24/7 technical support.'}
            </span>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Footer with 3D Raised Action Button matching Membership CTA */}
        <div className="px-6 py-4 border-t border-cyan-200/60 dark:border-cyan-900/60 bg-white/70 dark:bg-[#081525]/70 backdrop-blur-md flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-2xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition"
          >
            {language === 'vi' ? 'Hủy / Đóng' : 'Cancel / Close'}
          </button>

          <button
            onClick={handleVerify}
            disabled={isVerifying || paymentStatus === 'paid'}
            className="tech-btn-3d w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3 rounded-2xl text-xs font-extrabold text-white disabled:opacity-50 disabled:pointer-events-none"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                <span className="tracking-wide">{language === 'vi' ? 'Đang kiểm tra hệ thống...' : 'Verifying transaction...'}</span>
              </>
            ) : paymentStatus === 'paid' ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                <span className="tracking-wide">{language === 'vi' ? 'Đã xác nhận thanh toán' : 'Payment Confirmed'}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                <span className="tracking-wide">{language === 'vi' ? 'Tôi đã chuyển khoản - Kiểm tra trạng thái' : "I've Transferred - Verify"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
