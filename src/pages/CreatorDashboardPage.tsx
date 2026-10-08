import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Box,
  GraduationCap,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Plus,
  Eye,
  History,
  Edit3,
  Archive,
  CheckCircle2,
  AlertCircle,
  Clock,
  Star,
  Users,
  Search,
  Filter,
  ShieldCheck,
  User,
  Globe,
  Github,
  Youtube,
  Linkedin,
  ArrowUpRight,
  RotateCw,
  RefreshCw,
  Layers,
  PauseCircle,
  PlayCircle,
  ExternalLink,
  ChevronRight,
  FileText,
  CreditCard,
} from 'lucide-react';
import { ProjectDocument } from '../domain/project/types';
import { useI18n } from '../i18n/context';
import { PublishProductModal } from '../components/creator/PublishProductModal';
import { CreateCourseModal } from '../components/creator/CreateCourseModal';
import { VersionHistoryModal } from '../components/creator/VersionHistoryModal';
import { Product3DViewerModal } from '../components/Product3DViewerModal';
import { paymentService } from '../billing/paymentService';
import { authService } from '../persistence/authService';

export interface CreatorDashboardPageProps {
  currentUser: any;
  currentProfile?: any;
  onOpenProject?: (project: ProjectDocument) => void;
  onNavigate?: (route: any) => void;
  onOpenAuthModal?: () => void;
  currentProject?: ProjectDocument;
}

export const CreatorDashboardPage: React.FC<CreatorDashboardPageProps> = ({
  currentUser,
  currentProfile,
  onOpenProject,
  onNavigate,
  onOpenAuthModal,
  currentProject,
}) => {
  const { language, formatCurrency, t } = useI18n();
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'courses' | 'orders' | 'analytics' | 'profile'>('overview');

  // Creator state
  const [profile, setProfile] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({
    grossRevenue: 0,
    netRevenue: 0,
    totalSalesCount: 0,
    productsCount: 0,
    coursesCount: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isActivatingTier, setIsActivatingTier] = useState(false);

  // Modals state
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isCreateCourseModalOpen, setIsCreateCourseModalOpen] = useState(false);
  const [selectedProductForVersions, setSelectedProductForVersions] = useState<any | null>(null);
  const [selectedItemFor3DPreview, setSelectedItemFor3DPreview] = useState<{ id: string; title: string; price: number } | null>(null);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

  // Profile edit state
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileSpecialty, setProfileSpecialty] = useState('');
  const [profileGithub, setProfileGithub] = useState('');
  const [profileYoutube, setProfileYoutube] = useState('');
  const [profileWebsite, setProfileWebsite] = useState('');
  const [profileSavedSuccess, setProfileSavedSuccess] = useState(false);

  const userId = currentUser?.id || 'creator-demo';

  const loadCreatorData = async () => {
    setIsLoading(true);
    try {
      const fetchJson = async (url: string) => {
        try {
          const res = await fetch(url);
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            return await res.json();
          }
        } catch (e) {
          console.warn('Network parse warn:', url, e);
        }
        return null;
      };

      // 1. Load Profile
      const pData = await fetchJson(`/api/creator/profile?userId=${encodeURIComponent(userId)}`);
      if (pData?.profile) {
        setProfile(pData.profile);
        setProfileDisplayName(pData.profile.displayName || '');
        setProfileBio(pData.profile.bio || '');
        setProfileSpecialty(pData.profile.specialty || '');
        setProfileGithub(pData.profile.socialLinks?.github || '');
        setProfileYoutube(pData.profile.socialLinks?.youtube || '');
        setProfileWebsite(pData.profile.socialLinks?.website || '');
      }

      // 2. Load Products
      const prodData = await fetchJson(`/api/creator/products?userId=${encodeURIComponent(userId)}`);
      const prods: any[] = prodData?.products || [];
      setProducts(prods);

      // 3. Load Courses
      const cData = await fetchJson(`/api/creator/courses?userId=${encodeURIComponent(userId)}`);
      const crss: any[] = cData?.courses || [];
      setCourses(crss);

      // 4. Load Sales & Revenue
      const sData = await fetchJson(`/api/creator/sales?userId=${encodeURIComponent(userId)}`);
      const sls: any[] = sData?.sales || [];
      setSales(sls);

      // Calculate aggregated metrics
      const gross = sls.reduce((sum, item) => sum + (item.creatorEarnings ? item.creatorEarnings / 0.85 : item.amount || 0), 0);
      const net = sls.reduce((sum, item) => sum + (item.creatorEarnings || 0), 0);
      setMetrics({
        grossRevenue: gross,
        netRevenue: net || gross * 0.85,
        totalSalesCount: sls.length,
        productsCount: prods.length,
        coursesCount: crss.length,
      });
    } catch (err) {
      console.error('Failed to load creator data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCreatorData();
  }, [currentUser]);

  // Handle tier activation / upgrade for demo & creator users
  const handleActivateCreatorTier = async () => {
    setIsActivatingTier(true);
    try {
      const res = await fetch('/api/creator/activate-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        paymentService.grantEntitlement('creator_tier');
        await loadCreatorData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsActivatingTier(false);
    }
  };

  // Toggle product status (PUBLISHED <-> ARCHIVED)
  const handleToggleProductStatus = async (prod: any) => {
    const nextStatus = prod.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED';
    try {
      const res = await fetch(`/api/creator/products/${prod.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        loadCreatorData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle course status
  const handleToggleCourseStatus = async (course: any) => {
    const nextStatus = course.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED';
    try {
      const res = await fetch(`/api/creator/courses/${course.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        loadCreatorData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Creator Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/creator/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          displayName: profileDisplayName.trim(),
          bio: profileBio.trim(),
          specialty: profileSpecialty.trim(),
          socialLinks: {
            github: profileGithub.trim(),
            youtube: profileYoutube.trim(),
            website: profileWebsite.trim(),
          },
        }),
      });
      if (res.ok) {
        setProfileSavedSuccess(true);
        setTimeout(() => setProfileSavedSuccess(false), 3000);
        loadCreatorData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const isCreatorPlanActive =
    Boolean(currentUser) && paymentService.hasCreatorPlan();

  if (!currentUser || !isCreatorPlanActive) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6 md:p-12 select-none text-slate-800 dark:text-slate-100 flex items-center justify-center transition-colors">
        <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {language === 'vi' ? 'Dành riêng cho Gói Nhà sáng tạo (Creator Pro)' : 'Creator Pro Plan Required'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {language === 'vi'
                ? 'Mục Không gian Nhà sáng tạo chỉ hiển thị và cho phép truy cập khi bạn đã đăng ký gói Nhà sáng tạo (Creator Pro).'
                : 'The Creator Studio is exclusively available to members subscribed to the Creator Pro plan.'}
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            {currentUser ? (
              <button
                onClick={() => onNavigate?.('membership')}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 text-xs font-bold transition shadow-md flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{language === 'vi' ? 'Nâng cấp gói Nhà sáng tạo ngay' : 'Upgrade to Creator Pro'}</span>
              </button>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white dark:text-slate-950 text-xs font-bold transition shadow-md"
              >
                {language === 'vi' ? 'Đăng nhập tài khoản' : 'Sign In'}
              </button>
            )}
            <button
              onClick={() => onNavigate?.('marketplace')}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
            >
              {language === 'vi' ? 'Về Cửa hàng linh kiện' : 'Back to Marketplace'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-transparent p-4 sm:p-6 md:p-8 select-none text-slate-900 dark:text-slate-100 transition-colors">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        {/* Top Header Banner */}
        <div className="rounded-3xl bg-gradient-to-r from-cyan-900 via-slate-900 to-teal-950 p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-cyan-500/20">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                <span>{language === 'vi' ? 'Không gian Nhà sáng tạo (Creator Studio)' : 'Creator Studio'}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {profile?.displayName || currentProfile?.fullName || 'Nhà Sáng Tạo CircuitCraft'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                {language === 'vi'
                  ? 'Quản lý dự án mạch 3D, tạo khóa học, theo dõi đơn hàng và doanh thu minh bạch với tỷ lệ chia sẻ 85% cho Creator.'
                  : 'Manage 3D circuit products, author courses, track VietQR sales and revenue with an 85% Creator payout.'}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setIsPublishModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition"
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'vi' ? 'Đăng bán Mạch điện' : 'Publish Circuit'}</span>
              </button>

              <button
                onClick={() => setIsCreateCourseModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition"
              >
                <GraduationCap className="w-4 h-4" />
                <span>{language === 'vi' ? 'Tạo Khóa học mới' : 'New Course'}</span>
              </button>
            </div>
          </div>

          {/* Sub-strip status */}
          <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <ShieldCheck className="w-4 h-4" />
                <span>{language === 'vi' ? 'Quyền Creator: Đang kích hoạt' : 'Creator Tier Active'}</span>
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-cyan-300">
                {language === 'vi' ? 'Tỷ lệ chia sẻ doanh thu: 85% Creator / 15% Nền tảng' : '85% Creator / 15% Platform'}
              </span>
            </div>

            {!isCreatorPlanActive && (
              <button
                onClick={handleActivateCreatorTier}
                disabled={isActivatingTier}
                className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] transition"
              >
                {isActivatingTier ? 'Đang kích hoạt...' : 'Kích hoạt Gói Creator Miễn phí'}
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
          {[
            { id: 'overview' as const, label: language === 'vi' ? 'Tổng quan' : 'Overview', icon: TrendingUp },
            { id: 'products' as const, label: language === 'vi' ? `Mạch đã đăng (${products.length})` : `Circuits (${products.length})`, icon: Box },
            { id: 'courses' as const, label: language === 'vi' ? `Khóa học (${courses.length})` : `Courses (${courses.length})`, icon: GraduationCap },
            { id: 'orders' as const, label: language === 'vi' ? `Đơn hàng (${sales.length})` : `Sales (${sales.length})`, icon: ShoppingBag },
            { id: 'analytics' as const, label: language === 'vi' ? 'Phân tích' : 'Analytics', icon: TrendingUp },
            { id: 'profile' as const, label: language === 'vi' ? 'Hồ sơ Creator' : 'Profile', icon: User },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                  isActive
                    ? 'bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800/80 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Metric KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {language === 'vi' ? 'Doanh thu Thực nhận (85%)' : 'Net Creator Earnings'}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {formatCurrency(metrics.netRevenue)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {language === 'vi' ? 'Tổng doanh số ghi nhận:' : 'Gross sales:'}{' '}
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    {formatCurrency(metrics.grossRevenue)}
                  </span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {language === 'vi' ? 'Tổng lượt mua thành công' : 'Total Orders Sold'}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                  {metrics.totalSalesCount}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {language === 'vi' ? 'Được xác thực qua cổng VietQR' : 'Verified via VietQR gateway'}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {language === 'vi' ? 'Mạch điện thương mại' : 'Published Circuits'}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <Box className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                  {products.length}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {products.filter((p) => p.status === 'PUBLISHED').length} {language === 'vi' ? 'đang mở bán' : 'live'}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {language === 'vi' ? 'Khóa học & Phòng Lab 3D' : 'Courses & 3D Labs'}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                  {courses.length}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {courses.reduce((acc, c) => acc + (c.studentCount || 0), 0)} {language === 'vi' ? 'học viên ghi danh' : 'students enrolled'}
                </div>
              </div>
            </div>

            {/* Recent Orders & Top Selling Circuits */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Orders Table */}
              <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    {language === 'vi' ? 'Giao dịch mua sản phẩm gần đây' : 'Recent Customer Purchases'}
                  </h3>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <span>{language === 'vi' ? 'Xem tất cả' : 'View all'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {sales.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    {language === 'vi' ? 'Chưa có đơn hàng nào. Hãy chia sẻ sản phẩm của bạn lên Marketplace!' : 'No sales yet. Publish more projects!'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-[11px]">
                          <th className="pb-2.5 font-bold">{language === 'vi' ? 'Mã đơn' : 'Order ID'}</th>
                          <th className="pb-2.5 font-bold">{language === 'vi' ? 'Sản phẩm' : 'Product'}</th>
                          <th className="pb-2.5 font-bold">{language === 'vi' ? 'Người mua' : 'Buyer'}</th>
                          <th className="pb-2.5 font-bold">{language === 'vi' ? 'Creator nhận' : 'Earnings'}</th>
                          <th className="pb-2.5 font-bold">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sales.slice(0, 5).map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-3 font-mono text-slate-500">{s.orderId}</td>
                            <td className="py-3 font-medium text-slate-900 dark:text-white truncate max-w-[180px]">
                              {s.productTitle}
                            </td>
                            <td className="py-3 text-slate-500">{s.buyerName || 'Học viên'}</td>
                            <td className="py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(s.creatorEarnings)}
                            </td>
                            <td className="py-3">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800/80">
                                {language === 'vi' ? 'Đã nhận tiền' : 'Completed'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Best Performers */}
              <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  {language === 'vi' ? 'Sản phẩm được yêu thích' : 'Top Performing Circuits'}
                </h3>
                <div className="space-y-3">
                  {products.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between"
                    >
                      <div className="truncate pr-2">
                        <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                          {p.title}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span>{p.salesCount || 0} {language === 'vi' ? 'lượt mua' : 'sales'}</span>
                          <span>•</span>
                          <span className="font-mono text-cyan-600 dark:text-cyan-400">
                            {formatCurrency(p.price)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedItemFor3DPreview({ id: p.id, title: p.title, price: p.price })}
                        className="p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 transition"
                        title={language === 'vi' ? 'Mở xem trước 3D' : '3D Preview'}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {products.length === 0 && (
                    <div className="p-4 text-center text-slate-400 text-xs">
                      {language === 'vi' ? 'Chưa có sản phẩm nào.' : 'No circuits published yet.'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PRODUCTS (CIRCUITS) */}
        {activeTab === 'products' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {language === 'vi' ? 'Mạch điện & Dự án cá nhân đăng bán' : 'Published 3D Circuit Projects'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'vi'
                    ? 'Mỗi sản phẩm lưu trữ snapshot bất biến (ProductVersion), không ảnh hưởng khi bạn tiếp tục sửa mạch cá nhân.'
                    : 'Each product has an immutable snapshot. Future changes to your private design do not overwrite customer copies.'}
                </p>
              </div>

              <button
                onClick={() => setIsPublishModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition"
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'vi' ? 'Đăng bán mạch mới' : 'Publish Circuit'}</span>
              </button>
            </div>

            {products.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <Box className="w-10 h-10 mx-auto text-slate-400" />
                <h4 className="font-bold text-slate-800 dark:text-slate-200">
                  {language === 'vi' ? 'Bạn chưa đăng bán mạch điện nào' : 'No circuits published yet'}
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {language === 'vi'
                    ? 'Hãy chọn một dự án mạch 3D từ bảng vẽ của bạn để đóng gói phiên bản v1.0.0 và đưa lên Marketplace ngay hôm nay.'
                    : 'Select a circuit from your workspace to package into version v1.0.0 and start selling.'}
                </p>
                <button
                  onClick={() => setIsPublishModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>{language === 'vi' ? 'Đăng bán ngay' : 'Publish Now'}</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {products.map((prod) => {
                  const isPublished = prod.status === 'PUBLISHED';
                  return (
                    <div
                      key={prod.id}
                      className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-hidden shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition"
                    >
                      <div className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              isPublished
                                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                            }`}
                          >
                            {isPublished
                              ? language === 'vi' ? 'Đang bán' : 'Published'
                              : language === 'vi' ? 'Tạm dừng bán' : 'Archived'}
                          </span>

                          <span className="text-[11px] font-mono font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/80 px-2 py-0.5 rounded">
                            v{prod.currentVersionNumber || '1.0.0'}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug line-clamp-1">
                            {prod.title}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                            {prod.tagline || prod.description}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                          <div>
                            <span>{language === 'vi' ? 'Lượt mua:' : 'Sales:'} </span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {prod.salesCount || 0}
                            </span>
                          </div>
                          <div>
                            <span>{language === 'vi' ? 'Doanh số:' : 'Gross:'} </span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency((prod.salesCount || 0) * prod.price)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card actions */}
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                        <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                          {prod.price === 0 ? (
                            <span className="text-emerald-500">{language === 'vi' ? 'Miễn phí' : 'Free'}</span>
                          ) : (
                            formatCurrency(prod.price)
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedItemFor3DPreview({ id: prod.id, title: prod.title, price: prod.price })}
                            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-cyan-600 transition"
                            title={language === 'vi' ? 'Xem trước 3D (Presentation Mode)' : '3D Turntable Preview'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setSelectedProductForVersions(prod)}
                            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-cyan-600 transition"
                            title={language === 'vi' ? 'Quản lý phiên bản bất biến (New Release)' : 'Version History'}
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleProductStatus(prod)}
                            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-amber-500 transition"
                            title={isPublished ? 'Ngừng bán' : 'Mở bán lại'}
                          >
                            {isPublished ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: COURSES */}
        {activeTab === 'courses' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {language === 'vi' ? 'Khóa học & Phòng Lab 3D của bạn' : 'Your Authored Courses & Labs'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'vi'
                    ? 'Tạo nội dung giáo dục kết hợp bài thực hành mô phỏng 3D tương tác.'
                    : 'Teach engineering with interactive 3D simulations.'}
                </p>
              </div>

              <button
                onClick={() => setIsCreateCourseModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition"
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'vi' ? 'Tạo Khóa học mới' : 'New Course'}</span>
              </button>
            </div>

            {courses.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <GraduationCap className="w-10 h-10 mx-auto text-slate-400" />
                <h4 className="font-bold text-slate-800 dark:text-slate-200">
                  {language === 'vi' ? 'Bạn chưa tạo khóa học nào' : 'No courses created yet'}
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {language === 'vi'
                    ? 'Đóng gói kiến thức chuyên môn và tạo các bài lab thực hành để giúp học viên phát triển kỹ năng.'
                    : 'Package your knowledge with hands-on 3D labs.'}
                </p>
                <button
                  onClick={() => setIsCreateCourseModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>{language === 'vi' ? 'Tạo khóa học ngay' : 'Create Course'}</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {courses.map((c) => {
                  const isPublished = c.status === 'PUBLISHED';
                  return (
                    <div
                      key={c.id}
                      className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-hidden shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition"
                    >
                      <div className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              isPublished
                                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                            }`}
                          >
                            {isPublished
                              ? language === 'vi' ? 'Đang mở lớp' : 'Live'
                              : language === 'vi' ? 'Tạm dừng' : 'Archived'}
                          </span>

                          <span className="text-[11px] font-medium text-slate-400">
                            {c.level || 'Cơ bản'}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug line-clamp-1">
                            {c.title}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                            {c.tagline || c.description}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                          <div>
                            <span>{language === 'vi' ? 'Học viên:' : 'Students:'} </span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {c.studentCount || 0}
                            </span>
                          </div>
                          <div>
                            <span>{language === 'vi' ? 'Bài học:' : 'Lessons:'} </span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {c.syllabus?.length || 0} bài
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                        <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                          {c.price === 0 ? (
                            <span className="text-emerald-500">{language === 'vi' ? 'Miễn phí' : 'Free'}</span>
                          ) : (
                            formatCurrency(c.price)
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedItemFor3DPreview({ id: c.id, title: c.title, price: c.price })}
                            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-cyan-600 transition"
                            title={language === 'vi' ? 'Xem trước 3D Cover' : '3D Cover Preview'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleCourseStatus(c)}
                            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-amber-500 transition"
                            title={isPublished ? 'Tạm dừng khóa học' : 'Mở lại khóa học'}
                          >
                            {isPublished ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ORDERS & SALES */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {language === 'vi' ? 'Lịch sử Giao dịch & Đơn hàng' : 'Order & Sales History'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'vi'
                    ? 'Danh sách các đơn mua mạch và khóa học đã thanh toán qua VietQR'
                    : 'List of all paid orders verified through the VietQR gateway'}
                </p>
              </div>
              <button
                onClick={loadCreatorData}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
                title="Làm mới"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {sales.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                {language === 'vi' ? 'Chưa ghi nhận đơn hàng nào.' : 'No orders recorded yet.'}
              </div>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-400 text-[11px] border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-4 font-bold">{language === 'vi' ? 'Mã đơn' : 'Order Code'}</th>
                        <th className="p-4 font-bold">{language === 'vi' ? 'Thời gian' : 'Date'}</th>
                        <th className="p-4 font-bold">{language === 'vi' ? 'Sản phẩm' : 'Product'}</th>
                        <th className="p-4 font-bold">{language === 'vi' ? 'Người mua' : 'Buyer'}</th>
                        <th className="p-4 font-bold">{language === 'vi' ? 'Tổng tiền' : 'Amount'}</th>
                        <th className="p-4 font-bold">{language === 'vi' ? 'Creator nhận (85%)' : 'Net Payout'}</th>
                        <th className="p-4 font-bold">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {sales.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-4 font-mono font-medium text-slate-600 dark:text-slate-300">
                            {s.orderId}
                          </td>
                          <td className="p-4 text-slate-500">
                            {new Date(s.createdAt).toLocaleString()}
                          </td>
                          <td className="p-4 font-bold text-slate-900 dark:text-white">
                            {s.productTitle}
                          </td>
                          <td className="p-4 text-slate-500">{s.buyerName || 'Khách hàng'}</td>
                          <td className="p-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                            {formatCurrency(s.amount)}
                          </td>
                          <td className="p-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(s.creatorEarnings)}
                          </td>
                          <td className="p-4">
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800/80">
                              {language === 'vi' ? 'Đã thanh toán' : 'Completed'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {language === 'vi' ? 'Báo cáo & Phân tích Doanh số' : 'Sales Analytics & Insights'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {language === 'vi' ? 'Tỷ lệ chia sẻ doanh thu' : 'Revenue Share'}
                </span>
                <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400">85% / 15%</div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {language === 'vi'
                    ? 'Bạn nhận 85% giá trị đơn hàng. 15% được dùng để duy trì hạ tầng server mô phỏng 3D và cổng thanh toán tự động.'
                    : 'Creator retains 85% of revenue. 15% covers 3D simulation infrastructure and payment gateway costs.'}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {language === 'vi' ? 'Tỷ lệ đơn hàng thành công' : 'VietQR Conversion Rate'}
                </span>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">100%</div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {language === 'vi'
                    ? 'Tất cả các giao dịch đều được đối soát và ghi nhận doanh thu tự động qua cổng VietQR.'
                    : 'Transactions are instantly reconciled and credited to your Creator wallet.'}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {language === 'vi' ? 'Đánh giá trung bình từ học viên' : 'Average Customer Rating'}
                </span>
                <div className="text-2xl font-black text-amber-500 flex items-center gap-1.5">
                  <Star className="w-6 h-6 fill-current" />
                  <span>5.0 / 5.0</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {language === 'vi'
                    ? 'Dựa trên phản hồi từ người mua mạch và học viên tham gia phòng thực hành 3D.'
                    : 'Calculated from engineering reviews and 3D lab completions.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: CREATOR PROFILE */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl mx-auto rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              {language === 'vi' ? 'Thông tin Hồ sơ Nhà sáng tạo' : 'Creator Profile & Branding'}
            </h2>

            {profileSavedSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{language === 'vi' ? 'Đã lưu thông tin hồ sơ thành công!' : 'Profile saved successfully!'}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'vi' ? 'Tên hiển thị thương hiệu Creator *' : 'Creator Brand Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={profileDisplayName}
                  onChange={(e) => setProfileDisplayName(e.target.value)}
                  placeholder="VD: Huỳnh Phong - IoT Lab"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'vi' ? 'Chuyên ngành / Lĩnh vực trọng tâm' : 'Specialty / Field'}
                </label>
                <input
                  type="text"
                  value={profileSpecialty}
                  onChange={(e) => setProfileSpecialty(e.target.value)}
                  placeholder="VD: Vi điều khiển nhúng, Hệ thống IoT thông minh, Robot tự hành"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'vi' ? 'Tiểu sử chuyên môn (Bio)' : 'Bio'}
                </label>
                <textarea
                  rows={3}
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  placeholder="Giới thiệu kinh nghiệm thiết kế phần cứng, các dự án tiêu biểu..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <Github className="w-3.5 h-3.5" />
                    <span>GitHub</span>
                  </label>
                  <input
                    type="text"
                    value={profileGithub}
                    onChange={(e) => setProfileGithub(e.target.value)}
                    placeholder="https://github.com/username"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <Youtube className="w-3.5 h-3.5" />
                    <span>YouTube</span>
                  </label>
                  <input
                    type="text"
                    value={profileYoutube}
                    onChange={(e) => setProfileYoutube(e.target.value)}
                    placeholder="https://youtube.com/@channel"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition"
                >
                  {language === 'vi' ? 'Lưu thay đổi hồ sơ' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* MODAL 1: Publish Product Modal */}
      <PublishProductModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        currentUser={currentUser}
        currentProject={currentProject}
        onProductPublished={() => {
          loadCreatorData();
          setActiveTab('products');
        }}
      />

      {/* MODAL 2: Create Course Modal */}
      <CreateCourseModal
        isOpen={isCreateCourseModalOpen}
        onClose={() => setIsCreateCourseModalOpen(false)}
        currentUser={currentUser}
        onCourseCreated={() => {
          loadCreatorData();
          setActiveTab('courses');
        }}
      />

      {/* MODAL 3: Version History Modal */}
      {selectedProductForVersions && (
        <VersionHistoryModal
          isOpen={Boolean(selectedProductForVersions)}
          onClose={() => setSelectedProductForVersions(null)}
          product={selectedProductForVersions}
          currentProject={currentProject}
          onVersionCreated={() => loadCreatorData()}
        />
      )}

      {/* MODAL 4: 3D Product & Course Viewer */}
      {selectedItemFor3DPreview && (
        <Product3DViewerModal
          productId={selectedItemFor3DPreview.id}
          productTitle={selectedItemFor3DPreview.title}
          authorName={profile?.displayName || currentProfile?.fullName || 'Creator'}
          price={selectedItemFor3DPreview.price}
          isOpen={Boolean(selectedItemFor3DPreview)}
          onClose={() => setSelectedItemFor3DPreview(null)}
          onOpenInEditor={(doc) => {
            if (onOpenProject) onOpenProject(doc);
            setSelectedItemFor3DPreview(null);
          }}
        />
      )}
    </div>
  );
};
