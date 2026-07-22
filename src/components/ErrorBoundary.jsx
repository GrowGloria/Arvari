import { Component } from 'react';
import './ErrorBoundary.css';

/**
 * Перехватывает сбой при отрисовке, чтобы вместо белого экрана посетитель
 * увидел объяснение и выход. Особенно нужно на стыке с бэкендом: неожиданный
 * формат данных валит компонент, а без перехвата страница просто гаснет.
 *
 * Должен быть классом — React пока не умеет ловить ошибки в хуках.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Здесь же место для отправки в систему логирования, когда она появится.
    console.error('Сбой при отрисовке:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="crash">
        <div className="crash__card">
          <div className="crash__mark">⚜</div>
          <h1>Свод дрогнул</h1>
          <p>
            Страницу не удалось отобразить. Записи в безопасности — сбой произошёл при показе,
            а не при хранении.
          </p>
          <pre className="crash__details">{String(this.state.error?.message || this.state.error)}</pre>
          <div className="crash__actions">
            <button type="button" onClick={() => window.location.reload()}>
              Обновить страницу
            </button>
            <a href="/">На главную</a>
          </div>
        </div>
      </div>
    );
  }
}
