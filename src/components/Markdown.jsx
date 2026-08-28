import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { parseMarkdown, tokenizeInline } from '../lib/markdown';
import { slugify } from '../lib/slug';
import { uploadUrl } from '../lib/assets';
import { useContent } from '../store/contentStore';
import { useLightbox } from './Lightbox';
import './Markdown.css';

function resolveAsset(file) {
  if (/^(https?:)?\/\//.test(file) || file.startsWith('/') || file.startsWith('data:')) return file;
  return uploadUrl(file);
}

export default function Markdown({ source }) {
  const { articles } = useContent();
  const { open } = useLightbox();

  // slugify(название) → slug существующей статьи (для проверки вики-ссылок).
  const slugMap = useMemo(() => {
    const map = new Map();
    for (const a of articles) {
      map.set(a.slug, a.slug);
      map.set(slugify(a.title), a.slug);
    }
    return map;
  }, [articles]);

  const blocks = useMemo(() => parseMarkdown(source || ''), [source]);

  const ctx = { slugMap, openImage: open };

  return <div className="md">{blocks.map((block, i) => renderBlock(block, i, ctx))}</div>;
}

function renderBlock(block, key, ctx) {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${Math.min(block.level, 6)}`;
      return (
        <Tag id={block.id} key={key}>
          {renderTokens(tokenizeInline(block.text), ctx)}
        </Tag>
      );
    }
    case 'hr':
      return <hr key={key} />;
    case 'blockquote':
      return (
        <blockquote key={key}>{renderLines(block.text.split('\n'), ctx)}</blockquote>
      );
    case 'embed':
      return <Fragment key={key}>{renderTokens(tokenizeInline(block.text), ctx)}</Fragment>;
    case 'list':
      return renderList(block, key, ctx);
    case 'table':
      return renderTable(block, key, ctx);
    case 'paragraph':
    default:
      return <p key={key}>{renderLines(block.lines || [], ctx)}</p>;
  }
}

function renderLines(lines, ctx) {
  return lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {renderTokens(tokenizeInline(line), ctx)}
    </Fragment>
  ));
}

function renderList(list, key, ctx) {
  const Tag = list.ordered ? 'ol' : 'ul';
  return (
    <Tag key={key} className="md__list">
      {list.items.map((item, i) => (
        <li key={i}>
          {renderTokens(tokenizeInline(item.text), ctx)}
          {item.children ? renderList(item.children, `${i}-c`, ctx) : null}
        </li>
      ))}
    </Tag>
  );
}

function renderTable(table, key, ctx) {
  const cols = table.header.length;
  return (
    <div className="md__table-wrap" key={key}>
      <table className="md__table">
        <thead>
          <tr>
            {table.header.map((cell, i) => (
              <th key={i} style={table.align[i] ? { textAlign: table.align[i] } : undefined}>
                {renderTokens(tokenizeInline(cell), ctx)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r}>
              {Array.from({ length: cols }, (_, c) => (
                <td key={c} style={table.align[c] ? { textAlign: table.align[c] } : undefined}>
                  {renderTokens(tokenizeInline(row[c] || ''), ctx)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderTokens(tokens, ctx) {
  return tokens.map((tk, i) => renderToken(tk, i, ctx));
}

/**
 * Картинка из заметки. Если файла нет в архиве (типичный случай после импорта
 * из Obsidian — переносится текст, но не вложения), вместо значка битого
 * изображения показываем, какого файла не хватает.
 */
function MdImage({ src, name, alt, width, onZoom }) {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return (
      <span className="md__embed-missing" title="Файл не найден в архиве мира">
        Изображение не найдено: <code>{name}</code>
      </span>
    );
  }

  return (
    <img
      className="md__embed"
      src={src}
      alt={alt}
      style={width ? { width: `${width}px` } : undefined}
      loading="lazy"
      onError={() => setMissing(true)}
      onClick={() => onZoom(src, alt)}
    />
  );
}

function renderToken(tk, key, ctx) {
  switch (tk.t) {
    case 'strong':
      return <strong key={key}>{renderTokens(tk.children, ctx)}</strong>;
    case 'em':
      return <em key={key}>{renderTokens(tk.children, ctx)}</em>;
    case 'strongem':
      return (
        <strong key={key}>
          <em>{renderTokens(tk.children, ctx)}</em>
        </strong>
      );
    case 'code':
      return <code key={key} className="md__code">{tk.v}</code>;
    case 'wikilink': {
      const slug = slugify(tk.target);
      const resolved = ctx.slugMap.has(slug);
      const target = ctx.slugMap.get(slug) || slug;
      return (
        <Link
          key={key}
          to={`/article/${target}`}
          className={`md__wikilink${resolved ? '' : ' md__wikilink--missing'}`}
          title={resolved ? tk.target : `Статья «${tk.target}» ещё не создана`}
        >
          {tk.alias}
        </Link>
      );
    }
    case 'embed':
      return (
        <MdImage
          key={key}
          src={resolveAsset(tk.file)}
          name={tk.file}
          alt={tk.alt || ''}
          width={tk.width}
          onZoom={ctx.openImage}
        />
      );
    case 'image':
      return (
        <MdImage
          key={key}
          src={resolveAsset(tk.src)}
          name={tk.src}
          alt={tk.alt || ''}
          onZoom={ctx.openImage}
        />
      );
    case 'link': {
      const external = /^(https?:)?\/\//.test(tk.href);
      if (external) {
        return (
          <a key={key} href={tk.href} target="_blank" rel="noopener noreferrer">
            {tk.text}
          </a>
        );
      }
      return (
        <Link key={key} to={tk.href}>
          {tk.text}
        </Link>
      );
    }
    case 'text':
    default:
      return <Fragment key={key}>{tk.v}</Fragment>;
  }
}
