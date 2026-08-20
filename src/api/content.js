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
    request('/articles'),
    request('/news'),
    request('/chronology'),
  ]);
  return { articles, news, epochs };
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
