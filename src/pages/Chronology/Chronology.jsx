import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../../components/Logo';
import Footer from '../../components/Footer';
import { FINALE_LABEL, FINALE_BG, bgForAccent } from '../../data/chronology';
import { useContent } from '../../store/contentStore';
import './Chronology.css';

export default function Chronology() {
  const rootRef = useRef(null);
  const { epochs } = useContent();
  const [activeEpoch, setActiveEpoch] = useState(0);
  const finaleIndex = epochs.length;
  const labels = [...epochs.map((ep, i) => ep.label || ep.title || `Эпоха ${i + 1}`), FINALE_LABEL];
  // Фон каждой эпохи следует за выбранным Мастером акцентом; финал — всегда янтарь.
  const backgrounds = [...epochs.map((ep) => bgForAccent(ep.accent)), FINALE_BG];

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    root.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

    function onScroll() {
      const sections = root.querySelectorAll('[data-epoch]');
      let active = 0;
      sections.forEach((s) => {
        if (s.getBoundingClientRect().top < window.innerHeight * 0.55) {
          active = parseInt(s.getAttribute('data-epoch'), 10);
        }
      });
      setActiveEpoch(active);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [epochs]);

  return (
    <div className="chronology-page" ref={rootRef}>
      <div className="chrono-bg">
        {backgrounds.map((bg, i) => (
          <div
            key={i}
            className="chrono-bg__layer"
            style={{ background: bg, opacity: i === activeEpoch ? 1 : 0 }}
          />
        ))}
        <div className="chrono-bg__vignette" />
      </div>

      <header className="chrono-header">
        <div className="container chrono-header__inner">
          <Logo tagline="Хронология цикла" dark />
          <nav className="chrono-header__nav">
            <Link to="/">Главная</Link>
            <Link to="/catalog">Каталог</Link>
            <Link to="/editor">Редактор ⚜</Link>
          </nav>
          <div className="chrono-header__spacer" />
          <div className="chrono-header__epoch">{labels[activeEpoch] || labels[0]}</div>
        </div>
      </header>

      <section className="chrono-intro">
        <div className="chrono-intro__kicker">Главная хронология цикла</div>
        <h1>3200 ЛЕТ</h1>
        <p>
          От пепла прошлого мира до тишины перед бурей.
          <br />
          Листайте вниз, чтобы пройти цикл от начала до наших дней.
        </p>
        <div className="chrono-intro__arrow">↓</div>
      </section>

      <div className="chrono-epochs">
        {epochs.map((ep, epIndex) => (
          <section className="chrono-epoch" data-epoch={epIndex} key={epIndex}>
            <div className="chrono-epoch__head" data-reveal>
              <div className="chrono-epoch__kicker" style={{ color: ep.accent }}>
                {ep.kicker}
              </div>
              <h2>{ep.title}</h2>
              <div className="chrono-epoch__subtitle">{ep.subtitle}</div>
            </div>
            <div className="chrono-timeline">
              {ep.events.map((ev, i) => (
                <div className="chrono-event" data-reveal key={i}>
                  <span className="chrono-event__dot" style={{ background: ep.accent, boxShadow: `0 0 12px ${ep.accent}` }} />
                  <div className="chrono-event__year" style={{ color: ep.accent }}>
                    {ev.year}
                  </div>
                  <div className="chrono-event__title">{ev.title}</div>
                  <div className="chrono-event__text">{ev.text}</div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="chrono-finale" data-epoch={finaleIndex}>
          <div data-reveal>
            <div className="chrono-finale__kicker">3200 год · Текущий год</div>
            <h2>Начало игры</h2>
            <p>
              Мир кажется стабильным. Но это тишина перед бурей — и только Длань знает, что цикл
              готов замкнуться вновь.
            </p>
            <Link to="/" className="chrono-finale__cta">
              Вернуться к своду знаний
            </Link>
          </div>
        </section>
      </div>

      <div className="chrono-footer-wrap">
        <Footer />
      </div>
    </div>
  );
}
