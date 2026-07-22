import { useState } from 'react';
import { useContent } from '../../store/contentStore';
import { EPOCH_PALETTE, bgForAccent } from '../../data/chronology';

const EMPTY_EVENT = { year: '', title: '', text: '' };

function newEpoch(index) {
  return {
    index,
    accent: EPOCH_PALETTE[index % EPOCH_PALETTE.length].accent,
    label: `Эпоха ${index + 1}`,
    kicker: `Эпоха ${index + 1}`,
    title: 'Новая эпоха',
    subtitle: '',
    events: [{ ...EMPTY_EVENT }],
  };
}

export default function ChronologyEditor() {
  const { epochs, setEpochs, resetEpochs } = useContent();
  const [openEpoch, setOpenEpoch] = useState(0);

  function updateEpoch(index, patch) {
    setEpochs((prev) => prev.map((ep, i) => (i === index ? { ...ep, ...patch } : ep)));
  }

  function removeEpoch(index) {
    setEpochs((prev) => prev.filter((_, i) => i !== index).map((ep, i) => ({ ...ep, index: i })));
  }

  function addEpoch() {
    setEpochs((prev) => {
      const next = [...prev, newEpoch(prev.length)];
      setOpenEpoch(next.length - 1);
      return next;
    });
  }

  function moveEpoch(index, delta) {
    setEpochs((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((ep, i) => ({ ...ep, index: i }));
    });
    setOpenEpoch(index + delta);
  }

  function updateEvent(epochIndex, eventIndex, patch) {
    setEpochs((prev) =>
      prev.map((ep, i) =>
        i === epochIndex
          ? {
              ...ep,
              events: ep.events.map((ev, j) => (j === eventIndex ? { ...ev, ...patch } : ev)),
            }
          : ep
      )
    );
  }

  function removeEvent(epochIndex, eventIndex) {
    setEpochs((prev) =>
      prev.map((ep, i) =>
        i === epochIndex ? { ...ep, events: ep.events.filter((_, j) => j !== eventIndex) } : ep
      )
    );
  }

  function addEvent(epochIndex) {
    setEpochs((prev) =>
      prev.map((ep, i) => (i === epochIndex ? { ...ep, events: [...ep.events, { ...EMPTY_EVENT }] } : ep))
    );
  }

  function moveEvent(epochIndex, eventIndex, delta) {
    setEpochs((prev) =>
      prev.map((ep, i) => {
        if (i !== epochIndex) return ep;
        const target = eventIndex + delta;
        if (target < 0 || target >= ep.events.length) return ep;
        const events = [...ep.events];
        [events[eventIndex], events[target]] = [events[target], events[eventIndex]];
        return { ...ep, events };
      })
    );
  }

  const current = epochs[openEpoch];

  return (
    <>
      <div className="editor-main__head">
        <h1>Хронология Арвари</h1>
        <div className="editor-main__autosave">Изменения сохраняются автоматически</div>
      </div>
      <div className="editor-main__subtitle">
        Эпохи и события ленты хронологии. Порядок эпох задаёт порядок прокрутки и смену фона.
      </div>

      <div className="editor-layout">
        <div className="editor-form">
          <div className="editor-card">
            <div className="editor-field__label">Эпохи</div>
            <div className="chrono-epoch-tabs">
              {epochs.map((ep, i) => (
                <button
                  type="button"
                  key={i}
                  className={`chrono-epoch-tab${i === openEpoch ? ' chrono-epoch-tab--active' : ''}`}
                  onClick={() => setOpenEpoch(i)}
                >
                  <span
                    className="chrono-epoch-tab__dot"
                    style={{ background: ep.accent }}
                  />
                  {ep.title || `Эпоха ${i + 1}`}
                </button>
              ))}
              <button type="button" className="chrono-epoch-tab chrono-epoch-tab--add" onClick={addEpoch}>
                + Эпоха
              </button>
            </div>
          </div>

          {current ? (
            <>
              <div className="editor-card">
                <div className="editor-card__head">
                  <div className="editor-field__label">Заголовок эпохи</div>
                  <div className="editor-item-controls">
                    <button
                      type="button"
                      title="Раньше в ленте"
                      onClick={() => moveEpoch(openEpoch, -1)}
                      disabled={openEpoch === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      title="Позже в ленте"
                      onClick={() => moveEpoch(openEpoch, 1)}
                      disabled={openEpoch === epochs.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      title="Удалить эпоху"
                      className="editor-item-controls__remove"
                      onClick={() => {
                        removeEpoch(openEpoch);
                        setOpenEpoch((n) => Math.max(0, n - 1));
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  className="editor-title-input"
                  value={current.title}
                  onChange={(e) => updateEpoch(openEpoch, { title: e.target.value })}
                  placeholder="Возрождение / Тёмные Века"
                />

                <div className="editor-field">
                  <div className="editor-field__label">Подпись сверху (годы)</div>
                  <input
                    type="text"
                    value={current.kicker}
                    onChange={(e) => updateEpoch(openEpoch, { kicker: e.target.value })}
                    placeholder="Эпоха I · 0–600 гг."
                  />
                </div>

                <div className="editor-field">
                  <div className="editor-field__label">Подзаголовок</div>
                  <input
                    type="text"
                    value={current.subtitle}
                    onChange={(e) => updateEpoch(openEpoch, { subtitle: e.target.value })}
                    placeholder="600 лет примитивного восстановления"
                  />
                </div>

                <div className="editor-field">
                  <div className="editor-card__head">
                    <div className="editor-field__label">Метка в шапке</div>
                    <span className="editor-card__hint">видна при прокрутке до эпохи</span>
                  </div>
                  <input
                    type="text"
                    value={current.label || ''}
                    onChange={(e) => updateEpoch(openEpoch, { label: e.target.value })}
                    placeholder="Эпоха I · Тёмные Века"
                  />
                </div>

                <div className="editor-field">
                  <div className="editor-field__label">Цвет эпохи (фон и акценты)</div>
                  <div className="chrono-accent-picker">
                    {EPOCH_PALETTE.map((p) => (
                      <button
                        type="button"
                        key={p.accent}
                        title={p.name}
                        className={`chrono-accent${current.accent === p.accent ? ' chrono-accent--active' : ''}`}
                        style={{ background: p.swatch }}
                        onClick={() => updateEpoch(openEpoch, { accent: p.accent })}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="editor-card">
                <div className="editor-card__head">
                  <div className="editor-field__label">События эпохи</div>
                  <span className="editor-card__hint">{current.events.length} на ленте</span>
                </div>

                <div className="chrono-events">
                  {current.events.map((ev, j) => (
                    <div className="chrono-event-row" key={j}>
                      <div className="chrono-event-row__head">
                        <span className="chrono-event-row__num" style={{ background: current.accent }} />
                        <div className="editor-item-controls">
                          <button
                            type="button"
                            title="Выше"
                            onClick={() => moveEvent(openEpoch, j, -1)}
                            disabled={j === 0}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            title="Ниже"
                            onClick={() => moveEvent(openEpoch, j, 1)}
                            disabled={j === current.events.length - 1}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            title="Удалить событие"
                            className="editor-item-controls__remove"
                            onClick={() => removeEvent(openEpoch, j)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <div className="chrono-event-row__grid">
                        <input
                          type="text"
                          value={ev.year}
                          onChange={(e) => updateEvent(openEpoch, j, { year: e.target.value })}
                          placeholder="450 г."
                        />
                        <input
                          type="text"
                          value={ev.title}
                          onChange={(e) => updateEvent(openEpoch, j, { title: e.target.value })}
                          placeholder="Племенные союзы"
                        />
                      </div>
                      <textarea
                        value={ev.text}
                        onChange={(e) => updateEvent(openEpoch, j, { text: e.target.value })}
                        placeholder="Что произошло в этот год…"
                      />
                    </div>
                  ))}
                </div>

                <button type="button" className="editor-add-fact" onClick={() => addEvent(openEpoch)}>
                  + Добавить событие
                </button>
              </div>
            </>
          ) : (
            <div className="editor-card editor-empty-note">
              Хронология пуста. Добавьте первую эпоху, чтобы начать ленту.
            </div>
          )}

          <div className="editor-actions">
            <button type="button" className="editor-actions__draft" onClick={resetEpochs}>
              Вернуть исходную хронологию
            </button>
          </div>
        </div>

        <aside className="editor-preview">
          <div className="editor-preview__label">Предпросмотр эпохи</div>
          {current ? (
            <div className="chrono-preview" style={{ background: bgForAccent(current.accent) }}>
              <div className="chrono-preview__kicker" style={{ color: current.accent }}>
                {current.kicker || 'Эпоха'}
              </div>
              <div className="chrono-preview__title">{current.title || 'Название эпохи'}</div>
              <div className="chrono-preview__subtitle">{current.subtitle}</div>
              <div className="chrono-preview__timeline">
                {current.events.map((ev, j) => (
                  <div className="chrono-preview__event" key={j}>
                    <span className="chrono-preview__dot" style={{ background: current.accent }} />
                    <div className="chrono-preview__year" style={{ color: current.accent }}>
                      {ev.year || 'год'}
                    </div>
                    <div className="chrono-preview__event-title">{ev.title || 'Событие'}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="editor-master-note">
            <span>ЗАМЕТКА МАСТЕРА</span>
            <br />
            Цвет эпохи задаёт фон страницы хронологии — он плавно сменяется при прокрутке до этой
            эпохи.
          </div>
        </aside>
      </div>
    </>
  );
}
