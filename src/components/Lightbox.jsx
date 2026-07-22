import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import './Lightbox.css';

/**
 * Просмотр изображений в полном размере.
 * useLightbox().open(src, alt) открывает оверлей; закрытие — клик по фону,
 * крестик или Escape.
 */

const LightboxContext = createContext(null);

export function LightboxProvider({ children }) {
  const [image, setImage] = useState(null);

  const open = useCallback((src, alt = '') => {
    if (src) setImage({ src, alt });
  }, []);
  const close = useCallback(() => setImage(null), []);

  useEffect(() => {
    if (!image) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [image, close]);

  return (
    <LightboxContext.Provider value={{ open }}>
      {children}
      {image ? (
        <div className="lightbox" onClick={close} role="dialog" aria-modal="true">
          <button type="button" className="lightbox__close" aria-label="Закрыть" onClick={close}>
            ✕
          </button>
          <img
            className="lightbox__img"
            src={image.src}
            alt={image.alt}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </LightboxContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- провайдер и хук колокейтед намеренно
export function useLightbox() {
  return useContext(LightboxContext) || { open: () => {} };
}
