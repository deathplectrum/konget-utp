// Разово: стереть значения, которые выгрузка записала в таблицу (со второй строки).
// Оформление, списки и лист «Сайты» не трогаем.
import { SHEETS_API, api, connect } from './google.mjs';

const { token, id } = await connect();
const ranges = ['Сводка', 'Работа сайтов', 'Скрипт Конгет', 'УТП'].map((t) => `'${t}'!A2:Z`);
await api(token, `${SHEETS_API}/${id}/values:batchClear`, { ranges });
console.log('Стёрто:', ranges.join(', '));
