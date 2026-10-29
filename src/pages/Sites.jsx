import { IonContent, IonIcon, IonPage } from '@ionic/react';
import { add, checkmarkCircle, construct, documentText, folderOpen, cloudOffline, chevronForward } from 'ionicons/icons';
import { useApp } from '../lib/AppContext';
import { newScenarioUrl } from '../lib/github';
import BrandAvatar from '../components/BrandAvatar';

// Насколько готов сценарий сайта, по итогам последнего сбора.
function scenarioState(s) {
  if (s.change === 'Нет сценария') return { icon: documentText, tone: 'gray', text: 'Не настроен' };
  if (s.change === 'Ошибка доступа') return { icon: cloudOffline, tone: 'red', text: 'Не открылся' };
  if (s.change === 'Требует проверки') return { icon: construct, tone: 'amber', text: 'Донастроить' };
  return { icon: checkmarkCircle, tone: 'green', text: 'Работает' };
}

export default function Sites() {
  const { report, settings } = useApp();
  const repo = settings.repo;
  const sites = [...(report?.sites || [])].sort((a, b) => a.id - b.id);
  const ready = sites.filter((s) => scenarioState(s).tone === 'green').length;

  return (
    <IonPage>
      <IonContent fullscreen className="app-bg">
        <div className="page">
          <header className="greet">
            <div className="greet-small">{ready} из {sites.length} работают</div>
            <h1>Сайты</h1>
          </header>

          <div className="card how">
            <div className="how-title">Как это устроено</div>
            <p>У каждого сайта есть сценарий: подсказка сборщику, где на сайте модели, цены и выгоды.
              Новый сайт появится здесь после ближайшего сбора.</p>
            <div className="btn-row">
              <a className="soft-btn primary" href={newScenarioUrl(repo)} target="_blank" rel="noreferrer">
                <IonIcon icon={add} /> Добавить сайт
              </a>
              <a className="soft-btn" href={`https://github.com/${repo}/tree/main/scenarios`} target="_blank" rel="noreferrer">
                <IonIcon icon={folderOpen} /> Все сценарии
              </a>
            </div>
          </div>

          {sites.length > 0 && (
            <div className="card list-card">
              {sites.map((s) => {
                const st = scenarioState(s);
                return (
                  <a key={s.id} className="list-row" target="_blank" rel="noreferrer"
                    href={s.file ? `https://github.com/${repo}/edit/main/scenarios/${s.file}` : undefined}>
                    <BrandAvatar brand={s.brand} size={40} />
                    <span className="list-text">
                      <b>{s.site}</b>
                      <small className="muted">{s.brand} · {s.models?.length || 0} моделей</small>
                    </span>
                    <span className={`pill pill-sm tone-${st.tone}`}><IonIcon icon={st.icon} />{st.text}</span>
                    <IonIcon icon={chevronForward} className="chev" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
