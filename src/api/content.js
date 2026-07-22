import { isMockMode, readLocal, writeLocal, request } from './client';
import { NEWS } from '../data/home';
import { EPOCHS } from '../data/chronology';

/**
 * Редактируемый Мастером контент: статьи, вестники, хронология.
 *
 * Мок-режим держит всё одним значением в localStorage. Боевой режим ходит
 * в отдельные ручки — см. docs/API.md. Сигнатуры функций одинаковы в обоих
 * режимах, поэтому store и компоненты не меняются при переключении.
 */

const KEY = 'arvari_content';

export async function loadContent() {
  if (isMockMode) {
    const stored = readLocal(KEY, null);
    return {
      news: Array.isArray(stored?.news) ? stored.news : NEWS,
      epochs: Array.isArray(stored?.epochs) ? stored.epochs : EPOCHS,
      articles: Array.isArray(stored?.articles) ? stored.articles : [],
      deletedSlugs: Array.isArray(stored?.deletedSlugs) ? stored.deletedSlugs : [],
    };
  }

  const [articles, news, epochs] = await Promise.all([
    request('/articles'),
    request('/news'),
    request('/chronology'),
  ]);
  // deletedSlugs — костыль мок-режима: сид-статьи нельзя удалить физически.
  // На бэкенде удаление настоящее, поэтому список всегда пуст.
  return { articles, news, epochs, deletedSlugs: [] };
}

/**
 * Сохранение целиком — упрощение мок-режима.
 * На бэкенде вместо него вызываются точечные ручки:
 *   статья создана/изменена → POST /articles | PUT /articles/{slug}
 *   статья удалена          → DELETE /articles/{slug}
 *   вестники                → PUT /news
 *   хронология              → PUT /chronology
 */
export async function saveContent({ news, epochs, articles, deletedSlugs }) {
  if (isMockMode) {
    return writeLocal(KEY, { news, epochs, articles, deletedSlugs });
  }
  throw new Error('saveContent: в боевом режиме используйте точечные ручки (docs/API.md)');
}
