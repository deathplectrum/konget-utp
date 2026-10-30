// Общее для всех проверок: список сайтов, чтение и запись результатов, параллельный обход.

import fs from 'node:fs';
import path from 'node:path';
import { load as loadYaml } from 'js-yaml';
import { historyToDelete } from './lib.mjs';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const SCENARIOS = path.join(ROOT, 'scenarios');
export const DATA = path.join(ROOT, 'data');

export function log(...args) {
  console.log(new Date().toISOString().slice(11, 19), ...args);
}

// Сайты берём из сценариев: один файл — один сайт. Для проверок работы сайта и скрипта
// Конгет хватает id и адреса, селекторы для цен не нужны.
export function loadScenarios(onlyId) {
  return fs.readdirSync(SCENARIOS)
    .filter((f) => /\.ya?ml$/.test(f) && !f.startsWith('_'))
    .map((f) => ({ file: f, ...loadYaml(fs.readFileSync(path.join(SCENARIOS, f), 'utf8')) }))
    .filter((s) => s.active !== false && s.site)
    .filter((s) => !onlyId || String(s.id) === String(onlyId))
    .sort((a, b) => a.id - b.id);
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
