import { Link } from 'react-router-dom';
import { coverStyle } from '../lib/cover';
import './ArticleCard.css';

export default function ArticleCard({ article, badge, height = 120 }) {
  return (
    <Link to={`/article/${article.slug}`} className="article-card">
      <div className="article-card__cover" style={{ ...coverStyle(article.cover), height }}>
        {article.draft ? <span className="article-card__draft">Черновик</span> : null}
        <div className="article-card__badge">{badge || article.tag || article.category}</div>
      </div>
      <div className="article-card__body">
        <div className="article-card__title">{article.title}</div>
        <div className="article-card__excerpt">{article.excerpt}</div>
      </div>
    </Link>
  );
}
