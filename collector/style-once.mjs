// Разовая правка оформления: убрать старые правила условного форматирования, которые ставила
// прошлая версия выгрузки, и сделать все строки высотой 18 точек. Кнопки приложения её не запускают.
import { SHEETS_API, api, connect } from './google.mjs';

const SHEETS = ['Сайты', 'Сводка', 'Работа сайтов', 'Скрипт Конгет', 'УТП'];
const { token, id } = await connect();
const info = await api(token, `${SHEETS_API}/${id}?fields=${encodeURIComponent('sheets(properties(sheetId,title,gridProperties.rowCount),conditionalFormats(ranges))')}`);
const requests = [];
for (const s of info.sheets) {
  if (!SHEETS.includes(s.properties.title)) continue;
  const sheetId = s.properties.sheetId;
  for (let i = 0; i < (s.conditionalFormats || []).length; i += 1) requests.push({ deleteConditionalFormatRule: { sheetId, index: 0 } });
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: s.properties.gridProperties.rowCount }, properties: { pixelSize: 18 }, fields: 'pixelSize',
    },
  });
  console.log(`«${s.properties.title}»: правил ${(s.conditionalFormats || []).length}, строк ${s.properties.gridProperties.rowCount}`);
}
await api(token, `${SHEETS_API}/${id}:batchUpdate`, { requests });
console.log('Готово');
