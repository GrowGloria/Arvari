import { isMockMode, readLocal, writeLocal, request } from './client';

/**
 * Интерактивная карта: картинка + список меток.
 * markers: [{ id, x, y, type, slug, label }] — координаты в процентах (0–100).
 */

const MAP_KEY = 'arvari_map';
const EMPTY = { image: '', markers: [] };

export async function loadMap() {
  if (isMockMode) return readLocal(MAP_KEY, EMPTY);
  return request('/map');
}

export async function saveMap(map) {
  if (isMockMode) {
    writeLocal(MAP_KEY, map);
    return map;
  }
  return request('/map', { method: 'PUT', body: map, auth: true });
}
