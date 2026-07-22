/**
 * Транспорт до бэкенда.
 *
 * Пока VITE_API_URL пуст — работает мок-режим: сиды из src/data + localStorage.
 * Когда C#-бэкенд поднимется, достаточно задать VITE_API_URL в .env: функции
 * ресурсов (api/content.js, api/auth.js) переключатся на HTTP, компоненты
 * трогать не нужно. Контракт ручек описан в docs/API.md.
 */

export const API_URL = import.meta.env.VITE_API_URL || '';

/** Пока адрес API не задан — работаем на локальных данных. */
export const isMockMode = !API_URL;

const TOKEN_KEY = 'arvari_token';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* localStorage недоступен */
  }
}

/** Запрос к API. `auth: true` подставляет токен Мастера. */
export async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Сервер свода недоступен. Проверьте соединение.', 0);
  }

  if (res.status === 401 || res.status === 403) {
    setToken('');
    throw new ApiError('Доступ Мастера истёк — войдите заново.', res.status);
  }
  if (!res.ok) {
    throw new ApiError(await readError(res), res.status);
  }
  return res.status === 204 ? null : res.json();
}

async function readError(res) {
  try {
    const data = await res.json();
    return data.message || data.error || `Ошибка ${res.status}`;
  } catch {
    return `Ошибка ${res.status}`;
  }
}

/* ---- Мок-режим: хранилище в браузере ---- */

export function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Переполнена квота (частый случай — обложка, закодированная в строку).
    throw new ApiError('Не удалось сохранить: хранилище браузера переполнено.', 0);
  }
}
