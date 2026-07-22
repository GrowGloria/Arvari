import { Link } from 'react-router-dom';
import { coverStyle } from '../lib/cover';
import { formatRelativeDate } from '../lib/format';
import './ArticleRow.css';

export default function ArticleRow({ article }) {
  return (
    <Link to={`/article/${article.slug}`} className="article-row">
      <div className="article-row__cover" style={coverStyle(article.cover)} />
      <div className="article-row__body">
        <div className="article-row__meta">
          <span className="article-row__badge">{article.tag || article.category}</span>
          <span className="article-row__date">{formatRelativeDate(article.date)}</span>
        </div>
        <div className="article-row__title">{article.title}</div>
        <div className="article-row__excerpt">{article.excerpt}</div>
      </div>
    </Link>
  );
}
