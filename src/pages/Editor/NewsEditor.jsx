import { useState } from 'react';
import { useContent } from '../../store/contentStore';

const EMPTY_ITEM = { date: '', headline: '', blurb: '' };

export default function NewsEditor() {
  const { news, setNews, resetNews } = useContent();
  const [saved, setSaved] = useState(false);

  function touch(updater) {
    setNews(updater);
    setSaved(false);
  }

  function updateItem(index, patch) {
    touch((prev) => prev.map((n, i) => (i === index ? { ...n, ...patch } : n)));
  }

  function removeItem(index) {
    touch((prev) => prev.filter((_, i) => i !== index));
  }

  function addItem() {
    touch((prev) => [{ ...EMPTY_ITEM }, ...prev]);
  }

  function move(index, delta) {
    touch((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const preview = news.filter((n) => n.date || n.headline || n.blurb);

  return (
    <>
      <div className="editor-main__head">
        <h1>Вестники Арвари</h1>
        <div className="editor-main__autosave">Изменения сохраняются автоматически</div>
      </div>
      <div className="editor-main__subtitle">
        Свежие вести со всех пяти государств. Показываются в сайдбаре главной страницы.
      </div>

      <div className="editor-layout">
        <div className="editor-form">
          {news.length === 0 ? (
            <div className="editor-card editor-empty-note">
              Ни одной вести пока нет. Добавьте первую — она сразу появится на главной.
            </div>
          ) : null}

          {news.map((item, i) => (
            <div className="editor-card" key={i}>
              <div className="editor-card__head">
                <div className="editor-field__label">Весть {i + 1}</div>
                <div className="editor-item-controls">
                  <button
                    type="button"
                    title="Поднять выше"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    title="Опустить ниже"
                    onClick={() => move(i, 1)}
                    disabled={i === news.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    title="Удалить весть"
                    className="editor-item-controls__remove"
                    onClick={() => removeItem(i)}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="editor-field__label">Дата</div>
              <input
                type="text"
                value={item.date}
                onChange={(e) => updateItem(i, { date: e.target.value })}
                placeholder="Например: Сегодня, 2 дня назад, 412 ц."
              />

              <div className="editor-field">
                <div className="editor-field__label">Заголовок</div>
                <input
                  type="text"
                  value={item.headline}
                  onChange={(e) => updateItem(i, { headline: e.target.value })}
                  placeholder="Молчание Дланей длится уже третий месяц"
                />
              </div>

              <div className="editor-field">
                <div className="editor-field__label">Текст вести</div>
                <textarea
                  value={item.blurb}
                  onChange={(e) => updateItem(i, { blurb: e.target.value })}
                  placeholder="Одно-два предложения о том, что случилось в мире…"
                />
              </div>
            </div>
          ))}

          <div className="editor-actions">
            <button type="button" className="editor-actions__publish" onClick={addItem}>
              + Добавить весть
            </button>
            <button
              type="button"
              className="editor-actions__draft"
              onClick={() => {
                resetNews();
                setSaved(false);
              }}
            >
              Вернуть исходные
            </button>
            {saved ? <span className="editor-actions__success">✓ Сохранено</span> : null}
          </div>
        </div>

        <aside className="editor-preview">
          <div className="editor-preview__label">Предпросмотр сайдбара</div>
          <div className="news-card">
            <h3>Вестники Арвари</h3>
            <div className="news-card__subtitle">Свежие вести со всех пяти государств</div>
            <div className="news-card__list">
              {preview.length ? (
                preview.map((n, i) => (
                  <div className="news-item" key={i}>
                    <div className="news-item__date">{n.date || 'дата'}</div>
                    <div className="news-item__headline">{n.headline || 'Заголовок вести'}</div>
                    <div className="news-item__blurb">{n.blurb || 'Текст вести появится здесь…'}</div>
                  </div>
                ))
              ) : (
                <div className="news-item">
                  <div className="news-item__blurb">Вестей пока нет.</div>
                </div>
              )}
            </div>
          </div>

          <div className="editor-master-note">
            <span>ЗАМЕТКА МАСТЕРА</span>
            <br />
            Вести видны игрокам на главной сразу после изменения. Верхняя весть — самая свежая.
          </div>
        </aside>
      </div>
    </>
  );
}
