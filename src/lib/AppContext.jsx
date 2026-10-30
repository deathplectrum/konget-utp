// Общее состояние приложения: настройки, последние итоги проверок и какие проверки идут сейчас.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { loadSettings, saveSettings } from './settings';
import { cancelRun, lastRun, loadData, startWorkflow } from './github';
import { JOB, JOBS } from './jobs';

const Ctx = createContext(null);
const POLL_MS = 10_000;

export function AppProvider({ children }) {
  const [settings, setSettingsState] = useState(loadSettings);
  const [reports, setReports] = useState({}); // { health, konget, utp }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [runs, setRuns] = useState({}); // последний запуск каждой проверки на GitHub
  const [runSite, setRunSite] = useState({}); // какой сайт перепроверяем ('' — все)
  const [stopping, setStopping] = useState({}); // нажали «Остановить», ждём, пока GitHub остановит
  const timers = useRef({});

  const setSettings = (s) => {
    saveSettings(s);
    setSettingsState(s);
  };

  const refresh = useCallback(async () => {
    if (!settings.repo) return;
    setLoading(true);
    setError('');
    try {
      const list = await Promise.all(JOBS.filter((j) => j.file).map(async (j) => [j.key, await loadData(settings, j.file)]));
      setReports(Object.fromEntries(list));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [settings]);

  // Пока проверка идёт, раз в 10 секунд спрашиваем GitHub, не закончилась ли она.
  const pollRun = useCallback(async (key) => {
    if (!settings.token || !settings.repo) return;
    const r = await lastRun(settings, JOB[key].workflow).catch(() => null);
    setRuns((all) => ({ ...all, [key]: r }));
    if (r?.status === 'completed') setStopping((all) => ({ ...all, [key]: false }));
    clearTimeout(timers.current[key]);
    if (r && r.status !== 'completed') {
      timers.current[key] = setTimeout(() => pollRun(key), POLL_MS);
    } else if (r) {
      refresh();
    }
  }, [settings, refresh]);

  const start = async (key, siteId = '') => {
    setError('');
    const job = JOB[key];
    await startWorkflow(settings, job.workflow, job.noSite ? null : { site: String(siteId) });
    setRunSite((all) => ({ ...all, [key]: siteId }));
    setRuns((all) => ({ ...all, [key]: { status: 'queued', created_at: new Date().toISOString() } }));
    // GitHub не сразу показывает новый запуск: ждём немного, потом начинаем следить.
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => pollRun(key), 5_000);
  };

  const stop = async (key) => {
    const run = runs[key];
    const r = run?.id ? run : await lastRun(settings, JOB[key].workflow);
    if (!r?.id || r.status === 'completed') return;
    await cancelRun(settings, r.id);
    setStopping((all) => ({ ...all, [key]: true }));
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => pollRun(key), 3_000);
  };

  useEffect(() => {
    refresh();
    JOBS.forEach((j) => pollRun(j.key));
    const all = timers.current;
    return () => Object.values(all).forEach(clearTimeout);
  }, [refresh, pollRun]);

  const isRunning = (key) => Boolean(runs[key] && runs[key].status !== 'completed');

  return (
    <Ctx.Provider value={{
      settings, setSettings, reports, loading, error, refresh, runs, runSite, stopping, isRunning, start, stop,
      // Для страниц УТП: итог и запуск сверки УТП.
      report: reports.utp || null,
      running: isRunning('utp'),
      collect: (siteId) => start('utp', siteId),
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  return useContext(Ctx);
}
