/**
 * Unified Routing Engine for CircuitCraft 3D
 * Provides two-way synchronization between browser URL (HTML5 History API) and application state.
 * Supports deep linking, F5 refresh, browser Back/Forward buttons, natural URL aliases, and 404 detection.
 */

export type RouteKey =
  | 'landing'
  | 'editor'
  | 'projects'
  | 'courses'
  | 'lessons'
  | 'marketplace'
  | 'membership'
  | 'account'
  | 'admin'
  | 'creator'
  | 'not-found';

export interface RouteResolution {
  route: RouteKey;
  authIntent?: 'signin' | 'signup' | 'forgot';
  projectId?: string | null;
  rawPath: string;
}

export const ROUTE_PATH_MAP: Record<RouteKey, string> = {
  landing: '/',
  projects: '/projects',
  editor: '/editor',
  courses: '/courses',
  lessons: '/lessons',
  marketplace: '/marketplace',
  membership: '/membership',
  account: '/account',
  creator: '/creator',
  admin: '/admin',
  'not-found': '/404',
};

export const ROUTE_TITLE_MAP: Record<RouteKey, { vi: string; en: string }> = {
  landing: {
    vi: 'CircuitCraft 3D - Nền tảng Mô phỏng & Thiết kế Mạch Điện tử 3D',
    en: 'CircuitCraft 3D - Interactive 3D Circuit Design & Simulation',
  },
  projects: {
    vi: 'Dự án Thiết kế Mạch 3D | CircuitCraft 3D',
    en: '3D Circuit Projects | CircuitCraft 3D',
  },
  editor: {
    vi: 'Không gian Thiết kế Mạch 3D | CircuitCraft 3D',
    en: '3D Circuit Editor | CircuitCraft 3D',
  },
  courses: {
    vi: 'Khóa học & Phòng Lab Thực hành 3D | CircuitCraft 3D',
    en: 'Interactive Courses & Labs | CircuitCraft 3D',
  },
  lessons: {
    vi: 'Bài học Thực hành STEM Điện tử 3D | CircuitCraft 3D',
    en: 'Interactive STEM Lessons | CircuitCraft 3D',
  },
  marketplace: {
    vi: 'Cửa hàng Mạch Điện tử & Linh kiện 3D | CircuitCraft 3D',
    en: 'Circuit & Component Marketplace | CircuitCraft 3D',
  },
  membership: {
    vi: 'Gói Thành viên & Nâng cấp VIP | CircuitCraft 3D',
    en: 'Membership Plans & Upgrade | CircuitCraft 3D',
  },
  account: {
    vi: 'Hồ sơ Tài khoản & Cài đặt | CircuitCraft 3D',
    en: 'Account Profile & Settings | CircuitCraft 3D',
  },
  creator: {
    vi: 'Bảng điều khiển Nhà sáng tạo | CircuitCraft 3D',
    en: 'Creator Studio Dashboard | CircuitCraft 3D',
  },
  admin: {
    vi: 'Quản trị Hệ thống Toàn diện | CircuitCraft 3D',
    en: 'System Administration Dashboard | CircuitCraft 3D',
  },
  'not-found': {
    vi: '404 - Không tìm thấy trang | CircuitCraft 3D',
    en: '404 - Page Not Found | CircuitCraft 3D',
  },
};

/**
 * Parses the current browser pathname and search params into a valid route key and metadata.
 */
export function resolveRouteFromUrl(pathname?: string, search?: string): RouteResolution {
  if (typeof window === 'undefined') {
    return { route: 'landing', rawPath: '/' };
  }

  const rawPath = (pathname ?? window.location.pathname).trim().replace(/\/+$/, '') || '/';
  const path = rawPath.toLowerCase();
  const rawSearch = search ?? window.location.search;
  const searchParams = new URLSearchParams(rawSearch);
  const projectId = searchParams.get('id') || searchParams.get('projectId') || null;

  // 1. Auth Modals intent URLs
  if (path === '/login' || path === '/dang-nhap' || path === '/signin') {
    return { route: 'landing', authIntent: 'signin', rawPath };
  }
  if (path === '/register' || path === '/signup' || path === '/dang-ky') {
    return { route: 'landing', authIntent: 'signup', rawPath };
  }
  if (path === '/forgot-password' || path === '/quen-mat-khau') {
    return { route: 'landing', authIntent: 'forgot', rawPath };
  }

  // 2. Exact or Prefix Route Matching
  if (path === '/' || path === '/home' || path === '/homepage' || path === '/trang-chu') {
    return { route: 'landing', rawPath };
  }

  if (
    path === '/projects' ||
    path.startsWith('/projects/') ||
    path === '/design' ||
    path === '/thiet-ke-3d' ||
    path === '/du-an' ||
    path === '/my-projects'
  ) {
    return { route: 'projects', rawPath };
  }

  if (
    path === '/editor' ||
    path.startsWith('/editor/') ||
    path === '/studio' ||
    path === '/circuit' ||
    path === '/circuit-editor'
  ) {
    return { route: 'editor', projectId, rawPath };
  }

  if (path === '/courses' || path.startsWith('/courses/') || path === '/khoa-hoc' || path === '/classes') {
    return { route: 'courses', rawPath };
  }

  if (
    path === '/lessons' ||
    path.startsWith('/lessons/') ||
    path === '/bai-hoc' ||
    path === '/curriculum' ||
    path === '/stem'
  ) {
    return { route: 'lessons', rawPath };
  }

  if (
    path === '/marketplace' ||
    path.startsWith('/marketplace/') ||
    path === '/products' ||
    path.startsWith('/products/') ||
    path === '/cua-hang' ||
    path === '/shop' ||
    path === '/store' ||
    path === '/cart'
  ) {
    return { route: 'marketplace', rawPath };
  }

  if (
    path === '/membership' ||
    path.startsWith('/membership/') ||
    path === '/pricing' ||
    path === '/goi-thanh-vien' ||
    path === '/bang-gia' ||
    path === '/upgrade' ||
    path === '/vip'
  ) {
    return { route: 'membership', rawPath };
  }

  if (
    path === '/account' ||
    path.startsWith('/account/') ||
    path === '/profile' ||
    path.startsWith('/profile/') ||
    path === '/tai-khoan' ||
    path === '/ho-so' ||
    path === '/settings'
  ) {
    return { route: 'account', rawPath };
  }

  if (
    path === '/creator' ||
    path.startsWith('/creator/') ||
    path === '/creator-dashboard' ||
    path === '/tac-gia'
  ) {
    return { route: 'creator', rawPath };
  }

  if (
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path === '/dashboard' ||
    path === '/admin-dashboard' ||
    path === '/quan-tri'
  ) {
    return { route: 'admin', rawPath };
  }

  // 404 explicitly or for unknown paths
  return { route: 'not-found', rawPath };
}

/**
 * Updates the browser's address bar without reloading the page, keeping history intact.
 */
export function syncBrowserUrl(
  route: RouteKey,
  options?: {
    replace?: boolean;
    projectId?: string | null;
    language?: 'vi' | 'en';
  }
): void {
  if (typeof window === 'undefined') return;

  const basePath = ROUTE_PATH_MAP[route] || '/';
  let targetUrl = basePath;

  if (route === 'editor' && options?.projectId) {
    targetUrl = `/editor?id=${encodeURIComponent(options.projectId)}`;
  }

  const currentPathWithSearch = window.location.pathname + window.location.search;
  if (currentPathWithSearch !== targetUrl) {
    if (options?.replace) {
      window.history.replaceState({ route, projectId: options?.projectId }, '', targetUrl);
    } else {
      window.history.pushState({ route, projectId: options?.projectId }, '', targetUrl);
    }
  }

  // Update document title for UX & SEO
  const lang = options?.language || 'vi';
  const titleObj = ROUTE_TITLE_MAP[route];
  if (titleObj && titleObj[lang]) {
    document.title = titleObj[lang];
  }
}
