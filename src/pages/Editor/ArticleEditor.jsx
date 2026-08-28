import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { coverStyle } from '../../lib/cover';
import { uploadUrl } from '../../lib/assets';
import { CATEGORIES } from '../../data/categories';
import { ARTICLE_TEMPLATES } from '../../data/templates';
import { articleFromDraft } from '../../data/articles';
import { useContent } from '../../store/contentStore';
import { draftFromObsidian } from '../../lib/obsidianImport';
import { uploadImage } from '../../api/uploads';
import Markdown from '../../components/Markdown';

// Каждая кнопка тулбара оборачивает выделение или вставляет разметку.
// wrap — обёртка выделения; line — префикс строки; snippet — вставка с курсором.
const TOOLBAR = [
  { label: 'Ж', title: 'Жирный', wrap: ['**', '**'], className: 'md-btn--bold' },
  { label: 'К', title: 'Курсив', wrap: ['_', '_'], className: 'md-btn--italic' },
  { label: 'H2', title: 'Заголовок раздела', line: '## ' },
  { label: 'H3', title: 'Подзаголовок', line: '### ' },
  { label: 'Ссылка', title: 'Вики-ссылка на другую статью', wrap: ['[[', ']]'], placeholder: 'Название статьи' },
  { label: 'Изображение', title: 'Вставить изображение из архива', wrap: ['![[', ']]'], placeholder: 'файл.png' },
  { label: 'Цитата', title: 'Цитата', line: '> ' },
  { label: 'Список', title: 'Пункт списка', line: '- ' },
  { label: '─', title: 'Горизонтальная линия (разделитель)', snippet: '\n\n---\n\n' },
  {
    label: 'Табл.',
    title: 'Таблица',
    snippet: '\n\n| Заголовок 1 | Заголовок 2 |\n| --- | --- |\n| Ячейка | Ячейка |\n\n',
  },
];

const ARCHIVE_IMAGES = [
  { name: 'Элсалис', file: 'Элсалис пейзаж.png' },
  { name: 'Истмусленд', file: 'Истмусленд пейзаж.png' },
  { name: 'Кастацит', file: 'Кастацит пейзаж.png' },
  { name: 'Талифея', file: 'Талифея пейзаж.png' },
  { name: 'Эбрайт', file: 'Эбрайт пейзаж.png' },
  { name: 'Аргентум', file: 'Аргентум вид.png' },
  { name: 'Дер Мален', file: 'Дер Мален пейзаж.png' },
  { name: 'Граодал', file: 'Граодал пейзаж.png' },
].map((img) => ({ ...img, url: uploadUrl(img.file) }));

export default function ArticleEditor({ initial = null, editSlug = null }) {
  const editing = !!editSlug;
  const { publishArticle, articles, deleteArticle } = useContent();
  const bodyRef = useRef(null);
  const bodyImageInputRef = useRef(null);
  const [imgUploading, setImgUploading] = useState(false);
  const [wiki, setWiki] = useState(null); // автодополнение [[ссылок]]: { open, items, active }
  const [showPreview, setShowPreview] = useState(false);
  const [imported, setImported] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [filter, setFilter] = useState('');
  const [confirmingSlug, setConfirmingSlug] = useState('');
  const [title, setTitle] = useState(initial?.title || '');
  const [category, setCategory] = useState(initial?.category || CATEGORIES[0].name);
  const [subcategory, setSubcategory] = useState(initial?.subcategory || '');
  const [excerpt, setExcerpt] = useState(initial?.excerpt || '');
  const [body, setBody] = useState(initial?.body || '');
  const [draft, setDraft] = useState(!!initial?.draft);
  const [cover, setCover] = useState(initial?.cover || '');
  const [coverPos, setCoverPos] = useState(() => parsePosition(initial?.coverPosition));
  const [dragging, setDragging] = useState(false);
  const focusRef = useRef(null);
  const [publishedSlug, setPublishedSlug] = useState('');
  const [facts, setFacts] = useState(
    initial?.facts?.length
      ? initial.facts
      : [
          { label: '', value: '' },
          { label: '', value: '' },
          { label: '', value: '' },
        ]
  );

  const activeCategory = CATEGORIES.find((c) => c.name === category);
  const published = !!publishedSlug;

  function markDirty() {
    setPublishedSlug('');
  }

  const coverPosition = `${Math.round(coverPos.x)}% ${Math.round(coverPos.y)}%`;

  async function onPublish() {
    if (!title.trim() || saving) return;
    setSaving(true);
    setSaveError('');
    // В режиме правки сохраняем исходный slug, даже если название изменилось.
    const article = articleFromDraft(
      { title, category, subcategory, excerpt, body, cover, coverPosition, facts, draft },
      editSlug || undefined
    );
    try {
      // slug присваивает сервер — берём его из ответа.
      const saved = await publishArticle(article, editSlug || null);
      setPublishedSlug(saved.slug);
    } catch (e) {
      setSaveError(e.message || 'Не удалось сохранить статью.');
    } finally {
      setSaving(false);
    }
  }

  function pickCover(url) {
    setCover(url);
    setCoverPos({ x: 50, y: 50 }); // новый снимок — сбрасываем фокус в центр
    markDirty();
  }

  /** Заполняет форму из заметки Obsidian (.md). */
  function importNote(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const draft = draftFromObsidian(file.name, String(ev.target.result || ''));
      setTitle(draft.title);
      if (draft.category) setCategory(draft.category);
      setSubcategory(draft.subcategory);
      if (draft.excerpt) setExcerpt(draft.excerpt);
      setBody(draft.body);
      if (draft.cover) {
        setCover(uploadUrl(draft.cover));
        setCoverPos({ x: 50, y: 50 });
      }
      setImported({ name: file.name, category: draft.category, cover: draft.cover });
      markDirty();
    };
    reader.readAsText(file, 'utf-8');
  }

  function onDropNote(e) {
    e.preventDefault();
    setDragOver(false);
    const file = [...(e.dataTransfer?.files || [])].find((f) => /\.md$/i.test(f.name));
    if (file) importNote(file);
  }

  function setFocusFromEvent(e) {
    const rect = focusRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setCoverPos({ x, y });
    markDirty();
  }

  async function onCoverFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaveError('');
    try {
      // Загружаем на сервер (боевой режим) или получаем data-URL (мок).
      const url = await uploadImage(file);
      setCover(url);
      setCoverPos({ x: 50, y: 50 });
      markDirty();
    } catch (err) {
      setSaveError(err.message || 'Не удалось загрузить изображение.');
    }
  }

  // Вставляет текст в тело статьи по позиции курсора (или в конец в режиме
  // предпросмотра, когда textarea не смонтирован).
  function insertAtCursor(text) {
    const ta = bodyRef.current;
    if (!ta) {
      setBody((b) => b + text);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const current = ta.value;
    setBody(current.slice(0, start) + text + current.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  // Загружает картинку с компьютера и вставляет её в тело статьи готовой
  // разметкой ![[…]] (ссылка на файл в архиве мира).
  async function onBodyImageFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSaveError('');
    setImgUploading(true);
    try {
      const url = await uploadImage(file);
      insertAtCursor(`\n![[${url}]]\n`);
      markDirty();
    } catch (err) {
      setSaveError(err.message || 'Не удалось загрузить изображение.');
    } finally {
      setImgUploading(false);
    }
  }

  function updateFact(index, patch) {
    setFacts((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
    markDirty();
  }

  function removeFact(index) {
    setFacts((prev) => prev.filter((_, i) => i !== index));
  }

  function addFact() {
    setFacts((prev) => [...prev, { label: '', value: '' }]);
  }

  // Заполняет тело и поля инфобокса по шаблону (для новых статей).
  function applyTemplate(t) {
    if (body.trim() && !window.confirm('Заменить текущий текст и поля инфобокса шаблоном?')) return;
    setBody(t.body);
    setFacts(t.facts.map((f) => ({ ...f })));
    if (t.category) {
      setCategory(t.category);
      setSubcategory('');
    }
    markDirty();
  }

  // Применяет форматирование к выделению в textarea тела статьи.
  function applyFormat(btn) {
    if (btn.snippet) {
      insertAtCursor(btn.snippet);
      markDirty();
      return;
    }
    const ta = bodyRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = body.slice(start, end);
    let next;
    let caretStart;
    let caretEnd;

    if (btn.line) {
      // Префикс в начало каждой выделенной строки (или текущей).
      const lineStart = body.lastIndexOf('\n', start - 1) + 1;
      next = body.slice(0, lineStart) + btn.line + body.slice(lineStart);
      caretStart = caretEnd = end + btn.line.length;
    } else {
      const inner = selected || btn.placeholder || '';
      const [before, after] = btn.wrap;
      next = body.slice(0, start) + before + inner + after + body.slice(end);
      if (selected) {
        caretStart = start + before.length;
        caretEnd = caretStart + inner.length;
      } else {
        // Пусто — ставим курсор внутрь, выделяя подсказку.
        caretStart = start + before.length;
        caretEnd = caretStart + inner.length;
      }
    }

    setBody(next);
    markDirty();
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(caretStart, caretEnd);
    });
  }

  // ---- Автодополнение вики-ссылок [[…]] ----

  // Если курсор внутри незакрытой [[…, возвращает позицию [[ и введённый запрос.
  function wikiContext(text, caret) {
    const before = text.slice(0, caret);
    const open = before.lastIndexOf('[[');
    if (open === -1) return null;
    if (open >= 1 && before[open - 1] === '!') return null; // ![[ — это картинка, не ссылка
    const between = before.slice(open + 2);
    if (/[\]\n|[]/.test(between)) return null; // уже закрыто/алиас/другая скобка
    return { open, query: between };
  }

  function wikiItems(query) {
    const s = query.trim().toLowerCase();
    const sorted = [...articles].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    if (!s) return sorted.slice(0, 8);
    const starts = [];
    const contains = [];
    for (const a of sorted) {
      const t = (a.title || '').toLowerCase();
      if (t.startsWith(s)) starts.push(a);
      else if (t.includes(s)) contains.push(a);
    }
    return [...starts, ...contains].slice(0, 8);
  }

  function refreshWiki(text, caret) {
    const ctx = wikiContext(text, caret);
    if (!ctx) return setWiki(null);
    const items = wikiItems(ctx.query);
    if (!items.length) return setWiki(null);
    setWiki({ open: ctx.open, items, active: 0 });
  }

  function insertWiki(a) {
    const ta = bodyRef.current;
    if (!ta || !wiki || !a) return;
    const text = ta.value;
    const caret = ta.selectionStart;
    const end = text.slice(caret, caret + 2) === ']]' ? caret + 2 : caret;
    const replacement = `[[${a.title}]]`;
    setBody(text.slice(0, wiki.open) + replacement + text.slice(end));
    markDirty();
    setWiki(null);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = wiki.open + replacement.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function onBodyKeyDown(e) {
    if (!wiki) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setWiki((w) => ({ ...w, active: Math.min(w.active + 1, w.items.length - 1) }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setWiki((w) => ({ ...w, active: Math.max(w.active - 1, 0) }));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      insertWiki(wiki.items[wiki.active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setWiki(null);
    }
  }

  const wordCount = useMemo(() => (body.trim() ? body.trim().split(/\s+/).length : 0), [body]);
  const previewTitle = title || 'Название статьи';
  const previewExcerpt = excerpt || 'Краткое описание появится здесь…';
  const factsPreview = facts.filter((f) => f.label || f.value);

  const filteredArticles = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q
      ? articles.filter(
          (a) => a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
        )
      : articles;
    return [...list].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  }, [articles, filter]);

  async function confirmDelete(slug) {
    setConfirmingSlug('');
    try {
      await deleteArticle(slug);
      if (publishedSlug === slug) setPublishedSlug('');
    } catch (e) {
      setSaveError(e.message || 'Не удалось удалить статью.');
    }
  }

  return (
    <>
      <div className="editor-main__head">
        <h1>{editing ? 'Правка статьи' : 'Редактор статьи'}</h1>
        <div className="editor-main__autosave">Черновик сохраняется автоматически</div>
      </div>
      <div className="editor-main__subtitle">
        {editing
          ? 'Изменения применятся к существующей статье после сохранения.'
          : 'Новая запись свода знаний. Заполните карточку и текст статьи.'}
      </div>

      <div className="editor-layout">
        <div className="editor-form">
          <div
            className={`editor-import${dragOver ? ' editor-import--over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDropNote}
          >
            <div className="editor-import__text">
              <strong>Перетащите заметку .md из Obsidian</strong>
              <span>Название, категория, обложка и текст заполнятся сами</span>
            </div>
            <label className="editor-import__btn">
              Выбрать файл…
              <input
                type="file"
                accept=".md,text/markdown"
                hidden
                onChange={(e) => {
                  importNote(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {imported ? (
            <div className="editor-import__result">
              Загружено: <strong>{imported.name}</strong>
              {imported.category ? ` · раздел «${imported.category}» по тегам` : ' · раздел не определён по тегам — выберите вручную'}
              {imported.cover ? ` · обложка: ${imported.cover}` : ''}
            </div>
          ) : null}

          {!editing ? (
            <div className="editor-templates">
              <span className="editor-templates__label">Шаблон:</span>
              {ARTICLE_TEMPLATES.map((t) => (
                <button
                  type="button"
                  key={t.key}
                  className="editor-templates__btn"
                  onClick={() => applyTemplate(t)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="editor-card">
            <div className="editor-field__label">Название статьи</div>
            <input
              type="text"
              className="editor-title-input"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                markDirty();
              }}
              placeholder="Например: Керемос, Коваль Пламени"
            />
            <div className={activeCategory?.subcats ? 'editor-grid-2' : ''} style={{ marginTop: 16 }}>
              <div>
                <div className="editor-field__label">Категория</div>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setSubcategory('');
                  }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.slug}>{c.name}</option>
                  ))}
                </select>
              </div>
              {activeCategory?.subcats ? (
                <div>
                  <div className="editor-field__label">Подкатегория</div>
                  <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
                    <option value="">— не выбрана —</option>
                    {activeCategory.subcats.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
            <div className="editor-field">
              <div className="editor-field__label">Краткое описание (для карточки)</div>
              <textarea
                value={excerpt}
                onChange={(e) => {
                  setExcerpt(e.target.value);
                  markDirty();
                }}
                placeholder="Одно-два предложения для лицевой карточки статьи…"
              />
            </div>
          </div>

          <div className="editor-card">
            <div className="editor-field__label">Изображение на обложку</div>
            <div className="editor-cover-upload">
              <label className="editor-cover-upload__btn">
                Загрузить файл…
                <input type="file" accept="image/*" onChange={onCoverFile} hidden />
              </label>
              <span>или выберите из архива мира:</span>
            </div>
            <div className="editor-archive-grid">
              {ARCHIVE_IMAGES.map((img) => (
                <div
                  key={img.file}
                  className={`editor-archive-thumb${cover === img.url ? ' editor-archive-thumb--active' : ''}`}
                  onClick={() => pickCover(img.url)}
                >
                  <div
                    className="editor-archive-thumb__bg"
                    style={{ backgroundImage: `url('${img.url}')` }}
                  />
                  <div className="editor-archive-thumb__name">{img.name}</div>
                </div>
              ))}
            </div>

            {cover ? (
              <div className="editor-focus">
                <div className="editor-field__label">
                  Центр изображения — перетащите точку на важную часть
                </div>
                <div className="editor-focus__body">
                  <div
                    className="editor-focus__stage"
                    ref={focusRef}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setDragging(true);
                      setFocusFromEvent(e);
                    }}
                    onPointerMove={(e) => dragging && setFocusFromEvent(e)}
                    onPointerUp={() => setDragging(false)}
                    onPointerCancel={() => setDragging(false)}
                  >
                    <img className="editor-focus__img" src={cover} alt="Оригинал обложки" draggable={false} />
                    <div
                      className="editor-focus__marker"
                      style={{ left: `${coverPos.x}%`, top: `${coverPos.y}%` }}
                    />
                  </div>
                  <div className="editor-focus__crops">
                    <div className="editor-focus__crop-label">Как обрежется:</div>
                    <div className="editor-focus__crop editor-focus__crop--v" style={coverStyle({ image: cover, position: coverPosition })} />
                    <div className="editor-focus__crop editor-focus__crop--h" style={coverStyle({ image: cover, position: coverPosition })} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="editor-card">
            <div className="editor-card__head">
              <div className="editor-field__label">Блок краткой информации</div>
              <span className="editor-card__hint">показывается справа от статьи</span>
            </div>
            <div className="editor-facts">
              {facts.map((f, i) => (
                <div className="editor-facts__row" key={i}>
                  <input
                    type="text"
                    value={f.label}
                    onChange={(e) => updateFact(i, { label: e.target.value })}
                    placeholder="Поле (напр. Раса)"
                  />
                  <input
                    type="text"
                    value={f.value}
                    onChange={(e) => updateFact(i, { value: e.target.value })}
                    placeholder="Значение (напр. Человек)"
                  />
                  <button type="button" title="Удалить строку" onClick={() => removeFact(i)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="editor-add-fact" onClick={addFact}>
              + Добавить строку
            </button>
          </div>

          <div className="editor-card">
            <div className="editor-toolbar">
              {TOOLBAR.map((b) => (
                <button
                  type="button"
                  key={b.label}
                  title={b.title}
                  className={b.className}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyFormat(b)}
                >
                  {b.label}
                </button>
              ))}
              <button
                type="button"
                title="Загрузить картинку с компьютера — вставится в текст"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => bodyImageInputRef.current?.click()}
                disabled={imgUploading}
              >
                {imgUploading ? '⏳ Загрузка…' : '🖼 Загрузить'}
              </button>
              <input
                ref={bodyImageInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={onBodyImageFile}
              />
              <div className="editor-toolbar__spacer" />
              <button
                type="button"
                className={`editor-toolbar__preview${showPreview ? ' editor-toolbar__preview--on' : ''}`}
                onClick={() => setShowPreview((v) => !v)}
              >
                {showPreview ? 'Редактировать' : 'Предпросмотр'}
              </button>
            </div>
            {showPreview ? (
              <div className="editor-body-preview">
                {body.trim() ? (
                  <Markdown source={body} />
                ) : (
                  <span className="editor-body-preview__empty">Пусто — напишите текст статьи.</span>
                )}
              </div>
            ) : (
              <div className="editor-body-wrap">
                <textarea
                  ref={bodyRef}
                  className="editor-body"
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value);
                    markDirty();
                    refreshWiki(e.target.value, e.target.selectionStart);
                  }}
                  onKeyDown={onBodyKeyDown}
                  onKeyUp={(e) => {
                    if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key) && wiki) return;
                    refreshWiki(e.target.value, e.target.selectionStart);
                  }}
                  onClick={(e) => refreshWiki(e.target.value, e.target.selectionStart)}
                  onBlur={() => setTimeout(() => setWiki(null), 150)}
                  placeholder="Текст статьи в разметке Obsidian. Ссылки [[Название]] ведут на другие статьи, ![[файл.png]] вставляет изображение…"
                />
                {wiki ? (
                  <div className="editor-wiki-suggest" onMouseDown={(e) => e.preventDefault()}>
                    <div className="editor-wiki-suggest__hint">Ссылка на статью:</div>
                    {wiki.items.map((a, i) => (
                      <button
                        type="button"
                        key={a.slug}
                        className={`editor-wiki-suggest__item${i === wiki.active ? ' editor-wiki-suggest__item--active' : ''}`}
                        onClick={() => insertWiki(a)}
                        onMouseEnter={() => setWiki((w) => ({ ...w, active: i }))}
                      >
                        <span>{a.title}</span>
                        <span className="editor-wiki-suggest__cat">{a.category}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
            <div className="editor-body__footer">
              <span>{wordCount} слов</span>
              <span className="editor-body__hint">
                Разметка Obsidian: **жирный**, _курсив_, ## Заголовок, [[Ссылка]]. Картинку в
                текст — кнопкой «🖼 Загрузить».
              </span>
            </div>
          </div>

          <div className="editor-actions">
            <label
              className="editor-draft-toggle"
              title="Черновик виден только вам (Мастеру) — игроки его не увидят в каталоге, на главной и в поиске"
            >
              <input
                type="checkbox"
                checked={draft}
                onChange={(e) => {
                  setDraft(e.target.checked);
                  markDirty();
                }}
              />
              Черновик (не показывать игрокам)
            </label>
            <button
              type="button"
              className="editor-actions__publish"
              onClick={onPublish}
              disabled={!title.trim() || saving}
            >
              {saving
                ? 'Сохраняем…'
                : draft
                  ? 'Сохранить черновик'
                  : editing
                    ? 'Сохранить изменения'
                    : 'Опубликовать в свод'}
            </button>
            {published ? (
              <span className="editor-actions__success">
                {draft
                  ? '✓ Черновик сохранён'
                  : editing
                    ? '✓ Изменения сохранены'
                    : '✓ Статья в своде'}{' '}
                — <Link to={`/article/${publishedSlug}`}>открыть</Link>
              </span>
            ) : null}
            {saveError ? <span className="editor-actions__error">{saveError}</span> : null}
          </div>
        </div>

        <aside className="editor-preview">
          <div className="editor-preview__label">Предпросмотр карточки</div>
          <div className="editor-preview-card">
            <div
              className="editor-preview-card__cover"
              style={cover ? coverStyle({ image: cover, position: coverPosition }) : undefined}
            >
              {!cover && <div className="editor-preview-card__placeholder">[ обложка статьи ]</div>}
              <div className="editor-preview-card__badge">{subcategory || category}</div>
            </div>
            <div className="editor-preview-card__body">
              <div className="editor-preview-card__title">{previewTitle}</div>
              <div className="editor-preview-card__excerpt">{previewExcerpt}</div>
            </div>
          </div>

          {factsPreview.length > 0 ? (
            <div className="editor-preview-infobox">
              <div className="editor-preview-infobox__title">{previewTitle}</div>
              {factsPreview.map((f, i) => (
                <div className="editor-preview-infobox__row" key={i}>
                  <span>{f.label}</span>
                  <span>{f.value}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="editor-master-note">
            <span>ЗАМЕТКА МАСТЕРА</span>
            <br />
            Статья попадёт в каталог сразу после публикации. Игроки увидят её в разделе «Последние
            добавленные статьи».
          </div>
        </aside>
      </div>

      <div className="editor-card editor-manage">
        <div className="editor-card__head">
          <div className="editor-field__label">Существующие статьи — {articles.length}</div>
        </div>
        <input
          type="text"
          className="editor-manage__filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Поиск по названию или категории…"
        />
        <div className="editor-article-list">
          {filteredArticles.length === 0 ? (
            <div className="editor-manage__empty">Статей не найдено.</div>
          ) : (
            filteredArticles.map((a) => (
              <div className="editor-article-item" key={a.slug}>
                <div className="editor-article-item__meta">
                  <span className="editor-article-item__title">{a.title}</span>
                  <span className="editor-article-item__cat">
                    {a.subcategory ? `${a.category} · ${a.subcategory}` : a.category}
                    {a.draft ? ' · черновик' : ''}
                    {a.userCreated ? ' · новая' : ''}
                  </span>
                </div>
                {confirmingSlug === a.slug ? (
                  <div className="editor-article-item__confirm">
                    <span>Удалить?</span>
                    <button
                      type="button"
                      className="editor-article-item__yes"
                      onClick={() => confirmDelete(a.slug)}
                    >
                      Да
                    </button>
                    <button type="button" onClick={() => setConfirmingSlug('')}>
                      Нет
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="editor-article-item__delete"
                    title="Удалить статью"
                    onClick={() => setConfirmingSlug(a.slug)}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function parsePosition(str) {
  const m = /(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/.exec(str || '');
  return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 50, y: 50 };
}
