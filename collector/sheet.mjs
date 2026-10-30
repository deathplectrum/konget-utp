// Раскладка результатов по листам Google-таблицы (кнопка 4): что в каких колонках,
// какая ширина, где выпадающие списки и каким цветом статусы. Здесь нет обращения к Google,
// поэтому это легко проверить тестами. Как это рисуется в таблице — в export.mjs.

import { CHANGE } from './lib.mjs';
import { HEALTH, KONGET } from './checks.mjs';

const day = (iso) => (iso ? iso.slice(0, 10) : '');
const num = (v) => (typeof v === 'number' ? v : '');

// Цвета статусов: зелёный — всё хорошо, жёлтый — посмотреть, красный — плохо.
export const TONE_OF = {
  [HEALTH.ok]: 'green', [HEALTH.slow]: 'blue', [HEALTH.stub]: 'amber', [HEALTH.down]: 'red',
  [KONGET.ok]: 'green', [KONGET.wrong]: 'red', [KONGET.noToken]: 'amber', [KONGET.manual]: 'violet',
  [KONGET.missing]: 'red', [KONGET.down]: 'gray',
  [CHANGE.same]: 'green', [CHANGE.changed]: 'blue', [CHANGE.check]: 'amber', [CHANGE.error]: 'red',
  [CHANGE.first]: 'violet', [CHANGE.noScenario]: 'gray',
  обычный: 'green', отложенный: 'blue', 'через контейнер': 'violet',
  Да: 'green', Нет: 'gray',
};

const HEALTH_LIST = Object.values(HEALTH);
const KONGET_LIST = Object.values(KONGET);
const CHANGE_LIST = Object.values(CHANGE);
const KIND_LIST = ['обычный', 'отложенный', 'через контейнер'];

// Колонка: заголовок, ширина в точках, вид (id, status, text, wrap, money, link, center) и список для выпадающего меню.
const col = (title, width, kind = 'text', list = null) => ({ title, width, kind, list });

// Что выгружаем: имя листа → { columns, rows }.
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
    const problems = [hs?.health && hs.health !== HEALTH.ok, ks?.konget && ks.konget !== KONGET.ok,
      us?.change && [CHANGE.error, CHANGE.check].includes(us.change)].filter(Boolean).length;
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
  // Дата проверки — в заголовке колонки статуса: «Статус на 2026-10-30».
  const on = (report) => (report?.checked_at ? `Статус на ${day(report.checked_at)}` : 'Статус');

  return {
    'Сводка': {
      columns: [
        col('ID', 44, 'id'), col('Компания', 190), col('Сайт', 170, 'link'), col('Бренд', 100), col('Ответственный', 150),
        col('Сайт работает', 160, 'status', HEALTH_LIST),
        col('Скрипт Конгет', 160, 'status', KONGET_LIST), col('Токен', 270),
        col('УТП', 160, 'status', CHANGE_LIST), col('Что изменилось', 340, 'wrap'),
        col('Комментарий', 340, 'wrap'),
      ],
      rows: summary,
    },
    'Работа сайтов': {
      columns: [
        col('ID', 44, 'id'), col('Сайт', 170, 'link'),
        col(on(health), 170, 'status', HEALTH_LIST), col('Код ответа', 90, 'center'), col('Открывался, с', 110, 'center'),
        col('Причина', 340, 'wrap'), col('Было', 150),
      ],
      rows: sites(health).map((s) => [s.id, s.site, s.health, s.code ?? '', s.load_seconds ?? '', s.reason || '', (s.was || '').replace('Было: ', '')]),
    },
    'Скрипт Конгет': {
      columns: [
        col('ID', 44, 'id'), col('Сайт', 170, 'link'),
        col(on(konget), 170, 'status', KONGET_LIST), col('Как стоит', 140, 'status', KIND_LIST), col('Токен на сайте', 270),
        col('Ожидаемый токен', 200), col('Откуда скрипт', 260, 'wrap'), col('Пояснение', 340, 'wrap'), col('Было', 150),
      ],
      rows: sites(konget).map((s) => [
        s.id, s.site, s.konget, s.kind || '', (s.tokens || []).join(', '), s.expected || '', s.where || '', s.reason || '',
        (s.was || '').replace('Было: ', ''),
      ]),
    },
    'УТП': {
      columns: [
        col('ID', 44, 'id'), col('Сайт', 170, 'link'), col('Бренд', 100),
        col('Модель', 150), col('Цена от', 120, 'money'), col('Выгода до', 120, 'money'),
        col(utp?.previous_date ? `${on(utp)} (было ${utp.previous_date})` : on(utp), 200, 'status', CHANGE_LIST), col('Страница', 280, 'wrap'),
      ],
      rows: sites(utp).flatMap((s) => (s.models?.length
        ? s.models.map((m) => [s.id, s.site, s.brand || '', m.model, num(m.price), num(m.max_benefit), s.change, m.source_url || ''])
        : [[s.id, s.site, s.brand || '', '', '', '', s.change, '']])),
    },
  };
}

// Значения листа: строка 1 — заголовки колонок, дальше данные.
export function sheetValues({ columns, rows }) {
  return [columns.map((c) => c.title), ...rows];
}

// Лист «Сайты» — список сайтов, по которому работают все проверки. Его заполняет человек,
// программа только читает (и один раз создаёт с заголовками, если листа ещё нет).
export const SITES_SHEET = 'Сайты';
const SITE_COLUMNS = [
  col('ID', 44, 'id'), col('Компания', 200), col('Сайт', 190, 'link'), col('Бренд', 110), col('Ответственный', 160),
  col('Проверять', 110, 'status', ['Да', 'Нет']), col('Токен Конгет', 280), col('Заметки', 260, 'wrap'),
];

export function sitesSheet(rows = []) {
  return { columns: SITE_COLUMNS, rows };
}

export const SITES_HEADER = SITE_COLUMNS.map((c) => c.title);

// Строки листа «Сайты» (со второй, под заголовками) → список сайтов для проверок.
// Пустые строки и строки без ID или адреса пропускаем; «Проверять: Нет» — сайт временно не проверяем.
export function parseSites(values) {
  const out = [];
  const seen = new Set();
  for (const r of values) {
    const id = Number(String(r[0] ?? '').trim());
    const site = String(r[2] ?? '').trim().replace(/\/+$/, '');
    if (!id || !site || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      company: String(r[1] ?? '').trim(),
      site,
      brand: String(r[3] ?? '').trim(),
      responsible: String(r[4] ?? '').trim(),
      active: String(r[5] ?? '').trim().toLowerCase() !== 'нет',
      konget_token: String(r[6] ?? '').trim(),
    });
  }
  return out;
}
