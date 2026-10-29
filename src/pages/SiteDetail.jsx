import { useParams } from 'react-router-dom';
import {
  IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonTitle, IonToolbar, useIonToast,
} from '@ionic/react';
import { openOutline, refresh as refreshIcon, giftOutline } from 'ionicons/icons';
import { useApp } from '../lib/AppContext';
import { formatRub, humanize, siteStats, statusMeta } from '../lib/status';
import { rawUrl } from '../lib/github';
import StatusChip from '../components/StatusChip';
import BrandAvatar, { brandColors } from '../components/BrandAvatar';
import ChangeRow from '../components/ChangeRow';

export default function SiteDetail() {
  const { id } = useParams();
  const { report, settings, collect, running } = useApp();
  const [toast] = useIonToast();
  const site = report?.sites?.find((s) => String(s.id) === id);

  const recheck = async () => {
    try {
      await collect(site.id);
      toast({ message: `Перепроверяю ${site.site}`, duration: 3000, color: 'success', position: 'top' });
    } catch (e) {
      toast({ message: e.message, duration: 4000, color: 'danger', position: 'top' });
    }
  };

  const [c1, c2] = brandColors(site?.brand);
  const st = site ? siteStats(site) : null;
  const maxBenefit = st?.maxBenefit || 1;

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar className="clear-toolbar">
          <IonButtons slot="start"><IonBackButton defaultHref="/utp" text="Назад" /></IonButtons>
          <IonTitle>{site?.site || ''}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="app-bg">
        {!site && <div className="page"><div className="card empty">Сайт не найден в последнем сборе</div></div>}
        {site && (
          <div className="page">
            <section className="detail-hero" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
              <BrandAvatar brand={site.brand} size={56} />
              <h1>{site.brand}</h1>
              <div className="detail-sub">{site.company || site.site}</div>
              <a className="glass-link" href={`https://${site.site}`} target="_blank" rel="noreferrer">
                {site.site} <IonIcon icon={openOutline} />
              </a>
            </section>

            <div className="detail-status">
              <StatusChip change={site.change} />
              <span className="muted">{statusMeta(site.change).hint}</span>
            </div>
            {site.comment && <div className="notice notice-amber"><span>{humanize(site.comment)}</span></div>}

            {st.count > 0 && (
              <div className="mini-stats big">
                <div><small>Моделей</small><b>{st.count}</b></div>
                <div><small>Цена от</small><b>{formatRub(st.minPrice)}</b></div>
                <div><small>Выгода до</small><b className="green">{formatRub(st.maxBenefit)}</b></div>
              </div>
            )}

            {(site.diff?.length > 0 || (site.change === 'Изменилось' && site.changes?.length > 0)) && (
              <>
                <h2 className="section-title">Что изменилось</h2>
                <div className="card">
                  {site.diff?.length
                    ? site.diff.map((d, i) => <div key={i} className="feed-row static"><ChangeRow item={d} /></div>)
                    : site.changes.map((c) => <div key={c} className="feed-row static">{c}</div>)}
                </div>
              </>
            )}

            {site.models?.length > 0 && (
              <>
                <h2 className="section-title">Модели</h2>
                <div className="model-grid">
                  {site.models.map((m) => (
                    <a key={m.model} className="card model-card" href={m.source_url} target="_blank" rel="noreferrer">
                      <div className="model-name">{m.model}</div>
                      <div className="model-price"><small>от</small> {formatRub(m.price)}</div>
                      {typeof m.max_benefit === 'number' ? (
                        <>
                          <div className="model-benefit">
                            <small><IonIcon icon={giftOutline} /> выгода до</small>
                            <b>{formatRub(m.max_benefit)}</b>
                          </div>
                          <div className="bar"><span style={{ width: `${Math.max(8, (m.max_benefit / maxBenefit) * 100)}%` }} /></div>
                        </>
                      ) : (
                        <div className="benefit-chip none">выгоды нет</div>
                      )}
                    </a>
                  ))}
                </div>
              </>
            )}

            {site.screens?.length > 0 && (
              <>
                <h2 className="section-title">Снимки страниц</h2>
                <div className="card">
                  <p className="muted small">По ним дописывают сценарий: где на сайте модели, цены и выгоды.</p>
                  {site.screens.filter((s) => s.endsWith('.jpg')).map((src) => (
                    <a key={src} href={rawUrl(settings.repo, src)} target="_blank" rel="noreferrer">
                      <img className="screen" src={rawUrl(settings.repo, src)} alt="Снимок страницы" loading="lazy" />
                    </a>
                  ))}
                </div>
              </>
            )}

            <button className="wide-btn" onClick={recheck} disabled={running}>
              {running ? <IonSpinner name="crescent" /> : <IonIcon icon={refreshIcon} />}
              {running ? 'Идёт сбор…' : 'Перепроверить только этот сайт'}
            </button>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}
