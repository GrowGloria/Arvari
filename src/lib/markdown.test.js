import { describe, it, expect } from 'vitest';
import {
  extractFrontmatter,
  parseMarkdown,
  tokenizeInline,
  extractToc,
  stripInline,
} from './markdown';

/**
 * Парсер разбирает реальные заметки Obsidian, которые пишет человек, — там
 * встречаются незакрытые `**`, вложенные списки и ссылки внутри жирного текста.
 * Эти тесты фиксируют поведение на таких случаях: сломать парсер легко,
 * а заметить трудно — статья просто отрисуется чуть иначе.
 */

const types = (blocks) => blocks.map((b) => b.type);
const kinds = (tokens) => tokens.map((t) => t.t);

describe('extractFrontmatter', () => {
  it('отрезает frontmatter и разбирает список тегов', () => {
    const { frontmatter, body } = extractFrontmatter(
      '---\ntags:\n  - государство\n  - локация\ncssclass: nation-template\n---\n> цитата\n'
    );
    expect(frontmatter.tags).toEqual(['государство', 'локация']);
    expect(frontmatter.cssclass).toBe('nation-template');
    expect(body.startsWith('> цитата')).toBe(true);
  });

  it('оставляет текст как есть, если frontmatter нет', () => {
    const { frontmatter, body } = extractFrontmatter('## Обзор\nтекст');
    expect(frontmatter).toEqual({});
    expect(body).toBe('## Обзор\nтекст');
  });

  it('не принимает горизонтальную линию в середине за frontmatter', () => {
    const { body } = extractFrontmatter('текст\n\n---\n\nещё текст');
    expect(body).toContain('текст');
    expect(body).toContain('ещё текст');
  });
});

describe('parseMarkdown: блоки', () => {
  it('распознаёт заголовки и делает им id', () => {
    const [h2, h3] = parseMarkdown('## География\n\n### Климат');
    expect(h2).toMatchObject({ type: 'heading', level: 2, text: 'География', id: 'geografiya' });
    expect(h3).toMatchObject({ type: 'heading', level: 3, text: 'Климат', id: 'klimat' });
  });

  it('очищает id заголовка от разметки', () => {
    const [h] = parseMarkdown('#### **ЭПОХА III: РАЗДОР**');
    expect(h.level).toBe(4);
    expect(h.id).toBe('epoha-iii-razdor');
  });

  it('различает горизонтальную линию и жирный курсив', () => {
    expect(types(parseMarkdown('---'))).toEqual(['hr']);
    expect(types(parseMarkdown('***важно***'))).toEqual(['paragraph']);
  });

  it('склеивает многострочную цитату', () => {
    const [quote] = parseMarkdown('> первая\n> вторая');
    expect(quote).toMatchObject({ type: 'blockquote', text: 'первая\nвторая' });
  });

  it('держит перенос строки внутри абзаца — как в Obsidian', () => {
    const [para] = parseMarkdown('**Столица:** [[Аэрондиль]]\n**Население:** 5.5 млн');
    expect(para.type).toBe('paragraph');
    expect(para.lines).toHaveLength(2);
  });

  it('выносит картинку на отдельной строке в блок', () => {
    expect(types(parseMarkdown('![[Истмусленд пейзаж.png]]'))).toEqual(['embed']);
  });
});

describe('parseMarkdown: списки', () => {
  it('различает маркированный и нумерованный', () => {
    expect(parseMarkdown('- раз\n- два')[0]).toMatchObject({ type: 'list', ordered: false });
    expect(parseMarkdown('1. раз\n2. два')[0]).toMatchObject({ type: 'list', ordered: true });
  });

  it('собирает вложенность по отступам', () => {
    const [list] = parseMarkdown('- Крупные города:\n    - Вестронд\n    - Соландир');
    expect(list.items).toHaveLength(1);
    expect(list.items[0].children.items.map((i) => i.text)).toEqual(['Вестронд', 'Соландир']);
  });

  it('принимает и звёздочку, и дефис как маркер', () => {
    const [list] = parseMarkdown('* раз\n- два');
    expect(list.items).toHaveLength(2);
  });

  it('не считает вложенным список, идущий на том же уровне', () => {
    const [list] = parseMarkdown('- раз\n- два\n- три');
    expect(list.items).toHaveLength(3);
    expect(list.items[0].children).toBeUndefined();
  });
});

describe('tokenizeInline: вики-ссылки', () => {
  it('разбирает обычную ссылку', () => {
    expect(tokenizeInline('[[Аэрондиль]]')[0]).toEqual({
      t: 'wikilink',
      target: 'Аэрондиль',
      alias: 'Аэрондиль',
    });
  });

  it('разбирает ссылку с подписью', () => {
    expect(tokenizeInline('[[Хребет Рассвета|Хребтом Рассвета]]')[0]).toEqual({
      t: 'wikilink',
      target: 'Хребет Рассвета',
      alias: 'Хребтом Рассвета',
    });
  });

  it('находит ссылку внутри жирного текста', () => {
    const [strong] = tokenizeInline('**[[Вестронд]]**');
    expect(strong.t).toBe('strong');
    expect(strong.children[0].t).toBe('wikilink');
  });

  it('не спотыкается о пустую ссылку-заглушку', () => {
    expect(() => tokenizeInline('[[ ]]')).not.toThrow();
    expect(kinds(tokenizeInline('[[ ]]'))).toEqual(['text']);
  });
});

describe('tokenizeInline: начертание и вставки', () => {
  it('различает жирный, курсив и оба сразу', () => {
    expect(kinds(tokenizeInline('**жирный**'))).toEqual(['strong']);
    expect(kinds(tokenizeInline('_курсив_'))).toEqual(['em']);
    expect(kinds(tokenizeInline('*курсив*'))).toEqual(['em']);
    expect(kinds(tokenizeInline('***оба***'))).toEqual(['strongem']);
    expect(kinds(tokenizeInline('_**оба**_'))).toEqual(['strongem']);
  });

  it('оставляет незакрытую разметку обычным текстом', () => {
    // Так пишут люди — статья не должна из-за этого разъезжаться.
    expect(kinds(tokenizeInline('**Квенья: [[Аэрондиль]]'))).toEqual(['text', 'wikilink']);
    expect(kinds(tokenizeInline('РЕГИОН ОСТРЕНАРА (ВОСТОК)*'))).toEqual(['text']);
  });

  it('читает ширину картинки после вертикальной черты', () => {
    expect(tokenizeInline('![[Герб.png|300]]')[0]).toMatchObject({
      t: 'embed',
      file: 'Герб.png',
      width: 300,
    });
  });

  it('нечисловую подпись считает описанием, а не шириной', () => {
    expect(tokenizeInline('![[Герб.png|описание]]')[0]).toMatchObject({
      width: null,
      alt: 'описание',
    });
  });

  it('не путает вставку картинки с обычной ссылкой', () => {
    expect(kinds(tokenizeInline('![[файл.png]]'))).toEqual(['embed']);
    expect(kinds(tokenizeInline('[[файл]]'))).toEqual(['wikilink']);
  });

  it('понимает обычные ссылки и картинки markdown', () => {
    expect(tokenizeInline('[текст](https://arvari.ru)')[0]).toMatchObject({
      t: 'link',
      href: 'https://arvari.ru',
    });
    expect(tokenizeInline('![alt](/uploads/a.png)')[0]).toMatchObject({ t: 'image' });
  });

  it('сохраняет текст вокруг разметки', () => {
    expect(kinds(tokenizeInline('до **жирного** после'))).toEqual(['text', 'strong', 'text']);
  });
});

describe('extractToc', () => {
  it('берёт только h2 и h3, с отступом у вложенных', () => {
    const toc = extractToc('# Заголовок\n\n## Обзор\n\n### Детали\n\n## История\n\n#### Мелочь');
    expect(toc).toEqual([
      { label: 'Обзор', href: '#obzor', indent: 0 },
      { label: 'Детали', href: '#detali', indent: 12 },
      { label: 'История', href: '#istoriya', indent: 0 },
    ]);
  });

  it('пропускает frontmatter', () => {
    expect(extractToc('---\ntags:\n  - a\n---\n## Обзор')).toHaveLength(1);
  });
});

describe('stripInline', () => {
  it('убирает разметку, оставляя подпись ссылки', () => {
    expect(stripInline('**[[Хребет Рассвета|Хребтом Рассвета]]**')).toBe('Хребтом Рассвета');
    expect(stripInline('_**Договор Длани**_')).toBe('Договор Длани');
  });
});

describe('целая заметка из Obsidian', () => {
  const note = `---
tags:
  - государство
---
> *«Из вдохновения — наследие»*

![[Истмусленд пейзаж.png]]

**Столица:** [[Аэрондиль]]
**Правитель:** [[Архонт Аэлариан|Аэлариан IV]]

## География
- **Крупные города:**
    - **[[Вестронд]]** («Западный Берег») — за **[[Хребет Рассвета|Хребтом]]**.

## История
- _**Эпоха V, 2410 г.**_ Покровительство **[[Аэрамос|Аэрамоса]]**.

---
`;

  it('разбирает все блоки заметки', () => {
    expect(types(parseMarkdown(note))).toEqual([
      'blockquote',
      'embed',
      'paragraph',
      'heading',
      'list',
      'heading',
      'list',
      'hr',
    ]);
  });

  it('строит оглавление по разделам', () => {
    expect(extractToc(note).map((t) => t.label)).toEqual(['География', 'История']);
  });

  it('находит все вики-ссылки, включая вложенные в списки', () => {
    const found = [];
    const walk = (tokens) => {
      for (const t of tokens) {
        if (t.t === 'wikilink') found.push(t.target);
        if (t.children) walk(t.children);
      }
    };
    const walkList = (list) => {
      for (const item of list.items) {
        walk(tokenizeInline(item.text));
        if (item.children) walkList(item.children);
      }
    };
    for (const block of parseMarkdown(note)) {
      if (block.type === 'paragraph') block.lines.forEach((l) => walk(tokenizeInline(l)));
      if (block.type === 'list') walkList(block);
    }
    expect(found).toContain('Аэрондиль');
    expect(found).toContain('Архонт Аэлариан');
    expect(found).toContain('Хребет Рассвета');
  });
});
