import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { InputType, JobConfig, JobProgress, PagePreset } from '../../shared/types'
import './styles.css'

const DEFAULT_TYPOGRAPHY = {
  fontFamily: 'Microsoft YaHei',
  fontSizePt: 10.5,
  lineHeight: 1.55,
  marginMm: 7
}

const DEFAULT_OCR = {
  languages: ['eng', 'chi_sim'] as Array<'eng' | 'chi_sim'>,
  dpi: 180
}

type LogEntry = JobProgress & { time: string }

function App(): React.JSX.Element {
  const [inputType, setInputType] = useState<InputType>('pdf')
  const [inputPath, setInputPath] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [pagePreset, setPagePreset] = useState<PagePreset>('kindle-6')
  const [customWidth, setCustomWidth] = useState(90)
  const [customHeight, setCustomHeight] = useState(120)
  const [fontFamily, setFontFamily] = useState(DEFAULT_TYPOGRAPHY.fontFamily)
  const [fontSizePt, setFontSizePt] = useState(DEFAULT_TYPOGRAPHY.fontSizePt)
  const [lineHeight, setLineHeight] = useState(DEFAULT_TYPOGRAPHY.lineHeight)
  const [marginMm, setMarginMm] = useState(DEFAULT_TYPOGRAPHY.marginMm)
  const [ocrDpi, setOcrDpi] = useState(DEFAULT_OCR.dpi)
  const [jobId, setJobId] = useState<string | null>(null)
  const [progress, setProgress] = useState<JobProgress | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])

  const busy = Boolean(jobId && progress?.stage !== 'completed' && progress?.stage !== 'failed' && progress?.stage !== 'cancelled')
  const canStart = inputPath.length > 0 && outputPath.length > 0 && !busy

  const pageLabel = useMemo(() => {
    if (pagePreset === 'custom') {
      return `${customWidth} x ${customHeight} mm`
    }
    if (pagePreset === 'kindle-paperwhite-6-8') {
      return 'Paperwhite 6.8 寸：100 x 135 mm'
    }
    return '通用 6 寸：90 x 120 mm'
  }, [customHeight, customWidth, pagePreset])

  useEffect(() => {
    return window.kindlePress.onJobProgress((nextProgress) => {
      setProgress(nextProgress)
      setLogs((current) => [
        {
          ...nextProgress,
          time: new Intl.DateTimeFormat('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }).format(new Date())
        },
        ...current
      ].slice(0, 80))

      if (['completed', 'failed', 'cancelled'].includes(nextProgress.stage)) {
        setJobId(null)
      }
    })
  }, [])

  async function chooseInput(type: InputType): Promise<void> {
    setInputType(type)
    const result = type === 'pdf'
      ? await window.kindlePress.selectPdfFile()
      : await window.kindlePress.selectMarkdownFolder()

    if (!result.canceled && result.path) {
      setInputPath(result.path)
      if (!outputPath) {
        const defaultName = type === 'pdf' ? result.path.replace(/\.pdf$/i, '-kindle.pdf') : 'kindlepress-output.pdf'
        const output = await window.kindlePress.selectOutputPath(defaultName)
        if (!output.canceled && output.path) {
          setOutputPath(output.path)
        }
      }
    }
  }

  async function chooseOutput(): Promise<void> {
    const result = await window.kindlePress.selectOutputPath(outputPath || 'kindlepress-output.pdf')
    if (!result.canceled && result.path) {
      setOutputPath(result.path)
    }
  }

  async function startConversion(): Promise<void> {
    const config: JobConfig = {
      inputType,
      inputPath,
      outputPath,
      pagePreset,
      customPageSize: pagePreset === 'custom' ? { widthMm: customWidth, heightMm: customHeight } : undefined,
      typography: {
        fontFamily,
        fontSizePt,
        lineHeight,
        marginMm
      },
      ocr: {
        languages: DEFAULT_OCR.languages,
        dpi: ocrDpi
      }
    }

    setLogs([])
    setProgress({
      jobId: 'pending',
      stage: 'queued',
      percent: 0,
      message: '正在提交任务。'
    })

    try {
      const result = await window.kindlePress.startConversion(config)
      setJobId(result.jobId)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setProgress({
        jobId: 'failed',
        stage: 'failed',
        percent: 100,
        message,
        level: 'error'
      })
      setLogs((current) => [
        {
          jobId: 'failed',
          stage: 'failed',
          percent: 100,
          message,
          level: 'error',
          time: new Intl.DateTimeFormat('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }).format(new Date())
        },
        ...current
      ])
    }
  }

  async function cancelConversion(): Promise<void> {
    if (jobId) {
      await window.kindlePress.cancelConversion(jobId)
    }
  }

  return (
    <main className="app-shell">
      <section className="toolbar">
        <div>
          <p className="eyebrow">KindlePress</p>
          <h1>学习书籍转 Kindle 阅读 PDF</h1>
        </div>
        <div className="status-pill" data-stage={progress?.stage ?? 'idle'}>
          <span>{stageLabel(progress?.stage)}</span>
          <strong>{Math.round(progress?.percent ?? 0)}%</strong>
        </div>
      </section>

      <section className="workspace">
        <div className="panel input-panel">
          <h2>输入与导出</h2>
          <div className="segmented" aria-label="输入类型">
            <button className={inputType === 'pdf' ? 'active' : ''} disabled={busy} onClick={() => void chooseInput('pdf')}>
              PDF 教材
            </button>
            <button className={inputType === 'markdown' ? 'active' : ''} disabled={busy} onClick={() => void chooseInput('markdown')}>
              Markdown 文件夹
            </button>
          </div>

          <FileRow label="输入路径" value={inputPath || '尚未选择'} muted={!inputPath} />
          <button className="secondary-button" disabled={busy} onClick={() => void chooseInput(inputType)}>
            {inputType === 'pdf' ? '选择 PDF' : '选择文件夹'}
          </button>

          <FileRow label="导出 PDF" value={outputPath || '尚未选择'} muted={!outputPath} />
          <button className="secondary-button" disabled={busy} onClick={() => void chooseOutput()}>
            选择导出位置
          </button>

          <div className="action-row">
            <button className="primary-button" disabled={!canStart} onClick={() => void startConversion()}>
              开始转换
            </button>
            <button className="danger-button" disabled={!busy} onClick={() => void cancelConversion()}>
              取消
            </button>
          </div>
        </div>

        <div className="panel settings-panel">
          <h2>Kindle 版式</h2>
          <label className="field">
            <span>页面预设</span>
            <select value={pagePreset} disabled={busy} onChange={(event) => setPagePreset(event.target.value as PagePreset)}>
              <option value="kindle-6">通用 6 寸</option>
              <option value="kindle-paperwhite-6-8">Paperwhite 6.8 寸</option>
              <option value="custom">自定义尺寸</option>
            </select>
          </label>
          <p className="setting-note">{pageLabel}</p>

          {pagePreset === 'custom' && (
            <div className="grid-two">
              <NumberField label="宽度 mm" value={customWidth} min={60} max={180} step={1} disabled={busy} onChange={setCustomWidth} />
              <NumberField label="高度 mm" value={customHeight} min={80} max={240} step={1} disabled={busy} onChange={setCustomHeight} />
            </div>
          )}

          <div className="grid-two">
            <NumberField label="字号 pt" value={fontSizePt} min={8} max={16} step={0.5} disabled={busy} onChange={setFontSizePt} />
            <NumberField label="边距 mm" value={marginMm} min={3} max={16} step={1} disabled={busy} onChange={setMarginMm} />
            <NumberField label="行距" value={lineHeight} min={1.2} max={2} step={0.05} disabled={busy} onChange={setLineHeight} />
            <NumberField label="OCR DPI" value={ocrDpi} min={120} max={300} step={10} disabled={busy || inputType !== 'pdf'} onChange={setOcrDpi} />
          </div>

          <label className="field">
            <span>字体</span>
            <select value={fontFamily} disabled={busy} onChange={(event) => setFontFamily(event.target.value)}>
              <option value="Microsoft YaHei">微软雅黑</option>
              <option value="SimSun">宋体</option>
              <option value="KaiTi">楷体</option>
              <option value="Georgia">Georgia</option>
            </select>
          </label>
        </div>

        <div className="panel progress-panel">
          <h2>任务进度</h2>
          <div className="progress-track">
            <div style={{ width: `${Math.min(100, Math.max(0, progress?.percent ?? 0))}%` }} />
          </div>
          <p className="progress-message">{progress?.message ?? '选择输入内容后开始转换。'}</p>

          <div className="log-list" aria-live="polite">
            {logs.length === 0 ? (
              <p className="empty-log">暂无日志</p>
            ) : (
              logs.map((log, index) => (
                <div className="log-entry" data-level={log.level ?? 'info'} key={`${log.time}-${index}`}>
                  <span>{log.time}</span>
                  <p>{log.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

function FileRow({ label, value, muted }: { label: string; value: string; muted?: boolean }): React.JSX.Element {
  return (
    <div className="file-row">
      <span>{label}</span>
      <p className={muted ? 'muted' : ''} title={value}>{value}</p>
    </div>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  disabled: boolean
  onChange: (value: number) => void
}): React.JSX.Element {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function stageLabel(stage?: JobProgress['stage']): string {
  switch (stage) {
    case 'queued':
      return '排队'
    case 'reading':
      return '读取'
    case 'ocr':
      return 'OCR'
    case 'layout':
      return '排版'
    case 'exporting':
      return '导出'
    case 'completed':
      return '完成'
    case 'failed':
      return '失败'
    case 'cancelled':
      return '已取消'
    default:
      return '待开始'
  }
}

createRoot(document.getElementById('root')!).render(<App />)
