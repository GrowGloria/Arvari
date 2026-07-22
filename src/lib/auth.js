import { useEffect, useState } from 'react';
import { getToken } from '../api/client';

/**
 * Признак того, что в браузере есть токен Мастера.
 *
 * Это ТОЛЬКО про интерфейс: показать кнопки правки или спрятать. Настоящую
 * защиту даёт бэкенд, проверяя токен на каждой операции — подделать значение
 * в браузере тривиально.
 */

export const AUTH_EVENT = 'arvari-auth';

export function isMaster() {
  return !!getToken();
}

/** Оповещает компоненты в этой же вкладке (storage-событие только для других). */
export function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function useIsMaster() {
  const [master, setState] = useState(isMaster);
  useEffect(() => {
    const sync = () => setState(isMaster());
    window.addEventListener('storage', sync);
    window.addEventListener(AUTH_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(AUTH_EVENT, sync);
    };
  }, []);
  return master;
}
