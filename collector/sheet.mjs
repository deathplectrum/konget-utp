// Раскладка результатов по листам Google-таблицы (кнопка 4). Здесь только данные,
// без обращения к Google, поэтому это легко проверить тестами.

const day = (iso) => (iso ? iso.slice(0, 10) : '');
const num = (v) => (typeof v === 'number' ? v : '');

// Что выгружаем: имя листа → строки (первая — заголовки).
export function buildSheets({ health, konget, utp }) {
  const byId = (report) => new Map((report?.sites || []).map((s) => [String(s.id), s]));
  const h = byId(health);
  const k = byId(konget);
  const u = byId(utp);
  const ids = [...new Set([...h.keys(), ...k.keys(), ...u.keys()])].sort((a, b) => Number(a) - Number(b));

  // «Сводка»: одна строка на сайт, все три проверки рядом. Проблемные сайты сверху.
  const summary = ids.map((id) => {
    const site = h.get(id) || k.get(id) || u.get(id);
    const hs = h.get(id);
    const ks = k.get(id);
    const us = u.get(id);
    const problems = [hs?.health && hs.health !== 'Работает', ks?.konget && ks.konget !== 'Скрипт есть',
      us?.change && ['Ошибка доступа', 'Требует проверки'].includes(us.change)].filter(Boolean).length;
    return {
      problems,
      row: [
        Number(id), site.company || '', site.site, site.brand || '', site.responsible || '',
        hs?.health || '', ks?.konget || '', (ks?.tokens || []).join(', '), us?.change || '',
        (us?.changes || []).join('; '),
        [hs?.reason, ks?.reason, us?.comment].filter(Boolean).join('; '),
      ],
    };
  }).sort((a, b) => b.problems - a.problems || a.row[0] - b.row[0]).map((x) => x.row);

  const sites = (report) => report?.sites || [];
  return {
    'Сводка': [
      ['ID', 'Компания', 'Сайт', 'Бренд', 'Ответственный', 'Сайт работает', 'Скрипт Конгет', 'Токен', 'УТП', 'Что изменилось', 'Комментарий'],
      ...summary,
    ],
    'Работа сайтов': [
      [`Проверка от ${day(health?.checked_at)}`],
      ['ID', 'Сайт', 'Статус', 'Код ответа', 'Открывался, с', 'Причина', 'Было'],
      ...sites(health).map((s) => [s.id, s.site, s.health, s.code ?? '', s.load_seconds ?? '', s.reason || '', s.was || '']),
    ],
    'Скрипт Конгет': [
      [`Проверка от ${day(konget?.checked_at)}`],
      ['ID', 'Сайт', 'Статус', 'Токен на сайте', 'Ожидаемый токен', 'Откуда скрипт', 'Причина', 'Было'],
      ...sites(konget).map((s) => [s.id, s.site, s.konget, (s.tokens || []).join(', '), s.expected || '', s.where || '', s.reason || '', s.was || '']),
    ],
    'УТП': [
      [`Сбор от ${day(utp?.checked_at)}`, utp?.previous_date ? `сравнение с ${utp.previous_date}` : ''],
      ['ID', 'Сайт', 'Бренд', 'Модель', 'Цена от, ₽', 'Выгода до, ₽', 'Статус сайта', 'Страница'],
      ...sites(utp).flatMap((s) => (s.models?.length
        ? s.models.map((m) => [s.id, s.site, s.brand || '', m.model, num(m.price), num(m.max_benefit), s.change, m.source_url || ''])
        : [[s.id, s.site, s.brand || '', '', '', '', s.change, '']])),
    ],
  };
}
