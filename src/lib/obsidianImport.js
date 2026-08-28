import { extractFrontmatter, parseMarkdown, stripInline, tokenizeInline } from './markdown';
import { CATEGORIES } from '../data/categories';

/**
 * Разбор заметки Obsidian в черновик статьи.
 *
 * Название берётся из имени файла — в Obsidian оно и есть заголовок заметки,
 * и именно по нему на неё ссылаются через [[…]]. Категория угадывается по
 * тегам из frontmatter, обложка — по первой вставленной картинке, краткое
 * описание — по первому абзацу.
 */

/** Тег в заметке → раздел свода. */
const TAG_TO_CATEGORY = {
  государство: 'Государства',
  государства: 'Государства',
  локация: 'Локации',
  локации: 'Локации',
  персонаж: 'Персонажи',
  персонажи: 'Персонажи',
  нпс: 'Персонажи',
  npc: 'Персонажи',
  событие: 'События',
  события: 'События',
  существо: 'Существа',
  существа: 'Существа',
  монстр: 'Существа',
  фракция: 'Фракции',
  фракции: 'Фракции',
  организация: 'Фракции',
  артефакт: 'Артефакты',
  артефакты: 'Артефакты',
  предмет: 'Артефакты',
  легенда: 'Легенды',
  легенды: 'Легенды',
  миф: 'Легенды',
  концепция: 'Концепции',
  концепции: 'Концепции',
  понятие: 'Концепции',
  бог: 'Боги',
  боги: 'Боги',
  божество: 'Боги',
};

const EXCERPT_LIMIT = 220;

export function draftFromObsidian(fileName, text) {
  const { frontmatter, body } = extractFrontmatter(text);
  const title = fileName.replace(/\.md$/i, '').trim();
  const tags = normalizeTags(frontmatter.tags);

  const category = pickCategory(tags);
  const blocks = parseMarkdown(body);

  return {
    title,
    category,
    subcategory: pickSubcategory(category, tags),
    excerpt: pickExcerpt(blocks),
    cover: pickCover(blocks),
    body: body.trim(),
    tags,
  };
}

function normalizeTags(raw) {
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  if (typeof raw === 'string') {
    return raw
      .split(/[,\s]+/)
      .map((t) => t.replace(/^#/, '').trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

function pickCategory(tags) {
  for (const tag of tags) {
    if (TAG_TO_CATEGORY[tag]) return TAG_TO_CATEGORY[tag];
  }
  return null; // не угадали — редактор оставит выбранное вручную
}

function pickSubcategory(category, tags) {
  const subcats = CATEGORIES.find((c) => c.name === category)?.subcats;
  if (!subcats) return '';
  const match = subcats.find((s) => tags.includes(s.toLowerCase()));
  return match || '';
}

/** Первый осмысленный абзац, очищенный от разметки. */
function pickExcerpt(blocks) {
  for (const block of blocks) {
    if (block.type !== 'paragraph') continue;
    const text = stripInline((block.lines || []).join(' ')).trim();
    // Строки вида «**Столица:** …» — это карточка-справка, а не описание.
    if (!text || /^[^:]{1,40}:/.test(text)) continue;
    return text.length > EXCERPT_LIMIT ? `${text.slice(0, EXCERPT_LIMIT).trimEnd()}…` : text;
  }
  return '';
}

/** Первая вставленная картинка — как обложка. */
function pickCover(blocks) {
  for (const block of blocks) {
    const source = block.type === 'embed' ? [block.text] : block.type === 'paragraph' ? block.lines : null;
    if (!source) continue;
    for (const line of source) {
      const embed = tokenizeInline(line).find((t) => t.t === 'embed');
      if (embed) return embed.file;
    }
  }
  return '';
}
