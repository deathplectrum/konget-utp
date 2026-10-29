import { useState } from 'react';
import { IonContent, IonIcon, IonInput, IonPage, IonSpinner, useIonToast } from '@ionic/react';
import { checkmarkCircle, keyOutline, openOutline, lockClosed } from 'ionicons/icons';
import { useApp } from '../lib/AppContext';
import { checkToken } from '../lib/github';

const STEPS = [
  <>Открой на GitHub <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">создание ключа <IonIcon icon={openOutline} /></a></>,
  <>Имя — «УТП Конгет», срок — например, год</>,
  <><b>Repository access</b> → Only select repositories → <b>konget-utp</b></>,
  <><b>Permissions</b> → Actions: <b>Read and write</b>, Contents: <b>Read-only</b></>,
  <>Нажми <b>Generate token</b>, скопируй ключ и вставь ниже</>,
];

export default function Settings() {
  const { settings, setSettings, refresh } = useApp();
  const [repo, setRepo] = useState(settings.repo);
  const [token, setToken] = useState(settings.token);
  const [busy, setBusy] = useState(false);
  const [toast] = useIonToast();

  const save = async () => {
    setBusy(true);
    const next = { repo: repo.trim(), token: token.trim() };
    setSettings(next);
    const res = next.token ? await checkToken(next) : { ok: true, text: 'Сохранено. Без ключа можно только смотреть.' };
    setBusy(false);
    toast({ message: res.text, duration: 3500, color: res.ok ? 'success' : 'danger', position: 'top' });
    refresh();
  };

  return (
    <IonPage>
      <IonContent fullscreen className="app-bg">
        <div className="page">
          <header className="greet">
            <div className="greet-small">Настройки</div>
            <h1>Ключ доступа</h1>
          </header>

          <div className={`card key-state ${settings.token ? 'ok' : ''}`}>
            <span className="key-icon"><IonIcon icon={settings.token ? checkmarkCircle : keyOutline} /></span>
            <div>
              <b>{settings.token ? 'Ключ подключён' : 'Ключа пока нет'}</b>
              <small className="muted">
                {settings.token ? 'Кнопка «Собрать УТП» работает на этом устройстве' : 'Без ключа можно смотреть, но не запускать сбор'}
              </small>
            </div>
          </div>

          <div className="card">
            <label className="field">
              <span>Ключ GitHub</span>
              <IonInput type="password" placeholder="github_pat_…" value={token} onIonInput={(e) => setToken(e.detail.value || '')} />
            </label>
            <label className="field">
              <span>Репозиторий</span>
              <IonInput placeholder="логин/konget-utp" value={repo} onIonInput={(e) => setRepo(e.detail.value || '')} />
            </label>
            <button className="wide-btn" onClick={save} disabled={busy}>
              {busy ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkCircle} />} Сохранить и проверить
            </button>
            <div className="muted small center"><IonIcon icon={lockClosed} /> Ключ хранится только на этом устройстве</div>
          </div>

          <h2 className="section-title">Как получить ключ</h2>
          <div className="card steps">
            {STEPS.map((s, i) => (
              <div key={i} className="step"><span className="step-num">{i + 1}</span><span>{s}</span></div>
            ))}
            <div className="muted small">Это нужно сделать один раз на каждом устройстве: на компьютере и на телефоне.</div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
