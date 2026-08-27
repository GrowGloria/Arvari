import { isMockMode, request } from './client';
import { isMaster } from '../lib/auth';

/**
 * Статистика: тихо (fire-and-forget) отправляем события на сервер.
 * type = 'visit' | 'search' | 'view'. В мок-режиме ничего не шлём.
 */

const VISITOR_KEY = 'arvari_visitor';

/** Анонимный id устройства — для примерного числа уникальных посетителей. */
export function visitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = 'v-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

export function logEvent(type, key) {
  // Не считаем действия самого Мастера — чтобы не искажать статистику.
  if (isMockMode || isMaster()) return;
  request('/events', { method: 'POST', body: { type, key, visitor: visitorId() } }).catch(() => {});
}

/** Сводка статистики (только Мастер). */
export function loadStats() {
  return request('/stats', { auth: true });
}
