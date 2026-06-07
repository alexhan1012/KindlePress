export type InputType = 'pdf' | 'markdown'

export type PagePreset = 'kindle-6' | 'kindle-paperwhite-6-8' | 'custom'

export interface PageSize {
  widthMm: number
  heightMm: number
}

export interface TypographySettings {
  fontFamily: string
  fontSizePt: number
  lineHeight: number
  marginMm: number
}

export interface OcrSettings {
  languages: Array<'eng' | 'chi_sim'>
  dpi: number
  pageRange?: {
    from?: number
    to?: number
  }
}

export interface JobConfig {
  inputType: InputType
  inputPath: string
  outputPath: string
  pagePreset: PagePreset
  customPageSize?: PageSize
  typography: TypographySettings
  ocr: OcrSettings
}

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: 'paragraph'; text: string; confidence?: number }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; text: string; language?: string }
  | { type: 'image'; src: string; alt?: string }
  | { type: 'pageBreak'; sourcePage?: number }
  | { type: 'warning'; text: string }

export interface DocumentBook {
  title?: string
  sourcePath: string
  blocks: Block[]
}

export type JobStage =
  | 'queued'
  | 'reading'
  | 'ocr'
  | 'layout'
  | 'exporting'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface JobProgress {
  jobId: string
  stage: JobStage
  percent: number
  message: string
  page?: number
  totalPages?: number
  level?: 'info' | 'warning' | 'error'
}

export interface StartJobResult {
  jobId: string
}

export interface DialogResult {
  canceled: boolean
  path?: string
}

export interface KindlePressApi {
  selectPdfFile: () => Promise<DialogResult>
  selectMarkdownFolder: () => Promise<DialogResult>
  selectOutputPath: (defaultName: string) => Promise<DialogResult>
  startConversion: (config: JobConfig) => Promise<StartJobResult>
  cancelConversion: (jobId: string) => Promise<{ cancelled: boolean }>
  onJobProgress: (callback: (progress: JobProgress) => void) => () => void
}
