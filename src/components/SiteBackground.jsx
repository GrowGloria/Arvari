import { useLocation } from 'react-router-dom';
import { BACKGROUND_ART, ART_ROTATE_MS } from '../data/backgroundArt';
import { useCrossfade } from '../lib/useCrossfade';
import './SiteBackground.css';

/** Фон сайта: арты мира в полях слева/справа от «листа» с контентом. */
export default function SiteBackground() {
  const { pathname } = useLocation();
  const { slots, active } = useCrossfade(BACKGROUND_ART, ART_ROTATE_MS);

  // Главная живёт своим hero во всю ширину, у хронологии — свой тёмный фон по эпохам.
  if (pathname === '/' || pathname === '/chronology') return null;
  if (!BACKGROUND_ART.length) return null;

  return (
    <div className="site-bg" aria-hidden="true">
      {slots.map((src, i) => (
        <div
          key={i}
          className="site-bg__layer"
          style={{
            backgroundImage: src ? `url('${src}')` : undefined,
            opacity: active === i && src ? 1 : 0,
          }}
        />
      ))}
      <div className="site-bg__scrim" />
    </div>
  );
}
