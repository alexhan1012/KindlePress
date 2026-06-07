import type { Block, DocumentBook, PageSize, TypographySettings } from '../../shared/types'

export function renderBookHtml(book: DocumentBook, typography: TypographySettings, pageSize: PageSize): string {
  const body = book.blocks.map(renderBlock).join('\n')
  const title = escapeHtml(book.title ?? 'KindlePress')

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    @page {
      size: ${pageSize.widthMm}mm ${pageSize.heightMm}mm;
      margin: ${typography.marginMm}mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: #181714;
      background: #ffffff;
      font-family: ${cssString(typography.fontFamily)}, "Noto Serif CJK SC", "Microsoft YaHei", serif;
      font-size: ${typography.fontSizePt}pt;
      line-height: ${typography.lineHeight};
      overflow-wrap: anywhere;
    }

    h1, h2, h3, h4, h5, h6 {
      break-after: avoid;
      color: #101010;
      font-family: ${cssString(typography.fontFamily)}, "Microsoft YaHei", sans-serif;
      line-height: 1.22;
      margin: 0 0 0.55em;
    }

    h1 { font-size: 1.55em; margin-top: 0; }
    h2 { font-size: 1.32em; margin-top: 1.1em; }
    h3 { font-size: 1.16em; margin-top: 1em; }
    h4, h5, h6 { font-size: 1.04em; margin-top: 0.9em; }

    p {
      margin: 0 0 0.8em;
      text-align: justify;
    }

    ul, ol {
      margin: 0 0 0.9em 1.25em;
      padding: 0;
    }

    li {
      margin: 0 0 0.35em;
    }

    pre {
      margin: 0 0 0.9em;
      padding: 0.65em;
      border: 1px solid #d8d2c4;
      background: #f7f4ed;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: "Cascadia Mono", "Consolas", monospace;
      font-size: 0.82em;
      line-height: 1.42;
    }

    img {
      max-width: 100%;
      height: auto;
    }

    .page-break {
      break-before: page;
      height: 0;
    }

    .warning {
      margin: 0 0 0.75em;
      padding: 0.5em 0.65em;
      border-left: 3px solid #9d6b2f;
      background: #fbf1df;
      color: #513b1f;
      font-size: 0.86em;
    }
  </style>
</head>
<body>
${body}
</body>
</html>`
}

function renderBlock(block: Block): string {
  switch (block.type) {
    case 'heading':
      return `<h${block.level}>${escapeHtml(block.text)}</h${block.level}>`
    case 'paragraph':
      return `<p>${escapeHtml(block.text)}</p>`
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul'
      const items = block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
      return `<${tag}>${items}</${tag}>`
    }
    case 'code':
      return `<pre><code>${escapeHtml(block.text)}</code></pre>`
    case 'image':
      return `<img src="${escapeAttribute(block.src)}" alt="${escapeAttribute(block.alt ?? '')}" />`
    case 'pageBreak':
      return '<div class="page-break"></div>'
    case 'warning':
      return `<div class="warning">${escapeHtml(block.text)}</div>`
    default:
      return ''
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#096;')
}

function cssString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
