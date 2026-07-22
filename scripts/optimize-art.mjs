/**
 * Переводит арты в WebP.
 *
 * Исходники по 3 МБ — нормальный вес для хранилища Мастера, но посетитель
 * качает их целиком: один арт в шапке главной плюс новый каждые 30 секунд.
 * WebP даёт тот же вид при кратно меньшем весе.
 *
 * Имена сохраняются (меняется только расширение), а ссылки вида
 * `![[Истмусленд пейзаж.png]]` из заметок Obsidian продолжают работать:
 * uploadUrl подставляет реальный файл по карте из artManifest.generated.js.
 *
 * Запускать вручную после добавления новых артов: `npm run art:optimize`
 */
import { readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const uploadsDir = join(root, 'public', 'uploads');

const QUALITY = 82;
const mb = (bytes) => (bytes / 1048576).toFixed(1);

const pngs = readdirSync(uploadsDir).filter((n) => extname(n).toLowerCase() === '.png');

if (!pngs.length) {
  console.log('[optimize-art] PNG не найдены — всё уже сжато.');
  process.exit(0);
}

let before = 0;
let after = 0;

for (const name of pngs) {
  const src = join(uploadsDir, name);
  const out = join(uploadsDir, `${basename(name, extname(name))}.webp`);

  const sizeBefore = statSync(src).size;
  await sharp(src).webp({ quality: QUALITY }).toFile(out);
  const sizeAfter = statSync(out).size;

  before += sizeBefore;
  after += sizeAfter;
  unlinkSync(src);

  const saved = Math.round((1 - sizeAfter / sizeBefore) * 100);
  console.log(`  ${name}: ${mb(sizeBefore)} → ${mb(sizeAfter)} МБ  (−${saved}%)`);
}

console.log(
  `[optimize-art] ${pngs.length} файлов: ${mb(before)} → ${mb(after)} МБ ` +
    `(−${Math.round((1 - after / before) * 100)}%)`
);
