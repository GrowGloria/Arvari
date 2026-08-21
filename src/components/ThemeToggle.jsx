import { useEffect, useState } from 'react';
import './ThemeToggle.css';

const KEY = 'arvari_theme';

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** Кнопка света/тьмы. Тема хранится в localStorage и ставится на <html>. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* приватный режим — просто не сохраняем выбор */
    }
  }, [theme]);

  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className="theme-toggle"
      title={dark ? 'Светлая тема' : 'Тёмная тема'}
      aria-label="Переключить тему"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {dark ? '☀' : '☾'}
    </button>
  );
}
