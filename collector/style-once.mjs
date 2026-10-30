// Разовая покраска шапок листов в гамме шаблона «Лист1 (копия)». Кнопки приложения её не запускают.
import { SHEETS_API, api, connect } from './google.mjs';

const P = [['#eef7ff', '#666666'], ['#dcefff', '#434343'], ['#c2e2ff', '#434343'], ['#93c9fb', '#434343'], ['#2890dc', '#efefef'], ['#0269a4', '#f3f3f3']];
const hex = (h) => ({ red: parseInt(h.slice(1, 3), 16) / 255, green: parseInt(h.slice(3, 5), 16) / 255, blue: parseInt(h.slice(5, 7), 16) / 255 });
// Лист → [первая колонка, последняя колонка, оттенок].
const PLAN = {
  'Сайты': [[0, 1, 0], [2, 3, 1], [4, 4, 2], [5, 5, 3], [6, 6, 4], [7, 7, 5]],
  'Сводка': [[0, 1, 0], [2, 4, 1], [5, 5, 2], [6, 7, 3], [8, 9, 4], [10, 10, 5]],
  'Работа сайтов': [[0, 1, 0], [2, 2, 2], [3, 4, 3], [5, 5, 4], [6, 6, 5]],
  'Скрипт Конгет': [[0, 1, 0], [2, 2, 2], [3, 4, 3], [5, 5, 4], [6, 6, 5]],
  'УТП': [[0, 1, 0], [2, 2, 1], [3, 3, 2], [4, 5, 3], [6, 6, 4], [7, 7, 5]],
};

const { token, id } = await connect();
const info = await api(token, `${SHEETS_API}/${id}?fields=sheets.properties(sheetId,title)`);
const requests = [];
for (const s of info.sheets) {
  for (const [c0, c1, i] of PLAN[s.properties.title] || []) {
    const [bg, fg] = P[i];
    requests.push({
      repeatCell: {
        range: { sheetId: s.properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: c0, endColumnIndex: c1 + 1 },
        cell: { userEnteredFormat: { backgroundColorStyle: { rgbColor: hex(bg) }, textFormat: { foregroundColorStyle: { rgbColor: hex(fg) } } } },
        fields: 'userEnteredFormat.backgroundColorStyle,userEnteredFormat.textFormat.foregroundColorStyle',
      },
    });
  }
}
await api(token, `${SHEETS_API}/${id}:batchUpdate`, { requests });
console.log(`Покрашено блоков: ${requests.length}`);
