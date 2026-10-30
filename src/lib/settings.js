// Настройки хранятся только на этом устройстве (в браузере).
const KEY = 'konget-utp-settings';

// Таблица «Центр Управления УТП»: список сайтов и результаты проверок.
export const DEFAULT_SHEET = 'https://docs.google.com/spreadsheets/d/1Qq-U1HhQHFYBTw8ZqK_O7dk-hCMsJymAdr4GybWY8e0/edit';

export const DEFAULT_REPO = typeof __DEFAULT_REPO__ !== 'undefined' ? __DEFAULT_REPO__ : '';

export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { repo: s.repo || DEFAULT_REPO, token: s.token || '', sheet: s.sheet || DEFAULT_SHEET };
  } catch {
    return { repo: DEFAULT_REPO, token: '', sheet: DEFAULT_SHEET };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // В приватном режиме браузер может не дать сохранить: тогда настройки живут до закрытия.
  }
}
