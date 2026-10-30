// Кнопка 2 «Наличие скрипта Конгет». Запускается только кнопкой.
// Открывает сайт как обычный посетитель, ждёт, пока появятся отложенные скрипты, и ищет
// //app.konget.ru/inject?token=… в коде страницы и среди загруженных файлов.
// Если скрипта не видно, а на сайте есть контейнер тегов, пишет «Проверить вручную».
// Если в сценарии сайта указан konget_token, сверяет, что на сайте стоит именно он.
// Итог: data/konget/latest.json и data/konget/history/<дата>.json.
//
// У себя: npm run konget   (один сайт: npm run konget -- --site 1)

import { chromium } from 'playwright';
import { KONGET_ORDER, changedSince, countBy, kongetVerdict, sortBy } from './checks.mjs';
import { argValue, keepUnchecked, loadSites, log, runQueue, siteBase, siteUrl, store } from './common.mjs';

const PARALLEL = Number(process.env.PARALLEL) || 6;
const TIMEOUT = 30_000;
// Отложенный скрипт добавляется через N секунд после загрузки (обычно около 9 с),
// а из контейнера тегов — когда тот сработает. Ждём с запасом.
const SETTLE_MS = Number(process.env.SETTLE_MS) || 12_000;

async function checkSite(browser, site) {
  const context = await browser.newContext({ locale: 'ru-RU', viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const requests = [];
  page.on('request', (req) => requests.push(req.url()));
  try {
    const res = await page.goto(siteUrl(site), { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    // Код страницы, как его отдал сервер: по нему видно, обычный скрипт или отложенный.
    const html = await res?.text().catch(() => '') || '';
    await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS);
    // Плюс код страницы после загрузки: туда попадают скрипты, добавленные позже.
    const dom = await page.content().catch(() => '');
    return { html, dom, requests };
  } catch (e) {
    return { error: e.message.split('\n')[0] };
  } finally {
    await context.close();
  }
}

async function main() {
  const onlyId = argValue('--site');
  const sites = await loadSites(onlyId);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const db = store('konget');
  const prevById = new Map((db.previous(today)?.sites || []).map((s) => [String(s.id), s]));
  log(`Сайтов к проверке: ${sites.length}`);

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const results = [];
  let saved = false;
  const save = (stopped) => {
    if (saved) return;
    saved = true;
    const all = sortBy(KONGET_ORDER, 'konget')(onlyId || stopped ? keepUnchecked(db.latest(), results) : results);
    db.save({
      date: today,
      checked_at: now.toISOString(),
      total_seconds: Math.round((Date.now() - now.getTime()) / 1000),
      parallel: PARALLEL,
      ...(stopped ? { stopped: true, checked: results.length, planned: sites.length } : {}),
      summary: countBy(all, 'konget', KONGET_ORDER),
      sites: all,
    });
    log(stopped ? `Остановлено: проверено ${results.length} из ${sites.length}` : 'Готово', JSON.stringify(countBy(all, 'konget', KONGET_ORDER)));
  };

  await runQueue(sites, PARALLEL, async (site) => {
    const started = Date.now();
    const raw = await checkSite(browser, site);
    const res = {
      ...siteBase(site),
      ...kongetVerdict({ ...raw, expected: site.konget_token || '' }),
      expected: site.konget_token ? String(site.konget_token) : '',
      seconds: Math.round((Date.now() - started) / 1000),
    };
    res.was = changedSince(prevById.get(String(site.id)), res, 'konget');
    log(`[${site.id}] ${site.site}: ${res.konget}${res.kind ? ` (${res.kind})` : ''}${res.tokens.length ? ` ${res.tokens.join(', ')}` : ''}${res.reason ? ` (${res.reason})` : ''}`);
    results.push(res);
  }, () => save(true));
  await browser.close();
  save(false);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
