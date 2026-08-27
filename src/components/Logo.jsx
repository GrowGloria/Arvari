import { Link } from 'react-router-dom';
import './Logo.css';

export default function Logo({ tagline = 'Свод знаний о мире', dark = false }) {
  return (
    <Link to="/" className={`logo${dark ? ' logo--dark' : ''}`}>
      <img className="logo__mark" src="/logo.png" alt="Арвари" width="44" height="44" />
      <div className="logo__text">
        <div className="logo__title">АРВАРИ</div>
        <div className="logo__tagline">{tagline}</div>
      </div>
    </Link>
  );
}
