// Кнопка 3 «Сверить УТП». Запускается на GitHub (Actions) по кнопке в приложении
// или у себя командой: npm run collect   (один сайт: npm run collect -- --site 1)
//
// Что делает:
// 1. Берёт список сайтов из листа «Сайты» Google-таблицы, подсказки по сайту — из scenarios/<id>.
// 2. Открывает страницы сайта в браузере и берёт модели, цены и выгоды по сценарию.
// 3. Сравнивает с прошлым сбором и пишет итог в data/utp/latest.json и data/utp/history/<дата>.json.

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { loadSites } from './common.mjs';
import {
  parsePrices, parseBenefits, parseAmounts, cleanModel, mergeModels, validateModels, decideChange, sortSites, summarize, historyToDelete,
} from './lib.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'data');
const UTP = path.join(DATA, 'utp');
const HISTORY = path.join(UTP, 'history');
const SCREENS = path.join(DATA, 'screens');
const PAGE_TIMEOUT = 45_000;
const PARALLEL = Number(process.env.PARALLEL) || 3; // сколько сайтов проверять одновременно

function log(...args) {
  console.log(new Date().toISOString().slice(11, 19), ...args);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// Прошлый сбор: самый свежий файл истории с датой раньше сегодняшней.
function loadPrevious(today) {
  if (!fs.existsSync(HISTORY)) return null;
  const dates = fs.readdirSync(HISTORY).map((f) => f.replace('.json', '')).filter((d) => d < today).sort();
  return dates.length ? readJson(path.join(HISTORY, `${dates.at(-1)}.json`)) : null;
}

// Открывает страницу и выполняет шаги сценария: нажать кнопки, подождать, прокрутить.
async function openPage(context, site, url, cfg = {}) {
  site.pagesOpened = (site.pagesOpened || 0) + 1;
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
  } catch (e) {
    await page.close();
    throw e;
  }
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  for (const sel of cfg.click || []) {
    await page.click(sel, { timeout: 5_000 }).catch(() => log(`  [${site.id}] не нашёл кнопку ${sel}`));
  }
  if (cfg.wait_for) await page.waitForSelector(cfg.wait_for, { timeout: 15_000 }).catch(() => {});
  if (cfg.scroll) await autoScroll(page);
  return page;
}

// Снимок и код страницы: по ним видно, где на сайте цены, и можно дописать сценарий.
async function snapshot(page, site, name) {
  fs.mkdirSync(path.join(SCREENS, String(site.id)), { recursive: true });
  const screen = `data/screens/${site.id}/${name}.jpg`;
  await page.screenshot({ path: path.join(ROOT, screen), fullPage: true, type: 'jpeg', quality: 50 });
  fs.writeFileSync(path.join(SCREENS, String(site.id), `${name}.html`), await page.content());
  return screen;
}

// Одна страница сайта: открыть, выполнить шаги сценария, собрать карточки моделей.
async function collectPage(context, site, pageCfg, index) {
  const page = await openPage(context, site, pageCfg.url, pageCfg);
  try {

    const hasSelectors = pageCfg.card && pageCfg.model;
    let rows = [];
    if (hasSelectors) {
      rows = await page.$$eval(
        pageCfg.card,
        (cards, cfg) => cards.map((card) => {
          // innerText — текст как его видит человек; у скрытых блоков (например, меню) берём textContent.
          // Куски склеиваем через « | », чтобы соседние суммы «455 000» и «455 000» не слиплись в одно число.
          const text = (sel) => (sel ? [...card.querySelectorAll(sel)].map((e) => e.innerText || e.textContent).join(' | ') : '');
          // model_attr: название берём из атрибута (например, href ссылки), а не из текста.
          const model = cfg.modelAttr
            ? [...card.querySelectorAll(cfg.model)].map((e) => e.getAttribute(cfg.modelAttr) || '').join(' | ')
            : text(cfg.model);
          return { model, price: text(cfg.price), benefit: text(cfg.benefit) };
        }),
        { model: pageCfg.model, price: pageCfg.price, benefit: pageCfg.benefit, modelAttr: pageCfg.model_attr },
      );
    }

    // Снимок страницы нужен, если сценарий ещё не заполнен или ничего не нашлось:
    // по нему видно, где на сайте цены, и можно дописать сценарий.
    const screen = !hasSelectors || rows.length === 0 ? await snapshot(page, site, index) : null;

    // model_map: когда на сайте вместо названия картинка, сопоставляем по коду модели из ссылки.
    const mapName = (raw) => {
      const hit = Object.entries(pageCfg.model_map || {}).find(([key]) => raw.includes(key));
      return hit ? hit[1] : raw;
    };
    const models = rows.map((r) => {
      r.model = mapName(r.model);
      const prices = parsePrices(r.price);
      const benefits = (pageCfg.benefit_all ? parseAmounts : parseBenefits)(r.benefit);
      return {
        model: cleanModel(r.model.split('\n').map((l) => l.trim()).find(Boolean), site.brand),
        price: prices.length ? Math.min(...prices) : '-',
        max_benefit: benefits.length ? Math.max(...benefits) : '-',
        source_url: pageCfg.url,
      };
    });
    return { models, screen, hasSelectors };
  } finally {
    await page.close();
  }
}

// Обход по моделям: со страницы-списка берём ссылки на все модели,
// заходим на страницу каждой и берём все цены и выгоды (по всем комплектациям).
// Цена модели — самая маленькая, выгода — самая большая.
async function collectModelPages(context, site, cfg) {
  const list = await openPage(context, site, cfg.list_url, cfg);
  let links;
  try {
    links = await list.$$eval(cfg.link, (els, nameSel) => els.map((a) => {
      const nameEl = nameSel ? a.querySelector(nameSel) : null;
      return { href: a.href, name: ((nameEl || a).innerText || (nameEl || a).textContent || '').trim() };
    }), cfg.name);
  } finally {
    await list.close();
  }
  const seen = new Set();
  links = links.filter((l) => l.href && !seen.has(l.href) && seen.add(l.href));
  if (!links.length) throw new Error(`На ${cfg.list_url} не нашлось ссылок на модели`);
  log(`  [${site.id}] моделей в списке: ${links.length}`);

  const page = cfg.page || {};
  const hasSelectors = Boolean(page.price || page.benefit);
  const models = [];
  const screens = [];
  const notes = [];
  for (const [i, link] of links.entries()) {
    let p;
    try {
      p = await openPage(context, site, link.href, page);
      const found = await p.evaluate(({ price, benefit, title, trim }) => {
        const texts = (root, sel) => (sel ? [...root.querySelectorAll(sel)].map((e) => e.innerText || e.textContent) : []);
        const roots = trim ? [...document.querySelectorAll(trim)] : [document];
        return {
          title: texts(document, title)[0] || '',
          prices: roots.flatMap((r) => texts(r, price)),
          // Выгоды часто стоят отдельно от комплектаций, поэтому ищем их по всей странице.
          benefits: texts(document, benefit),
        };
      }, page);
      const prices = found.prices.flatMap(parsePrices);
      const benefits = found.benefits.flatMap(page.benefit_all ? parseAmounts : parseBenefits);
      const name = cleanModel((found.title || link.name).split('\n').map((l) => l.trim()).find(Boolean), site.brand);
      // Снимок: если сценарий не дописан, или на странице модели не нашлось цены (один на сайт).
      if (!hasSelectors || (!prices.length && !screens.length)) screens.push(await snapshot(p, site, `model-${i}`));
      models.push({
        model: name,
        price: prices.length ? Math.min(...prices) : '-',
        max_benefit: benefits.length ? Math.max(...benefits) : '-',
        source_url: link.href,
      });
    } catch (e) {
      notes.push(`Не открылась ${link.href}: ${e.message.split('\n')[0]}`);
    } finally {
      await p?.close();
    }
  }
  return { models, screens, notes, hasSelectors };
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 150));
    }
  });
}

async function collectSite(browser, site) {
  const base = {
    id: site.id, company: site.company || '', responsible: site.responsible || '', site: site.site, brand: site.brand || '', file: site.file,
    models: [], screens: [], comment: '',
  };
  if (!site.pages?.length && !site.models) {
    return { ...base, status: 'no_scenario', comment: 'Для сайта ещё не написан сценарий' };
  }
  const context = await browser.newContext({ locale: 'ru-RU', viewport: { width: 1366, height: 900 } });
  try {
    const rows = [];
    const notes = [];
    let anyOpened = false;
    let unfinished = false;
    if (site.models) {
      try {
        const res = await collectModelPages(context, site, site.models);
        anyOpened = true;
        rows.push(...res.models);
        base.screens.push(...res.screens);
        notes.push(...res.notes);
        if (!res.hasSelectors) unfinished = true;
      } catch (e) {
        notes.push(`Обход моделей: ${e.message.split('\n')[0]}`);
      }
    }
    for (const [i, pageCfg] of (site.pages || []).entries()) {
      try {
        const res = await collectPage(context, site, pageCfg, i);
        anyOpened = true;
        rows.push(...res.models);
        if (res.screen) base.screens.push(res.screen);
        if (!res.hasSelectors) unfinished = true;
        else if (!res.models.length) notes.push(`На странице ${pageCfg.url} не нашлось ни одной модели`);
      } catch (e) {
        notes.push(`Не открылась ${pageCfg.url}: ${e.message.split('\n')[0]}`);
      }
    }
    if (!anyOpened) return { ...base, status: 'access_error', comment: notes.join('; ') };

    const models = mergeModels(rows.filter((r) => r.model));
    const problems = validateModels(models);
    const noPrice = models.filter((m) => m.price === '-').map((m) => m.model);
    if (noPrice.length && !unfinished) problems.push(`Не нашлась цена: ${noPrice.join(', ')}`);
    if (unfinished) problems.unshift('Сценарий не заполнен до конца, сделан снимок страницы');
    if (!models.length && !unfinished) problems.push('Модели не найдены');
    const all = [...problems, ...notes];
    return { ...base, models, status: all.length ? 'needs_check' : 'ok', comment: all.join('; ') };
  } finally {
    await context.close();
  }
}

async function main() {
  const onlyId = process.argv.includes('--site') ? process.argv[process.argv.indexOf('--site') + 1] : null;
  const scenarios = await loadSites(onlyId);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const previous = loadPrevious(today);
  const prevById = new Map((previous?.sites || []).map((s) => [String(s.id), s]));
  log(`Сайтов к проверке: ${scenarios.length}. Прошлый сбор: ${previous?.date || 'нет'}`);

  // CHROMIUM_PATH: путь к своему браузеру, если Playwright не скачал свой.
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const results = [];
  const queue = [...scenarios];

  // Сохраняет итог. stopped = сбор остановили кнопкой в приложении: пишем то, что успели,
  // а непроверенные сайты оставляем как в прошлом сборе, чтобы ничего не потерять.
  let saved = false;
  function saveReport(stopped) {
    if (saved) return;
    saved = true;
    const done = new Set(results.map((r) => String(r.id)));
    let sites = results;
    if (onlyId || stopped) {
      const latest = readJson(path.join(UTP, 'latest.json'));
      // У непроверенных сайтов оставляем только снимки, которые ещё лежат на месте.
      const kept = (latest?.sites || []).filter((s) => !done.has(String(s.id)))
        .map((s) => ({ ...s, screens: (s.screens || []).filter((f) => fs.existsSync(path.join(ROOT, f))) }));
      sites = [...kept, ...results];
    }
    sites = sortSites(sites);
    // Снимки сайтов, которых больше нет в списке, не нужны.
    const keep = new Set(sites.map((s) => String(s.id)));
    if (fs.existsSync(SCREENS)) {
      for (const d of fs.readdirSync(SCREENS)) if (!keep.has(d)) fs.rmSync(path.join(SCREENS, d), { recursive: true, force: true });
    }
    const report = {
      date: today,
      checked_at: now.toISOString(),
      previous_date: previous?.date || null,
      total_seconds: Math.round((Date.now() - now.getTime()) / 1000),
      parallel: PARALLEL,
      ...(stopped ? { stopped: true, checked: results.length, planned: scenarios.length } : {}),
      summary: summarize(sites),
      sites,
    };

    fs.mkdirSync(HISTORY, { recursive: true });
    fs.writeFileSync(path.join(UTP, 'latest.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(HISTORY, `${today}.json`), JSON.stringify(report, null, 2));

    const dates = fs.readdirSync(HISTORY).map((f) => f.replace('.json', ''));
    for (const d of historyToDelete(dates, today)) {
      fs.rmSync(path.join(HISTORY, `${d}.json`));
      log(`Удалён старый сбор ${d}`);
    }
    log(stopped ? `Сбор остановлен: проверено ${results.length} из ${scenarios.length}, сохранено` : `Готово за ${report.total_seconds} с:`, JSON.stringify(report.summary));
  }
  // GitHub при отмене сначала посылает сигнал и даёт несколько секунд: успеваем сохранить.
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      saveReport(true);
      process.exit(0);
    });
  }
  async function worker() {
    while (queue.length) {
      const site = queue.shift();
      log(`→ [${site.id}] ${site.site}`);
      const started = Date.now();
      // Старые снимки сайта удаляем только перед его проверкой: у остальных они остаются.
      fs.rmSync(path.join(SCREENS, String(site.id)), { recursive: true, force: true });
      const res = await collectSite(browser, site);
      // Сколько времени и страниц ушло на сайт: по этому считаем, сколько сайтов успеем за один сбор.
      res.seconds = Math.round((Date.now() - started) / 1000);
      res.pages_opened = site.pagesOpened || 0;
      Object.assign(res, decideChange(res, prevById.get(String(site.id))));
      log(`  [${site.id}] ${res.change}. Моделей: ${res.models.length}. ${res.seconds} с, страниц: ${res.pages_opened}${res.comment ? `. ${res.comment}` : ''}`);
      results.push(res);
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  await browser.close();

  saveReport(false);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
