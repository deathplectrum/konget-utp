import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEALTH, KONGET, findTokens, healthVerdict, kongetVerdict } from './checks.mjs';
import { buildSheets, parseSites, sheetValues, sitesSheet, SITES_HEADER } from './sheet.mjs';
import { sheetIdFrom } from './google.mjs';

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
  assert.equal(rows('Сводка')[0][0], 'САЙТ');
  assert.equal(rows('Сводка')[0].length, rows('Сводка')[1].length);
  assert.equal(rows('Сводка')[2][2], 'b.ru');
  assert.deepEqual(rows('Сводка')[3].slice(5, 10), ['Работает', 'Скрипт есть', '123456', 'Изменилось', 'T8: цена']);
  assert.deepEqual(rows('УТП')[2].slice(3, 6), ['T8', 2899000, '']);
  assert.equal(rows('Скрипт Конгет')[0][2], 'ПРОВЕРКА ОТ 2026-10-27');
  for (const spec of Object.values(sheets)) {
    assert.equal(spec.groups.reduce((a, g) => a + g[1], 0), spec.columns.length);
    assert.ok(spec.rows.every((r) => r.length === spec.columns.length));
  }
});

test('id таблицы из ссылки', () => {
  assert.equal(sheetIdFrom('https://docs.google.com/spreadsheets/d/1AbC-dEf_123/edit#gid=0'), '1AbC-dEf_123');
  assert.equal(sheetIdFrom(' 1AbC-dEf_123 '), '1AbC-dEf_123');
});

test('лист «Сайты»: читаем строки, пропускаем пустые и выключенные помечаем', () => {
  const sites = parseSites([
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
  const values = sheetValues(sitesSheet([]));
  assert.deepEqual(values[1], SITES_HEADER);
  assert.equal(values[0].length, values[1].length);
});
