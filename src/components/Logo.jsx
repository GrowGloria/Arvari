import { Link } from 'react-router-dom';
import './Logo.css';

export default function Logo({ tagline = 'Свод знаний о мире', dark = false }) {
  return (
    <Link to="/" className={`logo${dark ? ' logo--dark' : ''}`}>
      <div className="logo__mark">А</div>
      <div className="logo__text">
        <div className="logo__title">АРВАРИ</div>
        <div className="logo__tagline">{tagline}</div>
      </div>
    </Link>
  );
}
