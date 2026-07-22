/**
 * Собирает список фоновых артов и карту имён файлов из public/uploads.
 *
 * Зачем скрипт, а не автоимпорт: картинки лежат в public/ (отдаются браузеру
 * как есть), и сборщик их не сканирует. Держать вторую копию в src/assets
 * нельзя — арты весят прилично даже после сжатия.
 *
 * В ротацию попадают только ГОРИЗОНТАЛЬНЫЕ изображения: портреты персонажей
 * в узких полях обрезаются по вертикали и выглядят плохо. Размеры читаются
 * прямо из заголовка файла, без сторонних библиотек.
 *
 * ASSET_MAP связывает «логическое» имя с реальным файлом. Заметки Obsidian
 * ссылаются на `![[Истмусленд пейзаж.png]]`, а на диске лежит .webp —
 * uploadUrl подставит нужное.
 *
 * Запускается автоматически перед `npm run dev` и `npm run build`.
 */
import { readdirSync, openSync, readSync, closeSync, writeFileSync } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const uploadsDir = join(root, 'public', 'uploads');
const outFile = join(root, 'src', 'data', 'artManifest.generated.js');

/** Минимальная ширина — чтобы случайные мелкие картинки не попадали в фон. */
const MIN_WIDTH = 1000;
/** Насколько картинка должна быть шире, чем выше. */
const MIN_RATIO = 1.2;
/** Служебные вставки из дизайн-макета — не арты мира. */
const EXCLUDE = [/^pasted-/i];

const IMAGE_EXT = new Set(['.png', '.webp']);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readHead(filePath, length = 40) {
  const head = Buffer.alloc(length);
  const fd = openSync(filePath, 'r');
  try {
    readSync(fd, head, 0, length, 0);
  } finally {
    closeSync(fd);
  }
  return head;
}

function readSize(filePath) {
  const head = readHead(filePath);

  if (head.subarray(0, 8).equals(PNG_SIGNATURE)) {
    // IHDR идёт сразу за сигнатурой: длина(4) + тип(4) + ширина(4) + высота(4)
    return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
  }

  const isWebp =
    head.subarray(0, 4).toString('ascii') === 'RIFF' &&
    head.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!isWebp) return null;

  const chunk = head.subarray(12, 16).toString('ascii');
  if (chunk === 'VP8 ') {
    return { width: head.readUInt16LE(26) & 0x3fff, height: head.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    const bits = head.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    const read24 = (o) => head[o] | (head[o + 1] << 8) | (head[o + 2] << 16);
    return { width: read24(24) + 1, height: read24(27) + 1 };
  }
  return null;
}

const files = readdirSync(uploadsDir).filter((name) => IMAGE_EXT.has(extname(name).toLowerCase()));

// Логическое имя → реальный файл. Для .webp добавляем и запись под .png,
// чтобы ссылки из старых заметок продолжали находить картинку.
const assetMap = {};
for (const name of files) {
  assetMap[name] = name;
  if (extname(name).toLowerCase() === '.webp') {
    assetMap[`${basename(name, extname(name))}.png`] = name;
  }
}

const landscapes = [];
for (const name of files.filter((n) => !EXCLUDE.some((re) => re.test(n))).sort((a, b) => a.localeCompare(b, 'ru'))) {
  const size = readSize(join(uploadsDir, name));
  if (!size) continue;
  if (size.width < MIN_WIDTH) continue;
  if (size.width < size.height * MIN_RATIO) continue;
  landscapes.push(name);
}

const body = `// СГЕНЕРИРОВАНО скриптом scripts/generate-art-manifest.mjs — не редактировать вручную.
// Чтобы добавить арт в ротацию: положите горизонтальную картинку в public/uploads
// и перезапустите dev-сервер. Затем сожмите её: npm run art:optimize

/** Горизонтальные арты для фона страницы и шапки главной. */
export const ART_FILES = [
${landscapes.map((n) => `  ${JSON.stringify(n)},`).join('\n')}
];

/** Логическое имя из заметок → файл, который реально лежит на диске. */
export const ASSET_MAP = {
${Object.entries(assetMap)
  .sort(([a], [b]) => a.localeCompare(b, 'ru'))
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
  .join('\n')}
};
`;

writeFileSync(outFile, body, 'utf8');
console.log(
  `[art-manifest] горизонтальных артов: ${landscapes.length} из ${files.length} картинок`
);
