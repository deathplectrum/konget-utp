// Кнопка 4 «Выгрузить данные в таблицу».
// Берёт последние результаты трёх проверок и пишет их в листы Google-таблицы:
// «Сводка», «Работа сайтов», «Скрипт Конгет», «УТП».
//
// Таблицу оформляет человек: листы, заголовки, ширину колонок, выпадающие списки, цвета,
// условное форматирование. Программа ничего из этого не меняет. Она находит свои колонки
// по заголовкам в строке 1, стирает в них старые значения со второй строки и пишет новые,
// выбирая статусы из выпадающего списка колонки. Лист «Сайты» только читается (в common.mjs).
//
// Нужны два секрета репозитория (Settings → Secrets and variables → Actions):
//   GOOGLE_SERVICE_ACCOUNT — JSON-ключ служебного аккаунта Google целиком;
//   SHEET_ID — ссылка на таблицу или её id. Таблицу надо открыть служебному аккаунту как редактору.

import path from 'node:path';
import { DATA, log, readJson } from './common.mjs';
import { SHEETS_API, api, connect } from './google.mjs';
import { buildSheets, placeColumns } from './sheet.mjs';

// 0 → A, 25 → Z, 26 → AA.
export function letter(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

async function main() {
  const { token, id } = await connect();
  const sheets = buildSheets({
    health: readJson(path.join(DATA, 'health', 'latest.json')),
    konget: readJson(path.join(DATA, 'konget', 'latest.json')),
    utp: readJson(path.join(DATA, 'utp', 'latest.json')),
  });

  // Только читаем: какие листы есть, заголовки (строка 1) и выпадающие списки (строка 2).
  const info = await api(token, `${SHEETS_API}/${id}?fields=${encodeURIComponent('properties.title,sheets.properties(title,gridProperties.rowCount)')}`);
  const rowCount = new Map(info.sheets.map((s) => [s.properties.title, s.properties.gridProperties?.rowCount || 0]));
  const titles = Object.keys(sheets).filter((t) => {
    if (!rowCount.has(t)) log(`Листа «${t}» в таблице нет, пропускаю`);
    return rowCount.has(t);
  });
  if (!titles.length) throw new Error('В таблице нет ни одного листа для выгрузки');

  const ranges = titles.map((t) => `'${t}'!1:2`);
  const fields = 'sheets(properties.title,data(rowData.values(formattedValue,dataValidation.condition.values)))';
  const grid = await api(token, `${SHEETS_API}/${id}?${ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&')}&fields=${encodeURIComponent(fields)}`);

  const clear = [];
  const data = [];
  for (const sheet of grid.sheets || []) {
    const title = sheet.properties.title;
    const rows = sheet.data?.[0]?.rowData || [];
    const headers = (rows[0]?.values || []).map((c) => c.formattedValue || '');
    const lists = (rows[1]?.values || []).map((c) => (c.dataValidation?.condition?.values || []).map((v) => v.userEnteredValue));
    const spec = sheets[title];
    const { placed, missing, unknown } = placeColumns(spec, headers, lists);
    if (missing.length) log(`«${title}»: нет колонок ${missing.map((m) => `«${m}»`).join(', ')}, их пропускаю`);
    if (unknown.length) log(`«${title}»: значений нет в выпадающем списке: ${unknown.join('; ')}`);
    const fit = Math.max(0, rowCount.get(title) - 1);
    if (spec.rows.length > fit) log(`«${title}»: строк ${spec.rows.length}, а в листе места на ${fit}. Добавьте строки в таблице`);
    for (const { index, values } of placed) {
      const c = letter(index);
      clear.push(`'${title}'!${c}2:${c}`);
      if (values.length && fit) data.push({ range: `'${title}'!${c}2:${c}${Math.min(values.length, fit) + 1}`, majorDimension: 'COLUMNS', values: [values.slice(0, fit)] });
    }
    log(`«${title}»: строк ${spec.rows.length}, колонок ${placed.length}`);
  }

  // Меняются только значения ячеек: оформление, списки и правила цветов остаются как были.
  if (clear.length) await api(token, `${SHEETS_API}/${id}/values:batchClear`, { ranges: clear });
  if (data.length) await api(token, `${SHEETS_API}/${id}/values:batchUpdate`, { valueInputOption: 'RAW', data });
  log(`Готово: таблица «${info.properties.title}» обновлена`);
}

if (process.argv[1] === import.meta.filename) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
