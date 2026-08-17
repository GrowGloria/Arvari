import { API_URL, isMockMode, getToken, ApiError } from './client';

/**
 * Загрузка изображения.
 *
 * Мок-режим: файла некуда класть на сервере, поэтому кодируем в data-URL и
 * держим в самой статье. На нескольких картинках localStorage переполнится —
 * это осознанное ограничение режима без бэкенда.
 *
 * Боевой режим: POST /uploads (multipart) → сервер сохраняет файл и возвращает
 * его URL. Именно этот URL кладётся в обложку/текст статьи.
 */
export async function uploadImage(file) {
  if (isMockMode) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(String(e.target.result));
      reader.onerror = () => reject(new ApiError('Не удалось прочитать файл.', 0));
      reader.readAsDataURL(file);
    });
  }

  const form = new FormData();
  form.append('file', file);

  let res;
  try {
    res = await fetch(`${API_URL}/uploads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    });
  } catch {
    throw new ApiError('Сервер свода недоступен.', 0);
  }
  if (!res.ok) throw new ApiError('Не удалось загрузить изображение.', res.status);
  const data = await res.json();
  return data.url;
}
