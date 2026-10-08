import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Users,
  Receipt,
  Crown,
  GraduationCap,
  Cpu,
  ShoppingBag,
  BarChart3,
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Archive,
  Clock,
  ArrowUpRight,
  Lock,
  UserCheck,
  UserX,
  Box,
  Layers,
  Activity,
  FileText,
  Save,
  X,
} from 'lucide-react';
import { authService } from '../persistence/authService';
import { useI18n } from '../i18n/context';
import { Product3DViewerModal } from '../components/Product3DViewerModal';
import { ProjectDocument } from '../domain/project/types';

type AdminTabId =
  | 'overview'
  | 'users'
  | 'transactions'
  | 'memberships'
  | 'courses'
  | 'projects'
  | 'marketplace'
  | 'reports'
  | 'logs'
  | 'settings';

export interface AdminDashboardPageProps {
  currentUser: any;
  onNavigate: (route: any) => void;
  onOpenProject?: (doc: ProjectDocument) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  currentUser,
  onNavigate,
  onOpenProject,
}) => {
  const { language, formatCurrency } = useI18n();
  const [activeTab, setActiveTab] = useState<AdminTabId>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Server verification state
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Data states per section
  const [loading, setLoading] = useState(false);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [usersData, setUsersData] = useState<{ users: any[]; total: number; page: number; totalPages: number }>({
    users: [],
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [selectedUserDetail, setSelectedUserDetail] = useState<any | null>(null);
  const [transactionsData, setTransactionsData] = useState<any[]>([]);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any | null>(null);
  const [membershipsData, setMembershipsData] = useState<any[]>([]);
  const [coursesData, setCoursesData] = useState<any[]>([]);
  const [projectsData, setProjectsData] = useState<{
    personalProjects: any[];
    marketplaceProducts: any[];
    projectVersions: any[];
  }>({
    personalProjects: [],
    marketplaceProducts: [],
    projectVersions: [],
  });
  const [marketplaceData, setMarketplaceData] = useState<{ products: any[]; summary: any }>({
    products: [],
    summary: null,
  });
  const [reportsData, setReportsData] = useState<any>(null);
  const [logsData, setLogsData] = useState<any[]>([]);
  const [settingsData, setSettingsData] = useState<any>(null);

  // Filters & UI states
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userTierFilter, setUserTierFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [userPage, setUserPage] = useState(1);

  const [txStatusFilter, setTxStatusFilter] = useState('ALL');
  const [txSearch, setTxSearch] = useState('');

  const [projectSubTab, setProjectSubTab] = useState<'personal' | 'marketplace' | 'versions'>('personal');
  const [previewCircuit, setPreviewCircuit] = useState<{
    id: string;
    title: string;
    author: string;
    snapshot?: ProjectDocument;
  } | null>(null);

  const [mktFilter, setMktFilter] = useState<'all' | 'free' | 'paid' | 'pending' | 'published' | 'rejected' | 'archived'>('all');
  const [reportRange, setReportRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [logCategory, setLogCategory] = useState('all');
  const [logSeverity, setLogSeverity] = useState('all');
  const [savingSettings, setSavingSettings] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 3500);
  };

  const getHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      ...authService.getAuthHeaders(),
    };
  }, []);

  // Verify admin access with backend server
  useEffect(() => {
    let mounted = true;
    setIsVerifying(true);
    fetch('/api/admin/verify', { headers: getHeaders() })
      .then(async (res) => {
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          if (data.isAdmin) {
            setIsAuthorized(true);
            setAuthError(null);
          } else {
            setIsAuthorized(false);
            setAuthError(language === 'vi' ? 'Tài khoản không có quyền Quản trị viên.' : 'Account does not have Administrator privileges.');
          }
        } else {
          const err = await res.json().catch(() => ({}));
          setIsAuthorized(false);
          setAuthError(err.error || (language === 'vi' ? 'Truy cập bị từ chối (403 Forbidden).' : 'Access denied (403 Forbidden).'));
        }
      })
      .catch(() => {
        if (mounted) {
          setIsAuthorized(false);
          setAuthError(language === 'vi' ? 'Không thể xác thực quyền Quản trị từ máy chủ.' : 'Failed to verify Admin authorization with server.');
        }
      })
      .finally(() => {
        if (mounted) setIsVerifying(false);
      });

    return () => {
      mounted = false;
    };
  }, [currentUser, getHeaders, language]);

  // Fetch active tab data from real backend endpoints
  const loadTabData = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        const res = await fetch('/api/admin/overview', { headers: getHeaders() });
        if (res.ok) setOverviewData(await res.json());
      } else if (activeTab === 'users') {
        const params = new URLSearchParams({
          search: userSearch,
          role: userRoleFilter,
          tier: userTierFilter,
          status: userStatusFilter,
          page: String(userPage),
          limit: '15',
        });
        const res = await fetch(`/api/admin/users?${params.toString()}`, { headers: getHeaders() });
        if (res.ok) setUsersData(await res.json());
      } else if (activeTab === 'transactions') {
        const params = new URLSearchParams({
          status: txStatusFilter,
          search: txSearch,
        });
        const res = await fetch(`/api/admin/transactions?${params.toString()}`, { headers: getHeaders() });
        if (res.ok) {
          const d = await res.json();
          setTransactionsData(d.transactions || []);
        }
      } else if (activeTab === 'memberships') {
        const res = await fetch('/api/admin/memberships', { headers: getHeaders() });
        if (res.ok) {
          const d = await res.json();
          setMembershipsData(d.plans || []);
        }
      } else if (activeTab === 'courses') {
        const res = await fetch('/api/admin/courses', { headers: getHeaders() });
        if (res.ok) {
          const d = await res.json();
          setCoursesData(d.courses || []);
        }
      } else if (activeTab === 'projects') {
        const res = await fetch('/api/admin/projects', { headers: getHeaders() });
        if (res.ok) {
          const d = await res.json();
          setProjectsData({
            personalProjects: d.personalProjects || [],
            marketplaceProducts: d.marketplaceProducts || [],
            projectVersions: d.projectVersions || [],
          });
        }
      } else if (activeTab === 'marketplace') {
        const res = await fetch('/api/admin/marketplace', { headers: getHeaders() });
        if (res.ok) {
          const d = await res.json();
          setMarketplaceData({
            products: d.products || [],
            summary: d.summary || null,
          });
        }
      } else if (activeTab === 'reports') {
        const res = await fetch(`/api/admin/reports?range=${reportRange}`, { headers: getHeaders() });
        if (res.ok) setReportsData(await res.json());
      } else if (activeTab === 'logs') {
        const params = new URLSearchParams({
          category: logCategory,
          severity: logSeverity,
        });
        const res = await fetch(`/api/admin/logs?${params.toString()}`, { headers: getHeaders() });
        if (res.ok) {
          const d = await res.json();
          setLogsData(d.logs || []);
        }
      } else if (activeTab === 'settings') {
        const res = await fetch('/api/admin/settings', { headers: getHeaders() });
        if (res.ok) {
          const d = await res.json();
          setSettingsData(d.settings || null);
        }
      }
    } catch (err) {
      console.error('Admin data load error:', err);
    } finally {
      setLoading(false);
    }
  }, [
    isAuthorized,
    activeTab,
    getHeaders,
    userSearch,
    userRoleFilter,
    userTierFilter,
    userStatusFilter,
    userPage,
    txStatusFilter,
    txSearch,
    reportRange,
    logCategory,
    logSeverity,
  ]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  // View User Detail
  const handleInspectUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { headers: getHeaders() });
      if (res.ok) {
        setSelectedUserDetail(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Update User Tier / Status / Role via Server
  const handleUpdateUser = async (userId: string, patch: { role?: string; tier?: string; status?: string }) => {
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(language === 'vi' ? 'Đã cập nhật thông tin người dùng' : 'User updated successfully');
        loadTabData();
        if (selectedUserDetail?.user?.id === userId) {
          handleInspectUser(userId);
        }
      } else {
        showToast(data.error || 'Error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error');
    }
  };

  // Course Moderation Action
  const handleCourseAction = async (courseId: string, action: 'approve' | 'reject' | 'unpublish' | 'archive') => {
    try {
      const res = await fetch(`/api/admin/courses/${encodeURIComponent(courseId)}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(language === 'vi' ? `Đã thực hiện: ${action.toUpperCase()}` : `Course action: ${action.toUpperCase()}`);
        loadTabData();
      } else {
        showToast(data.error || 'Action failed');
      }
    } catch (err: any) {
      showToast(err?.message || 'Action failed');
    }
  };

  // Marketplace Product Moderation Action
  const handleMarketplaceAction = async (productId: string, action: 'approve' | 'reject' | 'unpublish' | 'archive') => {
    try {
      const res = await fetch(`/api/admin/marketplace/${encodeURIComponent(productId)}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(language === 'vi' ? `Đã cập nhật trạng thái sản phẩm: ${action.toUpperCase()}` : `Updated product status: ${action.toUpperCase()}`);
        loadTabData();
      } else {
        showToast(data.error || 'Action failed');
      }
    } catch (err: any) {
      showToast(err?.message || 'Action failed');
    }
  };

  // Save Platform Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsData) return;
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(settingsData),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSettingsData(data.settings);
        showToast(language === 'vi' ? 'Đã lưu cài đặt hệ thống' : 'System settings saved');
      }
    } catch (err: any) {
      showToast(err?.message || 'Save failed');
    } finally {
      setSavingSettings(false);
    }
  };

  // Sidebar items (Strictly matching the 10 items in VI & EN)
  const sidebarItems: Array<{ id: AdminTabId; labelVi: string; labelEn: string; icon: any }> = [
    { id: 'overview', labelVi: 'Tổng quan', labelEn: 'Overview', icon: LayoutDashboard },
    { id: 'users', labelVi: 'Người dùng', labelEn: 'Users', icon: Users },
    { id: 'transactions', labelVi: 'Giao dịch', labelEn: 'Transactions', icon: Receipt },
    { id: 'memberships', labelVi: 'Gói thành viên', labelEn: 'Membership Plans', icon: Crown },
    { id: 'courses', labelVi: 'Khóa học', labelEn: 'Courses', icon: GraduationCap },
    { id: 'projects', labelVi: 'Dự án & Mạch', labelEn: 'Projects & Circuits', icon: Cpu },
    { id: 'marketplace', labelVi: 'Cửa hàng', labelEn: 'Marketplace', icon: ShoppingBag },
    { id: 'reports', labelVi: 'Báo cáo', labelEn: 'Reports', icon: BarChart3 },
    { id: 'logs', labelVi: 'Nhật ký hệ thống', labelEn: 'System Logs', icon: ScrollText },
    { id: 'settings', labelVi: 'Cài đặt', labelEn: 'Settings', icon: Settings },
  ];

  // Loading / Verifying screen
  if (isVerifying) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 p-8">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-500 mb-3" />
        <p className="text-sm font-semibold">
          {language === 'vi' ? 'Đang xác thực quyền Quản trị viên với máy chủ...' : 'Verifying Administrator credentials with server...'}
        </p>
      </div>
    );
  }

  // Unauthorized / Forbidden Guard Screen
  if (!isAuthorized) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 select-none">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-8 text-center shadow-xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 flex items-center justify-center mx-auto text-rose-500">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            403 — {language === 'vi' ? 'Không có quyền truy cập' : 'Unauthorized / Forbidden'}
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {authError ||
              (language === 'vi'
                ? 'Khu vực Quản trị Hệ thống chỉ dành riêng cho tài khoản Admin duy nhất đã được xác thực phía máy chủ.'
                : 'The System Administration area is strictly restricted to the server-verified system Administrator account.')}
          </p>
          <div className="pt-2">
            <button
              onClick={() => onNavigate(currentUser ? 'projects' : 'landing')}
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition shadow-sm"
            >
              {language === 'vi' ? 'Quay về Trang chủ' : 'Return to Home'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderEmptyState = (titleVi: string, titleEn: string, descVi: string, descEn: string) => (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30">
      <Box className="w-8 h-8 text-slate-400 dark:text-slate-600 mb-2.5" />
      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
        {language === 'vi' ? titleVi : titleEn}
      </h4>
      <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-1 max-w-md">
        {language === 'vi' ? descVi : descEn}
      </p>
    </div>
  );

  return (
    <div className="flex-1 flex overflow-hidden bg-transparent text-slate-900 dark:text-slate-100 select-none transition-colors">
      {/* Toast Notification */}
      {actionToast && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-cyan-950 border border-cyan-500/40 text-white text-xs font-semibold shadow-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionToast}</span>
        </div>
      )}

      {/* Left Collapsible Admin Sidebar */}
      <aside
        className={`${
          sidebarCollapsed ? 'w-16' : 'w-64'
        } bg-white/95 dark:bg-[#0c1424]/95 backdrop-blur-md border-r border-[#d7e7f0] dark:border-cyan-950/50 flex flex-col justify-between shrink-0 transition-all duration-200 z-20 shadow-sm`}
      >
        <div className="p-3.5 space-y-4 overflow-y-auto">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#d7e7f0] dark:border-cyan-950/50">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2.5 truncate">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-teal-500 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs shadow-cyan-500/20">
                  CC
                </div>
                <div className="truncate">
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white tracking-tight">
                    ADMIN CONSOLE
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono truncate">
                    {currentUser?.email}
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="tech-btn-control p-1.5 mx-auto"
              title={sidebarCollapsed ? 'Expand' : 'Collapse'}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" /> : <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />}
            </button>
          </div>

          {/* 10 Navigation Items */}
          <nav className="space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const label = language === 'vi' ? item.labelVi : item.labelEn;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={sidebarCollapsed ? label : undefined}
                  className={`w-full flex items-center ${
                    sidebarCollapsed ? 'justify-center px-2' : 'justify-start px-3'
                  } py-2.5 rounded-xl text-xs font-semibold transition-all gap-3 ${
                    isActive
                      ? 'tech-btn-primary'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 drop-shadow-xs" />
                  {!sidebarCollapsed && <span className="truncate">{label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Security Badge */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          {!sidebarCollapsed ? (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <div className="truncate">
                <div className="text-[10px] font-bold text-slate-800 dark:text-slate-200">
                  {language === 'vi' ? 'Bảo mật Server-Side' : 'Server-Side Verified'}
                </div>
                <div className="text-[9px] text-slate-500 truncate">RBAC • Real Database Sync</div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center" title="Server-Side Verified">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
          )}
        </div>
      </aside>

      {/* Main Dashboard Content Area */}
      <main className="flex-1 overflow-y-auto p-5 md:p-7 space-y-6">
        {/* Top Bar with Active Section Title & Refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
              <span>CircuitCraft 3D Administration</span>
              <span>•</span>
              <span>{language === 'vi' ? 'Dữ liệu thời gian thực' : 'Real-Time System Data'}</span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              {language === 'vi'
                ? sidebarItems.find((i) => i.id === activeTab)?.labelVi
                : sidebarItems.find((i) => i.id === activeTab)?.labelEn}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadTabData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500 text-xs font-semibold text-slate-700 dark:text-slate-200 transition shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-500 ${loading ? 'animate-spin' : ''}`} />
              <span>{language === 'vi' ? 'Làm mới dữ liệu' : 'Refresh Data'}</span>
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 1. OVERVIEW TAB                                              */}
        {/* ============================================================ */}
        {activeTab === 'overview' && overviewData && (
          <div className="space-y-6">
            {/* KPI Grid — 100% Real System Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                {
                  labelVi: 'Tổng người dùng',
                  labelEn: 'Total Users',
                  value: overviewData.kpis.totalUsers,
                  subVi: `${overviewData.kpis.newUsersLast7d} mới (7 ngày)`,
                  subEn: `${overviewData.kpis.newUsersLast7d} new (7d)`,
                  icon: Users,
                  color: 'text-cyan-500',
                },
                {
                  labelVi: 'Tổng doanh thu xác nhận',
                  labelEn: 'Confirmed Revenue',
                  value: formatCurrency(overviewData.kpis.confirmedRevenue),
                  subVi: `${overviewData.kpis.paidOrdersCount} đơn thành công`,
                  subEn: `${overviewData.kpis.paidOrdersCount} paid orders`,
                  icon: Receipt,
                  color: 'text-emerald-500',
                },
                {
                  labelVi: 'Tổng giao dịch',
                  labelEn: 'Total Transactions',
                  value: overviewData.kpis.totalTransactions,
                  subVi: `${overviewData.kpis.pendingOrders} đang chờ thanh toán`,
                  subEn: `${overviewData.kpis.pendingOrders} pending orders`,
                  icon: Activity,
                  color: 'text-amber-500',
                },
                {
                  labelVi: 'Dự án & Mạch đang bán',
                  labelEn: 'Projects & Listings',
                  value: `${overviewData.kpis.totalProjects} / ${overviewData.kpis.totalMarketplaceProducts}`,
                  subVi: 'Dự án cá nhân / Mạch bán',
                  subEn: 'Personal / Marketplace',
                  icon: Cpu,
                  color: 'text-indigo-500',
                },
                {
                  labelVi: 'Khóa học & Creator',
                  labelEn: 'Courses & Creators',
                  value: `${overviewData.kpis.totalCourses} / ${overviewData.kpis.totalCreators}`,
                  subVi: `${overviewData.kpis.activeSubscriptions} gói trả phí đang bật`,
                  subEn: `${overviewData.kpis.activeSubscriptions} active subscriptions`,
                  icon: GraduationCap,
                  color: 'text-purple-500',
                },
              ].map((kpi, idx) => {
                const Icon = kpi.icon;
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {language === 'vi' ? kpi.labelVi : kpi.labelEn}
                      </span>
                      <Icon className={`w-4 h-4 ${kpi.color}`} />
                    </div>
                    <div className="text-xl font-black text-slate-900 dark:text-white my-2 truncate">
                      {kpi.value}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      {language === 'vi' ? kpi.subVi : kpi.subEn}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Plan Distribution & Recent Transactions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Plan Distribution Bar Visualization */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {language === 'vi' ? 'Phân bổ Gói thành viên' : 'Membership Distribution'}
                  </h3>
                  <Crown className="w-4 h-4 text-amber-500" />
                </div>

                {overviewData.kpis?.totalUsers === 0 ? (
                  renderEmptyState(
                    'Chưa có người dùng',
                    'No users yet',
                    'Phân bổ gói thành viên sẽ hiển thị khi có tài khoản đăng ký.',
                    'Membership distribution will appear once users register.'
                  )
                ) : (
                  <div className="space-y-3 pt-1">
                    {(Array.isArray(overviewData.planDistribution)
                      ? overviewData.planDistribution
                      : [
                          { tier: 'free', plan: 'Starter (Free)', count: overviewData.planDistribution?.free || 0 },
                          { tier: 'student', plan: 'Student Pro', count: overviewData.planDistribution?.student || 0 },
                          { tier: 'creator', plan: 'Creator Pro', count: overviewData.planDistribution?.creator || 0 },
                        ]
                    ).map((p: any) => {
                      const pct =
                        overviewData.kpis?.totalUsers > 0
                          ? Math.round((p.count / overviewData.kpis.totalUsers) * 100)
                          : 0;
                      return (
                        <div key={p.tier} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{p.plan}</span>
                            <span className="font-mono text-slate-500">
                              {p.count} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                p.tier === 'creator'
                                  ? 'bg-purple-500'
                                  : p.tier === 'student'
                                  ? 'bg-cyan-500'
                                  : 'bg-slate-400'
                              }`}
                              style={{ width: `${Math.max(pct, p.count > 0 ? 6 : 0)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Real Transactions Table */}
              <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {language === 'vi' ? 'Giao dịch gần đây' : 'Recent Transactions'}
                  </h3>
                  <button
                    onClick={() => setActiveTab('transactions')}
                    className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <span>{language === 'vi' ? 'Xem tất cả' : 'View all'}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {!overviewData.recentTransactions || overviewData.recentTransactions.length === 0 ? (
                  renderEmptyState(
                    '0 giao dịch',
                    '0 transactions',
                    'Hệ thống hiện chưa ghi nhận giao dịch thanh toán nào.',
                    'No payment transactions have been recorded in the system yet.'
                  )
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                          <th className="py-2 pr-3">{language === 'vi' ? 'Mã đơn' : 'Order Code'}</th>
                          <th className="py-2 px-3">{language === 'vi' ? 'Người dùng' : 'User'}</th>
                          <th className="py-2 px-3">{language === 'vi' ? 'Sản phẩm' : 'Product'}</th>
                          <th className="py-2 px-3">{language === 'vi' ? 'Số tiền' : 'Amount'}</th>
                          <th className="py-2 pl-3">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {overviewData.recentTransactions.map((tx: any) => (
                          <tr key={tx.orderId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 pr-3 font-mono font-bold text-cyan-600 dark:text-cyan-400">
                              {tx.orderCode || tx.orderId}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">{tx.userId}</td>
                            <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                              {tx.productName}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold">{formatCurrency(tx.amount)}</td>
                            <td className="py-2.5 pl-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  tx.status === 'PAID'
                                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                                    : tx.status === 'PENDING'
                                    ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}
                              >
                                {tx.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 2. USERS MANAGEMENT TAB                                      */}
        {/* ============================================================ */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Search & Filter Bar */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setUserPage(1);
                  }}
                  placeholder={
                    language === 'vi' ? 'Tìm theo Email, Tên hiển thị, User ID...' : 'Search by Email, Name, User ID...'
                  }
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={userRoleFilter}
                  onChange={(e) => {
                    setUserRoleFilter(e.target.value);
                    setUserPage(1);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                >
                  <option value="all">{language === 'vi' ? 'Tất cả Role' : 'All Roles'}</option>
                  <option value="admin">Admin</option>
                  <option value="creator">Creator</option>
                  <option value="pro">Student / Pro</option>
                  <option value="user">User</option>
                </select>

                <select
                  value={userTierFilter}
                  onChange={(e) => {
                    setUserTierFilter(e.target.value);
                    setUserPage(1);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                >
                  <option value="all">{language === 'vi' ? 'Tất cả Gói' : 'All Plans'}</option>
                  <option value="free">Free</option>
                  <option value="student">Student</option>
                  <option value="creator">Creator</option>
                </select>

                <select
                  value={userStatusFilter}
                  onChange={(e) => {
                    setUserStatusFilter(e.target.value);
                    setUserPage(1);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                >
                  <option value="all">{language === 'vi' ? 'Tất cả Trạng thái' : 'All Status'}</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              {usersData.users.length === 0 ? (
                renderEmptyState(
                  'Không tìm thấy người dùng',
                  'No users found',
                  'Chưa có người dùng nào khớp với bộ lọc hiện tại.',
                  'No registered users match the current filter criteria.'
                )
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-3">Role</th>
                        <th className="py-3 px-3">{language === 'vi' ? 'Gói (Plan)' : 'Plan'}</th>
                        <th className="py-3 px-3">{language === 'vi' ? 'Dự án' : 'Projects'}</th>
                        <th className="py-3 px-3">{language === 'vi' ? 'Khóa học' : 'Courses'}</th>
                        <th className="py-3 px-3">{language === 'vi' ? 'Ngày tạo' : 'Created'}</th>
                        <th className="py-3 px-3">{language === 'vi' ? 'Hoạt động cuối' : 'Last Active'}</th>
                        <th className="py-3 px-3">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                        <th className="py-3 px-4 text-right">{language === 'vi' ? 'Chi tiết' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {usersData.users.map((u: any) => (
                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">{u.displayName}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                            <div className="text-[10px] text-slate-400 font-mono">ID: {u.id}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                u.role === 'admin'
                                  ? 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                  : u.role === 'creator'
                                  ? 'bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-3 uppercase font-mono font-bold text-cyan-600 dark:text-cyan-400">
                            {u.plan}
                          </td>
                          <td className="py-3 px-3 font-mono">{u.projectsCount}</td>
                          <td className="py-3 px-3 font-mono">{u.coursesCount}</td>
                          <td className="py-3 px-3 text-slate-500">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString() : '—'}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                u.status === 'suspended'
                                  ? 'bg-rose-50 dark:bg-rose-950 text-rose-600'
                                  : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {u.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleInspectUser(u.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/70 hover:bg-cyan-100 text-cyan-700 dark:text-cyan-300 font-semibold transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{language === 'vi' ? 'Xem' : 'Inspect'}</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {usersData.totalPages > 1 && (
                <div className="p-3 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    {language === 'vi'
                      ? `Trang ${usersData.page} / ${usersData.totalPages} (Tổng ${usersData.total})`
                      : `Page ${usersData.page} of ${usersData.totalPages} (${usersData.total} total)`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={userPage <= 1}
                      onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      disabled={userPage >= usersData.totalPages}
                      onClick={() => setUserPage((p) => p + 1)}
                      className="px-2.5 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 3. TRANSACTIONS MANAGEMENT TAB                               */}
        {/* ============================================================ */}
        {activeTab === 'transactions' && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {['ALL', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setTxStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      txStatusFilter === st
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder={language === 'vi' ? 'Tìm mã đơn, sản phẩm, user...' : 'Search order code, user...'}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Transactions Table */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              {transactionsData.length === 0 ? (
                renderEmptyState(
                  '0 giao dịch',
                  '0 transactions',
                  'Không có giao dịch nào khớp với trạng thái lọc hiện tại.',
                  'No transactions match the selected filter.'
                )
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                        <th className="py-3 px-4">Order Code</th>
                        <th className="py-3 px-3">User</th>
                        <th className="py-3 px-3">{language === 'vi' ? 'Sản phẩm' : 'Product'}</th>
                        <th className="py-3 px-3">{language === 'vi' ? 'Loại' : 'Type'}</th>
                        <th className="py-3 px-3">{language === 'vi' ? 'Số tiền' : 'Amount'}</th>
                        <th className="py-3 px-3">{language === 'vi' ? 'Phương thức' : 'Method'}</th>
                        <th className="py-3 px-3">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                        <th className="py-3 px-3">{language === 'vi' ? 'Tạo lúc / Thanh toán' : 'Created / Paid At'}</th>
                        <th className="py-3 px-4 text-right">{language === 'vi' ? 'Chi tiết' : 'Detail'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {transactionsData.map((tx: any) => (
                        <tr key={tx.orderId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-mono font-bold text-cyan-600 dark:text-cyan-400">
                            {tx.orderCode || tx.orderId}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">{tx.userId}</td>
                          <td className="py-3 px-3 font-medium text-slate-900 dark:text-white">{tx.productName}</td>
                          <td className="py-3 px-3 uppercase font-mono text-[10px] text-slate-500">{tx.type}</td>
                          <td className="py-3 px-3 font-mono font-bold">
                            {formatCurrency(tx.amount)} <span className="text-[10px] text-slate-400">{tx.currency}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-500">{tx.paymentMethod}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                tx.status === 'PAID'
                                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                                  : tx.status === 'PENDING'
                                  ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                                  : 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {tx.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-[11px] text-slate-500">
                            <div>{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : '—'}</div>
                            {tx.paidAt && (
                              <div className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">
                                ✓ {new Date(tx.paidAt).toLocaleString()}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => setSelectedOrderDetail(tx)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-cyan-600 hover:text-white text-xs font-semibold transition"
                            >
                              {language === 'vi' ? 'Chi tiết' : 'View'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 4. MEMBERSHIP PLANS MANAGEMENT TAB                           */}
        {/* ============================================================ */}
        {activeTab === 'memberships' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {membershipsData.map((plan: any) => (
              <div
                key={plan.id}
                className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-5 shadow-2xs"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800">
                      {plan.tier}
                    </span>
                    <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                      {plan.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{plan.name}</h3>
                    <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1">
                      {formatCurrency(plan.price)}
                      <span className="text-xs font-normal text-slate-500"> / {plan.billingCycle}</span>
                    </div>
                  </div>

                  {/* Active Users Count */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {language === 'vi' ? 'Số người dùng hiện tại:' : 'Active Users on Plan:'}
                    </span>
                    <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                      {plan.usersCount}
                    </span>
                  </div>

                  {/* Quotas */}
                  <div className="space-y-1.5 text-xs">
                    <div className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider">
                      {language === 'vi' ? 'Định mức & Quyền hạn (Quotas):' : 'Plan Quotas & Entitlements:'}
                    </div>
                    <div className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      • Max Projects: {plan.quotas?.maxProjects}
                    </div>
                    <div className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      • AI Queries/Day: {plan.quotas?.aiQueriesPerDay}
                    </div>
                    <div className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      • Cloud Sync: {plan.quotas?.cloudSync ? 'Enabled' : 'Local Only'}
                    </div>
                    <div className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      • Creator Studio: {plan.quotas?.creatorStudioAccess ? 'Enabled' : 'No'}
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                    {(plan.features || []).map((f: string, i: number) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ============================================================ */}
        {/* 5. COURSES MANAGEMENT TAB                                    */}
        {/* ============================================================ */}
        {activeTab === 'courses' && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            {coursesData.length === 0 ? (
              renderEmptyState(
                '0 khóa học',
                '0 courses',
                'Chưa có khóa học nào trong hệ thống.',
                'No courses registered in the system.'
              )
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-4">{language === 'vi' ? 'Tên khóa học' : 'Course Title'}</th>
                      <th className="py-3 px-3">{language === 'vi' ? 'Tác giả' : 'Author'}</th>
                      <th className="py-3 px-3">{language === 'vi' ? 'Giá' : 'Price'}</th>
                      <th className="py-3 px-3">{language === 'vi' ? 'Chương / Bài' : 'Chapters / Lessons'}</th>
                      <th className="py-3 px-3">{language === 'vi' ? 'Học viên' : 'Students'}</th>
                      <th className="py-3 px-3">{language === 'vi' ? 'Lượt mua / Doanh thu' : 'Sales / Revenue'}</th>
                      <th className="py-3 px-3">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                      <th className="py-3 px-4 text-right">{language === 'vi' ? 'Kiểm duyệt' : 'Moderation'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {coursesData.map((c: any) => (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{c.title}</div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {c.source === 'system' ? 'System Curriculum' : 'Creator Course'} • ID: {c.id}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{c.author}</td>
                        <td className="py-3 px-3 font-mono font-bold">
                          {c.price === 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">Free</span>
                          ) : (
                            formatCurrency(c.price)
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono">
                          {c.chaptersCount} ch / {c.lessonsCount} bài
                        </td>
                        <td className="py-3 px-3 font-mono font-bold">{c.studentsCount}</td>
                        <td className="py-3 px-3 font-mono">
                          <div>{c.salesCount} sales</div>
                          <div className="text-emerald-600 dark:text-emerald-400 font-bold">
                            {formatCurrency(c.revenue || 0)}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              c.status === 'published'
                                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                                : c.status === 'pending'
                                ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                                : 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {c.source === 'creator' ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => handleCourseAction(c.id, 'approve')}
                                className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold"
                                title="Approve & Publish"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleCourseAction(c.id, 'reject')}
                                className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold"
                                title="Reject"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleCourseAction(c.id, 'unpublish')}
                                className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold"
                                title="Unpublish to Draft"
                              >
                                Unpublish
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-400">Official Built-in</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* 6. PROJECTS & CIRCUITS MANAGEMENT TAB                        */}
        {/* ============================================================ */}
        {activeTab === 'projects' && (
          <div className="space-y-4">
            {/* Sub-navigation distinguishing Personal Projects, Marketplace Products, and Project Versions */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                {
                  id: 'personal' as const,
                  labelVi: `Dự án cá nhân (${projectsData.personalProjects.length})`,
                  labelEn: `Personal Projects (${projectsData.personalProjects.length})`,
                },
                {
                  id: 'marketplace' as const,
                  labelVi: `Mạch thương mại (${projectsData.marketplaceProducts.length})`,
                  labelEn: `Marketplace Circuits (${projectsData.marketplaceProducts.length})`,
                },
                {
                  id: 'versions' as const,
                  labelVi: `Phiên bản lưu trữ (${projectsData.projectVersions.length})`,
                  labelEn: `Project Versions (${projectsData.projectVersions.length})`,
                },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setProjectSubTab(t.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    projectSubTab === t.id
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {language === 'vi' ? t.labelVi : t.labelEn}
                </button>
              ))}
            </div>

            {projectSubTab === 'personal' && (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                {projectsData.personalProjects.length === 0 ? (
                  renderEmptyState(
                    'Chưa có dự án cá nhân nào được đồng bộ',
                    'No personal projects synced yet',
                    'Khi người dùng tạo hoặc lưu mạch trong 3D Editor, metadata của dự án sẽ hiển thị tại đây.',
                    'When users create or save circuits in the 3D Editor, project metadata will appear here.'
                  )
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                          <th className="py-3 px-4">{language === 'vi' ? 'Tên dự án' : 'Project Title'}</th>
                          <th className="py-3 px-3">{language === 'vi' ? 'Chủ sở hữu' : 'Owner'}</th>
                          <th className="py-3 px-3">Revision</th>
                          <th className="py-3 px-3">{language === 'vi' ? 'Số linh kiện' : 'Components'}</th>
                          <th className="py-3 px-3">{language === 'vi' ? 'Loại bo mạch' : 'Board Type'}</th>
                          <th className="py-3 px-3">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                          <th className="py-3 px-4">{language === 'vi' ? 'Cập nhật lúc' : 'Updated At'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {projectsData.personalProjects.map((p: any) => (
                          <tr key={p.projectId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                              <div>{p.title}</div>
                              <div className="text-[10px] font-mono text-slate-400">ID: {p.projectId}</div>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                              {p.ownerEmail || p.ownerId}
                            </td>
                            <td className="py-3 px-3 font-mono">v{p.revision}</td>
                            <td className="py-3 px-3 font-mono">{p.componentCount}</td>
                            <td className="py-3 px-3 font-mono">{p.boardType}</td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {p.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500">
                              {p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {projectSubTab === 'marketplace' && (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="py-3 px-4">{language === 'vi' ? 'Tên mạch' : 'Circuit Title'}</th>
                        <th className="py-3 px-3">{language === 'vi' ? 'Tác giả' : 'Owner'}</th>
                        <th className="py-3 px-3">Version</th>
                        <th className="py-3 px-3">{language === 'vi' ? 'Số linh kiện' : 'Components'}</th>
                        <th className="py-3 px-3">{language === 'vi' ? 'Loại bo mạch' : 'Board Type'}</th>
                        <th className="py-3 px-3">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                        <th className="py-3 px-4 text-right">3D Preview</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {projectsData.marketplaceProducts.map((mp: any) => (
                        <tr key={mp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            <div>{mp.title}</div>
                            <div className="text-[10px] font-mono text-slate-400">ID: {mp.id}</div>
                          </td>
                          <td className="py-3 px-3">{mp.ownerName}</td>
                          <td className="py-3 px-3 font-mono">v{mp.version}</td>
                          <td className="py-3 px-3 font-mono">{mp.componentCount}</td>
                          <td className="py-3 px-3 font-mono">{mp.boardType}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                              {mp.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() =>
                                setPreviewCircuit({
                                  id: mp.id,
                                  title: mp.title,
                                  author: mp.ownerName,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 font-semibold"
                            >
                              <Box className="w-3.5 h-3.5" />
                              <span>3D</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {projectSubTab === 'versions' && (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                {projectsData.projectVersions.length === 0 ? (
                  renderEmptyState(
                    '0 phiên bản lưu trữ',
                    '0 project versions',
                    'Chưa có bản ghi version nào được tạo.',
                    'No project version snapshots recorded yet.'
                  )
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                          <th className="py-3 px-4">Version ID</th>
                          <th className="py-3 px-3">Target ID</th>
                          <th className="py-3 px-3">Revision / SemVer</th>
                          <th className="py-3 px-3">Changelog / Note</th>
                          <th className="py-3 px-4">{language === 'vi' ? 'Thời gian' : 'Created At'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {projectsData.projectVersions.map((ver: any) => (
                          <tr key={ver.versionId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-4 font-mono text-cyan-600 dark:text-cyan-400">{ver.versionId}</td>
                            <td className="py-3 px-3 font-mono">{ver.projectId}</td>
                            <td className="py-3 px-3 font-mono font-bold">{ver.versionNumber || `r${ver.revision}`}</td>
                            <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{ver.note || '—'}</td>
                            <td className="py-3 px-4 text-slate-500">
                              {ver.createdAt ? new Date(ver.createdAt).toLocaleString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* 7. MARKETPLACE MANAGEMENT TAB                                */}
        {/* ============================================================ */}
        {activeTab === 'marketplace' && (
          <div className="space-y-4">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'all' as const, label: language === 'vi' ? 'Tất cả' : 'All' },
                { id: 'free' as const, label: language === 'vi' ? 'Miễn phí' : 'Free' },
                { id: 'paid' as const, label: language === 'vi' ? 'Trả phí' : 'Paid' },
                { id: 'pending' as const, label: 'Pending Review' },
                { id: 'published' as const, label: 'Published' },
                { id: 'rejected' as const, label: 'Rejected' },
                { id: 'archived' as const, label: 'Archived' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setMktFilter(f.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                    mktFilter === f.id
                      ? 'bg-cyan-600 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Marketplace Listings Table */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              {(() => {
                const list = (marketplaceData.products || []).filter((p: any) => {
                  if (mktFilter === 'free') return p.isFree;
                  if (mktFilter === 'paid') return !p.isFree;
                  if (mktFilter === 'pending') return p.status === 'pending';
                  if (mktFilter === 'published') return p.status === 'published';
                  if (mktFilter === 'rejected') return p.status === 'rejected';
                  if (mktFilter === 'archived') return p.status === 'archived' || p.status === 'draft';
                  return true;
                });

                if (list.length === 0) {
                  return renderEmptyState(
                    'Không có sản phẩm nào trong danh mục này',
                    'No listings in this filter',
                    'Chọn bộ lọc khác để xem các sản phẩm Cửa hàng.',
                    'Switch filters to inspect other Marketplace products.'
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                          <th className="py-3 px-4">{language === 'vi' ? 'Sản phẩm mạch' : 'Product Listing'}</th>
                          <th className="py-3 px-3">Creator</th>
                          <th className="py-3 px-3">{language === 'vi' ? 'Giá bán' : 'Price'}</th>
                          <th className="py-3 px-3">{language === 'vi' ? 'Lượt mua / Doanh thu' : 'Sales / Revenue'}</th>
                          <th className="py-3 px-3">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                          <th className="py-3 px-4 text-right">{language === 'vi' ? 'Quản trị' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {list.map((item: any) => (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 dark:text-white">{item.title}</div>
                              <div className="text-[10px] font-mono text-slate-400">
                                {item.source === 'system' ? 'Official Catalog' : 'Creator Listing'} • v{item.version}
                              </div>
                            </td>
                            <td className="py-3 px-3">{item.creatorName}</td>
                            <td className="py-3 px-3 font-mono font-bold">
                              {item.isFree ? (
                                <span className="text-emerald-600 dark:text-emerald-400">Free</span>
                              ) : (
                                formatCurrency(item.price)
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono">
                              <div>{item.salesCount || 0} sales</div>
                              <div className="text-emerald-600 dark:text-emerald-400 font-bold">
                                {formatCurrency(item.revenue || 0)}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  item.status === 'published'
                                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                                    : item.status === 'pending'
                                    ? 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
                                    : 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() =>
                                    setPreviewCircuit({
                                      id: item.id,
                                      title: item.title,
                                      author: item.creatorName,
                                    })
                                  }
                                  className="px-2 py-1 rounded bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 text-[10px] font-bold"
                                >
                                  3D View
                                </button>
                                {item.source === 'creator' && (
                                  <>
                                    <button
                                      onClick={() => handleMarketplaceAction(item.id, 'approve')}
                                      className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => handleMarketplaceAction(item.id, 'reject')}
                                      className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold"
                                    >
                                      Reject
                                    </button>
                                    <button
                                      onClick={() => handleMarketplaceAction(item.id, 'unpublish')}
                                      className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold"
                                    >
                                      Unpublish
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 8. REPORTS TAB                                               */}
        {/* ============================================================ */}
        {activeTab === 'reports' && reportsData && (
          <div className="space-y-6">
            {/* Period Selector: 7d, 30d, 90d */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {language === 'vi' ? 'Khoảng thời gian thống kê:' : 'Reporting Timeframe:'}
              </div>
              <div className="flex items-center gap-2">
                {[
                  { id: '7d' as const, label: language === 'vi' ? '7 ngày qua' : 'Last 7 Days' },
                  { id: '30d' as const, label: language === 'vi' ? '30 ngày qua' : 'Last 30 Days' },
                  { id: '90d' as const, label: language === 'vi' ? '90 ngày qua' : 'Last 90 Days' },
                ].map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setReportRange(r.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                      reportRange === r.id
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary Totals for Selected Period */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {(() => {
                const totals = reportsData.totals || reportsData.summary || {};
                return [
                  { labelVi: 'Người dùng mới', labelEn: 'User Growth', val: totals.userGrowth ?? 0 },
                  { labelVi: 'Giao dịch phát sinh', labelEn: 'Transactions', val: totals.transactionsCount ?? 0 },
                  { labelVi: 'Đơn thanh toán', labelEn: 'Paid Orders', val: totals.paidTransactionsCount ?? 0 },
                  {
                    labelVi: 'Doanh thu xác nhận',
                    labelEn: 'Revenue',
                    val: formatCurrency(totals.confirmedRevenue ?? totals.revenue ?? 0),
                  },
                  { labelVi: 'Ghi danh khóa học', labelEn: 'Enrollments', val: totals.courseEnrollments ?? 0 },
                  { labelVi: 'Dự án mới tạo', labelEn: 'Projects Created', val: totals.projectsCreated ?? 0 },
                ];
              })().map((stat, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                >
                  <div className="text-[11px] text-slate-500">{language === 'vi' ? stat.labelVi : stat.labelEn}</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-1 font-mono">{stat.val}</div>
                </div>
              ))}
            </div>

            {/* Daily Time-Series Breakdown Table (Only dates with real activity, or EmptyState) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {language === 'vi' ? 'Biểu đồ & Nhật ký Số liệu Theo Ngày' : 'Daily Activity Breakdown'}
              </h3>
              {(() => {
                const series = Array.isArray(reportsData.dailySeries)
                  ? reportsData.dailySeries
                  : Array.isArray(reportsData.timeline)
                  ? reportsData.timeline
                  : [];
                const activeDays = series.filter(
                  (d: any) =>
                    d.newUsers > 0 ||
                    d.transactions > 0 ||
                    d.revenue > 0 ||
                    d.enrollments > 0 ||
                    d.projectsCreated > 0
                );
                if (activeDays.length === 0) {
                  return renderEmptyState(
                    'Chưa phát sinh dữ liệu trong khoảng thời gian này',
                    'No activity recorded in this period',
                    'Hệ thống không tự tạo biểu đồ giả. Khi có người dùng đăng ký, tạo mạch hoặc thanh toán, số liệu thực tế theo ngày sẽ xuất hiện tại đây.',
                    'No synthetic charts are generated. Real daily metrics appear here as users register, build circuits, or complete orders.'
                  );
                }
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                          <th className="py-2.5 pr-3">{language === 'vi' ? 'Ngày' : 'Date'}</th>
                          <th className="py-2.5 px-3">{language === 'vi' ? 'User mới' : 'New Users'}</th>
                          <th className="py-2.5 px-3">{language === 'vi' ? 'Giao dịch' : 'Transactions'}</th>
                          <th className="py-2.5 px-3">{language === 'vi' ? 'Doanh thu' : 'Revenue'}</th>
                          <th className="py-2.5 px-3">{language === 'vi' ? 'Ghi danh' : 'Enrollments'}</th>
                          <th className="py-2.5 pl-3">{language === 'vi' ? 'Dự án mới' : 'New Projects'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {activeDays.map((day: any) => (
                          <tr key={day.date}>
                            <td className="py-2.5 pr-3 font-mono font-bold text-cyan-600 dark:text-cyan-400">
                              {day.date}
                            </td>
                            <td className="py-2.5 px-3 font-mono">{day.newUsers}</td>
                            <td className="py-2.5 px-3 font-mono">{day.transactions}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(day.revenue)}
                            </td>
                            <td className="py-2.5 px-3 font-mono">{day.enrollments}</td>
                            <td className="py-2.5 pl-3 font-mono">{day.projectsCreated}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 9. SYSTEM LOGS TAB                                           */}
        {/* ============================================================ */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={logCategory}
                  onChange={(e) => setLogCategory(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                >
                  <option value="all">{language === 'vi' ? 'Tất cả Phân loại' : 'All Categories'}</option>
                  <option value="auth">Auth</option>
                  <option value="payment">Payment</option>
                  <option value="admin">Admin</option>
                  <option value="project">Project</option>
                  <option value="course">Course</option>
                  <option value="marketplace">Marketplace</option>
                  <option value="system">System</option>
                </select>

                <select
                  value={logSeverity}
                  onChange={(e) => setLogSeverity(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                >
                  <option value="all">{language === 'vi' ? 'Tất cả Mức độ' : 'All Severities'}</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {logsData.length} {language === 'vi' ? 'bản ghi sự kiện' : 'events recorded'}
              </span>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              {logsData.length === 0 ? (
                renderEmptyState(
                  'Chưa có nhật ký hệ thống',
                  'No system logs recorded',
                  'Các sự kiện xác thực, thanh toán và quản trị sẽ tự động ghi nhận tại đây.',
                  'Authentication, payment, and admin audit events will be logged here automatically.'
                )
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="py-3 px-4">{language === 'vi' ? 'Thời gian' : 'Timestamp'}</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-3">Action</th>
                        <th className="py-3 px-3">Actor</th>
                        <th className="py-3 px-4">{language === 'vi' ? 'Chi tiết' : 'Details'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {logsData.map((log: any) => (
                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-100 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400">
                              {log.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                            {log.action}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                            {log.actorEmail || log.actorId || 'system'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 10. SETTINGS TAB                                             */}
        {/* ============================================================ */}
        {activeTab === 'settings' && settingsData && (
          <form
            onSubmit={handleSaveSettings}
            className="max-w-2xl p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-3">
              {language === 'vi' ? 'Cấu hình Vận hành Hệ thống' : 'Platform Operational Settings'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Platform Name</label>
                <input
                  type="text"
                  value={settingsData.platformName || ''}
                  onChange={(e) => setSettingsData({ ...settingsData, platformName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Support Email</label>
                <input
                  type="email"
                  value={settingsData.supportEmail || ''}
                  onChange={(e) => setSettingsData({ ...settingsData, supportEmail: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {[
                {
                  key: 'allowRegistration',
                  labelVi: 'Cho phép đăng ký tài khoản mới',
                  labelEn: 'Allow New User Registrations',
                },
                {
                  key: 'requireEmailVerification',
                  labelVi: 'Bắt buộc xác thực OTP Email khi đăng ký',
                  labelEn: 'Require Email OTP Verification',
                },
                {
                  key: 'autoApproveCreatorProducts',
                  labelVi: 'Tự động duyệt mạch mới từ Creator',
                  labelEn: 'Auto-Approve Creator Circuit Listings',
                },
                {
                  key: 'autoApproveCreatorCourses',
                  labelVi: 'Tự động duyệt khóa học mới từ Creator',
                  labelEn: 'Auto-Approve Creator Courses',
                },
                {
                  key: 'maintenanceMode',
                  labelVi: 'Chế độ bảo trì hệ thống (Maintenance Mode)',
                  labelEn: 'System Maintenance Mode',
                },
              ].map((toggle) => (
                <label
                  key={toggle.key}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer"
                >
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    {language === 'vi' ? toggle.labelVi : toggle.labelEn}
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settingsData[toggle.key])}
                    onChange={(e) => setSettingsData({ ...settingsData, [toggle.key]: e.target.checked })}
                    className="w-4 h-4 accent-cyan-600 rounded"
                  />
                </label>
              ))}
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 font-mono">
                {settingsData.updatedAt
                  ? `Updated: ${new Date(settingsData.updatedAt).toLocaleString()} (${settingsData.updatedBy || 'admin'})`
                  : ''}
              </span>
              <button
                type="submit"
                disabled={savingSettings}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-sm transition"
              >
                <Save className="w-4 h-4" />
                <span>{savingSettings ? 'Saving...' : language === 'vi' ? 'Lưu cài đặt' : 'Save Settings'}</span>
              </button>
            </div>
          </form>
        )}
      </main>

      {/* ============================================================ */}
      {/* USER DETAIL MODAL (Section IX: Safe Account Inspection)      */}
      {/* ============================================================ */}
      {selectedUserDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="p-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase text-cyan-600 dark:text-cyan-400">
                  User Profile & Entitlements Inspector
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {selectedUserDetail.user.displayName} ({selectedUserDetail.user.email})
                </h3>
              </div>
              <button
                onClick={() => setSelectedUserDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* Account & Server Role/Plan Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Account Info</span>
                  <div className="font-mono text-[11px]">ID: {selectedUserDetail.user.id}</div>
                  <div>Verified: {selectedUserDetail.user.isVerified ? 'Yes' : 'No'}</div>
                  <div>Role: <strong className="uppercase">{selectedUserDetail.user.role}</strong></div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Membership Plan</span>
                  <select
                    value={selectedUserDetail.user.plan}
                    onChange={(e) => handleUpdateUser(selectedUserDetail.user.id, { tier: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    <option value="free">Free</option>
                    <option value="student">Student (49,000đ)</option>
                    <option value="creator">Creator (120,000đ)</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Account Status</span>
                  <select
                    value={selectedUserDetail.user.status}
                    onChange={(e) => handleUpdateUser(selectedUserDetail.user.id, { status: e.target.value })}
                    disabled={selectedUserDetail.user.role === 'admin'}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold disabled:opacity-50"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              {/* Projects, Courses, Orders, Entitlements Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px]">Projects</div>
                  <div className="text-base font-black font-mono">{(selectedUserDetail.projects || []).length}</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px]">Enrolled Courses</div>
                  <div className="text-base font-black font-mono">{(selectedUserDetail.courses || []).length}</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px]">Orders</div>
                  <div className="text-base font-black font-mono">{(selectedUserDetail.orders || []).length}</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px]">Entitlements</div>
                  <div className="text-base font-black font-mono">{(selectedUserDetail.entitlements || []).length}</div>
                </div>
              </div>

              {/* Entitlements List */}
              <div className="space-y-1.5">
                <div className="font-bold text-slate-700 dark:text-slate-300">Entitlements</div>
                {(selectedUserDetail.entitlements || []).length === 0 ? (
                  <div className="text-slate-400 italic">None</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUserDetail.entitlements.map((ent: any, idx: number) => {
                      const label = typeof ent === 'string' ? ent : ent?.productTitle || ent?.productId || String(idx);
                      return (
                        <span
                          key={`${label}-${idx}`}
                          className="px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 font-mono text-[11px]"
                        >
                          {label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              <div className="space-y-1.5">
                <div className="font-bold text-slate-700 dark:text-slate-300">Recent User Activity</div>
                {(selectedUserDetail.activity || []).length === 0 ? (
                  <div className="text-slate-400 italic">No recorded events</div>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-2.5">
                    {selectedUserDetail.activity.map((act: any) => (
                      <div key={act.id} className="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                        <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400">{act.action}</span>
                        <span className="text-slate-600 dark:text-slate-300 truncate max-w-xs">{act.details}</span>
                        <span className="text-slate-400 font-mono text-[10px]">
                          {new Date(act.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* ORDER DETAIL MODAL (Section X: Read-Only Verified Order)     */}
      {/* ============================================================ */}
      {selectedOrderDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {language === 'vi' ? 'Chi tiết Giao dịch' : 'Transaction Details'}
              </h4>
              <button onClick={() => setSelectedOrderDetail(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Order ID:</span>
                <span className="font-mono font-bold">{selectedOrderDetail.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Order Code:</span>
                <span className="font-mono font-bold text-cyan-500">{selectedOrderDetail.orderCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">User:</span>
                <span className="font-mono">{selectedOrderDetail.userId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Product:</span>
                <span className="font-bold">{selectedOrderDetail.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <span className="font-mono font-bold">
                  {formatCurrency(selectedOrderDetail.amount)} {selectedOrderDetail.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-mono font-bold uppercase">{selectedOrderDetail.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Method:</span>
                <span>{selectedOrderDetail.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Created At:</span>
                <span>{new Date(selectedOrderDetail.createdAt).toLocaleString()}</span>
              </div>
              {selectedOrderDetail.paidAt && (
                <div className="flex justify-between text-emerald-500">
                  <span>Paid At:</span>
                  <span>{new Date(selectedOrderDetail.paidAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3D Preview Modal for Admin Inspection */}
      {previewCircuit && (
        <Product3DViewerModal
          productId={previewCircuit.id}
          productTitle={previewCircuit.title}
          authorName={previewCircuit.author}
          price={0}
          isOpen={Boolean(previewCircuit)}
          fallbackProject={previewCircuit.snapshot}
          onClose={() => setPreviewCircuit(null)}
          onOpenInEditor={(doc) => {
            setPreviewCircuit(null);
            if (onOpenProject) onOpenProject(doc);
          }}
        />
      )}
    </div>
  );
};
