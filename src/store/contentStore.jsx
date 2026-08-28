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
import { AUTH_EVENT, isMaster } from '../lib/auth';
import { logEvent } from '../api/analytics';
import {
  loadContent,
  loadArticles,
  createArticle,
  updateArticle,
  removeArticle,
  registerView as apiRegisterView,
  saveNews,
  saveEpochs,
  readContentCache,
  markCacheFresh,
  updateCacheData,
  CONTENT_TTL_MS,
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

    // 1) Мгновенно показываем последнюю копию из кэша — поиск и статьи готовы
    //    сразу, даже пока сеть «просыпается» (например, после включения телефона).
    const cached = readContentCache();
    if (cached) {
      setNews(cached.news ?? DEFAULT_NEWS);
      setEpochs(cached.epochs ?? DEFAULT_EPOCHS);
      setArticles(cached.articles);
      setLoading(false);
    }

    // 2) Свежий кэш (< TTL) — к серверу не ходим, снимаем нагрузку с БД.
    if (cached && Date.now() - cached.at < CONTENT_TTL_MS) {
      setHydrated(true);
      setLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    // 3) Иначе тихо обновляемся с сервера в фоне.
    (async () => {
      try {
        const stored = await loadContent();
        if (cancelled) return;
        setNews(stored.news);
        setEpochs(stored.epochs);
        setArticles(stored.articles);
        markCacheFresh(stored);
        setError(null);
      } catch (e) {
        // Есть кэш — переживём офлайн без ошибки; нет — показываем ошибку.
        if (!cancelled && !cached) setError(e.message || 'Не удалось загрузить свод.');
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

  // Держим кэш в согласии с состоянием (правки Мастера, счётчик просмотров),
  // не сбрасывая TTL-таймер последней серверной загрузки.
  useEffect(() => {
    if (hydrated) updateCacheData({ articles, news, epochs });
  }, [articles, news, epochs, hydrated]);

  // Одно событие «визит» на загрузку приложения (для статистики посещаемости).
  useEffect(() => {
    logEvent('visit');
  }, []);

  // Вход/выход Мастера меняет видимость черновиков — перечитываем список статей.
  useEffect(() => {
    function onAuth() {
      loadArticles()
        .then(setArticles)
        .catch(() => {});
    }
    window.addEventListener(AUTH_EVENT, onAuth);
    return () => window.removeEventListener(AUTH_EVENT, onAuth);
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

  /** Заменить статью в состоянии (после восстановления версии из истории). */
  const mergeArticle = useCallback((saved) => {
    setArticles((prev) => prev.map((a) => (a.slug === saved.slug ? saved : a)));
  }, []);

  /** Отметить просмотр статьи. Просмотры Мастера не считаем. */
  const registerView = useCallback(async (slug) => {
    if (isMaster()) return;
    try {
      const res = await apiRegisterView(slug);
      if (res && typeof res.views === 'number') {
        setArticles((prev) => prev.map((a) => (a.slug === slug ? { ...a, views: res.views } : a)));
      }
    } catch {
      /* просмотр не показали — и ладно */
    }
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
      mergeArticle,
      registerView,
      loading,
      error,
      saveError,
    }),
    [news, epochs, resetNews, resetEpochs, articles, publishArticle, deleteArticle, mergeArticle, registerView, loading, error, saveError]
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
