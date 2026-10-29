// Чистые функции сборщика: разбор цен, проверка, сравнение с прошлым сбором.
// Здесь нет браузера, поэтому всё это легко проверить тестами (collector/lib.test.mjs).

export const MIN_PRICE = 300_000;
export const MAX_PRICE = 30_000_000;

// Статусы сайта, которые видит человек в приложении.
export const CHANGE = {
  same: 'Не изменилось',
  changed: 'Изменилось',
  check: 'Требует проверки',
  error: 'Ошибка доступа',
  first: 'Первая проверка',
  noScenario: 'Нет сценария',
};

// В каком порядке показывать сайты: сначала то, что требует внимания.
export const CHANGE_ORDER = [
  CHANGE.error, CHANGE.check, CHANGE.changed, CHANGE.first, CHANGE.same, CHANGE.noScenario,
];

// Достаёт из текста все суммы в рублях.
// Понимает «2 199 000 ₽», «2199000 руб.», «от 2,199 млн ₽», «до 300 тыс. ₽».
export function parseRubles(text) {
  if (!text) return [];
  let clean = String(text).replace(/[\u00a0\u202f\u2009]/g, ' ');
  const out = [];
  // Сначала «2,199 млн» и «300 тыс»: здесь запятая или точка — десятичная.
  clean = clean.replace(/(\d+(?:[.,]\d+)?)\s*(млн|тыс)/gi, (_, num, unit) => {
    const mult = unit.toLowerCase() === 'млн' ? 1_000_000 : 1_000;
    out.push(Math.round(Number(num.replace(',', '.')) * mult));
    return ' ';
  });
  // Потом обычные суммы: «2 199 000», «2199000», «2.199.000».
  for (const m of clean.matchAll(/\d{1,3}(?:[ .,]\d{3})+|\d+/g)) {
    const value = Number(m[0].replace(/[ .,]/g, ''));
    if (value >= 1000) out.push(value);
  }
  return out.filter((v) => v >= 1000);
}

// Чистит название модели: убирает марку в начале и хвост с ценой.
// «TENET T8 - от 2 899 000 ₽*» → «T8».
export function cleanModel(name, brand = '') {
  let m = String(name || '').replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
  m = m.split(/\s*[-–—:]?\s*(?:от|до|цена)\s+\d/i)[0];
  m = m.split(/\s\d{1,3}(?:[ .,]\d{3})+/)[0];
  if (brand && m.toLowerCase().startsWith(`${brand.toLowerCase()} `)) m = m.slice(brand.length + 1);
  return m.replace(/[\s*\-–—:]+$/, '').trim();
}

// Название модели для сравнения: без регистра и лишних пробелов.
export function modelKey(name) {
  return String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function formatRub(value) {
  if (value === '-' || value === null || value === undefined) return '-';
  return `${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`;
}

export function formatPair(m) {
  return `${formatRub(m.price)}/${formatRub(m.max_benefit)}`;
}

// Склеивает строки с одной и той же моделью: цена минимальная, выгода максимальная.
export function mergeModels(rows) {
  const byKey = new Map();
  for (const r of rows) {
    const key = modelKey(r.model);
    if (!key) continue;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...r, model: r.model.replace(/\s+/g, ' ').trim() });
      continue;
    }
    if (r.price !== '-' && (prev.price === '-' || r.price < prev.price)) prev.price = r.price;
    if (r.max_benefit !== '-' && (prev.max_benefit === '-' || r.max_benefit > prev.max_benefit)) {
      prev.max_benefit = r.max_benefit;
    }
  }
  return [...byKey.values()];
}

// Ищет подозрительные цифры. Возвращает список причин (пустой, если всё в порядке).
export function validateModels(models) {
  const problems = [];
  for (const m of models) {
    if (m.price !== '-' && (m.price < MIN_PRICE || m.price > MAX_PRICE)) {
      problems.push(`${m.model}: странная цена ${formatRub(m.price)}`);
    }
    if (m.price !== '-' && m.max_benefit !== '-' && m.max_benefit > m.price) {
      problems.push(`${m.model}: выгода больше цены`);
    }
  }
  return problems;
}

// Сравнивает модели сайта с прошлым сбором. Возвращает список изменений текстом.
export function diffModels(prev, curr) {
  const changes = [];
  const prevMap = new Map(prev.map((m) => [modelKey(m.model), m]));
  const currMap = new Map(curr.map((m) => [modelKey(m.model), m]));
  for (const [key, m] of currMap) {
    const old = prevMap.get(key);
    if (!old) changes.push(`Новая модель: ${m.model} ${formatPair(m)}`);
    else if (old.price !== m.price || old.max_benefit !== m.max_benefit) {
      changes.push(`${m.model}: ${formatPair(old)} → ${formatPair(m)}`);
    }
  }
  for (const [key, m] of prevMap) {
    if (!currMap.has(key)) changes.push(`Модель пропала: ${m.model}`);
  }
  return changes;
}

// Решает, какой статус получит сайт, и что написать в «Что изменилось».
export function decideChange(site, prevSite) {
  if (site.status === 'no_scenario') return { change: CHANGE.noScenario, changes: [] };
  if (site.status === 'access_error') return { change: CHANGE.error, changes: [] };
  if (site.status === 'needs_check') return { change: CHANGE.check, changes: [] };
  if (!prevSite || !prevSite.models?.length) {
    return { change: CHANGE.first, changes: [`Записано моделей: ${site.models.length}`] };
  }
  const changes = diffModels(prevSite.models, site.models);
  return { change: changes.length ? CHANGE.changed : CHANGE.same, changes };
}

export function sortSites(sites) {
  return [...sites].sort(
    (a, b) => CHANGE_ORDER.indexOf(a.change) - CHANGE_ORDER.indexOf(b.change) || a.id - b.id,
  );
}

export function summarize(sites) {
  const summary = Object.fromEntries(Object.values(CHANGE).map((c) => [c, 0]));
  for (const s of sites) summary[s.change] = (summary[s.change] || 0) + 1;
  return summary;
}

// Какие файлы истории удалить: старше keepDays от даты сбора, кроме самого свежего.
export function historyToDelete(dates, today, keepDays = 106) {
  const sorted = [...dates].sort();
  const newest = sorted[sorted.length - 1];
  const limit = new Date(today).getTime() - keepDays * 86_400_000;
  return sorted.filter((d) => d !== newest && new Date(d).getTime() < limit);
}
