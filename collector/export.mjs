// Кнопка 4 «Выгрузить данные в таблицу».
// Берёт последние результаты трёх проверок и переписывает листы Google-таблицы:
// «Сводка», «Работа сайтов», «Скрипт Конгет», «УТП». Остальные листы таблицы не трогает.
//
// Нужны два секрета репозитория (Settings → Secrets and variables → Actions):
//   GOOGLE_SERVICE_ACCOUNT — JSON-ключ служебного аккаунта Google целиком;
//   SHEET_ID — ссылка на таблицу или её id. Таблицу надо открыть служебному аккаунту как редактору.

import crypto from 'node:crypto';
import path from 'node:path';
import { DATA, log, readJson } from './common.mjs';
import { buildSheets } from './sheet.mjs';

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
  const info = await api(token, `${SHEETS_API}/${id}?fields=properties.title,sheets.properties.title`);
  const have = new Set(info.sheets.map((s) => s.properties.title));
  const missing = Object.keys(sheets).filter((t) => !have.has(t));
  if (missing.length) {
    await api(token, `${SHEETS_API}/${id}:batchUpdate`, {
      requests: missing.map((title) => ({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } })),
    });
  }
  const ranges = Object.keys(sheets).map((t) => `'${t}'`);
  await api(token, `${SHEETS_API}/${id}/values:batchClear`, { ranges });
  await api(token, `${SHEETS_API}/${id}/values:batchUpdate`, {
    valueInputOption: 'RAW',
    data: Object.entries(sheets).map(([title, values]) => ({ range: `'${title}'!A1`, values })),
  });
  for (const [title, rows] of Object.entries(sheets)) log(`«${title}»: строк ${rows.length}`);
  log(`Готово: таблица «${info.properties.title}» обновлена`);
}

if (process.argv[1] === import.meta.filename) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
