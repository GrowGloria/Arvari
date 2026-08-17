import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { NEWS as DEFAULT_NEWS } from '../data/home';
import { EPOCHS as DEFAULT_EPOCHS } from '../data/chronology';
import {
  loadContent,
  createArticle,
  updateArticle,
  removeArticle,
  saveNews,
  saveEpochs,
} from '../api/content';

/**
 * Хранилище контента свода: статьи, вестники, хронология.
 *
 * Статьи пишутся точечно (создать/изменить/удалить). Вестники и хронология —
 * целиком, с дебаунсом (правок много, а список маленький). Транспорт и режим
 * (localStorage или бэкенд) спрятаны в src/api/content.
 */

const ContentContext = createContext(null);
const SAVE_DEBOUNCE_MS = 600;

export function ContentProvider({ children }) {
  const [news, setNews] = useState(DEFAULT_NEWS);
  const [epochs, setEpochs] = useState(DEFAULT_EPOCHS);
  const [articles, setArticles] = useState([]);
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
        setArticles(stored.articles);
        setError(null);
      } catch (e) {
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

  // Дебаунс-сохранение целиковых списков. Первый прогон после загрузки
  // пропускаем, чтобы не писать обратно только что прочитанное.
  useDebouncedSave(news, hydrated, saveNews, setSaveError);
  useDebouncedSave(epochs, hydrated, saveEpochs, setSaveError);

  const resetNews = useCallback(() => setNews(DEFAULT_NEWS), []);
  const resetEpochs = useCallback(() => setEpochs(DEFAULT_EPOCHS), []);

  /** Создаёт или (если передан editSlug) обновляет статью. Возвращает сохранённую. */
  const publishArticle = useCallback(async (article, editSlug = null) => {
    const saved = editSlug ? await updateArticle(editSlug, article) : await createArticle(article);
    setArticles((prev) => {
      const without = prev.filter((a) => a.slug !== saved.slug && a.slug !== editSlug);
      return [saved, ...without];
    });
    return saved;
  }, []);

  const deleteArticle = useCallback(async (slug) => {
    await removeArticle(slug);
    setArticles((prev) => prev.filter((a) => a.slug !== slug));
  }, []);

  const value = useMemo(
    () => ({
      news,
      setNews,
      resetNews,
      epochs,
      setEpochs,
      resetEpochs,
      articles,
      publishArticle,
      deleteArticle,
      loading,
      error,
      saveError,
    }),
    [news, epochs, resetNews, resetEpochs, articles, publishArticle, deleteArticle, loading, error, saveError]
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

function useDebouncedSave(value, hydrated, save, onError) {
  const skipFirst = useRef(true);
  useEffect(() => {
    if (!hydrated) return undefined;
    if (skipFirst.current) {
      skipFirst.current = false;
      return undefined;
    }
    const id = setTimeout(() => {
      save(value)
        .then(() => onError(null))
        .catch((e) => onError(e.message || 'Не удалось сохранить изменения.'));
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [value, hydrated, save, onError]);
}

// eslint-disable-next-line react-refresh/only-export-components -- провайдер и хук колокейтед намеренно
export function useContent() {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContent must be used within ContentProvider');
  return ctx;
}
