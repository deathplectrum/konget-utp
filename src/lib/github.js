// Всё общение с GitHub: прочитать результаты сбора и запустить сбор.
const API = 'https://api.github.com';
const WORKFLOW = 'collect.yml';

function headers(token, extra = {}) {
  return {
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

// Адрес файла из репозитория (например, снимка страницы).
export function rawUrl(repo, file) {
  return `https://raw.githubusercontent.com/${repo}/main/${file}`;
}

export function fileUrl(repo, file) {
  return `https://github.com/${repo}/blob/main/${file}`;
}

// Последний сбор. С ключом читаем через API (всегда свежий), без ключа — обычной ссылкой
// (GitHub может отдавать копию до 5 минут давности).
export async function loadLatest({ repo, token }) {
  if (!repo) throw new Error('Не указан репозиторий в Настройках');
  const res = token
    ? await fetch(`${API}/repos/${repo}/contents/data/latest.json?ref=main`, {
      headers: headers(token, { Accept: 'application/vnd.github.raw+json' }),
      cache: 'no-store',
    })
    : await fetch(`${rawUrl(repo, 'data/latest.json')}?t=${Date.now()}`, { cache: 'no-store' });
  if (res.status === 404) return null; // сбора ещё не было
  if (!res.ok) throw new Error(`GitHub ответил ошибкой ${res.status}`);
  return res.json();
}

// Нажали «Собрать»: просим GitHub запустить сборщик.
export async function startCollect({ repo, token }, siteId = '') {
  if (!token) throw new Error('Добавь ключ GitHub в Настройках');
  const res = await fetch(`${API}/repos/${repo}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: headers(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ref: 'main', inputs: { site: String(siteId) } }),
  });
  if (res.status === 401) throw new Error('Ключ GitHub не подходит или устарел');
  if (res.status === 403 || res.status === 404) {
    throw new Error('У ключа нет права запускать Actions в этом репозитории');
  }
  if (!res.ok) throw new Error(`Не удалось запустить сбор (${res.status})`);
}

// Экстренная остановка: GitHub останавливает сборщик, тот успевает сохранить собранное.
export async function cancelRun({ repo, token }, runId) {
  const res = await fetch(`${API}/repos/${repo}/actions/runs/${runId}/cancel`, {
    method: 'POST',
    headers: headers(token),
  });
  if (res.status === 409) return; // уже закончился
  if (!res.ok) throw new Error(`Не удалось остановить сбор (${res.status})`);
}

// Последний запуск сборщика: идёт ли он сейчас и чем закончился.
export async function lastRun({ repo, token }) {
  const res = await fetch(`${API}/repos/${repo}/actions/workflows/${WORKFLOW}/runs?per_page=1`, {
    headers: headers(token),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.workflow_runs?.[0] || null;
}

export async function checkToken({ repo, token }) {
  const res = await fetch(`${API}/repos/${repo}`, { headers: headers(token) });
  if (!res.ok) return { ok: false, text: `Репозиторий не найден или ключ не подходит (${res.status})` };
  const run = await fetch(`${API}/repos/${repo}/actions/workflows/${WORKFLOW}`, { headers: headers(token) });
  if (!run.ok) return { ok: false, text: 'Репозиторий есть, но сборщик (collect.yml) не найден' };
  return { ok: true, text: 'Всё в порядке: ключ подходит' };
}

// Ссылка «Добавить сайт»: открывает на GitHub новый файл сценария с готовым шаблоном.
export function newScenarioUrl(repo) {
  const template = `id: 
company: 
site: 
brand: 
active: true

pages:
  - url: https://
`;
  const q = new URLSearchParams({ filename: 'scenarios/000-novyi-sait.yaml', value: template });
  return `https://github.com/${repo}/new/main?${q}`;
}
