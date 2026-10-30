// Подписи и время простыми словами.

// Статусы сверки УТП, которые требуют внимания.
export const ATTENTION = ['Ошибка доступа', 'Требует проверки'];

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

// «5 минут назад», «вчера в 14:10».
export function timeAgo(iso) {
  if (!iso) return 'ещё не было';
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (h < 48) return `вчера в ${time}`;
  return formatDate(iso);
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 6) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}
