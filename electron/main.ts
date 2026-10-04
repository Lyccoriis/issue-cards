import { app, BrowserWindow, Menu, ipcMain, nativeTheme, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { registerFileHandlers } from './ipc/fileHandlers'
import { registerNotifyHandlers } from './ipc/notifyHandlers'
import { registerUpdateHandlers } from './ipc/updateHandlers'
import { registerUploadHandlers } from './ipc/uploadHandlers'
import { initUpdater } from './services/UpdaterService'
import { setImgurClientId } from './services/UploadService'

const isDev = !app.isPackaged

type ThemeName = 'oled' | 'dark' | 'light'

const THEME_BG: Record<ThemeName, string> = { oled: '#000000', dark: '#0a0a0a', light: '#ffffff' }

function themePath(): string {
  return path.join(app.getPath('userData'), 'theme.json')
}

function readTheme(): ThemeName {
  try {
    const theme = JSON.parse(fs.readFileSync(themePath(), 'utf8')).theme
    if (theme === 'oled' || theme === 'dark' || theme === 'light') return theme
  } catch {}
  return 'oled'
}

function writeTheme(theme: ThemeName): void {
  try {
    fs.writeFileSync(themePath(), JSON.stringify({ theme }))
  } catch {}
}

function applyTheme(win: BrowserWindow, theme: ThemeName): void {
  nativeTheme.themeSource = theme === 'light' ? 'light' : 'dark'
  win.setBackgroundColor(THEME_BG[theme])
}

function openInBrowser(url: unknown): void {
  if (typeof url !== 'string') return
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') void shell.openExternal(parsed.href)
  } catch {}
}

function isAppUrl(url: string): boolean {
  if (isDev) return url.startsWith('http://localhost:5174')
  return url.startsWith('file://') && url.includes('/renderer/index.html')
}

function createWindow() {
  const theme = readTheme()

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    frame: false,
    backgroundColor: THEME_BG[theme],
    webPreferences: {
      preload: path.join(__dirname, 'preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    openInBrowser(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return
    event.preventDefault()
    openInBrowser(url)
  })

  if (isDev) {
    win.loadURL('http://localhost:5174')
    win.webContents.openDevTools()
    win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      if (level >= 2) console.log(`[renderer] ${message} (${sourceId}:${line})`)
    })
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}

function registerShellHandlers(win: BrowserWindow): void {
  ipcMain.on('shell:setTitle', (_event, title: string) => {
    win.setTitle(title)
  })

  ipcMain.on('shell:setTheme', (_event, value: string) => {
    const theme: ThemeName = value === 'light' ? 'light' : value === 'dark' ? 'dark' : 'oled'
    applyTheme(win, theme)
    writeTheme(theme)
  })

  ipcMain.on('window:minimize', () => win.minimize())
  ipcMain.on('window:maximize', () => (win.isMaximized() ? win.unmaximize() : win.maximize()))
  ipcMain.on('window:close', () => win.close())
  ipcMain.handle('window:isMaximized', () => win.isMaximized())

  const sendMaximized = () => {
    if (!win.isDestroyed()) win.webContents.send('window:maximized', win.isMaximized())
  }
  win.on('maximize', sendMaximized)
  win.on('unmaximize', sendMaximized)

  ipcMain.on('shell:openExternal', (_event, url: unknown) => openInBrowser(url))
}

const singleInstance = isDev || app.requestSingleInstanceLock()
if (!singleInstance) app.quit()

app.whenReady().then(() => {
  if (!singleInstance) return

  Menu.setApplicationMenu(null)

  app.setAppUserModelId('com.ezk.issuecards')

  const startTheme = readTheme()
  nativeTheme.themeSource = startTheme === 'light' ? 'light' : 'dark'

  const win = createWindow()

  app.on('second-instance', () => {
    if (win.isDestroyed()) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  registerShellHandlers(win)
  registerUploadHandlers(ipcMain, win)
  registerUpdateHandlers(ipcMain)
  registerNotifyHandlers(ipcMain, win)
  registerFileHandlers(ipcMain, win)
  initUpdater(win)

  ipcMain.on('upload:imgurKey', (_event, value: string) => setImgurClientId(value))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
