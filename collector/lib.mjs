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

// Выгоды из текста. Берём только сумму сразу после слов «выгода», «скидка» или «преимущество»
// («Выгода по трейд-ин до 200 000 ₽», «с учетом прямой выгоды в 250 000 рублей»).
// Лизинг, ежемесячные платежи и маркетплейсы пропускаем, годы («2026 года») не считаем.
const BENEFIT_WORD = /(выгод|скидк|преимуществ)[а-яё]*/gi;
const NOT_BENEFIT = /лизинг|платеж|платёж|маркетплейс|в месяц/i;

export function parseBenefits(text) {
  const clean = String(text || '').replace(/[\u00a0\u202f\u2009]/g, ' ');
  const out = [];
  for (const m of clean.matchAll(BENEFIT_WORD)) {
    const before = clean.slice(Math.max(0, m.index - 25), m.index);
    let after = clean.slice(m.index + m[0].length, m.index + m[0].length + 70);
    after = after.split(/[;\n]|\.\s|(?=(выгод|скидк|преимуществ))/i)[0];
    // «с учетом выгоды от 4 099 000» — это цена, а не выгода.
    if (NOT_BENEFIT.test(before + m[0] + after) || /^\s*от\s/i.test(after)) continue;
    const nums = parseRubles(after.replace(/\b(19|20)\d{2}\s*(г\.|год|года|г\b)/gi, ' '));
    if (nums.length) out.push(nums[0]);
  }
  return out;
}

// Все суммы из текста как выгоды — для блоков, где сайт пишет сумму без слова «выгода»
// (в сценарии: benefit_all: true). Годы («2026 г.») не считаем.
export function parseAmounts(text) {
  return parseRubles(String(text || '').replace(/\b(19|20)\d{2}\s*(г\.|год|года|г\b)/gi, ' '));
}

// Чистит название модели: убирает марку в начале и хвост с ценой.
// «TENET T8 - от 2 899 000 ₽*» → «T8».
export function cleanModel(name, brand = '') {
  let m = String(name || '').replace(/[\u00a0\u202f]/g, ' ').replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰*]/g, '').replace(/\s+/g, ' ').trim();
  // «Ли Л6 | Li L6» — берём латинское название после черты.
  if (/\s[|I]\s/.test(m) || m.includes('|')) m = m.split(/\s*\|\s*|\sI\s/).map((x) => x.trim()).filter(Boolean).pop() || m;
  m = m.split(/\s*[-–—:]?\s*(?:от|до|цена)\s+\d/i)[0];
  m = m.split(/\s\d{1,3}(?:[ .,]\d{3})+/)[0];
  if (brand && m.toLowerCase().startsWith(`${brand.toLowerCase()} `)) m = m.slice(brand.length + 1);
  return m.replace(/[\s*\-–—:]+$/, '').trim();
}

// Цены из текста. Если рядом есть «от 2 199 000», берём только такие суммы:
// так в цену не попадут выгоды и годы из сносок.
export function parsePrices(text) {
  const clean = String(text || '').replace(/[\u00a0\u202f\u2009]/g, ' ');
  const fromParts = [...clean.matchAll(/от\s*(\d[\d .,]*\d(?:\s*млн)?)/gi)].flatMap((m) => parseRubles(m[1]));
  return fromParts.length ? fromParts : parseRubles(clean);
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

// То же сравнение, но списком объектов: приложение рисует по нему стрелки и цвета.
export function diffDetails(prev, curr) {
  const out = [];
  const pick = (m) => ({ price: m.price, max_benefit: m.max_benefit });
  const prevMap = new Map(prev.map((m) => [modelKey(m.model), m]));
  const currMap = new Map(curr.map((m) => [modelKey(m.model), m]));
  for (const [key, m] of currMap) {
    const old = prevMap.get(key);
    if (!old) out.push({ type: 'new', model: m.model, now: pick(m) });
    else if (old.price !== m.price || old.max_benefit !== m.max_benefit) {
      out.push({ type: 'changed', model: m.model, was: pick(old), now: pick(m) });
    }
  }
  for (const [key, m] of prevMap) {
    if (!currMap.has(key)) out.push({ type: 'gone', model: m.model, was: pick(m) });
  }
  return out;
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
  const diff = diffDetails(prevSite.models, site.models);
  return { change: changes.length ? CHANGE.changed : CHANGE.same, changes, diff };
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
