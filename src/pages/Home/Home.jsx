import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import SearchBar from '../../components/SearchBar';
import ArticleCard from '../../components/ArticleCard';
import ArticleRow from '../../components/ArticleRow';
import { sortArticles } from '../../data/articles';
import { CATEGORIES, categoryCounts } from '../../data/categories';
import { POPULAR_LIMIT, RECENT_LIMIT } from '../../data/home';
import { chronologyTeaser } from '../../data/chronology';
import { useContent } from '../../store/contentStore';
import { HERO_IMAGES, HERO_HOLD_MS } from './heroImages';
import { useCrossfade } from '../../lib/useCrossfade';
import './Home.css';

export default function Home() {
  const { news, articles, epochs } = useContent();
  const hero = useCrossfade(HERO_IMAGES, HERO_HOLD_MS);

  // Подборки считаются по самим статьям, а не по заранее забитому списку.
  const popular = useMemo(
    () => sortArticles(articles, 'popularity').slice(0, POPULAR_LIMIT),
    [articles]
  );
  const recent = useMemo(() => sortArticles(articles, 'date').slice(0, RECENT_LIMIT), [articles]);
  const teaser = useMemo(() => chronologyTeaser(epochs), [epochs]);

  const total = articles.length;
  const counts = useMemo(() => categoryCounts(articles), [articles]);

  return (
    <div className="page home-page">
      <Header />

      <section className="hero">
        <div className="hero__bg">
          {hero.slots.map((src, i) => (
            <div
              key={i}
              className="hero__layer"
              style={{
                backgroundImage: src ? `url('${src}')` : undefined,
                opacity: hero.active === i && src ? 1 : 0,
              }}
            />
          ))}
          <div className="hero__scrim" />
        </div>
        <div className="hero__content">
          <div className="hero__kicker">ЭНЦИКЛОПЕДИЯ МИРА</div>
          <h1 className="hero__title">АРВАРИ</h1>
          <SearchBar variant="large" placeholder="Искать по своду знаний: расы, боги, государства…" />
          <div className="hero__stats">
            <span>
              <strong>{total}</strong> статей в архиве
            </span>
          </div>
        </div>
      </section>

      <main className="container home-main">
        <div>
          <section className="home-section">
            <div className="home-section__head">
              <h2>Популярные статьи</h2>
              <Link to="/catalog">Весь каталог →</Link>
            </div>
            {popular.length ? (
              <div className="home-popular-grid">
                {popular.map((a) => (
                  <ArticleCard key={a.slug} article={a} />
                ))}
              </div>
            ) : (
              <div className="home-empty">
                Свод пока пуст. Первая запись появится здесь, как только Мастер её напишет.
              </div>
            )}
          </section>

          <section className="home-section">
            <div className="home-section__head">
              <h2>Последние открытые статьи</h2>
              <span className="home-section__count">{total} статей всего</span>
            </div>
            {recent.length ? (
              <div className="home-recent-list">
                {recent.map((a) => (
                  <ArticleRow key={a.slug} article={a} />
                ))}
              </div>
            ) : (
              <div className="home-empty">Записей пока нет.</div>
            )}
          </section>
        </div>

        <aside className="home-sidebar">
          <div className="news-card">
            <h3>Вестники Арвари</h3>
            <div className="news-card__subtitle">Свежие вести со всех пяти государств</div>
            <div className="news-card__list">
              {news.length === 0 ? (
                <div className="news-item">
                  <div className="news-item__blurb">Вестей пока нет.</div>
                </div>
              ) : null}
              {news.map((n, i) => (
                <div className="news-item" key={i}>
                  <div className="news-item__date">{n.date}</div>
                  <div className="news-item__headline">{n.headline}</div>
                  <div className="news-item__blurb">{n.blurb}</div>
                </div>
              ))}
            </div>
          </div>

          <Link to="/chronology" className="timeline-teaser">
            <div className="timeline-teaser__title">Хронология Арвари</div>
            <div className="timeline-teaser__subtitle">
              От первой искры цикла до Великой Тишины — все эпохи мира на одной ленте.
            </div>
            <div className="timeline-teaser__list">
              {teaser.map((t) => (
                <div className={`timeline-teaser__item timeline-teaser__item--${t.style}`} key={t.text}>
                  <span className="timeline-teaser__dot" style={{ background: t.dot }} />
                  <span className="timeline-teaser__year">{t.year}</span>
                  <span className="timeline-teaser__text">{t.text}</span>
                </div>
              ))}
            </div>
            <div className="timeline-teaser__cta">Открыть хронологию →</div>
          </Link>

          <div className="categories-card">
            <h3>Категории</h3>
            <div className="categories-card__list">
              {CATEGORIES.map((c) => (
                <Link to={`/catalog/${c.slug}`} className="categories-card__item" key={c.slug}>
                  <span>{c.name}</span>
                  <span className="categories-card__count">{counts.get(c.name) || 0}</span>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </main>

      <Footer />
    </div>
  );
}
