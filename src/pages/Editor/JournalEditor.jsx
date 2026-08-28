import { useContent } from '../../store/contentStore';

const EMPTY_ENTRY = { date: '', title: '', summary: '', body: '' };

export default function JournalEditor() {
  const { journal, setJournal, resetJournal } = useContent();

  function updateItem(index, patch) {
    setJournal((prev) => prev.map((n, i) => (i === index ? { ...n, ...patch } : n)));
  }

  function removeItem(index) {
    setJournal((prev) => prev.filter((_, i) => i !== index));
  }

  function addItem() {
    setJournal((prev) => [{ ...EMPTY_ENTRY }, ...prev]);
  }

  function move(index, delta) {
    setJournal((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <>
      <div className="editor-main__head">
        <h1>Журнал кампании</h1>
        <div className="editor-main__autosave">Изменения сохраняются автоматически</div>
      </div>
      <div className="editor-main__subtitle">
        Заметки по сыгранным сессиям. Верхняя запись — самая свежая. В тексте работают ссылки
        [[Название статьи]] — они ведут прямо на статьи свода.
      </div>

      <div className="editor-form">
        {journal.length === 0 ? (
          <div className="editor-card editor-empty-note">
            Записей пока нет. Добавьте первую — она появится в «Журнале».
          </div>
        ) : null}

        {journal.map((item, i) => (
          <div className="editor-card" key={i}>
            <div className="editor-card__head">
              <div className="editor-field__label">Запись {i + 1}</div>
              <div className="editor-item-controls">
                <button type="button" title="Поднять выше" onClick={() => move(i, -1)} disabled={i === 0}>
                  ↑
                </button>
                <button
                  type="button"
                  title="Опустить ниже"
                  onClick={() => move(i, 1)}
                  disabled={i === journal.length - 1}
                >
                  ↓
                </button>
                <button
                  type="button"
                  title="Удалить запись"
                  className="editor-item-controls__remove"
                  onClick={() => removeItem(i)}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="editor-field__label">Дата / номер сессии</div>
            <input
              type="text"
              value={item.date}
              onChange={(e) => updateItem(i, { date: e.target.value })}
              placeholder="Например: Сессия 12 · 28 августа"
            />

            <div className="editor-field">
              <div className="editor-field__label">Заголовок</div>
              <input
                type="text"
                value={item.title}
                onChange={(e) => updateItem(i, { title: e.target.value })}
                placeholder="Падение Альмерона"
              />
            </div>

            <div className="editor-field">
              <div className="editor-field__label">Краткое содержание</div>
              <input
                type="text"
                value={item.summary}
                onChange={(e) => updateItem(i, { summary: e.target.value })}
                placeholder="Одна строка о том, чем запомнилась сессия…"
              />
            </div>

            <div className="editor-field">
              <div className="editor-field__label">Заметки (разметка)</div>
              <textarea
                className="editor-journal-body"
                value={item.body}
                onChange={(e) => updateItem(i, { body: e.target.value })}
                placeholder={'Что произошло на сессии. Можно списками и ссылками [[Статья]].'}
              />
            </div>
          </div>
        ))}

        <div className="editor-actions">
          <button type="button" className="editor-actions__publish" onClick={addItem}>
            + Добавить запись
          </button>
          <button type="button" className="editor-actions__draft" onClick={resetJournal}>
            Вернуть исходные
          </button>
        </div>
      </div>
    </>
  );
}
