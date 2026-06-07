import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions, type SaveDialogOptions } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ConversionManager } from './services/conversionManager'
import type { JobConfig } from '../shared/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let conversionManager: ConversionManager

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 960,
    minHeight: 680,
    title: 'KindlePress',
    backgroundColor: '#f6f3ed',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('dialog:select-pdf', async () => {
    const options: OpenDialogOptions = {
      title: '选择 PDF 教材',
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
      properties: ['openFile']
    }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)

    return { canceled: result.canceled, path: result.filePaths[0] }
  })

  ipcMain.handle('dialog:select-markdown-folder', async () => {
    const options: OpenDialogOptions = {
      title: '选择 Markdown 书籍文件夹',
      properties: ['openDirectory']
    }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)

    return { canceled: result.canceled, path: result.filePaths[0] }
  })

  ipcMain.handle('dialog:select-output-path', async (_event, defaultName: string) => {
    const options: SaveDialogOptions = {
      title: '选择导出位置',
      defaultPath: defaultName.endsWith('.pdf') ? defaultName : `${defaultName}.pdf`,
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }]
    }
    const result = mainWindow
      ? await dialog.showSaveDialog(mainWindow, options)
      : await dialog.showSaveDialog(options)

    return { canceled: result.canceled, path: result.filePath }
  })

  ipcMain.handle('job:start', async (_event, config: JobConfig) => {
    return conversionManager.start(config)
  })

  ipcMain.handle('job:cancel', async (_event, jobId: string) => {
    return conversionManager.cancel(jobId)
  })
}

app.whenReady().then(() => {
  conversionManager = new ConversionManager((progress) => {
    mainWindow?.webContents.send('job:progress', progress)
  })
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
