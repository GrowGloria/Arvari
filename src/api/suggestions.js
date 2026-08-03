import { isMockMode, readLocal, writeLocal, request } from './client';

/**
 * Предложка — идеи от игроков.
 *
 * Отправлять может любой (без токена), читать и разбирать — только Мастер.
 *
 * ВАЖНО про мок-режим: предложение кладётся в localStorage ТОГО браузера, где
 * его отправили. То есть идея игрока с телефона не долетит до Мастера на другом
 * устройстве — это лишь демонстрация потока. По-настоящему предложка заработает,
 * когда появятся ручки /suggestions (см. docs/API.md).
 */

const KEY = 'arvari_suggestions';

const KINDS = ['Идея', 'Новая статья', 'Правка', 'Ошибка на сайте', 'Другое'];
export { KINDS as SUGGESTION_KINDS };

export async function submitSuggestion({ author, kind, text }) {
  const payload = {
    author: (author || '').trim(),
    kind: kind || KINDS[0],
    text: (text || '').trim(),
  };
  if (!payload.text) throw new Error('Напишите текст предложения.');

  if (isMockMode) {
    await new Promise((r) => setTimeout(r, 150));
    const item = {
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...payload,
      createdAt: new Date().toISOString(),
      read: false,
    };
    writeLocal(KEY, [item, ...readLocal(KEY, [])]);
    return item;
  }

  return request('/suggestions', { method: 'POST', body: payload });
}

/** Список предложений — только для Мастера. */
export async function loadSuggestions() {
  if (isMockMode) return readLocal(KEY, []);
  return request('/suggestions', { auth: true });
}

export async function markSuggestionRead(id, read) {
  if (isMockMode) {
    writeLocal(
      KEY,
      readLocal(KEY, []).map((s) => (s.id === id ? { ...s, read } : s))
    );
    return;
  }
  await request(`/suggestions/${id}`, { method: 'PATCH', body: { read }, auth: true });
}

export async function deleteSuggestion(id) {
  if (isMockMode) {
    writeLocal(
      KEY,
      readLocal(KEY, []).filter((s) => s.id !== id)
    );
    return;
  }
  await request(`/suggestions/${id}`, { method: 'DELETE', auth: true });
}
