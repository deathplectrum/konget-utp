// Статусы, их цвета, значки и подсказки простыми словами. Названия совпадают с теми, что пишет сборщик.
import {
  trendingUp, alertCircle, cloudOffline, sparkles, checkmarkCircle, constructOutline,
} from 'ionicons/icons';

export const STATUS = {
  'Изменилось': { tone: 'blue', icon: trendingUp, hint: 'Цены или выгоды поменялись' },
  'Требует проверки': { tone: 'amber', icon: alertCircle, hint: 'Сборщик не уверен, глянь сам' },
  'Ошибка доступа': { tone: 'red', icon: cloudOffline, hint: 'Сайт не открылся' },
  'Первая проверка': { tone: 'violet', icon: sparkles, hint: 'Запомнили цены, сравним в следующий раз' },
  'Не изменилось': { tone: 'green', icon: checkmarkCircle, hint: 'Всё как в прошлый раз' },
  'Нет сценария': { tone: 'gray', icon: constructOutline, hint: 'Сайт ещё не настроен' },
};

export const STATUS_ORDER = Object.keys(STATUS);
export const ATTENTION = ['Ошибка доступа', 'Требует проверки'];

export function statusMeta(change) {
  return STATUS[change] || STATUS['Нет сценария'];
}

export function formatRub(v) {
  if (v === '-' || v === null || v === undefined) return '—';
  return `${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`;
}

// «2,6 млн» — коротко, для плашек.
export function shortRub(v) {
  if (typeof v !== 'number') return '—';
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 ? 2 : 0).replace('.', ',').replace(/,?0+$/, '')} млн`;
  if (v >= 1_000) return `${Math.round(v / 1_000)} тыс`;
  return String(v);
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

// «5 минут назад», «вчера в 14:10».
export function timeAgo(iso) {
  if (!iso) return 'ещё не было';
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (h < 48) return `вчера в ${time}`;
  return formatDate(iso);
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 6) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

// Сводные цифры по сайту для карточек.
export function siteStats(site) {
  const prices = (site.models || []).map((m) => m.price).filter((v) => typeof v === 'number');
  const benefits = (site.models || []).map((m) => m.max_benefit).filter((v) => typeof v === 'number');
  return {
    count: site.models?.length || 0,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxBenefit: benefits.length ? Math.max(...benefits) : null,
  };
}

export function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

// Технические ошибки браузера — простыми словами.
const ERRORS = [
  [/ERR_NAME_NOT_RESOLVED/, 'такого адреса нет или сайт выключен'],
  [/Timeout|timed out|ERR_TIMED_OUT/i, 'сайт слишком долго не отвечал'],
  [/ERR_CONNECTION_(REFUSED|RESET|CLOSED)/, 'сайт оборвал соединение'],
  [/ERR_CERT|SSL/i, 'проблема с сертификатом сайта'],
  [/HTTP_RESPONSE_CODE_FAILURE|403|blocked/i, 'сайт не пустил сборщик'],
];

export function humanize(text = '') {
  return text.replace(/(https?:\/\/\S+?):\s*(net::)?(\S+)[^;]*/g, (all, url, _n, code) => {
    const hit = ERRORS.find(([re]) => re.test(code) || re.test(all));
    return hit ? `${url.replace(/^https?:\/\//, '').replace(/\/$/, '')}: ${hit[1]}` : all;
  });
}
