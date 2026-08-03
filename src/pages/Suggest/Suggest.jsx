import { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { submitSuggestion, SUGGESTION_KINDS } from '../../api/suggestions';
import './Suggest.css';

export default function Suggest() {
  const [author, setAuthor] = useState('');
  const [kind, setKind] = useState(SUGGESTION_KINDS[0]);
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await submitSuggestion({ author, kind, text });
      setSent(true);
    } catch (err) {
      setError(err.message || 'Не удалось отправить предложение.');
    } finally {
      setPending(false);
    }
  }

  function reset() {
    setText('');
    setAuthor('');
    setKind(SUGGESTION_KINDS[0]);
    setSent(false);
  }

  return (
    <div className="page suggest-page">
      <Header showSearch />

      <div className="page-sheet">
        <main className="container suggest-main">
          <div className="suggest-intro">
            <div className="suggest-intro__kicker">Предложка</div>
            <h1>Предложить идею своду</h1>
            <p>
              Заметили пробел в летописи, придумали легенду или нашли ошибку? Оставьте весть —
              её прочитает хранитель мира.
            </p>
          </div>

          {sent ? (
            <div className="suggest-card suggest-done">
              <div className="suggest-done__mark">✦</div>
              <h2>Весть отправлена</h2>
              <p>Спасибо! Предложение легло на стол Мастеру.</p>
              <div className="suggest-done__actions">
                <button type="button" onClick={reset}>
                  Предложить ещё
                </button>
                <Link to="/">На главную</Link>
              </div>
            </div>
          ) : (
            <form className="suggest-card" onSubmit={onSubmit}>
              <div className="suggest-field">
                <label htmlFor="s-author">Ваше имя (необязательно)</label>
                <input
                  id="s-author"
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Как к вам обращаться"
                  maxLength={80}
                />
              </div>

              <div className="suggest-field">
                <label htmlFor="s-kind">О чём предложение</label>
                <select id="s-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                  {SUGGESTION_KINDS.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </div>

              <div className="suggest-field">
                <label htmlFor="s-text">Текст предложения</label>
                <textarea
                  id="s-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Опишите идею как можно понятнее…"
                  rows={7}
                  maxLength={4000}
                />
              </div>

              {error ? <div className="suggest-error">{error}</div> : null}

              <button type="submit" className="suggest-submit" disabled={pending || !text.trim()}>
                {pending ? 'Отправляем…' : 'Отправить весть'}
              </button>
            </form>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}
