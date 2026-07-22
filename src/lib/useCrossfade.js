import { useEffect, useState } from 'react';

/**
 * Плавная смена изображений через двойную буферизацию.
 *
 * В DOM всегда только два слоя: показанный и подготавливаемый. Браузер держит
 * два изображения вместо всей коллекции — иначе страница тянула бы все арты
 * разом (а они по ~3 МБ).
 *
 * @param {string[]} images стабильный массив URL (константа модуля)
 * @param {number} intervalMs сколько держится один арт
 */
export function useCrossfade(images, intervalMs) {
  const [slots, setSlots] = useState([images[0] ?? null, null]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!images || images.length < 2) return undefined;
    let index = 0;
    const id = setInterval(() => {
      index = (index + 1) % images.length;
      const next = images[index];
      setActive((cur) => {
        const incoming = cur === 0 ? 1 : 0;
        setSlots((prev) => {
          const copy = [...prev];
          copy[incoming] = next;
          return copy;
        });
        return incoming;
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [images, intervalMs]);

  return { slots, active };
}
