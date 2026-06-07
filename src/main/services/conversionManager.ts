import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { BrowserWindow } from 'electron'
import type { DocumentBook, JobConfig, JobProgress, PageSize } from '../../shared/types'
import { parseMarkdownFolder } from './markdown'
import { runPdfOcr } from './pdfOcr'
import { renderBookHtml } from './renderHtml'

type ProgressSink = (progress: JobProgress) => void

interface ActiveJob {
  controller: AbortController
  config: JobConfig
}

const PRESET_SIZES: Record<string, PageSize> = {
  'kindle-6': { widthMm: 90, heightMm: 120 },
  'kindle-paperwhite-6-8': { widthMm: 100, heightMm: 135 }
}

export class ConversionManager {
  private activeJob: ActiveJob | null = null

  constructor(private readonly sendProgress: ProgressSink) {}

  async start(config: JobConfig): Promise<{ jobId: string }> {
    if (this.activeJob) {
      throw new Error('已有转换任务正在运行，请先取消或等待完成。')
    }

    await this.validateConfig(config)
    const jobId = crypto.randomUUID()
    const controller = new AbortController()
    this.activeJob = { controller, config }

    void this.run(jobId, config, controller).finally(() => {
      if (this.activeJob?.controller === controller) {
        this.activeJob = null
      }
    })

    return { jobId }
  }

  cancel(jobId: string): { cancelled: boolean } {
    if (!this.activeJob) {
      return { cancelled: false }
    }

    this.activeJob.controller.abort(`用户取消任务 ${jobId}`)
    return { cancelled: true }
  }

  private async run(jobId: string, config: JobConfig, controller: AbortController): Promise<void> {
    try {
      this.emit(jobId, 'queued', 0, '任务已加入队列。')
      const book = await this.loadBook(jobId, config, controller)
      this.throwIfAborted(controller)
      this.emit(jobId, 'layout', 78, '正在生成 Kindle 阅读版式。')
      const pageSize = getPageSize(config)
      const html = renderBookHtml(book, config.typography, pageSize)
      await this.exportPdf(jobId, html, config.outputPath, pageSize, controller)
      this.emit(jobId, 'completed', 100, `导出完成：${config.outputPath}`)
    } catch (error) {
      if (controller.signal.aborted) {
        this.emit(jobId, 'cancelled', 100, '任务已取消。')
        return
      }

      const message = error instanceof Error ? error.message : String(error)
      this.emit(jobId, 'failed', 100, message, 'error')
    }
  }

  private async loadBook(
    jobId: string,
    config: JobConfig,
    controller: AbortController
  ): Promise<DocumentBook> {
    this.emit(jobId, 'reading', 5, '正在读取输入内容。')

    if (config.inputType === 'markdown') {
      const book = await parseMarkdownFolder(config.inputPath, controller.signal, (message) => {
        this.emit(jobId, 'reading', 18, message)
      })
      this.emit(jobId, 'reading', 64, `已合并 ${book.blocks.length} 个内容块。`)
      return book
    }

    return runPdfOcr(config, controller.signal, (progress) => {
      this.sendProgress({ jobId, ...progress })
    })
  }

  private async exportPdf(
    jobId: string,
    html: string,
    outputPath: string,
    pageSize: PageSize,
    controller: AbortController
  ): Promise<void> {
    this.throwIfAborted(controller)
    this.emit(jobId, 'exporting', 84, '正在写入 PDF 文件。')

    const win = new BrowserWindow({
      show: false,
      width: 900,
      height: 1200,
      webPreferences: {
        offscreen: true,
        sandbox: true
      }
    })

    try {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      this.throwIfAborted(controller)
      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        pageSize: {
          width: pageSize.widthMm / 25.4,
          height: pageSize.heightMm / 25.4
        },
        margins: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0
        }
      })

      this.throwIfAborted(controller)
      await fs.mkdir(path.dirname(outputPath), { recursive: true })
      await fs.writeFile(outputPath, pdfBuffer)
    } finally {
      win.close()
    }
  }

  private async validateConfig(config: JobConfig): Promise<void> {
    if (!config.inputPath || !config.outputPath) {
      throw new Error('请选择输入内容和导出位置。')
    }

    await fs.access(config.inputPath)
    if (config.inputType === 'pdf' && path.extname(config.inputPath).toLowerCase() !== '.pdf') {
      throw new Error('PDF 输入必须选择 .pdf 文件。')
    }

    if (config.pagePreset === 'custom' && !config.customPageSize) {
      throw new Error('自定义页面尺寸不能为空。')
    }
  }

  private throwIfAborted(controller: AbortController): void {
    if (controller.signal.aborted) {
      throw new Error('任务已取消。')
    }
  }

  private emit(
    jobId: string,
    stage: JobProgress['stage'],
    percent: number,
    message: string,
    level: JobProgress['level'] = 'info'
  ): void {
    this.sendProgress({ jobId, stage, percent, message, level })
  }
}

export function getPageSize(config: JobConfig): PageSize {
  if (config.pagePreset === 'custom' && config.customPageSize) {
    return config.customPageSize
  }

  return PRESET_SIZES[config.pagePreset] ?? PRESET_SIZES['kindle-6']
}
