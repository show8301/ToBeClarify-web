import { useCallback, useEffect, useState } from 'react';

export function useApiResource(loader, dependencies = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const load = useCallback(async (signal) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await loader(signal);
      setState({ data, loading: false, error: null });
    } catch (error) {
      if (error.name !== 'AbortError') setState((current) => ({ ...current, loading: false, error }));
    }
  }, dependencies);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const reload = useCallback(() => load(new AbortController().signal), [load]);

  return { ...state, reload, setData: (data) => setState({ data, loading: false, error: null }) };
}
