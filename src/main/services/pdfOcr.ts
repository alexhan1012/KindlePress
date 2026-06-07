import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import os from 'node:os'
import { createCanvas } from '@napi-rs/canvas'
import { createWorker, type Worker } from 'tesseract.js'
import type { DocumentBook, JobConfig, JobProgress } from '../../shared/types'

type OcrProgress = Omit<JobProgress, 'jobId'>

const require = createRequire(import.meta.url)

export async function runPdfOcr(
  config: JobConfig,
  signal: AbortSignal,
  onProgress: (progress: OcrProgress) => void
): Promise<DocumentBook> {
  throwIfAborted(signal)
  onProgress({
    stage: 'reading',
    percent: 8,
    message: '正在加载 PDF 文档。',
    level: 'info'
  })

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(await fs.readFile(config.inputPath))
  const pdf = await pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    disableFontFace: true
  }).promise

  const totalPages = pdf.numPages
  const fromPage = Math.max(1, config.ocr.pageRange?.from ?? 1)
  const toPage = Math.min(totalPages, config.ocr.pageRange?.to ?? totalPages)

  if (fromPage > toPage) {
    throw new Error('OCR 页码范围无效。')
  }

  const languages = config.ocr.languages.length > 0 ? config.ocr.languages : ['eng', 'chi_sim']
  const worker = await createOcrWorker(languages)
  const blocks: DocumentBook['blocks'] = []

  try {
    for (let pageNumber = fromPage; pageNumber <= toPage; pageNumber += 1) {
      throwIfAborted(signal)
      const pageIndex = pageNumber - fromPage
      const pageCount = toPage - fromPage + 1
      const basePercent = 12 + Math.round((pageIndex / pageCount) * 62)

      onProgress({
        stage: 'ocr',
        percent: basePercent,
        message: `正在识别第 ${pageNumber}/${totalPages} 页。`,
        page: pageNumber,
        totalPages,
        level: 'info'
      })

      const image = await renderPageToPng(pdf, pageNumber, config.ocr.dpi)
      throwIfAborted(signal)
      const result = await worker.recognize(image)
      const confidence = result.data.confidence ?? 0
      const text = normalizeOcrText(result.data.text)

      if (pageNumber > fromPage) {
        blocks.push({ type: 'pageBreak', sourcePage: pageNumber })
      }

      if (confidence < 55) {
        blocks.push({
          type: 'warning',
          text: `第 ${pageNumber} 页 OCR 置信度较低 (${Math.round(confidence)}%)，公式、表格或扫描质量可能影响结果。`
        })
      }

      const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean)

      if (paragraphs.length === 0) {
        blocks.push({ type: 'warning', text: `第 ${pageNumber} 页未识别到可重排文本。` })
      } else {
        for (const paragraph of paragraphs) {
          blocks.push({ type: 'paragraph', text: paragraph, confidence })
        }
      }

      onProgress({
        stage: 'ocr',
        percent: 12 + Math.round(((pageIndex + 1) / pageCount) * 62),
        message: `第 ${pageNumber} 页识别完成。`,
        page: pageNumber,
        totalPages,
        level: confidence < 55 ? 'warning' : 'info'
      })
    }
  } finally {
    await worker.terminate()
  }

  return {
    title: path.basename(config.inputPath, path.extname(config.inputPath)),
    sourcePath: config.inputPath,
    blocks
  }
}

async function renderPageToPng(pdf: { getPage: (pageNumber: number) => Promise<any> }, pageNumber: number, dpi: number): Promise<Buffer> {
  const page = await pdf.getPage(pageNumber)
  const scale = Math.max(1, dpi / 72)
  const viewport = page.getViewport({ scale })
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  const context = canvas.getContext('2d')

  await page.render({ canvasContext: context, viewport }).promise
  return canvas.toBuffer('image/png')
}

async function createOcrWorker(languages: string[]): Promise<Worker> {
  const languagePath = await prepareLanguageDirectory(languages)
  const worker = await createWorker(languages.join('+'), 1, {
    langPath: languagePath,
    cacheMethod: 'none'
  })

  return worker
}

async function prepareLanguageDirectory(languages: string[]): Promise<string> {
  const tempDir = path.join(os.tmpdir(), 'kindlepress-tessdata')
  await fs.mkdir(tempDir, { recursive: true })

  for (const language of languages) {
    const sourcePath = getLanguageFilePath(language)
    const targetPath = path.join(tempDir, `${language}.traineddata.gz`)
    await fs.copyFile(sourcePath, targetPath)
  }

  return `${tempDir}${path.sep}`
}

function getLanguageFilePath(language: string): string {
  const packageName = language === 'chi_sim' ? '@tesseract.js-data/chi_sim' : '@tesseract.js-data/eng'
  const packageJsonPath = require.resolve(`${packageName}/package.json`)
  return path.join(path.dirname(packageJsonPath), '4.0.0', `${language}.traineddata.gz`)
}

function normalizeOcrText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new Error('任务已取消。')
  }
}
