import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonContent, IonHeader,
  IonLabel, IonPage, IonRefresher, IonRefresherContent, IonSearchbar, IonSegment, IonSegmentButton,
  IonText, IonTitle, IonToolbar,
} from '@ionic/react';
import { useApp } from '../lib/AppContext';
import { ATTENTION, formatDate } from '../lib/status';
import StatusChip from '../components/StatusChip';

const FILTERS = {
  all: { label: 'Все', test: () => true },
  attention: { label: 'Внимание', test: (s) => ATTENTION.includes(s.change) },
  changed: { label: 'Изменилось', test: (s) => s.change === 'Изменилось' },
};

export default function Utp() {
  const { report, refresh } = useApp();
  const query = new URLSearchParams(useLocation().search);
  const fromHome = query.get('status');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const sites = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (report?.sites || [])
      .filter((s) => (fromHome && filter === 'all' ? s.change === fromHome : FILTERS[filter].test(s)))
      .filter((s) => !q || `${s.site} ${s.company} ${s.brand}`.toLowerCase().includes(q));
  }, [report, filter, search, fromHome]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>УТП</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSegment value={filter} onIonChange={(e) => setFilter(e.detail.value)}>
            {Object.entries(FILTERS).map(([k, f]) => (
              <IonSegmentButton key={k} value={k}>
                <IonLabel>{f.label}</IonLabel>
              </IonSegmentButton>
            ))}
          </IonSegment>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(e) => refresh().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <IonSearchbar placeholder="Сайт, компания или марка" value={search} onIonInput={(e) => setSearch(e.detail.value || '')} />
        {report && (
          <IonText color="medium">
            <p className="ion-padding-horizontal small">
              Сбор от {formatDate(report.checked_at)}
              {report.previous_date ? `, сравнение с ${report.previous_date}` : ''}
              {fromHome && filter === 'all' ? `. Показано: «${fromHome}»` : ''}
            </p>
          </IonText>
        )}
        {sites.map((s) => (
          <IonCard key={s.id} routerLink={`/utp/${s.id}`} button className="site-card">
            <IonCardHeader>
              <div className="site-card-top">
                <IonCardSubtitle>{s.brand} · №{s.id}</IonCardSubtitle>
                <StatusChip change={s.change} />
              </div>
              <IonCardTitle>{s.site}</IonCardTitle>
            </IonCardHeader>
            {(s.changes?.length > 0 || s.comment) && (
              <IonCardContent>
                {s.changes?.slice(0, 3).map((c) => <div key={c} className="change-line">{c}</div>)}
                {s.changes?.length > 3 && <div className="change-line muted">и ещё {s.changes.length - 3}…</div>}
                {s.comment && <div className="change-line muted">{s.comment}</div>}
              </IonCardContent>
            )}
          </IonCard>
        ))}
        {report && sites.length === 0 && (
          <p className="ion-padding ion-text-center"><IonText color="medium">Ничего не найдено</IonText></p>
        )}
        {!report && (
          <p className="ion-padding ion-text-center"><IonText color="medium">Сборов ещё не было</IonText></p>
        )}
      </IonContent>
    </IonPage>
  );
}
