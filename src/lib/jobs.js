// Четыре кнопки главного экрана. У каждой своя проверка на GitHub (workflow) и свой файл с итогом.
import {
  pulseOutline, codeSlashOutline, pricetagsOutline, cloudUploadOutline,
  checkmarkCircle, alertCircle, cloudOffline, timeOutline, helpCircle, closeCircle, keyOutline, searchOutline,
} from 'ionicons/icons';

export const JOBS = [
  {
    key: 'health',
    title: 'Проверить работоспособность сайтов',
    short: 'Работа сайтов',
    about: 'Открываем каждый сайт: работает ли он, не заглушка ли, быстро ли грузится',
    workflow: 'health.yml',
    file: 'data/health/latest.json',
    field: 'health',
    icon: pulseOutline,
    gradient: ['#10b981', '#0ea5e9'],
    started: 'Проверка запущена. Обычно это несколько минут.',
  },
  {
    key: 'konget',
    title: 'Наличие скрипта Конгет',
    short: 'Скрипт Конгет',
    about: 'Ищем на сайте app.konget.ru/inject?token=…: обычный и отложенный скрипт',
    workflow: 'konget.yml',
    file: 'data/konget/latest.json',
    field: 'konget',
    icon: codeSlashOutline,
    gradient: ['#6366f1', '#a855f7'],
    started: 'Проверка запущена. На каждый сайт уходит около 15 секунд.',
  },
  {
    key: 'utp',
    title: 'Сверить УТП',
    short: 'УТП',
    about: 'Собираем цены и выгоды и сравниваем с прошлым разом',
    workflow: 'collect.yml',
    file: 'data/utp/latest.json',
    field: 'change',
    icon: pricetagsOutline,
    gradient: ['#f97316', '#ec4899'],
    started: 'Сбор запущен. Обычно это 5–15 минут, приложение можно закрыть.',
  },
  {
    key: 'export',
    title: 'Выгрузить данные в таблицу',
    short: 'Выгрузка',
    about: 'Записываем последние результаты всех проверок в Google-таблицу',
    workflow: 'export.yml',
    noSite: true, // у выгрузки нет выбора сайта
    icon: cloudUploadOutline,
    gradient: ['#0ea5e9', '#22c55e'],
    started: 'Выгружаю. Таблица обновится примерно через минуту.',
  },
];

export const JOB = Object.fromEntries(JOBS.map((j) => [j.key, j]));

// Статусы проверок «Работа сайтов» и «Скрипт Конгет». Названия совпадают с теми, что пишут проверки.
export const HEALTH_STATUS = {
  'Не работает': { tone: 'red', icon: cloudOffline, hint: 'Сайт не открылся или ответил ошибкой' },
  'Заглушка': { tone: 'amber', icon: alertCircle, hint: 'Вместо сайта пустая страница или «в разработке»' },
  'Работает медленно': { tone: 'blue', icon: timeOutline, hint: 'Открывается дольше 10 секунд' },
  'Работает': { tone: 'green', icon: checkmarkCircle, hint: 'Всё в порядке' },
};

export const KONGET_STATUS = {
  'Скрипта нет': { tone: 'red', icon: closeCircle, hint: 'На сайте не нашли app.konget' },
  'Токен не тот': { tone: 'red', icon: keyOutline, hint: 'Стоит скрипт с другим токеном' },
  'Скрипт без токена': { tone: 'amber', icon: alertCircle, hint: 'Конгет есть, а token не нашёлся' },
  'Проверить вручную': { tone: 'violet', icon: searchOutline, hint: 'Скрипт может быть в контейнере тегов, программе его не видно' },
  'Сайт не открылся': { tone: 'gray', icon: cloudOffline, hint: 'Проверить не получилось' },
  'Скрипт есть': { tone: 'green', icon: checkmarkCircle, hint: 'Скрипт и токен на месте' },
};

export const KONGET_PROBLEMS = ['Скрипта нет', 'Токен не тот', 'Скрипт без токена', 'Проверить вручную'];
export const HEALTH_PROBLEMS = ['Не работает', 'Заглушка'];

export function metaOf(table, status) {
  return table[status] || { tone: 'gray', icon: helpCircle, hint: '' };
}

// Все сайты из всех проверок: работает ли сайт, есть ли скрипт Конгет. Проблемные сверху.
export function mergeSites(reports) {
  const byId = new Map();
  for (const key of ['utp', 'konget', 'health']) {
    for (const s of reports[key]?.sites || []) {
      byId.set(String(s.id), { ...byId.get(String(s.id)), ...s, [key]: s });
    }
  }
  return [...byId.values()];
}
