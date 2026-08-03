import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import ArticleEditor from './ArticleEditor';
import NewsEditor from './NewsEditor';
import ChronologyEditor from './ChronologyEditor';
import SuggestionsInbox from './SuggestionsInbox';
import { isMaster } from '../../lib/auth';
import { login as apiLogin, logout as apiLogout } from '../../api/auth';
import { isMockMode } from '../../api/client';
import { getArticleBySlug, articleToDraft } from '../../data/articles';
import { useContent } from '../../store/contentStore';
import './Editor.css';

const TABS = [
  { key: 'article', label: 'Статья' },
  { key: 'news', label: 'Вестники' },
  { key: 'chronology', label: 'Хронология' },
  { key: 'suggestions', label: 'Предложка' },
];

export default function Editor() {
  const [searchParams, setSearchParams] = useSearchParams();
  const editSlug = searchParams.get('edit');
  const { articles } = useContent();

  const [loggedIn, setLoggedIn] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [pending, setPending] = useState(false);
  const [tab, setTab] = useState('article');

  useEffect(() => {
    if (isMaster()) setLoggedIn(true);
  }, []);

  // Приход по ссылке ?edit=… переключает на вкладку «Статья».
  useEffect(() => {
    if (editSlug) setTab('article');
  }, [editSlug]);

  const editArticle = editSlug ? getArticleBySlug(articles, editSlug) : null;

  function switchTab(key) {
    setTab(key);
    // Уходя с правки статьи, сбрасываем параметр edit.
    if (editSlug) {
      searchParams.delete('edit');
      setSearchParams(searchParams, { replace: true });
    }
  }

  async function doLogin() {
    if (pending) return;
    setPending(true);
    setLoginError('');
    try {
      await apiLogin(loginName, loginPass);
      setLoggedIn(true);
    } catch (e) {
      setLoginError(e.message || 'Не удалось войти.');
    } finally {
      setPending(false);
    }
  }

  function logout() {
    apiLogout();
    setLoggedIn(false);
    setLoginPass('');
  }

  const rightSlot = loggedIn ? (
    <div className="editor-header-user">
      <span>⚜ Мастер Арвари</span>
      <button type="button" onClick={logout}>
        Выйти
      </button>
    </div>
  ) : null;

  return (
    <div className="page editor-page">
      <Header rightSlot={rightSlot} />

      <div className="page-sheet">
      {!loggedIn ? (
        <main className="editor-login-main">
          <div className="editor-login-card">
            <div className="editor-login-card__icon">⚜</div>
            <h1>Вход для Мастера</h1>
            <p>Редактор свода доступен только хранителю мира. Игрокам вход воспрещён.</p>

            <div className="editor-field">
              <div className="editor-field__label">Имя Мастера</div>
              <input
                type="text"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                placeholder="Мастер"
              />
            </div>
            <div className="editor-field">
              <div className="editor-field__label">Слово-ключ</div>
              <input
                type="password"
                value={loginPass}
                onChange={(e) => {
                  setLoginPass(e.target.value);
                  setLoginError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && doLogin()}
                placeholder="••••••••"
              />
            </div>
            {loginError ? <div className="editor-login-card__error">{loginError}</div> : null}
            <button
              type="button"
              className="editor-login-card__submit"
              onClick={doLogin}
              disabled={pending}
            >
              {pending ? 'Проверяем…' : 'Войти в архив'}
            </button>
            {isMockMode ? (
              <div className="editor-login-card__hint">
                Бэкенд не подключён — свод хранится в этом браузере.
              </div>
            ) : null}
          </div>
        </main>
      ) : (
        <main className="container editor-main">
          <nav className="editor-tabs">
            {TABS.map((t) => (
              <button
                type="button"
                key={t.key}
                className={`editor-tab${tab === t.key ? ' editor-tab--active' : ''}`}
                onClick={() => switchTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {tab === 'article' && (
            <ArticleEditor
              key={editArticle ? editArticle.slug : 'new'}
              editSlug={editArticle ? editArticle.slug : null}
              initial={editArticle ? articleToDraft(editArticle) : null}
            />
          )}
          {tab === 'news' && <NewsEditor />}
          {tab === 'chronology' && <ChronologyEditor />}
          {tab === 'suggestions' && <SuggestionsInbox />}
        </main>
      )}
      </div>

      <Footer />
    </div>
  );
}
