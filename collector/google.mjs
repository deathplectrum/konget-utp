// Доступ к Google-таблице от имени служебного аккаунта. Нужны переменные (секреты репозитория)
// GOOGLE_SERVICE_ACCOUNT — JSON-ключ аккаунта целиком, SHEET_ID — ссылка на таблицу или её id.

import crypto from 'node:crypto';

export const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

// Вход в Google от имени служебного аккаунта: подписываем запрос его ключом и получаем пропуск на час.
export async function accessToken(account) {
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

export async function api(token, url, body) {
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

export function hasGoogle() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT && process.env.SHEET_ID);
}

// Вход в Google: пропуск и id таблицы.
export async function connect() {
  if (!hasGoogle()) {
    throw new Error('Не заданы секреты GOOGLE_SERVICE_ACCOUNT и SHEET_ID (см. инструкцию в приложении, вкладка «Настройки»)');
  }
  return { token: await accessToken(JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT)), id: sheetIdFrom(process.env.SHEET_ID) };
}

export async function readRange({ token, id }, range) {
  const res = await api(token, `${SHEETS_API}/${id}/values/${encodeURIComponent(range)}`);
  return res.values || [];
}
