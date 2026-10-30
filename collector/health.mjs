// Кнопка 1 «Проверить работоспособность сайтов».
// Открывает главную страницу каждого сайта: открылась ли, код ответа, за сколько секунд,
// не заглушка ли вместо сайта. Итог: data/health/latest.json и data/health/history/<дата>.json.
//
// У себя: npm run health   (один сайт: npm run health -- --site 1)

import { chromium } from 'playwright';
import { HEALTH_ORDER, changedSince, countBy, healthVerdict, sortBy } from './checks.mjs';
import { argValue, keepUnchecked, loadScenarios, log, runQueue, siteBase, siteUrl, store } from './common.mjs';

const PARALLEL = Number(process.env.PARALLEL) || 6;
const TIMEOUT = 30_000;

async function checkSite(browser, site) {
  const context = await browser.newContext({ locale: 'ru-RU', viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const started = Date.now();
  try {
    const res = await page.goto(siteUrl(site), { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const seconds = (Date.now() - started) / 1000;
    await page.waitForLoadState('load', { timeout: 10_000 }).catch(() => {});
    const text = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
    return {
      status: res?.status() || 0, seconds, text, title: await page.title().catch(() => ''), final_url: page.url(),
    };
  } catch (e) {
    return { error: e.message.split('\n')[0], seconds: (Date.now() - started) / 1000 };
  } finally {
    await context.close();
  }
}

async function main() {
  const onlyId = argValue('--site');
  const sites = loadScenarios(onlyId);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const db = store('health');
  const prevById = new Map((db.previous(today)?.sites || []).map((s) => [String(s.id), s]));
  log(`Сайтов к проверке: ${sites.length}`);

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const results = [];
  let saved = false;
  const save = (stopped) => {
    if (saved) return;
    saved = true;
    const all = sortBy(HEALTH_ORDER, 'health')(onlyId || stopped ? keepUnchecked(db.latest(), results) : results);
    db.save({
      date: today,
      checked_at: now.toISOString(),
      total_seconds: Math.round((Date.now() - now.getTime()) / 1000),
      parallel: PARALLEL,
      ...(stopped ? { stopped: true, checked: results.length, planned: sites.length } : {}),
      summary: countBy(all, 'health', HEALTH_ORDER),
      sites: all,
    });
    log(stopped ? `Остановлено: проверено ${results.length} из ${sites.length}` : 'Готово', JSON.stringify(countBy(all, 'health', HEALTH_ORDER)));
  };

  await runQueue(sites, PARALLEL, async (site) => {
    const started = Date.now();
    const raw = await checkSite(browser, site);
    const verdict = healthVerdict(raw);
    const res = {
      ...siteBase(site),
      ...verdict,
      code: raw.status || null,
      load_seconds: Math.round(raw.seconds * 10) / 10,
      final_url: raw.final_url || '',
      title: (raw.title || '').slice(0, 120),
      seconds: Math.round((Date.now() - started) / 1000),
    };
    res.was = changedSince(prevById.get(String(site.id)), res, 'health');
    log(`[${site.id}] ${site.site}: ${res.health}${res.reason ? ` (${res.reason})` : ''}`);
    results.push(res);
  }, () => save(true));
  await browser.close();
  save(false);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
