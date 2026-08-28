import { slugify } from './slug';

/**
 * Толерантный парсер Markdown с диалектом Obsidian.
 *
 * Поддержка: frontmatter, заголовки, горизонтальная линия, цитаты, списки
 * (вложенные), вставки изображений `![[файл|ширина]]`, абзацы с мягкими
 * переносами (как в Obsidian — одиночный перенос строки = <br>). Инлайн:
 * `**жирный**`, `_курсив_`/`*курсив*`, `***жирный курсив***`, вики-ссылки
 * `[[цель|алиас]]`, вставки, обычные ссылки/картинки markdown.
 *
 * Разбор на данные (без React) — рендер в components/Markdown.jsx.
 */

const HR_RE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const LIST_ITEM_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const EMBED_LINE_RE = /^\s*!\[\[([^\]]+?)\]\]\s*$/;
const MD_IMG_LINE_RE = /^\s*!\[[^\]]*\]\([^)]+\)\s*$/;

export function extractFrontmatter(src) {
  const text = src.replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return { frontmatter: {}, body: text };
  const end = text.indexOf('\n---', 4);
  if (end === -1) return { frontmatter: {}, body: text };
  const raw = text.slice(4, end);
  const body = text.slice(text.indexOf('\n', end + 1) + 1);
  return { frontmatter: parseYaml(raw), body };
}

function parseYaml(raw) {
  const out = {};
  let currentKey = null;
  for (const line of raw.split('\n')) {
    const listItem = line.match(/^\s*-\s+(.*)$/);
    if (listItem && currentKey) {
      if (!Array.isArray(out[currentKey])) out[currentKey] = [];
      out[currentKey].push(listItem[1].trim());
      continue;
    }
    const kv = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (kv) {
      currentKey = kv[1];
      out[currentKey] = kv[2].trim() ? kv[2].trim() : [];
    }
  }
  return out;
}

/** Разбирает markdown-тело в массив блоков. */
export function parseMarkdown(src) {
  const { body } = extractFrontmatter(src);
  const lines = body.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (HR_RE.test(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      const text = heading[2].trim();
      blocks.push({ type: 'heading', level: heading[1].length, text, id: slugify(stripInline(text)) });
      i += 1;
      continue;
    }

    if (EMBED_LINE_RE.test(line) || MD_IMG_LINE_RE.test(line)) {
      blocks.push({ type: 'embed', text: line.trim() });
      i += 1;
      continue;
    }

    if (line.trimStart().startsWith('>')) {
      const quote = [];
      while (i < lines.length && lines[i].trimStart().startsWith('>')) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'blockquote', text: quote.join('\n') });
      continue;
    }

    if (LIST_ITEM_RE.test(line)) {
      const listLines = [];
      while (i < lines.length) {
        const l = lines[i];
        if (!l.trim()) break;
        if (LIST_ITEM_RE.test(l) || /^\s{2,}\S/.test(l)) {
          listLines.push(l);
          i += 1;
        } else {
          break;
        }
      }
      blocks.push(parseList(listLines));
      continue;
    }

    // Таблица (GFM): строка с | и следующая строка-разделитель из дефисов.
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = splitTableRow(line);
      const align = splitTableRow(lines[i + 1]).map(cellAlign);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      blocks.push({ type: 'table', header, align, rows });
      continue;
    }

    // Абзац: подряд идущие строки до пустой/спец-строки, переносы = <br>.
    const para = [];
    while (i < lines.length) {
      const l = lines[i];
      if (
        !l.trim() ||
        HR_RE.test(l) ||
        HEADING_RE.test(l) ||
        LIST_ITEM_RE.test(l) ||
        l.trimStart().startsWith('>') ||
        EMBED_LINE_RE.test(l)
      ) {
        break;
      }
      para.push(l.trim());
      i += 1;
    }
    blocks.push({ type: 'paragraph', lines: para });
  }

  return blocks;
}

function parseList(listLines) {
  const root = { type: 'list', ordered: isOrdered(listLines[0]), items: [] };
  const stack = [{ indent: -1, list: root }];

  for (const raw of listLines) {
    const m = raw.match(LIST_ITEM_RE);
    if (!m) {
      const top = stack[stack.length - 1];
      const li = top.list.items[top.list.items.length - 1];
      if (li) li.text += ' ' + raw.trim();
      continue;
    }
    const indent = m[1].length;
    const ordered = /\d/.test(m[2]);
    const content = m[3];

    while (stack.length > 1 && indent < stack[stack.length - 1].indent) stack.pop();
    let top = stack[stack.length - 1];

    if (indent > top.indent + 1 && top.list.items.length) {
      const parentItem = top.list.items[top.list.items.length - 1];
      if (!parentItem.children) parentItem.children = { type: 'list', ordered, items: [] };
      stack.push({ indent, list: parentItem.children });
      top = stack[stack.length - 1];
    }

    top.list.items.push({ text: content });
  }

  return root;
}

function isOrdered(line) {
  const m = line && line.match(LIST_ITEM_RE);
  return m ? /\d/.test(m[2]) : false;
}

/* ---- Таблицы (GFM pipe tables) ---- */

// Строка-разделитель: только | : - и пробелы, есть и труба, и дефис.
function isTableSep(line) {
  const s = line.trim();
  return s.includes('|') && s.includes('-') && /^[\s:|-]+$/.test(s);
}

// Разбивает строку таблицы на ячейки (крайние трубы необязательны).
function splitTableRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

// Выравнивание ячейки по маркерам двоеточий в разделителе.
function cellAlign(cell) {
  const c = (cell || '').trim();
  const left = c.startsWith(':');
  const right = c.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return null;
}

/** Пункты оглавления (h2/h3) для сайдбара статьи. */
export function extractToc(src) {
  const toc = [];
  let lastH2 = null;
  for (const block of parseMarkdown(src)) {
    if (block.type !== 'heading') continue;
    if (block.level === 2) {
      lastH2 = block.id;
      toc.push({ label: stripInline(block.text), href: `#${block.id}`, indent: 0 });
    } else if (block.level === 3 && lastH2) {
      toc.push({ label: stripInline(block.text), href: `#${block.id}`, indent: 12 });
    }
  }
  return toc;
}

function embedToken(inner) {
  const [file, opt] = inner.split('|').map((s) => s.trim());
  const width = opt && /^\d+$/.test(opt) ? Number(opt) : null;
  const alt = opt && !width ? opt : file;
  return { t: 'embed', file, width, alt };
}

function wikiToken(inner) {
  const [rawTarget, rawAlias] = inner.split('|');
  const target = (rawTarget || '').trim();
  const alias = (rawAlias || '').trim();
  if (!target) return { t: 'text', v: '' };
  return { t: 'wikilink', target, alias: alias || target };
}

const INLINE_MATCHERS = [
  { re: /!\[\[([^\]]+?)\]\]/, make: (m) => embedToken(m[1]) },
  { re: /!\[([^\]]*)\]\(([^)]+)\)/, make: (m) => ({ t: 'image', alt: m[1], src: m[2] }) },
  { re: /\[\[([^\]]+?)\]\]/, make: (m) => wikiToken(m[1]) },
  { re: /\[([^\]]+?)\]\(([^)]+)\)/, make: (m) => ({ t: 'link', text: m[1], href: m[2] }) },
  { re: /\*\*\*([^*]+?)\*\*\*/, wrap: 'strongem' },
  { re: /_\*\*([^*]+?)\*\*_/, wrap: 'strongem' },
  { re: /\*\*([^*]+?)\*\*/, wrap: 'strong' },
  { re: /_([^_\n]+?)_/, wrap: 'em' },
  { re: /\*([^*\n]+?)\*/, wrap: 'em' },
  { re: /`([^`]+?)`/, make: (m) => ({ t: 'code', v: m[1] }) },
];

/** Разбирает инлайн-строку в массив токенов (данные, без React). */
export function tokenizeInline(text) {
  if (!text) return [];
  let best = null;
  for (const matcher of INLINE_MATCHERS) {
    const match = matcher.re.exec(text);
    if (match && (!best || match.index < best.match.index)) best = { matcher, match };
  }
  if (!best) return [{ t: 'text', v: text }];

  const { matcher, match } = best;
  const before = text.slice(0, match.index);
  const after = text.slice(match.index + match[0].length);
  const node = matcher.wrap
    ? { t: matcher.wrap, children: tokenizeInline(match[1]) }
    : matcher.make(match);

  const nodes = [];
  if (before) nodes.push({ t: 'text', v: before });
  nodes.push(node);
  if (after) nodes.push(...tokenizeInline(after));
  return nodes;
}

/** Убирает инлайн-разметку — для id заголовков и подписей оглавления. */
export function stripInline(text) {
  return text
    .replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, '$1')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_, t, a) => (a || t).trim())
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*\*([^*]+?)\*\*\*/g, '$1')
    .replace(/\*\*([^*]+?)\*\*/g, '$1')
    .replace(/\*([^*]+?)\*/g, '$1')
    .replace(/_([^_]+?)_/g, '$1')
    .replace(/`([^`]+?)`/g, '$1')
    .trim();
}
