import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { RouteKey, resolveRouteFromUrl, syncBrowserUrl, ROUTE_PATH_MAP, ROUTE_TITLE_MAP } from './routes';
import { useI18n } from '../i18n/context';

export interface NavigationContextValue {
  currentRoute: RouteKey;
  currentPath: string;
  projectId: string | null;
  navigate: (target: RouteKey | string, options?: { replace?: boolean; projectId?: string | null }) => void;
  goBack: () => void;
  breadcrumbs: Array<{ label: string; route: RouteKey; path: string }>;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export interface NavigationProviderProps {
  children: ReactNode;
  onAuthIntent?: (intent: 'signin' | 'signup' | 'forgot') => void;
  onRouteChange?: (route: RouteKey, projectId?: string | null) => void;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({
  children,
  onAuthIntent,
  onRouteChange,
}) => {
  const { language } = useI18n();

  // Initialize state from current URL
  const [resolution, setResolution] = useState(() => resolveRouteFromUrl());
  const [currentRoute, setCurrentRoute] = useState<RouteKey>(resolution.route);
  const [currentPath, setCurrentPath] = useState<string>(resolution.rawPath);
  const [projectId, setProjectId] = useState<string | null>(resolution.projectId || null);

  // Sync route on popstate (browser back/forward button)
  useEffect(() => {
    const handlePopState = () => {
      const res = resolveRouteFromUrl();
      setResolution(res);
      setCurrentRoute(res.route);
      setCurrentPath(res.rawPath);
      setProjectId(res.projectId || null);

      if (res.authIntent && onAuthIntent) {
        onAuthIntent(res.authIntent);
      }
      if (onRouteChange) {
        onRouteChange(res.route, res.projectId || null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onAuthIntent, onRouteChange]);

  // Initial trigger for auth intents if visiting /login, /register, etc.
  useEffect(() => {
    if (resolution.authIntent && onAuthIntent) {
      onAuthIntent(resolution.authIntent);
    }
  }, []);

  // Update document title when route or language changes
  useEffect(() => {
    const titleObj = ROUTE_TITLE_MAP[currentRoute];
    if (titleObj && titleObj[language]) {
      document.title = titleObj[language];
    }
  }, [currentRoute, language]);

  const navigate = useCallback(
    (target: RouteKey | string, options?: { replace?: boolean; projectId?: string | null }) => {
      let targetRoute: RouteKey = 'landing';
      let targetPath = '/';
      let effectiveProjectId = options?.projectId ?? null;

      if (target.startsWith('/')) {
        // Target is a path
        const res = resolveRouteFromUrl(target, effectiveProjectId ? `?id=${effectiveProjectId}` : undefined);
        targetRoute = res.route;
        targetPath = res.rawPath;
        if (res.projectId) effectiveProjectId = res.projectId;
        if (res.authIntent && onAuthIntent) {
          onAuthIntent(res.authIntent);
        }
      } else {
        // Target is a RouteKey
        targetRoute = target as RouteKey;
        targetPath = ROUTE_PATH_MAP[targetRoute] || '/';
      }

      setCurrentRoute(targetRoute);
      setCurrentPath(targetPath);
      setProjectId(effectiveProjectId);

      syncBrowserUrl(targetRoute, {
        replace: options?.replace,
        projectId: effectiveProjectId,
        language,
      });

      if (onRouteChange) {
        onRouteChange(targetRoute, effectiveProjectId);
      }

      // Scroll to top on navigation (except editor canvas)
      if (targetRoute !== 'editor' && typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [language, onAuthIntent, onRouteChange]
  );

  const goBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      navigate('landing');
    }
  }, [navigate]);

  // Compute breadcrumbs
  const breadcrumbs: Array<{ label: string; route: RouteKey; path: string }> = [
    {
      label: language === 'vi' ? 'Trang chủ' : 'Home',
      route: 'landing',
      path: '/',
    },
  ];

  if (currentRoute !== 'landing' && currentRoute !== 'not-found') {
    const titleMap: Record<RouteKey, { vi: string; en: string }> = {
      landing: { vi: 'Trang chủ', en: 'Home' },
      projects: { vi: 'Dự án 3D', en: 'Projects' },
      editor: { vi: 'Không gian Thiết kế', en: '3D Studio' },
      courses: { vi: 'Khóa học', en: 'Courses' },
      lessons: { vi: 'Bài học STEM', en: 'STEM Lessons' },
      marketplace: { vi: 'Cửa hàng', en: 'Marketplace' },
      membership: { vi: 'Gói thành viên', en: 'Membership' },
      account: { vi: 'Tài khoản', en: 'Account' },
      creator: { vi: 'Nhà sáng tạo', en: 'Creator Studio' },
      admin: { vi: 'Quản trị hệ thống', en: 'Admin Dashboard' },
      'not-found': { vi: '404', en: '404' },
    };
    breadcrumbs.push({
      label: titleMap[currentRoute]?.[language] || currentRoute,
      route: currentRoute,
      path: ROUTE_PATH_MAP[currentRoute] || '/',
    });
  }

  return (
    <NavigationContext.Provider
      value={{
        currentRoute,
        currentPath,
        projectId,
        navigate,
        goBack,
        breadcrumbs,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextValue => {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return ctx;
};
