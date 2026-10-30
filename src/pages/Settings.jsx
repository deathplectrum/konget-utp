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

// Выгрузка в Google-таблицу: один раз завести бесплатный служебный аккаунт Google.
const SHEET_STEPS = (repo) => [
  <>Открой <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">Google Cloud <IonIcon icon={openOutline} /></a> и создай проект, например «konget» (бесплатно, карта не нужна)</>,
  <>Включи в нём <a href="https://console.cloud.google.com/apis/library/sheets.googleapis.com" target="_blank" rel="noreferrer">Google Sheets API <IonIcon icon={openOutline} /></a></>,
  <>Открой <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noreferrer">Service accounts <IonIcon icon={openOutline} /></a> → Create service account → имя «konget» → Done</>,
  <>В созданном аккаунте: Keys → Add key → JSON. Скачается файл с ключом</>,
  <>В Google-таблице нажми «Настройки доступа» и добавь адрес аккаунта (…@….iam.gserviceaccount.com) как <b>редактора</b></>,
  <>В <a href={`https://github.com/${repo}/settings/secrets/actions`} target="_blank" rel="noreferrer">секретах репозитория <IonIcon icon={openOutline} /></a> создай два: <b>GOOGLE_SERVICE_ACCOUNT</b> — всё содержимое файла с ключом, <b>SHEET_ID</b> — ссылка на таблицу</>,
];

export default function Settings() {
  const { settings, setSettings, refresh } = useApp();
  const [repo, setRepo] = useState(settings.repo);
  const [token, setToken] = useState(settings.token);
  const [sheet, setSheet] = useState(settings.sheet);
  const [busy, setBusy] = useState(false);
  const [toast] = useIonToast();

  const save = async () => {
    setBusy(true);
    const next = { repo: repo.trim(), token: token.trim(), sheet: sheet.trim() };
    setSettings(next);
    const res = next.token ? await checkToken(next) : { ok: true, text: 'Сохранено. Без ключа можно только смотреть результаты.' };
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
                {settings.token ? 'Все четыре кнопки работают на этом устройстве' : 'Без ключа можно смотреть результаты, но не запускать проверки'}
              </small>
            </div>
          </div>

          <div className="card">
            <label className="field">
              <span>Ключ доступа</span>
              <IonInput type="password" placeholder="github_pat_…" value={token} onIonInput={(e) => setToken(e.detail.value || '')} />
            </label>
            <label className="field">
              <span>Репозиторий</span>
              <IonInput placeholder="логин/konget-utp" value={repo} onIonInput={(e) => setRepo(e.detail.value || '')} />
            </label>
            <label className="field">
              <span>Ссылка на Google-таблицу (для кнопки «Таблица»)</span>
              <IonInput placeholder="https://docs.google.com/spreadsheets/d/…" value={sheet} onIonInput={(e) => setSheet(e.detail.value || '')} />
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
            <div className="muted small">
              Ключ — это пропуск к кнопкам: у кого его нет, тот может только смотреть результаты.
              Можно сделать один ключ и раздать его узкому кругу людей, а если кто-то уйдёт — удалить ключ на GitHub и выпустить новый.
              Вставить ключ нужно один раз на каждом устройстве.
            </div>
          </div>

          <h2 className="section-title">Как подключить Google-таблицу</h2>
          <div className="card steps">
            {SHEET_STEPS(settings.repo).map((s, i) => (
              <div key={i} className="step"><span className="step-num">{i + 1}</span><span>{s}</span></div>
            ))}
            <div className="muted small">
              Кнопка «Выгрузить данные в таблицу» переписывает листы «Сводка», «Работа сайтов», «Скрипт Конгет» и «УТП».
              Остальные листы таблицы она не трогает.
            </div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
