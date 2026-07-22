import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import SearchBar from './SearchBar';
import { getRandomArticle } from '../data/articles';
import { useContent } from '../store/contentStore';
import './Header.css';

export default function Header({ showSearch = false, searchPlaceholder, rightSlot = null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { articles } = useContent();
  const onArticlePage = location.pathname.startsWith('/article/');

  function goToRandomArticle() {
    const article = getRandomArticle(articles);
    // Свод может быть пуст — тогда веди в каталог, а не в никуда.
    navigate(article ? `/article/${article.slug}` : '/catalog');
  }

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Logo />
        <nav className="site-header__nav">
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
          <NavLink to="/editor" className="site-header__link">
            Редактор ⚜
          </NavLink>
        </nav>
        {showSearch ? (
          <SearchBar variant="compact" placeholder={searchPlaceholder} />
        ) : (
          <div className="site-header__spacer" />
        )}
        {rightSlot}
      </div>
    </header>
  );
}
