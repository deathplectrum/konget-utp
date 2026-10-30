import { Redirect, Route } from 'react-router-dom';
import {
  IonApp, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs, setupIonicReact,
} from '@ionic/react';
import { IonReactHashRouter } from '@ionic/react-router';
import { sparkles, settings } from 'ionicons/icons';

import { AppProvider } from './lib/AppContext';
import Home from './pages/Home';
import Settings from './pages/Settings';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import '@ionic/react/css/palettes/dark.system.css';
import './theme.css';

// Вид как у приложений на iPhone на всех устройствах, включая Windows.
setupIonicReact({ mode: 'ios' });

export default function App() {
  return (
    <IonApp>
      <AppProvider>
        <IonReactHashRouter>
          <IonTabs>
            <IonRouterOutlet>
              <Route exact path="/home" component={Home} />
              <Route exact path="/settings" component={Settings} />
              <Route exact path="/">
                <Redirect to="/home" />
              </Route>
            </IonRouterOutlet>
            <IonTabBar slot="bottom">
              <IonTabButton tab="home" href="/home">
                <IonIcon icon={sparkles} />
                <IonLabel>Главная</IonLabel>
              </IonTabButton>
              <IonTabButton tab="settings" href="/settings">
                <IonIcon icon={settings} />
                <IonLabel>Настройки</IonLabel>
              </IonTabButton>
            </IonTabBar>
          </IonTabs>
        </IonReactHashRouter>
      </AppProvider>
    </IonApp>
  );
}
