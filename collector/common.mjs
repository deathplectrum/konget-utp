// Общее для всех проверок: список сайтов, чтение и запись результатов, параллельный обход.

import fs from 'node:fs';
import path from 'node:path';
import { load as loadYaml } from 'js-yaml';
import { historyToDelete } from './lib.mjs';
import { connect, hasGoogle, readRange } from './google.mjs';
import { SITES_SHEET, parseSites } from './sheet.mjs';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const SCENARIOS = path.join(ROOT, 'scenarios');
export const DATA = path.join(ROOT, 'data');

export function log(...args) {
  console.log(new Date().toISOString().slice(11, 19), ...args);
}

// Сценарии сайтов (scenarios/*.yaml): где на сайте модели, цены и выгоды — нужны для сверки УТП.
export function loadScenarios() {
  return fs.readdirSync(SCENARIOS)
    .filter((f) => /\.ya?ml$/.test(f) && !f.startsWith('_'))
    .map((f) => ({ file: f, ...loadYaml(fs.readFileSync(path.join(SCENARIOS, f), 'utf8')) }));
}

// Список сайтов для проверки. Главный источник — лист «Сайты» Google-таблицы: его обновляет человек.
// Сценарий с тем же ID добавляет к сайту подсказки для сверки УТП. Если таблица не подключена
// (нет секретов) или лист пуст, берём сайты из сценариев.
export async function loadSites(onlyId) {
  const scenarios = loadScenarios();
  const byId = new Map(scenarios.map((s) => [String(s.id), s]));
  let sites = [];
  if (hasGoogle()) {
    const rows = parseSites(await readRange(await connect(), `'${SITES_SHEET}'!A2:H`));
    log(`Лист «${SITES_SHEET}»: сайтов ${rows.length}`);
    sites = rows.map((r) => {
      // Сценарий подходит, только если в нём тот же сайт: ID в таблице могут не совпасть с тестовыми сценариями.
      const found = byId.get(String(r.id));
      const sc = found && host(found.site) === host(r.site) ? found : {};
      return { ...sc, ...r, konget_token: r.konget_token || sc.konget_token || '' };
    });
  }
  if (!sites.length) {
    log('Список сайтов берём из папки scenarios');
    sites = scenarios.filter((s) => s.site);
  }
  return sites
    .filter((s) => s.active !== false)
    .filter((s) => !onlyId || String(s.id) === String(onlyId))
    .sort((a, b) => a.id - b.id);
}

// «https://www.Tenet.ru/» → «tenet.ru».
export function host(site) {
  return String(site || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
}

export function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

// Папка одной проверки: data/<kind>/latest.json и data/<kind>/history/<дата>.json.
export function store(kind) {
  const dir = path.join(DATA, kind);
  const history = path.join(dir, 'history');
  return {
    dir,
    latest: () => readJson(path.join(dir, 'latest.json')),
    // Прошлая проверка: самый свежий файл истории с датой раньше сегодняшней.
    previous(today) {
      if (!fs.existsSync(history)) return null;
      const dates = fs.readdirSync(history).map((f) => f.replace('.json', '')).filter((d) => d < today).sort();
      return dates.length ? readJson(path.join(history, `${dates.at(-1)}.json`)) : null;
    },
    // Пишет итог и удаляет историю старше 3,5 месяцев.
    save(report) {
      fs.mkdirSync(history, { recursive: true });
      const text = JSON.stringify(report, null, 2);
      fs.writeFileSync(path.join(dir, 'latest.json'), text);
      fs.writeFileSync(path.join(history, `${report.date}.json`), text);
      const dates = fs.readdirSync(history).map((f) => f.replace('.json', ''));
      for (const d of historyToDelete(dates, report.date)) {
        fs.rmSync(path.join(history, `${d}.json`));
        log(`Удалена старая проверка ${d}`);
      }
    },
  };
}

// Сайты, которые проверили не сейчас (проверка одного сайта или остановка кнопкой),
// берём из прошлого итога, чтобы ничего не потерять.
export function keepUnchecked(latest, results) {
  const done = new Set(results.map((r) => String(r.id)));
  return [...(latest?.sites || []).filter((s) => !done.has(String(s.id))), ...results];
}

// Обходит сайты по несколько одновременно. onStop вызывается, если проверку остановили кнопкой:
// GitHub сначала посылает сигнал и даёт несколько секунд, успеваем сохранить собранное.
export async function runQueue(items, parallel, handle, onStop) {
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      onStop();
      process.exit(0);
    });
  }
  const queue = [...items];
  async function worker() {
    while (queue.length) await handle(queue.shift());
  }
  await Promise.all(Array.from({ length: parallel }, worker));
}

export function siteBase(site) {
  return {
    id: site.id, company: site.company || '', responsible: site.responsible || '', site: site.site, brand: site.brand || '',
  };
}

export function siteUrl(site) {
  return /^https?:\/\//.test(site.site) ? site.site : `https://${site.site}`;
}
