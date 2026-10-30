// Кнопка 4 «Выгрузить данные в таблицу».
// Берёт последние результаты трёх проверок и переписывает листы Google-таблицы:
// «Сводка», «Работа сайтов», «Скрипт Конгет», «УТП». Лист «Сайты» (список сайтов для проверок)
// заполняет человек: здесь он только оформляется, а создаётся, если его ещё нет.
//
// Оформление (цвета групп, узкая колонка ID, выпадающие списки, цвета статусов, фильтр)
// ставится заново при каждой выгрузке, поэтому таблица всегда выглядит одинаково.
//
// Нужны два секрета репозитория (Settings → Secrets and variables → Actions):
//   GOOGLE_SERVICE_ACCOUNT — JSON-ключ служебного аккаунта Google целиком;
//   SHEET_ID — ссылка на таблицу или её id. Таблицу надо открыть служебному аккаунту как редактору.

import path from 'node:path';
import { DATA, loadScenarios, log, readJson } from './common.mjs';
import { SHEETS_API, api, connect, readRange } from './google.mjs';
import {
  SITES_HEADER, SITES_SHEET, TONE_OF, buildSheets, sheetValues, sitesSheet,
} from './sheet.mjs';

const hex = (h) => ({ red: parseInt(h.slice(1, 3), 16) / 255, green: parseInt(h.slice(3, 5), 16) / 255, blue: parseInt(h.slice(5, 7), 16) / 255 });

// Один спокойный сине-бирюзовый стиль, без ярких цветов: голубая строка заголовков с фильтрами,
// статусы — плашками. Всё хорошо — бирюзовая, нужно посмотреть — голубая, нет данных — серая.
const HEAD = ['#cfe2f3', '#0b3b60'];
const HEAD_LINE = '#9fc5e8';
const STATUS_STYLE = {
  calm: ['#d5eeec', '#0e5e58'],
  attention: ['#dbe7f7', '#1c4587'],
  muted: ['#eef1f4', '#6b7785'],
};
const FONT = 'Arial';
const MIN_ROWS = 200;

// Запросы оформления одного листа.
export function formatRequests(sheetId, spec, index, oldRules = 0, { input = false } = {}) {
  const n = spec.columns.length;
  const rowCount = Math.max(MIN_ROWS, spec.rows.length + 50);
  const range = (r0, r1, c0, c1) => ({ sheetId, startRowIndex: r0, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 });
  const cell = (fmt, fields, r) => ({ repeatCell: { range: r, cell: { userEnteredFormat: fmt }, fields: `userEnteredFormat(${fields})` } });
  const req = [];

  req.push({
    updateSheetProperties: {
      // Лист «Сайты» заполняет человек: лишние колонки там не удаляем.
      properties: { sheetId, index, gridProperties: { rowCount, ...(input ? {} : { columnCount: n }), frozenRowCount: 1, hideGridlines: false } },
      fields: `index,gridProperties(rowCount,${input ? '' : 'columnCount,'}frozenRowCount,hideGridlines)`,
    },
  });
  // Убираем следы прошлого оформления: объединённые ячейки, рамки, старые цвета статусов.
  req.push({ unmergeCells: { range: range(0, rowCount, 0, n) } });
  req.push({ updateBorders: { range: range(0, rowCount, 0, n), top: { style: 'NONE' }, bottom: { style: 'NONE' }, left: { style: 'NONE' }, right: { style: 'NONE' }, innerHorizontal: { style: 'NONE' }, innerVertical: { style: 'NONE' } } });
  for (let i = 0; i < oldRules; i += 1) req.push({ deleteConditionalFormatRule: { sheetId, index: 0 } });
  req.push({ setBasicFilter: { filter: { range: range(0, rowCount, 0, n) } } });

  // Заголовки.
  req.push(cell({
    backgroundColor: hex(HEAD[0]), verticalAlignment: 'MIDDLE', horizontalAlignment: 'LEFT', wrapStrategy: 'CLIP',
    textFormat: { fontFamily: FONT, fontSize: 10, bold: true, foregroundColor: hex(HEAD[1]) },
  }, 'backgroundColor,verticalAlignment,horizontalAlignment,wrapStrategy,textFormat', range(0, 1, 0, n)));
  req.push({ updateBorders: { range: range(0, 1, 0, n), bottom: { style: 'SOLID_MEDIUM', color: hex(HEAD_LINE) } } });

  // Данные.
  req.push(cell({
    backgroundColor: hex('#ffffff'), verticalAlignment: 'MIDDLE', wrapStrategy: 'CLIP', horizontalAlignment: 'LEFT',
    textFormat: { fontFamily: FONT, fontSize: 10, bold: false, foregroundColor: hex('#1e1e1e') }, numberFormat: { type: 'TEXT' },
  }, 'backgroundColor,verticalAlignment,wrapStrategy,horizontalAlignment,textFormat,numberFormat', range(1, rowCount, 0, n)));

  spec.columns.forEach((col, i) => {
    const data = range(1, rowCount, i, i + 1);
    req.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: col.width }, fields: 'pixelSize',
      },
    });
    if (col.kind === 'id') req.push(cell({ horizontalAlignment: 'RIGHT', numberFormat: { type: 'NUMBER', pattern: '0' } }, 'horizontalAlignment,numberFormat', data));
    if (col.kind === 'center') req.push(cell({ horizontalAlignment: 'CENTER', numberFormat: { type: 'NUMBER', pattern: 'General' } }, 'horizontalAlignment,numberFormat', data));
    if (col.kind === 'money') req.push(cell({ horizontalAlignment: 'RIGHT', numberFormat: { type: 'NUMBER', pattern: '#,##0" ₽"' } }, 'horizontalAlignment,numberFormat', data));
    if (col.kind === 'wrap') req.push(cell({ wrapStrategy: 'WRAP' }, 'wrapStrategy', data));
    if (col.list) {
      // Выпадающий список: можно выбрать значение вручную. strict: false — программа может писать и другие значения.
      req.push({
        setDataValidation: {
          range: data,
          rule: { condition: { type: 'ONE_OF_LIST', values: col.list.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true, strict: false },
        },
      });
      for (const value of col.list) {
        const [bg, fg] = STATUS_STYLE[(col.tones || TONE_OF)[value] || 'muted'];
        req.push({
          addConditionalFormatRule: {
            rule: {
              ranges: [data],
              booleanRule: {
                condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: value }] },
                format: { backgroundColor: hex(bg), textFormat: { foregroundColor: hex(fg), bold: true } },
              },
            },
            index: 0,
          },
        });
      }
    } else {
      // Раньше тут мог быть выпадающий список: снимаем его.
      req.push({ setDataValidation: { range: data } });
    }
  });

  req.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: rowCount }, properties: { pixelSize: 24 }, fields: 'pixelSize' } });
  req.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 32 }, fields: 'pixelSize' } });
  return req;
}

// Старый лист из первой версии таблицы, его заменили «Сводка» и остальные листы.
const LEGACY = ['Проверка'];

async function main() {
  const conn = await connect();
  const { token, id } = conn;
  const sheets = buildSheets({
    health: readJson(path.join(DATA, 'health', 'latest.json')),
    konget: readJson(path.join(DATA, 'konget', 'latest.json')),
    utp: readJson(path.join(DATA, 'utp', 'latest.json')),
  });

  const fields = 'properties.title,sheets(properties(sheetId,title),conditionalFormats(ranges))';
  const load = () => api(token, `${SHEETS_API}/${id}?fields=${encodeURIComponent(fields)}`);
  let info = await load();
  const have = new Set(info.sheets.map((s) => s.properties.title));
  const missing = [SITES_SHEET, ...Object.keys(sheets)].filter((t) => !have.has(t));
  const legacy = info.sheets.filter((s) => LEGACY.includes(s.properties.title));
  if (missing.length || legacy.length) {
    await api(token, `${SHEETS_API}/${id}:batchUpdate`, {
      requests: [
        ...missing.map((title) => ({ addSheet: { properties: { title } } })),
        ...legacy.map((s) => ({ deleteSheet: { sheetId: s.properties.sheetId } })),
      ],
    });
    info = await load();
  }
  const byTitle = new Map(info.sheets.map((s) => [s.properties.title, s]));

  // Лист «Сайты»: если он новый или старого вида, ставим заголовки и переносим сайты из сценариев.
  // Если он уже нашего вида — данные не трогаем, только оформление.
  const current = await readRange(conn, `'${SITES_SHEET}'!A1:H`);
  const ours = SITES_HEADER.every((h, i) => String(current[0]?.[i] ?? '').trim() === h);
  let siteRows = current.slice(1);
  if (!ours) {
    siteRows = loadScenarios().filter((sc) => sc.site).sort((a, b) => a.id - b.id)
      .map((sc) => [sc.id, sc.company || '', sc.site, sc.brand || '', sc.responsible || '', sc.active === false ? 'Нет' : 'Да', sc.konget_token || '', '']);
    await api(token, `${SHEETS_API}/${id}/values:batchClear`, { ranges: [`'${SITES_SHEET}'`] });
    log(`Лист «${SITES_SHEET}» создан заново: сайтов ${siteRows.length}`);
  }
  const sitesSpec = sitesSheet(siteRows);

  await api(token, `${SHEETS_API}/${id}/values:batchClear`, { ranges: Object.keys(sheets).map((t) => `'${t}'`) });
  const sitesInfo = byTitle.get(SITES_SHEET);
  await api(token, `${SHEETS_API}/${id}:batchUpdate`, {
    requests: [
      ...formatRequests(sitesInfo.properties.sheetId, sitesSpec, 0, sitesInfo.conditionalFormats?.length || 0, { input: true }),
      ...Object.entries(sheets).flatMap(([title, spec], i) => {
        const sheet = byTitle.get(title);
        return formatRequests(sheet.properties.sheetId, spec, i + 1, sheet.conditionalFormats?.length || 0);
      }),
    ],
  });
  await api(token, `${SHEETS_API}/${id}/values:batchUpdate`, {
    valueInputOption: 'RAW',
    data: [
      ...(ours ? [{ range: `'${SITES_SHEET}'!A1`, values: sheetValues({ ...sitesSpec, rows: [] }) }] : [{ range: `'${SITES_SHEET}'!A1`, values: sheetValues(sitesSpec) }]),
      ...Object.entries(sheets).map(([title, spec]) => ({ range: `'${title}'!A1`, values: sheetValues(spec) })),
    ],
  });
  for (const [title, spec] of Object.entries(sheets)) log(`«${title}»: строк ${spec.rows.length}`);
  log(`Готово: таблица «${info.properties.title}» обновлена`);
}

if (process.argv[1] === import.meta.filename) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
