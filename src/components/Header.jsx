import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import SearchBar from './SearchBar';
import ThemeToggle from './ThemeToggle';
import { getRandomArticle } from '../data/articles';
import { useContent } from '../store/contentStore';
import { useHideOnScroll } from '../lib/useHideOnScroll';
import { useIsMaster } from '../lib/auth';
import { loadUnreadCount, SUGGESTIONS_EVENT } from '../api/suggestions';
import './Header.css';

export default function Header({ showSearch = false, searchPlaceholder, rightSlot = null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { articles } = useContent();
  const master = useIsMaster();
  const onArticlePage = location.pathname.startsWith('/article/');
  const hidden = useHideOnScroll();
  const [menuOpen, setMenuOpen] = useState(false);

  // Закрываем мобильное меню при переходе на другую страницу.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Бейдж непрочитанной «предложки» (только для Мастера), живо обновляется.
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!master) {
      setUnread(0);
      return undefined;
    }
    let cancelled = false;
    const refresh = () => loadUnreadCount().then((n) => !cancelled && setUnread(n));
    refresh();
    window.addEventListener(SUGGESTIONS_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(SUGGESTIONS_EVENT, refresh);
    };
  }, [master]);

  function goToRandomArticle() {
    const article = getRandomArticle(articles);
    // Свод может быть пуст — тогда веди в каталог, а не в никуда.
    navigate(article ? `/article/${article.slug}` : '/catalog');
  }

  return (
    <header className={`site-header${hidden ? ' site-header--hidden' : ''}`}>
      <div className="container site-header__inner">
        <Logo />
        <nav
          className={`site-header__nav${menuOpen ? ' site-header__nav--open' : ''}`}
          onClick={() => setMenuOpen(false)}
        >
          <NavLink to="/" end className="site-header__link">
            Главная
          </NavLink>
          <NavLink to="/catalog" className="site-header__link">
            Каталог
          </NavLink>
          <button
            type="button"
            onClick={goToRandomArticle}
            className={`site-header__link site-header__link--btn${onArticlePage ? ' site-header__link--active' : ''}`}
          >
            Случайная статья
          </button>
          <NavLink to="/chronology" className="site-header__link">
            Хронология
          </NavLink>
          <NavLink to="/journal" className="site-header__link">
            Журнал
          </NavLink>
          {master ? (
            <NavLink to="/editor" className="site-header__link">
              Редактор ⚜
              {unread > 0 ? <span className="site-header__badge">{unread}</span> : null}
            </NavLink>
          ) : null}
          {master ? (
            <NavLink to="/stats" className="site-header__link">
              Аналитика
            </NavLink>
          ) : null}
        </nav>
        {showSearch ? (
          <SearchBar variant="compact" placeholder={searchPlaceholder} />
        ) : (
          <div className="site-header__spacer" />
        )}
        <ThemeToggle />
        <button
          type="button"
          className="site-header__burger"
          aria-label={menuOpen ? 'Закрыть меню' : 'Меню'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
        {rightSlot}
      </div>
    </header>
  );
}
