import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContent } from '../store/contentStore';
import './SearchBar.css';

const MAX_SUGGEST = 7;

// Сначала статьи, чьё название НАЧИНАЕТСЯ на введённое (аль → Альмерон),
// затем — те, что просто содержат подстроку. До MAX_SUGGEST штук.
function matchArticles(articles, q) {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const starts = [];
  const contains = [];
  for (const a of articles) {
    const t = (a.title || '').toLowerCase();
    if (t.startsWith(s)) starts.push(a);
    else if (t.includes(s)) contains.push(a);
  }
  return [...starts, ...contains].slice(0, MAX_SUGGEST);
}

export default function SearchBar({ variant = 'compact', placeholder = 'Искать по своду знаний…' }) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const navigate = useNavigate();
  const { articles } = useContent();
  const blurTimer = useRef(null);

  const suggestions = useMemo(() => matchArticles(articles, value), [articles, value]);
  const showList = open && suggestions.length > 0;

  function goSearch(q) {
    navigate(q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog');
    setOpen(false);
  }
  function goArticle(a) {
    navigate(`/article/${a.slug}`);
    setValue('');
    setOpen(false);
    setActive(-1);
  }

  function onSubmit(e) {
    e.preventDefault();
    if (showList && active >= 0 && suggestions[active]) {
      goArticle(suggestions[active]);
      return;
    }
    goSearch(value.trim());
  }

  function onKeyDown(e) {
    if (!showList) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <form className={`searchbar searchbar--${variant}`} onSubmit={onSubmit} autoComplete="off">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => value && setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        placeholder={placeholder}
        aria-label="Поиск по своду знаний"
        autoComplete="off"
      />
      {variant === 'large' ? <button type="submit">Искать</button> : null}

      {showList ? (
        // preventDefault на mousedown — чтобы клик по подсказке не убирал фокус
        // раньше, чем сработает переход.
        <div className="searchbar__suggest" onMouseDown={(e) => e.preventDefault()}>
          {suggestions.map((a, i) => (
            <button
              type="button"
              key={a.slug}
              className={`searchbar__suggest-item${i === active ? ' searchbar__suggest-item--active' : ''}`}
              onClick={() => goArticle(a)}
              onMouseEnter={() => setActive(i)}
            >
              <span className="searchbar__suggest-title">{a.title}</span>
              <span className="searchbar__suggest-cat">{a.category}</span>
            </button>
          ))}
        </div>
      ) : null}
    </form>
  );
}
