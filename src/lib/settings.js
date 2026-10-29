// Настройки хранятся только на этом устройстве (в браузере).
const KEY = 'konget-utp-settings';

export const DEFAULT_REPO = typeof __DEFAULT_REPO__ !== 'undefined' ? __DEFAULT_REPO__ : '';

export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { repo: s.repo || DEFAULT_REPO, token: s.token || '' };
  } catch {
    return { repo: DEFAULT_REPO, token: '' };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // В приватном режиме браузер может не дать сохранить: тогда настройки живут до закрытия.
  }
}
