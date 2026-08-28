import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import NotFound from '../NotFound/NotFound';
import { coverStyle } from '../../lib/cover';
import { buildToc } from '../../lib/toc';
import { extractToc, extractWikiTargets } from '../../lib/markdown';
import { slugify } from '../../lib/slug';
import { formatNumber } from '../../lib/format';
import { useIsMaster } from '../../lib/auth';
import { loadRevisions, loadRevision, restoreRevision } from '../../api/content';
import { getArticleBySlug, resolveRelated } from '../../data/articles';
import { CATEGORIES } from '../../data/categories';
import { useContent } from '../../store/contentStore';
import Markdown from '../../components/Markdown';
import { useLightbox } from '../../components/Lightbox';
import './Article.css';

export default function Article() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const master = useIsMaster();
  const { open } = useLightbox();
  const { articles, deleteArticle, mergeArticle, loading, registerView } = useContent();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [tocOpen, setTocOpen] = useState(true);
  const viewedRef = useRef(null);
  const article = getArticleBySlug(articles, slug);

  // Открытие статьи — один засчитанный просмотр на slug (StrictMode/повторный
  // рендер не накрутят: ref держит уже отмеченный адрес).
  useEffect(() => {
    if (article && viewedRef.current !== slug) {
      viewedRef.current = slug;
      registerView(slug);
    }
  }, [article, slug, registerView]);

  // Обратные ссылки: какие статьи ссылаются на эту через [[…]].
  const backlinks = useMemo(() => {
    if (!article) return [];
    const slugMap = new Map();
    for (const a of articles) {
      slugMap.set(a.slug, a.slug);
      slugMap.set(slugify(a.title), a.slug);
    }
    return articles.filter(
      (a) =>
        a.slug !== article.slug &&
        a.markdown &&
        extractWikiTargets(a.markdown).some((t) => slugMap.get(slugify(t)) === article.slug)
    );
  }, [articles, article]);

  // Пока свод грузится, статьи ещё нет — показывать 404 рано.
  if (!article && loading) return <ArticleLoading />;
  if (!article) return <NotFound />;

  const categoryMeta = CATEGORIES.find((c) => c.name === article.category);
  const toc = article.markdown ? extractToc(article.markdown) : buildToc(article.blocks);
  const related = resolveRelated(articles, article.related);
  const lead = article.lead || article.excerpt;
  const infoboxRows = article.infobox?.rows || buildFallbackInfobox(article);
  const infoboxImage = article.infobox?.image || article.cover?.image || '';

  async function onDelete() {
    try {
      await deleteArticle(article.slug);
      navigate(categoryMeta ? `/catalog/${categoryMeta.slug}` : '/catalog');
    } catch (e) {
      alert(e.message || 'Не удалось удалить статью.');
    }
  }

  return (
    <div className="page article-page">
      <Header showSearch searchPlaceholder="Поиск по своду знаний…" />

      <div className="page-sheet">
      <div className="container article-breadcrumb">
        <Link to="/">Главная</Link> / <Link to="/catalog">Каталог</Link> /{' '}
        {categoryMeta ? (
          <Link to={`/catalog/${categoryMeta.slug}`}>{article.category}</Link>
        ) : (
          <span>{article.category}</span>
        )}{' '}
        / <span className="article-breadcrumb__current">{article.title}</span>
      </div>

      {article.draft ? (
        <div className="container article-draft-wrap">
          <div className="article-draft-note">
            ✎ Черновик — виден только вам. Игроки его не увидят, пока не снять отметку
            «Черновик» в редакторе.
          </div>
        </div>
      ) : null}

      {article.heroCaption ? (
        <div className="container article-hero-wrap">
          <div
            className={`article-hero${article.cover?.image ? ' article-hero--zoomable' : ''}`}
            style={coverStyle(article.cover)}
            onClick={() => article.cover?.image && open(article.cover.image, article.title)}
          >
            <div className="article-hero__scrim" />
            <div className="article-hero__caption">{article.heroCaption}</div>
          </div>
        </div>
      ) : null}

      <div className="container article-title-block">
        <div className="article-title-block__kicker">{article.tag || article.category}</div>
        <h1>{article.title}</h1>
        <p className="article-title-block__lead">{lead}</p>
        {(article.updatedLabel || article.views) && (
          <div className="article-title-block__meta">
            {[
              article.updatedLabel,
              article.views ? `${formatNumber(article.views)} просмотров` : null,
              article.edits ? `${article.edits} правок` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        )}
      </div>

      <main className="container article-main">
        <div>
          <div className="article-layout">
            {toc.length > 0 && (
              <nav className="article-toc">
                <div className="article-toc__head">
                  <span className="article-toc__label">Содержание</span>
                  <button
                    type="button"
                    className="article-toc__toggle"
                    onClick={() => setTocOpen((o) => !o)}
                  >
                    {tocOpen ? 'скрыть' : 'показать'}
                  </button>
                </div>
                {tocOpen && (
                  <ol className="article-toc__list">
                    {toc.map((t, i) => (
                      <li
                        key={i}
                        className={`article-toc__item${t.indent ? ' article-toc__sub' : ''}`}
                      >
                        <a href={t.href}>{t.label}</a>
                      </li>
                    ))}
                  </ol>
                )}
              </nav>
            )}

            <div className="art-body">
              {article.markdown ? (
                <Markdown source={article.markdown} />
              ) : article.blocks && article.blocks.length > 0 ? (
                article.blocks.map((block, i) => <ArticleBlock key={i} block={block} onZoom={open} />)
              ) : (
                <p className="article-stub">
                  Полный текст этой статьи ещё не переписан набело хранителем свода. Загляните
                  позже — или откройте другую запись в каталоге.
                </p>
              )}

              {article.seeAlso?.length ? (
                <div className="article-see-also">
                  <span className="article-see-also__label">См. также: </span>
                  {article.seeAlso.map((s, i) => (
                    <span key={s.slug}>
                      {i > 0 && ' · '}
                      <Link to={`/article/${s.slug}`}>{s.title}</Link>
                    </span>
                  ))}
                </div>
              ) : null}

              {master ? (
                <>
                  <div className="article-master-bar">
                    <span className="article-master-bar__label">⚜ Инструменты Мастера</span>
                    <div className="article-master-bar__actions">
                      <Link className="article-master-bar__edit" to={`/editor?edit=${article.slug}`}>
                        ✎ Редактировать
                      </Link>
                      <button
                        type="button"
                        className="article-master-bar__hist"
                        onClick={() => setShowHistory((v) => !v)}
                      >
                        🕓 История
                      </button>
                      {confirmDelete ? (
                        <span className="article-master-bar__confirm">
                          Удалить статью?
                          <button type="button" className="article-master-bar__yes" onClick={onDelete}>
                            Да
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(false)}>
                            Нет
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="article-master-bar__delete"
                          onClick={() => setConfirmDelete(true)}
                        >
                          ✕ Удалить
                        </button>
                      )}
                    </div>
                  </div>
                  {showHistory ? (
                    <RevisionsPanel
                      slug={article.slug}
                      onClose={() => setShowHistory(false)}
                      onRestore={mergeArticle}
                    />
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="article-sidebar">
          <div className="infobox">
            {infoboxImage ? (
              // Картинка любой ориентации показывается целиком; обрезается
              // только сверхвысокая — и то по выбранной Мастером точке фокуса.
              <img
                className="infobox__image"
                src={infoboxImage}
                alt={article.title}
                style={{ objectPosition: article.cover?.position || 'center' }}
                onClick={() => open(infoboxImage, article.title)}
              />
            ) : (
              <div className="infobox__cover" style={coverStyle(article.cover)} />
            )}
            <div className="infobox__body">
              <div className="infobox__title">{article.title}</div>
              {infoboxRows.map((r) => (
                <div className="infobox__row" key={r.label}>
                  <span className="infobox__label">{r.label}</span>
                  <span className="infobox__value">{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {related.length > 0 && (
            <div className="related-card">
              <div className="related-card__label">Связанные статьи</div>
              <div className="related-card__list">
                {related.map((r) => (
                  <Link to={`/article/${r.slug}`} className="related-card__item" key={r.slug}>
                    <div className="related-card__thumb" style={coverStyle(r.cover)} />
                    <div>
                      <div className="related-card__title">{r.title}</div>
                      <div className="related-card__category">{r.category}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {backlinks.length > 0 && (
            <div className="related-card">
              <div className="related-card__label">Упоминается в</div>
              <div className="related-card__list">
                {backlinks.map((b) => (
                  <Link to={`/article/${b.slug}`} className="related-card__item" key={b.slug}>
                    <div className="related-card__thumb" style={coverStyle(b.cover)} />
                    <div>
                      <div className="related-card__title">{b.title}</div>
                      <div className="related-card__category">{b.category}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </main>
      </div>

      <Footer />
    </div>
  );
}

function ArticleLoading() {
  return (
    <div className="page article-page">
      <Header showSearch searchPlaceholder="Поиск по своду знаний…" />
      <div className="page-sheet">
        <div className="container article-loading">Свод открывается…</div>
      </div>
      <Footer />
    </div>
  );
}

function ArticleBlock({ block, onZoom }) {
  if (block.type === 'heading') {
    const Tag = `h${block.level}`;
    return <Tag id={block.id || undefined}>{block.text}</Tag>;
  }
  if (block.type === 'illustration') {
    const zoomable = !!block.cover?.image;
    return (
      <div
        className={`article-illustration${zoomable ? ' article-illustration--zoomable' : ''}`}
        style={coverStyle(block.cover)}
        onClick={() => zoomable && onZoom(block.cover.image, block.caption)}
      >
        {!block.cover?.image && <div className="article-illustration__caption">[ иллюстрация: {block.caption} ]</div>}
      </div>
    );
  }
  return <p>{block.text}</p>;
}

function buildFallbackInfobox(article) {
  return [
    { label: 'Тип', value: article.category },
    article.tag && article.tag !== article.category ? { label: 'Метка', value: article.tag } : null,
  ].filter(Boolean);
}

function formatRevDate(iso) {
  try {
    return new Date(iso).toLocaleString('ru');
  } catch {
    return iso;
  }
}

function RevisionsPanel({ slug, onClose, onRestore }) {
  const [revs, setRevs] = useState(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadRevisions(slug)
      .then((r) => !cancelled && setRevs(r))
      .catch((e) => !cancelled && setError(e.message || 'Не удалось загрузить историю.'));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function show(id) {
    setPreview({ id, article: null });
    try {
      const a = await loadRevision(slug, id);
      setPreview({ id, article: a });
    } catch (e) {
      setError(e.message || 'Не удалось открыть версию.');
      setPreview(null);
    }
  }

  async function restore(id) {
    setBusy(true);
    try {
      const saved = await restoreRevision(slug, id);
      onRestore(saved);
      onClose();
    } catch (e) {
      setError(e.message || 'Не удалось восстановить.');
      setBusy(false);
    }
  }

  return (
    <div className="revisions">
      <div className="revisions__head">
        <span>История правок</span>
        <button type="button" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </div>
      {error ? <div className="revisions__error">{error}</div> : null}
      {!revs ? (
        <div className="revisions__empty">Загрузка…</div>
      ) : revs.length === 0 ? (
        <div className="revisions__empty">Версий пока нет — история копится с этого момента.</div>
      ) : (
        <div className="revisions__list">
          {revs.map((r, i) => (
            <div className="revisions__row" key={r.id}>
              <span className="revisions__date">
                {formatRevDate(r.createdAt)}
                {i === 0 ? ' · текущая' : ''}
              </span>
              <span className="revisions__actions">
                <button type="button" onClick={() => show(r.id)}>
                  Показать
                </button>
                {confirmId === r.id ? (
                  <>
                    <button type="button" className="revisions__yes" disabled={busy} onClick={() => restore(r.id)}>
                      Точно восстановить?
                    </button>
                    <button type="button" onClick={() => setConfirmId(null)}>
                      Отмена
                    </button>
                  </>
                ) : (
                  <button type="button" disabled={i === 0} onClick={() => setConfirmId(r.id)}>
                    Восстановить
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {preview ? (
        <div className="revisions__preview">
          <div className="revisions__preview-head">
            <span>Просмотр версии{preview.article ? ` — ${preview.article.title}` : ''}</span>
            <button type="button" onClick={() => setPreview(null)}>
              Скрыть
            </button>
          </div>
          {preview.article ? (
            <div className="revisions__preview-body">
              <Markdown source={preview.article.markdown || ''} />
            </div>
          ) : (
            <div className="revisions__empty">Загрузка…</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
