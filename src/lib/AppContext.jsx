// Общее состояние приложения: настройки, последний сбор и идёт ли сбор сейчас.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { loadSettings, saveSettings } from './settings';
import { lastRun, loadLatest, startCollect } from './github';

const Ctx = createContext(null);
const POLL_MS = 10_000;

export function AppProvider({ children }) {
  const [settings, setSettingsState] = useState(loadSettings);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [run, setRun] = useState(null); // последний запуск сборщика на GitHub
  const [runSite, setRunSite] = useState(''); // какой сайт перепроверяем ('' — все)
  const timer = useRef(null);

  const setSettings = (s) => {
    saveSettings(s);
    setSettingsState(s);
  };

  const refresh = useCallback(async () => {
    if (!settings.repo) return;
    setLoading(true);
    setError('');
    try {
      setReport(await loadLatest(settings));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [settings]);

  // Пока сбор идёт, раз в 10 секунд спрашиваем GitHub, не закончился ли он.
  const pollRun = useCallback(async () => {
    if (!settings.token || !settings.repo) return;
    const r = await lastRun(settings).catch(() => null);
    setRun(r);
    clearTimeout(timer.current);
    if (r && r.status !== 'completed') {
      timer.current = setTimeout(pollRun, POLL_MS);
    } else if (r) {
      refresh();
    }
  }, [settings, refresh]);

  const collect = async (siteId = '') => {
    setError('');
    const startedAt = Date.now();
    await startCollect(settings, siteId);
    setRunSite(siteId);
    setRun({ status: 'queued', created_at: new Date(startedAt).toISOString() });
    // GitHub не сразу показывает новый запуск: ждём немного, потом начинаем следить.
    clearTimeout(timer.current);
    timer.current = setTimeout(pollRun, 5_000);
  };

  useEffect(() => {
    refresh();
    pollRun();
    return () => clearTimeout(timer.current);
  }, [refresh, pollRun]);

  const running = run && run.status !== 'completed';

  return (
    <Ctx.Provider value={{ settings, setSettings, report, loading, error, refresh, run, runSite, running, collect }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  return useContext(Ctx);
}
