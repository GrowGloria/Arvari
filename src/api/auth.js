import { ApiError, isMockMode, request, setToken } from './client';
import { notifyAuthChanged } from '../lib/auth';

/**
 * Вход Мастера.
 *
 * ВНИМАНИЕ, мок-режим — не защита. Слово-ключ ниже лежит в коде фронтенда,
 * то есть доступен любому, кто откроет исходники страницы. Это заглушка на
 * время разработки.
 *
 * Когда появится бэкенд:
 *   1. Задать VITE_API_URL — ветка мока перестанет выполняться.
 *   2. Удалить MOCK_PASSPHRASE вместе с веткой isMockMode.
 *   3. Главное: бэкенд обязан проверять токен на КАЖДОЙ операции правки.
 *      Фронтенд лишь прячет кнопки — он не может никого ограничить.
 */

const MOCK_PASSPHRASE = 'арвари';
const MOCK_TOKEN = 'mock-master-token';

export async function login(name, passphrase) {
  if (isMockMode) {
    await new Promise((r) => setTimeout(r, 150));
    if ((passphrase || '').trim().toLowerCase() !== MOCK_PASSPHRASE) {
      throw new ApiError('Слово-ключ не подошло. Архив остаётся запечатан.', 401);
    }
    setToken(MOCK_TOKEN);
    notifyAuthChanged();
    return { name: (name || '').trim() || 'Мастер' };
  }

  const data = await request('/auth/login', {
    method: 'POST',
    body: { name, passphrase },
  });
  setToken(data.token);
  notifyAuthChanged();
  return { name: data.name };
}

export function logout() {
  setToken('');
  notifyAuthChanged();
}
