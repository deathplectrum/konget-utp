// Цвета и подписи статусов. Названия совпадают с теми, что пишет сборщик.
export const STATUS = {
  'Ошибка доступа': { color: 'danger', short: 'Ошибка', emoji: '' },
  'Требует проверки': { color: 'warning', short: 'Проверить' },
  'Изменилось': { color: 'primary', short: 'Изменилось' },
  'Первая проверка': { color: 'tertiary', short: 'Первый сбор' },
  'Не изменилось': { color: 'success', short: 'Без изменений' },
  'Нет сценария': { color: 'medium', short: 'Нет сценария' },
};

export const ATTENTION = ['Ошибка доступа', 'Требует проверки'];

export function statusColor(change) {
  return STATUS[change]?.color || 'medium';
}

export function formatRub(v) {
  if (v === '-' || v === null || v === undefined) return '—';
  return `${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });
}
