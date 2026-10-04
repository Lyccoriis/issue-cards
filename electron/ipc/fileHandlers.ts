import { app, dialog, type BrowserWindow, type IpcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

function memoryPath(): string {
  return path.join(app.getPath('userData'), 'feature-dir.json')
}

function startDir(): string {
  try {
    const saved = JSON.parse(fs.readFileSync(memoryPath(), 'utf8')).dir
    if (typeof saved === 'string' && fs.existsSync(saved)) return saved
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') console.warn('feature dir memory unreadable', err)
  }
  return app.getPath('documents')
}

function rememberDir(dir: string): void {
  try {
    fs.writeFileSync(memoryPath(), JSON.stringify({ dir }))
  } catch (err) {
    console.warn('could not save the feature folder', err)
  }
}

export function registerFileHandlers(ipcMain: IpcMain, win: BrowserWindow): void {
  ipcMain.handle('files:pickFeature', async () => {
    const picked = await dialog.showOpenDialog(win, {
      defaultPath: startDir(),
      properties: ['openFile'],
      filters: [{ name: 'Feature files', extensions: ['md', 'txt'] }],
    })
    if (picked.canceled || !picked.filePaths[0]) return null
    const file = picked.filePaths[0]
    rememberDir(path.dirname(file))
    return { name: path.basename(file), text: await fs.promises.readFile(file, 'utf8') }
  })
}
