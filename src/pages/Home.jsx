import {
  IonButton, IonCard, IonCardContent, IonContent, IonHeader, IonIcon, IonPage, IonRefresher,
  IonRefresherContent, IonSpinner, IonText, IonTitle, IonToolbar, useIonToast,
} from '@ionic/react';
import { play, alertCircle, checkmarkCircle } from 'ionicons/icons';
import { useApp } from '../lib/AppContext';
import { formatDate, STATUS } from '../lib/status';

// Плитки со счётчиками на главной: что сколько раз встретилось в последнем сборе.
const TILES = ['Изменилось', 'Требует проверки', 'Ошибка доступа', 'Не изменилось', 'Первая проверка', 'Нет сценария'];

function minutesSince(iso) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}

export default function Home() {
  const { settings, report, run, running, collect, refresh, error } = useApp();
  const [toast] = useIonToast();

  const onCollect = async () => {
    try {
      await collect();
      toast({ message: 'Сбор запущен. Обычно это 5–15 минут.', duration: 3000, color: 'success' });
    } catch (e) {
      toast({ message: e.message, duration: 4000, color: 'danger' });
    }
  };

  const failed = run?.status === 'completed' && run.conclusion !== 'success';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Главная</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={(e) => refresh().finally(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="hero">
          <button className={`collect-btn ${running ? 'busy' : ''}`} onClick={onCollect} disabled={running}>
            {running ? <IonSpinner name="crescent" /> : <IonIcon icon={play} />}
            <span>{running ? 'Идёт сбор…' : 'Собрать УТП'}</span>
          </button>
          <IonText color="medium" className="hero-note">
            {running && run?.created_at && <p>Идёт {minutesSince(run.created_at)} мин. Можно закрыть приложение.</p>}
            {!running && <p>Последний сбор: {formatDate(report?.checked_at)}</p>}
            {!settings.token && (
              <p>Чтобы кнопка работала, добавь ключ GitHub на вкладке «Настройки».</p>
            )}
          </IonText>
        </div>

        {failed && (
          <IonCard color="danger">
            <IonCardContent>
              <IonIcon icon={alertCircle} /> Последний сбор завершился с ошибкой.{' '}
              <a href={run.html_url} target="_blank" rel="noreferrer">Открыть подробности на GitHub</a>
            </IonCardContent>
          </IonCard>
        )}
        {error && (
          <IonCard color="warning">
            <IonCardContent>{error}</IonCardContent>
          </IonCard>
        )}

        {report ? (
          <div className="tiles">
            {TILES.filter((t) => report.summary?.[t] || t === 'Изменилось' || t === 'Требует проверки').map((t) => (
              <IonCard key={t} className={`tile tile-${STATUS[t].color}`} routerLink={`/utp?status=${encodeURIComponent(t)}`} button>
                <IonCardContent>
                  <div className="tile-num">{report.summary?.[t] || 0}</div>
                  <div className="tile-label">{t}</div>
                </IonCardContent>
              </IonCard>
            ))}
          </div>
        ) : (
          <IonCard>
            <IonCardContent>
              <IonIcon icon={checkmarkCircle} color="medium" /> Сборов ещё не было. Нажми большую кнопку, и через
              несколько минут здесь появятся цифры.
            </IonCardContent>
          </IonCard>
        )}

        {report?.sites?.length > 0 && (
          <IonButton expand="block" fill="outline" routerLink="/utp">
            Смотреть все сайты ({report.sites.length})
          </IonButton>
        )}
      </IonContent>
    </IonPage>
  );
}
