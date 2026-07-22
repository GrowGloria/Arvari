import { BACKGROUND_ART } from '../../data/backgroundArt';

/**
 * Пейзажи, сменяющиеся в шапке главной.
 * Тот же авто-собираемый список, что и для фона в полях: положите
 * горизонтальный .png в public/uploads — он появится и здесь.
 */
export const HERO_IMAGES = BACKGROUND_ART;

/** Сколько держится один пейзаж перед сменой. */
export const HERO_HOLD_MS = 30000;
