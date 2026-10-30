// Четыре кнопки главного экрана. У каждой своя проверка на GitHub (workflow) и свой файл с итогом.
import {
  pulseOutline, codeSlashOutline, pricetagsOutline, cloudUploadOutline,
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

// Статусы, которые требуют внимания (названия совпадают с теми, что пишут проверки).
export const KONGET_PROBLEMS = ['Скрипта нет', 'Токен не тот', 'Скрипт без токена', 'Проверить вручную'];
export const HEALTH_PROBLEMS = ['Не работает', 'Заглушка'];
