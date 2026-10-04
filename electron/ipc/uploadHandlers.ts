import { dialog, type BrowserWindow, type IpcMain } from 'electron'

import {
  cancelUpload,
  forgetUpload,
  listUploads,
  onUploadJob,
  queueBytes,
  queuePath,
  queueRehost,
  retryUpload,
} from '../services/UploadService'

export function registerUploadHandlers(ipcMain: IpcMain, win: BrowserWindow): void {
  onUploadJob(job => {
    if (!win.isDestroyed()) win.webContents.send('upload:job', job)
  })

  ipcMain.handle('upload:file', (_event, filePath: string, target: string) =>
    queuePath(filePath, target),
  )

  ipcMain.handle('upload:bytes', (_event, data: ArrayBuffer, name: string, target: string) =>
    queueBytes(data, name, target),
  )

  ipcMain.handle('upload:rehost', (_event, url: string, target: string) => queueRehost(url, target))

  ipcMain.handle('upload:jobs', () => listUploads())
  ipcMain.handle('upload:retry', (_event, id: string) => retryUpload(id))
  ipcMain.on('upload:cancel', (_event, id: string) => cancelUpload(id))
  ipcMain.on('upload:forget', (_event, id: string) => forgetUpload(id))

  ipcMain.handle('upload:pick', async () => {
    const picked = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Images and video',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif', 'mp4', 'webm', 'mov', 'mkv'],
        },
        { name: 'Logs and crash reports', extensions: ['log', 'txt'] },
        { name: 'All files', extensions: ['*'] },
      ],
    })
    return picked.canceled ? [] : picked.filePaths
  })
}
