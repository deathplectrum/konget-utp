// Чистые функции проверок «Работает ли сайт» и «Есть ли скрипт Конгет».
// Здесь нет браузера, поэтому всё легко проверить тестами (collector/checks.test.mjs).

export const HEALTH = {
  ok: 'Работает',
  slow: 'Работает медленно',
  stub: 'Заглушка',
  down: 'Не работает',
};
export const HEALTH_ORDER = [HEALTH.down, HEALTH.stub, HEALTH.slow, HEALTH.ok];

export const KONGET = {
  ok: 'Скрипт есть',
  wrong: 'Токен не тот',
  noToken: 'Скрипт без токена',
  manual: 'Проверить вручную',
  missing: 'Скрипта нет',
  down: 'Сайт не открылся',
};
export const KONGET_ORDER = [KONGET.missing, KONGET.wrong, KONGET.noToken, KONGET.manual, KONGET.down, KONGET.ok];

export const SLOW_SECONDS = 10;
const MIN_TEXT = 80; // на живой странице дилера текста точно больше

// Страница-заглушка вместо сайта: «сайт в разработке», «домен продаётся», хостинг не оплачен.
const STUB = [
  /сайт\s+(находится\s+)?в\s+разработке/i,
  /сайт\s+временно\s+(не\s+)?(доступен|работает)/i,
  /ведутся\s+технические\s+работы/i,
  /домен\s+.{0,40}(продается|продаётся|припаркован|не\s+делегирован)/i,
  /(срок\s+регистрации|оплата\s+хостинга|аккаунт\s+заблокирован)/i,
  /under\s+construction|coming\s+soon|domain\s+(is\s+)?for\s+sale|this\s+domain\s+is\s+parked/i,
  /index\s+of\s+\//i,
];

// Итог проверки сайта по тому, что вернул браузер.
export function healthVerdict({ error, status, seconds, text = '', title = '' }) {
  if (error) return { health: HEALTH.down, reason: error };
  if (status >= 400) return { health: HEALTH.down, reason: `Сайт ответил ошибкой ${status}` };
  const all = `${title}\n${text}`;
  const stub = STUB.find((re) => re.test(all));
  if (stub) return { health: HEALTH.stub, reason: `На странице: «${all.match(stub)[0]}»` };
  if (text.replace(/\s+/g, ' ').trim().length < MIN_TEXT) return { health: HEALTH.stub, reason: 'Страница почти пустая' };
  if (seconds > SLOW_SECONDS) return { health: HEALTH.slow, reason: `Открывался ${Math.round(seconds)} с` };
  return { health: HEALTH.ok, reason: '' };
}

// Токен Конгет: //app.konget.ru/inject?token=538e1215043c412b9cfcff11319094a9.
// На всякий случай понимает и другие записи: injectToken=…, inject_token: "…".
const TOKEN = /inject(?:\?|[\s_-])?token["']?\s*[:=]\s*["']?([A-Za-z0-9_-]{6,})/gi;

export function findTokens(text) {
  return [...new Set([...String(text || '').matchAll(TOKEN)].map((m) => m[1]))];
}

// Контейнер тегов (Google Tag Manager и подобные): скрипт Конгет может лежать в нём,
// и в коде сайта его не видно.
const CONTAINER = /googletagmanager\.com|gtm\.js|\bGTM-[A-Z0-9]{4,}|tagmanager/i;

// Как скрипт стоит в коде сайта.
//   «обычный» — <script src="//app.konget.ru/inject?token=…">;
//   «отложенный» — ссылка внутри кода, скрипт добавляется через N секунд (setTimeout);
//   «через контейнер» — в коде сайта его нет, но браузер его загрузил.
function kindOf(html, token) {
  const at = html.indexOf(token);
  if (at < 0) return 'через контейнер';
  const before = html.slice(Math.max(0, at - 200), at);
  return /<script[^>]*\ssrc\s*=\s*["'][^"']*$/i.test(before) ? 'обычный' : 'отложенный';
}

// html — код страницы, как его отдал сервер; dom — код после загрузки и ожидания; requests — адреса всех файлов, которые загрузил браузер
// (включая те, что появились через несколько секунд или из контейнера).
export function kongetVerdict({ error, html = '', dom = '', requests = [], expected = '' }) {
  if (error) return { konget: KONGET.down, tokens: [], reason: error };
  const loaded = requests.filter((u) => /konget/i.test(u));
  const inCode = [...`${html}\n${dom}`.matchAll(/[^\s"'<>]*konget[^\s"'<>]*/gi)].map((m) => m[0]);
  const tokens = [...new Set([...loaded, ...inCode].flatMap(findTokens))];
  const where = loaded[0] || inCode[0] || '';
  const container = CONTAINER.test(`${html}\n${dom}`) || requests.some((u) => CONTAINER.test(u));
  if (!loaded.length && !inCode.length) {
    return container
      ? { konget: KONGET.manual, tokens, reason: 'Скрипт не найден, но на сайте есть контейнер тегов (например, Google Tag Manager). Скрипт может лежать в нём, проверьте сами' }
      : { konget: KONGET.missing, tokens, reason: 'В коде сайта и в загруженных файлах нет app.konget' };
  }
  if (!tokens.length) return { konget: KONGET.noToken, tokens, where, reason: 'Конгет на сайте есть, а token не нашёлся' };
  const kind = kindOf(html, tokens[0]);
  if (expected && !tokens.includes(String(expected))) {
    return { konget: KONGET.wrong, tokens, kind, where, reason: `Ждали ${expected}, на сайте ${tokens.join(', ')}` };
  }
  return { konget: KONGET.ok, tokens, kind, where, reason: '' };
}

// Сравнение с прошлой проверкой: что поменялось у сайта.
export function changedSince(prev, curr, field) {
  if (!prev) return '';
  return prev[field] !== curr[field] ? `Было: ${prev[field]}` : '';
}

export function sortBy(order, field) {
  return (sites) => [...sites].sort((a, b) => order.indexOf(a[field]) - order.indexOf(b[field]) || a.id - b.id);
}

export function countBy(sites, field, names) {
  const out = Object.fromEntries(names.map((n) => [n, 0]));
  for (const s of sites) out[s[field]] = (out[s[field]] || 0) + 1;
  return out;
}
