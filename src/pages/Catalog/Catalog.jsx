import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import ArticleCard from '../../components/ArticleCard';
import { CATEGORIES, categoryCounts, subcategoryCounts } from '../../data/categories';
import { getArticlesByCategory, searchArticles, sortArticles } from '../../data/articles';
import { useContent } from '../../store/contentStore';
import { slugify } from '../../lib/slug';
import './Catalog.css';

const PAGE_SIZE = 9;
const SORTS = [
  { key: 'alpha', label: 'По алфавиту' },
  { key: 'date', label: 'По дате' },
  { key: 'popularity', label: 'По популярности' },
];

export default function Catalog() {
  const { categorySlug } = useParams();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const subSlug = searchParams.get('sub') || '';
  const [sortBy, setSortBy] = useState('alpha');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState({});
  const { articles, loading, error } = useContent();

  const activeCategory = CATEGORIES.find((c) => c.slug === categorySlug) || CATEGORIES[0];
  const activeSubcat =
    (!query && activeCategory.subcats?.find((s) => slugify(s) === subSlug)) || null;

  const totalCount = articles.length;
  const counts = useMemo(() => categoryCounts(articles), [articles]);
  const subCounts = useMemo(
    () => subcategoryCounts(articles, activeCategory.name),
    [articles, activeCategory.name]
  );

  const baseList = useMemo(() => {
    if (query) return searchArticles(articles, query);
    const list = getArticlesByCategory(articles, activeCategory.name);
    if (activeSubcat) return list.filter((a) => a.subcategory === activeSubcat);
    return list;
  }, [articles, query, activeCategory, activeSubcat]);

  const sorted = useMemo(() => sortArticles(baseList, sortBy), [baseList, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [query, activeCategory.slug, activeSubcat]);

  useEffect(() => {
    setExpanded((prev) => ({ ...prev, [activeCategory.slug]: true }));
  }, [activeCategory.slug]);

  function toggleExpanded(slug) {
    setExpanded((prev) => ({ ...prev, [slug]: !prev[slug] }));
  }

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function selectSort(key) {
    setSortBy(key);
    setPage(1);
  }

  return (
    <div className="page catalog-page">
      <Header showSearch searchPlaceholder="Поиск по каталогу…" />

      <div className="page-sheet">
      <div className="container catalog-title">
        <h1>Каталог статей</h1>
        <div className="catalog-title__subtitle">
          {totalCount} статей, распределённых по девяти разделам свода
        </div>
      </div>

      <main className="container catalog-main">
        <aside className="catalog-sidebar">
          <div className="catalog-sidebar__label">Разделы</div>
          {CATEGORIES.map((c) => {
            const isActive = !query && c.slug === activeCategory.slug;
            const isExpanded = !!expanded[c.slug];
            return (
              <div key={c.slug}>
                <div className={`catalog-sidebar__row${isActive ? ' catalog-sidebar__row--active' : ''}`}>
                  <Link
                    to={`/catalog/${c.slug}`}
                    className="catalog-sidebar__item"
                    onClick={() => setPage(1)}
                  >
                    <span>{c.name}</span>
                    <span className="catalog-sidebar__count">{counts.get(c.name) || 0}</span>
                  </Link>
                  {c.subcats ? (
                    <button
                      type="button"
                      className="catalog-sidebar__toggle"
                      onClick={() => toggleExpanded(c.slug)}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? `Свернуть ${c.name}` : `Развернуть ${c.name}`}
                    >
                      {isExpanded ? '▾' : '▸'}
                    </button>
                  ) : null}
                </div>
                {c.subcats && isExpanded ? (
                  <div className="catalog-sidebar__subcats">
                    {c.subcats.map((s) => {
                      const isSubActive = isActive && s === activeSubcat;
                      return (
                        <Link
                          key={s}
                          to={
                            isSubActive
                              ? `/catalog/${c.slug}`
                              : `/catalog/${c.slug}?sub=${slugify(s)}`
                          }
                          className={`catalog-sidebar__subitem${isSubActive ? ' catalog-sidebar__subitem--active' : ''}`}
                        >
                          <span>{s}</span>
                          {isActive ? (
                            <span className="catalog-sidebar__count">{subCounts.get(s) || 0}</span>
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </aside>

        <div>
          <div className="catalog-filterbar">
            <div className="catalog-filterbar__title">
              {query ? (
                <>
                  Результаты поиска «{query}»{' '}
                  <span className="catalog-filterbar__count">— {sorted.length} статей</span>
                </>
              ) : activeSubcat ? (
                <>
                  {activeCategory.name} · {activeSubcat}{' '}
                  <span className="catalog-filterbar__count">— {sorted.length} статей</span>
                </>
              ) : (
                <>
                  {activeCategory.name}{' '}
                  <span className="catalog-filterbar__count">
                    — {counts.get(activeCategory.name) || 0} статей
                  </span>
                </>
              )}
            </div>
            <div className="catalog-sort">
              <span>Сортировка:</span>
              {SORTS.map((s, i) => (
                <span key={s.key} className="catalog-sort__group">
                  {i > 0 && <span className="catalog-sort__dot">·</span>}
                  <button
                    type="button"
                    className={`catalog-sort__link${sortBy === s.key ? ' catalog-sort__link--active' : ''}`}
                    onClick={() => selectSort(s.key)}
                  >
                    {s.label}
                  </button>
                </span>
              ))}
            </div>
          </div>

          {error ? <div className="catalog-error">{error}</div> : null}

          {pageItems.length ? (
            <div className="catalog-grid">
              {pageItems.map((a) => (
                <ArticleCard key={a.slug} article={a} height={180} />
              ))}
            </div>
          ) : loading ? (
            <div className="catalog-empty">Свод открывается…</div>
          ) : (
            <div className="catalog-empty">Статей в этом разделе свода пока не найдено.</div>
          )}

          {pageCount > 1 ? (
            <div className="catalog-pagination">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`catalog-pagination__item${n === currentPage ? ' catalog-pagination__item--active' : ''}`}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </main>
      </div>

      <Footer />
    </div>
  );
}
