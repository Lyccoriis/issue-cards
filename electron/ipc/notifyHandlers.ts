import { Notification, type BrowserWindow, type IpcMain } from 'electron'

const live = new Set<Notification>()

interface ShowPayload {
  id: string
  title: string
  body: string
}

export function registerNotifyHandlers(ipcMain: IpcMain, win: BrowserWindow): void {
  ipcMain.on('notify:show', (_event, payload: ShowPayload) => {
    if (win.isDestroyed() || !Notification.isSupported()) return
    if (typeof payload?.id !== 'string' || typeof payload.title !== 'string') return

    const popup = new Notification({
      title: payload.title.slice(0, 120),
      body: String(payload.body ?? '').slice(0, 240),
    })
    live.add(popup)

    popup.on('click', () => {
      live.delete(popup)
      if (win.isDestroyed()) return
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
      win.webContents.send('notify:open', payload.id)
    })
    popup.on('close', () => live.delete(popup))
    popup.show()

    if (!win.isFocused()) win.flashFrame(true)
  })

  win.on('focus', () => win.flashFrame(false))
}
