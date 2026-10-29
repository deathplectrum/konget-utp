import { useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { IonContent, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonSearchbar } from '@ionic/react';
import { chevronForward } from 'ionicons/icons';
import { useApp } from '../lib/AppContext';
import { ATTENTION, formatRub, humanize, plural, siteStats, timeAgo } from '../lib/status';
import StatusChip from '../components/StatusChip';
import BrandAvatar from '../components/BrandAvatar';

export default function Utp() {
  const { report, refresh } = useApp();
  const history = useHistory();
  const fromHome = new URLSearchParams(useLocation().search).get('status');
  const [filter, setFilter] = useState(fromHome || 'all');
  const [search, setSearch] = useState('');
  const all = report?.sites || [];

  const filters = [
    { key: 'all', label: 'Все', test: () => true },
    { key: 'attention', label: 'Внимание', test: (s) => ATTENTION.includes(s.change) },
    { key: 'Изменилось', label: 'Изменилось', test: (s) => s.change === 'Изменилось' },
  ];
  if (fromHome && !filters.some((f) => f.key === fromHome)) {
    filters.push({ key: fromHome, label: fromHome, test: (s) => s.change === fromHome });
  }

  const sites = useMemo(() => {
    const f = filters.find((x) => x.key === filter) || filters[0];
    const q = search.trim().toLowerCase();
    return all.filter(f.test).filter((s) => !q || `${s.site} ${s.company} ${s.brand}`.toLowerCase().includes(q));
  }, [all, filter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <IonPage>
      <IonContent fullscreen className="app-bg">
        <IonRefresher slot="fixed" onIonRefresh={(e) => refresh().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="page">
          <header className="greet">
            <div className="greet-small">Сбор {timeAgo(report?.checked_at)}</div>
            <h1>Цены и выгоды</h1>
          </header>

          <IonSearchbar className="search" placeholder="Сайт, марка или компания" value={search}
            onIonInput={(e) => setSearch(e.detail.value || '')} />

          <div className="chips">
            {filters.map((f) => (
              <button key={f.key} className={`chip ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
                {f.label}<span className="chip-count">{all.filter(f.test).length}</span>
              </button>
            ))}
          </div>

          {sites.map((s) => {
            const st = siteStats(s);
            return (
              <button key={s.id} className="card site-card" onClick={() => history.push(`/utp/${s.id}`)}>
                <div className="site-top">
                  <BrandAvatar brand={s.brand} />
                  <div className="site-names">
                    <b>{s.site}</b>
                    <small className="muted">{s.brand}{s.company ? ` · ${s.company}` : ''}</small>
                  </div>
                  <IonIcon icon={chevronForward} className="chev" />
                </div>
                <div className="site-status"><StatusChip change={s.change} small /></div>
                {st.count > 0 && (
                  <div className="mini-stats">
                    <div><small>Моделей</small><b>{st.count}</b></div>
                    <div><small>Цена от</small><b>{formatRub(st.minPrice)}</b></div>
                    <div><small>Выгода до</small><b className="green">{formatRub(st.maxBenefit)}</b></div>
                  </div>
                )}
                {s.change === 'Изменилось' && s.changes?.length > 0 && (
                  <div className="site-note">
                    {s.changes.length} {plural(s.changes.length, 'изменение', 'изменения', 'изменений')}: {s.changes[0]}
                    {s.changes.length > 1 ? '…' : ''}
                  </div>
                )}
                {s.comment && <div className="site-note muted">{humanize(s.comment)}</div>}
              </button>
            );
          })}

          {report && sites.length === 0 && (
            <div className="card empty"><div className="empty-emoji">🔍</div><div>Ничего не нашлось</div></div>
          )}
          {!report && (
            <div className="card empty"><div className="empty-emoji">🚗</div><div>Сборов ещё не было</div></div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
