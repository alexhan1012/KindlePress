import fs from 'node:fs/promises'
import path from 'node:path'
import { marked } from 'marked'
import type { Block, DocumentBook } from '../../shared/types'

type ProgressCallback = (message: string) => void

export async function parseMarkdownFolder(
  folderPath: string,
  signal: AbortSignal,
  onProgress: ProgressCallback
): Promise<DocumentBook> {
  const files = await findMarkdownFiles(folderPath, signal)

  if (files.length === 0) {
    throw new Error('选择的文件夹中没有找到 Markdown 文件。')
  }

  const blocks: Block[] = []
  let title: string | undefined

  for (const [index, filePath] of files.entries()) {
    throwIfAborted(signal)
    onProgress(`正在解析 Markdown：${path.basename(filePath)} (${index + 1}/${files.length})`)
    const markdown = await fs.readFile(filePath, 'utf8')
    const fileBlocks = markdownToBlocks(markdown, filePath)

    if (!title) {
      const heading = fileBlocks.find((block) => block.type === 'heading' && block.level === 1)
      title = heading?.type === 'heading' ? heading.text : undefined
    }

    if (index > 0) {
      blocks.push({ type: 'pageBreak' })
    }

    blocks.push(...fileBlocks)
  }

  return {
    title: title ?? path.basename(folderPath),
    sourcePath: folderPath,
    blocks
  }
}

async function findMarkdownFiles(folderPath: string, signal: AbortSignal): Promise<string[]> {
  const result: string[] = []

  async function walk(currentPath: string): Promise<void> {
    throwIfAborted(signal)
    const entries = await fs.readdir(currentPath, { withFileTypes: true })

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name)

      if (entry.isDirectory()) {
        if (!['.git', 'node_modules', 'dist', 'out'].includes(entry.name)) {
          await walk(entryPath)
        }
        continue
      }

      if (entry.isFile() && /\.(md|markdown)$/i.test(entry.name)) {
        result.push(entryPath)
      }
    }
  }

  await walk(folderPath)
  return result.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
}

function markdownToBlocks(markdown: string, filePath: string): Block[] {
  const tokens = marked.lexer(markdown)
  const blocks: Block[] = []

  for (const token of tokens) {
    if (token.type === 'heading') {
      blocks.push({
        type: 'heading',
        level: Math.min(Math.max(token.depth, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6,
        text: stripInlineMarkdown(token.text)
      })
    } else if (token.type === 'paragraph') {
      const text = stripInlineMarkdown(token.text).trim()
      if (text) {
        blocks.push({ type: 'paragraph', text })
      }
    } else if (token.type === 'list') {
      blocks.push({
        type: 'list',
        ordered: token.ordered,
        items: token.items.map((item: { text: string }) => stripInlineMarkdown(item.text).trim()).filter(Boolean)
      })
    } else if (token.type === 'code') {
      blocks.push({ type: 'code', text: token.text, language: token.lang || undefined })
    } else if (token.type === 'space') {
      continue
    } else if (token.type === 'html') {
      blocks.push({ type: 'paragraph', text: stripInlineMarkdown(token.text) })
    } else if (token.type === 'blockquote') {
      const text = token.tokens?.map((inner) => ('text' in inner ? String(inner.text) : '')).join('\n')
      if (text) {
        blocks.push({ type: 'paragraph', text: stripInlineMarkdown(text) })
      }
    } else {
      blocks.push({
        type: 'warning',
        text: `暂不支持的 Markdown 内容已跳过：${token.type} (${path.basename(filePath)})`
      })
    }
  }

  return blocks
}

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new Error('任务已取消。')
  }
}
