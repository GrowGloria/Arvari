import { describe, it, expect } from 'vitest';
import { draftFromObsidian } from './obsidianImport';

const NOTE = `---
tags:
  - государство
  - локация
cssclass: nation-template
---
> *«Из вдохновения — наследие»*

![[Истмусленд пейзаж.png]]

**Столица:** [[Аэрондиль]]
**Население:** 5.5 млн человек

Полуостровное государство мореходов и торговых гильдий, где контракт священен,
а ум ценится выше меча.

## География
- **Крупные города:** [[Вестронд]]
`;

describe('draftFromObsidian', () => {
  const draft = draftFromObsidian('Истмусленд.md', NOTE);

  it('берёт название из имени файла — по нему ссылаются [[…]]', () => {
    expect(draft.title).toBe('Истмусленд');
  });

  it('определяет раздел по тегам', () => {
    expect(draft.category).toBe('Государства');
    expect(draft.tags).toContain('локация');
  });

  it('берёт обложку из первой вставленной картинки', () => {
    expect(draft.cover).toBe('Истмусленд пейзаж.png');
  });

  it('делает описание из первого связного абзаца, пропуская строки-справку', () => {
    // «**Столица:** …» — это карточка, а не описание.
    expect(draft.excerpt).toMatch(/^Полуостровное государство мореходов/);
    expect(draft.excerpt).not.toContain('Столица');
  });

  it('сохраняет тело без frontmatter', () => {
    expect(draft.body).not.toContain('cssclass');
    expect(draft.body).toContain('## География');
    expect(draft.body).toContain('[[Вестронд]]');
  });

  it('подставляет подкатегорию, если тег совпал с ней', () => {
    const d = draftFromObsidian('Аэрондиль.md', '---\ntags:\n  - локация\n  - города\n---\nтекст');
    expect(d.category).toBe('Локации');
    expect(d.subcategory).toBe('Города');
  });

  it('не угадывает раздел, если тегов нет — оставляет выбор человеку', () => {
    const d = draftFromObsidian('Без тегов.md', 'просто текст');
    expect(d.category).toBeNull();
    expect(d.title).toBe('Без тегов');
  });

  it('понимает теги, записанные строкой через решётку', () => {
    const d = draftFromObsidian('Керемос.md', '---\ntags: #бог #длань\n---\nтекст');
    expect(d.category).toBe('Боги');
  });

  it('не падает на пустом файле', () => {
    expect(() => draftFromObsidian('Пусто.md', '')).not.toThrow();
  });
});
