import { Link } from 'react-router-dom';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import SearchBar from '../../components/SearchBar';
import { uploadUrl } from '../../lib/assets';
import './NotFound.css';

export default function NotFound() {
  return (
    <div className="page notfound-page">
      <Header />

      <div className="page-sheet">
      <main className="notfound-main">
        <img
          src={uploadUrl('6b9ac42d4df2452111f38220e366b72e.gif')}
          alt="Кот спит на книжном шкафу"
          className="notfound-illustration"
        />

        <div className="notfound-content">
          <div className="notfound-kicker">Статья не найдена</div>
          <h1>Упс, архивариус ещё не отыскал информацию об этом!</h1>
          <p>
            Возможно, эта страница свода ещё не переписана набело, а может, о ней знает только
            Длань — и та молчит. Попробуйте поискать иначе или загляните в каталог.
          </p>

          <div className="notfound-search">
            <SearchBar variant="large" placeholder="Поискать что-нибудь ещё…" />
          </div>

          <div className="notfound-actions">
            <Link to="/" className="notfound-actions__primary">
              На главную
            </Link>
            <Link to="/catalog" className="notfound-actions__secondary">
              В каталог
            </Link>
          </div>
        </div>
      </main>
      </div>

      <Footer />
    </div>
  );
}
