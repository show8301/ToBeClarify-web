import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AppLoader } from './components/AppLoader.jsx';
import { Footer } from './components/Footer.jsx';
import { Navbar } from './components/Navbar.jsx';
import { GalleryPage } from './pages/GalleryPage.jsx';
import { GuestbookPage } from './pages/GuestbookPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { LiveUpdatePage } from './pages/LiveUpdatePage.jsx';
import { MenuPage } from './pages/MenuPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { RankingPage } from './pages/RankingPage.jsx';
import { StaffPage } from './pages/StaffPage.jsx';
import { ApiDataProvider, useApiData } from './data/ApiDataContext.jsx';
import { ApiState } from './components/ApiState.jsx';
import { BackgroundBubbles } from './components/BackgroundBubbles.jsx';
import { AdminRouter } from './admin/AdminRouter.jsx';
import './styles.css';

const routeAliases = {
  '/': '/home',
};

const hiddenPublicNavigationLabels = new Set(['留聲機', '店舖動態', '榮譽殿堂']);

const appBase = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBasePath(pathname) {
  if (!appBase || appBase === '') return pathname;
  if (pathname === appBase) return '/';
  if (pathname.startsWith(`${appBase}/`)) return pathname.slice(appBase.length);
  return pathname;
}

function normalizePath(pathname) {
  const appPath = stripBasePath(pathname);
  return routeAliases[appPath] || appPath || '/home';
}

function toBrowserPath(route) {
  const normalized = normalizePath(route);
  return `${appBase}${normalized}`;
}

function useRoute() {
  const [route, setRoute] = useState(normalizePath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setRoute(normalizePath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (to) => {
    const normalized = normalizePath(to);
    window.history.pushState({}, '', toBrowserPath(normalized));
    setRoute(normalized);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return { route, navigate };
}

function App() {
  const { route, navigate } = useRoute();
  const isAdminRoute = route === '/admin' || route.startsWith('/admin/');

  if (isAdminRoute) return <AdminRouter route={route} navigate={navigate} />;

  return (
    <ApiDataProvider>
      <PublicApp route={route} navigate={navigate} />
    </ApiDataProvider>
  );
}

function PublicApp({ route, navigate }) {
  const apiData = useApiData();
  const [isIntroLoading, setIsIntroLoading] = useState(true);
  const [isLoaderExitReady, setIsLoaderExitReady] = useState(false);
  const loaderHoldTimerRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsIntroLoading(false);
    }, shouldReduceMotion ? 450 : 2400);

    return () => window.clearTimeout(timer);
  }, [shouldReduceMotion]);

  const isLoading = apiData.loading || isIntroLoading;

  useEffect(() => {
    setIsLoaderExitReady(false);
    if (loaderHoldTimerRef.current !== null) {
      window.clearTimeout(loaderHoldTimerRef.current);
      loaderHoldTimerRef.current = null;
    }
    if (isLoading) return undefined;
    if (shouldReduceMotion) setIsLoaderExitReady(true);
    return undefined;
  }, [isLoading, shouldReduceMotion]);

  const handleLoaderRevealComplete = () => {
    if (shouldReduceMotion) {
      setIsLoaderExitReady(true);
      return;
    }

    if (loaderHoldTimerRef.current !== null) {
      window.clearTimeout(loaderHoldTimerRef.current);
    }

    loaderHoldTimerRef.current = window.setTimeout(() => {
      loaderHoldTimerRef.current = null;
      setIsLoaderExitReady(true);
    }, 220);
  };

  const page = useMemo(() => {
    if (route === '/home') return <HomePage navigate={navigate} />;
    if (route === '/staff') return <StaffPage />;
    if (route === '/event') return <GalleryPage />;
    if (route === '/gallery') return <GalleryPage />;
    if (route === '/menu') return <MenuPage />;
    if (route === '/guestbook') return <GuestbookPage />;
    if (route === '/liveupdate') return <LiveUpdatePage />;
    if (route === '/staffRanking') return <RankingPage variant="staff" />;
    if (route === '/monetaryRanking') return <RankingPage variant="monetary" />;
    return <NotFoundPage navigate={navigate} />;
  }, [route, navigate]);

  if (apiData.error) {
    return <ApiState loading={false} error={apiData.error} onRetry={apiData.reload} />;
  }

  const shouldShowLoader = isLoading || !isLoaderExitReady;
  return (
    <AnimatePresence mode="wait" initial={false}>
      {shouldShowLoader ? (
        <AppLoader
          key="app-loader"
          isDataLoading={shouldShowLoader ? isLoading && apiData.loading : false}
          isIntroLoading={shouldShowLoader ? isLoading && isIntroLoading : false}
          onRevealComplete={handleLoaderRevealComplete}
        />
      ) : (
        <PublicLayout key="public-layout" route={route} navigate={navigate} apiData={apiData}>
          {page}
        </PublicLayout>
      )}
    </AnimatePresence>
  );
}

function PublicLayout({ children, route, navigate, apiData }) {
  const visibleNavigationItems = apiData.navigationItems.filter(
    (item) => !hiddenPublicNavigationLabels.has(item.label),
  );
  const shouldReduceMotion = useReducedMotion();
  const pageMotion = shouldReduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.12 },
      }
    : {
        initial: { opacity: 0, y: 14, filter: 'blur(4px)' },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
        exit: { opacity: 0, y: -10, filter: 'blur(3px)' },
        transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
      };

  return (
    <div className="appShell">
      <BackgroundBubbles />
      <Navbar route={route} navigate={navigate} navigationItems={visibleNavigationItems} shopInfo={apiData.shopInfo} />
      <main className="pageTransitionShell">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={route} className="pageTransition" {...pageMotion}>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer navigate={navigate} navigationItems={visibleNavigationItems} shopInfo={apiData.shopInfo} />
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <App />,
);
