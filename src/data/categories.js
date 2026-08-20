/**
 * Разделы свода. Счётчики здесь не хранятся — они считаются по фактическому
 * списку статей (см. categoryCounts), иначе цифры разъезжаются с реальностью.
 */
export const CATEGORIES = [
  {
    slug: 'personazhi',
    name: 'Персонажи',
    subcats: [
      'Правители',
      'Персонажи игроков',
      'Торговцы и ремесленники',
      'Легендарные личности',
      'Жрецы и служители',
      'Наёмники и воины',
      'Учёные и мудрецы',
      'Простой люд',
    ],
  },
  {
    slug: 'lokatsii',
    name: 'Локации',
    subcats: ['Города', 'Деревни', 'Замки', 'Леса', 'Водоёмы', 'Пещеры', 'Святые места'],
  },
  { slug: 'sobytiya', name: 'События' },
  { slug: 'sushchestva', name: 'Существа' },
  { slug: 'rasy', name: 'Расы' },
  { slug: 'fraktsii', name: 'Фракции' },
  {
    slug: 'artefakty',
    name: 'Артефакты',
    subcats: ['Амулеты', 'Доспехи', 'Оружие', 'Кольца', 'Музыкальные инструменты', 'Щиты', 'Другое'],
  },
  { slug: 'legendy', name: 'Легенды' },
  { slug: 'bogi', name: 'Боги' },
  { slug: 'gosudarstva', name: 'Государства' },
];

export function getCategoryBySlug(slug) {
  return CATEGORIES.find((c) => c.slug === slug);
}

/** Сколько статей в каждом разделе: название категории → число. */
export function categoryCounts(articles) {
  const counts = new Map(CATEGORIES.map((c) => [c.name, 0]));
  for (const article of articles) {
    if (counts.has(article.category)) {
      counts.set(article.category, counts.get(article.category) + 1);
    }
  }
  return counts;
}

/** Сколько статей в подкатегориях раздела: название подкатегории → число. */
export function subcategoryCounts(articles, categoryName) {
  const counts = new Map();
  for (const article of articles) {
    if (article.category !== categoryName || !article.subcategory) continue;
    counts.set(article.subcategory, (counts.get(article.subcategory) || 0) + 1);
  }
  return counts;
}
