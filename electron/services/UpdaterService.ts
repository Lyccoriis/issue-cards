import { app, type BrowserWindow } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'


const OWNER = 'Lyccoriis'
const REPO = 'issue-cards'

export type UpdateStage =
  | 'idle'
  | 'checking'
  | 'available'
  | 'none'
  | 'downloading'
  | 'ready'
  | 'error'

export interface UpdateState {
  stage: UpdateStage
  version: string
  currentVersion: string
  notes: string
  percent: number
  message: string
  supported: boolean
}

let target: BrowserWindow | null = null
let checking = false

const supported = app.isPackaged && process.env.PORTABLE_EXECUTABLE_DIR === undefined

let state: UpdateState = {
  stage: 'idle',
  version: '',
  currentVersion: app.getVersion(),
  notes: '',
  percent: 0,
  message: '',
  supported,
}

function push(next: Partial<UpdateState>): void {
  state = { ...state, ...next }
  target?.webContents.send('update:state', state)
}

function notesText(info: UpdateInfo): string {
  if (typeof info.releaseNotes === 'string') return info.releaseNotes
  if (Array.isArray(info.releaseNotes)) {
    return info.releaseNotes.map(note => note.note ?? '').filter(Boolean).join('\n\n')
  }
  return ''
}

export function initUpdater(win: BrowserWindow): void {
  target = win

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null

  autoUpdater.setFeedURL({ provider: 'github', owner: OWNER, repo: REPO })

  autoUpdater.on('checking-for-update', () => push({ stage: 'checking', message: '' }))

  autoUpdater.on('update-available', info => {
    checking = false
    push({ stage: 'available', version: info.version, notes: notesText(info), percent: 0 })
  })

  autoUpdater.on('update-not-available', info => {
    checking = false
    push({ stage: 'none', version: info.version, percent: 0 })
  })

  autoUpdater.on('download-progress', progress => {
    push({ stage: 'downloading', percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', info => {
    push({ stage: 'ready', version: info.version, percent: 100 })
  })

  autoUpdater.on('error', err => {
    checking = false
    push({ stage: 'error', message: err instanceof Error ? err.message : String(err) })
  })
}

export function getState(): UpdateState {
  return state
}

export async function checkForUpdate(): Promise<UpdateState> {
  if (!supported) {
    push({ stage: 'idle', message: 'Auto update only runs in the installed build' })
    return state
  }
  if (checking || state.stage === 'downloading') return state
  checking = true
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    checking = false
    push({ stage: 'error', message: err instanceof Error ? err.message : String(err) })
  }
  return state
}

export async function downloadUpdate(): Promise<UpdateState> {
  if (state.stage !== 'available') return state
  push({ stage: 'downloading', percent: 0 })
  try {
    await autoUpdater.downloadUpdate()
  } catch (err) {
    push({ stage: 'error', message: err instanceof Error ? err.message : String(err) })
  }
  return state
}

export function installUpdate(): void {
  if (state.stage !== 'ready') return
  setImmediate(() => autoUpdater.quitAndInstall(true, true))
}
