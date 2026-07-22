import { slugify } from '../lib/slug';

/**
 * Статьи свода.
 *
 * Демонстрационных записей здесь нет: контент приходит из редактора Мастера
 * (мок-режим — localStorage) или с бэкенда, когда задан VITE_API_URL.
 * Оставлен пустой список-основа, чтобы фронтенд работал до появления данных.
 */
const RAW_ARTICLES = [];


/** Сид-статьи. Полный список (сид + опубликованные Мастером) отдаёт store. */
export const SEED_ARTICLES = RAW_ARTICLES.map((a) => ({
  slug: a.slug || slugify(a.title),
  ...a,
}));

/** Список статей + опубликованные Мастером перекрывают сид по slug. */
export function mergeArticles(userArticles = []) {
  const userSlugs = new Set(userArticles.map((a) => a.slug));
  return [...userArticles, ...SEED_ARTICLES.filter((a) => !userSlugs.has(a.slug))];
}

export function getArticleBySlug(list, slug) {
  return list.find((a) => a.slug === slug);
}

export function getArticlesByCategory(list, categoryName) {
  return list.filter((a) => a.category === categoryName);
}

export function resolveRelated(list, slugs) {
  const bySlug = new Map(list.map((a) => [a.slug, a]));
  return (slugs || []).map((s) => bySlug.get(s)).filter(Boolean);
}

export function getRandomArticle(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function searchArticles(list, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return list.filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      a.excerpt.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q)
  );
}

export function sortArticles(list, sortBy) {
  const copy = [...list];
  if (sortBy === 'date') return copy.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (sortBy === 'popularity') return copy.sort((a, b) => (b.views || 0) - (a.views || 0));
  return copy.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
}

/**
 * Собирает объект статьи из черновика редактора.
 * Тело хранится как сырой Markdown (диалект Obsidian) и рендерится на странице
 * статьи компонентом Markdown — с заголовками, списками, вставками и
 * кликабельными вики-ссылками [[…]].
 */
export function articleFromDraft(draft, slugOverride) {
  const slug = slugOverride || slugify(draft.title) || `statya-${Date.now()}`;
  const facts = (draft.facts || []).filter((f) => f.label || f.value);
  const excerpt = (draft.excerpt || '').trim();

  return {
    slug,
    title: (draft.title || '').trim() || 'Без названия',
    category: draft.category,
    subcategory: draft.subcategory || undefined,
    tag: draft.subcategory || draft.category,
    excerpt,
    cover: draft.cover
      ? { image: draft.cover, position: draft.coverPosition || undefined }
      : { gradient: 'var(--grad-1)' },
    date: new Date().toISOString().slice(0, 10),
    views: 0,
    edits: 1,
    updatedLabel: 'Обновлено сегодня',
    lead: excerpt || undefined,
    markdown: (draft.body || '').trim(),
    infobox: facts.length ? { image: draft.cover || undefined, rows: facts } : undefined,
    userCreated: true,
  };
}

/** Разворачивает статью обратно в черновик редактора (для режима правки). */
export function articleToDraft(article) {
  const facts = (article.infobox?.rows || []).map((r) => ({ label: r.label, value: r.value }));
  return {
    title: article.title || '',
    category: article.category || '',
    subcategory: article.subcategory || '',
    excerpt: article.excerpt || '',
    cover: article.cover?.image || article.infobox?.image || '',
    coverPosition: article.cover?.position || '',
    facts: facts.length ? facts : [{ label: '', value: '' }],
    body: article.markdown || blocksToMarkdown(article.blocks) || '',
  };
}

/** Обратная конвертация структурных блоков сид-статьи в Markdown-текст. */
function blocksToMarkdown(blocks) {
  if (!Array.isArray(blocks)) return '';
  return blocks
    .map((b) => {
      if (b.type === 'heading') return `${'#'.repeat(b.level)} ${b.text}`;
      if (b.type === 'illustration') {
        const file = b.cover?.image ? decodeURIComponent(b.cover.image.split('/').pop()) : '';
        return file ? `![[${file}]]` : '';
      }
      return b.text || '';
    })
    .filter(Boolean)
    .join('\n\n');
}
