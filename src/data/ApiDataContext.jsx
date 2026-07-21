import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { adaptEvent, adaptNavigation, adaptStaff } from '../api/adapters.js';
import { clientApi } from '../api/client.js';

const ApiDataContext = createContext(null);

export function ApiDataProvider({ children }) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const load = useCallback(async (signal) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [home, events] = await Promise.all([
        clientApi.getHome(signal),
        clientApi.getEvents({}, signal),
      ]);
      setState({ loading: false, error: null, data: { home, events } });
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
    const { home, events } = state.data;
    const settings = Object.fromEntries((home.siteSettings || []).map((item) => [item.settingKey, item.settingValue]));
    const adaptedEvents = events.map(adaptEvent);
    const eventById = new Map(adaptedEvents.map((event) => [event.id, event]));
    const carouselEvents = (home.carousels || [])
      .map((carousel) => eventById.get(carousel.eventId))
      .filter(Boolean);

    return {
      loading: state.loading,
      error: state.error,
      reload,
      shopInfo: settings.shopInfo || {},
      liveUpdateConfig: settings.liveUpdateConfig || {},
      navigationItems: adaptNavigation(home.navigation),
      shopRules: (home.shopRules || []).map((rule) => rule.ruleText),
      staffMembers: (home.staff || []).map((staff) => adaptStaff(staff)),
      events: adaptedEvents,
      carouselEvents: carouselEvents.length ? carouselEvents : adaptedEvents,
    };
  }, [reload, state]);

  return <ApiDataContext.Provider value={value}>{children}</ApiDataContext.Provider>;
}

export function useApiData() {
  const value = useContext(ApiDataContext);
  if (!value) throw new Error('useApiData must be used inside ApiDataProvider.');
  return value;
}
