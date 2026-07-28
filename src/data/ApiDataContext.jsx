import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { adaptGalleryAlbum, adaptNavigation, adaptStaff } from '../api/adapters.js';
import { clientApi } from '../api/client.js';

const ApiDataContext = createContext(null);

export function ApiDataProvider({ children }) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const load = useCallback(async (signal) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [home, albums] = await Promise.all([
        clientApi.getHome(signal),
        clientApi.getGalleryAlbums(signal),
      ]);
      const reports = await Promise.all(albums.map((album) => clientApi.getGalleryAlbum(album.id, signal)));
      setState({ loading: false, error: null, data: { home, reports } });
    } catch (error) {
      if (error.name !== 'AbortError') setState({ loading: false, error, data: null });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const reload = useCallback(() => load(new AbortController().signal), [load]);

  const value = useMemo(() => {
    if (!state.data) return { ...state, reload };
    const { home, reports } = state.data;
      const settings = Object.fromEntries((home.siteSettings || []).map((item) => [item.settingKey, item.settingValue]));
    const adaptedReports = reports.map(adaptGalleryAlbum);
    const reportById = new Map(adaptedReports.map((report) => [report.id, report]));
    const carouselReports = (home.carousels || [])
      .map((carousel) => {
        const report = reportById.get(carousel.albumId);
        if (report) {
          return {
            ...report,
            title: carousel.title || report.title,
            summary: carousel.summary || report.description,
            imageUrl: carousel.imageUrl || report.imageUrl,
            period: carousel.eventTime || report.period,
          };
        }
        return null;
      })
      .filter(Boolean);

    return {
      loading: state.loading,
      error: state.error,
      reload,
      shopInfo: settings.shopInfo || {},
      homeSlides: (home.slides || []).filter((slide) => slide.imageUrl),
      liveUpdateConfig: settings.liveUpdateConfig || {},
      navigationItems: adaptNavigation(home.navigation),
      shopRules: (home.shopRules || []).map((rule) => rule.ruleText),
      staffMembers: (home.staff || []).map((staff) => adaptStaff(staff)),
      reports: adaptedReports,
      carouselReports,
    };
  }, [reload, state]);

  return <ApiDataContext.Provider value={value}>{children}</ApiDataContext.Provider>;
}

export function useApiData() {
  const value = useContext(ApiDataContext);
  if (!value) throw new Error('useApiData must be used inside ApiDataProvider.');
  return value;
}
