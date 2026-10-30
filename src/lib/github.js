// Всё общение с GitHub: прочитать результаты проверок, запустить и остановить проверку.
const API = 'https://api.github.com';
const WORKFLOW = 'collect.yml'; // по нему проверяем, что ключ подходит

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

// Последний итог проверки (file — например, data/utp/latest.json). С ключом читаем через API
// (всегда свежий), без ключа — обычной ссылкой (GitHub может отдавать копию до 5 минут давности).
export async function loadData({ repo, token }, file) {
  if (!repo) throw new Error('Не указан репозиторий в Настройках');
  const res = token
    ? await fetch(`${API}/repos/${repo}/contents/${file}?ref=main`, {
      headers: headers(token, { Accept: 'application/vnd.github.raw+json' }),
      cache: 'no-store',
    })
    : await fetch(`${rawUrl(repo, file)}?t=${Date.now()}`, { cache: 'no-store' });
  if (res.status === 404) return null; // проверки ещё не было
  if (!res.ok) throw new Error(`GitHub ответил ошибкой ${res.status}`);
  return res.json();
}

// Нажали кнопку: просим GitHub запустить проверку (workflow — файл из .github/workflows).
export async function startWorkflow({ repo, token }, workflow, inputs) {
  if (!token) throw new Error('Добавь ключ доступа в Настройках');
  const res = await fetch(`${API}/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: headers(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ref: 'main', ...(inputs ? { inputs } : {}) }),
  });
  if (res.status === 401) throw new Error('Ключ доступа не подходит или устарел');
  if (res.status === 403 || res.status === 404) {
    throw new Error('У ключа нет права запускать проверки в этом репозитории');
  }
  if (!res.ok) throw new Error(`Не удалось запустить (${res.status})`);
}

// Экстренная остановка: GitHub останавливает сборщик, тот успевает сохранить собранное.
export async function cancelRun({ repo, token }, runId) {
  const res = await fetch(`${API}/repos/${repo}/actions/runs/${runId}/cancel`, {
    method: 'POST',
    headers: headers(token),
  });
  if (res.status === 409) return; // уже закончился
  if (!res.ok) throw new Error(`Не удалось остановить (${res.status})`);
}

// Последний запуск проверки: идёт ли она сейчас и чем закончилась.
export async function lastRun({ repo, token }, workflow) {
  const res = await fetch(`${API}/repos/${repo}/actions/workflows/${workflow}/runs?per_page=1`, {
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
  if (!run.ok) return { ok: false, text: 'Репозиторий есть, но проверки (collect.yml) не найдены' };
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
