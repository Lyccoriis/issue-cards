import { contextBridge, ipcRenderer, webUtils } from 'electron'

const api = {
  shell: {
    setTitle: (title: string) => ipcRenderer.send('shell:setTitle', title),
    setTheme: (theme: string) => ipcRenderer.send('shell:setTheme', theme),
    openExternal: (url: string) => ipcRenderer.send('shell:openExternal', url),
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximized: (fn: (value: boolean) => void) => {
      const listener = (_event: unknown, value: boolean) => fn(value)
      ipcRenderer.on('window:maximized', listener as never)
      return () => ipcRenderer.off('window:maximized', listener as never)
    },
  },
  upload: {
    pick: () => ipcRenderer.invoke('upload:pick'),
    file: (filePath: string, target: string) => ipcRenderer.invoke('upload:file', filePath, target),
    bytes: (data: ArrayBuffer, name: string, target: string) =>
      ipcRenderer.invoke('upload:bytes', data, name, target),
    rehost: (url: string, target: string) => ipcRenderer.invoke('upload:rehost', url, target),
    jobs: () => ipcRenderer.invoke('upload:jobs'),
    retry: (id: string) => ipcRenderer.invoke('upload:retry', id),
    cancel: (id: string) => ipcRenderer.send('upload:cancel', id),
    forget: (id: string) => ipcRenderer.send('upload:forget', id),
    onJob: (fn: (job: unknown) => void) => {
      const listener = (_event: unknown, job: unknown) => fn(job)
      ipcRenderer.on('upload:job', listener as never)
      return () => ipcRenderer.off('upload:job', listener as never)
    },
    setImgurKey: (value: string) => ipcRenderer.send('upload:imgurKey', value),
    pathForFile: (file: File) => webUtils.getPathForFile(file),
  },
  files: {
    pickFeature: () => ipcRenderer.invoke('files:pickFeature'),
  },
  notify: {
    show: (payload: { id: string; title: string; body: string }) => ipcRenderer.send('notify:show', payload),
    onOpen: (fn: (id: string) => void) => {
      const listener = (_event: unknown, id: string) => fn(id)
      ipcRenderer.on('notify:open', listener as never)
      return () => ipcRenderer.off('notify:open', listener as never)
    },
  },
  update: {
    state: () => ipcRenderer.invoke('update:state'),
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.send('update:install'),
    onState: (fn: (state: unknown) => void) => {
      const listener = (_event: unknown, state: unknown) => fn(state)
      ipcRenderer.on('update:state', listener as never)
      return () => ipcRenderer.off('update:state', listener as never)
    },
  },
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
