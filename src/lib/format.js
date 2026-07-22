const DAY_MS = 24 * 60 * 60 * 1000;

export function formatRelativeDate(dateStr) {
  const then = new Date(dateStr);
  const days = Math.max(0, Math.round((Date.now() - then.getTime()) / DAY_MS));
  if (days <= 0) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days < 5) return `${days} дня назад`;
  if (days < 7) return `${days} дней назад`;
  if (days < 14) return 'неделю назад';
  if (days < 30) return `${Math.floor(days / 7)} нед. назад`;
  const months = Math.floor(days / 30);
  return `${months} мес. назад`;
}

export function formatNumber(n) {
  return new Intl.NumberFormat('ru-RU').format(n);
}
