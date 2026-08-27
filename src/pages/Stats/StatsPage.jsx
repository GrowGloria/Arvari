import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useIsMaster } from '../../lib/auth';
import { useContent } from '../../store/contentStore';
import { loadStats } from '../../api/analytics';
import './Stats.css';

const fmt = (n) => new Intl.NumberFormat('ru').format(n || 0);

export default function StatsPage() {
  const master = useIsMaster();
  const { articles } = useContent();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!master) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadStats()
      .then(setStats)
      .catch((e) => setError(e.message || 'Не удалось загрузить статистику.'))
      .finally(() => setLoading(false));
  }, [master]);

  const titleBySlug = useMemo(() => {
    const m = new Map();
    for (const a of articles) m.set(a.slug, a.title);
    return m;
  }, [articles]);

  function download() {
    const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arvari-stats-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page stats-page">
      <Header />
      <div className="page-sheet">
        <main className="stats-main">
          <div className="stats-head">
            <h1>Аналитика</h1>
            {stats ? (
              <button type="button" className="stats-download" onClick={download}>
                Скачать JSON
              </button>
            ) : null}
          </div>

          {!master ? (
            <div className="stats-empty">
              Раздел доступен только Мастеру. <Link to="/editor">Войти</Link>
            </div>
          ) : loading ? (
            <div className="stats-empty">Собираем цифры…</div>
          ) : error ? (
            <div className="stats-empty stats-empty--error">{error}</div>
          ) : stats ? (
            <>
              <div className="stats-tiles">
                <Tile label="Просмотры статей" value={stats.views.total} sub={`+${fmt(stats.views.last7)} за 7 дней`} />
                <Tile
                  label="Уникальные посетители"
                  value={stats.visits.uniqueTotal}
                  sub={`${fmt(stats.visits.total)} визитов всего`}
                />
                <Tile label="Визиты за 7 дней" value={stats.visits.last7} />
                <Tile label="Поисков" value={stats.searches.total} sub={`+${fmt(stats.searches.last7)} за 7 дней`} />
              </div>

              <div className="stats-cols">
                <section className="stats-block">
                  <h2>Просмотры по дням (14)</h2>
                  <Bars data={stats.views.perDay.map((d) => ({ label: d.date.slice(5), value: d.count }))} />
                </section>
                <section className="stats-block">
                  <h2>Визиты по дням (14)</h2>
                  <Bars
                    data={stats.visits.perDay.map((d) => ({ label: d.date.slice(5), value: d.count, sub: d.unique }))}
                  />
                </section>
              </div>

              <div className="stats-cols">
                <section className="stats-block">
                  <h2>Топ статей (30 дней)</h2>
                  <RankList
                    items={stats.views.top.map((t) => ({
                      name: titleBySlug.get(t.slug) || t.slug,
                      to: `/article/${t.slug}`,
                      count: t.count,
                    }))}
                    empty="Пока нет просмотров."
                  />
                </section>
                <section className="stats-block">
                  <h2>Что искали (30 дней)</h2>
                  <RankList
                    items={stats.searches.top.map((t) => ({ name: t.query, count: t.count }))}
                    empty="Пока нет поисков."
                  />
                </section>
              </div>

              <section className="stats-block">
                <h2>Последние запросы</h2>
                {stats.searches.recent.length ? (
                  <div className="stats-recent">
                    {stats.searches.recent.map((r, i) => (
                      <span className="stats-recent__item" key={i}>
                        {r.query}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="stats-empty">Пока пусто.</div>
                )}
              </section>

              <div className="stats-note">Данные считаются по событиям с этого сервера. Окно графиков — 14 дней, топы — 30 дней.</div>
            </>
          ) : null}
        </main>
      </div>
      <Footer />
    </div>
  );
}

function Tile({ label, value, sub }) {
  return (
    <div className="stats-tile">
      <div className="stats-tile__value">{fmt(value)}</div>
      <div className="stats-tile__label">{label}</div>
      {sub ? <div className="stats-tile__sub">{sub}</div> : null}
    </div>
  );
}

function Bars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="stats-bars">
      {data.map((d, i) => (
        <div
          className="stats-bar"
          key={i}
          title={`${d.label}: ${d.value}${d.sub != null ? ` (${d.sub} уник.)` : ''}`}
        >
          <div className="stats-bar__track">
            <div className="stats-bar__fill" style={{ height: `${(d.value / max) * 100}%` }} />
          </div>
          <div className="stats-bar__label">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function RankList({ items, empty }) {
  if (!items.length) return <div className="stats-empty">{empty}</div>;
  return (
    <div className="stats-rank">
      {items.map((it, i) => (
        <div className="stats-rank__row" key={i}>
          <span className="stats-rank__name">{it.to ? <Link to={it.to}>{it.name}</Link> : it.name}</span>
          <span className="stats-rank__count">{fmt(it.count)}</span>
        </div>
      ))}
    </div>
  );
}
