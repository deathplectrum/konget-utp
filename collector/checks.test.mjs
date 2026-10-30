import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HEALTH, KONGET, detectEngine, findTokens, healthVerdict, kongetVerdict,
} from './checks.mjs';
import { buildSheets, parseSites, placeColumns, sheetValues } from './sheet.mjs';
import { letter } from './export.mjs';
import { sheetIdFrom } from './google.mjs';
import { host } from './common.mjs';

const LIVE = 'Официальный дилер. Модели, цены, тест-драйв, кредит, трейд-ин, сервис и запчасти. '.repeat(3);

test('сайт работает, медленный, сломан или заглушка', () => {
  assert.equal(healthVerdict({ status: 200, seconds: 2, text: LIVE }).health, HEALTH.ok);
  assert.equal(healthVerdict({ status: 200, seconds: 14, text: LIVE }).health, HEALTH.slow);
  assert.equal(healthVerdict({ status: 503, seconds: 1, text: LIVE }).health, HEALTH.down);
  assert.equal(healthVerdict({ error: 'net::ERR_NAME_NOT_RESOLVED' }).health, HEALTH.down);
  assert.equal(healthVerdict({ status: 200, seconds: 1, text: '' }).health, HEALTH.stub);
  assert.equal(healthVerdict({ status: 200, seconds: 1, text: `Сайт находится в разработке. ${LIVE}` }).health, HEALTH.stub);
  assert.equal(healthVerdict({ status: 200, seconds: 1, title: 'Домен example.ru продаётся', text: LIVE }).health, HEALTH.stub);
});

test('токен Конгет в разных записях', () => {
  assert.deepEqual(findTokens('//app.konget.ru/inject?token=538e1215043c412b9cfcff11319094a9'), ['538e1215043c412b9cfcff11319094a9']);
  assert.deepEqual(findTokens('https://app.konget.ru/widget.js?injectToken=1234567890'), ['1234567890']);
  assert.deepEqual(findTokens('window.konget = { inject_token: "abc123def456" }'), ['abc123def456']);
  assert.deepEqual(findTokens('нет токена'), []);
});

const NORMAL = '<html><head><script async src="//app.konget.ru/inject?token=538e1215043c412b9cfcff11319094a9"></script></head></html>';
const DELAYED = `<script>
setTimeout(() => {
var injectNode = document.createElement('script');
injectNode.src = 'https://app.konget.ru/inject?token=0a0afb6279544778af6346554dafb6f5';
injectNode.async = true;
document.body.appendChild(injectNode);
}, 9000);
</script>`;
const GTM = '<script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC123"></script>';

test('итог проверки скрипта Конгет', () => {
  const normal = kongetVerdict({ html: NORMAL });
  assert.equal(normal.konget, KONGET.ok);
  assert.equal(normal.kind, 'обычный');
  assert.deepEqual(normal.tokens, ['538e1215043c412b9cfcff11319094a9']);

  const delayed = kongetVerdict({
    html: DELAYED,
    dom: `${DELAYED}<script src="https://app.konget.ru/inject?token=0a0afb6279544778af6346554dafb6f5"></script>`,
    requests: ['https://app.konget.ru/inject?token=0a0afb6279544778af6346554dafb6f5'],
  });
  assert.equal(delayed.konget, KONGET.ok);
  assert.equal(delayed.kind, 'отложенный');
  assert.deepEqual(delayed.tokens, ['0a0afb6279544778af6346554dafb6f5']);

  const viaGtm = kongetVerdict({ html: GTM, requests: ['https://app.konget.ru/inject?token=1111aaaa2222bbbb'] });
  assert.equal(viaGtm.konget, KONGET.ok);
  assert.equal(viaGtm.kind, 'через контейнер');

  assert.equal(kongetVerdict({ html: GTM }).konget, KONGET.manual);
  assert.equal(kongetVerdict({ html: '<html>дилер</html>' }).konget, KONGET.missing);
  assert.equal(kongetVerdict({ html: '<script src="//app.konget.ru/inject"></script>' }).konget, KONGET.noToken);
  assert.equal(kongetVerdict({ html: NORMAL, expected: '538e1215043c412b9cfcff11319094a9' }).konget, KONGET.ok);
  assert.equal(kongetVerdict({ html: NORMAL, expected: '111' }).konget, KONGET.wrong);
  assert.equal(kongetVerdict({ error: 'Timeout' }).konget, KONGET.down);
});

test('листы таблицы: сводка по сайтам, проблемные сверху', () => {
  const base = { company: 'ООО Авто', brand: 'Tenet' };
  const sheets = buildSheets({
    health: { checked_at: '2026-10-30T07:00:00Z', sites: [{ id: 1, site: 'a.ru', ...base, health: 'Работает' }, { id: 2, site: 'b.ru', ...base, health: 'Не работает', reason: 'Таймаут' }] },
    konget: { checked_at: '2026-10-27T04:00:00Z', sites: [{ id: 1, site: 'a.ru', ...base, konget: 'Скрипт есть', tokens: ['123456'] }] },
    utp: {
      checked_at: '2026-10-29T07:00:00Z',
      sites: [{ id: 1, site: 'a.ru', ...base, change: 'Изменилось', changes: ['T8: цена'], models: [{ model: 'T8', price: 2899000, max_benefit: '-' }] }],
    },
  });
  assert.deepEqual(Object.keys(sheets), ['Сводка', 'Работа сайтов', 'Скрипт Конгет', 'УТП']);
  const rows = (name) => sheetValues(sheets[name]);
  assert.equal(rows('Сводка')[0][0], 'ID');
  assert.equal(rows('Сводка')[1][2], 'b.ru');
  assert.deepEqual(rows('Сводка')[2].slice(5, 10), ['Работает', 'Скрипт есть', 'Да', 'Изменилось', 'T8: цена']);
  assert.ok(!JSON.stringify(sheets).includes('123456'), 'сам токен в таблицу не пишем');
  assert.deepEqual(rows('УТП')[1].slice(1, 7), ['a.ru', 'Tenet', 'Изменилось', 'Да', 'T8: цена', 1]);
  assert.equal(rows('УТП').length, 2, 'одна строка — один сайт');
  assert.equal(rows('Скрипт Конгет')[0][2], 'Статус');
  for (const spec of Object.values(sheets)) assert.ok(spec.rows.every((r) => r.length === spec.columns.length));
});

test('выгрузка пишет в колонки человека по заголовкам и выбирает значения из его списков', () => {
  const spec = {
    columns: [{ title: 'ID' }, { title: 'Сайт' }, { title: 'Статус' }, { title: 'Изменения' }, { title: 'Пояснение' }],
    rows: [[1, 'a.ru', 'Токен не тот', 'Да', 'x'], [2, 'b.ru', 'Скрипт есть', 'Нет', '']],
  };
  const headers = ['ID', 'Сайт', 'Своя колонка', 'Статус на 2026-10-29', 'Изменения есть'];
  const lists = [[], [], [], ['Скрипт есть', 'Проверить вручную', 'Скрипта нет'], ['Да', 'Нет']];
  const { placed, missing, unknown } = placeColumns(spec, headers, lists);
  assert.deepEqual(placed.map((p) => p.index), [0, 1, 3, 4]);
  assert.deepEqual(placed[2].values, ['Проверить вручную', 'Скрипт есть']);
  assert.deepEqual(missing, ['Пояснение']);
  assert.deepEqual(unknown, []);
  assert.deepEqual(placeColumns({ columns: [{ title: 'Статус' }], rows: [['Новое']] }, ['Статус'], [['А']]).unknown, ['Статус: Новое']);
  assert.deepEqual([0, 25, 26, 27].map(letter), ['A', 'Z', 'AA', 'AB']);
});

test('движок сайта', () => {
  assert.equal(detectEngine('<div class="perxis-auto-1_27_0-col">'), 'Perxis');
  assert.equal(detectEngine('<script src="/bitrix/js/main/core.js">'), '1С-Битрикс');
  assert.equal(detectEngine('<link href="https://static.tildacdn.com/css/tilda-grid.css">'), 'Tilda');
  assert.equal(detectEngine('<meta name="generator" content="UMI.CMS">'), 'UMI.CMS');
  assert.equal(detectEngine('<html>просто сайт</html>'), 'Не определён');
  assert.equal(detectEngine('<img src="https://img.perxis.ru/unsafe/1920x0/filters">'), 'Perxis');
});

test('id таблицы из ссылки', () => {
  assert.equal(sheetIdFrom('https://docs.google.com/spreadsheets/d/1AbC-dEf_123/edit#gid=0'), '1AbC-dEf_123');
  assert.equal(sheetIdFrom(' 1AbC-dEf_123 '), '1AbC-dEf_123');
});

test('лист «Сайты»: читаем строки, пропускаем пустые и выключенные помечаем', () => {
  const sites = parseSites([
    ['ID', 'Компания', 'Сайт', 'Бренд', 'Ответственный', 'Проверять', 'Токен Конгет'],
    ['101', 'ООО Авто', 'https://dealer.ru/', 'Tenet', 'Иван', 'Да', '538e1215043c412b9cfcff11319094a9'],
    ['', 'без id', 'x.ru'],
    ['102', 'Без адреса', ''],
    ['103', 'Выкл', 'off.ru', 'KGM', '', 'Нет'],
    ['104', 'Коротко', 'short.ru'],
    ['101', 'Дубль', 'dup.ru'],
  ]);
  assert.deepEqual(sites.map((s) => s.id), [101, 103, 104]);
  assert.equal(sites[0].site, 'https://dealer.ru');
  assert.equal(sites[0].konget_token, '538e1215043c412b9cfcff11319094a9');
  assert.equal(sites[1].active, false);
  assert.equal(sites[2].active, true);
  // Колонку «Токен Конгет» удалили, «None» — то же, что пусто.
  const [short] = parseSites([['ID', 'Компания', 'Сайт', 'Проверять', 'Заметки'], ['7', 'None', 'x.ru', 'Да', 'заметка']]);
  assert.deepEqual([short.company, short.konget_token, short.active], ['', '', true]);
});

test('сценарий подходит к сайту из таблицы, только если адрес тот же', () => {
  assert.equal(host('https://www.Tenet.ru/models/'), 'tenet.ru');
  assert.equal(host('tenet.ru'), host('http://tenet.ru'));
  assert.notEqual(host('tenet.ru'), host('tenet-avtoruss.ru'));
});
