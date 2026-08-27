import { isMockMode, readLocal, writeLocal, request } from './client';
import { NEWS as DEFAULT_NEWS } from '../data/home';
import { EPOCHS as DEFAULT_EPOCHS } from '../data/chronology';

/**
 * Доступ к контенту свода: статьи, вестники, хронология.
 *
 * Мок-режим (VITE_API_URL пуст) держит всё в localStorage. Боевой режим ходит
 * в ручки бэкенда (docs/API.md). Компоненты работают одинаково в обоих —
 * ветвление спрятано здесь.
 */

const ARTICLES_KEY = 'arvari_articles';
const NEWS_KEY = 'arvari_news';
const CHRONO_KEY = 'arvari_chronology';

/* ---- Кэш свода в браузере (боевой режим) ----
 * Держит последнюю копию { articles, news, epochs } в localStorage, чтобы при
 * открытии показать контент мгновенно (поиск работает сразу, даже без сети), а
 * сеть дёргать в фоне. Если кэш свежий (< TTL) — запрос к серверу пропускаем,
 * это снимает лишнюю нагрузку с БД. Поле at — время последней загрузки с сервера.
 */
const CACHE_KEY = 'arvari_content_cache_v1';
export const CONTENT_TTL_MS = 90 * 1000;

export function readContentCache() {
  if (isMockMode) return null; // мок уже держит всё в localStorage
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data && Array.isArray(data.articles) ? data : null;
  } catch {
    return null;
  }
}

function writeCache(at, articles, news, epochs) {
  if (isMockMode) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at, articles, news, epochs }));
  } catch {
    /* переполнена квота — просто работаем без кэша */
  }
}

/** Записать свежую копию с сервера (сбрасывает TTL-таймер). */
export function markCacheFresh({ articles, news, epochs }) {
  writeCache(Date.now(), articles, news, epochs);
}

/** Обновить данные кэша (правки Мастера), НЕ трогая TTL-таймер. */
export function updateCacheData({ articles, news, epochs }) {
  const cur = readContentCache();
  writeCache(cur?.at ?? Date.now(), articles, news, epochs);
}

/** Первичная загрузка свода. */
export async function loadContent() {
  if (isMockMode) {
    return {
      articles: readLocal(ARTICLES_KEY, []),
      news: readLocal(NEWS_KEY, DEFAULT_NEWS),
      epochs: readLocal(CHRONO_KEY, DEFAULT_EPOCHS),
    };
  }

  const [articles, news, epochs] = await Promise.all([
    // auth:true — если Мастер вошёл, сервер добавит черновики; иначе только опубликованное.
    request('/articles', { auth: true }),
    request('/news'),
    request('/chronology'),
  ]);
  return { articles, news, epochs };
}

/** Перечитать только список статей (после входа/выхода Мастера — меняется видимость черновиков). */
export async function loadArticles() {
  if (isMockMode) return readLocal(ARTICLES_KEY, []);
  return request('/articles', { auth: true });
}

/* ---- Статьи (точечные операции) ---- */

export async function createArticle(article) {
  if (isMockMode) {
    const list = readLocal(ARTICLES_KEY, []);
    writeLocal(ARTICLES_KEY, [article, ...list.filter((a) => a.slug !== article.slug)]);
    return article;
  }
  return request('/articles', { method: 'POST', body: article, auth: true });
}

export async function updateArticle(slug, article) {
  if (isMockMode) {
    const list = readLocal(ARTICLES_KEY, []);
    const next = { ...article, slug };
    writeLocal(ARTICLES_KEY, list.map((a) => (a.slug === slug ? next : a)));
    return next;
  }
  return request(`/articles/${encodeURIComponent(slug)}`, { method: 'PUT', body: article, auth: true });
}

export async function removeArticle(slug) {
  if (isMockMode) {
    const list = readLocal(ARTICLES_KEY, []);
    writeLocal(ARTICLES_KEY, list.filter((a) => a.slug !== slug));
    return;
  }
  await request(`/articles/${encodeURIComponent(slug)}`, { method: 'DELETE', auth: true });
}

/** Отметить просмотр статьи (+1 к счётчику). Возвращает { views }. */
export async function registerView(slug) {
  if (isMockMode) {
    const list = readLocal(ARTICLES_KEY, []);
    let views = 0;
    const next = list.map((a) => {
      if (a.slug !== slug) return a;
      views = (a.views || 0) + 1;
      return { ...a, views };
    });
    writeLocal(ARTICLES_KEY, next);
    return { views };
  }
  return request(`/articles/${encodeURIComponent(slug)}/view`, { method: 'POST' });
}

/* ---- Вестники и хронология (целиковый список) ---- */

export async function saveNews(list) {
  if (isMockMode) {
    writeLocal(NEWS_KEY, list);
    return list;
  }
  return request('/news', { method: 'PUT', body: list, auth: true });
}

export async function saveEpochs(list) {
  if (isMockMode) {
    writeLocal(CHRONO_KEY, list);
    return list;
  }
  return request('/chronology', { method: 'PUT', body: list, auth: true });
}
