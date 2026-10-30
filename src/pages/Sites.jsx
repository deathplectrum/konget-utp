import { useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { IonContent, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonSearchbar } from '@ionic/react';
import { add, folderOpen, chevronForward } from 'ionicons/icons';
import { useApp } from '../lib/AppContext';
import { newScenarioUrl } from '../lib/github';
import { timeAgo } from '../lib/status';
import {
  HEALTH_PROBLEMS, HEALTH_STATUS, KONGET_PROBLEMS, KONGET_STATUS, mergeSites, metaOf,
} from '../lib/jobs';
import BrandAvatar from '../components/BrandAvatar';

function Pill({ table, status }) {
  if (!status) return null;
  const m = metaOf(table, status);
  return <span className={`pill pill-sm tone-${m.tone}`}><IonIcon icon={m.icon} />{status}</span>;
}

export default function Sites() {
  const { reports, settings, refresh } = useApp();
  const history = useHistory();
  const show = new URLSearchParams(useLocation().search).get('show');
  const [filter, setFilter] = useState(show || 'all');
  const [search, setSearch] = useState('');
  const all = useMemo(() => mergeSites(reports), [reports]);
  const repo = settings.repo;

  const filters = [
    { key: 'all', label: 'Все', test: () => true },
    { key: 'health', label: 'Не работают', test: (s) => HEALTH_PROBLEMS.includes(s.health?.health) },
    { key: 'konget', label: 'Скрипт: посмотреть', test: (s) => KONGET_PROBLEMS.includes(s.konget?.konget) },
  ];
  const rank = (s) => (filters[1].test(s) ? 0 : filters[2].test(s) ? 1 : 2);
  const sites = useMemo(() => {
    const f = filters.find((x) => x.key === filter) || filters[0];
    const q = search.trim().toLowerCase();
    return all.filter(f.test)
      .filter((s) => !q || `${s.site} ${s.company} ${s.brand} ${s.responsible}`.toLowerCase().includes(q))
      .sort((a, b) => rank(a) - rank(b) || a.id - b.id);
  }, [all, filter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <IonPage>
      <IonContent fullscreen className="app-bg">
        <IonRefresher slot="fixed" onIonRefresh={(e) => refresh().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="page">
          <header className="greet">
            <div className="greet-small">
              Работа сайтов: {timeAgo(reports.health?.checked_at)} · Скрипт: {timeAgo(reports.konget?.checked_at)}
            </div>
            <h1>Сайты</h1>
          </header>

          <IonSearchbar className="search" placeholder="Сайт, марка, компания или ответственный" value={search}
            onIonInput={(e) => setSearch(e.detail.value || '')} />

          <div className="chips">
            {filters.map((f) => (
              <button key={f.key} className={`chip ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
                {f.label}<span className="chip-count">{all.filter(f.test).length}</span>
              </button>
            ))}
          </div>

          {sites.length > 0 && (
            <div className="card list-card">
              {sites.map((s) => (
                <button key={s.id} className="list-row" onClick={() => history.push(`/utp/${s.id}`)}>
                  <BrandAvatar brand={s.brand} size={40} />
                  <span className="list-text">
                    <b>{s.site}</b>
                    <small className="muted">{[s.brand, s.company].filter(Boolean).join(' · ')}</small>
                    <span className="pill-row">
                      <Pill table={HEALTH_STATUS} status={s.health?.health} />
                      <Pill table={KONGET_STATUS} status={s.konget?.konget} />
                    </span>
                  </span>
                  <IonIcon icon={chevronForward} className="chev" />
                </button>
              ))}
            </div>
          )}
          {all.length > 0 && sites.length === 0 && (
            <div className="card empty"><div className="empty-emoji">🎉</div><div>Здесь пусто: проблем нет</div></div>
          )}
          {all.length === 0 && (
            <div className="card empty"><div className="empty-emoji">🌐</div><div>Проверок ещё не было. Запусти любую на главной.</div></div>
          )}

          <div className="card how">
            <div className="how-title">Как добавить сайт</div>
            <p>Один сайт — один файл в папке scenarios. Для проверки работы сайта и скрипта Конгет хватит id и адреса,
              для сверки УТП нужен сценарий: где на сайте модели, цены и выгоды.</p>
            <div className="btn-row">
              <a className="soft-btn primary" href={newScenarioUrl(repo)} target="_blank" rel="noreferrer">
                <IonIcon icon={add} /> Добавить сайт
              </a>
              <a className="soft-btn" href={`https://github.com/${repo}/tree/main/scenarios`} target="_blank" rel="noreferrer">
                <IonIcon icon={folderOpen} /> Все сайты
              </a>
            </div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
