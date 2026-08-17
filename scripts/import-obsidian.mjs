/**
 * Разовый импорт заметок Obsidian в бэкенд.
 *
 *   node scripts/import-obsidian.mjs "<папка>" "Файл1" "Файл2" ...
 *
 * Переменные: ARVARI_API (по умолчанию http://localhost:5174),
 *             ARVARI_PASSPHRASE (по умолчанию «арвари»).
 *
 * Разбор повторяет логику редактора: название из имени файла, категория из
 * тегов frontmatter, обложка — первая вставленная картинка, тело — markdown.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ASSET_MAP } from '../src/data/artManifest.generated.js';

const API = process.env.ARVARI_API || 'http://localhost:5174';
const PASS = process.env.ARVARI_PASSPHRASE || 'арвари';

const TAG_TO_CATEGORY = {
  государство: 'Государства', государства: 'Государства',
  локация: 'Локации', локации: 'Локации',
  персонаж: 'Персонажи', персонажи: 'Персонажи', нпс: 'Персонажи',
  событие: 'События', события: 'События',
  существо: 'Существа', существа: 'Существа', монстр: 'Существа',
  фракция: 'Фракции', фракции: 'Фракции', организация: 'Фракции',
  артефакт: 'Артефакты', артефакты: 'Артефакты', предмет: 'Артефакты',
  легенда: 'Легенды', легенды: 'Легенды', миф: 'Легенды',
  бог: 'Боги', боги: 'Боги', божество: 'Боги',
};

function splitFrontmatter(src) {
  const text = src.replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return { tags: [], body: text };
  const end = text.indexOf('\n---', 4);
  if (end === -1) return { tags: [], body: text };
  const raw = text.slice(4, end);
  const body = text.slice(text.indexOf('\n', end + 1) + 1);
  const tags = [];
  for (const line of raw.split('\n')) {
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item) tags.push(item[1].trim().toLowerCase());
  }
  return { tags, body };
}

function pickCoverUrl(body) {
  const m = body.match(/!\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]/);
  if (!m) return '';
  const file = m[1].trim();
  const actual = ASSET_MAP[file] || file; // .png из заметки → реальный .webp
  return encodeURI(`/uploads/${actual}`);
}

function pickExcerpt(body) {
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[#>!\-*|]|^\d+\./.test(line)) continue; // заголовок/список/цитата/вставка
    const plain = line.replace(/\*\*|__|\[\[([^\]|]+)(\|([^\]]*))?\]\]/g, (_, t, __, a) => a || t || '');
    if (/^[^:]{1,40}:/.test(plain)) continue; // строка-справка «Поле: значение»
    return plain.length > 200 ? `${plain.slice(0, 200).trimEnd()}…` : plain;
  }
  return '';
}

const [, , folder, ...names] = process.argv;
if (!folder || names.length === 0) {
  console.error('Использование: node scripts/import-obsidian.mjs "<папка>" "Файл1" …');
  process.exit(1);
}

const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Импорт', passphrase: PASS }),
});
if (!login.ok) {
  console.error('Вход не удался:', login.status);
  process.exit(1);
}
const { token } = await login.json();

for (const name of names) {
  const file = name.endsWith('.md') ? name : `${name}.md`;
  const title = file.replace(/\.md$/i, '');
  const { tags, body } = splitFrontmatter(readFileSync(join(folder, file), 'utf8'));
  const category = tags.map((t) => TAG_TO_CATEGORY[t]).find(Boolean) || 'Государства';
  const coverUrl = pickCoverUrl(body);

  const article = {
    title,
    category,
    tag: category,
    excerpt: pickExcerpt(body),
    markdown: body.trim(),
    cover: coverUrl ? { image: coverUrl } : { gradient: 'var(--grad-1)' },
  };

  const res = await fetch(`${API}/articles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(article),
  });
  if (!res.ok) {
    console.error(`  ✗ ${title}: ${res.status}`);
    continue;
  }
  const saved = await res.json();
  console.log(`  ✓ ${saved.title}  →  /article/${saved.slug}  [${saved.category}]  обложка: ${coverUrl || '—'}`);
}

console.log('Готово.');
