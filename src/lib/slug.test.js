import { describe, it, expect } from 'vitest';
import { slugify } from './slug';

/**
 * Транслитерация — фундамент вики-ссылок: [[Аэрондиль]] превращается в slug
 * именно ею, и по нему ищется статья. Значения ниже зафиксированы в docs/API.md
 * как контракт с бэкендом: если они поедут, ссылки перестанут находить цели.
 */
describe('slugify', () => {
  it('транслитерирует кириллицу так, как записано в контракте', () => {
    expect(slugify('Аэрондиль')).toBe('aerondil');
    expect(slugify('Вестронд')).toBe('vestrond');
    expect(slugify('Соландир')).toBe('solandir');
    expect(slugify('Остренар')).toBe('ostrenar');
    expect(slugify('Истмусленд')).toBe('istmuslend');
  });

  it('выбрасывает мягкий и твёрдый знаки', () => {
    expect(slugify('ь')).toBe('');
    expect(slugify('ъ')).toBe('');
    expect(slugify('Дань')).toBe('dan');
  });

  it('переводит многобуквенные звуки', () => {
    expect(slugify('Щука')).toBe('shchuka');
    expect(slugify('Жаба')).toBe('zhaba');
    expect(slugify('Царь')).toBe('tsar');
    expect(slugify('Юля')).toBe('yulya');
    expect(slugify('Ёж')).toBe('ezh');
  });

  it('переводит «й» как y, а не как i', () => {
    expect(slugify('Йаррим')).toBe('yarrim');
    expect(slugify('Карвис Последний Луч')).toBe('karvis-posledniy-luch');
    expect(slugify('Февралий Врачеватель')).toBe('fevraliy-vrachevatel');
  });

  it('схлопывает пробелы и знаки в один дефис', () => {
    expect(slugify('Нар-Ондоли (Камнерубы)')).toBe('nar-ondoli-kamneruby');
    expect(slugify('Архонт Аэлариан Лираэль, Белый Ветер')).toBe(
      'arhont-aelarian-lirael-belyy-veter'
    );
  });

  it('не оставляет дефисов по краям', () => {
    expect(slugify('  Тишина  ')).toBe('tishina');
    expect(slugify('«Великая Тишина»')).toBe('velikaya-tishina');
  });

  it('не ломается на пустой строке и латинице', () => {
    expect(slugify('')).toBe('');
    expect(slugify('Arvari Wiki')).toBe('arvari-wiki');
  });
});
