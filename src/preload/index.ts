import { contextBridge, ipcRenderer } from 'electron'
import type { JobConfig, JobProgress, KindlePressApi } from '../shared/types'

const api: KindlePressApi = {
  selectPdfFile: () => ipcRenderer.invoke('dialog:select-pdf'),
  selectMarkdownFolder: () => ipcRenderer.invoke('dialog:select-markdown-folder'),
  selectOutputPath: (defaultName: string) => ipcRenderer.invoke('dialog:select-output-path', defaultName),
  startConversion: (config: JobConfig) => ipcRenderer.invoke('job:start', config),
  cancelConversion: (jobId: string) => ipcRenderer.invoke('job:cancel', jobId),
  onJobProgress: (callback: (progress: JobProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: JobProgress): void => callback(progress)
    ipcRenderer.on('job:progress', listener)
    return () => ipcRenderer.removeListener('job:progress', listener)
  }
}

contextBridge.exposeInMainWorld('kindlePress', api)
