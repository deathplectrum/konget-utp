import { useHistory } from 'react-router-dom';
import {
  IonContent, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonSpinner, useIonToast,
} from '@ionic/react';
import { play, keyOutline, chevronForward, alertCircle, partlySunny } from 'ionicons/icons';
import { useApp } from '../lib/AppContext';
import {
  ATTENTION, STATUS, STATUS_ORDER, greeting, humanize, plural, statusMeta, timeAgo,
} from '../lib/status';
import BrandAvatar from '../components/BrandAvatar';
import ChangeRow from '../components/ChangeRow';

function minutesSince(iso) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}

export default function Home() {
  const { settings, report, run, running, collect, refresh, error } = useApp();
  const [toast] = useIonToast();
  const history = useHistory();

  const onCollect = async () => {
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
  const models = sites.reduce((n, s) => n + (s.models?.length || 0), 0);
  const attention = sites.filter((s) => ATTENTION.includes(s.change));
  const feed = sites.flatMap((s) => (s.diff || []).map((d) => ({ ...d, site: s.site, brand: s.brand, id: s.id })));
  const failed = run?.status === 'completed' && run.conclusion && run.conclusion !== 'success';

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
              {report && !running && (
                <div className="hero-sub">
                  {sites.length} {plural(sites.length, 'сайт', 'сайта', 'сайтов')} · {models} {plural(models, 'модель', 'модели', 'моделей')}
                </div>
              )}
              {running && run?.created_at && (
                <div className="hero-sub">Идёт {minutesSince(run.created_at)} мин. Обычно 5–15 минут</div>
              )}
            </div>
            <button className="big-btn" onClick={onCollect} disabled={running}>
              <span className="big-btn-icon">
                {running ? <IonSpinner name="crescent" /> : <IonIcon icon={settings.token ? play : keyOutline} />}
              </span>
              <span>{running ? 'Идёт сбор' : settings.token ? 'Собрать УТП' : 'Добавить ключ'}</span>
            </button>
            {running && <div className="progress"><span /></div>}
          </section>

          {failed && (
            <a className="notice notice-red" href={run.html_url} target="_blank" rel="noreferrer">
              <IonIcon icon={alertCircle} />
              <span>Последний сбор сломался. Нажми, чтобы посмотреть подробности на GitHub</span>
            </a>
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
              {feed.length ? (
                <div className="card">
                  {feed.slice(0, 8).map((d, i) => (
                    <button key={i} className="feed-row" onClick={() => history.push(`/utp/${d.id}`)}>
                      <BrandAvatar brand={d.brand} size={34} />
                      <ChangeRow item={d} site={d.site} />
                    </button>
                  ))}
                  {feed.length > 8 && (
                    <button className="more-link" onClick={() => history.push('/utp')}>Ещё {feed.length - 8} →</button>
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
