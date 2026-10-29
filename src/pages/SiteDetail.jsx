import { useParams } from 'react-router-dom';
import {
  IonBackButton, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonContent,
  IonHeader, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonPage, IonTitle, IonToolbar, useIonToast,
} from '@ionic/react';
import { useApp } from '../lib/AppContext';
import { formatRub } from '../lib/status';
import { rawUrl } from '../lib/github';
import StatusChip from '../components/StatusChip';

export default function SiteDetail() {
  const { id } = useParams();
  const { report, settings, collect, running } = useApp();
  const [toast] = useIonToast();
  const site = report?.sites?.find((s) => String(s.id) === id);

  const recheck = async () => {
    try {
      await collect(site.id);
      toast({ message: `Перепроверяю ${site.site}`, duration: 3000, color: 'success' });
    } catch (e) {
      toast({ message: e.message, duration: 4000, color: 'danger' });
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/utp" text="УТП" />
          </IonButtons>
          <IonTitle>{site?.site || 'Сайт'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        {!site && <p className="ion-padding">Сайт не найден в последнем сборе.</p>}
        {site && (
          <>
            <IonCard>
              <IonCardHeader>
                <StatusChip change={site.change} />
                <IonCardTitle className="detail-title">{site.company || site.site}</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <div>{site.brand} · №{site.id} · <a href={`https://${site.site}`} target="_blank" rel="noreferrer">{site.site}</a></div>
                {site.changes?.map((c) => <div key={c} className="change-line">{c}</div>)}
                {site.comment && <div className="change-line muted">{site.comment}</div>}
              </IonCardContent>
            </IonCard>

            {site.models?.length > 0 && (
              <IonList inset>
                <IonListHeader>
                  <IonLabel>Модели: цена от / выгода до</IonLabel>
                </IonListHeader>
                {site.models.map((m) => (
                  <IonItem key={m.model} href={m.source_url} target="_blank" detail={false}>
                    <IonLabel>{m.model}</IonLabel>
                    <IonNote slot="end" className="model-nums">
                      <b>{formatRub(m.price)}</b>
                      <span className="benefit">{m.max_benefit === '-' ? 'без выгоды' : `−${formatRub(m.max_benefit)}`}</span>
                    </IonNote>
                  </IonItem>
                ))}
              </IonList>
            )}

            {site.screens?.length > 0 && (
              <IonCard>
                <IonCardHeader>
                  <IonLabel>Снимки страниц (по ним дописывают сценарий)</IonLabel>
                </IonCardHeader>
                <IonCardContent>
                  {site.screens.map((src) => (
                    <a key={src} href={rawUrl(settings.repo, src)} target="_blank" rel="noreferrer">
                      <img className="screen" src={rawUrl(settings.repo, src)} alt="Снимок страницы" loading="lazy" />
                    </a>
                  ))}
                </IonCardContent>
              </IonCard>
            )}

            <div className="ion-padding">
              <IonButton expand="block" onClick={recheck} disabled={running}>
                {running ? 'Идёт сбор…' : 'Перепроверить только этот сайт'}
              </IonButton>
            </div>
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
