import Header from '../../components/Header';
import Footer from '../../components/Footer';
import Markdown from '../../components/Markdown';
import { useContent } from '../../store/contentStore';
import './Journal.css';

/**
 * Журнал кампании — лента записей по игровым сессиям. Свежая запись сверху.
 * Тело каждой записи — обсидиановая разметка, поэтому в заметках работают
 * ссылки [[Статья]] прямо на статьи свода.
 */
export default function Journal() {
  const { journal, loading } = useContent();
  const entries = (journal || []).filter((e) => e && (e.title || e.body || e.summary));

  return (
    <div className="page journal-page">
      <Header showSearch searchPlaceholder="Поиск по своду…" />

      <div className="page-sheet">
        <main className="container journal-main">
          <div className="journal-hero">
            <div className="journal-hero__kicker">Хроника похода</div>
            <h1 className="journal-hero__title">Журнал кампании</h1>
            <p className="journal-hero__subtitle">
              Заметки Мастера по сыгранным сессиям — что случилось с отрядом и куда качнулся мир.
            </p>
          </div>

          {entries.length === 0 ? (
            <div className="journal-empty">
              {loading ? 'Загружаем журнал…' : 'Записей пока нет. Первая сессия ещё впереди.'}
            </div>
          ) : (
            <div className="journal-timeline">
              {entries.map((entry, i) => (
                <article className="journal-entry" key={i}>
                  <div className="journal-entry__rail">
                    <span className="journal-entry__dot" />
                  </div>
                  <div className="journal-entry__body">
                    {entry.date ? <div className="journal-entry__date">{entry.date}</div> : null}
                    {entry.title ? <h2 className="journal-entry__title">{entry.title}</h2> : null}
                    {entry.summary ? (
                      <div className="journal-entry__summary">{entry.summary}</div>
                    ) : null}
                    {entry.body ? (
                      <div className="journal-entry__text">
                        <Markdown source={entry.body} />
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}
