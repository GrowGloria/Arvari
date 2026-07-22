import { uploadUrl } from '../lib/assets';
import { ART_FILES } from './artManifest.generated';

/**
 * Арты для фона в полях страницы и для шапки главной.
 *
 * Список собирается автоматически: положите горизонтальный .png в
 * public/uploads и перезапустите dev-сервер — арт сам попадёт в ротацию.
 * Портреты отсеиваются (в узких полях они обрезаются по вертикали).
 * Правится не здесь, а скриптом scripts/generate-art-manifest.mjs.
 */
export const BACKGROUND_ART = ART_FILES.map(uploadUrl);

/** Сколько держится один арт в полях страницы. */
export const ART_ROTATE_MS = 45000;
