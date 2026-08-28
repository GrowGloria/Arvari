import { useEffect, useState } from 'react';
import {
  loadSuggestions,
  markSuggestionRead,
  deleteSuggestion,
  notifySuggestionsChanged,
} from '../../api/suggestions';

/** Разбор предложений от игроков — вкладка Мастера. */
export default function SuggestionsInbox() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await loadSuggestions();
        if (!cancelled) setItems(list);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Не удалось загрузить предложения.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleRead(item) {
    setItems((prev) => prev.map((s) => (s.id === item.id ? { ...s, read: !s.read } : s)));
    notifySuggestionsChanged();
    try {
      await markSuggestionRead(item.id, !item.read);
    } catch {
      /* откат не критичен — при перезагрузке подтянется актуальное */
    }
  }

  async function remove(id) {
    setItems((prev) => prev.filter((s) => s.id !== id));
    setConfirmId('');
    notifySuggestionsChanged();
    try {
      await deleteSuggestion(id);
    } catch {
      /* см. выше */
    }
  }

  const unread = items.filter((s) => !s.read).length;

  return (
    <>
      <div className="editor-main__head">
        <h1>Предложка</h1>
        <div className="editor-main__autosave">
          {unread ? `${unread} непрочитанных` : 'Всё прочитано'}
        </div>
      </div>
      <div className="editor-main__subtitle">Идеи и замечания, присланные игроками.</div>

      {loading ? (
        <div className="editor-card editor-empty-note">Загружаем предложения…</div>
      ) : error ? (
        <div className="editor-card editor-empty-note">{error}</div>
      ) : items.length === 0 ? (
        <div className="editor-card editor-empty-note">
          Пока пусто. Игроки оставляют предложения по ссылке «Предложить идею» в подвале сайта.
        </div>
      ) : (
        <div className="suggest-inbox">
          {items.map((s) => (
            <div className={`suggest-item${s.read ? ' suggest-item--read' : ''}`} key={s.id}>
              <div className="suggest-item__head">
                <span className="suggest-item__kind">{s.kind}</span>
                <span className="suggest-item__author">{s.author || 'Аноним'}</span>
                <span className="suggest-item__date">{formatDate(s.createdAt)}</span>
                {!s.read ? <span className="suggest-item__dot" title="Не прочитано" /> : null}
              </div>
              <div className="suggest-item__text">{s.text}</div>
              <div className="suggest-item__actions">
                <button type="button" onClick={() => toggleRead(s)}>
                  {s.read ? 'Отметить непрочитанным' : 'Прочитано'}
                </button>
                {confirmId === s.id ? (
                  <span className="suggest-item__confirm">
                    Удалить?
                    <button type="button" className="suggest-item__yes" onClick={() => remove(s.id)}>
                      Да
                    </button>
                    <button type="button" onClick={() => setConfirmId('')}>
                      Нет
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="suggest-item__delete"
                    onClick={() => setConfirmId(s.id)}
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
