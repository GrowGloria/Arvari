import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { coverStyle } from '../../lib/cover';
import { getArticleBySlug } from '../../data/articles';
import { useContent } from '../../store/contentStore';
import { useIsMaster } from '../../lib/auth';
import { uploadImage } from '../../api/uploads';
import { loadMap, saveMap } from '../../api/map';
import './Map.css';

const MARKER_TYPES = [
  { key: 'city', label: 'Город', icon: '🏰' },
  { key: 'village', label: 'Деревня', icon: '🏘' },
  { key: 'forest', label: 'Лес', icon: '🌲' },
  { key: 'ruins', label: 'Руины', icon: '🏚' },
  { key: 'temple', label: 'Храм', icon: '⛩' },
  { key: 'fortress', label: 'Крепость', icon: '⚔' },
  { key: 'water', label: 'Водоём', icon: '💧' },
  { key: 'cave', label: 'Пещера', icon: '⛰' },
];
const typeOf = (k) => MARKER_TYPES.find((t) => t.key === k) || MARKER_TYPES[0];
const uid = () => 'm-' + Math.random().toString(36).slice(2, 9);

export default function MapPage() {
  const master = useIsMaster();
  const { articles } = useContent();
  const [map, setMap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [placing, setPlacing] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const imgRef = useRef(null);
  const drag = useRef({ id: null, moved: false });

  useEffect(() => {
    loadMap()
      .then((m) => setMap(m && Array.isArray(m.markers) ? m : { image: '', markers: [] }))
      .catch(() => setMap({ image: '', markers: [] }))
      .finally(() => setLoading(false));
  }, []);

  const markers = map?.markers || [];
  const selected = markers.find((m) => m.id === selectedId) || null;
  const sortedArticles = useMemo(
    () => [...articles].sort((a, b) => a.title.localeCompare(b.title, 'ru')),
    [articles]
  );

  function change(next) {
    setMap(next);
    setDirty(true);
  }
  const patchMap = (patch) => change({ ...map, ...patch });
  const setMarkers = (next) => change({ ...map, markers: next });
  const updateMarker = (id, patch) =>
    setMarkers(markers.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const deleteMarker = (id) => {
    setMarkers(markers.filter((m) => m.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  function coordsFromEvent(e) {
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    return { x, y };
  }

  function onStageClick(e) {
    if (!master || !placing) return;
    const { x, y } = coordsFromEvent(e);
    const m = { id: uid(), x, y, type: placing, slug: '', label: '' };
    setMarkers([...markers, m]);
    setSelectedId(m.id);
  }

  function onMarkerPointerDown(e, m) {
    if (!master) return;
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* синтетические указатели могут не поддерживать захват */
    }
    drag.current = { id: m.id, moved: false };
  }
  function onMarkerPointerMove(e) {
    if (!drag.current.id) return;
    drag.current.moved = true;
    const { x, y } = coordsFromEvent(e);
    updateMarker(drag.current.id, { x, y });
  }
  function onMarkerPointerUp() {
    drag.current = { id: null, moved: false };
  }

  async function onUploadMap(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSaveError('');
    try {
      const url = await uploadImage(file);
      patchMap({ image: url });
    } catch (err) {
      setSaveError(err.message || 'Не удалось загрузить карту.');
    }
  }

  async function onSave() {
    setSaving(true);
    setSaveError('');
    try {
      await saveMap(map);
      setDirty(false);
    } catch (e) {
      setSaveError(e.message || 'Не удалось сохранить карту.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page map-page">
      <Header />
      <div className="page-sheet">
        <main className="map-main">
          <div className="map-head">
            <h1>Карта Арвари</h1>
            {master && map?.image ? (
              <div className="map-toolbar">
                <label className="map-btn">
                  Заменить карту
                  <input type="file" accept="image/*" hidden onChange={onUploadMap} />
                </label>
                <div className="map-types">
                  <span className="map-types__label">Метка:</span>
                  {MARKER_TYPES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      className={`map-type${placing === t.key ? ' map-type--on' : ''}`}
                      title={t.label}
                      onClick={() => setPlacing(placing === t.key ? '' : t.key)}
                    >
                      {t.icon}
                    </button>
                  ))}
                </div>
                <button type="button" className="map-save" onClick={onSave} disabled={saving || !dirty}>
                  {saving ? 'Сохраняем…' : dirty ? 'Сохранить карту' : 'Сохранено'}
                </button>
              </div>
            ) : null}
          </div>

          {saveError ? <div className="map-error">{saveError}</div> : null}
          {master && placing ? (
            <div className="map-hint">
              Кликните по карте, чтобы поставить метку «{typeOf(placing).label}». Метки можно
              перетаскивать. Нажмите значок ещё раз, чтобы выйти из режима.
            </div>
          ) : null}

          <div className="map-body">
            <div className="map-stage-wrap">
              {loading ? (
                <div className="map-empty">Загрузка карты…</div>
              ) : !map?.image ? (
                <div className="map-empty">
                  <span>Карта ещё не загружена.</span>
                  {master ? (
                    <label className="map-btn">
                      Загрузить карту
                      <input type="file" accept="image/*" hidden onChange={onUploadMap} />
                    </label>
                  ) : null}
                </div>
              ) : (
                <div
                  className={`map-stage${placing ? ' map-stage--placing' : ''}`}
                  onClick={onStageClick}
                >
                  <img
                    ref={imgRef}
                    className="map-img"
                    src={map.image}
                    alt="Карта Арвари"
                    draggable={false}
                  />
                  {markers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`map-marker${selectedId === m.id ? ' map-marker--sel' : ''}`}
                      style={{ left: `${m.x}%`, top: `${m.y}%` }}
                      title={m.label || typeOf(m.type).label}
                      onPointerDown={(e) => onMarkerPointerDown(e, m)}
                      onPointerMove={onMarkerPointerMove}
                      onPointerUp={onMarkerPointerUp}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(m.id);
                      }}
                    >
                      {typeOf(m.type).icon}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selected ? (
              <MapPanel
                marker={selected}
                master={master}
                articles={sortedArticles}
                article={getArticleBySlug(articles, selected.slug)}
                onClose={() => setSelectedId(null)}
                onUpdate={(patch) => updateMarker(selected.id, patch)}
                onDelete={() => deleteMarker(selected.id)}
              />
            ) : null}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}

function MapPanel({ marker, master, articles, article, onClose, onUpdate, onDelete }) {
  return (
    <aside className="map-panel">
      <button type="button" className="map-panel__close" onClick={onClose} aria-label="Закрыть">
        ×
      </button>

      {master ? (
        <div className="map-panel__edit">
          <label className="map-panel__field">
            <span>Тип метки</span>
            <select value={marker.type} onChange={(e) => onUpdate({ type: e.target.value })}>
              {MARKER_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="map-panel__field">
            <span>Статья</span>
            <select value={marker.slug} onChange={(e) => onUpdate({ slug: e.target.value })}>
              <option value="">— не привязана —</option>
              {articles.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.title}
                </option>
              ))}
            </select>
          </label>
          <label className="map-panel__field">
            <span>Подпись (необязательно)</span>
            <input
              value={marker.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder={typeOf(marker.type).label}
            />
          </label>
          <button type="button" className="map-panel__delete" onClick={onDelete}>
            ✕ Удалить метку
          </button>
          <div className="map-panel__divider" />
        </div>
      ) : null}

      {article ? (
        <Link to={`/article/${article.slug}`} className="map-preview">
          <div className="map-preview__cover" style={coverStyle(article.cover)} />
          <div className="map-preview__body">
            <div className="map-preview__kicker">{marker.label || typeOf(marker.type).label}</div>
            <div className="map-preview__title">{article.title}</div>
            <div className="map-preview__excerpt">{article.excerpt}</div>
            <div className="map-preview__cta">Открыть статью →</div>
          </div>
        </Link>
      ) : (
        <div className="map-preview map-preview--empty">
          {marker.slug
            ? 'Привязанная статья не найдена.'
            : master
              ? 'Выберите статью для метки в поле выше.'
              : 'К этой метке пока не привязана статья.'}
        </div>
      )}
    </aside>
  );
}
