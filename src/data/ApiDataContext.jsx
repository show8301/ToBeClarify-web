import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { adaptNavigation } from '../api/adapters.js';
import { clientApi } from '../api/client.js';

const ApiDataContext = createContext(null);

export function ApiDataProvider({ children }) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const load = useCallback(async (signal) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const home = await clientApi.getHome(signal);
      setState({ loading: false, error: null, data: { home } });
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
    const { home } = state.data;
    const settings = Object.fromEntries((home.siteSettings || []).map((item) => [item.settingKey, item.settingValue]));
    const carouselReports = (home.carousels || [])
      .filter((carousel) => carousel.albumExists !== false)
      .map((carousel) => ({
        id: carousel.id,
        albumId: carousel.albumId,
        title: carousel.title,
        summary: carousel.summary || '',
        imageUrl: carousel.imageUrl,
        period: carousel.eventTime || '',
      }));

    return {
      loading: state.loading,
      error: state.error,
      reload,
      shopInfo: settings.shopInfo || {},
      homeSlides: (home.slides || []).filter((slide) => slide.imageUrl),
      liveUpdateConfig: settings.liveUpdateConfig || {},
      navigationItems: adaptNavigation(home.navigation),
      shopRules: (home.shopRules || []).map((rule) => rule.ruleText),
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
