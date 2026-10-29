// Минимальный service worker: нужен, чтобы приложение можно было установить на компьютер.
// Ничего не кэширует, всегда берёт свежие данные из сети.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
