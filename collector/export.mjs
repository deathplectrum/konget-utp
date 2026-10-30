// Кнопка 4 «Выгрузить данные в таблицу».
// Берёт последние результаты трёх проверок и переписывает листы Google-таблицы:
// «Сводка», «Работа сайтов», «Скрипт Конгет», «УТП». Остальные листы таблицы не трогает.
//
// Оформление (цвета групп, узкая колонка ID, выпадающие списки, цвета статусов, фильтр)
// ставится заново при каждой выгрузке, поэтому таблица всегда выглядит одинаково.
//
// Нужны два секрета репозитория (Settings → Secrets and variables → Actions):
//   GOOGLE_SERVICE_ACCOUNT — JSON-ключ служебного аккаунта Google целиком;
//   SHEET_ID — ссылка на таблицу или её id. Таблицу надо открыть служебному аккаунту как редактору.

import crypto from 'node:crypto';
import path from 'node:path';
import { DATA, log, readJson } from './common.mjs';
import { TONE_OF, buildSheets, sheetValues } from './sheet.mjs';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

// Вход в Google от имени служебного аккаунта: подписываем запрос его ключом и получаем пропуск на час.
async function accessToken(account) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), account.private_key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  });
  if (!res.ok) throw new Error(`Google не пустил служебный аккаунт: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function api(token, url, body) {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 403 || res.status === 404) {
    throw new Error('Нет доступа к таблице. Откройте её служебному аккаунту (кнопка «Настройки доступа» → его адрес → Редактор)');
  }
  if (!res.ok) throw new Error(`Google ответил ошибкой ${res.status}: ${await res.text()}`);
  return res.json();
}

const hex = (h) => ({ red: parseInt(h.slice(1, 3), 16) / 255, green: parseInt(h.slice(3, 5), 16) / 255, blue: parseInt(h.slice(5, 7), 16) / 255 });

// Пары «фон / текст» для групп и статусов.
const TONES = {
  green: ['#d9f2e3', '#137333'],
  blue: ['#dbe8fd', '#1a56c4'],
  amber: ['#fdf0cc', '#8a5a00'],
  red: ['#fbdcdc', '#b3261e'],
  violet: ['#ece3fd', '#6b3fc6'],
  gray: ['#eceff1', '#546e7a'],
  indigo: ['#e8eaf6', '#3949ab'],
  teal: ['#e0f2f1', '#00796b'],
  orange: ['#fff3e0', '#c25100'],
};
const FONT = 'Roboto';
const MIN_ROWS = 200;

// Запросы оформления одного листа.
export function formatRequests(sheetId, spec, index, oldRules = 0) {
  const n = spec.columns.length;
  const rowCount = Math.max(MIN_ROWS, spec.rows.length + 50);
  const range = (r0, r1, c0, c1) => ({ sheetId, startRowIndex: r0, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 });
  const cell = (fmt, fields, r) => ({ repeatCell: { range: r, cell: { userEnteredFormat: fmt }, fields: `userEnteredFormat(${fields})` } });
  const req = [];

  req.push({
    updateSheetProperties: {
      properties: { sheetId, index, gridProperties: { rowCount, columnCount: n, frozenRowCount: 2, hideGridlines: true } },
      fields: 'index,gridProperties(rowCount,columnCount,frozenRowCount,hideGridlines)',
    },
  });
  req.push({ unmergeCells: { range: range(0, rowCount, 0, n) } });
  for (let i = 0; i < oldRules; i += 1) req.push({ deleteConditionalFormatRule: { sheetId, index: 0 } });
  req.push({ setBasicFilter: { filter: { range: range(1, rowCount, 0, n) } } });

  // Строка 1: цветные подписи групп колонок.
  let c = 0;
  for (const [, span, tone] of spec.groups) {
    const [bg, fg] = TONES[tone] || TONES.gray;
    if (span > 1) req.push({ mergeCells: { range: range(0, 1, c, c + span), mergeType: 'MERGE_ALL' } });
    req.push(cell({
      backgroundColor: hex(bg), verticalAlignment: 'MIDDLE', horizontalAlignment: 'LEFT', padding: { left: 8 },
      textFormat: { fontFamily: FONT, fontSize: 9, bold: true, foregroundColor: hex(fg) },
    }, 'backgroundColor,verticalAlignment,horizontalAlignment,padding,textFormat', range(0, 1, c, c + span)));
    c += span;
  }

  // Строка 2: заголовки колонок.
  req.push(cell({
    backgroundColor: hex('#ffffff'), verticalAlignment: 'MIDDLE', wrapStrategy: 'WRAP',
    textFormat: { fontFamily: FONT, fontSize: 10, bold: true, foregroundColor: hex('#1f2933') },
  }, 'backgroundColor,verticalAlignment,wrapStrategy,textFormat', range(1, 2, 0, n)));
  req.push({ updateBorders: { range: range(1, 2, 0, n), bottom: { style: 'SOLID_MEDIUM', color: hex('#9aa5b1') } } });

  // Данные: тонкие линии между строками, выравнивание по виду колонки.
  req.push(cell({
    backgroundColor: hex('#ffffff'), verticalAlignment: 'MIDDLE', wrapStrategy: 'CLIP', horizontalAlignment: 'LEFT',
    textFormat: { fontFamily: FONT, fontSize: 10, bold: false, foregroundColor: hex('#1f2933') }, numberFormat: { type: 'TEXT' },
  }, 'backgroundColor,verticalAlignment,wrapStrategy,horizontalAlignment,textFormat,numberFormat', range(2, rowCount, 0, n)));
  req.push({ updateBorders: { range: range(2, rowCount, 0, n), innerHorizontal: { style: 'SOLID', color: hex('#e4e7eb') } } });

  spec.columns.forEach((col, i) => {
    const data = range(2, rowCount, i, i + 1);
    req.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: col.width }, fields: 'pixelSize',
      },
    });
    if (col.kind === 'id') {
      req.push(cell({ horizontalAlignment: 'CENTER', numberFormat: { type: 'NUMBER', pattern: '0' }, textFormat: { fontFamily: FONT, fontSize: 10, bold: true, foregroundColor: hex('#52606d') } },
        'horizontalAlignment,numberFormat,textFormat', data));
    }
    if (col.kind === 'center') req.push(cell({ horizontalAlignment: 'CENTER', numberFormat: { type: 'NUMBER', pattern: '0.#' } }, 'horizontalAlignment,numberFormat', data));
    if (col.kind === 'money') req.push(cell({ horizontalAlignment: 'RIGHT', numberFormat: { type: 'NUMBER', pattern: '#,##0" ₽"' } }, 'horizontalAlignment,numberFormat', data));
    if (col.kind === 'wrap') req.push(cell({ wrapStrategy: 'WRAP' }, 'wrapStrategy', data));
    if (col.kind === 'link') req.push(cell({ textFormat: { fontFamily: FONT, fontSize: 10, bold: true, foregroundColor: hex('#1f2933') } }, 'textFormat', data));
    if (col.list) {
      req.push(cell({ horizontalAlignment: 'CENTER' }, 'horizontalAlignment', data));
      // Выпадающий список: можно выбрать статус вручную. strict: false — программа может писать и другие значения.
      req.push({
        setDataValidation: {
          range: data,
          rule: { condition: { type: 'ONE_OF_LIST', values: col.list.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true, strict: false },
        },
      });
      for (const value of col.list) {
        const [bg, fg] = TONES[TONE_OF[value]] || TONES.gray;
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
    }
  });

  req.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 26 }, fields: 'pixelSize' } });
  req.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 36 }, fields: 'pixelSize' } });
  req.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 2, endIndex: rowCount }, properties: { pixelSize: 30 }, fields: 'pixelSize' } });
  return req;
}

export function sheetIdFrom(value) {
  return String(value || '').match(/\/d\/([A-Za-z0-9_-]+)/)?.[1] || String(value || '').trim();
}

async function main() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT || !process.env.SHEET_ID) {
    throw new Error('Не заданы секреты GOOGLE_SERVICE_ACCOUNT и SHEET_ID (см. инструкцию в приложении, вкладка «Настройки»)');
  }
  const account = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  const id = sheetIdFrom(process.env.SHEET_ID);
  const sheets = buildSheets({
    health: readJson(path.join(DATA, 'health', 'latest.json')),
    konget: readJson(path.join(DATA, 'konget', 'latest.json')),
    utp: readJson(path.join(DATA, 'utp', 'latest.json')),
  });

  const token = await accessToken(account);
  const fields = 'properties.title,sheets(properties(sheetId,title),conditionalFormats(ranges))';
  let info = await api(token, `${SHEETS_API}/${id}?fields=${encodeURIComponent(fields)}`);
  const have = new Set(info.sheets.map((s) => s.properties.title));
  const missing = Object.keys(sheets).filter((t) => !have.has(t));
  if (missing.length) {
    await api(token, `${SHEETS_API}/${id}:batchUpdate`, {
      requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
    });
    info = await api(token, `${SHEETS_API}/${id}?fields=${encodeURIComponent(fields)}`);
  }
  const byTitle = new Map(info.sheets.map((s) => [s.properties.title, s]));
  const ranges = Object.keys(sheets).map((t) => `'${t}'`);
  await api(token, `${SHEETS_API}/${id}/values:batchClear`, { ranges });
  await api(token, `${SHEETS_API}/${id}:batchUpdate`, {
    requests: Object.entries(sheets).flatMap(([title, spec], i) => {
      const sheet = byTitle.get(title);
      return formatRequests(sheet.properties.sheetId, spec, i, sheet.conditionalFormats?.length || 0);
    }),
  });
  await api(token, `${SHEETS_API}/${id}/values:batchUpdate`, {
    valueInputOption: 'RAW',
    data: Object.entries(sheets).map(([title, spec]) => ({ range: `'${title}'!A1`, values: sheetValues(spec) })),
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
