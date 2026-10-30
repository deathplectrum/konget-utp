import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonContent, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonSpinner, useIonAlert, useIonToast,
} from '@ionic/react';
import { play, keyOutline, alertCircle, partlySunny, lockClosed, gridOutline, openOutline } from 'ionicons/icons';
import { useApp } from '../lib/AppContext';
import { ATTENTION, greeting, timeAgo } from '../lib/status';
import { HEALTH_PROBLEMS, JOBS, KONGET_PROBLEMS } from '../lib/jobs';
import { estimateSeconds, progressInfo } from '../lib/estimate';

function minutesSince(iso) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}

// Короткий итог последней проверки для карточки кнопки: главная цифра и что требует внимания.
function resultOf(job, report, run) {
  if (job.key === 'export') {
    if (!run || run.status !== 'completed') return { main: 'Ещё не выгружали' };
    return run.conclusion === 'success'
      ? { main: `Выгружено ${timeAgo(run.updated_at)}` }
      : { main: 'Последняя выгрузка не удалась', bad: 'Попробуйте ещё раз или напишите разработчику' };
  }
  const sites = report?.sites || [];
  if (!report) return { main: 'Проверок ещё не было' };
  const count = (list) => sites.filter((s) => list.includes(s[job.field])).length;
  if (job.key === 'health') {
    const bad = count(HEALTH_PROBLEMS);
    return { main: `Работают ${sites.length - bad} из ${sites.length}`, bad: bad ? `Не работают: ${bad}` : '', when: report.checked_at };
  }
  if (job.key === 'konget') {
    const ok = count(['Скрипт есть']);
    const bad = count(KONGET_PROBLEMS);
    return { main: `Скрипт есть на ${ok} из ${sites.length}`, bad: bad ? `Нужно посмотреть: ${bad}` : '', when: report.checked_at };
  }
  const changed = count(['Изменилось']);
  const bad = count(ATTENTION);
  return {
    main: changed ? `Изменилось на ${changed} сайтах` : 'Без изменений',
    bad: bad ? `Требуют проверки: ${bad}` : '',
    when: report.checked_at,
  };
}

function JobCard({ job, index }) {
  const { settings, reports, runs, runSite, stopping, isRunning, start, stop } = useApp();
  const [toast] = useIonToast();
  const [alert] = useIonAlert();
  const history = useHistory();
  const run = runs[job.key];
  const running = isRunning(job.key);
  const isStopping = stopping[job.key];
  const report = reports[job.key];
  const [, tick] = useState(0);
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const total = job.key === 'export' ? 60 : estimateSeconds(report, runSite[job.key]);
  const progress = running && run?.created_at ? progressInfo(run.created_at, total) : null;
  const res = resultOf(job, report, run);
  const failed = run?.status === 'completed' && run.conclusion && !['success', 'cancelled'].includes(run.conclusion);

  const onStop = () => {
    if (isStopping) return;
    alert({
      cssClass: 'nice-alert',
      header: 'Остановить проверку?',
      message: 'То, что уже проверено, сохранится. Остальные сайты останутся с данными прошлой проверки.',
      buttons: [
        { text: 'Продолжить', role: 'cancel' },
        {
          text: 'Остановить',
          role: 'destructive',
          handler: () => {
            stop(job.key)
              .then(() => toast({ message: 'Останавливаю. Проверенное сохранится через минуту.', duration: 3500, color: 'warning', position: 'top' }))
              .catch((e) => toast({ message: e.message, duration: 4000, color: 'danger', position: 'top' }));
          },
        },
      ],
    });
  };

  const onPress = async () => {
    if (running) {
      onStop();
      return;
    }
    if (!settings.token) {
      history.push('/settings');
      return;
    }
    try {
      await start(job.key);
      toast({ message: job.started, duration: 3500, color: 'success', position: 'top' });
    } catch (e) {
      toast({ message: e.message, duration: 4000, color: 'danger', position: 'top' });
    }
  };

  return (
    <section className={`job-card ${running ? 'is-running' : ''}`}
      style={{ background: `linear-gradient(135deg, ${job.gradient[0]}, ${job.gradient[1]})` }}>
      <div className="hero-glow" />
      <div className="job-head">
        <span className="job-num">{index + 1}</span>
        <span className="job-icon"><IonIcon icon={job.icon} /></span>
      </div>
      <h2 className="job-title">{job.title}</h2>
      <div className="job-about">{job.about}</div>

      <div className="job-result">
        <span>
          <b>{running ? `Идёт ${minutesSince(run.created_at)} мин · ${progress?.text || ''}` : res.main}</b>
          {!running && res.when && <small>{timeAgo(res.when)}</small>}
          {!running && res.bad && <small className="job-bad"><IonIcon icon={alertCircle} /> {res.bad}</small>}
          {failed && job.key !== 'export' && <small className="job-bad"><IonIcon icon={alertCircle} /> Последний запуск сломался</small>}
        </span>
      </div>

      <button className={`big-btn ${running ? 'is-stop' : ''}`} onClick={onPress} disabled={isStopping}
        style={{ color: job.gradient[0] }}>
        <span className="big-btn-icon" style={{ background: `linear-gradient(135deg, ${job.gradient[0]}, ${job.gradient[1]})` }}>
          {running ? <IonSpinner name="crescent" /> : <IonIcon icon={settings.token ? play : keyOutline} />}
        </span>
        <span className="big-btn-text">
          {isStopping ? 'Останавливаю…' : running ? 'Идёт проверка' : settings.token ? 'Запустить' : 'Нужен ключ'}
          {running && !isStopping && <small>нажмите, чтобы остановить</small>}
        </span>
      </button>
      {progress && (
        <div className="progress" title={progress.text}>
          <span style={{ width: `${Math.round(progress.share * 100)}%` }} />
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const { settings, refresh, error } = useApp();
  return (
    <IonPage>
      <IonContent fullscreen className="app-bg">
        <IonRefresher slot="fixed" onIonRefresh={(e) => refresh().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="page wide">
          <header className="greet">
            <div className="greet-small"><IonIcon icon={partlySunny} /> УТП Конгет</div>
            <h1>{greeting()}!</h1>
          </header>

          {!settings.token && (
            <a className="notice notice-amber" href="#/settings">
              <IonIcon icon={lockClosed} />
              <span>Кнопки работают только с ключом доступа. Смотреть результаты можно и без него. Нажми, чтобы добавить ключ</span>
            </a>
          )}
          {error && <div className="notice notice-amber"><IonIcon icon={alertCircle} /><span>{error}</span></div>}

          {settings.sheet && (
            <a className="sheet-link" href={settings.sheet} target="_blank" rel="noreferrer">
              <IonIcon icon={gridOutline} />
              <span><b>Google-таблица</b><small>Список сайтов и результаты проверок</small></span>
              <IonIcon icon={openOutline} />
            </a>
          )}

          <div className="job-grid">
            {JOBS.map((job, i) => <JobCard key={job.key} job={job} index={i} />)}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
