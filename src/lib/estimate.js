// Примерное время сбора по прошлому разу: сколько секунд ушло на каждый сайт.
// Новые сайты (ещё без замера) считаем по среднему, так что оценка сама растёт при добавлении сайтов.
const OVERHEAD = 60; // запуск машины на GitHub, установка браузера, сохранение результата
const DEFAULT_SITE = 90; // если замеров ещё нет совсем

export function estimateSeconds(report, siteId = '') {
  const sites = report?.sites || [];
  const timed = sites.filter((s) => s.seconds > 0);
  const avg = timed.length ? timed.reduce((a, s) => a + s.seconds, 0) / timed.length : DEFAULT_SITE;
  if (siteId) {
    const site = sites.find((s) => String(s.id) === String(siteId));
    return OVERHEAD + (site?.seconds || avg);
  }
  // Сайты идут по несколько одновременно, поэтому сумму делим на число потоков.
  const parallel = report?.parallel || 3;
  const sum = sites.reduce((a, s) => a + (s.seconds > 0 ? s.seconds : avg), 0) || avg;
  return OVERHEAD + sum / parallel;
}

// Доля выполненного (0…1) и подпись «осталось». Если сбор идёт дольше обычного, полоска замирает на 97%.
export function progressInfo(startedIso, total, now = Date.now()) {
  const elapsed = Math.max(0, (now - new Date(startedIso).getTime()) / 1000);
  const left = total - elapsed;
  const share = Math.min(elapsed / total, 0.97);
  let text;
  if (left <= 15) text = 'Почти готово…';
  else if (left < 60) text = `Осталось меньше минуты`;
  else text = `Осталось ≈ ${Math.ceil(left / 60)} мин`;
  return { share, text };
}
