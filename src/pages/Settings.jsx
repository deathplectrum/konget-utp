import { useState } from 'react';
import {
  IonButton, IonContent, IonHeader, IonInput, IonItem, IonList, IonListHeader, IonLabel, IonPage, IonText,
  IonTitle, IonToolbar, useIonToast,
} from '@ionic/react';
import { useApp } from '../lib/AppContext';
import { checkToken } from '../lib/github';

export default function Settings() {
  const { settings, setSettings, refresh } = useApp();
  const [repo, setRepo] = useState(settings.repo);
  const [token, setToken] = useState(settings.token);
  const [toast] = useIonToast();

  const save = async () => {
    const next = { repo: repo.trim(), token: token.trim() };
    setSettings(next);
    const res = next.token ? await checkToken(next) : { ok: true, text: 'Сохранено. Без ключа можно только смотреть.' };
    toast({ message: res.text, duration: 3500, color: res.ok ? 'success' : 'danger' });
    refresh();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Настройки</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonList inset>
          <IonListHeader>
            <IonLabel>GitHub</IonLabel>
          </IonListHeader>
          <IonItem>
            <IonInput label="Репозиторий" labelPlacement="stacked" placeholder="логин/konget-utp" value={repo}
              onIonInput={(e) => setRepo(e.detail.value || '')} />
          </IonItem>
          <IonItem>
            <IonInput label="Ключ доступа" labelPlacement="stacked" type="password" placeholder="github_pat_…" value={token}
              onIonInput={(e) => setToken(e.detail.value || '')} />
          </IonItem>
        </IonList>
        <div className="ion-padding-horizontal">
          <IonButton expand="block" onClick={save}>Сохранить и проверить</IonButton>
        </div>

        <div className="ion-padding">
          <IonText color="medium">
            <h3>Как получить ключ (один раз на каждое устройство)</h3>
            <ol className="small steps">
              <li>
                Открой на GitHub{' '}
                <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
                  создание ключа
                </a>.
              </li>
              <li>Имя: «УТП Конгет». Срок: сколько удобно, например год.</li>
              <li>Repository access → Only select repositories → выбери konget-utp.</li>
              <li>Permissions → Repository → Actions: Read and write. Contents: Read-only.</li>
              <li>Нажми Generate token, скопируй ключ и вставь сюда.</li>
            </ol>
            <p className="small">
              Ключ хранится только на этом устройстве. Без ключа можно смотреть результаты, но не запускать сбор.
            </p>
          </IonText>
        </div>
      </IonContent>
    </IonPage>
  );
}
