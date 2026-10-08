import React, { useState, useEffect } from 'react';
import { paymentService } from '../billing/paymentService';
import { ShieldCheck, Check, Box, GraduationCap, Crown, ArrowRight } from 'lucide-react';
import { PaymentModal, PaymentOrderDetails } from '../components/PaymentModal';
import { useI18n } from '../i18n/context';

export interface MembershipPageProps {
  onPlanUpdated: () => void;
  currentUser?: any;
  onOpenAuthModal?: () => void;
}

/**
 * 3D Isometric Holographic Token displayed on the right side of the price in each card,
 * matching the exact holographic pedestal visual seen in the reference images.
 */
const PlanHoloToken: React.FC<{ planId: 'free' | 'student' | 'creator'; isPopular?: boolean }> = ({
  planId,
  isPopular,
}) => {
  return (
    <div className="relative w-14 h-12 shrink-0 flex items-center justify-center select-none group/token">
      <svg
        width="60"
        height="50"
        viewBox="0 0 66 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm transition-transform duration-300 group-hover/token:scale-105"
      >
        <defs>
          {/* Radial glow for holographic beam */}
          <radialGradient id={`holo-glow-${planId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={isPopular ? '0.65' : '0.45'} />
            <stop offset="60%" stopColor="#06b6d4" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </radialGradient>

          {/* Pedestal bevel gradients */}
          <linearGradient id={`pedestal-top-${planId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#67e8f9" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>

          <linearGradient id={`pedestal-body-${planId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#082f49" stopOpacity="0.2" />
          </linearGradient>

          {/* Token Gradients */}
          <linearGradient id={`token-light-${planId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a5f3fc" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <linearGradient id={`token-dark-${planId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
        </defs>

        {/* Ambient holographic glow floor */}
        <ellipse cx="33" cy="42" rx="28" ry="11" fill={`url(#holo-glow-${planId})`} />

        {/* Holographic Pedestal Base */}
        <path
          d="M 10 42 C 10 48, 56 48, 56 42 L 56 45 C 56 50, 10 50, 10 45 Z"
          fill={`url(#pedestal-body-${planId})`}
        />
        <ellipse
          cx="33"
          cy="42"
          rx="23"
          ry="7.5"
          fill="#071b2e"
          fillOpacity="0.4"
          stroke={`url(#pedestal-top-${planId})`}
          strokeWidth="1.2"
        />
        <ellipse
          cx="33"
          cy="42"
          rx="15"
          ry="4.5"
          stroke="#38bdf8"
          strokeWidth="0.8"
          strokeDasharray="2 2"
          strokeOpacity="0.9"
        />
        <ellipse cx="33" cy="42" rx="6" ry="2" fill="#22d3ee" fillOpacity="0.5" />

        {/* 3D Floating Token Elements */}
        {planId === 'free' && (
          /* Isometric 3D translucent Box */
          <g className="transition-transform duration-300 group-hover/token:-translate-y-1">
            {/* Top Face */}
            <polygon
              points="33,10 45,16 33,22 21,16"
              fill={`url(#token-light-${planId})`}
              stroke="#e0f2fe"
              strokeWidth="0.8"
              fillOpacity="0.95"
            />
            {/* Left Face */}
            <polygon
              points="21,16 33,22 33,34 21,28"
              fill="#0284c7"
              stroke="#7dd3fc"
              strokeWidth="0.8"
              fillOpacity="0.85"
            />
            {/* Right Face */}
            <polygon
              points="33,22 45,16 45,28 33,34"
              fill={`url(#token-dark-${planId})`}
              stroke="#38bdf8"
              strokeWidth="0.8"
              fillOpacity="0.9"
            />
            {/* Center light core */}
            <circle cx="33" cy="22" r="1.5" fill="#ffffff" />
          </g>
        )}

        {planId === 'student' && (
          /* Isometric 3D Graduation Cap with Tassel */
          <g className="transition-transform duration-300 group-hover/token:-translate-y-1">
            {/* Skull Cap Base */}
            <path
              d="M 26 21 C 26 27, 40 27, 40 21 L 40 26 C 40 31, 26 31, 26 26 Z"
              fill="#0369a1"
              stroke="#38bdf8"
              strokeWidth="0.8"
            />
            {/* Diamond Top */}
            <polygon
              points="33,9 49,16 33,23 17,16"
              fill={`url(#token-light-${planId})`}
              stroke="#f0f9ff"
              strokeWidth="1"
            />
            {/* Center Cap Button */}
            <circle cx="33" cy="16" r="1.5" fill="#ffffff" />
            {/* Tassel String & Pendant */}
            <path
              d="M 33 16 L 46 22 L 47 29"
              stroke="#e0f2fe"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <circle cx="47" cy="29.5" r="1.2" fill="#e0f2fe" />
          </g>
        )}

        {planId === 'creator' && (
          /* Isometric 3D Crown */
          <g className="transition-transform duration-300 group-hover/token:-translate-y-1">
            {/* Crown Base Rim */}
            <path
              d="M 21 27 C 21 31, 45 31, 45 27 L 44 31 C 44 34, 22 34, 22 31 Z"
              fill="#0369a1"
              stroke="#38bdf8"
              strokeWidth="0.8"
            />
            {/* Crown Peaks */}
            <polygon
              points="21,27 20,16 26,22 33,12 40,22 46,16 45,27"
              fill={`url(#token-light-${planId})`}
              stroke="#e0f2fe"
              strokeWidth="1"
            />
            {/* Crown Jewels on 3 Peaks */}
            <circle cx="20" cy="16" r="1.5" fill="#ffffff" />
            <circle cx="33" cy="12" r="1.8" fill="#ffffff" />
            <circle cx="46" cy="16" r="1.5" fill="#ffffff" />
          </g>
        )}
      </svg>
    </div>
  );
};

export const MembershipPage: React.FC<MembershipPageProps> = ({
  onPlanUpdated,
  currentUser,
  onOpenAuthModal,
}) => {
  const { language } = useI18n();
  const [activePlan, setActivePlan] = useState<'free' | 'student' | 'creator'>(
    () => paymentService.getAccountInfo().plan
  );
  const [upgradedSuccess, setUpgradedSuccess] = useState<string | null>(null);
  const [activePaymentOrder, setActivePaymentOrder] = useState<PaymentOrderDetails | null>(null);
  const [targetPlanId, setTargetPlanId] = useState<'student' | 'creator' | null>(null);

  useEffect(() => {
    const refresh = () => setActivePlan(paymentService.getAccountInfo().plan);
    refresh();
    const unsub = paymentService.subscribe(refresh);
    return () => unsub();
  }, [currentUser]);

  const plans = [
    {
      id: 'free',
      name: language === 'vi' ? 'Miễn phí (Free)' : 'Free Tier',
      price: '0 ₫',
      period: language === 'vi' ? '/ mãi mãi' : '/ forever',
      desc:
        language === 'vi'
          ? 'Dành cho người mới bắt đầu làm quen với điện tử 3D.'
          : 'For beginners starting their 3D circuit journey.',
      icon: Box,
      features:
        language === 'vi'
          ? [
              'Mô phỏng 3D cơ bản',
              'Tối đa 10 dự án lưu trữ',
              '50 lượt hỏi Minibot AI / tháng',
              'Truy cập các bài học cơ bản',
              'Linh kiện tiêu chuẩn (LED, Điện trở, Pin)',
            ]
          : [
              'Basic 3D simulation',
              'Up to 10 stored projects',
              '50 Minibot AI queries / month',
              'Access to basic tutorials',
              'Standard components (LED, Resistor, Battery)',
            ],
    },
    {
      id: 'student',
      name: language === 'vi' ? 'Học viên (Student)' : 'Student Pro',
      price: '99.000 ₫',
      period: language === 'vi' ? '/ tháng' : '/ month',
      isPopular: true,
      desc:
        language === 'vi'
          ? 'Dành cho học sinh, sinh viên các ngành kỹ thuật & STEM.'
          : 'For STEM students and electronics enthusiasts.',
      icon: GraduationCap,
      features:
        language === 'vi'
          ? [
              'Toàn bộ tính năng gói Free',
              'Tối đa 50 dự án lưu trữ',
              '200 lượt hỏi Minibot AI / tháng',
              'Toàn bộ 5 bài học & chứng chỉ',
              'Chế độ mô phỏng linh kiện (Exploded View)',
              'Xuất file JSON & Lịch sử phiên bản không giới hạn',
            ]
          : [
              'All Free features included',
              'Up to 50 stored projects',
              '200 Minibot AI queries / month',
              'All 5 core courses & certificates',
              'Exploded View 3D inspection',
              'Unlimited JSON export & revision history',
            ],
    },
    {
      id: 'creator',
      name: language === 'vi' ? 'Nhà sáng tạo (Creator Pro)' : 'Creator Pro',
      price: '249.000 ₫',
      period: language === 'vi' ? '/ tháng' : '/ month',
      desc:
        language === 'vi'
          ? 'Dành cho giảng viên, maker và kỹ sư phần cứng chuyên nghiệp.'
          : 'For makers, instructors, and hardware engineers.',
      icon: Crown,
      features:
        language === 'vi'
          ? [
              'Toàn bộ tính năng gói Student',
              'Tối đa 500 dự án lưu trữ',
              '1.000 lượt hỏi Minibot AI / tháng',
              'Đăng bán mạch thiết kế trên Cửa hàng (Marketplace)',
              'Hỗ trợ ưu tiên 1:1 từ chuyên gia',
              'Dữ liệu Three.js cao cấp khử răng cưa',
            ]
          : [
              'All Student Pro features included',
              'Up to 500 stored projects',
              '1,000 Minibot AI queries / month',
              'Sell circuit designs on Marketplace',
              'Priority 1:1 hardware mentoring',
              'High-fidelity Three.js antialiasing',
            ],
    },
  ];

  const handleSelectPlan = async (planId: 'free' | 'student' | 'creator') => {
    if (planId === 'free') {
      paymentService.updatePlan(planId);
      setActivePlan(planId);
      setUpgradedSuccess(
        language === 'vi'
          ? `Đã chuyển đổi sang gói ${planId.toUpperCase()} thành công!`
          : `Switched to ${planId.toUpperCase()} plan!`
      );
      onPlanUpdated();
      setTimeout(() => setUpgradedSuccess(null), 3000);
      return;
    }

    if (!currentUser && onOpenAuthModal) {
      onOpenAuthModal();
      return;
    }

    // Call server to create authoritative order
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: `plan-${planId}`,
          userId: currentUser?.id || 'guest',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.order) {
          setTargetPlanId(planId);
          setActivePaymentOrder(data.order);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePaymentSuccess = () => {
    if (targetPlanId) {
      paymentService.updatePlan(targetPlanId);
      setActivePlan(targetPlanId);
      setUpgradedSuccess(
        language === 'vi'
          ? `Chúc mừng! Bạn đã nâng cấp thành công gói ${targetPlanId.toUpperCase()}!`
          : `Congratulations! Upgraded to ${targetPlanId.toUpperCase()}!`
      );
      onPlanUpdated();
      setActivePaymentOrder(null);
      setTargetPlanId(null);
      setTimeout(() => setUpgradedSuccess(null), 4000);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-transparent p-6 md:p-8 select-none text-slate-800 dark:text-slate-100 transition-colors">
      <div className="max-w-5xl mx-auto space-y-9">
        {/* Header Hero */}
        <div className="text-center space-y-3.5 max-w-2xl mx-auto pb-2">
          {/* Category Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 dark:bg-[#0b1c30]/90 text-cyan-700 dark:text-cyan-300 border border-cyan-300/80 dark:border-cyan-500/50 shadow-[0_2px_10px_rgba(6,182,212,0.12)] dark:shadow-[0_0_20px_rgba(6,182,212,0.2)] text-xs font-bold backdrop-blur-md transition-all duration-300">
            <ShieldCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>
              {language === 'vi'
                ? 'Gói dịch vụ & Quyền lợi thành viên'
                : 'Membership Plans & Benefits'}
            </span>
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight transition-colors duration-300">
            {language === 'vi' ? 'Nâng tầm trải nghiệm thiết kế' : 'Elevate Your Circuit Experience'}
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed font-normal transition-colors duration-300">
            {language === 'vi'
              ? 'Chọn gói cước phù hợp với nhu cầu học tập, nghiên cứu và sáng tạo dự án điện tử của bạn.'
              : 'Choose the ideal plan tailored to your learning, laboratory research, and hardware innovation.'}
          </p>
        </div>

        {/* Success Alert */}
        {upgradedSuccess && (
          <div className="p-3.5 bg-emerald-50/95 dark:bg-emerald-950/80 border border-emerald-400 dark:border-emerald-500 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-2xl text-center shadow-lg animate-in fade-in transition-all">
            {upgradedSuccess}
          </div>
        )}

        {/* Pricing Cards Grid (Free, Student, Creator Pro) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-7 items-stretch pt-3">
          {plans.map((p) => {
            const isCurrent = activePlan === p.id;
            const PlanIcon = p.icon;

            return (
              <div
                key={p.id}
                className={`relative rounded-[26px] p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 group ${
                  p.isPopular
                    ? /* Primary Student Card: Elevated, 3D Cyan border, layered shadow, higher z-index */
                      'z-10 md:-translate-y-2 lg:-translate-y-3 hover:md:-translate-y-3.5 ' +
                      'bg-gradient-to-b from-[#ffffff] via-[#f7fbfe] to-[#edf6fb] ' +
                      'dark:from-[#0a1b2f] dark:via-[#071526] dark:to-[#040e1b] ' +
                      'border-2 border-cyan-400 dark:border-cyan-400 ' +
                      'shadow-[0_22px_45px_-8px_rgba(6,182,212,0.22),_0_6px_16px_-4px_rgba(15,23,42,0.06),_inset_0_1px_2px_rgba(255,255,255,1)] ' +
                      'dark:shadow-[0_0_38px_rgba(6,182,212,0.32),_0_20px_50px_-10px_rgba(0,0,0,0.85),_inset_0_1px_2px_rgba(34,211,238,0.35)]'
                    : p.id === 'creator'
                    ? /* Creator Pro Card: Medium hierarchy */
                      'hover:-translate-y-1.5 ' +
                      'bg-gradient-to-b from-[#ffffff] via-[#fafcfd] to-[#f4f8fb] ' +
                      'dark:from-[#0a182b] dark:via-[#071424] dark:to-[#040d18] ' +
                      'border border-[#cbe3f2] dark:border-cyan-400/40 ' +
                      'shadow-[0_14px_34px_-6px_rgba(6,182,212,0.1),_0_4px_12px_rgba(15,23,42,0.04),_inset_0_1px_1.5px_rgba(255,255,255,1)] ' +
                      'dark:shadow-[0_18px_40px_-8px_rgba(0,0,0,0.75),_0_0_24px_rgba(6,182,212,0.12),_inset_0_1px_1.5px_rgba(255,255,255,0.08)]'
                    : /* Free Card: Clean, subtle 3D depth */
                      'hover:-translate-y-1.5 ' +
                      'bg-gradient-to-b from-[#ffffff] via-[#fafcfd] to-[#f4f8fb] ' +
                      'dark:from-[#091728] dark:via-[#071322] dark:to-[#040d18] ' +
                      'border border-[#cbe3f2] dark:border-cyan-500/25 ' +
                      'shadow-[0_12px_32px_-6px_rgba(6,182,212,0.08),_0_4px_12px_rgba(15,23,42,0.04),_inset_0_1px_1.5px_rgba(255,255,255,1)] ' +
                      'dark:shadow-[0_16px_36px_-8px_rgba(0,0,0,0.7),_0_0_20px_rgba(6,182,212,0.08),_inset_0_1px_1.5px_rgba(255,255,255,0.06)]'
                }`}
              >
                {/* Most Popular Raised Pill Badge (Student Plan Only) */}
                {p.isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
                    <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-cyan-500 via-sky-500 to-cyan-400 text-white border border-cyan-200/80 dark:border-cyan-300/80 shadow-[0_4px_14px_rgba(6,182,212,0.45)] dark:shadow-[0_0_18px_rgba(6,182,212,0.6)]">
                      <Crown className="w-3.5 h-3.5 fill-current" />
                      <span>{language === 'vi' ? 'PHỔ BIẾN NHẤT' : 'MOST POPULAR'}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-5">
                  {/* Card Header: Mini Elevated Tile + Plan Name & Subtext */}
                  <div className="flex items-start gap-3.5">
                    {/* Elevated Mini Icon Tile */}
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                        p.isPopular
                          ? 'bg-gradient-to-br from-white to-cyan-50 dark:from-[#0d2642] dark:to-[#07192c] border border-cyan-300 dark:border-cyan-400/60 shadow-[0_4px_14px_rgba(6,182,212,0.18),_inset_0_1px_1.5px_rgba(255,255,255,1)] dark:shadow-[0_0_18px_rgba(6,182,212,0.3),_inset_0_1px_1.5px_rgba(255,255,255,0.2)] text-cyan-600 dark:text-cyan-300'
                          : 'bg-gradient-to-br from-white to-cyan-50/70 dark:from-[#0c223a] dark:to-[#071626] border border-cyan-200/90 dark:border-cyan-400/40 shadow-[0_4px_12px_rgba(6,182,212,0.12),_inset_0_1px_1.5px_rgba(255,255,255,1)] dark:shadow-[0_0_16px_rgba(6,182,212,0.2),_inset_0_1px_1.5px_rgba(255,255,255,0.15)] text-cyan-600 dark:text-cyan-400'
                      }`}
                    >
                      <PlanIcon className="w-5 h-5 stroke-[2.2]" />
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug">
                        {p.name}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                        {p.desc}
                      </p>
                    </div>
                  </div>

                  {/* Price Section with 3D Holographic Pedestal Token */}
                  <div className="pt-3 pb-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-1.5 whitespace-nowrap shrink-0 min-w-0">
                      <span
                        className={`text-2xl sm:text-3xl lg:text-[32px] font-black font-mono tracking-tight leading-none whitespace-nowrap ${
                          p.isPopular
                            ? 'text-cyan-600 dark:text-cyan-300'
                            : p.id === 'creator'
                            ? 'text-indigo-600 dark:text-cyan-300'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {p.price.replace(' ', '\u00A0')}
                      </span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-sans whitespace-nowrap">
                        {p.period}
                      </span>
                    </div>

                    {/* Holographic Pedestal floating 3D artifact */}
                    <PlanHoloToken planId={p.id as any} isPopular={p.isPopular} />
                  </div>

                  {/* Feature List with Circular Cyan Badges */}
                  <ul className="space-y-3 pt-1">
                    {p.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-cyan-50 dark:bg-cyan-950/90 border border-cyan-300/80 dark:border-cyan-400/60 text-cyan-600 dark:text-cyan-300 shadow-[0_1px_3px_rgba(6,182,212,0.15)] dark:shadow-[0_0_8px_rgba(6,182,212,0.3)]">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-relaxed">
                          {feat}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Card CTA Action Button */}
                <div className="pt-6 sm:pt-7">
                  {isCurrent ? (
                    /* Current Plan (Disabled-like state) */
                    <button
                      disabled
                      className="w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 bg-white/90 dark:bg-[#071322]/90 text-cyan-700 dark:text-cyan-400 border border-cyan-300/80 dark:border-cyan-500/30 shadow-xs cursor-default"
                    >
                      <span>
                        {language === 'vi' ? 'Gói hiện tại của bạn' : 'Current Plan'}
                      </span>
                    </button>
                  ) : p.isPopular ? (
                    /* Student Plan: 3D embossed button with exact frame of Login button (tech-btn-3d) */
                    <button
                      onClick={() => handleSelectPlan('student')}
                      className="w-full tech-btn-3d py-3 px-5 rounded-2xl text-xs font-black tracking-wide uppercase flex items-center justify-center gap-2 group/btn cursor-pointer shadow-lg"
                    >
                      <Crown className="w-4 h-4 text-white fill-current shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                      <span className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">
                        {language === 'vi' ? 'Nâng cấp qua VietQR' : 'Upgrade with VietQR'}
                      </span>
                      <ArrowRight className="w-4 h-4 text-white shrink-0 transition-transform group-hover/btn:translate-x-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
                    </button>
                  ) : p.id === 'creator' ? (
                    /* Creator Pro: Tactile Secondary/Pro CTA Button */
                    <button
                      onClick={() => handleSelectPlan('creator')}
                      className="w-full py-3 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer
                        bg-gradient-to-b from-white to-slate-50 text-slate-800 border border-cyan-300
                        shadow-[0_4px_14px_rgba(6,182,212,0.12),_inset_0_1px_1px_rgba(255,255,255,0.9)]
                        dark:bg-gradient-to-b dark:from-[#0e2136] dark:to-[#091726] dark:text-cyan-200 dark:border-cyan-500/40 dark:shadow-[0_0_18px_rgba(6,182,212,0.2),_inset_0_1px_1px_rgba(255,255,255,0.1)]
                        hover:border-cyan-400 hover:text-cyan-600 dark:hover:border-cyan-300 dark:hover:text-white
                        hover:-translate-y-0.5 active:translate-y-0.5 active:scale-[0.97]
                      "
                    >
                      <Crown className="w-4 h-4 shrink-0" />
                      <span>
                        {language === 'vi' ? 'Nâng cấp qua VietQR' : 'Upgrade with VietQR'}
                      </span>
                    </button>
                  ) : (
                    /* Free Plan: Activate Free Button */
                    <button
                      onClick={() => handleSelectPlan('free')}
                      className="w-full py-3 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer
                        bg-gradient-to-b from-white to-slate-50 text-slate-800 border border-cyan-300
                        shadow-[0_4px_14px_rgba(6,182,212,0.12),_inset_0_1px_1px_rgba(255,255,255,0.9)]
                        dark:bg-gradient-to-b dark:from-[#0e2136] dark:to-[#091726] dark:text-cyan-200 dark:border-cyan-500/40 dark:shadow-[0_0_18px_rgba(6,182,212,0.2),_inset_0_1px_1px_rgba(255,255,255,0.1)]
                        hover:border-cyan-400 hover:text-cyan-600 dark:hover:border-cyan-300 dark:hover:text-white
                        hover:-translate-y-0.5 active:translate-y-0.5 active:scale-[0.97]
                      "
                    >
                      <span>
                        {language === 'vi' ? 'Kích hoạt gói Miễn phí' : 'Activate Free'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Official VietQR Payment Modal */}
      <PaymentModal
        order={activePaymentOrder}
        isOpen={Boolean(activePaymentOrder)}
        onClose={() => setActivePaymentOrder(null)}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
};
