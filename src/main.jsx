import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Footer } from './components/Footer.jsx';
import { Navbar } from './components/Navbar.jsx';
import { EventPage } from './pages/EventPage.jsx';
import { GalleryPage } from './pages/GalleryPage.jsx';
import { GuestbookPage } from './pages/GuestbookPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { StaffPage } from './pages/StaffPage.jsx';
import { UpdatesPage } from './pages/UpdatesPage.jsx';
import './styles.css';

const routeAliases = {
  '/': '/home',
};

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

  const page = useMemo(() => {
    if (route === '/home') return <HomePage navigate={navigate} />;
    if (route === '/staff') return <StaffPage />;
    if (route === '/event') return <EventPage />;
    if (route === '/gallery') return <GalleryPage />;
    if (route === '/guestbook') return <GuestbookPage />;
    if (route === '/updates') return <UpdatesPage navigate={navigate} />;
    return <NotFoundPage navigate={navigate} />;
  }, [route, navigate]);

  return (
    <PublicLayout route={route} navigate={navigate}>
      {page}
    </PublicLayout>
  );
}

function PublicLayout({ children, route, navigate }) {
  return (
    <div className="appShell">
      <Navbar route={route} navigate={navigate} />
      <main>{children}</main>
      <Footer navigate={navigate} />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
