import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__title">АРВАРИ · СВОД ЗНАНИЙ О МИРЕ</div>
      <div className="site-footer__subtitle">Энциклопедия мира Арвари</div>
      <Link to="/suggest" className="site-footer__suggest">
        Предложить идею своду →
      </Link>
    </footer>
  );
}
