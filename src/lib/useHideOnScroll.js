import { useEffect, useRef, useState } from 'react';

/**
 * Прячет шапку при прокрутке вниз и показывает при прокрутке вверх.
 * У самого верха страницы шапка всегда видна. Возвращает true, когда
 * шапку нужно скрыть. Реально «прячет» только мобильная вёрстка (CSS),
 * на десктопе класс ничего не меняет.
 */
export function useHideOnScroll(threshold = 80) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;

    function onScroll() {
      const y = window.scrollY;
      const diff = y - lastY.current;
      if (y < threshold) {
        setHidden(false); // у верха — всегда показываем
      } else if (Math.abs(diff) > 6) {
        setHidden(diff > 0); // вниз — прячем, вверх — показываем
      }
      lastY.current = y;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return hidden;
}
