import { ASSET_MAP } from '../data/artManifest.generated';

/**
 * Адрес картинки в public/uploads.
 *
 * Заметки Obsidian ссылаются на исходное имя (`Истмусленд пейзаж.png`), а на
 * диске лежит сжатый `.webp` — карта из манифеста подставляет реальный файл.
 * Незнакомое имя отдаётся как есть: возможно, файл добавили только что и
 * манифест ещё не пересобран.
 */
export function uploadUrl(filename) {
  const actual = ASSET_MAP[filename] || filename;
  return encodeURI(`/uploads/${actual}`);
}
