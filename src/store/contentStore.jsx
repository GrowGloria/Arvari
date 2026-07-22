import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { NEWS as DEFAULT_NEWS } from '../data/home';
import { EPOCHS as DEFAULT_EPOCHS } from '../data/chronology';
import { mergeArticles } from '../data/articles';
import { loadContent, saveContent } from '../api/content';

/**
 * Хранилище редактируемого Мастером контента: вестники, хронология и
 * опубликованные статьи. Персистентность и транспорт вынесены в src/api —
 * при появлении C#-бэкенда меняется только он.
 */

const ContentContext = createContext(null);

export function ContentProvider({ children }) {
  const [news, setNews] = useState(DEFAULT_NEWS);
  const [epochs, setEpochs] = useState(DEFAULT_EPOCHS);
  const [userArticles, setUserArticles] = useState([]);
  const [deletedSlugs, setDeletedSlugs] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await loadContent();
        if (cancelled) return;
        setNews(stored.news);
        setEpochs(stored.epochs);
        setUserArticles(stored.articles);
        setDeletedSlugs(stored.deletedSlugs);
        setError(null);
      } catch (e) {
        // Свод остаётся на сид-данных, но пользователь должен знать о сбое.
        if (!cancelled) setError(e.message || 'Не удалось загрузить свод.');
      } finally {
        if (!cancelled) {
          setHydrated(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveContent({ news, epochs, articles: userArticles, deletedSlugs })
      .then(() => setSaveError(null))
      .catch((e) => setSaveError(e.message || 'Не удалось сохранить изменения.'));
  }, [news, epochs, userArticles, deletedSlugs, hydrated]);

  const resetNews = useCallback(() => setNews(DEFAULT_NEWS), []);
  const resetEpochs = useCallback(() => setEpochs(DEFAULT_EPOCHS), []);

  const publishArticle = useCallback((article) => {
    setUserArticles((prev) => [article, ...prev.filter((a) => a.slug !== article.slug)]);
    // Публикация под slug снимает возможную пометку удаления.
    setDeletedSlugs((prev) => prev.filter((s) => s !== article.slug));
  }, []);

  const deleteArticle = useCallback((slug) => {
    setUserArticles((prev) => prev.filter((a) => a.slug !== slug));
    setDeletedSlugs((prev) => (prev.includes(slug) ? prev : [...prev, slug]));
  }, []);

  const restoreDeleted = useCallback(() => setDeletedSlugs([]), []);

  // Полный список: статьи Мастера + сид (без дублей), минус удалённые.
  const articles = useMemo(
    () => mergeArticles(userArticles).filter((a) => !deletedSlugs.includes(a.slug)),
    [userArticles, deletedSlugs]
  );

  const value = useMemo(
    () => ({
      news,
      setNews,
      resetNews,
      epochs,
      setEpochs,
      resetEpochs,
      articles,
      userArticles,
      publishArticle,
      deleteArticle,
      restoreDeleted,
      deletedCount: deletedSlugs.length,
      loading,
      error,
      saveError,
    }),
    [
      news,
      epochs,
      resetNews,
      resetEpochs,
      articles,
      userArticles,
      publishArticle,
      deleteArticle,
      restoreDeleted,
      deletedSlugs.length,
      loading,
      error,
      saveError,
    ]
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- провайдер и хук колокейтед намеренно
export function useContent() {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContent must be used within ContentProvider');
  return ctx;
}
