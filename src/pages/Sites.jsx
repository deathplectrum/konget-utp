import {
  IonButton, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonPage,
  IonText, IonTitle, IonToolbar,
} from '@ionic/react';
import { add, alertCircle, checkmarkCircle, construct, documentText, folderOpen } from 'ionicons/icons';
import { useApp } from '../lib/AppContext';
import { newScenarioUrl } from '../lib/github';

// Насколько готов сценарий сайта, по итогам последнего сбора.
function scenarioState(s) {
  if (s.change === 'Нет сценария') return { icon: documentText, color: 'medium', text: 'Сценария нет' };
  if (s.change === 'Ошибка доступа') return { icon: alertCircle, color: 'danger', text: 'Сайт не открылся' };
  if (s.screens?.length || s.change === 'Требует проверки') {
    return { icon: construct, color: 'warning', text: 'Поправить сценарий' };
  }
  return { icon: checkmarkCircle, color: 'success', text: 'Сценарий работает' };
}

export default function Sites() {
  const { report, settings } = useApp();
  const repo = settings.repo;
  const sites = [...(report?.sites || [])].sort((a, b) => a.id - b.id);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Сайты</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="ion-padding">
          <IonText color="medium">
            <p className="small">
              Каждый сайт — это файл-сценарий в папке scenarios на GitHub: где на сайте модели, цены и выгоды.
              Новый сайт появится в списке после ближайшего сбора.
            </p>
          </IonText>
          <IonButton expand="block" href={newScenarioUrl(repo)} target="_blank" disabled={!repo}>
            <IonIcon slot="start" icon={add} /> Добавить сайт
          </IonButton>
          <IonButton expand="block" fill="outline" href={`https://github.com/${repo}/tree/main/scenarios`} target="_blank" disabled={!repo}>
            <IonIcon slot="start" icon={folderOpen} /> Все сценарии на GitHub
          </IonButton>
        </div>

        {sites.length > 0 && (
          <IonList inset>
            <IonListHeader>
              <IonLabel>В последнем сборе: {sites.length}</IonLabel>
            </IonListHeader>
            {sites.map((s) => {
              const st = scenarioState(s);
              return (
                <IonItem
                  key={s.id}
                  href={s.file ? `https://github.com/${repo}/edit/main/scenarios/${s.file}` : undefined}
                  target="_blank"
                  detail
                >
                  <IonIcon slot="start" icon={st.icon} color={st.color} />
                  <IonLabel>
                    <h3>{s.site}</h3>
                    <p>{s.brand}{s.company ? ` · ${s.company}` : ''}</p>
                  </IonLabel>
                  <IonNote slot="end" color={st.color} className="small">{st.text}</IonNote>
                </IonItem>
              );
            })}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
}
