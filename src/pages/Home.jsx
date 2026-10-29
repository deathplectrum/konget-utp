import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonContent, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonSpinner, useIonAlert, useIonToast,
} from '@ionic/react';
import { play, keyOutline, chevronForward, alertCircle, partlySunny } from 'ionicons/icons';
import { useApp } from '../lib/AppContext';
import {
  ATTENTION, STATUS, STATUS_ORDER, greeting, humanize, plural, statusMeta, timeAgo,
} from '../lib/status';
import BrandAvatar from '../components/BrandAvatar';
import { estimateSeconds, progressInfo } from '../lib/estimate';

function minutesSince(iso) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}

export default function Home() {
  const { settings, report, run, runSite, running, stopping, collect, stop, refresh, error } = useApp();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  const progress = running && run?.created_at ? progressInfo(run.created_at, estimateSeconds(report, runSite)) : null;
  const [toast] = useIonToast();
  const [alert] = useIonAlert();
  const history = useHistory();

  // Нажали на кнопку во время сбора: спрашиваем, точно ли остановить (чтобы не нажать случайно).
  const onStop = () => {
    if (stopping) return;
    alert({
      header: 'Остановить сбор?',
      message: 'То, что уже собрано, сохранится. Сайты, до которых сбор не дошёл, останутся с данными прошлого сбора.',
      buttons: [
        { text: 'Продолжить сбор', role: 'cancel' },
        {
          text: 'Остановить',
          role: 'destructive',
          handler: () => {
            stop()
              .then(() => toast({ message: 'Останавливаю. Собранное сохранится через минуту.', duration: 3500, color: 'warning', position: 'top' }))
              .catch((e) => toast({ message: e.message, duration: 4000, color: 'danger', position: 'top' }));
          },
        },
      ],
    });
  };

  const onCollect = async () => {
    if (running) {
      onStop();
      return;
    }
    if (!settings.token) {
      history.push('/settings');
      return;
    }
    try {
      await collect();
      toast({ message: 'Сбор запущен. Обычно это 5–15 минут, приложение можно закрыть.', duration: 3500, color: 'success', position: 'top' });
    } catch (e) {
      toast({ message: e.message, duration: 4000, color: 'danger', position: 'top' });
    }
  };

  const sites = report?.sites || [];
  const attention = sites.filter((s) => ATTENTION.includes(s.change));
  const changed = sites.filter((s) => s.change === 'Изменилось');
  const cancelled = run?.status === 'completed' && run.conclusion === 'cancelled';
  const failed = run?.status === 'completed' && run.conclusion && !['success', 'cancelled'].includes(run.conclusion);

  return (
    <IonPage>
      <IonContent fullscreen className="app-bg">
        <IonRefresher slot="fixed" onIonRefresh={(e) => refresh().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="page">
          <header className="greet">
            <div className="greet-small"><IonIcon icon={partlySunny} /> УТП Конгет</div>
            <h1>{greeting()}!</h1>
          </header>

          <section className={`hero-card ${running ? 'is-running' : ''}`}>
            <div className="hero-glow" />
            <div className="hero-info">
              <div className="hero-label">Последний сбор</div>
              <div className="hero-value">{running ? 'Собираю прямо сейчас…' : timeAgo(report?.checked_at)}</div>
              {running && run?.created_at && (
                <div className="hero-sub">Идёт {minutesSince(run.created_at)} мин · {progress?.text}</div>
              )}
            </div>
            <button className={`big-btn ${running ? 'is-stop' : ''}`} onClick={onCollect} disabled={stopping}>
              <span className="big-btn-icon">
                {running ? <IonSpinner name="crescent" /> : <IonIcon icon={settings.token ? play : keyOutline} />}
              </span>
              <span className="big-btn-text">
                {stopping ? 'Останавливаю…' : running ? 'Идёт сбор' : settings.token ? 'Собрать УТП' : 'Добавить ключ'}
                {running && !stopping && <small>нажмите, чтобы остановить</small>}
              </span>
            </button>
            {progress && (
              <div className="progress" title={progress.text}>
                <span style={{ width: `${Math.round(progress.share * 100)}%` }} />
              </div>
            )}
          </section>

          {failed && (
            <a className="notice notice-red" href={run.html_url} target="_blank" rel="noreferrer">
              <IonIcon icon={alertCircle} />
              <span>Последний сбор сломался. Нажми, чтобы посмотреть подробности на GitHub</span>
            </a>
          )}
          {cancelled && !running && (
            <div className="notice notice-amber">
              <IonIcon icon={alertCircle} />
              <span>
                Сбор остановлен вручную.
                {report?.stopped ? ` Проверено ${report.checked} из ${report.planned} сайтов, остальные — по прошлому сбору.` : ' Собранное сохранено.'}
              </span>
            </div>
          )}
          {error && <div className="notice notice-amber"><IonIcon icon={alertCircle} /><span>{error}</span></div>}

          {report ? (
            <>
              <h2 className="section-title">Сводка</h2>
              <div className="stat-grid">
                {STATUS_ORDER.filter((s) => report.summary?.[s]).map((s) => {
                  const meta = STATUS[s];
                  return (
                    <button key={s} className={`stat tone-${meta.tone}`} onClick={() => history.push(`/utp?status=${encodeURIComponent(s)}`)}>
                      <span className="stat-icon"><IonIcon icon={meta.icon} /></span>
                      <span className="stat-num">{report.summary[s]}</span>
                      <span className="stat-name">{s}</span>
                      <span className="stat-hint">{meta.hint}</span>
                    </button>
                  );
                })}
              </div>

              {attention.length > 0 && (
                <>
                  <h2 className="section-title">Нужно посмотреть</h2>
                  <div className="card list-card">
                    {attention.map((s) => (
                      <button key={s.id} className="list-row" onClick={() => history.push(`/utp/${s.id}`)}>
                        <BrandAvatar brand={s.brand} size={38} />
                        <span className="list-text">
                          <b>{s.site}</b>
                          <small className={`tone-text-${statusMeta(s.change).tone}`}>{s.change}</small>
                          {s.comment && <small className="muted clamp-2">{humanize(s.comment)}</small>}
                        </span>
                        <IonIcon icon={chevronForward} className="chev" />
                      </button>
                    ))}
                  </div>
                </>
              )}

              <h2 className="section-title">Что изменилось</h2>
              {changed.length ? (
                <div className="card list-card">
                  {changed.slice(0, 20).map((s) => (
                    <button key={s.id} className="list-row" onClick={() => history.push(`/utp/${s.id}`)}>
                      <BrandAvatar brand={s.brand} size={38} />
                      <span className="list-text">
                        <b>{s.site}</b>
                        <small className={`tone-text-${statusMeta(s.change).tone}`}>{s.change}</small>
                        <small className="muted">
                          Ответственный: «{s.responsible || 'None'}»
                        </small>
                      </span>
                      <IonIcon icon={chevronForward} className="chev" />
                    </button>
                  ))}
                  {changed.length > 20 && (
                    <button className="more-link" onClick={() => history.push(`/utp?status=${encodeURIComponent('Изменилось')}`)}>
                      Ещё {changed.length - 20} →
                    </button>
                  )}
                </div>
              ) : (
                <div className="card empty">
                  <div className="empty-emoji">☕️</div>
                  <div>
                    {report.previous_date
                      ? 'С прошлого сбора цены и выгоды не менялись'
                      : 'Это первый сбор. Изменения появятся после следующего'}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card empty">
              <div className="empty-emoji">🚗</div>
              <div>Сборов ещё не было. Нажми «Собрать УТП», и через несколько минут здесь появятся цены и выгоды.</div>
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
