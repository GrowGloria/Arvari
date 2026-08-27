import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import SearchBar from './SearchBar';
import ThemeToggle from './ThemeToggle';
import { getRandomArticle } from '../data/articles';
import { useContent } from '../store/contentStore';
import { useHideOnScroll } from '../lib/useHideOnScroll';
import { useIsMaster } from '../lib/auth';
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
          {master ? (
            <NavLink to="/editor" className="site-header__link">
              Редактор ⚜
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
